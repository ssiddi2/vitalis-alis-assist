/**
 * FHIR issuer allowlist. Production-safe: there are NO built-in defaults —
 * if ALLOWED_FHIR_ISS is unset the allowlist is empty and every issuer is denied.
 */

/**
 * Known PUBLIC SANDBOX hosts. These serve SYNTHETIC test patients only and are
 * merged into the allowlist ONLY when ENABLE_FHIR_SANDBOX === "true".
 * This flag must remain unset in any real-patient deployment.
 */
const SANDBOX_ISSUERS = [
  "https://launch.smarthealthit.org",
  "https://fhir.epic.com",
  "https://fhir-ehr-code.cerner.com",
  "https://fhir-open.cerner.com",
];

export function allowedIssuers(): string[] {
  const configured = (Deno.env.get("ALLOWED_FHIR_ISS") || "")
    .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  return Deno.env.get("ENABLE_FHIR_SANDBOX") === "true"
    ? [...configured, ...SANDBOX_ISSUERS]
    : configured;
}


/** True if the given FHIR base URL is https and explicitly allowlisted. */
export function isAllowedIss(iss: string): boolean {
  let candidate: string;
  try {
    const u = new URL(String(iss));
    if (u.protocol !== "https:") return false;
    candidate = u.toString().replace(/\/$/, "");
  } catch {
    return false;
  }
  return allowedIssuers().some((a) => candidate === a || candidate.startsWith(`${a}/`));
}
