import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Immunization {
  id: string;
  vaccine_name: string;
  administered_date: string;
  lot_number: string | null;
  site: string | null;
  route: string | null;
  manufacturer: string | null;
  administered_by: string | null;
  next_due_date: string | null;
  cvx_code: string | null;
}

export function useImmunizations(patientId: string) {
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImmunizations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('immunizations')
      .select('*')
      .eq('patient_id', patientId)
      .order('administered_date', { ascending: false });
    setImmunizations((data as Immunization[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) fetchImmunizations();
  }, [patientId]);

  const addImmunization = async (record: Omit<Immunization, 'id'> & { patient_id: string }) => {
    const { error } = await supabase.from('immunizations').insert(record);
    if (!error) await fetchImmunizations();
    return { error };
  };

  return { immunizations, loading, addImmunization, refetch: fetchImmunizations };
}
