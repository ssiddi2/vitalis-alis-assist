/**
 * Typed launch-vendor provider interfaces.
 *
 * Each adapter reuses the existing domain models (prescriptions/erx_outbox,
 * claims/claim_outbox, diagnostic_orders/external_record_staging). None of them
 * creates a parallel clinical model, and none of them fabricates a vendor
 * endpoint: every request URL comes from the documented operation catalog in
 * `vendorEndpoints.ts`, or — for a vendor whose paths are private — from the
 * profile's `capabilities.endpoints` once the partner package is uploaded.
 */

import { gatewayFetch, GatewayError, sha256Hex } from "./gateway.ts";
import {
  PRODUCTION_READINESS_PASS, resolveSecret, secretRefsFor, vendorGate, VENDORS,
  type OnboardingRow, type VendorKey,
} from "./vendors.ts";
import {
  buildOperationUrl, HEALTH_GORILLA_TOKEN_URL, OperationError, stripX12, VENDOR_OPERATIONS,
} from "./vendorEndpoints.ts";

export interface VendorOp {
  capability: string;
  /** Documented operation key from VENDOR_OPERATIONS. */
  operation?: string;
  /** Legacy/private mapping: logical key resolved against `capabilities.endpoints`. */
  endpointKey?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  payload?: unknown;
  correlationId: string;
  idempotencyKey: string;
}

export interface VendorOpResult {
  status: "blocked" | "unavailable" | "queued" | "ok";
  reason?: string;
  vendorReference?: string;
  /** The only retry state worth persisting: safe replay for 24h. */
  idempotencyKey?: string;
  correlationId?: string;
  data?: unknown;
}

export interface VendorAdapter {
  vendor: VendorKey;
  execute(row: OnboardingRow | null, op: VendorOp): Promise<VendorOpResult>;
}

function endpointFor(row: OnboardingRow, key: string): string | null {
  const map = (row.capabilities?.endpoints ?? {}) as Record<string, string>;
  const url = map?.[key];
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

/** Resolve the absolute URL for an operation, or an unavailability reason. */
function resolveUrl(row: OnboardingRow, op: VendorOp): { url: string } | { reason: string } {
  if (op.operation) {
    const def = VENDOR_OPERATIONS[op.operation];
    if (!def || def.vendor !== row.vendor_key) return { reason: "operation_not_documented" };
    if (def.capability !== op.capability) return { reason: "capability_mismatch" };
    try {
      return {
        url: buildOperationUrl(op.operation, row.environment, {
          params: op.params, query: op.query, capabilities: row.capabilities,
        }),
      };
    } catch (err) {
      return { reason: err instanceof OperationError ? err.reason : "operation_invalid" };
    }
  }
  const url = op.endpointKey ? endpointFor(row, op.endpointKey) : null;
  return url ? { url } : { reason: "endpoint_not_mapped_from_official_schema" };
}

function secretFor(row: OnboardingRow, index = 0): string | null {
  const ref = secretRefsFor(VENDORS[row.vendor_key], row.environment)[index];
  return ref ? resolveSecret(ref) : null;
}

/**
 * DoseSpot Jumpstart — embedded, Surescripts-certified ePrescribing.
 * The live transport stays unreachable until the vendor partner package
 * (hosts, launch/SSO rules, endpoint schema, signing rules) is uploaded.
 */
export const doseSpotAdapter: VendorAdapter = {
  vendor: "dosespot",
  execute: (row, op) => {
    const blocked = vendorGate(row, op.capability, row?.environment ?? "sandbox");
    if (blocked) return Promise.resolve({ status: "blocked", reason: blocked });
    return Promise.resolve({ status: "unavailable", reason: "vendor_partner_package_required" });
  },
};

/** Controlled vs non-controlled prescribing are distinct capability gates. */
export function doseSpotPrescribingGate(row: OnboardingRow | null, controlled: boolean): string | null {
  return controlled
    ? vendorGate(row, "epcs", row?.environment ?? "sandbox") ?? "epcs_not_certified"
    : vendorGate(row, "new_rx", row?.environment ?? "sandbox");
}

/** DoseSpot / NCPDP SCRIPT event → existing prescription lifecycle status. */
export const DOSESPOT_EVENT_MAP: Record<string, string> = {
  NewRx: "transmitted",
  CancelRx: "cancelled",
  CancelRxResponse: "cancelled",
  RxRenewalRequest: "ready_for_review",
  RxChangeRequest: "ready_for_review",
  RxFill: "filled",
  PrescriptionStatus: "accepted",
};

/** A vendor callback may advance status and append events — never rewrite signed content. */
export const VENDOR_IMMUTABLE_FIELDS = [
  "sig", "quantity", "units", "route", "frequency", "days_supply", "refills",
  "medication_name", "rxcui", "signed_at", "signed_by", "prescriber_id",
] as const;

export function sanitizeVendorPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!(VENDOR_IMMUTABLE_FIELDS as readonly string[]).includes(k)) out[k] = v;
  }
  return out;
}

