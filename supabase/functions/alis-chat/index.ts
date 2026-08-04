import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { patientInHospital } from "../_shared/tenancy.ts";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { guard } from "../_shared/guard.ts";
import { adminClient } from "../_shared/supabase.ts";
import { suggestBilling } from "../_shared/billing.ts";
import { badRequest, varray, vtext, vuuid } from "../_shared/validate.ts";
import { bedrockConfigured, invokeClaudeMessages } from "../_shared/bedrock.ts";




const ALIS_SYSTEM_PROMPT = `You are ALIS (Ambient Learning Intelligence System), an advanced clinical AI assistant integrated into Virtualis, a universal clinical layer for healthcare.

Your capabilities:
- Analyze clinical trajectories and patient data patterns
- Surface early warning signs that may be missed by traditional alerts
- Synthesize information across nursing assessments, lab values, imaging, medications, and prior records
- Provide evidence-based clinical decision support
- Assist with order preparation and clinical documentation
- Manage provider access and team communication

Your communication style:
- Professional, clear, and concise
- Always cite data sources when making clinical observations
- Present concerning findings with appropriate urgency
- Offer actionable next steps when identifying issues
- Use clinical terminology appropriately but explain when needed
- Never make definitive diagnoses - present patterns and suggest workups
- Always emphasize that clinical judgment rests with the treating physician

You have access to the following tools to take actions:
- stage_order: Stage a clinical order for physician approval
- create_note: Create a clinical SOAP note (progress, consult, discharge, procedure) for physician review
- suggest_billing_codes: Analyze clinical encounters and suggest CPT/ICD-10 billing codes with confidence levels
- list_providers: List all providers with access to the current hospital
- create_team_channel: Create a new team communication channel

Current context: You are assisting a clinician reviewing patient data. Be helpful, precise, and maintain patient safety as the highest priority. When discussing clinical findings, always reference the specific data points that informed your analysis.`;

