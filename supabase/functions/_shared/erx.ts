/**
 * e-Prescribing boundary.
 *
 * There is exactly ONE authoritative path: the hospital's `vendor_onboarding`
 * row for DoseSpot, evaluated by `vendorGate` / `doseSpotPrescribingGate`.
 * `erx_integration_profiles` remains the clinical-side capability record, but
 * it can never authorize transmission on its own — a profile that claims
 * "verified" without matching, unexpired, independently approved vendor
 * onboarding evidence is rejected as `vendor_onboarding_evidence_missing`.
 *
 * Nothing here asserts that a message reached a pharmacy, and controlled
 * substances (EPCS) are a separate gate that VirtualisONE never simulates.
 */

import { doseSpotPrescribingGate } from "./vendorAdapters.ts";
import type { OnboardingRow } from "./vendors.ts";

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };

export const SCRIPT_VERSION = "NCPDP-SCRIPT-2017071";

export type Capability = "new_rx" | "cancel" | "change" | "refill" | "med_history" | "eligibility" | "epcs";

export interface ErxProfile {
  id: string;
  vendor: string;
  environment: "sandbox" | "production";
  capabilities: Record<string, boolean>;
  epcs_enabled: boolean;
  verification_status: string;
}

export async function loadProfile(db: Db, hospitalId: string): Promise<ErxProfile | null> {
  const { data } = await db
    .from("erx_integration_profiles")
    .select("id, vendor, environment, capabilities, epcs_enabled, verification_status")
    .eq("hospital_id", hospitalId)
    .order("environment", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ErxProfile) ?? null;
}

/** The vendor onboarding row is the source of truth for what may transmit. */
export async function loadVendorRow(
  db: Db,
  hospitalId: string,
  environment: "sandbox" | "production",
): Promise<OnboardingRow | null> {
  const { data } = await db
    .from("vendor_onboarding")
    .select("id, hospital_id, vendor_key, environment, state, capabilities, secret_ref_names, last_test_result, evidence_expires_at")
    .eq("hospital_id", hospitalId)
    .eq("vendor_key", "dosespot")
    .eq("environment", environment)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OnboardingRow) ?? null;
}

/**
 * Fail-closed clinical gate. Returns a blocking reason, or null.
 * `row` is the authoritative vendor onboarding evidence; `profile` may only
 * narrow the decision further, never widen it.
 */
export function gate(
  profile: ErxProfile | null,
  capability: Capability,
  controlled: boolean,
  row: OnboardingRow | null = null,
  prescriberEpcsVerified = false,
): string | null {
  if (capability === "epcs" && !controlled) return "epcs_requires_controlled_context";
  if (!profile) return "no_integration_profile";
  if (profile.verification_status !== "verified") return "profile_unverified";
  if (!controlled && !profile.capabilities?.[capability]) return "capability_not_enabled";
  if (controlled && !profile.epcs_enabled) return "epcs_not_enabled_on_profile";
  if (!row) return "vendor_onboarding_evidence_missing";
  if (row.environment !== profile.environment) return "environment_mismatch";
  return doseSpotPrescribingGate(row, controlled, prescriberEpcsVerified);
}


export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
