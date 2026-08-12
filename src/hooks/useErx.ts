import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ErxProfile, SafetyCheck } from '@/lib/erx';

/** Operational e-Rx connectivity status for a facility. Never exposes credentials. */
export function useErxProfiles(hospitalId?: string) {
  const [profiles, setProfiles] = useState<ErxProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setProfiles([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('erx_integration_profiles')
      .select('id, hospital_id, vendor, environment, capabilities, epcs_enabled, verification_status, last_test_at, last_test_result, secret_ref_names')
      .eq('hospital_id', hospitalId)
      .order('environment', { ascending: false });
    setProfiles((data as unknown as ErxProfile[]) || []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const active = profiles.find(p => p.environment === 'production' && p.verification_status === 'verified') ?? profiles[0] ?? null;
  const connected = Boolean(active && active.environment === 'production' && active.verification_status === 'verified');

  return { profiles, active, connected, loading, refresh };
}

/** Safety checks + acknowledgment for one prescription. */
export function useSafetyChecks(prescriptionId?: string) {
  const [checks, setChecks] = useState<SafetyCheck[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!prescriptionId) { setChecks([]); return; }
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from('medication_safety_checks')
        .select('id, check_type, severity, detail_code, message, source, source_version, checked_at')
        .eq('prescription_id', prescriptionId).order('checked_at'),
      supabase.from('medication_safety_overrides').select('check_id, rationale').eq('prescription_id', prescriptionId),
    ]);
    setChecks((c as SafetyCheck[]) || []);
    setOverrides(Object.fromEntries(((o as { check_id: string; rationale: string }[]) || []).map(r => [r.check_id, r.rationale])));
  }, [prescriptionId]);

  useEffect(() => { refresh(); }, [refresh]);

  const acknowledge = useCallback(async (check: SafetyCheck, patientId: string, rationale: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('medication_safety_overrides').insert({
      check_id: check.id, prescription_id: prescriptionId!, patient_id: patientId,
      overridden_by: u.user!.id, rationale,
    });
    if (error) throw error;
    await refresh();
  }, [prescriptionId, refresh]);

  return { checks, overrides, refresh, acknowledge };
}

export interface MedHistoryCandidate {
  id: string;
  patient_id: string;
  source: string;
  source_version: string | null;
  medication_text: string;
  rxcui: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  status: string;
  created_at: string;
}

/** Unverified external medication history — must be accepted per-item by a clinician. */
export function useMedicationHistoryStaging(patientId?: string) {
  const [candidates, setCandidates] = useState<MedHistoryCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!patientId) { setCandidates([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('medication_history_candidates')
      .select('*').eq('patient_id', patientId).eq('status', 'pending').order('created_at');
    setCandidates((data as MedHistoryCandidate[]) || []);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { refresh(); }, [refresh]);

  const review = useCallback(async (c: MedHistoryCandidate, accept: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('medication_history_candidates')
      .update({ status: accept ? 'accepted' : 'rejected', reviewed_by: u.user!.id })
      .eq('id', c.id);
    if (error) throw error;
    if (accept) {
      await supabase.from('patient_medications').insert({
        patient_id: c.patient_id, name: c.medication_text,
        dose: c.dose, route: c.route, frequency: c.frequency, status: 'active',
      });
    }
    await refresh();
  }, [refresh]);

  return { candidates, loading, refresh, review };
}
