import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { partnerConfig } from "../../../supabase/functions/_shared/dosespot";
import type { OnboardingRow } from "../../../supabase/functions/_shared/vendors";

/**
 * Final production-safety pass: readiness wrapper definer/grant posture,
 * DoseSpot partner-config parity between SQL and runtime, authoritative intake
 * template selection and schema validation, and prescriber-scoped transmission.
 */
const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");
const MIGRATIONS = path.resolve(process.cwd(), "supabase/migrations");
const sql = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");

const adapter = read("supabase/functions/erx-adapter/index.ts");
const hook = read("src/hooks/useObesityCare.ts");
const panel = read("src/components/virtualis/ObesityCarePanel.tsx");
const workspace = read("src/components/virtualis/ObesityLaunchWorkspace.tsx");

/** Latest definition of a SQL function plus its trailing grant posture. */
const fn = (name: string) => {
  const start = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  return sql.slice(start, next === -1 ? undefined : next);
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
const rowWith = (over: Record<string, unknown> = {}) =>
  base({ capabilities: { ...base().capabilities, partner_config: cfg(over) } });

describe("1. readiness wrapper is a safe definer the UI can actually call", () => {
  const wrapper = fn("obesity_launch_readiness");
  const internal = fn("obesity_launch_readiness_internal");

  it("is SECURITY DEFINER with a fixed empty search_path", () => {
    expect(wrapper).toContain("SECURITY DEFINER");
    expect(wrapper).toMatch(/SET search_path = ''/);
  });

  it("authorizes inside the function and fails closed for other tenants", () => {
    expect(wrapper).toContain("auth.uid() IS NULL");
    expect(wrapper).toContain("public.is_my_hospital(p_hospital_id)");
    expect(wrapper).toContain("'authorized', false");
    expect(wrapper).toContain("EXCEPTION WHEN OTHERS");
    expect(wrapper).toContain("readiness_unavailable");
  });

  it("revokes PUBLIC/anon and grants only authenticated + service_role", () => {
    expect(wrapper).toMatch(/REVOKE ALL ON FUNCTION public\.obesity_launch_readiness\(uuid, uuid, text, boolean, boolean\) FROM public, anon;/);
    expect(wrapper).toMatch(/GRANT EXECUTE ON FUNCTION public\.obesity_launch_readiness\(uuid, uuid, text, boolean, boolean\) TO authenticated, service_role;/);
  });

  it("keeps the evaluator service-role-only", () => {
    expect(internal).toMatch(/REVOKE ALL ON FUNCTION public\.obesity_launch_readiness_internal\([^)]*\) FROM public, anon, authenticated;/);
    expect(internal).toMatch(/GRANT EXECUTE ON FUNCTION public\.obesity_launch_readiness_internal\([^)]*\) TO service_role;/);
    expect(internal).not.toMatch(/obesity_launch_readiness_internal\([^)]*\) TO authenticated/);
  });

  it("surfaces an RPC failure in the UI as a blocked verdict, never a blank screen", () => {
    expect(hook).toContain("readiness_unavailable");
    expect(hook).toMatch(/error \|\| !data/);
    expect(workspace).toContain("Blocked —");
  });
});

