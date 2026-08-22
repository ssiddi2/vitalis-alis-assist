import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLaunch, partnerConfig } from "../../../supabase/functions/_shared/dosespot";
import { doseSpotPrescribingGate } from "../../../supabase/functions/_shared/vendorAdapters";
import type { OnboardingRow } from "../../../supabase/functions/_shared/vendors";

/**
 * Regressions for the cash-pay obesity hardening pass: server-authoritative
 * payment and intake, launch audit on the encounter event model, per-prescriber
 * EPCS evidence, readiness/runtime parity and UI scope safety.
 */
const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");

const adapter = read("supabase/functions/erx-adapter/index.ts");
const hook = read("src/hooks/useObesityCare.ts");
const panel = read("src/components/virtualis/ObesityCarePanel.tsx");
const workspace = read("src/components/virtualis/ObesityLaunchWorkspace.tsx");
const fn = (name: string) => {
  const start = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  const end = sql.indexOf("REVOKE ALL ON FUNCTION", start);
  return sql.slice(start, end === -1 ? undefined : end);
};

const base = (over: Partial<OnboardingRow> = {}): OnboardingRow => ({
  id: "r", hospital_id: "h", vendor_key: "dosespot", environment: "production",
  state: "production_verified",
  capabilities: { new_rx: true, baa_verified: true, mfa_enforced: true },
  secret_ref_names: ["DOSESPOT_PROD_CLIENT_ID_REF", "DOSESPOT_PROD_CLIENT_SECRET_REF", "DOSESPOT_PROD_CLINIC_ID_REF"],
  last_test_result: "production_readiness_passed",
  evidence_expires_at: new Date(Date.now() + 8.64e7).toISOString(),
  ...over,
});

const cfg = (over: Record<string, unknown> = {}) => ({
  host: "partner.example.com", launchPath: "/launch/{clinicId}", launchTtlSeconds: 120,
  paramNames: { clinicId: "c", clinicianId: "u", signature: "sig", timestamp: "ts" },
  signing: { algorithm: "hmac-sha256", secretRef: "DOSESPOT_PROD_CLIENT_SECRET_REF", encoding: "hex" },
  evidence_ref: "pkg-2026-01", evidence_approved: true, controlled_substance_mode: "vendor_disabled",
  ...over,
});
const withCfg = (over: Record<string, unknown> = {}, row: Partial<OnboardingRow> = {}) =>
  base({ ...row, capabilities: { ...base(row).capabilities, partner_config: cfg(over) } });

