/**
 * DoseSpot Jumpstart boundary (server only).
 *
 * DoseSpot's public material describes Jumpstart as an embedded prescribing UI
 * (iframe / object / web control) whose hosts, launch/SSO signature rules,
 * headers and payload fields are supplied to a partner in the implementation
 * package. None of that is guessed here: the partner mapping is a typed
 * configuration that an administrator uploads onto the hospital's
 * `vendor_onboarding.capabilities.partner_config`, and every boundary below
 * fails closed while it is absent.
 *
 * The browser only ever receives a short-lived launch URL. Client secrets,
 * clinic secrets, tokens, signing material and raw vendor responses stay here.
 */

import { doseSpotPrescribingGate } from "./vendorAdapters.ts";
import { resolveSecret, secretRefsFor, VENDORS, type OnboardingRow } from "./vendors.ts";

/** Exact partner-supplied mapping. Every field must come from DoseSpot's package. */
export interface DoseSpotPartnerConfig {
  /** Vendor-issued host, e.g. a partner-specific Jumpstart host. HTTPS only. */
  host: string;
  /** Vendor-documented launch path, may contain {clinicId}/{clinicianId}/{patientId}. */
  launchPath: string;
  /** Vendor-documented query parameter names for the mapped identifiers. */
  paramNames: { clinicId: string; clinicianId: string; patientId?: string; signature: string; timestamp?: string };
  /** Vendor-documented signing rule. Absent = launch stays unavailable. */
  signing: { algorithm: string; secretRef: string; encoding: "hex" | "base64" } | null;
  /** Seconds a launch artifact stays valid, per the vendor contract. */
  launchTtlSeconds: number;
  /**
   * Whether the provisioned DoseSpot account/launch can reach controlled
   * substances at all. A Jumpstart session exposes whatever the vendor user can
   * do, so an "enabled" account requires individual EPCS evidence on EVERY
   * launch. If the partner package does not state the mode, the launch blocks.
   */
  controlled_substance_mode?: "vendor_disabled" | "enabled";
  /** Reference to the uploaded partner package evidence. */
  evidence_ref?: string;
  /** Independent approval of that partner package. */
  evidence_approved?: boolean;
}

export interface LaunchContext {
  clinicId: string;
  clinicianId: string;
  patientId?: string;
}

export type LaunchResult =
  | { status: "ok"; url: string; expiresAt: string }
  | { status: "blocked" | "unavailable"; reason: string };

const isConfig = (v: unknown): v is DoseSpotPartnerConfig => {
  const c = v as DoseSpotPartnerConfig | null;
  return !!c && typeof c.host === "string" && /^[a-z0-9.-]+$/i.test(c.host) &&
    typeof c.launchPath === "string" && c.launchPath.startsWith("/") &&
    !!c.paramNames && typeof c.paramNames.clinicId === "string" && typeof c.paramNames.clinicianId === "string" &&
    Number.isFinite(c.launchTtlSeconds) && c.launchTtlSeconds > 0 && c.launchTtlSeconds <= 900;
};

/** Returns the validated partner config, or the reason it cannot be used yet. */
export function partnerConfig(row: OnboardingRow | null): { config: DoseSpotPartnerConfig } | { reason: string } {
  if (!row) return { reason: "no_vendor_profile" };
  const raw = (row.capabilities ?? {})["partner_config"];
  if (!raw) return { reason: "vendor_partner_package_required" };
  if (!isConfig(raw)) return { reason: "partner_config_invalid" };
  const allowed = VENDORS.dosespot.hosts[row.environment];
  if (allowed.length && !allowed.includes(raw.host)) return { reason: "host_not_allowlisted" };
  if (!raw.signing) return { reason: "launch_signing_rule_not_configured" };
  // Only the implemented HMAC-query signing mode is supported; no scheme is invented.
  if (typeof raw.paramNames.signature !== "string" || !raw.paramNames.signature) {
    return { reason: "launch_signature_parameter_not_configured" };
  }
  if (!raw.evidence_ref || raw.evidence_approved !== true) return { reason: "partner_package_not_approved" };
  if (raw.controlled_substance_mode !== "vendor_disabled" && raw.controlled_substance_mode !== "enabled") {
    return { reason: "controlled_substance_mode_unspecified" };
  }
  return { config: raw };
}


/** Every secret reference the environment requires must resolve server-side. */
export function secretsProvisioned(row: OnboardingRow): boolean {
  const refs = secretRefsFor(VENDORS.dosespot, row.environment);
  return refs.length > 0 && refs.every((r) => row.secret_ref_names.includes(r) && !!resolveSecret(r));
}

