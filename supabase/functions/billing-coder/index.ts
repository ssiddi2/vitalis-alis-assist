import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { getCaller, userHasHospitalAccess } from "../_shared/auth.ts";
import { checkRateLimit, envLimit } from "../_shared/rateLimit.ts";
import { suggestBilling, checkDenialRisk, type SuggestedCode } from "../_shared/billing.ts";
import { badRequest, varray, venum, vtext, vuuid } from "../_shared/validate.ts";

const ENCOUNTER_TYPES = ["new_patient", "established_patient", "inpatient", "consult", "telehealth", "procedure"] as const;

const env = (k: string) => Deno.env.get(k) || "";

serve(async (req) => {
  const cors = buildCors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

    const rl = await checkRateLimit(admin, user.id, "billing-coder", {
      limit: envLimit("RL_BILLING", 30),
      windowSec: 60,
    });
    if (!rl.allowed) return json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const body = await req.json();
    let encounterSummary = "", encounterType: string | undefined;
    let hospital_id: string | undefined, note_id: string | undefined, patient_id: string | undefined;
    let inputCodes: SuggestedCode[] = [];
    try {
      encounterSummary = vtext(body?.encounterSummary, { max: 12000, field: "encounterSummary" });
      encounterType = venum(body?.encounterType, ENCOUNTER_TYPES, "encounterType");
      hospital_id = vuuid(body?.hospital_id, "hospital_id", { required: true });
      note_id = vuuid(body?.note_id, "note_id");
      patient_id = vuuid(body?.patient_id, "patient_id");
      inputCodes = body?.codes === undefined || body?.codes === null
        ? []
        : varray<SuggestedCode>(body.codes, { max: 50, field: "codes" });
    } catch (err) {
      return badRequest(err, cors);
    }
    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) return json({ error: "Forbidden" }, 403);

    let noteContent: string | undefined;
    if (note_id) {
      const { data } = await admin.from("clinical_notes").select("content").eq("id", note_id).maybeSingle();
      if (data?.content) noteContent = typeof data.content === "string" ? data.content : JSON.stringify(data.content);
    }

    let payer: string | undefined;
    if (patient_id) {
      const { data } = await admin
        .from("patient_insurance")
        .select("payer_name")
        .eq("patient_id", patient_id)
        .eq("active", true)
        .order("rank")
        .limit(1)
        .maybeSingle();
      payer = data?.payer_name ?? undefined;
    }

    const provided: SuggestedCode[] = Array.isArray(inputCodes) ? inputCodes : [];
    const suggestion = provided.length
      ? { codes: provided, emLevel: "", mdmComplexity: "" }
      : await suggestBilling({ encounterSummary, encounterType, noteContent });

    const cptCodes = suggestion.codes.filter((c) => c.type === "CPT").map((c) => c.code);
    const fees = new Map<string, number>();
    if (cptCodes.length) {
      const { data } = await admin
        .from("fee_schedule")
        .select("code, amount")
        .eq("hospital_id", hospital_id)
        .eq("active", true)
        .in("code", cptCodes);
      for (const row of data || []) fees.set(row.code, Number(row.amount));
    }

    const codes = suggestion.codes.map((c) => ({ ...c, fee: fees.get(c.code) ?? null }));
    const estimatedTotal = codes.reduce((sum, c) => sum + (c.fee || 0), 0);

    const denial = await checkDenialRisk({ codes: suggestion.codes, noteContent, payer });

    return json({
      codes,
      estimatedTotal,
      emLevel: suggestion.emLevel,
      mdmComplexity: suggestion.mdmComplexity,
      denialRisk: denial.denialRisk,
      cleanClaimProbability: denial.cleanClaimProbability,
      denialIssues: denial.issues,
    });
  } catch (e) {
    console.error("Billing coder error:", e);
    return json({ codes: [], estimatedTotal: 0, emLevel: "", mdmComplexity: "", denialRisk: null, cleanClaimProbability: null, denialIssues: [], error: "Billing analysis failed" });
  }
});
