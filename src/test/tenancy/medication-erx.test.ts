import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";
import { signingBlockers } from "@/lib/erx";
import { evaluateSafety } from "../../../supabase/functions/_shared/medSafety";
import { gate, adapterFor, type ErxProfile } from "../../../supabase/functions/_shared/erx";

/**
 * Medication / e-prescribing regression gate.
 * Proves the lifecycle, safety stops, EPCS block and vendor fail-closed
 * behaviour live in the database and server adapter — never in the UI.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const TABLES = [
  "prescription_events",
  "medication_safety_checks",
  "medication_safety_overrides",
  "pdmp_queries",
  "pdmp_access_events",
  "erx_integration_profiles",
  "erx_outbox",
  "erx_inbox",
  "medication_history_candidates",
] as const;

describe("medication & eRx tenancy", () => {
  it.each(TABLES)("%s: every policy is tenant-scoped", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) {
      expect(isTenantScoped(p.expr), `${table} · ${p.name}`).toBe(true);
    }
  });

  it.each(TABLES)("%s: no anonymous or public grants", (table) => {
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON\\s+public\\.${table}\\s+TO\\s+(anon|public)`, "i"));
    expect(sql).not.toMatch(new RegExp(`ON\\s+public\\.${table}\\s+FOR\\s+\\w+\\s+TO\\s+anon`, "i"));
  });

  it("append-only tables have no client INSERT/UPDATE/DELETE grants", () => {
    for (const table of ["prescription_events", "pdmp_queries", "pdmp_access_events", "erx_outbox", "erx_inbox"]) {
      expect(sql).not.toMatch(new RegExp(`GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*ON\\s+public\\.${table}\\s+TO\\s+authenticated`, "i"));
    }
  });

  it("event/audit tables reject mutation via deny_mutation triggers", () => {
    for (const t of ["prescription_events", "medication_safety_checks", "medication_safety_overrides", "pdmp_access_events", "pdmp_queries"]) {
      expect(sql).toMatch(new RegExp(`BEFORE\\s+UPDATE\\s+OR\\s+DELETE\\s+ON\\s+public\\.${t}[\\s\\S]{0,120}deny_mutation`, "i"));
    }
  });

  it("outbox and inbox envelopes are idempotent by event id", () => {
    expect(sql).toMatch(/event_id text NOT NULL UNIQUE[\s\S]*prescription_id uuid NOT NULL REFERENCES public\.prescriptions/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.erx_inbox[\s\S]*event_id text NOT NULL UNIQUE/);
  });

  it("integration profiles never store credential values and are admin-write only", () => {
    expect(sql).toMatch(/secret_ref_names must be uppercase secret NAMES only/);
    expect(sql).not.toMatch(/erx_integration_profiles[\s\S]{0,600}(client_secret|private_key|password|otp_seed)/i);
    const write = (policies.get("erx_integration_profiles") ?? []).filter((p) => p.cmd !== "SELECT");
    expect(write.length).toBeGreaterThan(0);
    for (const p of write) expect(p.expr).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'/i);
  });

  it("PDMP metadata is restricted to the requester or an admin auditor", () => {
    const select = (policies.get("pdmp_queries") ?? []).find((p) => p.cmd === "SELECT")!;
    expect(select.expr).toMatch(/requested_by = auth\.uid\(\)/);
    expect(select.expr).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'/i);
    expect(sql).not.toMatch(/pdmp[\s\S]{0,200}raw_report/i);
  });
});

describe("prescription lifecycle enforcement (database)", () => {
  const fn = /CREATE OR REPLACE FUNCTION public\.enforce_prescription_lifecycle[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";

  it("binds prescriber to auth.uid() and rejects actor/patient spoofing", () => {
    expect(fn).toMatch(/NEW\.prescriber_id := uid/);
    expect(fn).toMatch(/patient, prescriber and encounter are immutable/);
  });

  it("rejects invalid transitions and stale versions", () => {
    expect(fn).toMatch(/invalid prescription transition/);
    expect(fn).toMatch(/stale prescription version/);
    expect(fn).toMatch(/transmission status is set by the server transmission path only/);
  });

  it("keeps signed content immutable and blocks client delete of signed rows", () => {
    expect(fn).toMatch(/signed prescription content is immutable/);
    const del = (policies.get("prescriptions") ?? []).find((p) => p.cmd === "DELETE")!;
    expect(del.expr).toMatch(/signed_at IS NULL/);
    expect(del.expr).toMatch(/prescriber_id = auth\.uid\(\)/);
  });

  it("requires prerequisites and prescribing authority before signing", () => {
    for (const rule of [
      /controlled substance prescribing is disabled/,
      /RxNorm RxCUI is required/,
      /days supply, refills and indication are required/,
      /a pharmacy selection is required/,
      /documented exception reason is required/,
      /medication and allergy reconciliation must be completed first/,
      /no active prescribing authority for state/,
      /unresolved hard safety stop blocks signing/,
      /reviewable safety alerts require acknowledgment with a rationale/,
    ]) expect(fn).toMatch(rule);
  });

  it("hard stops can never be overridden and EPCS can never be enabled", () => {
    expect(sql).toMatch(/hard safety stop cannot be overridden/);
    expect(sql).toMatch(/EPCS is disabled: DEA certification/);
    expect(sql).toMatch(/EPCS capability cannot be enabled/);
  });

  it("external history cannot mutate the active list without clinician review", () => {
    expect(sql).toMatch(/imported medication provenance is immutable/);
    expect(sql).toMatch(/candidate already reviewed/);
  });
});

describe("safety rules", () => {
  const base = { activeMeds: [], allergies: [] };

  it("flags a severe allergy as a non-overridable hard stop", () => {
    const checks = evaluateSafety({ ...base, drug: "Amoxicillin 500 mg", allergies: [{ allergen: "penicillin", severity: "severe" }] });
    expect(checks.find((c) => c.check_type === "allergy_conflict")?.severity).toBe("hard");
  });

  it("flags cross-reactive and duplicate therapy as reviewable", () => {
    const checks = evaluateSafety({ ...base, drug: "Ibuprofen 400 mg", allergies: [{ allergen: "naproxen", severity: "moderate" }], activeMeds: [{ name: "Naproxen 250 mg" }] });
    expect(checks.some((c) => c.check_type === "allergy_conflict" && c.severity === "reviewable")).toBe(true);
    expect(checks.some((c) => c.check_type === "duplicate_therapy")).toBe(true);
  });

  it("flags major interactions and stamps source provenance", () => {
    const checks = evaluateSafety({ ...base, drug: "Ibuprofen", activeMeds: [{ name: "Warfarin 5 mg" }] });
    const hit = checks.find((c) => c.detail_code === "major_interaction")!;
    expect(hit.severity).toBe("reviewable");
    expect(hit.source_version).toMatch(/\d{4}\./);
  });

  it("hard-stops refill counts above the regulatory maximum", () => {
    const checks = evaluateSafety({ ...base, drug: "Lisinopril", refills: 12 });
    expect(checks.find((c) => c.detail_code === "refills_exceed_limit")?.severity).toBe("hard");
  });
});

describe("transmission gate fails closed", () => {
  const verifiedProd: ErxProfile = {
    id: "p", vendor: "dosespot", environment: "production", epcs_enabled: false,
    verification_status: "verified", capabilities: { new_rx: true },
  };
  const row = {
    id: "r", hospital_id: "h", vendor_key: "dosespot" as const, environment: "production" as const,
    state: "production_verified" as const, secret_ref_names: [], last_test_result: null,
    evidence_expires_at: null, capabilities: { new_rx: true },
  };

  it("blocks controlled substances without EPCS evidence", () => {
    expect(gate(verifiedProd, "epcs", true, row)).toBe("epcs_not_enabled_on_profile");
    expect(gate({ ...verifiedProd, epcs_enabled: true }, "epcs", true, row)).toBeTruthy();
    expect(gate(verifiedProd, "epcs", false, row)).toBe("epcs_requires_controlled_context");
  });

  it("blocks missing, unverified and capability-less profiles", () => {
    expect(gate(null, "new_rx", false)).toBe("no_integration_profile");
    expect(gate({ ...verifiedProd, verification_status: "testing" }, "new_rx", false, row)).toBe("profile_unverified");
    expect(gate({ ...verifiedProd, capabilities: {} }, "new_rx", false, row)).toBe("capability_not_enabled");
  });

  it("refuses a profile that claims verified without vendor onboarding evidence", () => {
    expect(gate(verifiedProd, "new_rx", false, null)).toBe("vendor_onboarding_evidence_missing");
    expect(gate(verifiedProd, "new_rx", false, { ...row, environment: "sandbox" })).toBe("environment_mismatch");
  });

  it("still fails closed on the authoritative vendor gate", () => {
    expect(gate(verifiedProd, "new_rx", false, row)).toBeTruthy();
  });
});


describe("clinician readiness blockers", () => {
  it("lists every missing prerequisite", () => {
    expect(signingBlockers({ medication_name: "Metformin" })).toEqual(
      expect.arrayContaining([
        "RxNorm identity (RxCUI) not verified",
        "SIG / patient instructions required",
        "Pharmacy selection required",
        "Encounter link or a documented exception reason required",
      ]),
    );
  });

  it("blocks controlled substances and unresolved hard stops", () => {
    expect(signingBlockers({ dea_schedule: "II" })[0]).toMatch(/EPCS not certified/);
    const withHard = signingBlockers({ rxcui: "1", rxnorm_name: "x", sig: "s", quantity: 1, units: "tablet", route: "PO", frequency: "QD", days_supply: 5, refills: 0, indication_text: "i", pharmacy_name: "p", encounter_id: "e" }, [
      { id: "1", check_type: "allergy_conflict", severity: "hard", detail_code: "allergy_direct", message: "m", source: "s", source_version: "1", checked_at: "" },
    ]);
    expect(withHard).toEqual(["Unresolved hard safety stop"]);
  });

  it("is clean when every prerequisite is satisfied", () => {
    expect(signingBlockers({
      rxcui: "860975", rxnorm_name: "Metformin", sig: "Take 1 daily", quantity: 30, units: "tablet",
      route: "PO", frequency: "QD", days_supply: 30, refills: 0, indication_text: "T2DM",
      pharmacy_name: "CVS", encounter_id: "enc",
    })).toEqual([]);
  });
});
