import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";
import { vendorGate, VENDORS, type OnboardingRow } from "../../../supabase/functions/_shared/vendors";
import { assertAllowedUrl, redact, GatewayError } from "../../../supabase/functions/_shared/gateway";
import { EVENT_ALLOWLIST, isReplay, verifyCallback } from "../../../supabase/functions/_shared/vendorCallbacks";
import {
  DOSESPOT_EVENT_MAP, doseSpotPrescribingGate, sanitizeVendorPatch, stediEnrollmentState,
} from "../../../supabase/functions/_shared/vendorAdapters";
import { VENDORS as UI_VENDORS, checklistFor } from "@/lib/vendorRegistry";

/**
 * Launch-vendor regression gate (DoseSpot / Stedi / Health Gorilla / DocUpdate).
 * Proves production stays unreachable, secrets stay out of the database and
 * inbound vendor events are quarantined — enforced server-side, not in the UI.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");

const policies = loadEffectivePolicies();
const TABLES = ["vendor_onboarding", "vendor_onboarding_events", "vendor_callback_quarantine"] as const;

const row = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({
  id: "r", hospital_id: "h", vendor_key: "stedi", environment: "sandbox",
  state: "sandbox_configured", capabilities: { eligibility_270_271: true },
  secret_ref_names: ["STEDI_API_KEY_REF"], last_test_result: "passed",
  evidence_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  ...over,
});

describe("vendor onboarding tenancy", () => {
  it.each(TABLES)("%s: every policy is tenant-scoped", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) expect(isTenantScoped(p.expr), `${table} · ${p.name}`).toBe(true);
  });

  it.each(TABLES)("%s: no anonymous or public grants", (table) => {
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON\\s+public\\.${table}\\s+TO\\s+(anon|public)`, "i"));
  });

  it("history and quarantine are append-only and never client-writable", () => {
    for (const t of ["vendor_onboarding_events", "vendor_callback_quarantine"]) {
      expect(sql).not.toMatch(new RegExp(`GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*ON\\s+public\\.${t}\\s+TO\\s+authenticated`, "i"));
    }
    expect(sql).toMatch(/BEFORE\s+UPDATE\s+OR\s+DELETE\s+ON\s+public\.vendor_onboarding_events[\s\S]{0,120}deny_mutation/i);
  });

  it("database refuses production_verified without complete, unexpired, independent evidence", () => {
    expect(sql).toMatch(/production_verified requires contract, credential, certification and approval evidence/);
    expect(sql).toMatch(/production_verified requires a passed end-to-end test/);
    expect(sql).toMatch(/production_verified requires unexpired evidence/);
    expect(sql).toMatch(/self-approval is denied/);
  });

  it("database rejects anything but uppercase secret reference names", () => {
    expect(sql).toMatch(/secret_ref_names must contain uppercase reference names only, never secret values/);
  });
});

describe("fail-closed vendor gate", () => {
  it("blocks production unless the profile is verified with unexpired evidence", () => {
    expect(vendorGate(row({ environment: "production", state: "production_review" }), "eligibility_270_271", "production"))
      .toBe("production_not_verified");
    expect(vendorGate(row({ environment: "production", state: "production_verified", evidence_expires_at: "2020-01-01T00:00:00Z" }), "eligibility_270_271", "production"))
      .toBe("evidence_expired");
    expect(vendorGate(row({ environment: "production", state: "production_verified" }), "eligibility_270_271", "production")).toBeNull();
  });

  it("keeps sandbox and production strictly separate", () => {
    expect(vendorGate(row({ environment: "sandbox" }), "eligibility_270_271", "production")).toBe("environment_mismatch");
    expect(vendorGate(row({ environment: "production", state: "production_verified" }), "eligibility_270_271", "sandbox")).toBe("environment_mismatch");
  });

  it("blocks missing profiles, suspensions, disabled capabilities and missing secret references", () => {
    expect(vendorGate(null, "eligibility_270_271", "sandbox")).toBe("no_vendor_profile");
    expect(vendorGate(row({ state: "suspended" }), "eligibility_270_271", "sandbox")).toBe("suspended");
    expect(vendorGate(row({ capabilities: {} }), "eligibility_270_271", "sandbox")).toBe("capability_not_enabled");
    expect(vendorGate(row({ secret_ref_names: [] }), "eligibility_270_271", "sandbox")).toBe("secret_references_missing");
    expect(vendorGate(row({ state: "not_contracted" }), "eligibility_270_271", "sandbox")).toBe("sandbox_not_configured");
  });

  it("DocUpdate can never be an integration target", () => {
    expect(VENDORS.docupdate.standaloneOnly).toBe(true);
    expect(vendorGate(row({ vendor_key: "docupdate", capabilities: { new_rx: true } }), "new_rx", "sandbox"))
      .toBe("vendor_not_integrated");
    expect(UI_VENDORS.docupdate.tagline).toMatch(/STANDALONE · NOT INTEGRATED · NON-CONTROLLED ONLY/);
    expect(UI_VENDORS.docupdate.warning).toMatch(/duplicate-entered/i);
  });

  it("DoseSpot live transport stays unavailable until the partner package exists", () => {
    expect(VENDORS.dosespot.requiresPartnerPackage).toBe(true);
    expect(vendorGate(row({
      vendor_key: "dosespot", capabilities: { new_rx: true },
      secret_ref_names: VENDORS.dosespot.secretRefs,
    }), "new_rx", "sandbox")).toBe("vendor_partner_package_required");
  });

  it("DoseSpot separates controlled from non-controlled prescribing", () => {
    const nonControlled = row({ vendor_key: "dosespot", capabilities: { new_rx: true }, secret_ref_names: VENDORS.dosespot.secretRefs });
    expect(doseSpotPrescribingGate(nonControlled, true)).not.toBeNull();
    expect(doseSpotPrescribingGate(nonControlled, false)).toBe("vendor_partner_package_required");
    expect(doseSpotPrescribingGate(row({ vendor_key: "dosespot", capabilities: { epcs: false } }), true)).not.toBeNull();
  });
});

describe("outbound gateway safety", () => {
  it("refuses non-allowlisted hosts, plaintext and credentialed URLs (SSRF)", () => {
    for (const bad of [
      "https://evil.example.com/x", "http://healthcare.us.stedi.com/x",
      "https://user:pass@healthcare.us.stedi.com/x", "https://169.254.169.254/latest/meta-data",
      "https://api.healthgorilla.com/fhir/R4/Patient", // production host in sandbox env
    ]) {
      expect(() => assertAllowedUrl(bad.includes("gorilla") ? "health_gorilla" : "stedi", "sandbox", bad)).toThrow(GatewayError);
    }
    expect(assertAllowedUrl("stedi", "sandbox", "https://healthcare.us.stedi.com/x").hostname).toBe("healthcare.us.stedi.com");
    expect(assertAllowedUrl("health_gorilla", "production", "https://api.healthgorilla.com/fhir/R4/Patient").hostname)
      .toBe("api.healthgorilla.com");
  });

  it("DoseSpot has no assumed hosts, so no URL is reachable", () => {
    expect(VENDORS.dosespot.hosts.sandbox).toHaveLength(0);
    expect(() => assertAllowedUrl("dosespot", "sandbox", "https://my.dosespot.com/x")).toThrow(GatewayError);
  });

  it("redacts secrets from anything that could reach a log or client", () => {
    const out = redact('{"api_key":"sk_live_abcdef123456","authorization":"Bearer eyJhbGciOi.payloadpayload.signaturesig"}');
    expect(out).not.toContain("sk_live_abcdef123456");
    expect(out).toContain("[REDACTED]");
    expect(redact("Bearer eyJhbGciOi.payloadpayload.signaturesig")).not.toContain("payloadpayload");
  });
});

describe("inbound callbacks", () => {
  const headers = (over: Record<string, string> = {}) =>
    new Headers({ "x-vendor-timestamp": String(Math.floor(Date.now() / 1000)), ...over });

  it("quarantines unknown event types", async () => {
    const v = await verifyCallback("stedi", headers(), "{}", "not.a.real.event", null);
    expect(v.verified).toBe(false);
    expect(v.reason).toBe("event_type_not_allowlisted");
  });

  it("rejects stale timestamps", async () => {
    const v = await verifyCallback("stedi", new Headers({ "x-vendor-timestamp": "1000000" }), "{}", "835.received", null);
    expect(v.verified).toBe(false);
    expect(v.reason).toBe("timestamp_missing_or_outside_tolerance");
  });

  it("detects replays by payload hash", () => {
    const hash = `hash-${Math.random()}`;
    expect(isReplay(hash)).toBe(false);
    expect(isReplay(hash)).toBe(true);
  });

  it("fails closed when the vendor signing scheme is not provisioned", async () => {
    const v = await verifyCallback("health_gorilla", headers(), `{"n":${Math.random()}}`, "DiagnosticReport", "c1");
    expect(v.verified).toBe(false);
    expect(v.reason).toBe("vendor_signature_scheme_not_provisioned");
  });

  it("has no event allowlist at all for DocUpdate", async () => {
    expect(EVENT_ALLOWLIST.docupdate).toHaveLength(0);
    const v = await verifyCallback("docupdate", headers(), "{}", "NewRx", null);
    expect(v.reason).toBe("no_event_allowlist_for_vendor");
  });
});

describe("vendor mapping into existing models", () => {
  it("maps DoseSpot / NCPDP events onto the existing prescription lifecycle", () => {
    expect(DOSESPOT_EVENT_MAP.NewRx).toBe("transmitted");
    expect(DOSESPOT_EVENT_MAP.RxRenewalRequest).toBe("ready_for_review");
    expect(DOSESPOT_EVENT_MAP.RxFill).toBe("filled");
    expect(Object.keys(DOSESPOT_EVENT_MAP).every((k) => EVENT_ALLOWLIST.dosespot.includes(k))).toBe(true);
  });

  it("never lets a vendor callback overwrite signed clinical content", () => {
    const patch = sanitizeVendorPatch({ status: "accepted", sig: "tampered", signed_by: "x", quantity: 999, vendor_reference: "v1" });
    expect(patch).toEqual({ status: "accepted", vendor_reference: "v1" });
  });

  it("fails closed on Stedi enrollment and support states", () => {
    expect(stediEnrollmentState("SUPPORTED")).toEqual({ enrollment_status: "supported", blocked: false });
    expect(stediEnrollmentState("ENROLLMENT_REQUIRED").blocked).toBe(true);
    expect(stediEnrollmentState("NOT_SUPPORTED").blocked).toBe(true);
    expect(stediEnrollmentState(undefined).blocked).toBe(true);
  });

  it("Health Gorilla results are staging-only and its FHIR bases are environment-split", () => {
    expect(VENDORS.health_gorilla.hosts.sandbox).toEqual(["sandbox.healthgorilla.com"]);
    expect(VENDORS.health_gorilla.hosts.production).toEqual(["api.healthgorilla.com"]);
    expect(UI_VENDORS.health_gorilla.warning).toMatch(/Network membership is not lab access/);
  });
});

describe("onboarding packets and claim guards", () => {
  it("every vendor carries the full onboarding checklist", () => {
    for (const key of ["dosespot", "stedi", "health_gorilla", "docupdate"] as const) {
      const list = checklistFor(key);
      for (const required of ["baa_msa_dpa_executed", "rollback_and_downtime_plan", "data_retention_and_deletion", "exit_and_offboarding_plan"]) {
        expect(list, key).toContain(required);
      }
    }
  });

  it("stores secret reference names only — never values", () => {
    for (const def of Object.values(VENDORS)) {
      for (const ref of def.secretRefs) expect(ref).toMatch(/^[A-Z][A-Z0-9_]+_REF$/);
    }
  });

  it("Stedi copy never implies EFT from receiving an 835", () => {
    expect(UI_VENDORS.stedi.warning).toMatch(/never implies EFT/i);
    expect(UI_VENDORS.stedi.artifacts.some((a) => /EFT is a separate bank setup/.test(a.unlocks))).toBe(true);
  });

  it("DoseSpot UI states production is not live until verified", () => {
    expect(UI_VENDORS.dosespot.warning).toMatch(/NOT LIVE/);
  });
});
