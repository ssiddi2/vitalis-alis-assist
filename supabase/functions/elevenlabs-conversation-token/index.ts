import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");

  if (!API_KEY) return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!AGENT_ID) return new Response(JSON.stringify({ error: "ELEVENLABS_AGENT_ID not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`, {
      headers: { "xi-api-key": API_KEY },
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: `ElevenLabs [${res.status}]: ${body}` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { token } = await res.json();
    return new Response(JSON.stringify({ token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