/** Stedi Clearinghouse — server-only JSON APIs, API key never leaves the server. */
export const stediAdapter: VendorAdapter = {
  vendor: "stedi",
  async execute(row, op) {
    const blocked = vendorGate(row, op.capability, row?.environment ?? "sandbox");
    if (blocked) return { status: "blocked", reason: blocked };
    const resolved = resolveUrl(row!, op);
    if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };
    const apiKey = secretFor(row!);
    if (!apiKey) return { status: "unavailable", reason: "secret_not_provisioned" };
    const method = VENDOR_OPERATIONS[op.operation ?? ""]?.method ?? "POST";
    try {
      const res = await gatewayFetch({
        vendor: "stedi", env: row!.environment, url: resolved.url, method,
        headers: { Authorization: `Key ${apiKey}` },
        body: method === "GET" ? undefined : op.payload,
        idempotencyKey: op.idempotencyKey, correlationId: op.correlationId,
      });
      return {
        // 409/422 are terminal vendor decisions — surfaced, never blindly retried.
        status: res.ok ? "ok" : "blocked",
        reason: res.ok ? undefined : `vendor_status_${res.status}`,
        vendorReference: await sha256Hex(`${op.correlationId}:${res.status}`),
        idempotencyKey: op.idempotencyKey,
        correlationId: op.correlationId,
        data: res.ok ? stripX12(res.json) : undefined,
      };
    } catch (err) {
      return { status: "unavailable", reason: err instanceof GatewayError ? err.reason : "vendor_unreachable" };
    }
  },
};

/** Stedi payer transaction support → provider_payer_enrollments state. Fails closed. */
export function stediEnrollmentState(transactionSupport: string | undefined | null): {
  enrollment_status: string; blocked: boolean; reason?: string;
} {
  switch ((transactionSupport ?? "").toUpperCase()) {
    case "SUPPORTED": return { enrollment_status: "supported", blocked: false };
    case "ENROLLMENT_REQUIRED": return { enrollment_status: "enrollment_required", blocked: true, reason: "ENROLLMENT_REQUIRED" };
    case "NOT_SUPPORTED": return { enrollment_status: "not_supported", blocked: true, reason: "NOT_SUPPORTED" };
    default: return { enrollment_status: "unknown", blocked: true, reason: "transaction_support_unknown" };
  }
}

export interface PayerEnrollment {
  transaction: string;
  status: string;
  provider_npi?: string;
  payer_id?: string;
}

/**
 * Production Stedi traffic additionally requires the EXACT provider/payer
 * transaction enrollment to be active, on top of onboarding verification.
 */
export function stediProductionGate(
  row: OnboardingRow | null,
  op: { capability: string; transaction: string; providerNpi: string; payerId: string },
  enrollments: PayerEnrollment[],
): string | null {
  const gate = vendorGate(row, op.capability, row?.environment ?? "sandbox");
  if (gate) return gate;
  if (row!.environment !== "production") return null;
  if (row!.last_test_result !== PRODUCTION_READINESS_PASS) return "production_readiness_test_missing";
  const active = enrollments.some((e) =>
    e.transaction === op.transaction && e.status === "active" &&
    e.provider_npi === op.providerNpi && e.payer_id === op.payerId);
  return active ? null : "payer_transaction_enrollment_inactive";
}

