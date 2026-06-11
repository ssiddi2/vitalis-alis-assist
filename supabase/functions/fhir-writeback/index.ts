import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FHIR write-back proxy. Client forwards SMART session creds; we POST the resource
// and report success or a graceful skip (sandbox lacks scope, etc.) so demos never crash.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { iss, access_token, resourceType, resource } = await req.json();
    if (!iss || !access_token || !resourceType || !resource) {
      return json({ status: "skipped", reason: "missing_smart_session" });
    }

    const base = String(iss).replace(/\/$/, "");
    const r = await fetch(`${base}/${resourceType}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/fhir+json",
        Accept: "application/fhir+json",
      },
      body: JSON.stringify(resource),
    });

    const text = await r.text();
    if (!r.ok) {
      return json({ status: "skipped", reason: `ehr_${r.status}`, body: text.slice(0, 400) });
    }
    let parsed: { id?: string; resourceType?: string } = {};
    try { parsed = JSON.parse(text); } catch { /* may be empty 201 */ }
    const id = parsed.id || r.headers.get("location")?.split("/").slice(-1)[0] || "unknown";
    return json({ status: "written", resourceType, id, location: `${base}/${resourceType}/${id}` });
  } catch (e) {
    return json({ status: "error", reason: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
