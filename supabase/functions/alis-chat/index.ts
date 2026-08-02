import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { getCaller, userHasHospitalAccess } from "../_shared/auth.ts";
import { checkRateLimit, envLimit } from "../_shared/rateLimit.ts";
import { suggestBilling } from "../_shared/billing.ts";
import { badRequest, varray, vtext, vuuid } from "../_shared/validate.ts";



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
- invite_provider: Send an email invitation to a new provider
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
      name: "invite_provider",
      description: "Send an email invitation to a new provider to join the hospital system",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email address of the provider to invite" },
          name: { type: "string", description: "Full name of the provider" },
          role: { type: "string", enum: ["clinician", "viewer"], description: "Access role for the provider" },
          specialty: { type: "string", description: "Clinical specialty (optional)" }
        },
        required: ["email", "name", "role"]
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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

    case "invite_provider": {
      await logAiAction(supabase, {
        tool: "invite_provider",
        summary: `Invited ${args.email} as ${args.role}`,
        resourceType: "provider_invitation",
        context,
      });

      return {
        success: true,
        message: `Invitation sent to ${args.email} for ${args.name} as ${args.role}`,
        note: "In production, this would send an actual email invitation"
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

      const { data, error } = await supabase
        .from("team_channels")
        .insert({
          name: args.name as string,
          channel_type: args.channel_type as string,
          hospital_id: context.hospitalId,
          patient_id: args.patient_id as string || null,
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

// Helper: consume an SSE stream fully and collect tool calls + content
async function consumeStream(response: Response): Promise<{
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let content = "";
  const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const parsed = JSON.parse(jsonStr);
        const choice = parsed.choices?.[0];
        if (choice?.delta?.content) {
          content += choice.delta.content;
        }
        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsMap.has(idx)) {
              toolCallsMap.set(idx, { id: tc.id || `call_${idx}`, name: "", arguments: "" });
            }
            const existing = toolCallsMap.get(idx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          }
        }
      } catch {
        // partial JSON, ignore
      }
    }
  }

  const toolCalls = Array.from(toolCallsMap.values()).filter(tc => tc.name);
  return { content, toolCalls };
}

// ─────────────────────────────────────────────
// Anthropic (Claude) provider — isolated path
// ─────────────────────────────────────────────
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ALIS_MODEL = Deno.env.get("ALIS_MODEL") || "claude-sonnet-5";

type ChatMessage = { role: string; content: unknown };
type ToolCall = { id: string; name: string; arguments: string };

function anthropicHeaders() {
  return {
    "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };
}

/** Maps the OpenAI-format tool defs to Anthropic's tool schema. */
function toAnthropicTools(openAiTools: typeof tools) {
  return openAiTools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/** First pass (non-streaming): returns assistant text + any tool_use blocks. */
async function anthropicDetectToolCalls(
  system: string,
  messages: ChatMessage[],
): Promise<{ content: string; toolCalls: ToolCall[]; blocks: unknown[] }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: ALIS_MODEL,
      max_tokens: 2048,
      system,
      messages,
      tools: toAnthropicTools(tools),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic detect error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const blocks: Array<Record<string, unknown>> = data.content || [];
  const content = blocks.filter((b) => b.type === "text").map((b) => b.text as string).join("");
  const toolCalls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id as string, name: b.name as string, arguments: JSON.stringify(b.input ?? {}) }));
  return { content, toolCalls, blocks };
}