async function sign(algorithm: string, secret: string, message: string, encoding: "hex" | "base64"): Promise<string | null> {
  const hash = { "hmac-sha256": "SHA-256", "hmac-sha512": "SHA-512" }[algorithm.toLowerCase()];
  if (!hash) return null;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash }, false, ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return encoding === "hex"
    ? [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
    : btoa(String.fromCharCode(...bytes));
}

/**
 * Build a short-lived embedded-prescribing launch URL.
 *
 * A Jumpstart session exposes whatever the provisioned DoseSpot user can do, so
 * a non-controlled launch is NOT an EPCS bypass: when the partner package says
 * controlled substances are enabled on the account, individual prescriber EPCS
 * evidence is required on every launch. VirtualisONE never collects the legal
 * signing factor — DoseSpot always does.
 */
export async function buildLaunch(
  row: OnboardingRow | null,
  ctx: LaunchContext,
  opts: { controlled: boolean; prescriberEpcsVerified?: boolean },
): Promise<LaunchResult> {
  const blocked = doseSpotPrescribingGate(row, opts.controlled, opts.prescriberEpcsVerified === true);
  if (blocked) return { status: "blocked", reason: blocked };

  const resolved = partnerConfig(row);
  if ("reason" in resolved) return { status: "unavailable", reason: resolved.reason };
  const cfg = resolved.config;

  // Policy before provisioning: a controlled-enabled account is an EPCS surface
  // even for a non-controlled launch.
  if (cfg.controlled_substance_mode === "enabled" && opts.prescriberEpcsVerified !== true) {
    return { status: "blocked", reason: "individual_epcs_evidence_required" };
  }

  if (!secretsProvisioned(row!)) return { status: "unavailable", reason: "secret_references_missing" };
  const secret = resolveSecret(cfg.signing!.secretRef);
  if (!secret) return { status: "unavailable", reason: "launch_signing_secret_not_provisioned" };


  const path = cfg.launchPath
    .replace("{clinicId}", encodeURIComponent(ctx.clinicId))
    .replace("{clinicianId}", encodeURIComponent(ctx.clinicianId))
    .replace("{patientId}", encodeURIComponent(ctx.patientId ?? ""));
  const url = new URL(`https://${cfg.host}${path}`);
  url.searchParams.set(cfg.paramNames.clinicId, ctx.clinicId);
  url.searchParams.set(cfg.paramNames.clinicianId, ctx.clinicianId);
  if (ctx.patientId && cfg.paramNames.patientId) url.searchParams.set(cfg.paramNames.patientId, ctx.patientId);

  const ts = Math.floor(Date.now() / 1000).toString();
  if (cfg.paramNames.timestamp) url.searchParams.set(cfg.paramNames.timestamp, ts);
  const signature = await sign(cfg.signing!.algorithm, secret, `${ts}.${url.pathname}${url.search}`, cfg.signing!.encoding);
  if (!signature) return { status: "unavailable", reason: "launch_signing_algorithm_unsupported" };
  url.searchParams.set(cfg.paramNames.signature, signature);


  return {
    status: "ok",
    url: url.toString(),
    expiresAt: new Date(Date.now() + cfg.launchTtlSeconds * 1000).toISOString(),
  };
}

export interface SyncSubject {
  demographicsComplete: boolean;
  allergyReviewed: boolean;
  medRecCompleted: boolean;
  prescriberNpi: string | null;
  prescriberStateAuthorized: boolean;
  encounterActive: boolean;
  patientMapped: boolean;
  prescriberMapped: boolean;
  clinicMapped: boolean;
}

/** Pre-launch synchronization: minimum-necessary data must already be current. */
export function launchReadiness(s: SyncSubject): string[] {
  const blockers: string[] = [];
  if (!s.demographicsComplete) blockers.push("patient_demographics_incomplete");
  if (!s.allergyReviewed) blockers.push("allergy_review_missing");
  if (!s.medRecCompleted) blockers.push("medication_reconciliation_missing");
  if (!s.prescriberNpi) blockers.push("prescriber_npi_missing");
  if (!s.prescriberStateAuthorized) blockers.push("prescriber_state_authority_missing");
  if (!s.encounterActive) blockers.push("no_active_encounter");
  if (!s.clinicMapped) blockers.push("clinic_identifier_not_mapped");
  if (!s.prescriberMapped) blockers.push("prescriber_identifier_not_mapped");
  if (!s.patientMapped) blockers.push("patient_identifier_not_mapped");
  return blockers;
}
