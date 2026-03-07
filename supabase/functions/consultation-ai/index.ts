import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Load shared patient context from DB
async function loadSharedContext(patientId: string): Promise<Record<string, unknown>> {
  const db = supabaseAdmin();
  const [vitals, meds, allergies, problems, imaging, labs] = await Promise.all([
    db.from("patient_vitals").select("*").eq("patient_id", patientId).maybeSingle(),
    db.from("patient_medications").select("*").eq("patient_id", patientId).eq("status", "active"),
    db.from("patient_allergies").select("*").eq("patient_id", patientId),
    db.from("patient_problems").select("*").eq("patient_id", patientId).eq("status", "active"),
    db.from("imaging_studies").select("*").eq("patient_id", patientId).order("study_date", { ascending: false }).limit(5),
    db.from("clinical_notes").select("id, note_type, status, created_at, content").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5),
  ]);

  return {
    vitals: vitals.data || null,
    medications: meds.data || [],
    allergies: allergies.data || [],
    problems: problems.data || [],
    imaging: imaging.data || [],
    recent_notes: labs.data || [],
  };
}

// Generate role-differentiated system prompts
function buildSystemPrompt(role: "primary_clinician" | "specialist", specialty: string, context: Record<string, unknown>): string {
  const base = `You are ALIS, an AI clinical intelligence participant in a consultation thread. You have full patient context and are facilitating a consultation between a primary clinician and a ${specialty} specialist.\n\nPatient Context:\n${JSON.stringify(context, null, 2)}`;

  if (role === "primary_clinician") {
    return `${base}\n\nYou are generating insights for the PRIMARY CLINICIAN. Focus on:\n- Summarizing specialist input in actionable terms\n- Highlighting how specialist recommendations integrate with current treatment plan\n- Flagging medication interactions or contraindications\n- Suggesting follow-up questions to ask the specialist`;
  }
  return `${base}\n\nYou are generating insights for the SPECIALIST (${specialty}). Focus on:\n- Presenting relevant history and data specific to ${specialty}\n- Highlighting pertinent positive/negative findings\n- Providing differential diagnosis support\n- Surfacing relevant imaging/lab trends for this specialty`;
}

