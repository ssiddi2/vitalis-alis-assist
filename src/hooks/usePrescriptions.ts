import { useState, useEffect } from 'react';
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
  status: string;
  sig: string | null;
  dea_schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export function usePrescriptions(patientId: string | undefined) {
  const [prescriptions, setPrescriptions] = useState<DBPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!patientId) {
      setPrescriptions([]);
      setLoading(false);
      return;
    }

    async function fetch() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPrescriptions((data as DBPrescription[]) || []);
      } catch (err) {
        console.error('Error fetching prescriptions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [patientId]);

  const createPrescription = async (rx: {
    patient_id: string;
    medication_name: string;
    dose?: string;
    frequency?: string;
    route?: string;
    quantity?: number;
    refills?: number;
    sig?: string;
    pharmacy_name?: string;
    dea_schedule?: string;
    encounter_id?: string;
  }) => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('prescriptions')
      .insert({ ...rx, prescriber_id: user.id, status: 'draft' })
      .select()
      .single();

    if (error) throw error;
    setPrescriptions(prev => [data as DBPrescription, ...prev]);
    return data;
  };

  const signPrescription = async (rxId: string) => {
    const { error } = await supabase
      .from('prescriptions')
      .update({ status: 'signed' })
      .eq('id', rxId);

    if (error) throw error;
    setPrescriptions(prev => prev.map(rx => rx.id === rxId ? { ...rx, status: 'signed' } : rx));
  };

  const cancelPrescription = async (rxId: string) => {
    const { error } = await supabase
      .from('prescriptions')
      .update({ status: 'cancelled' })
      .eq('id', rxId);

    if (error) throw error;
    setPrescriptions(prev => prev.map(rx => rx.id === rxId ? { ...rx, status: 'cancelled' } : rx));
  };

  return { prescriptions, loading, createPrescription, signPrescription, cancelPrescription };
}
