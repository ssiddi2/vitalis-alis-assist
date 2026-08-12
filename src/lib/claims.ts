import { supabase } from '@/integrations/supabase/client';

export type ClaimStatus =
  | 'draft' | 'scrubbed' | 'approved' | 'submission_pending' | 'submitted' | 'acknowledged'
  | 'accepted' | 'rejected' | 'adjudicated' | 'paid' | 'denied' | 'voided';

export const CLAIM_STATUS_CLASSES: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  scrubbed: 'border-slate-300 bg-slate-100 text-slate-700',
  approved: 'border-primary/30 bg-primary/10 text-primary',
  submission_pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  submitted: 'border-primary/30 bg-primary/10 text-primary',
  acknowledged: 'border-primary/30 bg-primary/10 text-primary',
  accepted: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  adjudicated: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  paid: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-red-500/40 bg-red-500/10 text-red-600',
  denied: 'border-red-500/40 bg-red-500/10 text-red-600',
  voided: 'border-slate-200 bg-slate-100 text-slate-400',
};

/** Human copy for the fail-closed clearinghouse gate — never implies a live connection. */
export const CLAIM_GATE_COPY: Record<string, string> = {
  no_clearinghouse_profile: 'Not connected — no clearinghouse profile configured',
  profile_unverified: 'Not connected — clearinghouse profile is unverified',
  capability_not_enabled: 'Not connected — capability not enabled on the profile',
  end_to_end_test_not_passed: 'Not connected — end-to-end test has not passed',
  sandbox_test_mode: 'TEST MODE — sandbox profile, nothing reaches a payer',
  no_adapter: 'Not connected — no clearinghouse adapter is contracted',
  hard_scrubber_failure: 'Blocked — unresolved hard scrubber failure',
  idempotent_replay: 'Already submitted — duplicate suppressed',
};

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('claims-adapter', { body: payload });
  if (error) throw new Error(error.message);
  return data as T;
}

export const checkEligibility = (hospital_id: string, patient_id: string, coverage_id?: string) =>
  call<{ status: string; reason?: string; eligibility_check_id: string }>({
    action: 'eligibility_check', hospital_id, patient_id, coverage_id,
  });

export const scrubClaimRemote = (hospital_id: string, claim_id: string) =>
  call<{ findings: Array<{ rule_code: string; severity: string; message: string }>; hard: number }>({
    action: 'scrub', hospital_id, claim_id,
  });

export const submitClaim = (hospital_id: string, claim_id: string, correction_reason?: string) =>
  call<{ status: string; reason?: string; correlation_id?: string }>({
    action: 'submit', hospital_id, claim_id, correction_reason,
  });

/** Patient-facing estimate: insurance responsibility vs self-pay. */
export function estimate(
  totalCharge: number,
  coverage?: { copay_amount?: number | null } | null,
  eligibility?: { coverage_active?: boolean | null; copay_amount?: number | null; coinsurance_percent?: number | null; deductible_remaining?: number | null } | null,
) {
  if (!coverage || eligibility?.coverage_active === false) {
    return { basis: 'self_pay' as const, patientResponsibility: totalCharge, planPays: 0 };
  }
  const copay = Number(eligibility?.copay_amount ?? coverage.copay_amount ?? 0);
  const deductible = Math.min(Number(eligibility?.deductible_remaining ?? 0), totalCharge);
  const afterDeductible = Math.max(totalCharge - deductible, 0);
  const coins = (Number(eligibility?.coinsurance_percent ?? 0) / 100) * afterDeductible;
  const patient = Math.min(totalCharge, copay + deductible + coins);
  return { basis: 'insurance' as const, patientResponsibility: patient, planPays: totalCharge - patient };
}

/* ---------- VirtualisNote Coverage & Claim workspace ---------- */

export type ConnectionLabel = 'not_connected' | 'sandbox' | 'production_verified';
export interface ConnectionState { label: ConnectionLabel; environment: 'sandbox' | 'production' | null; blocked: string | null }

export const CONNECTION_COPY: Record<ConnectionLabel, string> = {
  not_connected: 'NOT CONNECTED',
  sandbox: 'SANDBOX / TEST DATA',
  production_verified: 'PRODUCTION VERIFIED',
};

export interface ClaimCapabilities {
  can_submit: boolean;
  can_initiate_eligibility: boolean;
  eligibility: ConnectionState;
  claim: ConnectionState;
  attachments_enabled: boolean;
}

export interface ClaimReadiness {
  found: boolean;
  claim: {
    id: string; status: string; billing_type: string; total_charge: number;
    place_of_service: string | null; denial_code: string | null; denial_reason: string | null;
    submitted_at: string | null; encounter_id: string; patient_id: string;
  } | null;
  readiness?: { can_approve?: boolean; blocks?: string[]; status?: string } | null;
  note_signed?: boolean;
  line_count?: number;
  diagnosis_count?: number;
  findings?: Array<{ rule_code: string; severity: string; message: string }>;
  connection: ConnectionState;
  can_submit: boolean;
}

export interface ClaimPreview {
  transaction: string; billing_type: string; place_of_service: string | null; payer: string | null;
  rendering_provider_npi: string | null; billing_provider_npi: string | null; total_charge: number;
  diagnoses: Array<{ code: string; code_set: string }>;
  service_lines: Array<{ cpt_code: string; units: number; charge_amount: number; modifiers: string[]; diagnosis_pointers: number[] }>;
}

export const claimCapabilities = (hospital_id: string) =>
  call<ClaimCapabilities>({ action: 'capabilities', hospital_id });

export const claimReadiness = (hospital_id: string, encounter_id: string) =>
  call<ClaimReadiness>({ action: 'readiness', hospital_id, encounter_id });

export const claimPreview = (hospital_id: string, claim_id: string) =>
  call<{ preview: ClaimPreview; connection: ConnectionState }>({ action: 'preview', hospital_id, claim_id });

export const checkEncounterEligibility = (hospital_id: string, patient_id: string, encounter_id?: string, coverage_id?: string) =>
  call<{ status: string; reason?: string; connection: ConnectionState; benefits: null | Record<string, unknown> }>({
    action: 'eligibility_check', hospital_id, patient_id, encounter_id, coverage_id,
  });

/** Submission always carries an explicit human attestation — never auto-submitted. */
export const submitClaimAttested = (hospital_id: string, claim_id: string, correction_reason?: string) =>
  call<{ status: string; reason?: string; correlation_id?: string; blocks?: string[] }>({
    action: 'submit', hospital_id, claim_id, attestation: true, correction_reason,
  });
