import { supabase } from '@/integrations/supabase/client';

/** Vendor-facing status copy. Nothing here ever claims pharmacy delivery. */
export const ERX_STATUS_COPY: Record<string, { label: string; tone: 'info' | 'blocked' | 'success' | 'error' }> = {
  not_connected: { label: 'Not connected — no e-Rx network contracted', tone: 'info' },
  no_integration_profile: { label: 'Not connected — no integration profile configured', tone: 'info' },
  profile_unverified: { label: 'Blocked — integration profile not verified', tone: 'blocked' },
  capability_not_enabled: { label: 'Blocked — New Rx capability not enabled', tone: 'blocked' },
  sandbox_test_mode: { label: 'Test mode — sandbox profile, nothing transmitted', tone: 'info' },
  controlled_substance_epcs_required: { label: 'Blocked — controlled substance, EPCS not certified', tone: 'blocked' },
  epcs_disabled: { label: 'Blocked — EPCS disabled', tone: 'blocked' },
  prescription_not_signed: { label: 'Blocked — prescription is not signed', tone: 'blocked' },
  queued: { label: 'Queued in outbox — awaiting a contracted network', tone: 'info' },
  blocked: { label: 'Blocked', tone: 'blocked' },
};

export interface SafetyCheck {
  id: string;
  check_type: string;
  severity: 'hard' | 'reviewable' | 'info';
  detail_code: string;
  message: string;
  source: string;
  source_version: string;
  checked_at: string;
}

export interface ErxProfile {
  id: string;
  hospital_id: string;
  vendor: string;
  environment: 'sandbox' | 'production';
  capabilities: Record<string, boolean>;
  epcs_enabled: boolean;
  verification_status: string;
  last_test_at: string | null;
  last_test_result: string | null;
  secret_ref_names: string[];
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('erx-adapter', { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export const runSafetyChecks = (prescription_id: string, hospital_id: string) =>
  call<{ checks: SafetyCheck[] }>({ action: 'safety_check', prescription_id, hospital_id });

export const transmitPrescription = (prescription_id: string, hospital_id: string) =>
  call<{ status: string; reason?: string; schedule?: string }>({ action: 'transmit', prescription_id, hospital_id });

export const queryPdmp = (args: { patient_id: string; hospital_id: string; state_code: string; purpose: string; legal_basis: string }) =>
  call<{ status: string; reason?: string; query_id: string }>({ action: 'pdmp_query', ...args });

export interface RxDraft {
  medication_name?: string | null;
  rxcui?: string | null;
  rxnorm_name?: string | null;
  sig?: string | null;
  quantity?: number | null;
  units?: string | null;
  route?: string | null;
  frequency?: string | null;
  days_supply?: number | null;
  refills?: number | null;
  indication_text?: string | null;
  pharmacy_name?: string | null;
  pharmacy_ncpdp_id?: string | null;
  encounter_id?: string | null;
  no_encounter_reason?: string | null;
  dea_schedule?: string | null;
}

/**
 * Client mirror of the database signing prerequisites. The database is
 * authoritative — this only tells the clinician *why* signing is blocked.
 */
export function signingBlockers(rx: RxDraft, checks: SafetyCheck[] = []): string[] {
  const b: string[] = [];
  if (rx.dea_schedule) b.push('Controlled substance — prescribing disabled (EPCS not certified)');
  if (!rx.rxcui || !rx.rxnorm_name) b.push('RxNorm identity (RxCUI) not verified');
  if (!rx.sig) b.push('SIG / patient instructions required');
  if (rx.quantity == null) b.push('Quantity required');
  if (!rx.units) b.push('Dispense units required');
  if (!rx.route) b.push('Route required');
  if (!rx.frequency) b.push('Frequency required');
  if (rx.days_supply == null) b.push('Days supply required');
  if (rx.refills == null) b.push('Refills required');
  if (!rx.indication_text) b.push('Diagnosis / indication required');
  if (!rx.pharmacy_name && !rx.pharmacy_ncpdp_id) b.push('Pharmacy selection required');
  if (!rx.encounter_id && (rx.no_encounter_reason ?? '').trim().length < 10)
    b.push('Encounter link or a documented exception reason required');
  if (checks.some(c => c.severity === 'hard')) b.push('Unresolved hard safety stop');
  return b;
}
