import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { isAllowedIss } from "../_shared/fhirAllowlist.ts";

/**
 * Connectivity/inventory probe against a FHIR R4 server.
 * There is NO built-in server: the base URL comes from the caller and must be
 * explicitly allowlisted via ALLOWED_FHIR_ISS (deny-all by default).
 */

const RESOURCES = [
  "Patient",
  "Encounter",
  "Observation",
  "DiagnosticReport",
  "MedicationRequest",
  "AllergyIntolerance",
  "Condition",
  "Procedure",
];

async function countResource(base: string, name: string): Promise<number> {
  try {
    const r = await fetch(`${base}/${name}?_summary=count`, {
      headers: { Accept: "application/fhir+json" },
    });
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.total ?? 0);
  } catch {
    return 0;
  }
}

async function samplePatient(base: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${base}/Patient?_count=1&_sort=-_lastUpdated`, {
      headers: { Accept: "application/fhir+json" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const entry = j.entry?.[0]?.resource;
    if (!entry) return null;
    // Identity fields are deliberately omitted — this is a connectivity probe.
    return {
      id: entry.id,
      lastUpdated: entry.meta?.lastUpdated || null,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  const g = await guard(req, { bucket: "fhir-sync", limit: envLimit("RL_FHIR_SYNC", 20) });
  if (g.response) return g.response;
  const corsHeaders = g.cors;

  // DEMO-ONLY PATH. This probe contacts an external FHIR server and must stay
  // disabled in any real-patient deployment. Leave ENABLE_FHIR_SANDBOX unset in production.
  if (Deno.env.get("ENABLE_FHIR_SANDBOX") !== "true") {
    return new Response(
      JSON.stringify({ error: "FHIR sandbox sync is disabled" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let iss = "";
  try {
    const body = await req.json().catch(() => ({}));
    iss = String(body?.iss || body?.fhir_base || "").replace(/\/$/, "");
  } catch { /* no body */ }
  if (!iss || !isAllowedIss(iss)) {
    return new Response(
      JSON.stringify({ error: "FHIR server is not allowlisted", hint: "Set ALLOWED_FHIR_ISS and pass iss." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const t0 = Date.now();
  const counts = await Promise.all(RESOURCES.map(async (n) => ({ name: n, count: await countResource(iss, n) })));
  const sample = await samplePatient(iss);
  const latencyMs = Date.now() - t0;

  return new Response(
    JSON.stringify({
      server: iss,
      fhir_version: "4.0.1",
      synced_at: new Date().toISOString(),
      latency_ms: latencyMs,
      resources: counts,
      sample_patient: sample,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
