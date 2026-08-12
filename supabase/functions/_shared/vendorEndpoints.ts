/**
 * Documented vendor operation catalog.
 *
 * ONLY operations that appear in the vendor's PUBLIC official documentation are
 * listed here. Nothing is guessed: an operation that is not in this catalog has
 * no URL and therefore cannot be called. The builder is the single place that
 * turns an operation + parameters into an absolute https URL, so path traversal,
 * unapproved query keys, malformed ids and cross-environment hosts are rejected
 * before the gateway's allowlist ever sees the request.
 */

import type { VendorKey } from "./vendors.ts";

export type VendorEnv = "sandbox" | "production";

export interface VendorOperation {
  vendor: VendorKey;
  capability: string;
  method: "GET" | "POST";
  /** Absolute base per environment (scheme + host, no trailing slash). */
  base: Record<VendorEnv, string>;
  /** Path template; `{param}` placeholders are validated before interpolation. */
  path: string;
  /** Query keys a caller may supply. Anything else is refused. */
  query?: readonly string[];
  /** Query pairs the server always sets and a caller can never override. */
  fixedQuery?: Record<string, string>;
  /** application/x-www-form-urlencoded instead of JSON. */
  form?: boolean;
  /** Disabled unless `capabilities.beta_<capability> === true`. */
  beta?: boolean;
  /** Requires an explicit tenant provisioning flag in `capabilities`. */
  requiresProvisioning?: string;
}

const STEDI_HEALTHCARE = "https://healthcare.us.stedi.com";
const STEDI_ENROLLMENTS = "https://enrollments.us.stedi.com";
const STEDI_CLAIMS = "https://claims.us.stedi.com";
const stediBase = (host: string) => ({ sandbox: host, production: host });

export const HEALTH_GORILLA_HOST: Record<VendorEnv, string> = {
  sandbox: "https://sandbox.healthgorilla.com",
  production: "https://api.healthgorilla.com",
};
export const HEALTH_GORILLA_TOKEN_URL: Record<VendorEnv, string> = {
  sandbox: `${HEALTH_GORILLA_HOST.sandbox}/oauth/token`,
  production: `${HEALTH_GORILLA_HOST.production}/oauth/token`,
};
const hgFhir = {
  sandbox: `${HEALTH_GORILLA_HOST.sandbox}/fhir/R4`,
  production: `${HEALTH_GORILLA_HOST.production}/fhir/R4`,
};

