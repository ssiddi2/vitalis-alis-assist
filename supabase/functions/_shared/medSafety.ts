/**
 * Deterministic medication safety checks. Rule-based only — AI is never allowed
 * to downgrade or resolve a stop. Hard stops are non-overridable by design.
 */

export type Severity = "hard" | "reviewable" | "info";

export interface SafetyCheck {
  check_type: string;
  severity: Severity;
  detail_code: string;
  message: string;
  source: string;
  source_version: string;
}

export const RULES_SOURCE = "virtualis-med-rules";
export const RULES_VERSION = "2026.08.1";

/** Common cross-reactive ingredient families used for allergy conflict detection. */
const INGREDIENT_FAMILIES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "piperacillin", "dicloxacillin"],
  cephalosporin: ["cephalexin", "keflex", "cefdinir", "ceftriaxone", "cefuroxime"],
  sulfa: ["sulfamethoxazole", "bactrim", "sulfadiazine", "sulfasalazine"],
  nsaid: ["ibuprofen", "naproxen", "ketorolac", "diclofenac", "aspirin", "indomethacin"],
  macrolide: ["azithromycin", "erythromycin", "clarithromycin"],
  statin: ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"],
  opioid: ["morphine", "oxycodone", "hydrocodone", "codeine", "hydromorphone", "tramadol"],
};

/** Major interaction pairs (ingredient family or ingredient level). */
const MAJOR_INTERACTIONS: Array<[string[], string[], string]> = [
  [["warfarin"], INGREDIENT_FAMILIES.nsaid, "Major bleeding risk: anticoagulant + NSAID"],
  [["warfarin"], ["fluconazole", "metronidazole", "sulfamethoxazole", "bactrim"], "Major INR elevation risk"],
  [INGREDIENT_FAMILIES.statin, ["clarithromycin", "erythromycin", "gemfibrozil"], "Major rhabdomyolysis risk"],
  [["lisinopril", "losartan", "enalapril", "valsartan"], ["spironolactone", "potassium"], "Major hyperkalemia risk"],
  [["metformin"], ["contrast", "iodinated contrast"], "Hold for contrast: lactic acidosis risk"],
  [INGREDIENT_FAMILIES.opioid, ["alprazolam", "lorazepam", "diazepam", "clonazepam"], "Major respiratory depression risk"],
];

const norm = (s: string) => (s || "").toLowerCase();
const familiesOf = (drug: string) =>
  Object.entries(INGREDIENT_FAMILIES)
    .filter(([, members]) => members.some((m) => norm(drug).includes(m)))
    .map(([family]) => family);

export interface SafetyInput {
  drug: string;
  allergies: Array<{ allergen: string; severity?: string | null; reaction?: string | null }>;
  activeMeds: Array<{ name: string }>;
  quantity?: number | null;
  daysSupply?: number | null;
  refills?: number | null;
}

export function evaluateSafety(input: SafetyInput): SafetyCheck[] {
  const out: SafetyCheck[] = [];
  const drug = norm(input.drug);
  const drugFamilies = familiesOf(input.drug);
  const base = { source: RULES_SOURCE, source_version: RULES_VERSION };

  for (const a of input.allergies) {
    const allergen = norm(a.allergen);
    if (!allergen) continue;
    const direct = drug.includes(allergen) || allergen.includes(drug.split(" ")[0]);
    const shared = familiesOf(a.allergen).some((f) => drugFamilies.includes(f));
    if (!direct && !shared) continue;
    const anaphylaxis = /anaphyla/i.test(`${a.severity ?? ""} ${a.reaction ?? ""}`) || norm(a.severity ?? "") === "severe";
    out.push({
      ...base,
      check_type: "allergy_conflict",
      severity: anaphylaxis ? "hard" : "reviewable",
      detail_code: direct ? "allergy_direct" : "allergy_cross_reactive",
      message: `Documented allergy to ${a.allergen}${shared && !direct ? " (same ingredient class)" : ""}.`,
    });
  }

  for (const m of input.activeMeds) {
    const name = norm(m.name);
    if (!name) continue;
    if (name.split(" ")[0] && drug.includes(name.split(" ")[0])) {
      out.push({ ...base, check_type: "duplicate_therapy", severity: "reviewable", detail_code: "duplicate_ingredient", message: `Duplicate therapy with active medication ${m.name}.` });
      continue;
    }
    const sharedFamily = familiesOf(m.name).find((f) => drugFamilies.includes(f));
    if (sharedFamily) {
      out.push({ ...base, check_type: "duplicate_therapy", severity: "reviewable", detail_code: `duplicate_class_${sharedFamily}`, message: `Same ${sharedFamily} class as active medication ${m.name}.` });
    }
    for (const [a, b, msg] of MAJOR_INTERACTIONS) {
      const hit = (a.some((x) => drug.includes(x)) && b.some((x) => name.includes(x))) ||
        (b.some((x) => drug.includes(x)) && a.some((x) => name.includes(x)));
      if (hit) out.push({ ...base, check_type: "interaction", severity: "reviewable", detail_code: "major_interaction", message: `${msg} (with ${m.name}).` });
    }
  }

  if (input.quantity != null && input.daysSupply != null && input.daysSupply > 0) {
    const perDay = input.quantity / input.daysSupply;
    if (perDay > 12) {
      out.push({ ...base, check_type: "dose_range", severity: "reviewable", detail_code: "quantity_per_day_high", message: `Dispense quantity implies ${perDay.toFixed(1)} units/day — verify the sig.` });
    }
  }
  if ((input.refills ?? 0) > 11) {
    out.push({ ...base, check_type: "dose_range", severity: "hard", detail_code: "refills_exceed_limit", message: "Refills exceed the 11-refill regulatory maximum." });
  }

  out.push({ ...base, check_type: "formulary", severity: "info", detail_code: "coverage_unknown", message: "Formulary/coverage check unavailable — no eligibility vendor is connected." });
  return out;
}
