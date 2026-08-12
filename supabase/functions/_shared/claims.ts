/**
 * Clearinghouse adapter layer (X12 837/270/835).
 *
 * NOTHING here talks to a real clearinghouse or payer. VirtualisONE is not
 * contracted, credentialed or end-to-end verified with any clearinghouse, so
 * every adapter fails closed unless an admin-verified PRODUCTION profile with a
 * passed end-to-end test exists. The mock adapter is sandbox/TEST MODE only and
 * never claims a claim reached a payer. Raw X12 payloads are never persisted;
 * only hashes, control numbers and PHI-minimized status metadata are.
 */

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };

export const X12_837P_VERSION = "005010X222A1";
export const X12_270_VERSION = "005010X279A1";

export type ClaimCapability = "eligibility" | "claim_submission" | "remittance" | "claim_status";

export interface ClearinghouseProfile {
  id: string;
  vendor: string;
  environment: "sandbox" | "production";
  capabilities: Record<string, boolean>;
  verification_status: string;
  last_test_result: string | null;
}

export interface AdapterResult {
  status: "queued" | "submitted" | "not_connected";
  reason?: string;
  vendorReference?: string;
}

export interface ClaimAdapter {
  vendor: string;
  send(messageType: string, correlationId: string, payloadHash: string): Promise<AdapterResult>;
  /** Inbound webhook signature + replay validation interface. No vendor is contracted, so it always fails closed. */
  verifyWebhook(signature: string | null, rawBody: string, timestamp?: string | null): Promise<boolean>;
}

/** Sandbox/TEST MODE adapter: acknowledges the envelope, never asserts payer delivery. */
export const mockClaimAdapter: ClaimAdapter = {
  vendor: "mock",
  send: (_m, correlationId) =>
    Promise.resolve({ status: "queued", reason: "sandbox_mock_adapter", vendorReference: `mock:${correlationId}` }),
  verifyWebhook: () => Promise.resolve(false),
};

export function claimAdapterFor(profile: ClearinghouseProfile | null): ClaimAdapter | null {
  if (!profile) return null;
  if (profile.environment === "sandbox") return mockClaimAdapter;
  return null; // no production clearinghouse is contracted or implemented
}

export async function loadClearinghouseProfile(db: Db, hospitalId: string): Promise<ClearinghouseProfile | null> {
  const { data } = await db
    .from("clearinghouse_profiles")
    .select("id, vendor, environment, capabilities, verification_status, last_test_result")
    .eq("hospital_id", hospitalId)
    .order("environment", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ClearinghouseProfile) ?? null;
}

/** Fail-closed gate. Returns a blocking reason, or null when transmission may proceed. */
export function claimGate(profile: ClearinghouseProfile | null, capability: ClaimCapability): string | null {
  if (!profile) return "no_clearinghouse_profile";
  if (profile.verification_status !== "verified") return "profile_unverified";
  if (!profile.capabilities?.[capability]) return "capability_not_enabled";
  if (profile.last_test_result !== "passed") return "end_to_end_test_not_passed";
  if (profile.environment !== "production") return "sandbox_test_mode";
  return null;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Deterministic control number: stable per claim + attempt, safe to log (no PHI). */
export const controlNumber = (seed: string) => seed.replace(/-/g, "").slice(0, 9).toUpperCase();
