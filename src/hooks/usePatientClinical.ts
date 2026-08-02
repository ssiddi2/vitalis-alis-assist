import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Allergy {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: string;
  onset_date: string | null;
}

export interface Problem {
  id: string;
  description: string;
  icd10_code: string | null;
  status: string;
  onset_date: string | null;
  resolved_date: string | null;
}

export interface Medication {
  id: string;
  name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  prescriber: string | null;
}

type Table = 'patient_allergies' | 'patient_problems' | 'patient_medications';

function usePatientRows<T>(table: Table, patientId: string | undefined, order: [string, boolean][]) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!patientId) { setData([]); setLoading(false); return; }
      setLoading(true);
      let q = supabase.from(table).select('*').eq('patient_id', patientId);
      for (const [col, asc] of order) q = q.order(col, { ascending: asc });
      const { data: rows } = await q;
      if (!cancelled) { setData((rows as T[]) || []); setLoading(false); }
    }
    run();
    return () => { cancelled = true; };
  }, [table, patientId]);

  return { data, loading };
}

export const usePatientAllergies = (patientId?: string) =>
  usePatientRows<Allergy>('patient_allergies', patientId, [['severity', false]]);

export const usePatientProblems = (patientId?: string) =>
  usePatientRows<Problem>('patient_problems', patientId, [['status', true], ['onset_date', false]]);

export const usePatientMedications = (patientId?: string) =>
  usePatientRows<Medication>('patient_medications', patientId, [['status', true], ['name', true]]);
