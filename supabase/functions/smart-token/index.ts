import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { isAllowedIss } from "../_shared/fhirAllowlist.ts";

// Optional confidential-client secret. If unset, treats as public client (PKCE only).
const CLIENT_SECRET = Deno.env.get("SMART_CLIENT_SECRET") || "";

/** Re-derives the token endpoint server-side from the ALLOWLISTED issuer. */
async function discoverTokenEndpoint(iss: string): Promise<string | null> {
  const base = iss.replace(/\/$/, "");
  const r = await fetch(`${base}/.well-known/smart-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) return null;
  const cfg = await r.json();
  try {
    const url = new URL(String(cfg.token_endpoint));
    const issUrl = new URL(base);
    if (url.protocol !== "https:" || url.host !== issUrl.host) return null;
    return url.toString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  const g = await guard(req, { bucket: "smart-token", limit: envLimit("RL_SMART_TOKEN", 20) });
  if (g.response) return g.response;
  const { cors, json } = g;

  try {
    const { iss, code, code_verifier, redirect_uri, client_id } = await req.json();
    if (!iss || !code || !code_verifier || !redirect_uri || !client_id) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!isAllowedIss(iss)) return json({ error: "Issuer not allowlisted" }, 403);

    // NEVER trust a client-supplied token_endpoint — the client secret would leak.
    const token_endpoint = await discoverTokenEndpoint(iss);
    if (!token_endpoint) return json({ error: "SMART discovery failed" }, 400);

    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("code", code);
    form.set("redirect_uri", redirect_uri);
    form.set("client_id", client_id);
    form.set("code_verifier", code_verifier);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    if (CLIENT_SECRET) {
      headers.Authorization = `Basic ${btoa(`${client_id}:${CLIENT_SECRET}`)}`;
    }

    const tokRes = await fetch(token_endpoint, { method: "POST", headers, body: form.toString() });
    if (!tokRes.ok) {
      console.error("[smart-token] token exchange failed", tokRes.status);
      await tokRes.body?.cancel();
      return json({ error: "Token exchange failed" }, 400);
    }
    const tok = await tokRes.json();

    // Best-effort: fetch launched Patient + a small clinical bundle for AI context
    const base = String(iss).replace(/\/$/, "");
    const fhirGet = async (path: string) => {
      try {
        const r = await fetch(`${base}/${path}`, {
          headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/fhir+json" },
        });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    };

    let patient_resource: unknown = null;
    let bundle: Record<string, unknown> = {};
    if (tok.patient && tok.access_token) {
      const pid = tok.patient;
      const [pt, cond, meds, allg, obs] = await Promise.all([
        fhirGet(`Patient/${pid}`),
        fhirGet(`Condition?patient=${pid}&clinical-status=active&_count=20`),
        fhirGet(`MedicationRequest?patient=${pid}&status=active&_count=20`),
        fhirGet(`AllergyIntolerance?patient=${pid}&_count=20`),
        fhirGet(`Observation?patient=${pid}&category=vital-signs&_count=10&_sort=-date`),
      ]);
      patient_resource = pt;
      const entries = (b: { entry?: { resource?: unknown }[] } | null) =>
        (b?.entry || []).map((e) => e.resource).filter(Boolean);
      bundle = {
        conditions: entries(cond as never),
        medications: entries(meds as never),
        allergies: entries(allg as never),
        vitals: entries(obs as never),
      };
    }

    return json({ ...tok, patient_resource, bundle });
  } catch (e) {
    console.error("[smart-token]", e instanceof Error ? e.message : "unknown");
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
