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
import {
  connectionState, isBillingAuthorized, loadStediRow, normalizeEligibility,
  professionalClaimPreview, runStedi,
} from "../_shared/stediClaims.ts";

/**
 * Server-only revenue-cycle path: eligibility (270/271), claim scrubbing,
 * normalized 837P review and submission through the Stedi adapter.
 *
 * Fails closed everywhere: no vendor traffic without a passing onboarding gate,
 * no submission without an authorized billing role, an explicit human
 * attestation, a signed/locked note and complete coding. No raw X12 is built,
 * returned or persisted; no request/response body is logged.
 */
const ACTIONS = ["capabilities", "eligibility_check", "scrub", "readiness", "preview", "submit", "status_check"] as const;

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

    const [profile, stedi, canBill] = await Promise.all([
      loadClearinghouseProfile(admin, hospital_id),
      loadStediRow(admin, hospital_id),
      isBillingAuthorized(admin, user.id, hospital_id),
    ]);
    const eligibilityConn = connectionState(stedi, "eligibility_270_271");
    const claimConn = connectionState(stedi, "claim_837p");
    const requireBilling = () => (canBill ? null : json({ error: "Billing role required" }, 403));

    // ---------- CAPABILITIES (drives every UI banner and disabled state) ----------
    if (action === "capabilities") {
      return json({
        can_submit: canBill,
        can_initiate_eligibility: canBill,
        eligibility: eligibilityConn,
        claim: claimConn,
        // 275 attachments stay hidden unless the beta capability is provisioned AND active.
        attachments_enabled: stedi?.capabilities?.attachment_275 === true &&
          stedi?.capabilities?.beta_attachments === true,
      });
    }

    // ---------- ELIGIBILITY (X12 270 / 271) ----------
    if (action === "eligibility_check") {
      const denied = requireBilling();
      if (denied) return denied;
      let patient_id: string, coverage_id: string | undefined, encounter_id: string | undefined;
      try {
        patient_id = vuuid(body?.patient_id, "patient_id", { required: true })!;
        coverage_id = vuuid(body?.coverage_id, "coverage_id");
        encounter_id = vuuid(body?.encounter_id, "encounter_id");
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
      if (encounter_id) {
        const { data: enc } = await admin.from("encounters")
          .select("id").eq("id", encounter_id).eq("patient_id", patient_id).eq("hospital_id", hospital_id).maybeSingle();
        if (!enc) return json({ error: "Not found" }, 404);
      }

      const correlation_id = crypto.randomUUID();
      const legacyBlocked = claimGate(profile, "eligibility");
      let normalized = null;
      let blocked: string | null = eligibilityConn.blocked;
      if (!blocked) {
        const res = await runStedi(stedi, {
          capability: "eligibility_270_271", operation: "stedi_eligibility_check",
          payload: { controlNumber: controlNumber(correlation_id), coverageId: coverage_id ?? null },
          correlationId: correlation_id, idempotencyKey: `elig:${correlation_id}`,
        });
        if (res.status === "ok") normalized = normalizeEligibility(res.data);
        else blocked = res.reason ?? "vendor_unavailable";
      }
      if (blocked && legacyBlocked) blocked = eligibilityConn.blocked ?? legacyBlocked;

      const { data: row } = await admin.from("eligibility_checks").insert({
        hospital_id, patient_id, coverage_id: coverage_id ?? null, payer_id, encounter_id: encounter_id ?? null,
        transaction_type: "270", control_number: controlNumber(correlation_id),
        correlation_id, payload_hash: await sha256Hex(`${X12_270_VERSION}:${patient_id}:${coverage_id ?? ""}`),
        status: blocked ? "unavailable" : "sent", response_code: blocked,
        coverage_active: normalized?.coverage_active ?? null,
        copay_amount: normalized?.copay_amount ?? null,
        deductible_remaining: normalized?.deductible_remaining ?? null,
        coinsurance_percent: normalized?.coinsurance_percent ?? null,
        plan_summary: normalized
          ? { plan_begin: normalized.plan_begin, plan_end: normalized.plan_end, messages: normalized.messages }
          : {},
        responded_at: normalized ? new Date().toISOString() : null,
        requested_by: user.id, service_date: new Date().toISOString().slice(0, 10),
      }).select("id, status").single();

      return json({
        status: row!.status, reason: blocked, eligibility_check_id: row!.id, correlation_id,
        connection: eligibilityConn, benefits: normalized,
      });
    }

    // ---------- CLAIM-SCOPED ACTIONS ----------
    let claim_id: string | undefined;
    try {
      claim_id = vuuid(body?.claim_id, "claim_id");
    } catch (err) {
      return badRequest(err, cors);
    }
    // A VirtualisNote panel knows its encounter, not its claim: resolve within the tenant.
    if (!claim_id && body?.encounter_id) {
      let encounter_id: string;
      try {
        encounter_id = vuuid(body?.encounter_id, "encounter_id", { required: true })!;
      } catch (err) {
        return badRequest(err, cors);
      }
      const { data: found } = await admin.from("claims").select("id")
        .eq("encounter_id", encounter_id).eq("hospital_id", hospital_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!found) return json({ found: false, claim: null, connection: claimConn, can_submit: canBill });
      claim_id = found.id;
    }
    if (!claim_id) return badRequest(new Error("claim_id is required"), cors);

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

    // ---------- READINESS (encounter-derived checklist for VirtualisNote) ----------
    if (action === "readiness") {
      const { data: readiness } = await admin.rpc("claim_readiness", { p_claim_id: claim_id });
      const { data: note } = await admin.from("clinical_notes")
        .select("id, status, signed_at").eq("encounter_id", claim.encounter_id)
        .in("status", ["signed", "amended"]).limit(1).maybeSingle();
      const findings = scrubClaim({ ...claim, lines: lines ?? [], diagnoses: dx ?? [] });
      return json({
        found: true,
        claim: {
          id: claim.id, status: claim.status, billing_type: claim.billing_type,
          total_charge: Number(claim.total_charge), place_of_service: claim.place_of_service,
          denial_code: claim.denial_code, denial_reason: claim.denial_reason,
          submitted_at: claim.submitted_at, encounter_id: claim.encounter_id, patient_id: claim.patient_id,
        },
        readiness,
        note_signed: !!note,
        line_count: (lines ?? []).length,
        diagnosis_count: (dx ?? []).length,
        findings,
        connection: claimConn,
        can_submit: canBill,
      });
    }

    // ---------- NORMALIZED 837P PREVIEW (never raw X12) ----------
    if (action === "preview") {
      const denied = requireBilling();
      if (denied) return denied;
      const { data: payer } = claim.payer_id
        ? await admin.from("payers").select("name").eq("id", claim.payer_id).maybeSingle()
        : { data: null };
      return json({
        preview: professionalClaimPreview({
          claim, lines: lines ?? [], diagnoses: dx ?? [], payerName: payer?.name ?? null,
        }),
        connection: claimConn,
      });
    }

    // ---------- REAL-TIME CLAIM STATUS (276 / 277) ----------
    if (action === "status_check") {
      const denied = requireBilling();
      if (denied) return denied;
      const conn = connectionState(stedi, "claim_status_276_277");
      if (conn.blocked) return json({ status: "not_connected", reason: conn.blocked, connection: conn });
      const correlation_id = crypto.randomUUID();
      const res = await runStedi(stedi, {
        capability: "claim_status_276_277", operation: "stedi_claim_status",
        payload: { controlNumber: controlNumber(correlation_id), tradingPartnerClaimNumber: claim.control_number },
        correlationId: correlation_id, idempotencyKey: `status:${claim_id}:${claim.control_number ?? ""}`,
      });
      return json({ status: res.status, reason: res.reason, connection: conn, correlation_id });
    }

    // ---------- SUBMIT (837P) ----------
    const denied = requireBilling();
    if (denied) return denied;
    if (body?.attestation !== true) return json({ status: "error", reason: "attestation_required" }, 400);
    if (claim.status !== "approved" && claim.status !== "denied") {
      return json({ status: "error", reason: "claim_not_approved" }, 409);
    }
    const { data: readiness } = await admin.rpc("claim_readiness", { p_claim_id: claim_id });
    if (!(readiness as { can_approve?: boolean } | null)?.can_approve) {
      return json({ status: "blocked", reason: "claim_not_ready", blocks: (readiness as { blocks?: string[] })?.blocks ?? [] });
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
    const legacyBlocked = claimGate(profile, "claim_submission");
    const adapter = claimAdapterFor(profile);

    let result: { status: string; reason?: string; vendorReference?: string };
    if (!claimConn.blocked) {
      const { data: enrollments } = await admin.from("provider_payer_enrollments")
        .select("transaction, enrollment_status, provider_npi, payer_id")
        .eq("hospital_id", hospital_id).eq("payer_id", claim.payer_id);
      const stediRes = await runStedi(stedi, {
        capability: "claim_837p", operation: "stedi_professional_claim_submit",
        payload: professionalClaimPreview({ claim, lines: lines ?? [], diagnoses: dx ?? [] }),
        correlationId: correlation_id, idempotencyKey: event_id,
        transaction: "837P", providerNpi: claim.rendering_provider_npi ?? "", payerId: claim.payer_id ?? "",
      }, (enrollments ?? []).map((e: Record<string, unknown>) => ({
        transaction: String(e.transaction), status: String(e.enrollment_status),
        provider_npi: e.provider_npi as string, payer_id: e.payer_id as string,
      })));
      result = { status: stediRes.status === "ok" ? "submitted" : "not_connected", reason: stediRes.reason, vendorReference: stediRes.vendorReference };
    } else {
      result = legacyBlocked || !adapter
        ? { status: "not_connected", reason: claimConn.blocked ?? legacyBlocked ?? "no_adapter" }
        : await adapter.send("837P", correlation_id, payload_hash);
    }

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
      event_code: "claim.submission_attempted",
      metadata: { result: result.status, reason: result.reason ?? null, attested_by: user.id, environment: claimConn.environment },
    });
    // A refusal becomes a billing work item. It never edits the signed note and never auto-retries.
    if (result.status === "not_connected") {
      await admin.from("claim_events").insert({
        claim_id, hospital_id, actor_id: null, from_status: "submission_pending", to_status: "submission_pending",
        event_code: "claim.work_item_opened", reason: result.reason ?? "submission_blocked",
        metadata: { requires_human_review: true },
      });
    }

    return json({ status: result.status, reason: result.reason, correlation_id, connection: claimConn });
  } catch (e) {
    console.error("[claims-adapter]", e instanceof Error ? e.message : e);
    return json({ error: "Request failed" }, 500);
  }
});
