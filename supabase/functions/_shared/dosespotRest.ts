/**
 * DoseSpot RESTful API V2 contract (server only).
 *
 * SOURCE OF TRUTH
 *   "DoseSpot RESTful API Guide V2 — Jumpstart with EPCS", v1.4.0, April 2025,
 *   201 pages, SHA-256 9bed7b50…f59bf (see REST_V2_GUIDE below).
 *
 * WHAT THIS DOCUMENT IS NOT
 *   It is a REST *resource* guide. It is neither the "DoseSpot RESTful API
 *   Authentication Guide" (JWT creation, headers, rate limits) nor the
 *   Jumpstart embedded launch/SSO guide. Therefore:
 *     - no token acquisition is implemented or guessed here;
 *     - no production base URL is hardcoded — it is supplied per environment
 *       after staging Surescripts certification and must be recorded as
 *       evidence;
 *     - no embedded launch host/path/signature/iframe contract exists, so the
 *       launch surface stays blocked (see `dosespot.ts`).
 *
 * Clinic Id / User Id / Clinic Key / Subscription Key are secret REFERENCE
 * names only. No secret value, Authorization header, subscription key or raw
 * vendor response is ever logged or returned to a browser.
 */

import type { OnboardingRow } from "./vendors.ts";

export const REST_V2_GUIDE = {
  title: "DoseSpot RESTful API Guide V2 — Jumpstart with EPCS",
  version: "1.4.0",
  date: "2025-04",
  pages: 201,
  sha256: "9bed7b50eed7600c384f47bedab94c4413567360c7a1553ab35b90eb928f59bf",
  /** This guide alone can never establish production readiness. */
  establishesProductionReadiness: false,
} as const;

export type DoseSpotEnvironment = "sandbox" | "production";

/** Only auth mode the guide describes: JWT bearer + subscription key header. */
export const DOSESPOT_AUTH_MODE = "jwt_bearer_subscription_key" as const;

export interface DoseSpotRestConfig {
  /** Exact HTTPS base URL supplied by DoseSpot for this environment. */
  baseUrl: string;
  /** Exact host allowlist for this environment. Empty = fail closed. */
  hostAllowlist: string[];
  authMode: typeof DOSESPOT_AUTH_MODE;
  /** Secret REFERENCE names only — never values. */
  secretRefNames: {
    clinicId: string;
    userId: string;
    clinicKey: string;
    subscriptionKey: string;
    [extra: string]: string;
  };
  /** REST V2 resource guide evidence. */
  restGuide: { evidenceRef: string; sha256: string; approved: boolean };
  /** Separate Authentication Guide. Absent ⇒ `auth_contract_required`. */
  authGuide: {
    evidenceRef: string;
    approved: boolean;
    /** Exact subscription key header name from that guide. */
    subscriptionHeaderName: string;
    /** Exact JWT token-creation input mapping from that guide. */
    tokenMapping: Record<string, string>;
  } | null;
}

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const REF_RE = /^[A-Z][A-Z0-9_]{2,80}$/;
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Where the uploaded DoseSpot REST evidence lives on the onboarding row. */
export const REST_CAPABILITY_KEY = "dosespot_rest";

/**
 * Validate the recorded REST contract for a hospital/environment, or return the
 * exact reason it cannot be used. Blocker codes mirror the SQL readiness gates
 * 1:1 so the UI can never be greener than runtime.
 */
