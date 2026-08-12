import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DBPrescription {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  prescriber_id: string;
  medication_name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  quantity: number | null;
  refills: number | null;
  pharmacy_name: string | null;
  pharmacy_npi: string | null;
  pharmacy_ncpdp_id: string | null;
  status: string;
  sig: string | null;
  dea_schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  lock_version: number;
  rx_kind: string;
  rxcui: string | null;
  rxnorm_name: string | null;
  ndc: string | null;
  indication_text: string | null;
  units: string | null;
  days_supply: number | null;
  dispense_as_written: boolean;
  no_encounter_reason: string | null;
  prescriber_state_code: string | null;
  signed_at: string | null;
  signed_by: string | null;
  transmitted_at: string | null;
  signed_hash: string | null;
}

export type NewPrescription = Partial<DBPrescription> & { patient_id: string; medication_name: string };

export function usePrescriptions(patientId: string | undefined) {
  const [prescriptions, setPrescriptions] = useState<DBPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!patientId) { setPrescriptions([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPrescriptions((data as unknown as DBPrescription[]) || []);
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createPrescription = async (rx: NewPrescription) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({ ...rx, prescriber_id: user.id, status: 'draft' } as never)
      .select()
      .single();
    if (error) throw error;
    setPrescriptions(prev => [data as unknown as DBPrescription, ...prev]);
    return data as unknown as DBPrescription;
  };

  /** Optimistic-concurrency update: the database rejects a stale lock_version. */
  const updatePrescription = async (rx: DBPrescription, patch: Partial<DBPrescription>) => {
    const { data, error } = await supabase
      .from('prescriptions')
      .update({ ...patch, lock_version: rx.lock_version + 1 } as never)
      .eq('id', rx.id)
      .eq('lock_version', rx.lock_version)
      .select()
      .single();
    if (error) throw error;
    const next = data as unknown as DBPrescription;
    setPrescriptions(prev => prev.map(p => (p.id === next.id ? next : p)));
    return next;
  };

  const setStatus = (rx: DBPrescription, status: string) => updatePrescription(rx, { status });

  return { prescriptions, loading, refresh, createPrescription, updatePrescription, setStatus };
}
