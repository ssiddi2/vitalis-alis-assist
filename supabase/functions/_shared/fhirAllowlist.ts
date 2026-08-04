/**
 * FHIR issuer allowlist. Production-safe: there are NO built-in defaults —
 * if ALLOWED_FHIR_ISS is unset the allowlist is empty and every issuer is denied.
 */
export function allowedIssuers(): string[] {
  return (Deno.env.get("ALLOWED_FHIR_ISS") || "")
    .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
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
