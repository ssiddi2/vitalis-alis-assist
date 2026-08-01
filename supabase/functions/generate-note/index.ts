import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { getCaller, userHasHospitalAccess } from "../_shared/auth.ts";

const env = (k: string) => Deno.env.get(k) || "";

const SYSTEM =
  "You are an expert medical scribe. Produce an accurate SOAP note strictly from the encounter transcript and provided patient context. " +
  "Never invent findings, diagnoses, vitals, or history not supported by the input. Concise clinical language. " +
  'Respond with ONLY a JSON object of exactly this shape: {"subjective":"","objective":"","assessment":"","plan":"",' +
  '"suggestedBillingCodes":[{"code":"","description":"","type":"CPT"|"ICD-10"}]}';

const FALLBACK = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  suggestedBillingCodes: [] as { code: string; description: string; type: string }[],
  error: "model_unavailable",
};

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "```").split("```").join("\n");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function callModel(system: string, user: string): Promise<string> {
  const anthropicKey = env("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("NOTE_MODEL") || "claude-sonnet-5",
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("NOTE_MODEL") || "google/gemini-2.5-pro",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

serve(async (req) => {
  const cors = buildCors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { transcript, patientContext, hospital_id, note_type } = await req.json();
    if (!hospital_id) return json({ error: "hospital_id required" }, 400);
    if (!str(transcript)) return json({ error: "transcript required" }, 400);

    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) {
      return json({ error: "Forbidden" }, 403);
    }

    const content = [
      `Note type: ${str(note_type) || "progress"}`,
      patientContext ? `Patient context:\n${typeof patientContext === "string" ? patientContext : JSON.stringify(patientContext)}` : "",
      `Encounter transcript:\n${str(transcript)}`,
    ].filter(Boolean).join("\n\n");

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = extractJson(await callModel(SYSTEM, content));
    } catch (_e) {
      parsed = null;
    }
    if (!parsed) return json(FALLBACK);

    const codes = Array.isArray(parsed.suggestedBillingCodes)
      ? (parsed.suggestedBillingCodes as Record<string, unknown>[])
          .filter((c) => c && str(c.code))
          .map((c) => ({
            code: str(c.code),
            description: str(c.description),
            type: c.type === "ICD-10" ? "ICD-10" : "CPT",
          }))
          .slice(0, 10)
      : [];

    return json({
      subjective: str(parsed.subjective),
      objective: str(parsed.objective),
      assessment: str(parsed.assessment),
      plan: str(parsed.plan),
      suggestedBillingCodes: codes,
    });
  } catch (e) {
    return json({ ...FALLBACK, error: e instanceof Error ? e.message : "unknown" });
  }
});