// Call AI gateway
async function callAI(messages: Array<{ role: string; content: string }>, stream = false) {
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, stream }),
  });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  if (stream) return res;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, threadId, content, patientId, hospitalId, specialty, reason, consultRequestId } = await req.json();

    // Extract user from auth header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const db = supabaseAdmin();
    let userId: string | null = null;
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: { user } } = await db.auth.getUser(token);
      userId = user?.id || null;
    }

    switch (action) {
      // ── Create thread + load context + AI welcome ──
      case "create_thread": {
        if (!patientId || !hospitalId || !specialty || !reason || !userId) {
          return jsonRes({ error: "Missing required fields" }, 400);
        }

        const sharedContext = await loadSharedContext(patientId);

        const { data: thread, error } = await db.from("consultation_threads").insert({
          patient_id: patientId,
          hospital_id: hospitalId,
          primary_clinician_id: userId,
          specialty,
          reason,
          shared_context: sharedContext,
          consult_request_id: consultRequestId || null,
        }).select().single();

        if (error) throw error;

        // AI welcome message
        const welcomeContent = await callAI([
          { role: "system", content: `You are ALIS facilitating a ${specialty} consultation. Reason: ${reason}. Briefly introduce the consultation context and summarize key patient data relevant to this specialty. Be concise.` },
          { role: "system", content: `Patient context: ${JSON.stringify(sharedContext)}` },
          { role: "user", content: "Begin the consultation." },
        ]) as string;

        await db.from("consultation_messages").insert({
          thread_id: thread.id,
          sender_id: "alis",
          sender_role: "ai",
          content: welcomeContent,
        });

        // Generate initial role-differentiated insights
        const [primaryInsight, specialistInsight] = await Promise.all([
          callAI([
            { role: "system", content: buildSystemPrompt("primary_clinician", specialty, sharedContext) },
            { role: "user", content: `New consultation: ${reason}. Generate initial clinical briefing.` },
          ]) as Promise<string>,
          callAI([
            { role: "system", content: buildSystemPrompt("specialist", specialty, sharedContext) },
            { role: "user", content: `Consultation request: ${reason}. Generate specialty-specific briefing.` },
          ]) as Promise<string>,
        ]);

        await Promise.all([
          db.from("ai_intelligence_log").insert({
            thread_id: thread.id,
            target: "primary_clinician",
            insight_type: "initial_briefing",
            content: { text: primaryInsight },
            model_version: "gemini-2.5-flash",
          }),
          db.from("ai_intelligence_log").insert({
            thread_id: thread.id,
            target: "specialist",
            insight_type: "initial_briefing",
            content: { text: specialistInsight },
            model_version: "gemini-2.5-flash",
          }),
        ]);

        return jsonRes({ thread, sharedContext });
      }

      // ── Send message + AI monitoring ──
      case "send_message": {
        if (!threadId || !content || !userId) {
          return jsonRes({ error: "Missing fields" }, 400);
        }

        const { data: thread } = await db.from("consultation_threads")
          .select("*").eq("id", threadId).single();
        if (!thread) return jsonRes({ error: "Thread not found" }, 404);

        const senderRole = thread.primary_clinician_id === userId ? "primary_clinician" : "specialist";

        const { data: msg, error } = await db.from("consultation_messages").insert({
          thread_id: threadId,
          sender_id: userId,
          sender_role: senderRole,
          content,
        }).select().single();
        if (error) throw error;

        // Load thread history for AI analysis
        const { data: history } = await db.from("consultation_messages")
          .select("*").eq("thread_id", threadId).order("created_at");

        const sharedContext = thread.shared_context as Record<string, unknown>;
        const historyMessages = (history || []).map((m: { sender_role: string; content: string }) => ({
          role: m.sender_role === "ai" ? "assistant" : "user",
          content: `[${m.sender_role}]: ${m.content}`,
        }));

        // AI response in the thread
        const aiResponse = await callAI([
          { role: "system", content: `You are ALIS in a ${thread.specialty} consultation. Patient context: ${JSON.stringify(sharedContext)}. Respond to the latest message with clinical intelligence. Be concise and actionable. Only respond if you have meaningful clinical input.` },
          ...historyMessages,
        ]) as string;

        let aiMsg = null;
        if (aiResponse && aiResponse.trim().length > 10) {
          const { data } = await db.from("consultation_messages").insert({
            thread_id: threadId,
            sender_id: "alis",
            sender_role: "ai",
            content: aiResponse,
          }).select().single();
          aiMsg = data;

          // Role-specific insight regeneration
          const targetRole = senderRole === "primary_clinician" ? "specialist" : "primary_clinician";
          const insight = await callAI([
            { role: "system", content: buildSystemPrompt(targetRole as "primary_clinician" | "specialist", thread.specialty, sharedContext) },
            ...historyMessages,
            { role: "assistant", content: aiResponse },
            { role: "user", content: "Generate updated insight based on the latest exchange." },
          ]) as string;

          await db.from("ai_intelligence_log").insert({
            thread_id: threadId,
            trigger_message_id: msg.id,
            target: targetRole,
            insight_type: "conversation_update",
            content: { text: insight },
            model_version: "gemini-2.5-flash",
          });
        }

        return jsonRes({ message: msg, aiResponse: aiMsg });
      }

      // ── Generate consultation note ──
      case "generate_note": {
        if (!threadId) return jsonRes({ error: "Missing threadId" }, 400);

        const { data: thread } = await db.from("consultation_threads")
          .select("*").eq("id", threadId).single();
        if (!thread) return jsonRes({ error: "Thread not found" }, 404);

        const { data: messages } = await db.from("consultation_messages")
          .select("*").eq("thread_id", threadId).order("created_at");

        const transcript = (messages || []).map((m: { sender_role: string; content: string; created_at: string }) =>
          `[${m.created_at}] ${m.sender_role}: ${m.content}`
        ).join("\n");

        const noteContent = await callAI([
          { role: "system", content: `You are ALIS generating a formal consultation note from a ${thread.specialty} consultation thread. Output ONLY valid JSON with these exact keys: consultation_question, clinical_summary, specialist_recommendation, treatment_plan. Each value should be a detailed clinical narrative string.` },
          { role: "user", content: `Generate a consultation note from this thread:\n\nReason: ${thread.reason}\nPatient context: ${JSON.stringify(thread.shared_context)}\n\nConversation:\n${transcript}` },
        ]) as string;

        let parsed;
        try {
          // Extract JSON from potential markdown code blocks
          const jsonMatch = noteContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, noteContent];
          parsed = JSON.parse(jsonMatch[1]!.trim());
        } catch {
          parsed = {
            consultation_question: thread.reason,
            clinical_summary: noteContent,
            specialist_recommendation: "See full AI response above",
            treatment_plan: "Pending physician review",
          };
        }

        const { data: note, error } = await db.from("consultation_notes").insert({
          thread_id: threadId,
          patient_id: thread.patient_id,
          consultation_question: parsed.consultation_question,
          clinical_summary: parsed.clinical_summary,
          specialist_recommendation: parsed.specialist_recommendation,
          treatment_plan: parsed.treatment_plan,
        }).select().single();

        if (error) throw error;

        // Mark thread completed
        await db.from("consultation_threads").update({ status: "completed" }).eq("id", threadId);

        return jsonRes({ note });
      }

      // ── Refresh shared context ──
      case "refresh_context": {
        if (!threadId) return jsonRes({ error: "Missing threadId" }, 400);

        const { data: thread } = await db.from("consultation_threads")
          .select("patient_id").eq("id", threadId).single();
        if (!thread) return jsonRes({ error: "Thread not found" }, 404);

        const sharedContext = await loadSharedContext(thread.patient_id);
        await db.from("consultation_threads")
          .update({ shared_context: sharedContext }).eq("id", threadId);

        return jsonRes({ sharedContext });
      }

      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("Consultation AI error:", error);
    return jsonRes({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
