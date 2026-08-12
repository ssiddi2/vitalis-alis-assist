import { supabase } from '@/integrations/supabase/client';

export type DiagnosticKind = 'lab' | 'imaging';

export const DIAG_STATUS_CLASSES: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  ready: 'border-primary/30 bg-primary/10 text-primary',
  transmission_pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  transmitted: 'border-primary/30 bg-primary/10 text-primary',
  acknowledged: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  resulted: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  errored: 'border-red-500/40 bg-red-500/10 text-red-600',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-400',
};

/** Human copy for the fail-closed diagnostic gate — never implies a live connection. */
export const DIAG_GATE_COPY: Record<string, string> = {
  no_vendor_profile: 'Not connected — no lab/imaging vendor profile configured',
  profile_unverified: 'Not connected — vendor profile is unverified',
  capability_not_enabled: 'Not connected — capability not enabled on the profile',
  end_to_end_test_not_passed: 'Not connected — end-to-end test has not passed',
  sandbox_test_mode: 'TEST MODE — sandbox profile, nothing reaches a lab or PACS',
  production_ingestion_disabled: 'Not connected — production ingestion is disabled',
  no_adapter: 'Not connected — no diagnostic vendor is contracted',
  idempotent_replay: 'Already sent — duplicate suppressed',
  duplicate_message_control_id: 'Replay suppressed — message already received',
};

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('diagnostics-adapter', { body: payload });
  if (error) throw new Error(error.message);
  return data as T;
}

export const transmitDiagnosticOrder = (hospital_id: string, order_id: string) =>
  call<{ status: string; reason?: string; correlation_id?: string; test_mode?: boolean }>({
    action: 'transmit_order', hospital_id, order_id,
  });

export const ingestTestResult = (hospital_id: string, payload: Record<string, unknown>) =>
  call<{ status: string; reason?: string; staging_id?: string; match_confidence?: number }>({
    action: 'ingest', hospital_id, ...payload,
  });

export const acceptStagedRecord = (hospital_id: string, staging_id: string, patient_id: string, review_reason: string) =>
  call<{ status: string; result_id: string | null; critical: boolean }>({
    action: 'accept_staged', hospital_id, staging_id, patient_id, review_reason,
  });

/** Reject a staged external record. Rejection never touches the chart. */
export async function rejectStagedRecord(staging_id: string, review_reason: string) {
  const { error } = await supabase
    .from('external_record_staging')
    .update({ status: 'rejected', review_reason })
    .eq('id', staging_id);
  if (error) throw new Error(error.message);
}

/** Acknowledge a result and record the clinician callback documentation. */
export async function acknowledgeResult(
  result: { id: string; hospital_id: string; patient_id: string },
  documentation: string,
  callback_method?: 'phone' | 'portal' | 'in_person' | 'message',
) {
  const { data: auth } = await supabase.auth.getUser();
  const actor_id = auth.user?.id;
  if (!actor_id) throw new Error('Not signed in');

  const { error } = await supabase
    .from('diagnostic_results')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', result.id);
  if (error) throw new Error(error.message);

  await supabase.from('result_acknowledgements').insert({
    result_id: result.id, hospital_id: result.hospital_id, patient_id: result.patient_id,
    actor_id, action: callback_method ? 'callback_documented' : 'acknowledged',
    callback_method: callback_method ?? null, documentation,
  });
}
