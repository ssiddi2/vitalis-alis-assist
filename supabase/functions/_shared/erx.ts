/**
 * e-Prescribing adapter layer.
 *
 * NOTHING here talks to a real pharmacy network. VirtualisONE is not connected
 * to Surescripts (or any e-Rx vendor) and is not EPCS-certified, so every
 * adapter fails closed unless an admin-verified PRODUCTION profile exists with
 * the required capability. The mock adapter exists for tests/sandbox only and
 * never claims a message reached a pharmacy.
 */

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

export interface AdapterResult {
  status: "queued" | "transmitted" | "blocked" | "not_connected";
  reason?: string;
  vendorReference?: string;
}

export interface ErxAdapter {
  vendor: string;
  send(messageType: string, correlationId: string, payloadHash: string): Promise<AdapterResult>;
  /** Signature validation interface for inbound vendor webhooks. No vendor is contracted, so this always fails closed. */
  verifyWebhook(signature: string | null, rawBody: string): Promise<boolean>;
}

/** Sandbox/test adapter: acknowledges the envelope, never asserts pharmacy delivery. */
export const mockAdapter: ErxAdapter = {
  vendor: "mock",
  send: (_m, correlationId) =>
    Promise.resolve({ status: "queued", reason: "sandbox_mock_adapter", vendorReference: `mock:${correlationId}` }),
  verifyWebhook: () => Promise.resolve(false),
};

export function adapterFor(profile: ErxProfile | null): ErxAdapter | null {
  if (!profile) return null;
  if (profile.environment === "sandbox") return mockAdapter;
  return null; // no production vendor is contracted or implemented
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

/** Fail-closed gate. Returns a blocking reason, or null when transmission may proceed. */
export function gate(profile: ErxProfile | null, capability: Capability, controlled: boolean): string | null {
  if (controlled) return "controlled_substance_epcs_required";
  if (capability === "epcs") return "epcs_disabled";
  if (!profile) return "no_integration_profile";
  if (profile.verification_status !== "verified") return "profile_unverified";
  if (!profile.capabilities?.[capability]) return "capability_not_enabled";
  if (profile.environment !== "production") return "sandbox_test_mode";
  return null;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