describe("2. DoseSpot partner-config parity between SQL and runtime", () => {
  const blocker = fn("dosespot_partner_config_blocker");

  const cases: [string, Record<string, unknown>, string][] = [
    ["insecure/invalid host", { host: "https://partner.example.com" }, "partner_config_host_invalid"],
    ["relative launch path", { launchPath: "launch" }, "partner_config_launch_path_invalid"],
    ["missing signature param", { paramNames: { clinicId: "c", clinicianId: "u" } }, "partner_config_param_names_invalid"],
    ["empty clinicId param", { paramNames: { clinicId: "", clinicianId: "u", signature: "s" } }, "partner_config_param_names_invalid"],
    ["nonnumeric ttl", { launchTtlSeconds: "120" }, "partner_config_launch_ttl_invalid"],
    ["out-of-range ttl", { launchTtlSeconds: 901 }, "partner_config_launch_ttl_invalid"],
    ["zero ttl", { launchTtlSeconds: 0 }, "partner_config_launch_ttl_invalid"],
    ["unsupported algorithm", { signing: { algorithm: "md5", secretRef: "DOSESPOT_PROD_CLIENT_SECRET_REF", encoding: "hex" } }, "launch_signing_algorithm_unsupported"],
    ["unsupported encoding", { signing: { algorithm: "hmac-sha256", secretRef: "DOSESPOT_PROD_CLIENT_SECRET_REF", encoding: "utf8" } }, "launch_signing_encoding_unsupported"],
    ["missing secretRef", { signing: { algorithm: "hmac-sha256", secretRef: "", encoding: "hex" } }, "launch_signing_secret_ref_missing"],
    ["unprovisioned secretRef", { signing: { algorithm: "hmac-sha256", secretRef: "SOME_OTHER_REF", encoding: "hex" } }, "launch_signing_secret_ref_not_provisioned"],
    ["missing signing rule", { signing: null }, "launch_signing_rule_not_configured"],
    ["unapproved package", { evidence_approved: false }, "partner_package_not_approved"],
    ["unknown controlled mode", { controlled_substance_mode: "maybe" }, "controlled_substance_mode_unspecified"],
  ];

  for (const [label, over, reason] of cases) {
    it(`runtime rejects ${label} with ${reason}`, () => {
      const res = partnerConfig(rowWith(over));
      expect(res).toEqual({ reason });
    });
    it(`SQL gate knows the ${reason} blocker`, () => {
      expect(blocker).toContain(`'${reason}'`);
    });
  }

  it("accepts the exact valid production configuration", () => {
    expect(partnerConfig(rowWith())).toHaveProperty("config");
  });

  it("SQL uses type-safe JSON checks rather than raw boolean casts", () => {
    expect(blocker).toContain("jsonb_typeof");
    expect(blocker).toContain("public.jsonb_is_true");
    const internal = fn("obesity_launch_readiness_internal");
    expect(internal).toContain("public.dosespot_partner_config_blocker(pc, coalesce(ds.secret_ref_names");
    expect(internal).not.toMatch(/\(ds\.capabilities->>'[a-z_]+'\)::boolean/);
  });

  it("never reads or returns a secret value", () => {
    expect(blocker).not.toMatch(/resolveSecret|current_setting|vault/i);
    expect(blocker).toContain("secret_refs");
  });
});

describe("3. intake template selection is authoritative and shared", () => {
  const sel = fn("obesity_intake_template_for") + fn("obesity_intake_template_scoped");
  const rpc = fn("obesity_intake_template");
  const submit = fn("submit_obesity_intake");

  it("only selects a template for the encounter's obesity_medicine service line", () => {
    expect(sel).toContain("'obesity_medicine'");
    expect(sel).toContain("c.service_line_id IS NULL OR c.service_line_id = p_service_line_id");
    expect(sel).toContain("c.state_code IS NULL OR c.state_code = p_state_code");
  });

  it("prefers exact service and state matches over generic ones", () => {
    expect(sel).toContain("ORDER BY (c.service_line_id IS NOT NULL) DESC, (c.state_code IS NOT NULL) DESC, c.version DESC");
  });

  it("submission uses the same selection, so form and validator cannot diverge", () => {
    expect(submit).toContain("public.obesity_intake_template_for(p_encounter_id)");
    expect(rpc).toContain("public.obesity_intake_template_for(p_encounter_id)");
    expect(hook).toContain("supabase.rpc('obesity_intake_template'");
    expect(hook).not.toContain("from('clinical_protocols')");
  });

  it("the read RPC is encounter-authorized, definer, anon-revoked", () => {
    expect(rpc).toContain("SECURITY DEFINER");
    expect(rpc).toMatch(/SET search_path = ''/);
    expect(rpc).toContain("public.is_my_hospital(e.hospital_id)");
    expect(rpc).toMatch(/REVOKE ALL ON FUNCTION public\.obesity_intake_template\(uuid\) FROM public, anon;/);
    expect(rpc).toMatch(/GRANT EXECUTE ON FUNCTION public\.obesity_intake_template\(uuid\) TO authenticated, service_role;/);
    expect(fn("obesity_intake_template_for")).toMatch(/FROM public, anon, authenticated;/);
  });
});

