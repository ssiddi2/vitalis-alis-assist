import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Optional confidential-client secret. If unset, treats as public client (PKCE only).
const CLIENT_SECRET = Deno.env.get("SMART_CLIENT_SECRET") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token_endpoint, iss, code, code_verifier, redirect_uri, client_id } = await req.json();
    if (!token_endpoint || !code || !code_verifier || !redirect_uri || !client_id) {
      return json({ error: "Missing required fields" }, 400);
    }

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
    const tokText = await tokRes.text();
    if (!tokRes.ok) return json({ error: "Token exchange failed", status: tokRes.status, body: tokText }, 400);
    const tok = JSON.parse(tokText);

    // Best-effort: fetch the launched Patient resource for immediate context
    let patient_resource: unknown = null;
    if (tok.patient && iss && tok.access_token) {
      try {
        const pr = await fetch(`${iss.replace(/\/$/, "")}/Patient/${tok.patient}`, {
          headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/fhir+json" },
        });
        if (pr.ok) patient_resource = await pr.json();
      } catch { /* ignore */ }
    }

    return json({ ...tok, patient_resource });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
