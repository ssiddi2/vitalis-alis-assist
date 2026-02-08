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
- invite_provider: Send an email invitation to a new provider
- list_providers: List all providers with access to the current hospital
- create_team_channel: Create a new team communication channel

When using tools, explain what you're doing and confirm success or failure.

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
          email: {
            type: "string",
            description: "Email address of the provider to invite"
          },
          name: {
            type: "string",
            description: "Full name of the provider"
          },
          role: {
            type: "string",
            enum: ["clinician", "viewer"],
            description: "Access role for the provider"
          },
          specialty: {
            type: "string",
            description: "Clinical specialty (optional)"
          }
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
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
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
          name: {
            type: "string",
            description: "Name of the channel"
          },
          channel_type: {
            type: "string",
            enum: ["patient_care", "department", "consult"],
            description: "Type of channel"
          },
          patient_id: {
            type: "string",
            description: "Patient ID if this is a patient-specific channel (optional)"
          }
        },
        required: ["name", "channel_type"]
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

    case "invite_provider": {
      // In a real app, this would send an email via a service like Resend
      // For demo, we'll simulate the invite
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
        .select(`
          user_id,
          access_level,
          created_at
        `)
        .eq("hospital_id", context.hospitalId);

      if (error) {
        console.error("Error fetching providers:", error);
        return { success: false, message: error.message };
      }

      // Get profiles for the users
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

      return {
        success: true,
        providers,
        count: providers.length
      };
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

      // Add creator as member
      await supabase
        .from("channel_members")
        .insert({
          channel_id: data.id,
          user_id: context.userId
        });

      return {
        success: true,
        message: `Channel "${args.name}" created`,
        channel: data
      };
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
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

    // Extract context for tool execution
    const context = {
      hospitalId: patientContext?.hospital?.id,
      patientId: patientContext?.patient?.id,
      userId: null as string | null // Would come from auth in production
    };

    // Build system message with optional patient context
    let systemContent = ALIS_SYSTEM_PROMPT;
    if (patientContext) {
      systemContent += `\n\nCurrent Patient Context:\n${JSON.stringify(patientContext, null, 2)}`;
    }

    // First call - may include tool calls
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
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