describe("1. launch audit uses the encounter event model", () => {
  it("never inserts a null prescription_id and records the encounter/patient/actor", () => {
    expect(adapter).not.toMatch(/prescription_id:\s*null/);
    const block = adapter.slice(adapter.indexOf("auditLaunch"), adapter.indexOf("const row = await loadVendorRow"));
    expect(block).toContain('from("encounter_events")');
    for (const field of ["encounter_id", "patient_id", "hospital_id", "actor_id"]) expect(block).toContain(field);
  });

  it("audits blocked launches too, with PHI-minimized blocker codes and no URL or secret", () => {
    expect(adapter).toMatch(/auditLaunch\("blocked"/);
    const block = adapter.slice(adapter.indexOf("const auditLaunch"), adapter.indexOf("if (enc.provider_id"));
    expect(block).not.toMatch(/launch\.url|secret|token/i);
    expect(block).toContain("blockers.slice(0, 12)");
  });
});

describe("2. cash pay is server-authoritative", () => {
  it("revokes direct writes and admits only admin payment actions", () => {
    expect(sql).toMatch(/REVOKE INSERT, UPDATE ON public\.encounter_cash_pay FROM authenticated/);
    expect(fn("record_cash_pay")).toMatch(/NOT public\.has_role\(auth\.uid\(\), 'admin'\)[\s\S]{0,120}not_authorized/);
  });

  it("derives facility, patient, service and amount from the encounter and fee schedule", () => {
    const f = fn("record_cash_pay");
    expect(f).toMatch(/FROM public\.cash_pay_service_fees/);
    expect(f).toMatch(/VALUES \(e\.hospital_id, p_encounter_id, e\.patient_id, sl, f\.fee_reference, f\.amount_cents/);
    expect(f).toMatch(/no_service_fee_configured/);
  });

  it("requires an external reference to settle and keeps the audited waiver", () => {
    const f = fn("record_cash_pay");
    expect(f).toMatch(/external_payment_reference_required/);
    expect(f).toMatch(/processor = 'external_reference'/);
    expect(f).toMatch(/waiver_reason_required/);
  });

  it("opens a work item for refunds and chargebacks without touching clinical records", () => {
    const f = fn("record_cash_pay");
    expect(f).toMatch(/cash_pay\.work_item_opened/);
    expect(f).not.toMatch(/UPDATE public\.clinical_notes|UPDATE public\.encounters/);
  });

  it("only creates an existing-or-new record through the RPC; the client sends no authoritative fields", () => {
    expect(hook).not.toMatch(/from\('encounter_cash_pay'\)[\s\S]{0,80}\.(insert|update)/);
    expect(hook).toMatch(/rpc\('record_cash_pay'/);
    const call = hook.slice(hook.indexOf("rpc('record_cash_pay'"), hook.indexOf("Submits template answers"));
    for (const field of ["amount_cents", "hospital_id", "patient_id", "fee_reference", "processor"]) {
      expect(call).not.toContain(field);
    }
  });

  it("shows the processor warning for absent OR not_connected and hides mutations from non-admins", () => {
    expect(panel).toMatch(/processor !== 'not_connected'/);
    expect(panel).toMatch(/!processorConnected && \(/);
    expect(panel).toMatch(/read-only for your role/);
    expect(panel).toMatch(/\{!isAdmin \?/);
  });
});

describe("3. vendor identity mappings", () => {
  it("reads only for admin or the real 'compliance' governance role", () => {
    const policy = sql.slice(sql.lastIndexOf('CREATE POLICY "vendor mappings readable by admins"'));
    expect(policy.slice(0, 400)).toMatch(/'compliance'/);
    expect(policy.slice(0, 400)).not.toMatch(/compliance_officer/);
  });

  it("requires a facility mapping to point at its own hospital and stays credential-free", () => {
    const trg = fn("enforce_vendor_identity_mapping");
    expect(trg.slice(0, 1200)).toMatch(/'facility'[\s\S]{0,200}subject_id[\s\S]{0,80}hospital_id/);
  });
});

describe("4. per-prescriber EPCS is enforced", () => {
  it("requires verified, unexpired individual DoseSpot credentials plus DEA/state authority", () => {
    const f = fn("dosespot_prescriber_epcs_ok");
    expect(f).toMatch(/staff_credentials/);
    for (const t of ["dosespot_identity_proofing", "dosespot_two_factor", "dosespot_epcs_enrollment"]) {
      expect(f).toContain(t);
    }
    expect(f).toMatch(/dea_registration/);
  });

  it("blocks controlled prescribing without individual evidence even when the facility is verified", () => {
    const epcsRow = withCfg({}, { capabilities: {
      ...base().capabilities, epcs: true, epcs_identity_proofing_verified: true, epcs_two_factor_verified: true,
    } });
    expect(doseSpotPrescribingGate(epcsRow, true, false)).toBe("prescriber_epcs_evidence_missing");
    expect(doseSpotPrescribingGate(epcsRow, true, true)).toBeNull();
  });

  it("blocks the launch when the partner package does not state the controlled-substance mode", () => {
    expect(partnerConfig(withCfg({ controlled_substance_mode: undefined })))
      .toEqual({ reason: "controlled_substance_mode_unspecified" });
  });

  it("requires an approved partner package evidence reference and the signature parameter", () => {
    expect(partnerConfig(withCfg({ evidence_approved: false }))).toEqual({ reason: "partner_package_not_approved" });
    expect(partnerConfig(withCfg({ paramNames: { clinicId: "c", clinicianId: "u" } })))
      .toEqual({ reason: "launch_signature_parameter_not_configured" });
  });

  it("treats a controlled-enabled account as an EPCS surface on every launch", async () => {
    const row = withCfg({ controlled_substance_mode: "enabled" });
    const ctx = { clinicId: "1", clinicianId: "2" };
    expect(await buildLaunch(row, ctx, { controlled: false, prescriberEpcsVerified: false }))
      .toMatchObject({ status: "blocked", reason: "individual_epcs_evidence_required" });
    const disabled = await buildLaunch(withCfg(), ctx, { controlled: false, prescriberEpcsVerified: false });
    expect(disabled.status).not.toBe("blocked");
  });

  it("never returns a secret or signing material to the caller", async () => {
    const res = await buildLaunch(withCfg(), { clinicId: "1", clinicianId: "2" }, { controlled: false });
    expect(JSON.stringify(res)).not.toMatch(/secretRef|client_secret|DOSESPOT_PROD/);
  });
});

describe("5. readiness gate mirrors runtime", () => {
  const f = fn("obesity_launch_readiness_internal");

  it("verifies BAA, MFA, secret reference names, partner package and production test result", () => {
    expect(f).toMatch(/baa_verified/);
    expect(f).toMatch(/mfa_enforced/);
    expect(f).toMatch(/secret_ref_names @> REQUIRED_REFS/);
    expect(f).toMatch(/last_test_result = 'production_readiness_passed'/);
    expect(f).toMatch(/controlled_substance_mode'\) IN \('vendor_disabled','enabled'\)/);
    expect(f).toMatch(/evidence_approved/);
    expect(f).toMatch(/evidence_ref/);
  });

  it("requires an evidence reference on verified attestation gates", () => {
    expect(f).toMatch(/g\.status = 'verified'[\s\S]{0,120}btrim\(g\.evidence_ref\)/);
  });

  it("requires a note_templates row AND an approved note_template protocol version", () => {
    expect(f).toMatch(/FROM public\.note_templates[\s\S]{0,300}kind = 'note_template' AND c\.status = 'approved'/);
  });

  it("rejects any service line that is not obesity_medicine", () => {
    expect(f).toMatch(/s\.code = 'obesity_medicine'/);
    expect(f).toMatch(/'service_line_is_obesity_medicine'/);
  });

  it("requires an individually credentialed state-authorized prescriber for EPCS readiness", () => {
    expect(f).toMatch(/dosespot_prescriber_epcs_ok\(p_hospital_id, psl\.provider_user_id, p_state_code\)/);
  });
});

describe("6. encounter prescribing readiness is server-only", () => {
  const f = fn("obesity_prescribing_readiness");

  it("is executable only by the service role and is called by the adapter", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.obesity_prescribing_readiness\(uuid, boolean\) FROM public, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.obesity_prescribing_readiness\(uuid, boolean\) TO service_role/);
    expect(adapter).toMatch(/rpc\("obesity_prescribing_readiness"/);
  });

  it("blocks on wrong service line, consent, payment, intake, red flags, stage and hospital gate", () => {
    for (const code of [
      "service_line_not_obesity_medicine", "consent_missing_", "payment_not_settled",
      "obesity_intake_missing", "unresolved_red_flags", "signed_note_required",
      "hospital_launch_gate_blocked", "provider_not_state_authorized",
      "medication_reconciliation_missing", "allergy_review_missing",
    ]) expect(f).toContain(code);
  });

  it("takes the launch stage from the approved protocol, never a client flag", () => {
    expect(f).toMatch(/prescribing_launch_stage[\s\S]{0,200}clinical_protocols/);
    expect(f).toMatch(/prescribing_launch_stage_unrecognized/);
  });

  it("requires accepted, non-withdrawn consent records rather than document definitions", () => {
    expect(f).toMatch(/consent_records[\s\S]{0,300}accepted_at IS NOT NULL[\s\S]{0,120}withdrawn_at IS NULL/);
  });
});

describe("7. intake red flags are derived server-side", () => {
  const f = fn("submit_obesity_intake");

  it("revokes direct inserts and requires a clinician or admin", () => {
    expect(sql).toMatch(/REVOKE INSERT ON public\.obesity_intake_screens FROM authenticated/);
    expect(f).toMatch(/has_role\(auth\.uid\(\), 'admin'\) OR public\.has_role\(auth\.uid\(\), 'clinician'\)/);
  });

  it("validates the template schema and rejects unknown, missing and mistyped answers", () => {
    for (const code of ["unknown_question", "missing_required_answer", "answer_type_mismatch",
      "answer_not_in_options", "answer_not_applicable", "no_approved_intake_template"]) {
      expect(f).toContain(code);
    }
  });

  it("derives red flags only from the approved template and ignores client-supplied flags", () => {
    expect(f).toMatch(/red_flag_values/);
    expect(f).toMatch(/'derived_by','server'/);
    expect(f).not.toMatch(/p_answers ->> 'red_flags'/);
    expect(hook.slice(hook.indexOf("rpc('submit_obesity_intake'"), hook.length)).not.toMatch(/red_flags/);
  });

  it("treats pregnancy applicability as explicit and conditional, never inferred", () => {
    expect(f).toMatch(/q ->> 'pregnancy'/);
    expect(f).not.toMatch(/e\.sex|patients\.sex/);
  });
});

describe("8. UI scope and safety", () => {
  it("renders the care panel only for obesity_medicine encounters", () => {
    expect(panel).toMatch(/serviceCode !== 'obesity_medicine'\) return null/);
  });

  it("lists only the obesity_medicine service in the launch workspace", () => {
    expect(workspace).toMatch(/\.eq\('code', 'obesity_medicine'\)/);
  });

  it("shows every server blocker code and drops the unsupported hard-block claim", () => {
    expect(panel).toMatch(/launchBlockers\.map/);
    expect(panel).not.toMatch(/controlled substances remain hard-blocked/i);
  });
});