/** Streaming pass: emits OpenAI-style `data: {choices:[{delta:{content}}]}` SSE lines. */
async function anthropicStream(system: string, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(),
    body: JSON.stringify({ model: ALIS_MODEL, max_tokens: 2048, system, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Anthropic stream error: ${res.status} ${await res.text()}`);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            const chunk = JSON.stringify({ choices: [{ delta: { content: evt.delta.text } }] });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
        } catch {
          // partial JSON, ignore
        }
      }
    },
  });
}

/** Full Claude request flow: detect tools → authorize → execute → stream follow-up. */
async function runAnthropicChat(
  system: string,
  clientMessages: ChatMessage[],
  context: { hospitalId?: string; patientId?: string; userId?: string },
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const convo: ChatMessage[] = clientMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const first = await anthropicDetectToolCalls(system, convo);

  if (first.toolCalls.length === 0) {
    return new Response(await anthropicStream(system, convo), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (!(await userHasHospitalAccess(adminClient, context.userId!, context.hospitalId))) {
    return new Response(JSON.stringify({ error: "Forbidden: no access to this hospital" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const toolResults: Array<{ toolCallId: string; name: string; args: Record<string, unknown>; result: unknown }> = [];
  for (const tc of first.toolCalls) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.arguments); } catch { console.error("Failed to parse tool args:", tc.arguments); }
    const result = await executeTool(tc.name, args, context);
    toolResults.push({ toolCallId: tc.id, name: tc.name, args, result });
  }

  const followUp: ChatMessage[] = [
    ...convo,
    { role: "assistant", content: first.blocks },
    {
      role: "user",
      content: toolResults.map((tr) => ({
        type: "tool_result",
        tool_use_id: tr.toolCallId,
        content: JSON.stringify(tr.result),
      })),
    },
  ];

  const followUpStream = await anthropicStream(system, followUp);
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      for (const tr of toolResults) {
        const eventData = JSON.stringify({ tool_name: tr.name, tool_args: tr.args, result: tr.result });
        await writer.write(encoder.encode(`event: tool_result\ndata: ${eventData}\n\n`));
      }
      const reader = followUpStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (e) {
      console.error("Anthropic stream pipe error:", e);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getCaller(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(rateLimitClient, user.id, "alis-chat", { limit: envLimit("RL_ALIS", 30), windowSec: 60 });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const patientContext = body?.patientContext;
    let messages: Array<{ role: string; content: string }>;
    try {
      messages = varray<{ role: string; content: string }>(body?.messages, { max: 50, field: "messages" });
      messages.forEach((m, i) =>
        vtext(m?.content, { max: 8000, required: true, field: `messages[${i}].content` })
      );
      vuuid(patientContext?.hospital?.id, "patientContext.hospital.id");
      vuuid(patientContext?.patient?.id, "patientContext.patient.id");
    } catch (err) {
      return badRequest(err, corsHeaders);
    }
    

    
    const useAnthropic = !!Deno.env.get("ANTHROPIC_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!useAnthropic && !LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const context = {
      hospitalId: patientContext?.hospital?.id,
      patientId: patientContext?.patient?.id,
      userId: user.id as string | null,
    };

    let systemContent = ALIS_SYSTEM_PROMPT;
    if (patientContext) {
      systemContent += `\n\nCurrent Patient Context:\n${JSON.stringify(patientContext, null, 2)}`;
    }

    const apiMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    if (useAnthropic) {
      try {
        return await runAnthropicChat(systemContent, messages, context, corsHeaders);
      } catch (e) {
        console.warn("alis-chat: Anthropic path failed, falling back to gateway —", e instanceof Error ? e.message : e);
        if (!LOVABLE_API_KEY) throw e;
      }
    }

    // First AI call (non-streaming) to detect tool calls
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        tools,
        stream: true,
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume the first stream to check for tool calls
    const firstResult = await consumeStream(firstResponse);

    // If no tool calls, re-do with streaming directly to client
    if (firstResult.toolCalls.length === 0) {
      // Make a second streaming call without tools to get clean streaming
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: apiMessages,
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        const t = await streamResponse.text();
        console.error("Stream error:", t);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // We have tool calls - verify hospital membership before executing anything
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!(await userHasHospitalAccess(adminClient, user.id, context.hospitalId))) {
      return new Response(JSON.stringify({ error: "Forbidden: no access to this hospital" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Executing ${firstResult.toolCalls.length} tool call(s)`);

    const toolResults: Array<{ toolCallId: string; name: string; args: Record<string, unknown>; result: unknown }> = [];


    for (const tc of firstResult.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.arguments);
      } catch {
        console.error("Failed to parse tool args:", tc.arguments);
      }
      const result = await executeTool(tc.name, args, context);
      toolResults.push({ toolCallId: tc.id, name: tc.name, args, result });
      console.log(`Tool ${tc.name} result:`, JSON.stringify(result));
    }

    // Build follow-up messages with tool results
    const followUpMessages = [
      ...apiMessages,
    ];

    // Add assistant message with tool calls
    const assistantMsg: Record<string, unknown> = { role: "assistant" };
    if (firstResult.content) {
      assistantMsg.content = firstResult.content;
    }
    assistantMsg.tool_calls = firstResult.toolCalls.map(tc => ({
      id: tc.id,
      type: "function",
      function: { name: tc.name, arguments: tc.arguments },
    }));
    followUpMessages.push(assistantMsg);

    // Add tool results
    for (const tr of toolResults) {
      followUpMessages.push({
        role: "tool",
        tool_call_id: tr.toolCallId,
        content: JSON.stringify(tr.result),
      });
    }

    // Get follow-up streaming response
    const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: followUpMessages,
        stream: true,
      }),
    });

    if (!followUpResponse.ok) {
      const t = await followUpResponse.text();
      console.error("Follow-up error:", t);
      return new Response(JSON.stringify({ error: "AI service error during follow-up" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a custom stream that prepends tool_result events before the AI follow-up
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        // Send tool_result events first
        for (const tr of toolResults) {
          const eventData = JSON.stringify({
            tool_name: tr.name,
            tool_args: tr.args,
            result: tr.result,
          });
          await writer.write(encoder.encode(`event: tool_result\ndata: ${eventData}\n\n`));
        }

        // Then pipe the follow-up stream
        const reader = followUpResponse.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (e) {
        console.error("Stream pipe error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ALIS chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