describe("4. intake schemas and answers are validated fail-closed", () => {
  const schema = fn("obesity_intake_schema_blocker");
  const submit = fn("submit_obesity_intake");

  it("restricts question types and id format, and rejects duplicates", () => {
    expect(schema).toContain("('boolean', 'choice', 'number', 'text')");
    expect(schema).toContain("template_question_id_invalid");
    expect(schema).toContain("template_question_id_duplicated");
  });

  it("type-checks required/options/red_flag_values/applies_when", () => {
    for (const code of [
      "template_required_invalid", "template_options_invalid", "template_red_flag_values_invalid",
      "template_applies_when_invalid", "template_applies_when_unknown_question",
      "template_applies_when_type_mismatch",
    ]) expect(schema).toContain(code);
  });

  it("rejects an empty choice option list", () => {
    expect(schema).toContain("jsonb_array_length(q -> 'options') = 0");
  });

  it("still rejects unknown answer ids, missing required answers and type mismatches", () => {
    for (const code of ["unknown_question", "missing_required_answer", "answer_type_mismatch", "answer_not_in_options"]) {
      expect(submit).toContain(code);
    }
    expect(submit).toContain("public.obesity_intake_schema_blocker(t.content)");
  });

  it("derives red flags server-side and never accepts them from the client", () => {
    expect(submit).toContain("red_flag_values");
    const submitCall = hook.slice(hook.indexOf("supabase.rpc('submit_obesity_intake'"), hook.indexOf("supabase.rpc('submit_obesity_intake'") + 260);
    expect(submitCall).not.toMatch(/red_flag/);
    expect(submitCall).toMatch(/p_encounter_id|p_answers/);
  });

  it("an empty optional number field is left unanswered, not zero", () => {
    expect(panel).toContain("delete next[q.id]");
  });
});

