import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { ownedByHospital, patientInHospital } from "../_shared/tenancy.ts";
import { classifyControlled } from "../_shared/controlledSubstances.ts";
import { evaluateSafety } from "../_shared/medSafety.ts";
import { SCRIPT_VERSION, gate, loadProfile, loadVendorRow, sha256Hex } from "../_shared/erx.ts";
import { doseSpotAdapter } from "../_shared/vendorAdapters.ts";
import { buildLaunch, launchReadiness } from "../_shared/dosespot.ts";

/**
 * Server-only medication safety, e-Rx transmission, DoseSpot launch and PDMP
 * metadata path. Every branch fails closed on the hospital's authoritative
 * vendor onboarding evidence; no secret ever reaches the browser.
 */
const ACTIONS = ["safety_check", "transmit", "pdmp_query", "dosespot_launch"] as const;


serve(async (req) => {
  const g = await guard(req, { bucket: "erx-adapter", limit: envLimit("RL_ERX", 60) });
  if (g.response) return g.response;
  const { user, admin, cors, json } = g;

  try {
    const body = await req.json();
    let action: string, hospital_id: string;
    try {
      action = venum(body?.action, ACTIONS, "action", { required: true })!;
      hospital_id = vuuid(body?.hospital_id, "hospital_id", { required: true })!;
    } catch (err) {
      return badRequest(err, cors);
    }
    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) return json({ error: "Forbidden" }, 403);

    if (action === "pdmp_query") {
      let patient_id: string, state_code: string, purpose: string, legal_basis: string;
      try {
        patient_id = vuuid(body?.patient_id, "patient_id", { required: true })!;
        state_code = vtext(body?.state_code, { max: 2, required: true, field: "state_code" }).toUpperCase();
        purpose = vtext(body?.purpose, { max: 120, required: true, field: "purpose" });
        legal_basis = vtext(body?.legal_basis, { max: 120, required: true, field: "legal_basis" });
      } catch (err) {
        return badRequest(err, cors);
      }
      if (!(await patientInHospital(admin, patient_id, hospital_id))) return json({ error: "Not found" }, 404);

      // No PDMP gateway is contracted: metadata only, never a stored report.
      const { data: row } = await admin.from("pdmp_queries").insert({
        patient_id, hospital_id, requested_by: user.id, state_code, purpose, legal_basis,
        status: "unavailable", result_summary_flag: null,
      }).select("id").single();
      await admin.from("pdmp_access_events").insert({
        pdmp_query_id: row!.id, hospital_id, actor_id: user.id, event_code: "pdmp.query_attempted",
      });
      return json({ status: "unavailable", reason: "no_pdmp_gateway_configured", query_id: row!.id });
    }

    if (action === "dosespot_launch") {
      let encounter_id: string, environment: "sandbox" | "production";
      try {
        encounter_id = vuuid(body?.encounter_id, "encounter_id", { required: true })!;
        environment = venum(body?.environment ?? "production", ["sandbox", "production"] as const, "environment", { required: true })!;
      } catch (err) {
        return badRequest(err, cors);
      }
      if (!(await ownedByHospital(admin, "encounters", encounter_id, hospital_id))) return json({ error: "Not found" }, 404);

      const { data: enc } = await admin.from("encounters")
        .select("id, patient_id, provider_id, status, patient_state_code, med_rec_completed_at, allergy_review_at")
        .eq("id", encounter_id).maybeSingle();
      if (!enc) return json({ error: "Not found" }, 404);

      /** PHI-minimized launch audit on the existing encounter event model. */
      const auditLaunch = async (status: string, blockers: string[]) =>
        void await admin.from("encounter_events").insert({
          encounter_id, patient_id: enc.patient_id, hospital_id, actor_id: user.id,
          event_code: "erx.dosespot_launch_" + status,
          reason: blockers[0] ?? null,
          metadata: { vendor: "dosespot", environment, blocker_count: blockers.length, blockers: blockers.slice(0, 12) },
        });

      if (enc.provider_id !== user.id) {
        await auditLaunch("blocked", ["not_the_assigned_prescriber"]);
        return json({ status: "blocked", reason: "not_the_assigned_prescriber", blockers: ["not_the_assigned_prescriber"] });
      }

      // Server-authoritative, service-role-only encounter readiness. No client bypass.
      const { data: readiness } = await admin.rpc("obesity_prescribing_readiness", {
        p_encounter_id: encounter_id, p_controlled: false,
      });
      const gateBlockers = (readiness?.blockers ?? ["prescribing_readiness_unavailable"]) as string[];
      if (!readiness?.allowed) {
        await auditLaunch("blocked", gateBlockers);
        return json({ status: "blocked", reason: gateBlockers[0], blockers: gateBlockers });
      }

      const [{ data: patient }, { data: license }, { data: maps }, { data: epcsOk }] = await Promise.all([
        admin.from("patients").select("id, name, age, sex").eq("id", enc.patient_id).maybeSingle(),
        admin.from("provider_licenses")
          .select("npi, state_code, status, telehealth_permitted, expiration_date")
          .eq("provider_user_id", user.id).eq("hospital_id", hospital_id)
          .eq("state_code", enc.patient_state_code ?? "").eq("status", "active").maybeSingle(),
        admin.from("vendor_identity_mappings")
          .select("subject_type, subject_id, vendor_identifier")
          .eq("hospital_id", hospital_id).eq("vendor_key", "dosespot").eq("environment", environment),
        admin.rpc("dosespot_prescriber_epcs_ok", {
          p_hospital_id: hospital_id, p_user_id: user.id, p_state_code: enc.patient_state_code ?? "",
        }),
      ]);
      const mapping = (t: string, id?: string) =>
        (maps || []).find((m: { subject_type: string; subject_id: string }) =>
          m.subject_type === t && (!id || m.subject_id === id))?.vendor_identifier as string | undefined;

      const clinicId = mapping("facility");
      const clinicianId = mapping("prescriber", user.id);
      const patientRef = mapping("patient", enc.patient_id);
      const licenseCurrent = !!license &&
        license.telehealth_permitted === true &&
        (!license.expiration_date || new Date(license.expiration_date) >= new Date());

      const blockers = launchReadiness({
        demographicsComplete: !!patient?.name && patient?.age != null,
        allergyReviewed: !!enc.allergy_review_at,
        medRecCompleted: !!enc.med_rec_completed_at,
        prescriberNpi: license?.npi ?? null,
        prescriberStateAuthorized: licenseCurrent,
        encounterActive: enc.status === "in_progress" || enc.status === "checked_in",
        patientMapped: !!patientRef,
        prescriberMapped: !!clinicianId,
        clinicMapped: !!clinicId,
      });
      if (blockers.length) {
        await auditLaunch("blocked", blockers);
        return json({ status: "blocked", reason: blockers[0], blockers });
      }

      const row = await loadVendorRow(admin, hospital_id, environment);
      // A Jumpstart session inherits the vendor user's rights: when the partner
      // package says controlled substances are enabled, individual EPCS evidence
      // is required even for this non-controlled launch.
      const launch = await buildLaunch(
        row,
        { clinicId: clinicId!, clinicianId: clinicianId!, patientId: patientRef },
        { controlled: false, prescriberEpcsVerified: epcsOk === true },
      );
      const launchBlockers = "reason" in launch ? [launch.reason] : [];
      await auditLaunch(launch.status, launchBlockers);
      return launch.status === "ok"
        ? json({ status: "ok", url: launch.url, expires_at: launch.expiresAt, environment })
        : json({ ...launch, blockers: launchBlockers });

    }



    const prescription_id = (() => {
      try { return vuuid(body?.prescription_id, "prescription_id", { required: true })!; } catch { return null; }
    })();
    if (!prescription_id) return json({ error: "prescription_id is required" }, 400);
    if (!(await ownedByHospital(admin, "prescriptions", prescription_id, hospital_id))) return json({ error: "Not found" }, 404);

    const { data: rx } = await admin.from("prescriptions")
      .select("id, patient_id, medication_name, quantity, days_supply, refills, status, dea_schedule, signed_hash")
      .eq("id", prescription_id).maybeSingle();
    if (!rx) return json({ error: "Not found" }, 404);

    if (action === "safety_check") {
      const [{ data: allergies }, { data: meds }, { data: existing }] = await Promise.all([
        admin.from("patient_allergies").select("allergen, severity, reaction").eq("patient_id", rx.patient_id),
        admin.from("patient_medications").select("name").eq("patient_id", rx.patient_id).eq("status", "active"),
        admin.from("medication_safety_checks").select("detail_code").eq("prescription_id", prescription_id),
      ]);
      const seen = new Set((existing || []).map((c: { detail_code: string }) => c.detail_code));
      const checks = evaluateSafety({
        drug: rx.medication_name,
        allergies: allergies || [],
        activeMeds: meds || [],
        quantity: rx.quantity, daysSupply: rx.days_supply, refills: rx.refills,
      }).filter((c) => !seen.has(c.detail_code));

      if (checks.length) {
        await admin.from("medication_safety_checks").insert(
          checks.map((c) => ({ ...c, prescription_id, patient_id: rx.patient_id, created_by: user.id })),
        );
      }
      const { data: all } = await admin.from("medication_safety_checks")
        .select("id, check_type, severity, detail_code, message, source, source_version, checked_at")
        .eq("prescription_id", prescription_id);
      return json({ checks: all || [] });
    }

    // ---- transmit ----
    if (rx.status !== "signed") return json({ status: "blocked", reason: "prescription_not_signed" });

    const { controlled, schedule } = classifyControlled(rx.medication_name);
    const profile = await loadProfile(admin, hospital_id);
    const vendorRow = profile ? await loadVendorRow(admin, hospital_id, profile.environment) : null;
    // Individual prescriber EPCS evidence — facility booleans are never sufficient.
    const { data: rxEpcsOk } = controlled
      ? await admin.rpc("dosespot_prescriber_epcs_ok", {
        p_hospital_id: hospital_id, p_user_id: user.id, p_state_code: null,
      })
      : { data: false };
    const blocked = gate(profile, controlled ? "epcs" : "new_rx", controlled, vendorRow, rxEpcsOk === true);


    const correlationId = `${prescription_id}:${rx.signed_hash?.slice(0, 16) ?? "unsigned"}`;
    const eventId = await sha256Hex(`new_rx:${correlationId}`);
    const payloadHash = await sha256Hex(`${prescription_id}|${rx.signed_hash ?? ""}`);

    // Idempotent envelope: the same signed prescription can never be enqueued twice.
    const { data: prior } = await admin.from("erx_outbox").select("id, status, error_code").eq("event_id", eventId).maybeSingle();
    if (prior) return json({ status: prior.status === "sent" ? "transmitted" : prior.status, reason: prior.error_code ?? "already_enqueued", idempotent: true });

    await admin.from("erx_outbox").insert({
      event_id: eventId, prescription_id, hospital_id, message_type: "NewRx",
      script_version: SCRIPT_VERSION, correlation_id: correlationId, payload_hash: payloadHash,
      status: blocked ? "blocked" : "pending", error_code: blocked,
    });

    if (blocked) {
      await admin.from("prescription_events").insert({
        prescription_id, patient_id: rx.patient_id, actor_id: user.id,
        event_code: "rx.transmission_blocked", metadata: { reason: blocked, schedule: schedule ?? null },
      });
      return json({ status: "blocked", reason: blocked, schedule });
    }

    // Single authoritative vendor path — the same gate the readiness surface reports.
    const result = await doseSpotAdapter.execute(vendorRow, {
      capability: controlled ? "epcs" : "new_rx",
      correlationId, idempotencyKey: eventId, payload: { payloadHash },
    });
    await admin.from("erx_outbox").update({
      status: result.status === "ok" ? "sent" : result.status, vendor_reference: result.vendorReference ?? null,
      error_code: result.reason ?? null, updated_at: new Date().toISOString(),
    }).eq("event_id", eventId);

    return json({ status: result.status, reason: result.reason });

  } catch (e) {
    console.error("[erx-adapter]", e instanceof Error ? e.message : e);
    return json({ error: "Request failed" }, 500);
  }
});