/** Server-memory-only OAuth token cache. Tokens are never persisted or sent to a browser. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function healthGorillaToken(row: OnboardingRow): Promise<string | null> {
  const cacheKey = `${row.hospital_id}:${row.environment}`;
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now() + 30_000) return hit.token;

  const clientId = secretFor(row, 0);
  const clientSecret = secretFor(row, 1);
  if (!clientId || !clientSecret) return null;

  const res = await gatewayFetch({
    vendor: "health_gorilla", env: row.environment,
    url: HEALTH_GORILLA_TOKEN_URL[row.environment], form: true,
    body: { grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret },
    idempotencyKey: `hg-token:${cacheKey}`, correlationId: `hg-token:${cacheKey}`,
  });
  const body = res.json as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !body?.access_token) return null;
  tokenCache.set(cacheKey, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 });
  return body.access_token;
}

/** Health Gorilla Lab Network — FHIR R4 over OAuth 2.0 client credentials. */
export const healthGorillaAdapter: VendorAdapter = {
  vendor: "health_gorilla",
  async execute(row, op) {
    const blocked = vendorGate(row, op.capability, row?.environment ?? "sandbox");
    if (blocked) return { status: "blocked", reason: blocked };
    const resolved = resolveUrl(row!, op);
    if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };
    const token = await healthGorillaToken(row!);
    if (!token) return { status: "unavailable", reason: "oauth_not_provisioned" };
    const method = VENDOR_OPERATIONS[op.operation ?? ""]?.method ?? (op.payload ? "POST" : "GET");
    try {
      const res = await gatewayFetch({
        vendor: "health_gorilla", env: row!.environment, url: resolved.url, method,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/fhir+json" },
        body: method === "GET" ? undefined : op.payload,
        idempotencyKey: op.idempotencyKey, correlationId: op.correlationId,
      });
      return {
        status: res.ok ? "ok" : "blocked",
        reason: res.ok ? undefined : `vendor_status_${res.status}`,
        correlationId: op.correlationId,
        data: res.ok ? res.json : undefined,
      };
    } catch (err) {
      return { status: "unavailable", reason: err instanceof GatewayError ? err.reason : "vendor_unreachable" };
    }
  },
};

/** Iframe/session launch stays partner-gated: no public session contract exists. */
export function healthGorillaIframeGate(row: OnboardingRow | null): string {
  const gate = vendorGate(row, "iframe_ordering", row?.environment ?? "sandbox");
  return gate ?? "iframe_session_contract_not_provisioned";
}

/**
 * An inbound result may only be reconciled when the order correlation is exact
 * and the order belongs to the receiving facility. Everything else stays staged.
 */
export function healthGorillaResultCorrelation(
  result: { basedOnOrderId?: string | null; patientId?: string | null },
  order: { id: string; patient_id: string; hospital_id: string } | null,
  facilityId: string,
): { accepted: boolean; reason?: string } {
  if (!order) return { accepted: false, reason: "unmatched_order_staged_only" };
  if (order.hospital_id !== facilityId) return { accepted: false, reason: "facility_mismatch" };
  if (result.basedOnOrderId !== order.id) return { accepted: false, reason: "order_correlation_mismatch" };
  if (result.patientId !== order.patient_id) return { accepted: false, reason: "patient_correlation_mismatch" };
  return { accepted: true };
}

/** Inbound diagnostics always land in reconciliation staging — never straight into the chart. */
export const HEALTH_GORILLA_STAGING_ONLY = true;

export const ADAPTERS: Record<VendorKey, VendorAdapter | null> = {
  dosespot: doseSpotAdapter,
  stedi: stediAdapter,
  health_gorilla: healthGorillaAdapter,
  docupdate: null, // standalone tool: never an integration target
};
