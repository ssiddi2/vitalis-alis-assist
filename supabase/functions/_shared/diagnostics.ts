/**
 * Laboratory / imaging / external-record exchange adapter layer.
 *
 * NOTHING here talks to a real reference lab, PACS, HIE or EHR. VirtualisONE is
 * not contracted, credentialed or end-to-end verified with any diagnostic or
 * exchange vendor, so every adapter fails closed unless an admin-verified
 * PRODUCTION profile with a passed end-to-end test exists. The mock adapter is
 * sandbox/TEST MODE only and never claims a message reached a vendor.
 *
 * Raw HL7 v2 / FHIR / DICOM payloads and imaging binaries are NEVER persisted:
 * only hashes, control numbers, standards metadata and PHI-minimized status.
 */

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };

export const HL7_ORM = "ORM^O01";
export const HL7_ORU = "ORU^R01";
export const FHIR_VERSION = "4.0.1";
export const US_CORE_VERSION = "6.1.0";

export type DiagCapability = "order_transmit" | "result_receive" | "study_link" | "record_query";

export interface DiagnosticProfile {
  id: string;
  kind: "lab" | "imaging" | "records_exchange";
  vendor: string;
  environment: "sandbox" | "production";
  capabilities: Record<string, boolean>;
  verification_status: string;
  last_test_result: string | null;
}

export interface DiagAdapterResult {
  status: "queued" | "sent" | "not_connected";
  reason?: string;
  vendorReference?: string;
}

export interface DiagnosticAdapter {
  vendor: string;
  send(messageType: string, correlationId: string, payloadHash: string): Promise<DiagAdapterResult>;
  /** Inbound webhook signature + replay validation. No vendor is contracted, so it always fails closed. */
  verifyWebhook(signature: string | null, rawBody: string, timestamp?: string | null): Promise<boolean>;
}

/** Sandbox/TEST MODE adapter: acknowledges the envelope, never asserts vendor delivery. */
export const mockDiagnosticAdapter: DiagnosticAdapter = {
  vendor: "mock",
  send: (_m, correlationId) =>
    Promise.resolve({ status: "queued", reason: "sandbox_mock_adapter", vendorReference: `mock:${correlationId}` }),
  verifyWebhook: () => Promise.resolve(false),
};

export function diagnosticAdapterFor(profile: DiagnosticProfile | null): DiagnosticAdapter | null {
  if (!profile) return null;
  if (profile.environment === "sandbox") return mockDiagnosticAdapter;
  return null; // no production lab/imaging/HIE vendor is contracted or implemented
}

export async function loadDiagnosticProfile(
  db: Db,
  hospitalId: string,
  kind: DiagnosticProfile["kind"],
): Promise<DiagnosticProfile | null> {
  const { data } = await db
    .from("diagnostic_vendor_profiles")
    .select("id, kind, vendor, environment, capabilities, verification_status, last_test_result")
    .eq("hospital_id", hospitalId)
    .eq("kind", kind)
    .order("environment", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DiagnosticProfile) ?? null;
}

/** Fail-closed gate. Returns a blocking reason, or null when the exchange may proceed. */
export function diagnosticGate(profile: DiagnosticProfile | null, capability: DiagCapability): string | null {
  if (!profile) return "no_vendor_profile";
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

/** Deterministic, PHI-free placer/control number derived from an id. */
export const controlNumber = (seed: string) => seed.replace(/-/g, "").slice(0, 12).toUpperCase();

/** Canonical FHIR R4 / US Core resource type for a domain. Metadata only — no payload is stored. */
export function canonicalResource(kind: "lab" | "imaging"): { resourceType: string; profile: string } {
  return kind === "lab"
    ? { resourceType: "Observation", profile: "us-core-laboratory-result-observation" }
    : { resourceType: "ImagingStudy", profile: "us-core-imagingstudy" };
}

export interface MatchCandidate {
  id: string;
  name: string | null;
  dob: string | null;
  mrn: string | null;
}

/**
 * Deterministic patient-match confidence (0..1). Never auto-accepts: the result
 * is advisory metadata for the clinician reconciliation queue.
 */
export function matchConfidence(
  incoming: { name?: string | null; dob?: string | null; mrn?: string | null },
  candidate: MatchCandidate,
): { confidence: number; basis: Record<string, boolean> } {
  const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
  const basis = {
    mrn: !!norm(incoming.mrn) && norm(incoming.mrn) === norm(candidate.mrn),
    dob: !!norm(incoming.dob) && norm(incoming.dob) === norm(candidate.dob),
    name: !!norm(incoming.name) && norm(incoming.name) === norm(candidate.name),
  };
  const confidence = Math.min(1, (basis.mrn ? 0.6 : 0) + (basis.dob ? 0.25 : 0) + (basis.name ? 0.15 : 0));
  return { confidence, basis };
}

/** Deterministic abnormal/critical interpretation from a numeric value + reference range. */
export function interpret(
  value: string | null,
  low: number | null,
  high: number | null,
  criticalLow: number | null,
  criticalHigh: number | null,
): { interpretation: string; is_abnormal: boolean; is_critical: boolean } {
  const n = value === null || value.trim() === "" ? Number.NaN : Number(value);
  if (Number.isNaN(n)) return { interpretation: "inconclusive", is_abnormal: false, is_critical: false };
  if (criticalLow !== null && n <= criticalLow) return { interpretation: "critical_low", is_abnormal: true, is_critical: true };
  if (criticalHigh !== null && n >= criticalHigh) return { interpretation: "critical_high", is_abnormal: true, is_critical: true };
  const abnormal = (low !== null && n < low) || (high !== null && n > high);
  return { interpretation: abnormal ? "abnormal" : "normal", is_abnormal: abnormal, is_critical: false };
}
