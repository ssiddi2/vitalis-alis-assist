// Shared medical-coding engine. ALL billing prompt/parse logic lives here (DRY).
import { completeText } from "./llm.ts";

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

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "```").split("```").join("\n");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

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
