/**
 * DoseSpot Jumpstart embedded launch boundary (server only).
 *
 * EVIDENCE STATUS
 * The only DoseSpot document recorded for this project is the "DoseSpot RESTful
 * API Guide V2 — Jumpstart with EPCS" v1.4.0 (see `dosespotRest.ts`). That is a
 * REST *resource* guide: it does NOT define the embedded launch/SSO contract —
 * no host, path, query signature, iframe/object field or session TTL.
 *
 * A previous revision of this file constructed an HMAC query-signed launch URL.
 * That mechanism was never supported by vendor evidence and has been removed.
 * Until DoseSpot supplies the separate embedded launch/SSO guide and it is
 * recorded + independently approved, `buildLaunch` returns the stable blocker
 * `jumpstart_launch_contract_required` and no URL is ever produced.
 */

import { doseSpotPrescribingGate } from "./vendorAdapters.ts";
import { resolveSecret, secretRefsFor, VENDORS, type OnboardingRow } from "./vendors.ts";

export interface LaunchContext {
  clinicId: string;
  clinicianId: string;
  patientId?: string;
}

export type LaunchResult =
  | { status: "ok"; url: string; expiresAt: string }
  | { status: "blocked" | "unavailable"; reason: string };

/** Stable blocker surfaced to the UI while the launch/SSO guide is missing. */
export const JUMPSTART_LAUNCH_BLOCKER = "jumpstart_launch_contract_required";

/**
 * Where an approved embedded launch/SSO contract would be recorded once the
 * vendor supplies it. Presence alone is deliberately NOT enough: no launch
 * mechanism is implemented, so the boundary still fails closed.
 */
export const LAUNCH_CONTRACT_KEY = "jumpstart_launch_contract";

/** True only when an approved, vendor-sourced launch contract has been recorded. */
export function launchContractRecorded(row: OnboardingRow | null): boolean {
  const c = (row?.capabilities ?? {})[LAUNCH_CONTRACT_KEY] as
    { evidence_ref?: unknown; approved?: unknown } | undefined;
  return !!c && typeof c === "object" &&
    typeof c.evidence_ref === "string" && c.evidence_ref.trim() !== "" && c.approved === true;
}

/** Every secret reference the environment requires must resolve server-side. */
export function secretsProvisioned(row: OnboardingRow): boolean {
  const refs = secretRefsFor(VENDORS.dosespot, row.environment);
  return refs.length > 0 && refs.every((r) => row.secret_ref_names.includes(r) && !!resolveSecret(r));
}

/**
 * Embedded prescribing launch.
 *
 * Order matters: prescribing eligibility is still evaluated first so the
 * clinician sees the real clinical/vendor blocker, but even a fully eligible
 * facility cannot launch — the launch contract itself does not exist.
 */
export function buildLaunch(
  row: OnboardingRow | null,
  _ctx: LaunchContext,
  opts: { controlled: boolean; prescriberEpcsVerified?: boolean },
): Promise<LaunchResult> {
  const blocked = doseSpotPrescribingGate(row, opts.controlled, opts.prescriberEpcsVerified === true);
  if (blocked) return Promise.resolve({ status: "blocked", reason: blocked });
  return Promise.resolve({ status: "unavailable", reason: JUMPSTART_LAUNCH_BLOCKER });
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
