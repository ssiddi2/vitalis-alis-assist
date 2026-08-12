import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { patientInHospital } from "../_shared/tenancy.ts";
import {
  canonicalResource, controlNumber, diagnosticAdapterFor, diagnosticGate, FHIR_VERSION,
  HL7_ORM, HL7_ORU, interpret, loadDiagnosticProfile, matchConfidence, sha256Hex, US_CORE_VERSION,
} from "../_shared/diagnostics.ts";

/**
 * Server-only diagnostic exchange path: outbound lab/imaging orders, inbound
 * result/record ingestion into clinician reconciliation staging, and acceptance
 * into the chart. Fails closed — no lab, PACS, HIE or EHR vendor is contracted,
 * so nothing is ever marked delivered and no raw payload is persisted.
 */
const ACTIONS = ["transmit_order", "ingest", "accept_staged", "readiness"] as const;

serve(async (req) => {
  const g = await guard(req, { bucket: "diagnostics-adapter", limit: envLimit("RL_DIAG", 60) });
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

    // ---------- outbound order transmission ----------
    if (action === "transmit_order" || action === "readiness") {
      let order_id: string;
      try { order_id = vuuid(body?.order_id, "order_id", { required: true })!; } catch (err) { return badRequest(err, cors); }

      const { data: order } = await admin.from("diagnostic_orders")
        .select("*").eq("id", order_id).eq("hospital_id", hospital_id).maybeSingle();
      if (!order) return json({ error: "Not found" }, 404);

      const profile = await loadDiagnosticProfile(admin, hospital_id, order.kind === "lab" ? "lab" : "imaging");
      const blocked = diagnosticGate(profile, "order_transmit");

      if (action === "readiness") {
        const { data } = await admin.rpc?.("diagnostic_order_readiness", { p_order_id: order_id }) ?? { data: null };
        return json({ blocked_reason: blocked, profile_environment: profile?.environment ?? null, readiness: data });
      }
      if (order.status !== "ready") return json({ error: "Order is not ready to transmit" }, 400);

      const correlation_id = crypto.randomUUID();
      const idempotency_key = `${order.id}:${order.lock_version}`;
      const payload_hash = await sha256Hex(JSON.stringify({
        id: order.id, code: order.code, system: order.code_system, version: order.code_version,
        kind: order.kind, priority: order.priority, placer: controlNumber(order.id),
      }));

      const { error: dup } = await admin.from("interop_outbox").insert({
        hospital_id, vendor_profile_id: profile?.id ?? null, order_id: order.id,
        message_type: order.kind === "lab" ? HL7_ORM : "FHIR:ServiceRequest",
        standard: order.kind === "lab" ? "HL7v2" : "FHIR-R4",
        standard_version: order.kind === "lab" ? "2.5.1" : FHIR_VERSION,
        correlation_id, idempotency_key, payload_hash,
        status: blocked ? "blocked" : "queued", blocked_reason: blocked,
      });
      if (dup) return json({ status: "duplicate", reason: "idempotent_replay" });

      if (blocked) {
        await admin.from("diagnostic_order_events").insert({
          order_id: order.id, hospital_id, patient_id: order.patient_id,
          event_code: "diag_order.transmission_blocked", metadata: { reason: blocked },
        });
        return json({ status: "not_connected", reason: blocked, test_mode: profile?.environment === "sandbox" });
      }

      const adapter = diagnosticAdapterFor(profile);
      await admin.from("diagnostic_orders").update({
        status: "transmission_pending", correlation_id, idempotency_key, payload_hash,
        placer_order_number: controlNumber(order.id),
        message_profile: order.kind === "lab" ? HL7_ORM : canonicalResource("imaging").profile,
        vendor_profile_id: profile?.id ?? null, lock_version: order.lock_version + 1,
      }).eq("id", order.id);

      const res = adapter ? await adapter.send(HL7_ORM, correlation_id, payload_hash) : { status: "not_connected" as const, reason: "no_adapter" };
      return json({ status: res.status, reason: res.reason, correlation_id });
    }

    // ---------- inbound ingestion → reconciliation staging (never the chart) ----------
    if (action === "ingest") {
      let message_control_id: string, resource_type: string, kind: string;
      try {
        message_control_id = vtext(body?.message_control_id, { max: 64, required: true, field: "message_control_id" });
        resource_type = vtext(body?.resource_type, { max: 40, required: true, field: "resource_type" });
        kind = venum(body?.kind, ["lab", "imaging"] as const, "kind", { required: true })!;
      } catch (err) { return badRequest(err, cors); }

      const profile = await loadDiagnosticProfile(admin, hospital_id, kind === "lab" ? "lab" : "imaging");
      if (!profile) return json({ status: "not_connected", reason: "no_vendor_profile" }, 200);
      // No vendor is contracted: only an explicitly configured sandbox profile may inject TEST MODE data.
      if (profile.environment !== "sandbox") return json({ status: "not_connected", reason: "production_ingestion_disabled" }, 200);

      const summary = {
        code: vtext(body?.code ?? "", { max: 32, field: "code" }),
        code_system: vtext(body?.code_system ?? "LOINC", { max: 16, field: "code_system" }),
        display: vtext(body?.display ?? "", { max: 160, field: "display" }),
        value_text: vtext(body?.value_text ?? "", { max: 160, field: "value_text" }),
        unit: vtext(body?.unit ?? "", { max: 24, field: "unit" }),
        reference_range: vtext(body?.reference_range ?? "", { max: 48, field: "reference_range" }),
        study_instance_uid: vtext(body?.study_instance_uid ?? "", { max: 80, field: "study_instance_uid" }),
      };
      const payload_hash = await sha256Hex(JSON.stringify({ message_control_id, ...summary }));

      const { error: replay } = await admin.from("interop_inbox").insert({
        hospital_id, vendor_profile_id: profile.id,
        message_type: kind === "lab" ? HL7_ORU : "DICOMweb:StudyMetadata",
        standard: kind === "lab" ? "HL7v2" : "DICOMweb",
        standard_version: kind === "lab" ? "2.5.1" : "PS3.18",
        message_control_id, payload_hash, signature_verified: false, outcome: "received",
      });
      if (replay) return json({ status: "replay", reason: "duplicate_message_control_id" });

      // advisory, deterministic patient match — never auto-linked
      const { data: candidates } = await admin.from("patients")
        .select("id, name, mrn").eq("hospital_id", hospital_id).limit(200);
      let best = { id: null as string | null, confidence: 0, basis: {} as Record<string, boolean> };
      for (const c of candidates ?? []) {
        const m = matchConfidence(
          { name: body?.patient_name, dob: body?.patient_dob, mrn: body?.patient_mrn },
          { id: c.id, name: c.name, dob: null, mrn: c.mrn },
        );
        if (m.confidence > best.confidence) best = { id: c.id, confidence: m.confidence, basis: m.basis };
      }

      const { data: staged } = await admin.from("external_record_staging").insert({
        hospital_id, candidate_patient_id: best.id, match_confidence: best.confidence, match_basis: best.basis,
        resource_type, fhir_profile: canonicalResource(kind as "lab" | "imaging").profile,
        source_system: profile.vendor, source_version: US_CORE_VERSION,
        provenance: { standard: kind === "lab" ? "HL7v2" : "DICOMweb", message_control_id, environment: profile.environment },
        consent_basis: vtext(body?.consent_basis ?? "treatment", { max: 120, field: "consent_basis" }),
        summary, payload_hash, signature_verified: false,
      }).select("id").single();

      await admin.from("interop_inbox").update({ outcome: "staged", processed_at: new Date().toISOString() })
        .eq("hospital_id", hospital_id).eq("message_control_id", message_control_id);

      return json({ status: "staged", staging_id: staged?.id, match_confidence: best.confidence, test_mode: true });
    }

    // ---------- clinician acceptance → chart + immutable result provenance ----------
    let staging_id: string, patient_id: string, reason: string;
    try {
      staging_id = vuuid(body?.staging_id, "staging_id", { required: true })!;
      patient_id = vuuid(body?.patient_id, "patient_id", { required: true })!;
      reason = vtext(body?.review_reason, { max: 300, required: true, field: "review_reason" });
    } catch (err) { return badRequest(err, cors); }

    if (!(await patientInHospital(admin, patient_id, hospital_id))) return json({ error: "Not found" }, 404);
    const { data: row } = await admin.from("external_record_staging")
      .select("*").eq("id", staging_id).eq("hospital_id", hospital_id).maybeSingle();
    if (!row) return json({ error: "Not found" }, 404);
    if (row.status !== "pending") return json({ error: "Already reviewed" }, 409);

    const s = row.summary ?? {};
    const kind = row.resource_type === "ImagingStudy" ? "imaging" : "lab";
    const range = String(s.reference_range ?? "").match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
    const flags = interpret(s.value_text ?? null, range ? Number(range[1]) : null, range ? Number(range[2]) : null, null, null);

    let lab_result_id: string | null = null;
    let imaging_study_id: string | null = null;
    if (kind === "lab") {
      const { data } = await admin.from("lab_results").insert({
        patient_id, hospital_id, panel: s.display ?? "External result", test_name: s.display ?? s.code,
        value: s.value_text ?? null, unit: s.unit ?? null, reference_range: s.reference_range ?? null,
        is_abnormal: flags.is_abnormal, resulted_at: new Date().toISOString(),
      }).select("id").single();
      lab_result_id = data?.id ?? null;
    } else {
      const { data } = await admin.from("imaging_studies").insert({
        patient_id, study_type: s.display ?? "External study", status: "final",
        study_date: new Date().toISOString(), study_instance_uid: s.study_instance_uid || null,
      }).select("id").single();
      imaging_study_id = data?.id ?? null;
    }

    const snapshot = { ...s, kind, source_system: row.source_system, provenance: row.provenance };
    const content_hash = await sha256Hex(JSON.stringify(snapshot));
    const { data: result } = await admin.from("diagnostic_results").insert({
      hospital_id, patient_id, kind, status: "final", version: 1,
      code: s.code || "unknown", code_system: s.code_system || "LOINC", display: s.display || "External result",
      value_text: s.value_text ?? null, unit: s.unit ?? null, reference_range: s.reference_range ?? null,
      interpretation: flags.interpretation, is_abnormal: flags.is_abnormal, is_critical: flags.is_critical,
      reported_at: new Date().toISOString(), source_system: row.source_system, source_version: row.source_version,
      provenance: row.provenance, payload_hash: row.payload_hash, signature_verified: row.signature_verified,
      study_instance_uid: s.study_instance_uid || null, imaging_study_id, lab_result_id,
    }).select("id").single();

    if (result) {
      await admin.from("diagnostic_result_versions").insert({
        result_id: result.id, hospital_id, patient_id, version: 1, status: "final",
        snapshot, content_hash, source_system: row.source_system,
      });
    }

    const { error: reviewErr } = await admin.from("external_record_staging").update({
      status: "accepted", patient_id, review_reason: reason, reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      accepted_target_table: kind === "lab" ? "lab_results" : "imaging_studies",
      accepted_target_id: lab_result_id ?? imaging_study_id,
    }).eq("id", staging_id);
    if (reviewErr) return json({ error: "Review could not be recorded" }, 400);

    await admin.from("audit_logs").insert({
      user_id: user.id, hospital_id, action_type: "approve", resource_type: "external_record_staging",
      resource_id: staging_id, patient_id,
      metadata: { event: "external_record.accepted", kind, source_system: row.source_system },
    });

    return json({ status: "accepted", result_id: result?.id ?? null, critical: flags.is_critical });
  } catch (_err) {
    return json({ error: "Request failed" }, 500);
  }
});
