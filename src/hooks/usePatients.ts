import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DBPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  sex: string;
  location: string;
  bed: string;
  unit: string | null;
  status: string | null;
  admission_day: number;
  expected_los: number;
  admission_diagnosis: string | null;
  attending_physician: string | null;
  care_team: unknown;
  hospital_id: string | null;
}

export function usePatients(hospitalId: string | undefined) {
  const [patients, setPatients] = useState<DBPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hospitalId) {
      setPatients([]);
      setLoading(false);
      return;
    }

    async function fetchPatients() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('patients')
          .select('*')
          .eq('hospital_id', hospitalId)
          .order('status', { ascending: true })
          .order('name', { ascending: true });

        if (fetchError) throw fetchError;
        setPatients((data as DBPatient[]) || []);
      } catch (err) {
        console.error('Error fetching patients:', err);
        setError(err instanceof Error ? err.message : 'Failed to load patients');
      } finally {
        setLoading(false);
      }
    }

    fetchPatients();
  }, [hospitalId]);

  // Group patients by unit
  const patientsByUnit = patients.reduce<Record<string, DBPatient[]>>((acc, patient) => {
    const unit = patient.unit || 'Unassigned';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(patient);
    return acc;
  }, {});

  return { patients, patientsByUnit, loading, error };
}
