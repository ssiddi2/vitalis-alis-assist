import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public FHIR R4 sandbox (HAPI). No auth required — safe for demo.
// In production this URL would be Epic/Cerner/Meditech tenant base URL with SMART-on-FHIR OAuth.
const FHIR_BASE = "https://hapi.fhir.org/baseR4";

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

async function countResource(name: string): Promise<number> {
  try {
    const r = await fetch(`${FHIR_BASE}/${name}?_summary=count`, {
      headers: { Accept: "application/fhir+json" },
    });
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.total ?? 0);
  } catch {
    return 0;
  }
}

async function samplePatient(): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${FHIR_BASE}/Patient?_count=1&_sort=-_lastUpdated`, {
      headers: { Accept: "application/fhir+json" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const entry = j.entry?.[0]?.resource;
    if (!entry) return null;
    const name = entry.name?.[0];
    return {
      id: entry.id,
      name: name ? `${(name.given || []).join(" ")} ${name.family || ""}`.trim() : "(unnamed)",
      gender: entry.gender || "unknown",
      birthDate: entry.birthDate || null,
      lastUpdated: entry.meta?.lastUpdated || null,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const counts = await Promise.all(RESOURCES.map(async (n) => ({ name: n, count: await countResource(n) })));
  const sample = await samplePatient();
  const latencyMs = Date.now() - t0;

  return new Response(
    JSON.stringify({
      server: FHIR_BASE,
      fhir_version: "4.0.1",
      synced_at: new Date().toISOString(),
      latency_ms: latencyMs,
      resources: counts,
      sample_patient: sample,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
