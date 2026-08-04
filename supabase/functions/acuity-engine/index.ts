import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { guard } from "../_shared/guard.ts";
import { callModel, sanitize, SPECIALTIES, URGENCY_COLOR, type AcuityResult } from "./providers.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { patientInHospital } from "../_shared/tenancy.ts";

const ACTIONS = ["score", "record_feedback"] as const;
const METRIC_TYPES = ["response_time", "unaddressed", "subsequent_action", "reclassified"] as const;

// LAYER 0 — deterministic red-flag rules (no LLM cost).
const RED_FLAGS = [
  "chest pain", "not breathing", "unresponsive", "stroke", "anaphylaxis",
  "stat", "code blue", "hemorrhage", "suicidal", "sepsis",
];

const SHAPE =
  `{"suggestedUrgency":"High"|"Moderate"|"Low","suggestedSpecialty":"<one of: ${SPECIALTIES.join(", ")}>",` +
  `"suggestedSpecialties":[{"name":"<allowlisted specialty>","confidence":0-100,"reasoning":"short"}],` +
  `"reasoning":"one concise clinical sentence","confidence":0-100,` +
  `"serviceCategory":"emergency"|"critical_care"|"routine_care"|"specialty_consultation",` +
  `"hospitalPriority":"immediate"|"urgent"|"routine","riskLevel":"Critical"|"Moderate"|"Low",` +
  `"immediateActions":["short action"],"estimatedResponseTime":"immediate"|"within_15_min"|"within_1_hour"|"routine",` +
  `"extractedKeywords":["term"],"score":0-100}`;

const FAST_PROMPT =
  `You perform clinical acuity TRIAGE of a clinician message. Assess acuity and routing ONLY — never give a definitive diagnosis and never prescribe treatment. ` +
  `Respond with ONLY a JSON object of exactly this shape: ${SHAPE}`;

const FRONTIER_PROMPT =
  `You are a senior clinical triage reviewer re-assessing a message flagged as uncertain or high acuity. Acuity TRIAGE only — never a definitive diagnosis. ` +
  `Respond with ONLY a JSON object of exactly this shape, additionally including "recommendation":"one actionable next step for the clinician", ` +
  `and always populate immediateActions and suggestedSpecialties: ${SHAPE}`;

serve(async (req) => {
  const g = await guard(req, { bucket: "acuity-engine", limit: envLimit("RL_ACUITY", 60) });
  if (g.response) return g.response;
  const { user, admin, cors, json } = g;

  try {
    const body = await req.json();
    let action: string | undefined, hospital_id: string | undefined;
    let message_text = "", patient_id: string | undefined, metric_type: string | undefined;
    try {
      action = venum(body?.action, ACTIONS, "action", { required: true });
      hospital_id = vuuid(body?.hospital_id, "hospital_id", { required: true });
      patient_id = vuuid(body?.patient_id, "patient_id");
      if (action === "record_feedback") {
        metric_type = venum(body?.metric_type, METRIC_TYPES, "metric_type", { required: true });
      } else {
        message_text = vtext(body?.message_text, { max: 8000, required: true, field: "message_text" });
      }
    } catch (err) {
      return badRequest(err, cors);
    }

    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) {
      return json({ error: "Forbidden" }, 403);
    }

    if (action === "record_feedback") {
      const { acuity_id, metric_value } = body;
      if (!acuity_id) return json({ error: "acuity_id is required" }, 400);
      const { error } = await admin.from("acuity_feedback").insert({
        acuity_id, hospital_id, metric_type, metric_value, recorded_by: user.id,
      });
      if (error) throw error;
      return json({ success: true });
    }

    const { source_table, source_id } = body;

    let result: AcuityResult;
    let source_layer = "rules";
    let model_provider: string | null = null;
    let model_name: string | null = null;

    const lower = String(message_text).toLowerCase();
    const flag = RED_FLAGS.find((f) => lower.includes(f));

    if (flag) {
      result = sanitize({
        suggestedUrgency: "High",
        suggestedSpecialty: "Emergency Medicine",
        reasoning: `Deterministic red-flag matched: "${flag}".`,
        confidence: 100,
        score: 95,
        extractedKeywords: [flag],
        immediateActions: ["Escalate immediately to the on-call clinician"],
      });
    } else {
      // LAYER 1 — cheap fast classifier
      const fast = await callModel("fast", FAST_PROMPT, String(message_text));
      result = fast.result;
      source_layer = "fast";
      model_provider = fast.provider;
      model_name = fast.model;

      // LAYER 2 — frontier escalation
      if (result.confidence < 70 || result.suggestedUrgency === "High" || result.score >= 80) {
        const frontier = await callModel(
          "frontier",
          FRONTIER_PROMPT,
          `Message: ${message_text}\n\nInitial assessment: ${JSON.stringify(result)}`,
          result,
        );
        result = frontier.result;
        source_layer = "frontier";
        model_provider = frontier.provider;
        model_name = frontier.model;
      }
    }

    // Tenancy hygiene: never attach a patient from another hospital to a score.
    const scopedPatientId = patient_id && (await patientInHospital(admin, patient_id, hospital_id!))
      ? patient_id
      : null;

    const { data, error } = await admin.from("acuity_scores").insert({
      hospital_id,
      patient_id: scopedPatientId,
      source_table: source_table || null,
      source_id: source_id || null,
      message_text,
      classification: result.classification,
      acuity_level: result.suggestedUrgency,
      score: result.score,
      color: URGENCY_COLOR[result.suggestedUrgency],
      rationale: result.reasoning,
      recommendation: result.recommendation || null,
      confidence: result.confidence,
      service_category: result.serviceCategory,
      hospital_priority: result.hospitalPriority,
      risk_level: result.riskLevel,
      estimated_response_time: result.estimatedResponseTime,
      extracted_keywords: result.extractedKeywords,
      immediate_actions: result.immediateActions,
      suggested_specialty: result.suggestedSpecialty,
      suggested_specialties: result.suggestedSpecialties,
      source_layer,
      model_provider,
      model_name,
      created_by: user.id,
    }).select().single();

    if (error) throw error;
    return json({ ...data, ...result });
  } catch (error) {
    console.error("Acuity engine error:", error);
    return json({ error: "Acuity scoring failed" }, 500);
  }
});