export function restConfig(row: OnboardingRow | null): { config: DoseSpotRestConfig } | { reason: string } {
  if (!row) return { reason: "no_vendor_profile" };
  const raw = (row.capabilities ?? {})[REST_CAPABILITY_KEY] as Partial<DoseSpotRestConfig> | undefined;
  if (!raw || typeof raw !== "object") return { reason: "rest_v2_reference_required" };

  const g = raw.restGuide;
  if (!g || typeof g !== "object" || !nonEmpty(g.evidenceRef)) return { reason: "rest_v2_reference_required" };
  if (g.sha256 !== REST_V2_GUIDE.sha256) return { reason: "rest_v2_reference_hash_mismatch" };
  if (g.approved !== true) return { reason: "rest_v2_reference_not_approved" };

  if (!nonEmpty(raw.baseUrl) || !raw.baseUrl.startsWith("https://")) return { reason: "base_url_invalid" };
  let host: string;
  try {
    const u = new URL(raw.baseUrl);
    host = u.hostname;
    if (u.search || u.hash) return { reason: "base_url_invalid" };
  } catch {
    return { reason: "base_url_invalid" };
  }
  if (!HOST_RE.test(host)) return { reason: "base_url_invalid" };
  const allow = raw.hostAllowlist;
  if (!Array.isArray(allow) || allow.length === 0) return { reason: "host_allowlist_required" };
  if (!allow.every((h) => typeof h === "string" && HOST_RE.test(h))) return { reason: "host_allowlist_invalid" };
  if (!allow.includes(host)) return { reason: "base_url_not_allowlisted" };

  if (raw.authMode !== DOSESPOT_AUTH_MODE) return { reason: "auth_mode_unsupported" };

  const refs = raw.secretRefNames;
  if (!refs || typeof refs !== "object") return { reason: "environment_secret_refs_missing" };
  for (const k of ["clinicId", "userId", "clinicKey", "subscriptionKey"] as const) {
    const ref = refs[k];
    if (!nonEmpty(ref) || !REF_RE.test(ref)) return { reason: "environment_secret_refs_missing" };
    if (!row.secret_ref_names.includes(ref)) return { reason: "environment_secret_refs_not_provisioned" };
  }

  const a = raw.authGuide;
  if (!a || typeof a !== "object") return { reason: "auth_contract_required" };
  if (!nonEmpty(a.evidenceRef) || a.approved !== true) return { reason: "auth_contract_required" };
  if (!nonEmpty(a.subscriptionHeaderName)) return { reason: "auth_contract_subscription_header_missing" };
  if (!a.tokenMapping || typeof a.tokenMapping !== "object" || Object.keys(a.tokenMapping).length === 0) {
    return { reason: "auth_contract_token_mapping_missing" };
  }

  return { config: raw as DoseSpotRestConfig };
}

/* ------------------------------------------------------------------ *
 * Sensitive endpoint denylist — never proxied, persisted or logged.
 * ------------------------------------------------------------------ */

/** PIN / OTP / TFA / credential / legal-signing material. Hard exclusion. */
export const SENSITIVE_DENYLIST = [
  "resetPin", "/pin", "sendMobileTfa", "tfaActivate", "tfaDeactivate",
  "initTfaActivate", "initTfaDeactivate", "resyncToken", "acceptAgreement",
] as const;

/** Clinician DEA *mutation* stays disabled until a credentialing workflow exists. */
export const DEA_MUTATION_DISABLED = true;

