import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { getCaller, userHasHospitalAccess } from "../_shared/auth.ts";
import { checkRateLimit, envLimit } from "../_shared/rateLimit.ts";
import { completeText } from "../_shared/llm.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";

const NOTE_TYPES = ["progress", "consult", "discharge", "procedure"] as const;

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

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

serve(async (req) => {
  const cors = buildCors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

    const rl = await checkRateLimit(admin, user.id, "generate-note", { limit: envLimit("RL_NOTE", 20), windowSec: 60 });
    if (!rl.allowed) return json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const body = await req.json();
    let transcript: string, note_type: string | undefined, hospital_id: string | undefined;
    const patientContext = body?.patientContext;
    try {
      transcript = vtext(body?.transcript, { max: 20000, required: true, field: "transcript" });
      note_type = venum(body?.note_type, NOTE_TYPES, "note_type");
      hospital_id = vuuid(body?.hospital_id, "hospital_id", { required: true });
    } catch (err) {
      return badRequest(err, cors);
    }

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
      const { text } = await completeText({ system: SYSTEM, messages: [{ role: "user", content }], json: true });
      parsed = extractJson(text);
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