describe("5. transmission is scoped to the prescription's own prescriber and state", () => {
  const transmit = adapter.slice(adapter.indexOf("// ---- transmit ----"));

  it("selects prescriber, state and encounter from the prescription", () => {
    expect(adapter).toContain("prescriber_id, prescriber_state_code, encounter_id");
  });

  it("requires the caller to be the assigned prescriber", () => {
    expect(transmit).toContain("rx.prescriber_id !== user.id");
    expect(transmit).toContain("not_the_assigned_prescriber");
  });

  it("requires a two-letter authoritative state for controlled prescriptions", () => {
    expect(transmit).toContain("controlled_state_authority_unknown");
    expect(transmit).toMatch(/\/\^\[A-Z\]\{2\}\$\//);
    expect(transmit).toContain("rx.prescriber_state_code ?? rxEnc?.patient_state_code");
  });

  it("passes the resolved state and prescriber to the individual EPCS check", () => {
    expect(transmit).toContain("p_user_id: rx.prescriber_id, p_state_code: stateCode");
    expect(transmit).not.toContain("p_state_code: null");
  });

  it("runs the obesity encounter gate with the real controlled flag", () => {
    expect(transmit).toContain('obesity_prescribing_readiness');
    expect(transmit).toContain("p_controlled: controlled");
    expect(transmit).toContain('=== "obesity_medicine"');
  });

  it("audits stable blocker codes without secrets or launch URLs", () => {
    expect(transmit).toContain("auditRx");
    expect(transmit).toContain("blockers.slice(0, 12)");
    expect(transmit).not.toMatch(/launch\.url|secret|token/i);
  });

  it("does not invent a direct DoseSpot transport contract", () => {
    expect(adapter).not.toMatch(/https:\/\/[a-z0-9.-]*dosespot/i);
  });
});

describe("6. launch workspace scope and safety", () => {
  it("lists only states applicable to the selected obesity service line", () => {
    expect(workspace).toContain("r.service_line_id === serviceLineId || r.service_line_id === null");
  });

  it("still restricts the service selector to obesity_medicine", () => {
    expect(workspace).toContain("'obesity_medicine'");
  });

  it("never re-enables direct client writes to payment or intake tables", () => {
    expect(hook).not.toMatch(/from\('encounter_cash_pay'\)\s*\.\s*(insert|update|upsert)/);
    expect(hook).not.toMatch(/from\('obesity_intake_screens'\)\s*\.\s*(insert|update|upsert)/);
    expect(hook).toContain("supabase.rpc('record_cash_pay'");
    expect(hook).toContain("supabase.rpc('submit_obesity_intake'");
  });

  it("sends no authoritative facility, patient or amount from the browser", () => {
    const payCall = hook.slice(hook.indexOf("supabase.rpc('record_cash_pay'"), hook.indexOf("supabase.rpc('record_cash_pay'") + 260);
    expect(payCall).not.toMatch(/p_amount|p_hospital_id|p_patient_id|amount_cents|p_service_code/);
  });
});

describe("7. explicit question types, element type compatibility, effective windows", () => {
  const schema = fn("obesity_intake_schema_blocker");
  const submit = fn("submit_obesity_intake");
  const scoped = fn("obesity_intake_template_scoped");
  const forEnc = fn("obesity_intake_template_for");
  const gate = fn("obesity_launch_readiness_internal");

  it("requires an explicitly declared question type with no boolean default", () => {
    expect(schema).toContain("public.jsonb_nonempty_text(q -> 'type')");
    expect(schema).toContain("(q ->> 'type') NOT IN ('boolean', 'choice', 'number', 'text')");
    expect(schema).toContain("template_question_type_invalid");
    expect(schema).not.toContain("coalesce(q ->> 'type', 'boolean')");
    expect(schema).not.toContain("coalesce(ref ->> 'type', 'boolean')");
  });

  it("keeps submission on the same declared type, without an implicit default", () => {
    expect(submit).toContain("qtype := q ->> 'type';");
    expect(submit).not.toContain("coalesce(q ->> 'type', 'boolean')");
  });

  it("type-checks every options and red_flag_values element", () => {
    expect(schema).toMatch(/red_flag_values'\) e WHERE jsonb_typeof\(e\) <> want/);
    expect(schema).toMatch(/options'\) o WHERE jsonb_typeof\(o\) <> want/);
  });

  it("rejects duplicate choice options", () => {
    expect(schema).toContain("count(DISTINCT o)");
    expect(schema).toContain("template_options_duplicated");
  });

  it("requires an applies_when choice value to be one of the referenced options", () => {
    expect(schema).toContain("template_applies_when_value_not_an_option");
    expect(schema).toMatch(/reftype = 'choice'[\s\S]{0,200}ref -> 'options'/);
  });

  it("never counts a future-effective approved version as current", () => {
    const windows = (sql: string) => sql.match(/effective_end IS NULL/g)?.length ?? 0;
    for (const body of [scoped, gate]) {
      const starts = body.match(/effective_start IS NULL OR \w+\.effective_start <= current_date/g)?.length ?? 0;
      expect(starts).toBeGreaterThan(0);
      // every versioned-artifact window that checks an end also checks a start
      expect(starts + (body.match(/f\.effective_start <= current_date/g)?.length ?? 0)).toBe(windows(body));
    }
  });

  it("applies the start-date rule to protocols, note templates and consents", () => {
    expect(gate).toMatch(/kind = k[\s\S]{0,400}c\.effective_start IS NULL OR c\.effective_start <= current_date/);
    expect(gate).toMatch(/kind = 'note_template'[\s\S]{0,300}c\.effective_start IS NULL OR c\.effective_start <= current_date/);
    expect(gate).toMatch(/consent_documents[\s\S]{0,400}d\.effective_start IS NULL OR d\.effective_start <= current_date/);
  });
});

describe("8. one authoritative scope selector for encounter and readiness", () => {
  const scoped = fn("obesity_intake_template_scoped");
  const forEnc = fn("obesity_intake_template_for");
  const gate = fn("obesity_launch_readiness_internal");

  it("orders exact service, then exact state, then version", () => {
    expect(scoped).toContain("ORDER BY (c.service_line_id IS NOT NULL) DESC, (c.state_code IS NOT NULL) DESC, c.version DESC");
    expect(scoped).toContain("LIMIT 1");
  });

  it("encounter selection delegates to the shared selector", () => {
    expect(forEnc).toContain("public.obesity_intake_template_scoped(e.hospital_id, sl, e.patient_state_code)");
    expect(forEnc).toContain("'obesity_medicine'");
    expect(forEnc).not.toContain("FROM public.clinical_protocols");
  });

  it("readiness validates the exact template that scope selects, not any well-formed one", () => {
    expect(gate).toContain("it := public.obesity_intake_template_scoped(p_hospital_id, p_service_line_id, p_state_code);");
    expect(gate).toContain("ok := it.id IS NOT NULL AND public.obesity_intake_schema_blocker(it.content) IS NULL;");
    expect(gate).toContain("The intake template this scope selects is malformed");
  });

  it("keeps the selector owner-only and the wrappers tenant-authorized", () => {
    expect(scoped).toMatch(/REVOKE ALL ON FUNCTION public\.obesity_intake_template_scoped\(uuid, uuid, text\) FROM public, anon, authenticated;/);
    expect(scoped).toMatch(/GRANT EXECUTE ON FUNCTION public\.obesity_intake_template_scoped\(uuid, uuid, text\) TO service_role;/);
    expect(scoped).toContain("SECURITY DEFINER");
    expect(scoped).toMatch(/SET search_path = ''/);
    expect(fn("obesity_intake_template")).toContain("public.is_my_hospital(e.hospital_id)");
  });
});
