import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { patientInHospital } from "../_shared/tenancy.ts";
import { scrubClaim } from "../_shared/claimScrub.ts";
import {
  X12_270_VERSION, X12_837P_VERSION, claimAdapterFor, claimGate,
  controlNumber, loadClearinghouseProfile, sha256Hex,
} from "../_shared/claims.ts";

/**
 * Server-only revenue-cycle path: eligibility (270/271), claim scrubbing and
 * 837 submission. Fails closed — no clearinghouse is contracted, so a claim is
 * never marked as reaching a payer. No raw X12 payload is stored or returned.
 */
const ACTIONS = ["eligibility_check", "scrub", "submit"] as const;

serve(async (req) => {
  const g = await guard(req, { bucket: "claims-adapter", limit: envLimit("RL_CLAIMS", 60) });
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

    const profile = await loadClearinghouseProfile(admin, hospital_id);

    // ---------- ELIGIBILITY (X12 270 / 271) ----------
    if (action === "eligibility_check") {
      let patient_id: string, coverage_id: string | undefined;
      try {
        patient_id = vuuid(body?.patient_id, "patient_id", { required: true })!;
        coverage_id = vuuid(body?.coverage_id, "coverage_id");
      } catch (err) {
        return badRequest(err, cors);
      }
      if (!(await patientInHospital(admin, patient_id, hospital_id))) return json({ error: "Not found" }, 404);

      let payer_id: string | null = null;
      if (coverage_id) {
        const { data: cov } = await admin.from("patient_insurance")
          .select("id, payer_id").eq("id", coverage_id).eq("patient_id", patient_id).maybeSingle();
        if (!cov) return json({ error: "Not found" }, 404);
        payer_id = cov.payer_id;
      }

      const correlation_id = crypto.randomUUID();
      const blocked = claimGate(profile, "eligibility");
      const { data: row } = await admin.from("eligibility_checks").insert({
        hospital_id, patient_id, coverage_id: coverage_id ?? null, payer_id,
        transaction_type: "270", control_number: controlNumber(correlation_id),
        correlation_id, payload_hash: await sha256Hex(`${X12_270_VERSION}:${patient_id}:${coverage_id ?? ""}`),
        status: blocked ? "unavailable" : "sent", response_code: blocked,
        requested_by: user.id, service_date: new Date().toISOString().slice(0, 10),
      }).select("id, status").single();

      return json({ status: row!.status, reason: blocked, eligibility_check_id: row!.id, correlation_id });
    }

    // ---------- CLAIM-SCOPED ACTIONS ----------
    let claim_id: string;
    try {
      claim_id = vuuid(body?.claim_id, "claim_id", { required: true })!;
    } catch (err) {
      return badRequest(err, cors);
    }
    const { data: claim } = await admin.from("claims").select("*").eq("id", claim_id)
      .eq("hospital_id", hospital_id).maybeSingle();
    if (!claim) return json({ error: "Not found" }, 404);

    const [{ data: lines }, { data: dx }] = await Promise.all([
      admin.from("claim_lines").select("cpt_code, code_set, code_version, units, charge_amount, modifiers, diagnosis_pointers").eq("claim_id", claim_id),
      admin.from("encounter_diagnoses").select("icd10_code, code_set, code_version").eq("encounter_id", claim.encounter_id),
    ]);

    if (action === "scrub") {
      const findings = scrubClaim({ ...claim, lines: lines ?? [], diagnoses: dx ?? [] });
      await admin.from("claim_scrub_results").delete().eq("claim_id", claim_id);
      if (findings.length) {
        await admin.from("claim_scrub_results").insert(findings.map((f) => ({ ...f, claim_id, hospital_id })));
      }
      if (claim.status === "draft" && !findings.some((f) => f.severity === "hard")) {
        await admin.from("claims").update({ status: "scrubbed", lock_version: claim.lock_version + 1 }).eq("id", claim_id);
      }
      return json({ findings, hard: findings.filter((f) => f.severity === "hard").length });
    }

    // ---------- SUBMIT (837P) ----------
    if (claim.status !== "approved" && claim.status !== "denied") {
      return json({ status: "error", reason: "claim_not_approved" }, 409);
    }
    const correction_reason = vtext(body?.correction_reason, { max: 300, field: "correction_reason" });
    const findings = scrubClaim({ ...claim, lines: lines ?? [], diagnoses: dx ?? [] });
    if (findings.some((f) => f.severity === "hard")) {
      return json({ status: "blocked", reason: "hard_scrubber_failure" });
    }

    // Idempotency: the same claim + content hash never produces a second envelope.
    const payload_hash = await sha256Hex(JSON.stringify({ claim_id, lines, dx }));
    const event_id = `${claim_id}:${payload_hash.slice(0, 16)}`;
    const { data: existing } = await admin.from("claim_outbox").select("id, status, correlation_id")
      .eq("event_id", event_id).maybeSingle();
    if (existing) return json({ status: "duplicate", reason: "idempotent_replay", correlation_id: existing.correlation_id });

    const correlation_id = crypto.randomUUID();
    const blocked = claimGate(profile, "claim_submission");
    const adapter = claimAdapterFor(profile);
    const result = blocked || !adapter
      ? { status: "not_connected" as const, reason: blocked ?? "no_adapter" }
      : await adapter.send("837P", correlation_id, payload_hash);

    await admin.from("claims").update({
      status: "submission_pending",
      idempotency_key: event_id,
      correlation_id,
      control_number: controlNumber(correlation_id),
      correction_reason: correction_reason || claim.correction_reason,
      lock_version: claim.lock_version + 1,
    }).eq("id", claim_id);

    await admin.from("claim_outbox").insert({
      event_id, claim_id, hospital_id, message_type: "837P", x12_version: X12_837P_VERSION,
      correlation_id, payload_hash, status: result.status === "not_connected" ? "blocked" : "queued",
      vendor_reference: result.vendorReference ?? null, error_code: result.reason ?? null,
    });
    await admin.from("claim_events").insert({
      claim_id, hospital_id, actor_id: user.id, from_status: claim.status, to_status: "submission_pending",
      event_code: "claim.submission_attempted", metadata: { result: result.status, reason: result.reason ?? null },
    });

    return json({ status: result.status, reason: result.reason, correlation_id });
  } catch (e) {
    console.error("[claims-adapter]", e instanceof Error ? e.message : e);
    return json({ error: "Request failed" }, 500);
  }
});