export function isDeniedPath(path: string): boolean {
  const p = path.toLowerCase();
  return SENSITIVE_DENYLIST.some((d) => p.includes(d.toLowerCase().replace(/^\//, "")));
}

/* ------------------------------------------------------------------ *
 * Route registry — guide-documented, production-relevant subset only.
 * ------------------------------------------------------------------ */

export type RestMethod = "GET" | "POST" | "PUT";

export interface RestRoute {
  method: RestMethod;
  /** Path template relative to baseUrl. `{param}` segments are encoded. */
  path: string;
  /** Read-only routes are safe once auth is configured. */
  mutating: boolean;
  /** Virtualis precondition that must hold before the call. */
  requires?: "accepted_current_med_history_consent";
}

export const DOSESPOT_ROUTES = {
  general_check: { method: "GET", path: "api/general/check", mutating: false },

  clinician_get: { method: "GET", path: "api/clinicians/{clinicianId}", mutating: false },
  clinician_registration_status: { method: "GET", path: "api/clinicians/{clinicianId}/registrationStatus", mutating: false },
  clinician_legal_agreements: { method: "GET", path: "api/clinicians/{clinicianId}/legalAgreements", mutating: false },
  clinician_dea_get: { method: "GET", path: "api/clinicians/{clinicianId}/deanumber", mutating: false },

  patient_get: { method: "GET", path: "api/patients/{patientId}", mutating: false },
  patient_search: { method: "GET", path: "api/patients/search", mutating: false },
  patient_create: { method: "POST", path: "api/patients", mutating: true },
  patient_update: { method: "PUT", path: "api/patients/{patientId}", mutating: true },
  patient_clinics: { method: "GET", path: "api/patients/{patientId}/clinics", mutating: false },
  patient_clinicians: { method: "GET", path: "api/patients/{patientId}/clinicians", mutating: false },
  patient_pharmacies: { method: "GET", path: "api/patients/{patientId}/pharmacies", mutating: false },

  patient_allergies_list: { method: "GET", path: "api/patients/{patientId}/allergies", mutating: false },
  patient_allergy_create_coded: { method: "POST", path: "api/patients/{patientId}/allergies/coded", mutating: true },
  patient_allergy_create_freetext: { method: "POST", path: "api/patients/{patientId}/allergies/freetext", mutating: true },
  patient_allergy_update: { method: "PUT", path: "api/patients/{patientId}/allergies/{patientAllergyId}", mutating: true },
  patient_no_known_allergy: { method: "POST", path: "api/patients/{patientId}/allergies/noKnownAllergy", mutating: true },

  patient_medication_history: {
    method: "GET", path: "api/patients/{patientId}/medications/history",
    mutating: false, requires: "accepted_current_med_history_consent",
  },
  /** Logs consent itself — must NOT require an already-accepted consent. */
  patient_medication_history_consent: {
    method: "POST", path: "api/patients/{patientId}/medications/history/consent",
    mutating: true,
  },

  patient_prescriptions: { method: "GET", path: "api/patients/{patientId}/prescriptions", mutating: false },
  prescription_get: { method: "GET", path: "api/patients/{patientId}/prescriptions/{prescriptionId}", mutating: false },
  prescription_log: { method: "GET", path: "api/patients/{patientId}/prescriptions/{prescriptionId}/log", mutating: false },

  notification_counts: { method: "GET", path: "api/notifications/counts", mutating: false },
  notification_errors: { method: "GET", path: "api/notifications/errors", mutating: false },

  refill_requests_pending: { method: "GET", path: "api/refills/pending", mutating: false },
  refill_requests_pending_detailed: { method: "GET", path: "api/refills/pending/detailed", mutating: false },
  rxchange_requests_pending: { method: "GET", path: "api/rxchanges/pending", mutating: false },
  rxchange_requests_pending_detailed: { method: "GET", path: "api/rxchanges/pending/detailed", mutating: false },
} as const satisfies Record<string, RestRoute>;

export type DoseSpotRouteKey = keyof typeof DOSESPOT_ROUTES;

/**
 * The guide documents prescription READS only. There is no documented REST
 * NewRx create/send operation, so direct transmission stays unavailable and no
 * NewRx payload is invented.
 */
export const REST_NEW_RX_SUPPORTED = false;

export class RestUrlError extends Error {
  constructor(public reason: string) { super(reason); }
}

/** Build an absolute REST URL. Throws a stable reason instead of guessing. */
export function buildRestUrl(
  config: DoseSpotRestConfig,
  route: DoseSpotRouteKey,
  opts: { params?: Record<string, string | number>; query?: Record<string, string | number> } = {},
): string {
  const def = DOSESPOT_ROUTES[route] as RestRoute | undefined;
  if (!def) throw new RestUrlError("route_not_documented");
  if (isDeniedPath(def.path)) throw new RestUrlError("sensitive_endpoint_denied");
  if (DEA_MUTATION_DISABLED && def.mutating && def.path.includes("deanumber")) {
    throw new RestUrlError("dea_mutation_disabled");
  }

  const path = def.path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = opts.params?.[key];
    if (v === undefined || v === null || `${v}`.trim() === "") throw new RestUrlError("path_parameter_missing");
    return encodeURIComponent(`${v}`);
  });

  const base = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  const url = new URL(path, base);
  if (!config.hostAllowlist.includes(url.hostname)) throw new RestUrlError("base_url_not_allowlisted");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, `${v}`);
  return url.toString();
}

/* ------------------------------------------------------------------ *
 * Enum modelling — unknown values always fail closed.
 * ------------------------------------------------------------------ */

const REGISTRATION_STATUSES = [
  "Pending", "RegistrationSuccess", "RegistrationError", "IDPSuccess", "IDPError",
  "TFAActivateInit", "TFAActivatedSuccess", "TFAActivatedError", "TFADeactivateInit",
  "TFADeactivatedSuccess", "TFADeactivatedError", "IDPInitializeSuccess", "N/A",
] as const;
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number] | "unknown";

/**
 * The guide's enumeration contains two literal wire-value typos. They are
 * documented values, so they are normalized to their canonical spellings.
 * Anything else still resolves to "unknown".
 */
export const REGISTRATION_STATUS_WIRE_ALIASES: Record<string, RegistrationStatus> = {
  TFAAcitvateInit: "TFAActivateInit",
  TFADectivatedSuccess: "TFADeactivatedSuccess",
};

const PRESCRIPTION_STATUSES = [
  "Entered", "Printed", "Sending", "eRxSent", "Error", "Deleted", "Requested",
  "Edited", "EpcsError", "EpcsSigned", "ReadyToSign", "PharmacyVerified",
] as const;
export type DoseSpotPrescriptionStatus = typeof PRESCRIPTION_STATUSES[number] | "unknown";

const parse = <T extends readonly string[]>(allowed: T, v: unknown): T[number] | "unknown" =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? v as T[number] : "unknown";

export const parseRegistrationStatus = (v: unknown): RegistrationStatus =>
  (typeof v === "string" && REGISTRATION_STATUS_WIRE_ALIASES[v]) || parse(REGISTRATION_STATUSES, v);
export const parsePrescriptionStatus = (v: unknown): DoseSpotPrescriptionStatus => parse(PRESCRIPTION_STATUSES, v);

