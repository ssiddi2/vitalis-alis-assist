import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { guard } from "../_shared/guard.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { ownedByHospital } from "../_shared/tenancy.ts";
import { classifyControlled } from "../_shared/controlledSubstances.ts";

const ACTIONS = ["eprescribe", "lab_order"] as const;
const env = (k: string) => Deno.env.get(k) || "";

/** Audit trail: audit_action_type is a fixed enum, the precise event lives in metadata.event. */
const audit = (
  admin: SupabaseClient,
  row: {
    user_id: string; hospital_id: string; event: string;
    resource_type: string; resource_id: string; metadata?: Record<string, unknown>;
  },
) =>
  admin.from("audit_logs").insert({
    user_id: row.user_id,
    hospital_id: row.hospital_id,
    action_type: "update",
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    metadata: { event: row.event, ...(row.metadata || {}) },
  });

serve(async (req) => {
  const g = await guard(req, { bucket: "order-transmit", limit: envLimit("RL_TRANSMIT", 30) });
  if (g.response) return g.response;
  const { user, admin, cors, json } = g;

  try {
    const body = await req.json();
    let action: string | undefined, hospital_id: string | undefined;
    let prescription_id: string | undefined, order_id: string | undefined, drug_name = "";
    try {
      action = venum(body?.action, ACTIONS, "action", { required: true });
      hospital_id = vuuid(body?.hospital_id, "hospital_id", { required: true })!;
      if (action === "eprescribe") {
        prescription_id = vuuid(body?.prescription_id, "prescription_id", { required: true })!;
        drug_name = vtext(body?.drug_name, { max: 300, required: true, field: "drug_name" });
      } else {
        order_id = vuuid(body?.order_id, "order_id", { required: true })!;
      }
    } catch (err) {
      return badRequest(err, cors);
    }

    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) return json({ error: "Forbidden" }, 403);

    // PostgREST cannot join on UPDATE, so writes are scoped to this hospital's
    // patient ids — the same boundary the read-side checks enforce.
    const { data: hospPatients } = await admin.from("patients").select("id").eq("hospital_id", hospital_id!);
    const patientIdsSub = (hospPatients || []).map((p: { id: string }) => p.id);


    if (action === "eprescribe") {
      if (!(await ownedByHospital(admin, "prescriptions", prescription_id!, hospital_id!))) return json({ error: "Not found" }, 404);

      // EPCS guardrail must classify the AUTHORITATIVE drug name from the row —
      // a caller could otherwise pass a benign drug_name for a controlled Rx.
      const { data: rxRow } = await admin.from("prescriptions")
        .select("medication_name").eq("id", prescription_id!).maybeSingle();
      if (!rxRow) return json({ error: "Not found" }, 404);
      const authoritativeDrug = (rxRow.medication_name as string) || drug_name;

      const { controlled, schedule } = classifyControlled(authoritativeDrug);
      if (controlled) {
        await audit(admin, {
          user_id: user.id, hospital_id: hospital_id!, event: "rx.blocked_controlled",
          resource_type: "prescription", resource_id: prescription_id!,
          metadata: { schedule, drug_name: authoritativeDrug },
        });
        return json({ status: "blocked", reason: "controlled_substance_epcs_required", schedule });
      }

      const provider = env("ERX_PROVIDER") || "queued";
      if (provider !== "queued") {
        // Future drop-in point for a real e-Rx network (e.g. DoseSpot). Nothing is transmitted today.
        return json({ status: "error", reason: "erx_provider_not_configured" });
      }

      // No e-Rx network connected: hold at 'signed' (queued) — never mark 'sent'.
      // Re-assert the hospital scope on the write itself so the check and the
      // mutation cannot diverge (TOCTOU).
      const { data: rxWritten } = await admin.from("prescriptions")
        .update({ status: "signed" })
        .eq("id", prescription_id!)
        .in("patient_id", patientIdsSub)
        .select("id")
        .maybeSingle();
      if (!rxWritten) return json({ error: "Not found" }, 404);
      await audit(admin, {
        user_id: user.id, hospital_id: hospital_id!, event: "rx.queued",
        resource_type: "prescription", resource_id: prescription_id!, metadata: { drug_name, provider },
      });
      return json({ status: "queued" });
    }

    const provider = env("LAB_PROVIDER") || "queued";
    if (provider !== "queued") return json({ status: "error", reason: "lab_provider_not_configured" });

    const { data: order } = await admin.from("staged_orders")
      .select("order_data, patients!inner(hospital_id)")
      .eq("id", order_id!)
      .eq("patients.hospital_id", hospital_id)
      .maybeSingle();
    if (!order) return json({ error: "Not found" }, 404);

    const { data: orderWritten } = await admin.from("staged_orders").update({
      order_data: {
        ...(order.order_data as Record<string, unknown> || {}),
        transmit: { status: "queued", queued_at: new Date().toISOString(), provider },
      },
    })
      .eq("id", order_id!)
      .in("patient_id", patientIdsSub)
      .select("id")
      .maybeSingle();
    if (!orderWritten) return json({ error: "Not found" }, 404);
    await audit(admin, {
      user_id: user.id, hospital_id: hospital_id!, event: "lab.queued",
      resource_type: "staged_order", resource_id: order_id!, metadata: { provider },
    });
    return json({ status: "queued" });

  } catch (e) {
    console.error("[order-transmit]", e instanceof Error ? e.message : e);
    return json({ error: "Request failed" }, 500);
  }
});
