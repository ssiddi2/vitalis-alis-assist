import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { guard } from "../_shared/guard.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { redact, sha256Hex } from "../_shared/gateway.ts";
import { VENDORS, vendorGate, type OnboardingRow, type VendorKey } from "../_shared/vendors.ts";
import { ADAPTERS } from "../_shared/vendorAdapters.ts";

/**
 * Admin-only launch-integration control plane.
 *
 * - seed_templates: creates disabled sandbox+production profiles carrying only
 *   secret REFERENCE names.
 * - test_connection: non-PHI configuration validation against sandbox/mocks
 *   only. It never creates credentials and never touches production.
 * - export_packet: PHI-free onboarding packet for the vendor.
 *
 * Production traffic is impossible from here: every path runs `vendorGate`.
 */
const ACTIONS = ["seed_templates", "test_connection", "export_packet"] as const;
const VENDOR_KEYS = ["dosespot", "stedi", "health_gorilla", "docupdate"] as const;

const CHECKLIST = [
  "legal_entity_and_contacts", "baa_msa_dpa_executed", "security_questionnaire_returned",
  "implementation_owner_named", "sandbox_provisioned", "production_provisioned",
  "test_scripts_executed", "customer_signoff", "rollback_and_downtime_plan",
  "incident_notification_path", "data_retention_and_deletion", "exit_and_offboarding_plan",
];

const VENDOR_CHECKLIST: Record<VendorKey, string[]> = {
  dosespot: ["jumpstart_agreement", "clinic_and_clinician_provisioning", "provider_identity_proofing",
    "npi_dea_state_authority_metadata", "two_factor_enrollment_vendor_side", "surescripts_certification_matrix",
    "epcs_certification_separate", "go_live_checklist"],
  stedi: ["contract_and_pricing", "test_api_key_issued", "payer_directory_reviewed", "provider_enrollment_submitted",
    "era_835_enrollment", "eft_setup_separate_from_era", "trading_partner_testing", "production_key_issued"],
  health_gorilla: ["lab_account_provisioning", "interface_activation_per_lab", "compendium_mapping",
    "specimen_and_order_questions", "abn_and_medical_necessity", "psc_and_location_setup",
    "insurance_billing_responsibility", "critical_result_test_script", "corrected_and_cancelled_result_scripts"],
  docupdate: ["standalone_only_acknowledged", "duplicate_entry_reconciliation_workflow", "non_controlled_only_attested"],
};

serve(async (req) => {
  const g = await guard(req, { bucket: "integration-gateway", limit: envLimit("RL_INTEGRATION", 30) });
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
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    if (action === "seed_templates") {
      const rows = VENDOR_KEYS.flatMap((key) =>
        (["sandbox", "production"] as const).map((environment) => ({
          hospital_id, vendor_key: key, environment,
          state: "not_contracted",
          secret_ref_names: VENDORS[key].secretRefs[environment],
          capabilities: { endpoints: {} },
          checklist: Object.fromEntries([...CHECKLIST, ...VENDOR_CHECKLIST[key]].map((c) => [c, false])),
          next_action: VENDORS[key].standaloneOnly
            ? "Standalone tool only — no integration is planned or permitted"
            : "Execute contract + BAA, then request sandbox provisioning",
          blocker: "No signed contract/BAA on file",
        }))
      );
      const { error } = await admin.from("vendor_onboarding").upsert(rows, { onConflict: "hospital_id,vendor_key,environment", ignoreDuplicates: true });
      if (error) return json({ error: "Unable to seed vendor templates" }, 400);
      return json({ seeded: rows.length });
    }

    let vendor_key: VendorKey;
    try {
      vendor_key = venum(body?.vendor_key, VENDOR_KEYS, "vendor_key", { required: true })! as VendorKey;
    } catch (err) {
      return badRequest(err, cors);
    }

    const { data: row } = await admin
      .from("vendor_onboarding")
      .select("id, hospital_id, vendor_key, environment, state, capabilities, secret_ref_names, last_test_result, evidence_expires_at")
      .eq("hospital_id", hospital_id).eq("vendor_key", vendor_key).eq("environment", "sandbox").maybeSingle();

    if (action === "test_connection") {
      const capability = vtext(body?.capability, { max: 40, required: true, field: "capability" });
      const profile = row as OnboardingRow | null;
      const correlationId = crypto.randomUUID();
      // Sandbox only, always. A production profile is never reachable from a test.
      const blocked = vendorGate(profile, capability, "sandbox");
      let result: { status: string; reason?: string } = { status: "blocked", reason: blocked ?? "unknown" };
      if (!blocked) {
        const adapter = ADAPTERS[vendor_key];
        result = adapter
          ? await adapter.execute(profile, { capability, endpointKey: capability, correlationId, idempotencyKey: `test:${correlationId}` })
          : { status: "blocked", reason: "vendor_not_integrated" };
      }
      if (profile) {
        await admin.from("vendor_onboarding")
          .update({ last_test_at: new Date().toISOString(), last_test_result: result.status === "ok" ? "passed" : `blocked:${result.reason}` })
          .eq("id", profile.id);
        await admin.from("vendor_onboarding_events").insert({
          onboarding_id: profile.id, hospital_id, event_type: "test_connection", actor_id: user.id,
          detail: { capability, status: result.status, reason: redact(result.reason ?? ""), correlationId },
        });
      }
      return json({ ...result, environment: "sandbox", correlationId, phi: false });
    }

    // export_packet — PHI-free onboarding packet.
    const def = VENDORS[vendor_key];
    const packet = {
      generated_at: new Date().toISOString(),
      contains_phi: false,
      vendor: def.label,
      vendor_key,
      domain: def.domain,
      integration_status: "INTERNAL READINESS ONLY — no live vendor connection",
      allowlisted_hosts: def.hosts,
      secret_reference_names: def.secretRefs,  // per-environment reference names only
      capabilities_requested: def.capabilities,
      checklist: [...CHECKLIST, ...VENDOR_CHECKLIST[vendor_key]],
      standalone_only: Boolean(def.standaloneOnly),
      partner_package_required: def.requiresPartnerPackage,
      profiles: row ? [{ environment: row.environment, state: row.state, last_test_result: row.last_test_result }] : [],
    };
    return json({ packet, packet_hash: await sha256Hex(JSON.stringify(packet)) });
  } catch (err) {
    console.error("integration-gateway", redact(err instanceof Error ? err.message : err));
    return json({ error: "Request failed" }, 500);
  }
});
