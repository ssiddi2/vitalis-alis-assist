import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTenantScoped, loadEffectivePolicies } from "./policyParser";
import { scrubClaim, SCRUB_VERSION } from "../../../supabase/functions/_shared/claimScrub";
import { claimAdapterFor, claimGate, type ClearinghouseProfile } from "../../../supabase/functions/_shared/claims";
import { estimate } from "@/lib/claims";

/**
 * Revenue-cycle regression gate.
 * Proves claim lifecycle, prerequisites, scrubbing and clearinghouse fail-closed
 * behaviour live in the database and the server adapter — never in the UI.
 */
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

const policies = loadEffectivePolicies();
const TABLES = [
  "payers",
  "eligibility_checks",
  "provider_payer_enrollments",
  "claims",
  "claim_lines",
  "claim_events",
  "claim_scrub_results",
  "claim_scrub_overrides",
  "claim_remittances",
  "clearinghouse_profiles",
  "claim_outbox",
  "claim_inbox",
] as const;

describe("revenue-cycle tenancy", () => {
  it.each(TABLES)("%s: every policy is tenant-scoped", (table) => {
    const list = policies.get(table) ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) expect(isTenantScoped(p.expr), `${table} · ${p.name}`).toBe(true);
  });

  it.each(TABLES)("%s: no anonymous or public access", (table) => {
    expect(sql).not.toMatch(new RegExp(`GRANT[^;]*ON\\s+public\\.${table}\\s+TO\\s+(anon|public)`, "i"));
    expect(sql).not.toMatch(new RegExp(`ON\\s+public\\.${table}\\s+FOR\\s+\\w+\\s+TO\\s+anon`, "i"));
  });

  it("append-only tables have no client write grants", () => {
    for (const t of ["eligibility_checks", "claim_events", "claim_scrub_results", "claim_remittances", "claim_outbox", "claim_inbox"]) {
      expect(sql).not.toMatch(new RegExp(`GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*ON\\s+public\\.${t}\\s+TO\\s+authenticated`, "i"));
    }
  });

  it("event, envelope and remittance rows cannot be mutated", () => {
    for (const t of ["claim_events", "claim_scrub_results", "claim_outbox", "claim_inbox", "eligibility_checks"]) {
      expect(sql).toMatch(new RegExp(`BEFORE\\s+UPDATE\\s+OR\\s+DELETE\\s+ON\\s+public\\.${t}[\\s\\S]{0,120}deny_mutation`, "i"));
    }
    expect(sql).toMatch(/BEFORE\s+DELETE\s+ON\s+public\.claim_remittances[\s\S]{0,120}deny_mutation/i);
  });

  it("submitted claims can never be deleted by a client", () => {
    const del = (policies.get("claims") ?? []).find((p) => p.cmd === "DELETE")!;
    expect(del.expr).toMatch(/submitted_at IS NULL/);
    expect(del.expr).toMatch(/status = 'draft'/);
    expect(del.expr).toMatch(/created_by = auth\.uid\(\)/);
  });

  it("payer, enrollment and clearinghouse configuration is admin-write only", () => {
    for (const t of ["payers", "provider_payer_enrollments", "clearinghouse_profiles"]) {
      const write = (policies.get(t) ?? []).filter((p) => p.cmd !== "SELECT");
      expect(write.length).toBeGreaterThan(0);
      for (const p of write) expect(p.expr).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'/i);
    }
  });

  it("stores no credentials, raw X12 payloads, bank or card data", () => {
    expect(sql).toMatch(/secret_ref_names must be uppercase secret NAMES only/);
    expect(sql).not.toMatch(/(raw_x12|x12_payload|payer_password|bank_account|routing_number|card_number)/i);
  });
});

