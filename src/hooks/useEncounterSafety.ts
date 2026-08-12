import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EncounterReadiness {
  found: boolean;
  status?: string;
  lock_version?: number;
  encounter_type?: string;
  can_start?: boolean;
  start_blocks?: string[];
  can_complete?: boolean;
  complete_blocks?: string[];
}

export interface EncounterDiagnosis {
  id: string;
  icd10_code: string;
  description: string;
  rank: number;
}

export interface EncounterEvent {
  id: string;
  from_status: string | null;
  to_status: string | null;
  event_code: string;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
}

/** Server-computed readiness, coded diagnoses and the append-only event trail. */
export function useEncounterSafety(encounterId?: string | null) {
  const [readiness, setReadiness] = useState<EncounterReadiness | null>(null);
  const [diagnoses, setDiagnoses] = useState<EncounterDiagnosis[]>([]);
  const [events, setEvents] = useState<EncounterEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!encounterId) {
      setReadiness(null);
      setDiagnoses([]);
      setEvents([]);
      return;
    }
    setLoading(true);
    const [r, d, e] = await Promise.all([
      supabase.rpc('encounter_readiness', { p_encounter_id: encounterId }),
      supabase.from('encounter_diagnoses').select('id, icd10_code, description, rank')
        .eq('encounter_id', encounterId).order('rank'),
      supabase.from('encounter_events').select('id, from_status, to_status, event_code, reason, actor_id, created_at')
        .eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(25),
    ]);
    setReadiness((r.data as unknown as EncounterReadiness) ?? null);
    setDiagnoses((d.data ?? []) as EncounterDiagnosis[]);
    setEvents((e.data ?? []) as EncounterEvent[]);
    setLoading(false);
  }, [encounterId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addDiagnosis = useCallback(
    async (input: { icd10_code: string; description: string; patient_id: string; hospital_id: string }) => {
      if (!encounterId) return;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('encounter_diagnoses').insert({
        encounter_id: encounterId,
        patient_id: input.patient_id,
        hospital_id: input.hospital_id,
        icd10_code: input.icd10_code.trim().toUpperCase(),
        description: input.description.trim(),
        rank: diagnoses.length + 1,
        created_by: auth.user?.id,
      });
      if (error) throw new Error(error.message);
      await refresh();
    },
    [encounterId, diagnoses.length, refresh],
  );

  const removeDiagnosis = useCallback(async (id: string) => {
    const { error } = await supabase.from('encounter_diagnoses').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  }, [refresh]);

  return { readiness, diagnoses, events, loading, refresh, addDiagnosis, removeDiagnosis };
}

export interface ProviderLicense {
  id: string;
  provider_user_id: string;
  hospital_id: string;
  state_code: string;
  license_number: string;
  status: string;
  effective_date: string;
  expiration_date: string | null;
  telehealth_permitted: boolean;
  verification_source: string | null;
  verified_at: string | null;
}

/** Hospital-scoped provider state authorizations (admin-managed writes). */
export function useProviderLicenses(hospitalId?: string | null, providerUserId?: string | null) {
  const [licenses, setLicenses] = useState<ProviderLicense[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!hospitalId) return setLicenses([]);
    setLoading(true);
    let q = supabase.from('provider_licenses').select('*').eq('hospital_id', hospitalId);
    if (providerUserId) q = q.eq('provider_user_id', providerUserId);
    const { data } = await q.order('state_code');
    setLicenses((data ?? []) as ProviderLicense[]);
    setLoading(false);
  }, [hospitalId, providerUserId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (input: Omit<ProviderLicense, 'id'> & { id?: string }) => {
    const { error } = input.id
      ? await supabase.from('provider_licenses').update(input).eq('id', input.id)
      : await supabase.from('provider_licenses').insert(input);
    if (error) throw new Error(error.message);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('provider_licenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  }, [refresh]);

  return { licenses, loading, refresh, save, remove };
}
