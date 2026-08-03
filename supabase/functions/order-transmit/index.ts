import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { guard } from "../_shared/guard.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
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

    if (action === "eprescribe") {
      const { controlled, schedule } = classifyControlled(drug_name);
      if (controlled) {
        await audit(admin, {
          user_id: user.id, hospital_id: hospital_id!, event: "rx.blocked_controlled",
          resource_type: "prescription", resource_id: prescription_id!, metadata: { schedule, drug_name },
        });
        return json({ status: "blocked", reason: "controlled_substance_epcs_required", schedule });
      }

      const provider = env("ERX_PROVIDER") || "queued";
      if (provider !== "queued") {
        // Future drop-in point for a real e-Rx network (e.g. DoseSpot). Nothing is transmitted today.
        return json({ status: "error", reason: "erx_provider_not_configured" });
      }

      // No e-Rx network connected: hold at 'signed' (queued) — never mark 'sent'.
      await admin.from("prescriptions").update({ status: "signed" }).eq("id", prescription_id!);
      await audit(admin, {
        user_id: user.id, hospital_id: hospital_id!, event: "rx.queued",
        resource_type: "prescription", resource_id: prescription_id!, metadata: { drug_name, provider },
      });
      return json({ status: "queued" });
    }

    const provider = env("LAB_PROVIDER") || "queued";
    if (provider !== "queued") return json({ status: "error", reason: "lab_provider_not_configured" });

    const { data: order } = await admin.from("staged_orders").select("order_data").eq("id", order_id!).maybeSingle();
    await admin.from("staged_orders").update({
      order_data: {
        ...(order?.order_data as Record<string, unknown> || {}),
        transmit: { status: "queued", queued_at: new Date().toISOString(), provider },
      },
    }).eq("id", order_id!);
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
