// Authoritative controlled-substance guard. Case-insensitive substring match on drug name.
// EPCS (DEA electronic prescribing of controlled substances) is NOT certified, so these are hard-blocked.

export type Schedule = "II" | "III" | "IV" | "V";

const TABLE: Array<[Schedule, string[]]> = [
  ["II", [
    "oxycodone", "percocet", "oxycontin", "hydrocodone", "norco", "vicodin", "morphine", "ms contin",
    "fentanyl", "hydromorphone", "dilaudid", "methadone", "meperidine", "demerol", "oxymorphone",
    "amphetamine", "adderall", "vyvanse", "lisdexamfetamine", "dextroamphetamine", "methylphenidate",
    "ritalin", "concerta", "secobarbital", "pentobarbital", "cocaine",
  ]],
  ["III", ["buprenorphine", "suboxone", "testosterone", "ketamine", "codeine", "tylenol with codeine", "anabolic"]],
  ["IV", [
    "alprazolam", "xanax", "lorazepam", "ativan", "clonazepam", "klonopin", "diazepam", "valium",
    "temazepam", "midazolam", "chlordiazepoxide", "zolpidem", "ambien", "eszopiclone", "lunesta",
    "zaleplon", "phentermine", "tramadol", "ultram", "carisoprodol", "soma", "modafinil", "armodafinil",
    "phenobarbital",
  ]],
  ["V", ["pregabalin", "lyrica", "lomotil", "diphenoxylate", "brivaracetam", "cough syrup with codeine"]],
];

export function classifyControlled(drugName: string): { controlled: boolean; schedule?: Schedule } {
  const name = (drugName || "").toLowerCase();
  if (!name) return { controlled: false };
  for (const [schedule, terms] of TABLE) {
    if (terms.some((t) => name.includes(t))) return { controlled: true, schedule };
  }
  return { controlled: false };
}
