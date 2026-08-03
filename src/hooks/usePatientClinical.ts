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

type Table = 'patient_allergies' | 'patient_problems' | 'patient_medications' | 'lab_results';

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

export interface LabResult {
  id: string;
  panel: string | null;
  test_name: string;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean;
  resulted_at: string | null;
}

export const usePatientLabs = (patientId?: string) =>
  usePatientRows<LabResult>('lab_results', patientId, [['resulted_at', false]]);

export interface VitalSign {
  label: string;
  value: string;
  unit: string;
  direction: 'up' | 'down' | 'stable';
}

/** Real vitals from the patient_vitals record (trends jsonb). Empty when none recorded. */
export function usePatientVitals(patientId?: string) {
  const [data, setData] = useState<VitalSign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!patientId) { setData([]); setLoading(false); return; }
      setLoading(true);
      const { data: row } = await supabase
        .from('patient_vitals')
        .select('trends')
        .eq('patient_id', patientId)
        .maybeSingle();
      if (cancelled) return;
      const trends = Array.isArray(row?.trends) ? (row!.trends as unknown[]) : [];
      setData(
        trends.map((t) => {
          const r = t as Record<string, unknown>;
          const raw = String(r.value ?? '');
          const [, num = raw, unit = ''] = raw.match(/^([\d.<>/-]+)\s*(.*)$/) || [];
          return {
            label: String(r.label ?? ''),
            value: num,
            unit: String(r.unit ?? unit),
            direction: (r.direction as VitalSign['direction']) || 'stable',
          };
        }).filter(v => v.label),
      );
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [patientId]);

  return { data, loading };
}
