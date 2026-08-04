import { completeText } from "../_shared/llm.ts";

export type Tier = "fast" | "frontier";

export type Urgency = "High" | "Moderate" | "Low";

export interface SpecialtySuggestion {
  name: string;
  confidence: number;
  reasoning: string;
}

export interface AcuityResult {
  suggestedUrgency: Urgency;
  suggestedSpecialty: string;
  suggestedSpecialties: SpecialtySuggestion[];
  reasoning: string;
  confidence: number; // 0-100 int
  serviceCategory: "emergency" | "critical_care" | "routine_care" | "specialty_consultation";
  hospitalPriority: "immediate" | "urgent" | "routine";
  riskLevel: "Critical" | "Moderate" | "Low";
  immediateActions: string[];
  estimatedResponseTime: "immediate" | "within_15_min" | "within_1_hour" | "routine";
  extractedKeywords: string[];
  classification: "stat" | "urgent" | "routine";
  score: number;
  color: string;
  recommendation?: string | null;
}

export const SPECIALTIES = [
  "Cardiology", "Pulmonology", "Neurology", "Nephrology", "Infectious Disease",
  "Internal Medicine", "Emergency Medicine", "Gastroenterology", "Endocrinology",
  "Surgery", "Psychiatry", "Orthopedics", "Nursing", "Pharmacy", "Lab Services",
  "Radiology", "Transport", "Administration",
];

export const URGENCY_COLOR: Record<Urgency, string> = {
  High: "#EF4444",
  Moderate: "#F59E0B",
  Low: "#10B981",
};

export const FALLBACK: AcuityResult = {
  suggestedUrgency: "Moderate",
  suggestedSpecialty: "Internal Medicine",
  suggestedSpecialties: [],
  reasoning: "auto-fallback: model unavailable",
  confidence: 30,
  serviceCategory: "routine_care",
  hospitalPriority: "urgent",
  riskLevel: "Moderate",
  immediateActions: [],
  estimatedResponseTime: "within_1_hour",
  extractedKeywords: [],
  classification: "urgent",
  score: 60,
  color: URGENCY_COLOR.Moderate,
  recommendation: null,
};


const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 10) : [];

/** Mirrors VirtualisChat's validation: coerce invalid enums + specialty allowlist. */
export function sanitize(raw: Record<string, unknown>, base: AcuityResult = FALLBACK): AcuityResult {
  const urgency = oneOf<Urgency>(raw.suggestedUrgency, ["High", "Moderate", "Low"], base.suggestedUrgency);
  const specialty = SPECIALTIES.includes(String(raw.suggestedSpecialty))
    ? String(raw.suggestedSpecialty)
    : base.suggestedSpecialty && SPECIALTIES.includes(base.suggestedSpecialty)
      ? base.suggestedSpecialty
      : "Internal Medicine";

  const specialties: SpecialtySuggestion[] = Array.isArray(raw.suggestedSpecialties)
    ? (raw.suggestedSpecialties as Record<string, unknown>[])
        .filter((s) => s && SPECIALTIES.includes(String(s.name)))
        .map((s) => ({
          name: String(s.name),
          confidence: Math.max(0, Math.min(100, Math.round(Number(s.confidence) || 0))),
          reasoning: String(s.reasoning || ""),
        }))
        .slice(0, 5)
    : base.suggestedSpecialties;

  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw <= 1 ? confidenceRaw * 100 : confidenceRaw)))
    : base.confidence;

  const scoreRaw = Number(raw.score);
  const score = Number.isFinite(scoreRaw)
    ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
    : urgency === "High" ? 90 : urgency === "Moderate" ? 60 : 25;

  return {
    suggestedUrgency: urgency,
    suggestedSpecialty: specialty,
    suggestedSpecialties: specialties,
    reasoning: String(raw.reasoning || base.reasoning),
    confidence,
    serviceCategory: oneOf(
      raw.serviceCategory,
      ["emergency", "critical_care", "routine_care", "specialty_consultation"] as const,
      urgency === "High" ? "emergency" : base.serviceCategory,
    ),
    hospitalPriority: oneOf(
      raw.hospitalPriority,
      ["immediate", "urgent", "routine"] as const,
      urgency === "High" ? "immediate" : urgency === "Low" ? "routine" : "urgent",
    ),
    riskLevel: oneOf(
      raw.riskLevel,
      ["Critical", "Moderate", "Low"] as const,
      urgency === "High" ? "Critical" : urgency === "Low" ? "Low" : "Moderate",
    ),
    immediateActions: strArray(raw.immediateActions).length
      ? strArray(raw.immediateActions)
      : base.immediateActions,
    estimatedResponseTime: oneOf(
      raw.estimatedResponseTime,
      ["immediate", "within_15_min", "within_1_hour", "routine"] as const,
      urgency === "High" ? "immediate" : urgency === "Low" ? "routine" : "within_1_hour",
    ),
    extractedKeywords: strArray(raw.extractedKeywords).length
      ? strArray(raw.extractedKeywords)
      : base.extractedKeywords,
    classification: oneOf(
      raw.classification,
      ["stat", "urgent", "routine"] as const,
      urgency === "High" ? "stat" : urgency === "Low" ? "routine" : "urgent",
    ),
    score,
    color: URGENCY_COLOR[urgency],
    recommendation: raw.recommendation ? String(raw.recommendation) : base.recommendation ?? null,
  };
}

/** Calls the configured model for a tier and returns a sanitized result, degrading to a safe default. */
export async function callModel(
  _tier: Tier,
  systemPrompt: string,
  userContent: string,
  base: AcuityResult = FALLBACK,
): Promise<{ result: AcuityResult; provider: string; model: string }> {
  try {
    const { text, provider, model } = await completeText({
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      json: true,
    });
    const parsed = extractJson(text);
    return { result: parsed ? sanitize(parsed, base) : base, provider, model };
  } catch (e) {
    console.error("acuity provider chain failed", e);
    return { result: base, provider: "none", model: "none" };
  }
}