export const VENDOR_OPERATIONS: Record<string, VendorOperation> = {
  // ---------- Stedi Clearinghouse (public API reference) ----------
  stedi_eligibility_check: {
    vendor: "stedi", capability: "eligibility_270_271", method: "POST",
    base: stediBase(STEDI_HEALTHCARE), path: "/2024-04-01/change/medicalnetwork/eligibility/v3",
  },
  stedi_professional_claim_submit: {
    vendor: "stedi", capability: "claim_837p", method: "POST",
    base: stediBase(STEDI_HEALTHCARE), path: "/2024-04-01/change/medicalnetwork/professionalclaims/v3/submission",
  },
  stedi_claim_status: {
    vendor: "stedi", capability: "claim_status_276_277", method: "POST",
    base: stediBase(STEDI_HEALTHCARE), path: "/2024-04-01/change/medicalnetwork/claimstatus/v2",
  },
  stedi_payer_search: {
    vendor: "stedi", capability: "payer_directory", method: "GET",
    base: stediBase(STEDI_HEALTHCARE), path: "/2024-04-01/payers/search",
    query: ["query", "transactionSupport", "pageSize", "pageToken"],
  },
  stedi_report_277: {
    vendor: "stedi", capability: "ack_277ca", method: "GET",
    base: stediBase(STEDI_HEALTHCARE), path: "/2024-04-01/change/medicalnetwork/reports/v2/{transactionId}/277",
  },
  stedi_report_835: {
    vendor: "stedi", capability: "era_835", method: "GET",
    base: stediBase(STEDI_HEALTHCARE), path: "/2024-04-01/change/medicalnetwork/reports/v2/{transactionId}/835",
  },
  stedi_enrollment_create: {
    vendor: "stedi", capability: "enrollment", method: "POST",
    base: stediBase(STEDI_ENROLLMENTS), path: "/2024-09-01/enrollments",
  },
  /** 275 attachments: BETA, disabled by default, provisioning-gated. */
  stedi_claim_attachment_upload: {
    vendor: "stedi", capability: "attachment_275", method: "POST",
    base: stediBase(STEDI_CLAIMS), path: "/2025-03-07/claim-attachments/file",
    beta: true, requiresProvisioning: "beta_attachment_275",
  },

  // ---------- Health Gorilla Lab Network (FHIR R4 / OAuth 2.0) ----------
  hg_oauth_token: {
    vendor: "health_gorilla", capability: "oauth_token", method: "POST",
    base: HEALTH_GORILLA_HOST, path: "/oauth/token", form: true,
  },
  hg_metadata: {
    vendor: "health_gorilla", capability: "capability_statement", method: "GET",
    base: hgFhir, path: "/metadata",
  },
  hg_request_group_create: {
    vendor: "health_gorilla", capability: "order_create", method: "POST",
    base: hgFhir, path: "/RequestGroup",
  },
  hg_request_group_read: {
    vendor: "health_gorilla", capability: "order_read", method: "GET",
    base: hgFhir, path: "/RequestGroup/{id}",
  },
  hg_request_group_search: {
    vendor: "health_gorilla", capability: "order_read", method: "GET",
    base: hgFhir, path: "/RequestGroup", query: ["patient"],
  },
  hg_diagnostic_report_search: {
    vendor: "health_gorilla", capability: "diagnostic_report", method: "GET",
    base: hgFhir, path: "/DiagnosticReport", query: ["based-on"],
  },
  hg_observation_search: {
    vendor: "health_gorilla", capability: "observation", method: "GET",
    base: hgFhir, path: "/Observation", query: ["based-on"],
  },
  hg_document_reference_search: {
    vendor: "health_gorilla", capability: "document_reference", method: "GET",
    base: hgFhir, path: "/DocumentReference", query: ["subject"],
    fixedQuery: { category: "laboratory" },
  },
  hg_binary_read: {
    vendor: "health_gorilla", capability: "document_reference", method: "GET",
    base: hgFhir, path: "/Binary/{id}",
  },
  /** Ordering-facility discovery: only when the tenant says discovery is provisioned. */
  hg_organization_search: {
    vendor: "health_gorilla", capability: "org_discovery", method: "GET",
    base: hgFhir, path: "/Organization",
    fixedQuery: { "ordering-enabled": "true" }, requiresProvisioning: "org_discovery_provisioned",
  },
  /** AOE questionnaires / ServiceRequest workflow: provisioning-gated. */
  hg_questionnaire_search: {
    vendor: "health_gorilla", capability: "aoe_questionnaire", method: "GET",
    base: hgFhir, path: "/Questionnaire", query: ["context"],
    requiresProvisioning: "aoe_workflow_provisioned",
  },
  hg_service_request_read: {
    vendor: "health_gorilla", capability: "aoe_questionnaire", method: "GET",
    base: hgFhir, path: "/ServiceRequest/{id}", requiresProvisioning: "aoe_workflow_provisioned",
  },
};

export class OperationError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "OperationError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** FHIR R4 id: letters, digits, hyphen, dot — max 64, no slashes or traversal. */
const FHIR_ID = /^[A-Za-z0-9\-.]{1,64}$/;

function validateParam(name: string, value: string): string {
  if (name === "transactionId") {
    if (!UUID.test(value)) throw new OperationError("invalid_transaction_id");
    return value;
  }
  if (!FHIR_ID.test(value) || value === "." || value === "..") throw new OperationError("invalid_path_parameter");
  return value;
}

export interface BuildArgs {
  params?: Record<string, string>;
  query?: Record<string, string>;
  /** Tenant capability map from the vendor_onboarding row. */
  capabilities?: Record<string, unknown>;
}

/** Resolve a catalog operation to an absolute, validated https URL. */
export function buildOperationUrl(opKey: string, env: VendorEnv, args: BuildArgs = {}): string {
  const op = VENDOR_OPERATIONS[opKey];
  if (!op) throw new OperationError("operation_not_documented");
  if (op.requiresProvisioning && args.capabilities?.[op.requiresProvisioning] !== true) {
    throw new OperationError(op.beta ? "beta_capability_disabled" : "capability_not_provisioned");
  }

  const path = op.path.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const raw = args.params?.[name];
    if (typeof raw !== "string" || !raw) throw new OperationError("missing_path_parameter");
    return encodeURIComponent(validateParam(name, raw));
  });

  const url = new URL(op.base[env] + path);
  for (const [k, v] of Object.entries(args.query ?? {})) {
    if (!op.query?.includes(k)) throw new OperationError("query_parameter_not_allowed");
    url.searchParams.set(k, v);
  }
  for (const [k, v] of Object.entries(op.fixedQuery ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Stedi may echo the raw X12 envelope. It carries member identifiers and full
 * claim content, so it is removed before anything is persisted, logged or
 * returned. Only normalized structured fields survive.
 */
const X12_KEYS = new Set(["x12", "X12", "rawX12", "raw_x12", "x12Payload", "controlNumberX12"]);

export function stripX12<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripX12) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (X12_KEYS.has(k)) continue;
      out[k] = stripX12(v);
    }
    return out as T;
  }
  return value;
}
