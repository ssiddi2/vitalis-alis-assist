import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { isAllowedIss } from "../_shared/fhirAllowlist.ts";

// FHIR write-back proxy. Client forwards SMART session creds; we POST the resource
// and report success or a graceful skip (sandbox lacks scope, etc.) so demos never crash.
serve(async (req) => {
  const g = await guard(req, { bucket: "fhir-writeback", limit: envLimit("RL_FHIR_WRITE", 60) });
  if (g.response) return g.response;
  const corsHeaders = g.cors;

  try {
    const { iss, access_token, resourceType, resource } = await req.json();
    if (!iss || !access_token || !resourceType || !resource) {
      return json({ status: "skipped", reason: "missing_smart_session" });
    }
    if (!isAllowedIss(iss)) {
      return json({ status: "skipped", reason: "iss_not_allowlisted" });
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
      // Never echo the upstream body: a FHIR OperationOutcome can carry PHI.
      console.error(`[fhir-writeback] upstream ${r.status} (${text.length} bytes)`);
      return json({ status: "skipped", reason: `ehr_${r.status}` });
    }
    let parsed: { id?: string; resourceType?: string } = {};
    try { parsed = JSON.parse(text); } catch { /* may be empty 201 */ }
    const id = parsed.id || r.headers.get("location")?.split("/").slice(-1)[0] || "unknown";
    return json({ status: "written", resourceType, id, location: `${base}/${resourceType}/${id}` });
  } catch (e) {
    return json({ status: "error", reason: e instanceof Error ? e.message : "unknown" }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