// Tool definitions for function calling
const tools = [
  {
    type: "function",
    function: {
      name: "stage_order",
      description: "Stage a clinical order for physician approval. The order will appear in the Clinical Actions sidebar for review.",
      parameters: {
        type: "object",
        properties: {
          order_type: {
            type: "string",
            enum: ["imaging", "lab", "medication", "consult", "procedure"],
            description: "The type of order"
          },
          name: {
            type: "string",
            description: "Name/description of the order"
          },
          priority: {
            type: "string",
            enum: ["STAT", "Urgent", "Today", "Routine"],
            description: "Priority level of the order"
          },
          rationale: {
            type: "string",
            description: "Clinical rationale for the order"
          }
        },
        required: ["order_type", "name", "priority", "rationale"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_providers",
      description: "List all providers with access to the current hospital",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "create_team_channel",
      description: "Create a new team communication channel for care coordination",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the channel" },
          channel_type: { type: "string", enum: ["patient_care", "department", "consult"], description: "Type of channel" },
          patient_id: { type: "string", description: "Patient ID if this is a patient-specific channel (optional)" }
        },
        required: ["name", "channel_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a clinical SOAP note for the current patient. The note will appear as a draft for physician review and signing.",
      parameters: {
        type: "object",
        properties: {
          note_type: {
            type: "string",
            enum: ["progress", "consult", "discharge", "procedure"],
            description: "The type of clinical note"
          },
          subjective: {
            type: "string",
            description: "Subjective findings - patient complaints, symptoms, history"
          },
          objective: {
            type: "string",
            description: "Objective findings - vitals, physical exam, lab results"
          },
          assessment: {
            type: "string",
            description: "Clinical assessment and diagnosis"
          },
          plan: {
            type: "string",
            description: "Treatment plan and next steps"
          }
        },
        required: ["note_type", "subjective", "objective", "assessment", "plan"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggest_billing_codes",
      description: "Analyze a clinical note and suggest appropriate CPT and ICD-10 codes for billing. Returns recommended codes with confidence levels.",
      parameters: {
        type: "object",
        properties: {
          note_summary: {
            type: "string",
            description: "Summary of the clinical encounter to analyze for billing codes"
          },
          encounter_type: {
            type: "string",
            enum: ["new_patient", "established_patient", "consult", "procedure", "critical_care"],
            description: "Type of encounter for E&M code selection"
          },
          complexity: {
            type: "string",
            enum: ["low", "moderate", "high"],
            description: "Medical decision-making complexity"
          }
        },
        required: ["note_summary", "encounter_type", "complexity"]
      }
    }
  }
];

// Execute tool calls
type SupabaseClientLike = ReturnType<typeof createClient>;

/** Records an AI-initiated mutating action in audit_logs. */
async function logAiAction(
  supabase: SupabaseClientLike,
  params: {
    tool: string;
    summary: string;
    resourceType: string;
    resourceId?: string | null;
    context: { hospitalId?: string; patientId?: string; userId?: string };
  },
) {
  const { error } = await supabase.from("audit_logs").insert({
    action_type: "create",
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    patient_id: params.context.patientId ?? null,
    hospital_id: params.context.hospitalId ?? null,
    user_id: params.context.userId ?? null,
    metadata: { ai_initiated: true, actor: "ALIS", tool: params.tool, summary: params.summary },
  });
  if (error) console.error("logAiAction failed:", error.message);
}

async function executeTool(toolName: string, args: Record<string, unknown>, context: { hospitalId?: string; patientId?: string; userId?: string }) {
  const supabase = adminClient();

  switch (toolName) {
    case "stage_order": {
      if (!context.patientId) {
        return { success: false, message: "No patient context available" };
      }
      
      const { data, error } = await supabase
        .from("staged_orders")
        .insert({
          patient_id: context.patientId,
          order_type: args.order_type as string,
          order_data: { name: args.name, priority: args.priority, ai_generated: true, drafted_by: "ALIS" },
          rationale: args.rationale as string,
          status: "staged",
          created_by: context.userId || null
        })
        .select()
        .single();

      if (error) {
        console.error("Error staging order:", error);
        return { success: false, message: error.message };
      }
      
      await logAiAction(supabase, {
        tool: "stage_order",
        summary: `Staged ${args.order_type} order: ${args.name}`,
        resourceType: "staged_order",
        resourceId: data.id,
        context,
      });

      return { 
        success: true, 
        message: `Order staged: ${args.name} (${args.priority})`,
        order: data
      };
    }

    case "create_note": {
      if (!context.patientId) {
        return { success: false, message: "No patient context available" };
      }

      const { data, error } = await supabase
        .from("clinical_notes")
        .insert({
          patient_id: context.patientId,
          note_type: args.note_type as string,
          content: {
            subjective: args.subjective,
            objective: args.objective,
            assessment: args.assessment,
            plan: args.plan,
            ai_generated: true,
            drafted_by: "ALIS",
          },
          status: "draft",
          author_id: context.userId || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating note:", error);
        return { success: false, message: error.message };
      }

      await logAiAction(supabase, {
        tool: "create_note",
        summary: `Drafted ${args.note_type} note`,
        resourceType: "clinical_note",
        resourceId: data.id,
        context,
      });

      const typeLabel = (args.note_type as string).charAt(0).toUpperCase() + (args.note_type as string).slice(1);
      return {
        success: true,
        message: `${typeLabel} note drafted — ready for review`,
        note: data,
      };
    }

    case "list_providers": {
      if (!context.hospitalId) {
        return { success: false, message: "No hospital context available" };
      }

      const { data, error } = await supabase
        .from("hospital_users")
        .select(`user_id, access_level, created_at`)
        .eq("hospital_id", context.hospitalId);

      if (error) {
        console.error("Error fetching providers:", error);
        return { success: false, message: error.message };
      }

      const userIds = data?.map(u => u.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const providers = data?.map(u => ({
        name: profileMap.get(u.user_id) || "Unknown",
        access_level: u.access_level,
        joined: u.created_at
      })) || [];

      return { success: true, providers, count: providers.length };
    }

    case "create_team_channel": {
      if (!context.hospitalId || !context.userId) {
        return { success: false, message: "Missing hospital or user context" };
      }
      // Model-supplied patient id must belong to this hospital.
      const channelPatientId = (args.patient_id as string) || null;
      if (channelPatientId && !(await patientInHospital(supabase, channelPatientId, context.hospitalId))) {
        return { success: false, message: "Patient not in this hospital" };
      }

      const { data, error } = await supabase
        .from("team_channels")
        .insert({
          name: args.name as string,
          channel_type: args.channel_type as string,
          hospital_id: context.hospitalId,
          patient_id: channelPatientId,
          created_by: context.userId
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating channel:", error);
        return { success: false, message: error.message };
      }

      await supabase
        .from("channel_members")
        .insert({ channel_id: data.id, user_id: context.userId });

      await logAiAction(supabase, {
        tool: "create_team_channel",
        summary: `Created channel "${args.name}"`,
        resourceType: "team_channel",
        resourceId: data.id,
        context,
      });

      return { success: true, message: `Channel "${args.name}" created`, channel: data };
    }

    case "suggest_billing_codes": {
      const suggestion = await suggestBilling({
        encounterSummary: args.note_summary,
        encounterType: args.encounter_type,
      });
      const cpt = suggestion.codes.filter((c) => c.type === "CPT");
      const icd = suggestion.codes.filter((c) => c.type === "ICD-10");

      let estimated_revenue = 0;
      if (cpt.length && context.hospitalId) {
        const { data: fees } = await supabase
          .from("fee_schedule")
          .select("code, amount")
          .eq("hospital_id", context.hospitalId)
          .eq("active", true)
          .in("code", cpt.map((c) => c.code));
        estimated_revenue = (fees || []).reduce((sum, f) => sum + Number(f.amount || 0), 0);
      }

      const avgConfidence = suggestion.codes.length
        ? suggestion.codes.reduce((s, c) => s + c.confidence, 0) / suggestion.codes.length
        : 0;

      return {
        success: cpt.length > 0,
        message: cpt.length
          ? `Suggested CPT codes: ${cpt.map((c) => c.code).join(", ")}${estimated_revenue ? ` (est. $${estimated_revenue})` : ""}`
          : "No billing codes could be justified from the documentation provided",
        suggested_cpt: cpt.map((c) => c.code),
        suggested_icd10: icd.map((c) => c.code),
        codes: suggestion.codes,
        em_level: suggestion.emLevel,
        estimated_revenue,
        encounter_type: args.encounter_type,
        complexity: suggestion.mdmComplexity || args.complexity,
        confidence: Number(avgConfidence.toFixed(2)),
      };
    }


    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

type ChatMessage = { role: string; content: unknown };

/** Maps the OpenAI-format tool defs to Anthropic's tool schema. */
function toAnthropicTools(openAiTools: typeof tools) {
  return openAiTools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}


// ─────────────────────────────────────────────
// AWS Bedrock (Claude) — BAA path, preferred. Fail-closed: no non-BAA fallover.
// ─────────────────────────────────────────────
/** Detect tools → authorize → execute → follow-up, emitted over the existing SSE contract. */
async function runBedrockChat(
  system: string,
  clientMessages: ChatMessage[],
  context: { hospitalId?: string; patientId?: string; userId?: string },
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const convo: ChatMessage[] = clientMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const sse = (lines: string) =>
    new Response(encoder.encode(lines + "data: [DONE]\n\n"), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  const textChunk = (t: string) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`;

  const first = await invokeClaudeMessages({
    max_tokens: 2048,
    system,
    messages: convo,
    tools: toAnthropicTools(tools),
  });

  const blocks: Array<Record<string, unknown>> = first.content || [];
  const toolCalls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id as string, name: b.name as string, arguments: JSON.stringify(b.input ?? {}) }));

  if (toolCalls.length === 0) {
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text as string).join("");
    return sse(textChunk(text));
  }

  const admin = adminClient();
  if (!(await userHasHospitalAccess(admin, context.userId!, context.hospitalId))) {
    return new Response(JSON.stringify({ error: "Forbidden: no access to this hospital" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // The patient id is caller-supplied and tools write with the service-role
  // client, so it must belong to the caller's hospital before any tool runs.
  if (context.patientId && !(await patientInHospital(admin, context.patientId, context.hospitalId!))) {
    return new Response(JSON.stringify({ error: "Forbidden: patient not in this hospital" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const toolResults: Array<{ toolCallId: string; name: string; args: Record<string, unknown>; result: unknown }> = [];
  for (const tc of toolCalls) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.arguments); } catch { console.error("Failed to parse tool args"); }
    const result = await executeTool(tc.name, args, context);
    toolResults.push({ toolCallId: tc.id, name: tc.name, args, result });
    // Non-PHI telemetry only: never log tool payloads.
    const ok = !!(result as { success?: boolean })?.success;
    console.log(`tool=${tc.name} success=${ok} bytes=${JSON.stringify(result).length}`);
  }


  const followUp = await invokeClaudeMessages({
    max_tokens: 2048,
    system,
    messages: [
      ...convo,
      { role: "assistant", content: blocks },
      {
        role: "user",
        content: toolResults.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.toolCallId,
          content: JSON.stringify(tr.result),
        })),
      },
    ],
  });

  // deno-lint-ignore no-explicit-any
  const followText = (followUp.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");

  const events = toolResults
    .map((tr) =>
      `event: tool_result\ndata: ${JSON.stringify({ tool_name: tr.name, tool_args: tr.args, result: tr.result })}\n\n`
    )
    .join("");

  return sse(events + textChunk(followText));
}


serve(async (req) => {
  const g = await guard(req, { bucket: "alis-chat", limit: envLimit("RL_ALIS", 30) });
  if (g.response) return g.response;
  const { user, cors: corsHeaders } = g;

  const unavailable = () =>
    new Response(JSON.stringify({ error: "AI service unavailable" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    const patientContext = body?.patientContext;
    // deno-lint-ignore no-explicit-any
    let messages: any[];
    try {
      messages = varray<any>(body?.messages, { max: 50, field: "messages" });
      messages.forEach((m, i) =>
        vtext(m?.content, { max: 8000, required: true, field: `messages[${i}].content` })
      );
      vuuid(patientContext?.hospital?.id, "patientContext.hospital.id");
      vuuid(patientContext?.patient?.id, "patientContext.patient.id");
    } catch (err) {
      return badRequest(err, corsHeaders);
    }

    // BAA-only: AWS Bedrock is the single permitted vendor. Fail closed — never
    // send PHI to a non-BAA provider.
    if (!bedrockConfigured()) return unavailable();

    const context = {
      hospitalId: patientContext?.hospital?.id,
      patientId: patientContext?.patient?.id,
      userId: user.id as string | null,
    };

    let systemContent = ALIS_SYSTEM_PROMPT;
    if (patientContext) {
      systemContent += `\n\nCurrent Patient Context:\n${JSON.stringify(patientContext, null, 2)}`;
    }

    return await runBedrockChat(systemContent, messages, context, corsHeaders);
  } catch (error) {
    console.error("ALIS chat error:", error instanceof Error ? error.message : "unknown");
    return unavailable();
  }
});