/** Pharmacy ServiceLevel is a bitwise sum. */
export const SERVICE_LEVEL_BITS = {
  NewRx: 1, Refill: 2, Change: 4, RxFill: 8, Cancel: 16, MedHistory: 32,
  Eligibility: 64, ePA: 128, Resupply: 256, Census: 512, CCR: 1024, EPCS: 2048,
} as const;

export type ServiceLevelFlag = keyof typeof SERVICE_LEVEL_BITS;

/** Decode a ServiceLevel sum. Non-integers/negatives decode to no capability. */
export function parseServiceLevel(value: unknown): ServiceLevelFlag[] {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return [];
  return (Object.keys(SERVICE_LEVEL_BITS) as ServiceLevelFlag[]).filter((k) => (value & SERVICE_LEVEL_BITS[k]) !== 0);
}

export interface ClinicianCapabilitySnapshot {
  confirmed: boolean;
  active: boolean;
  accountLocked: boolean;
  epcsRequested: boolean;
  registrationStatus: RegistrationStatus;
  clinic: {
    hasNewRx: boolean; hasRefills: boolean; hasRxChange: boolean;
    hasCancel: boolean; hasRxFill: boolean; hasEpcs: boolean;
  };
}

/** Normalize a clinician response without retaining anything else from it. */
export function clinicianSnapshot(raw: Record<string, unknown> | null): ClinicianCapabilitySnapshot {
  const b = (v: unknown) => v === true;
  const c = (raw?.["Clinic"] ?? raw ?? {}) as Record<string, unknown>;
  return {
    confirmed: b(raw?.["Confirmed"]),
    active: b(raw?.["Active"]),
    accountLocked: b(raw?.["AccountLocked"]),
    epcsRequested: b(raw?.["EpcsRequested"]),
    registrationStatus: parseRegistrationStatus(raw?.["RegistrationStatus"]),
    clinic: {
      hasNewRx: b(c["HasNewRx"]), hasRefills: b(c["HasRefills"]), hasRxChange: b(c["HasRxChange"]),
      hasCancel: b(c["HasCancel"]), hasRxFill: b(c["HasRxFill"]), hasEpcs: b(c["HasEpcs"]),
    },
  };
}

/**
 * Vendor-side corroboration of individual EPCS readiness. This NEVER replaces
 * local identity-proofing certification evidence — `localEpcsEvidenceVerified`
 * remains required, and `EpcsRequested` is not enrollment completion.
 */
export function epcsCorroboration(
  s: ClinicianCapabilitySnapshot,
  localEpcsEvidenceVerified: boolean,
): { corroborated: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!s.confirmed) blockers.push("clinician_not_confirmed");
  if (!s.active) blockers.push("clinician_not_active");
  if (s.accountLocked) blockers.push("clinician_account_locked");
  if (!s.clinic.hasEpcs) blockers.push("clinic_epcs_not_enabled");
  if (s.registrationStatus !== "TFAActivatedSuccess") blockers.push("epcs_registration_incomplete");
  if (!localEpcsEvidenceVerified) blockers.push("epcs_identity_proofing_evidence_missing");
  return { corroborated: blockers.length === 0, blockers };
}

/* ------------------------------------------------------------------ *
 * Identifier correlation
 * ------------------------------------------------------------------ */

/**
 * DoseSpot numeric identifiers are environment-specific and are stored as
 * `vendor_identity_mappings`. Virtualis identifiers only ever travel in the
 * documented Encounter / NonDoseSpot* fields. No fuzzy matching, and a create
 * is never retried without an explicit reconciliation decision.
 */
export function correlationFields(v: {
  encounterId?: string | null; medicalRecordNumber?: string | null; prescriptionId?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.encounterId) out.Encounter = v.encounterId;
  if (v.medicalRecordNumber) out.NonDoseSpotMedicalRecordNumber = v.medicalRecordNumber;
  if (v.prescriptionId) out.NonDoseSpotPrescriptionId = v.prescriptionId;
  return out;
}

export const NO_FUZZY_PATIENT_MATCHING = true;

export type RestCallResult =
  | { status: "unavailable"; reason: string }
  | { status: "blocked"; reason: string };

/**
 * Token acquisition is defined in the separate Authentication Guide, which has
 * not been supplied. Every REST call therefore fails closed — no external
 * DoseSpot request is ever made from this build.
 */
export function restCall(row: OnboardingRow | null, route: DoseSpotRouteKey): RestCallResult {
  const def = DOSESPOT_ROUTES[route] as RestRoute | undefined;
  if (!def) return { status: "blocked", reason: "route_not_documented" };
  if (isDeniedPath(def.path)) return { status: "blocked", reason: "sensitive_endpoint_denied" };
  const resolved = restConfig(row);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };
  return { status: "unavailable", reason: "auth_token_acquisition_not_contracted" };
}
