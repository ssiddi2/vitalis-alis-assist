// Shared medical-coding engine. ALL billing prompt/parse logic lives here (DRY).
import { completeText } from "./llm.ts";
import { extractJson } from "./bedrock.ts";

export type CodeType = "CPT" | "ICD-10";

export interface SuggestedCode {
  code: string;
  type: CodeType;
  description: string;
  confidence: number;
  rationale: string;
}

export interface BillingSuggestion {
  codes: SuggestedCode[];
  emLevel: string;
  mdmComplexity: string;
}

const SYSTEM =
  "You are an expert certified medical coder (CPC). Apply the 2021 AMA E/M guidelines: select the E/M level from " +
  "medical decision making — number/complexity of problems addressed, amount and complexity of data reviewed, and risk of " +
  "complications/morbidity — or from documented total time when clearly stated. " +
  "NEVER upcode: if documentation does not support a level, choose the lower one. Only assign codes explicitly justified by " +
  "the documentation. Add ICD-10-CM diagnosis codes supported by the note, most specific first. " +
  'Respond with ONLY a JSON object of exactly this shape: {"codes":[{"code":"","type":"CPT"|"ICD-10","description":"",' +
  '"confidence":0.0,"rationale":""}],"emLevel":"","mdmComplexity":"straightforward"|"low"|"moderate"|"high"}';

const EMPTY: BillingSuggestion = { codes: [], emLevel: "", mdmComplexity: "" };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");


function normalizeCodes(raw: unknown): SuggestedCode[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .filter((c) => c && str(c.code))
    .map((c) => ({
      code: str(c.code).toUpperCase(),
      type: (c.type === "ICD-10" ? "ICD-10" : "CPT") as CodeType,
      description: str(c.description),
      confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0.7)),
      rationale: str(c.rationale),
    }))
    .slice(0, 12);
}

/** Suggests CPT/ICD-10 codes for an encounter. Never throws — returns empty codes on failure. */
export async function suggestBilling(input: {
  encounterSummary: string;
  encounterType?: string;
  noteContent?: string;
}): Promise<BillingSuggestion> {
  const summary = str(input.encounterSummary);
  if (!summary && !str(input.noteContent)) return EMPTY;

  const content = [
    `Encounter type: ${str(input.encounterType) || "established_patient"}`,
    `Encounter summary:\n${summary}`,
    str(input.noteContent) ? `Full note:\n${str(input.noteContent)}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const { text } = await completeText({ system: SYSTEM, messages: [{ role: "user", content }], json: true });
    const parsed = extractJson(text);
    if (!parsed) return EMPTY;
    return {
      codes: normalizeCodes(parsed.codes),
      emLevel: str(parsed.emLevel),
      mdmComplexity: str(parsed.mdmComplexity),
    };
  } catch (e) {
    console.warn("billing: suggestion failed —", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

/* ---------------- Denial-risk prediction (single source of truth) ---------------- */

export type IssueSeverity = "high" | "medium" | "low";

export interface DenialIssue {
  severity: IssueSeverity;
  category: string;
  message: string;
  fix: string;
  code?: string;
}

export interface DenialRiskResult {
  denialRisk: number | null;
  cleanClaimProbability: number | null;
  issues: DenialIssue[];
}

const DENIAL_EMPTY: DenialRiskResult = { denialRisk: null, cleanClaimProbability: null, issues: [] };

const DENIAL_SYSTEM =
  "You are an expert claims-adjudication reviewer predicting DENIAL RISK BEFORE a claim is submitted. " +
  "Evaluate: medical necessity (does each linked ICD-10 support its CPT), code specificity, missing or incorrect " +
  "modifiers, NCCI bundling/mutually-exclusive edits, prior-authorization likelihood, documentation gaps, and " +
  "coverage policy (LCD/NCD). Be concrete and payer-realistic; do not invent issues that documentation already supports. " +
  'Respond with ONLY a JSON object of exactly this shape: {"denialRisk":0-100,"cleanClaimProbability":0-100,' +
  '"issues":[{"severity":"high"|"medium"|"low","category":"","message":"","fix":"","code":""}]}';

const pct = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
};

function normalizeIssues(raw: unknown): DenialIssue[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .filter((i) => i && str(i.message))
    .map((i) => ({
      severity: (["high", "medium", "low"].includes(str(i.severity)) ? str(i.severity) : "low") as IssueSeverity,
      category: str(i.category) || "General",
      message: str(i.message),
      fix: str(i.fix),
      ...(str(i.code) ? { code: str(i.code).toUpperCase() } : {}),
    }))
    .slice(0, 10);
}

/** Predicts pre-submission denial risk for a set of codes. Never throws. */
export async function checkDenialRisk(input: {
  codes: Array<{ code: string; type: string; description?: string }>;
  noteContent?: string;
  payer?: string;
}): Promise<DenialRiskResult> {
  const codes = (input.codes || []).filter((c) => c && str(c.code));
  if (!codes.length) return DENIAL_EMPTY;

  const content = [
    input.payer ? `Payer: ${str(input.payer)}` : "",
    `Codes on claim:\n${codes.map((c) => `- ${c.type} ${c.code}${c.description ? ` — ${c.description}` : ""}`).join("\n")}`,
    str(input.noteContent) ? `Supporting documentation:\n${str(input.noteContent)}` : "Supporting documentation: not provided.",
  ].filter(Boolean).join("\n\n");

  try {
    const { text } = await completeText({ system: DENIAL_SYSTEM, messages: [{ role: "user", content }], json: true });
    const parsed = extractJson(text);
    if (!parsed) return DENIAL_EMPTY;
    return {
      denialRisk: pct(parsed.denialRisk),
      cleanClaimProbability: pct(parsed.cleanClaimProbability),
      issues: normalizeIssues(parsed.issues),
    };
  } catch (e) {
    console.warn("billing: denial-risk check failed —", e instanceof Error ? e.message : e);
    return DENIAL_EMPTY;
  }
}