describe("claim lifecycle enforcement (database)", () => {
  const fn = /CREATE OR REPLACE FUNCTION public\.enforce_claim_lifecycle[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";
  const readiness = /CREATE OR REPLACE FUNCTION public\.claim_readiness[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";

  it("binds the author to auth.uid() and rejects containment spoofing", () => {
    expect(fn).toMatch(/NEW\.created_by := uid/);
    expect(fn).toMatch(/encounter, patient and facility must match/);
    expect(fn).toMatch(/coverage does not belong to this patient/);
    expect(fn).toMatch(/payer does not belong to this facility/);
    expect(fn).toMatch(/claim facility, patient, encounter and author are immutable/);
  });

  it("rejects invalid transitions, stale versions and client-set payer outcomes", () => {
    expect(fn).toMatch(/invalid claim transition/);
    expect(fn).toMatch(/stale claim version/);
    expect(fn).toMatch(/claim submission and payer outcome states are set by the server path only/);
  });

  it("freezes submitted claim content and its service lines", () => {
    expect(fn).toMatch(/submitted claim content is immutable; file a corrected or replacement claim/);
    expect(sql).toMatch(/service lines of a submitted claim are immutable/);
  });

  it("requires an idempotency key and a correction reason for a resubmission", () => {
    expect(fn).toMatch(/an idempotency key and correlation id are required before submission/);
    expect(fn).toMatch(/a corrected claim requires a documented correction reason/);
  });

  it("requires every prerequisite before approval", () => {
    for (const rule of [
      /Encounter is not completed/,
      /No signed clinical note for this encounter/,
      /No validated diagnosis code/,
      /No coded service line/,
      /Place of service missing/,
      /Billing provider NPI missing/,
      /Medical-necessity documentation missing/,
      /Rendering provider is not enrolled with this payer/,
      /Unresolved hard scrubber failure/,
      /Reviewable scrubber findings need a documented override/,
    ]) expect(readiness).toMatch(rule);
    expect(fn).toMatch(/claim is not ready to approve/);
  });

  it("never allows a hard scrubber failure to be overridden", () => {
    expect(sql).toMatch(/a hard scrubber failure cannot be overridden/);
    expect(sql).toMatch(/scrub override must reference the same claim and facility/);
  });

  it("blocks a production clearinghouse profile without a passed end-to-end test", () => {
    expect(sql).toMatch(/a production clearinghouse profile requires a passed end-to-end test/);
  });
});

describe("deterministic claim scrubber", () => {
  const clean = {
    billing_type: "insurance",
    place_of_service: "10",
    total_charge: 150,
    billing_provider_npi: "1234567890",
    rendering_provider_npi: "1234567890",
    coverage_id: "c",
    payer_id: "p",
    medical_necessity_rationale: "Acute pharyngitis evaluation and management.",
    lines: [{ cpt_code: "99213", code_set: "CPT", code_version: "2026", units: 1, charge_amount: 150, modifiers: ["95"], diagnosis_pointers: [1] }],
    diagnoses: [{ icd10_code: "J02.9", code_set: "ICD-10-CM", code_version: "2026" }],
  };

  it("passes a well-formed telehealth claim", () => {
    expect(scrubClaim(clean)).toEqual([]);
  });

  it("hard-stops invalid codes, NPI, charges and missing necessity", () => {
    const hard = scrubClaim({
      ...clean, billing_provider_npi: "12", medical_necessity_rationale: "",
      lines: [{ ...clean.lines[0], cpt_code: "XX", charge_amount: 0, code_version: null, diagnosis_pointers: [] }],
      diagnoses: [{ icd10_code: "99999" }],
    }).filter((f) => f.severity === "hard").map((f) => f.rule_code);
    expect(hard).toEqual(expect.arrayContaining([
      "invalid_billing_npi", "invalid_icd10", "invalid_cpt", "missing_cpt_version",
      "zero_charge", "no_dx_pointer", "charge_mismatch", "medical_necessity",
    ]));
  });

  it("flags duplicates and missing telehealth modifiers as reviewable and stamps provenance", () => {
    const findings = scrubClaim({
      ...clean, total_charge: 300,
      lines: [clean.lines[0], { ...clean.lines[0], modifiers: [] }],
    });
    expect(findings.some((f) => f.rule_code === "telehealth_modifier" && f.severity === "reviewable")).toBe(true);
    expect(findings.every((f) => f.source_version === SCRUB_VERSION)).toBe(true);
  });

  it("hard-stops an insurance claim without coverage", () => {
    const f = scrubClaim({ ...clean, coverage_id: null, payer_id: null });
    expect(f.find((x) => x.rule_code === "missing_coverage")?.severity).toBe("hard");
  });
});

describe("clearinghouse gate fails closed", () => {
  const verified: ClearinghouseProfile = {
    id: "p", vendor: "acme", environment: "production",
    capabilities: { claim_submission: true, eligibility: true },
    verification_status: "verified", last_test_result: "passed",
  };

  it("blocks missing, unverified, untested, sandbox and capability-less profiles", () => {
    expect(claimGate(null, "claim_submission")).toBe("no_clearinghouse_profile");
    expect(claimGate({ ...verified, verification_status: "testing" }, "claim_submission")).toBe("profile_unverified");
    expect(claimGate({ ...verified, capabilities: {} }, "claim_submission")).toBe("capability_not_enabled");
    expect(claimGate({ ...verified, last_test_result: "failed" }, "claim_submission")).toBe("end_to_end_test_not_passed");
    expect(claimGate({ ...verified, environment: "sandbox" }, "claim_submission")).toBe("sandbox_test_mode");
  });

  it("has no production adapter and never verifies a vendor webhook", async () => {
    expect(claimAdapterFor(verified)).toBeNull();
    const mock = claimAdapterFor({ ...verified, environment: "sandbox" })!;
    expect(mock.vendor).toBe("mock");
    await expect(mock.verifyWebhook("sig", "{}", "ts")).resolves.toBe(false);
    await expect(mock.send("837P", "corr", "hash")).resolves.toMatchObject({ status: "queued" });
  });
});

describe("patient estimate", () => {
  it("falls back to self-pay without coverage or when coverage is inactive", () => {
    expect(estimate(200, null)).toMatchObject({ basis: "self_pay", patientResponsibility: 200 });
    expect(estimate(200, { copay_amount: 25 }, { coverage_active: false })).toMatchObject({ basis: "self_pay" });
  });

  it("applies copay, deductible and coinsurance without exceeding the charge", () => {
    const e = estimate(200, { copay_amount: 25 }, { coverage_active: true, copay_amount: 25, deductible_remaining: 50, coinsurance_percent: 20 });
    expect(e.basis).toBe("insurance");
    expect(e.patientResponsibility).toBeCloseTo(105);
    expect(e.planPays).toBeCloseTo(95);
  });
});
