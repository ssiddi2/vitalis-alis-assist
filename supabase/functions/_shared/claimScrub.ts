/**
 * Deterministic claim scrubber.
 *
 * Rule-based only — no model inference decides whether a claim may be
 * submitted. `hard` findings can never be overridden; `reviewable` findings
 * require a documented clinician rationale recorded append-only.
 */
export const SCRUB_SOURCE = "virtualis-claim-scrubber";
export const SCRUB_VERSION = "2026.1";

export interface ScrubInput {
  billing_type: string;
  place_of_service?: string | null;
  total_charge?: number | null;
  billing_provider_npi?: string | null;
  rendering_provider_npi?: string | null;
  coverage_id?: string | null;
  payer_id?: string | null;
  medical_necessity_rationale?: string | null;
  lines: Array<{
    cpt_code: string;
    code_set?: string | null;
    code_version?: string | null;
    units?: number | null;
    charge_amount?: number | null;
    modifiers?: string[] | null;
    diagnosis_pointers?: number[] | null;
  }>;
  diagnoses: Array<{ icd10_code: string; code_set?: string | null; code_version?: string | null }>;
}

export interface ScrubFinding {
  rule_code: string;
  severity: "hard" | "reviewable";
  message: string;
  source: string;
  source_version: string;
}

const NPI_RE = /^\d{10}$/;
const CPT_RE = /^[0-9]{4}[0-9A-Z]$/;
const ICD_RE = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
const TELEHEALTH_POS = ["02", "10"];

export function scrubClaim(c: ScrubInput): ScrubFinding[] {
  const out: ScrubFinding[] = [];
  const add = (rule_code: string, severity: ScrubFinding["severity"], message: string) =>
    out.push({ rule_code, severity, message, source: SCRUB_SOURCE, source_version: SCRUB_VERSION });

  if (!c.lines.length) add("no_service_line", "hard", "The claim has no service line.");
  if (!c.diagnoses.length) add("no_diagnosis", "hard", "The claim has no diagnosis code.");
  if (!c.place_of_service) add("missing_pos", "hard", "Place of service is required.");
  else if (!/^\d{2}$/.test(c.place_of_service)) add("invalid_pos", "hard", "Place of service must be a two-digit code.");

  if (!c.billing_provider_npi || !NPI_RE.test(c.billing_provider_npi))
    add("invalid_billing_npi", "hard", "Billing provider NPI must be 10 digits.");
  if (c.rendering_provider_npi && !NPI_RE.test(c.rendering_provider_npi))
    add("invalid_rendering_npi", "hard", "Rendering provider NPI must be 10 digits.");

  if (c.billing_type === "insurance" && (!c.coverage_id || !c.payer_id))
    add("missing_coverage", "hard", "An insurance claim requires an active coverage and payer.");

  for (const d of c.diagnoses) {
    if (!ICD_RE.test(d.icd10_code)) add("invalid_icd10", "hard", `Diagnosis ${d.icd10_code} is not a valid ICD-10-CM code.`);
    if (!d.code_version) add("missing_dx_version", "reviewable", `Diagnosis ${d.icd10_code} has no code-set version.`);
  }

  const seen = new Set<string>();
  for (const l of c.lines) {
    const key = `${l.cpt_code}|${(l.modifiers ?? []).join(",")}`;
    if (!CPT_RE.test(l.cpt_code)) add("invalid_cpt", "hard", `Procedure ${l.cpt_code} is not a valid CPT/HCPCS code.`);
    if (!l.code_version) add("missing_cpt_version", "hard", `Procedure ${l.cpt_code} has no code-set version.`);
    if ((l.units ?? 0) < 1) add("invalid_units", "hard", `Procedure ${l.cpt_code} must have at least one unit.`);
    if ((l.charge_amount ?? 0) <= 0) add("zero_charge", "hard", `Procedure ${l.cpt_code} has no charge amount.`);
    if (!(l.diagnosis_pointers ?? []).length) add("no_dx_pointer", "hard", `Procedure ${l.cpt_code} is not linked to a diagnosis.`);
    else if ((l.diagnosis_pointers ?? []).some((p) => p < 1 || p > c.diagnoses.length))
      add("bad_dx_pointer", "hard", `Procedure ${l.cpt_code} points at a diagnosis that is not on the claim.`);
    if (seen.has(key)) add("duplicate_line", "reviewable", `Procedure ${l.cpt_code} is billed more than once with the same modifiers.`);
    seen.add(key);
    if (TELEHEALTH_POS.includes(c.place_of_service ?? "") && !(l.modifiers ?? []).some((m) => ["95", "GT", "FQ"].includes(m)))
      add("telehealth_modifier", "reviewable", `Telehealth place of service usually requires modifier 95 on ${l.cpt_code}.`);
  }

  const lineTotal = c.lines.reduce((s, l) => s + Number(l.charge_amount ?? 0), 0);
  if (c.total_charge != null && Math.abs(lineTotal - Number(c.total_charge)) > 0.005)
    add("charge_mismatch", "hard", "The claim total does not match the sum of its service lines.");

  if (!c.medical_necessity_rationale || c.medical_necessity_rationale.trim().length < 10)
    add("medical_necessity", "hard", "A documented medical-necessity statement is required.");

  return out;
}
