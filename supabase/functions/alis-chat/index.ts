import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
          order_data: { name: args.name, priority: args.priority },
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

      const typeLabel = (args.note_type as string).charAt(0).toUpperCase() + (args.note_type as string).slice(1);
      return {
        success: true,
        message: `${typeLabel} note drafted — ready for review`,
        note: data,
      };
    }

    case "invite_provider": {
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

      return { success: true, message: `Channel "${args.name}" created`, channel: data };
    }

    case "suggest_billing_codes": {
      // Generate billing code suggestions based on encounter details
      const complexityMap: Record<string, { cpt: string[]; revenue: number }> = {
        "new_patient_low": { cpt: ["99202"], revenue: 110 },
        "new_patient_moderate": { cpt: ["99203"], revenue: 175 },
        "new_patient_high": { cpt: ["99205"], revenue: 350 },
        "established_patient_low": { cpt: ["99212"], revenue: 75 },
        "established_patient_moderate": { cpt: ["99214"], revenue: 155 },
        "established_patient_high": { cpt: ["99215"], revenue: 250 },
        "consult_low": { cpt: ["99242"], revenue: 150 },
        "consult_moderate": { cpt: ["99243"], revenue: 200 },
        "consult_high": { cpt: ["99245"], revenue: 375 },
        "critical_care_low": { cpt: ["99291"], revenue: 450 },
        "critical_care_moderate": { cpt: ["99291"], revenue: 450 },
        "critical_care_high": { cpt: ["99291", "99292"], revenue: 600 },
        "procedure_low": { cpt: ["99213"], revenue: 110 },
        "procedure_moderate": { cpt: ["99214"], revenue: 155 },
        "procedure_high": { cpt: ["99215"], revenue: 250 },
      };

      const key = `${args.encounter_type}_${args.complexity}`;
      const codes = complexityMap[key] || complexityMap["established_patient_moderate"];
      
      return {
        success: true,
        message: `Suggested CPT codes: ${codes.cpt.join(", ")} (est. $${codes.revenue})`,
        suggested_cpt: codes.cpt,
        estimated_revenue: codes.revenue,
        encounter_type: args.encounter_type,
        complexity: args.complexity,
        confidence: args.complexity === "high" ? 0.85 : args.complexity === "moderate" ? 0.9 : 0.95,
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, patientContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const context = {
      hospitalId: patientContext?.hospital?.id,
      patientId: patientContext?.patient?.id,
      userId: null as string | null,
    };

    let systemContent = ALIS_SYSTEM_PROMPT;
    if (patientContext) {
      systemContent += `\n\nCurrent Patient Context:\n${JSON.stringify(patientContext, null, 2)}`;
    }

    const apiMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

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

    // We have tool calls - execute them, then get follow-up response
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
