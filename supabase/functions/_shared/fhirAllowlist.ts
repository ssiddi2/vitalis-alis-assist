const DEFAULT_ISS = [
  "https://launch.smarthealthit.org",
  "https://r4.smarthealthit.org",
  "https://hapi.fhir.org/baseR4",
];

/** True if the given FHIR base URL is allowlisted (env ALLOWED_FHIR_ISS + defaults). */
export function isAllowedIss(iss: string): boolean {
  const extra = (Deno.env.get("ALLOWED_FHIR_ISS") || "")
    .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  const allowed = [...DEFAULT_ISS, ...extra];
  const candidate = String(iss).replace(/\/$/, "");
  return allowed.some((a) => candidate === a || candidate.startsWith(`${a}/`));
}
