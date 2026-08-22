/**
 * Launch-vendor registry (DoseSpot, Stedi, Health Gorilla, DocUpdate).
 *
 * TRUTHFULNESS RULES ENCODED HERE
 * - Contract/certification status is never asserted in code. It is read from
 *   the hospital's `vendor_onboarding` evidence, and every gate fails closed
 *   until that evidence exists, is independently approved and is unexpired.
 * - Only secret REFERENCE NAMES live in the database. Values are read from the
 *   server environment at call time and never returned to a client.
 * - No private/undocumented vendor endpoint is guessed. Concrete hosts, paths,
 *   launch/signature rules and payload fields must come from the vendor's own
 *   partner package and be stored in `capabilities.partner_config` /
 *   `capabilities.endpoints`; until then the transport is unavailable.
 */


import { env } from "./env.ts";

export type VendorKey = "dosespot" | "stedi" | "health_gorilla" | "docupdate";

export type VendorState =
  | "not_contracted" | "baa_pending" | "sandbox_pending" | "sandbox_configured"
  | "certification_testing" | "production_review" | "production_verified" | "suspended";

export interface VendorDef {
  key: VendorKey;
  label: string;
  domain: "erx" | "claims" | "diagnostics" | "standalone";
  /** Documented, vendor-owned hosts. Anything else is refused (SSRF guard). */
  hosts: { sandbox: string[]; production: string[] };
  /** Secret REFERENCE names only — never values. Test and production are separate names. */
  secretRefs: { sandbox: string[]; production: string[] };
  capabilities: string[];
  /** True when the live transport requires a vendor partner package we do not have. */
  requiresPartnerPackage: boolean;
  /** True when the vendor is explicitly NOT an integration. */
  standaloneOnly?: boolean;
}

export const VENDORS: Record<VendorKey, VendorDef> = {
  dosespot: {
    key: "dosespot",
    label: "DoseSpot Jumpstart (Surescripts-certified ePrescribing)",
    domain: "erx",
    // DoseSpot issues partner-specific hosts; none are assumed.
    hosts: { sandbox: [], production: [] },
    secretRefs: {
      sandbox: ["DOSESPOT_TEST_CLIENT_ID_REF", "DOSESPOT_TEST_CLIENT_SECRET_REF", "DOSESPOT_TEST_CLINIC_ID_REF"],
      production: ["DOSESPOT_PROD_CLIENT_ID_REF", "DOSESPOT_PROD_CLIENT_SECRET_REF", "DOSESPOT_PROD_CLINIC_ID_REF"],
    },
    capabilities: ["new_rx", "cancel_rx", "rx_renewal", "rx_change", "rx_fill", "med_history", "epcs"],
    requiresPartnerPackage: true,
  },
  stedi: {
    key: "stedi",
    label: "Stedi Clearinghouse APIs",
    domain: "claims",
    hosts: {
      sandbox: ["healthcare.us.stedi.com", "enrollments.us.stedi.com", "claims.us.stedi.com"],
      production: ["healthcare.us.stedi.com", "enrollments.us.stedi.com", "claims.us.stedi.com"],
    },
    secretRefs: { sandbox: ["STEDI_TEST_API_KEY_REF"], production: ["STEDI_PROD_API_KEY_REF"] },
    capabilities: ["payer_directory", "enrollment", "eligibility_270_271", "claim_837p", "claim_status_276_277", "ack_277ca", "era_835", "attachment_275"],
    requiresPartnerPackage: false,
  },
  health_gorilla: {
    key: "health_gorilla",
    label: "Health Gorilla Lab Network",
    domain: "diagnostics",
    hosts: { sandbox: ["sandbox.healthgorilla.com"], production: ["api.healthgorilla.com"] },
    secretRefs: {
      sandbox: ["HEALTH_GORILLA_SANDBOX_CLIENT_ID_REF", "HEALTH_GORILLA_SANDBOX_CLIENT_SECRET_REF"],
      production: ["HEALTH_GORILLA_PROD_CLIENT_ID_REF", "HEALTH_GORILLA_PROD_CLIENT_SECRET_REF"],
    },
    capabilities: [
      "oauth_token", "capability_statement", "order_create", "order_read", "diagnostic_report",
      "observation", "document_reference", "org_discovery", "aoe_questionnaire", "iframe_ordering", "subscription",
    ],
    requiresPartnerPackage: false,
  },
  docupdate: {
    key: "docupdate",
    label: "DocUpdate (STANDALONE · NOT INTEGRATED · NON-CONTROLLED ONLY)",
    domain: "standalone",
    hosts: { sandbox: [], production: [] },
    secretRefs: { sandbox: [], production: [] },
    capabilities: [],
    requiresPartnerPackage: true,
    standaloneOnly: true,
  },
};

export interface OnboardingRow {
  id: string;
  hospital_id: string;
  vendor_key: VendorKey;
  environment: "sandbox" | "production";
  state: VendorState;
  capabilities: Record<string, unknown>;
  secret_ref_names: string[];
  last_test_result: string | null;
  evidence_expires_at: string | null;
}

/** Result string a passed end-to-end production-readiness test must record. */
export const PRODUCTION_READINESS_PASS = "production_readiness_passed";

/** Secret reference names for one environment. Test and production never overlap. */
export function secretRefsFor(def: VendorDef, env: "sandbox" | "production"): string[] {
  return def.secretRefs[env];
}

/**
 * Single fail-closed gate for any vendor traffic.
 * Returns a blocking reason, or null when the call may proceed.
 */
export function vendorGate(
  row: OnboardingRow | null,
  capability: string,
  expectedEnv: "sandbox" | "production",
): string | null {
  if (env("INTEGRATION_KILL_SWITCH") === "true") return "kill_switch_active";
  if (!row) return "no_vendor_profile";
  const def = VENDORS[row.vendor_key];
  if (!def) return "unknown_vendor";
  if (def.standaloneOnly) return "vendor_not_integrated";
  if (row.environment !== expectedEnv) return "environment_mismatch";
  if (row.state === "suspended") return "suspended";
  if (!def.capabilities.includes(capability)) return "capability_not_supported";
  if (row.capabilities?.[capability] !== true) return "capability_not_enabled";
  if (expectedEnv === "production") {
    if (row.state !== "production_verified") return "production_not_verified";
    if (!row.evidence_expires_at || new Date(row.evidence_expires_at) <= new Date()) return "evidence_expired";
    if (row.capabilities?.baa_verified !== true) return "baa_evidence_missing";
    if (row.capabilities?.mfa_enforced !== true) return "vendor_portal_mfa_not_enforced";
    if (row.last_test_result !== PRODUCTION_READINESS_PASS) return "production_readiness_test_missing";
  } else if (row.state === "not_contracted" || row.state === "baa_pending" || row.state === "sandbox_pending") {
    return "sandbox_not_configured";
  }
  const expected = secretRefsFor(def, expectedEnv);
  const otherEnv = expectedEnv === "production" ? "sandbox" : "production";
  if (secretRefsFor(def, otherEnv).some((r) => row.secret_ref_names.includes(r))) return "cross_environment_secret_reference";
  if (expected.some((r) => !row.secret_ref_names.includes(r))) return "secret_references_missing";
  if (def.requiresPartnerPackage) return "vendor_partner_package_required";
  return null;
}

/** Resolve a secret REFERENCE name to its server-side value. Never logged or returned. */
export function resolveSecret(refName: string): string | null {
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(refName)) return null;
  return env(refName.replace(/_REF$/, "")) || env(refName) || null;
}
