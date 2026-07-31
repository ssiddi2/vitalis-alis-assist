import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { getCaller, userHasHospitalAccess } from "../_shared/auth.ts";
import { callModel, type AcuityResult } from "./providers.ts";

// LAYER 0 — deterministic red-flag rules (no LLM cost).
const RED_FLAGS = [
  "chest pain", "not breathing", "unresponsive", "stroke", "anaphylaxis",
  "stat", "code blue", "hemorrhage", "suicidal", "sepsis",
];

const FAST_PROMPT =
  `You are a clinical message triage classifier. Score the ACUITY of the message only — never give a definitive diagnosis, never suggest treatment. ` +
  `Respond with ONLY a JSON object: {"classification":"stat"|"urgent"|"routine","acuity_level":"high"|"medium"|"low","score":0-100,"color":"#RRGGBB","rationale":"one concise clinical sentence","confidence":0-1}. ` +
  `Use #DC2626 for high, #F59E0B for medium, #16A34A for low.`;

const FRONTIER_PROMPT =
  `You are a senior clinical triage reviewer performing a careful re-assessment of a message flagged as uncertain or high acuity. ` +
  `Never give a definitive diagnosis. Respond with ONLY a JSON object: ` +
  `{"classification":"stat"|"urgent"|"routine","acuity_level":"high"|"medium"|"low","score":0-100,"color":"#RRGGBB","rationale":"concise clinical reasoning","recommendation":"one actionable next step for the clinician","confidence":0-1}. ` +
  `Use #DC2626 for high, #F59E0B for medium, #16A34A for low.`;

serve(async (req) => {
  const cors = buildCors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, hospital_id } = body;

    if (!hospital_id) return json({ error: "Missing hospital_id" }, 400);
    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) {
      return json({ error: "Forbidden" }, 403);
    }

    if (action === "record_feedback") {
      const { acuity_id, metric_type, metric_value } = body;
      if (!acuity_id || !metric_type) return json({ error: "Missing fields" }, 400);
      const { error } = await admin.from("acuity_feedback").insert({
        acuity_id, hospital_id, metric_type, metric_value, recorded_by: user.id,
      });
      if (error) throw error;
      return json({ success: true });
    }

    if (action !== "score") return json({ error: `Unknown action: ${action}` }, 400);

    const { message_text, patient_id, source_table, source_id } = body;
    if (!message_text) return json({ error: "Missing message_text" }, 400);

    let result: AcuityResult;
    let source_layer = "rules";
    let model_provider: string | null = null;
    let model_name: string | null = null;

    const lower = String(message_text).toLowerCase();
    const flag = RED_FLAGS.find((f) => lower.includes(f));

    if (flag) {
      result = {
        classification: "stat",
        acuity_level: "high",
        score: 95,
        color: "#DC2626",
        rationale: `Deterministic red-flag matched: "${flag}".`,
        confidence: 1,
      };
    } else {
      // LAYER 1 — cheap fast classifier
      const fast = await callModel("fast", FAST_PROMPT, String(message_text));
      result = fast.result;
      source_layer = "fast";
      model_provider = fast.provider;
      model_name = fast.model;

      // LAYER 2 — frontier escalation
      if (result.confidence < 0.7 || result.classification === "stat" || result.score >= 80) {
        const frontier = await callModel(
          "frontier",
          FRONTIER_PROMPT,
          `Message: ${message_text}\n\nInitial assessment: ${JSON.stringify(result)}`,
        );
        result = { ...result, ...frontier.result };
        source_layer = "frontier";
        model_provider = frontier.provider;
        model_name = frontier.model;
      }
    }

    const { data, error } = await admin.from("acuity_scores").insert({
      hospital_id,
      patient_id: patient_id || null,
      source_table: source_table || null,
      source_id: source_id || null,
      message_text,
      classification: result.classification,
      acuity_level: result.acuity_level,
      score: result.score,
      color: result.color,
      rationale: result.rationale,
      recommendation: result.recommendation || null,
      confidence: result.confidence,
      source_layer,
      model_provider,
      model_name,
      created_by: user.id,
    }).select().single();

    if (error) throw error;
    return json(data);
  } catch (error) {
    console.error("Acuity engine error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
