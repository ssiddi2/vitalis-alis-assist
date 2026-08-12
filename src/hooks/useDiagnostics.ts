import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DiagnosticOrderRow {
  id: string; hospital_id: string; patient_id: string; kind: string; status: string;
  code: string; code_system: string; code_version: string | null; display: string;
  priority: string; modality: string | null; clinical_indication: string | null;
  correlation_id: string | null; transmitted_at: string | null; lock_version: number; created_at: string;
}

export interface DiagnosticResultRow {
  id: string; hospital_id: string; patient_id: string; kind: string; status: string; version: number;
  code: string; display: string; value_text: string | null; unit: string | null;
  reference_range: string | null; interpretation: string | null;
  is_abnormal: boolean; is_critical: boolean; acknowledged_at: string | null; acknowledged_by: string | null;
  patient_release_status: string; source_system: string; reported_at: string;
}

export interface StagingRow {
  id: string; hospital_id: string; patient_id: string | null; candidate_patient_id: string | null;
  match_confidence: number; resource_type: string; source_system: string; consent_basis: string;
  status: string; summary: Record<string, unknown>; signature_verified: boolean; created_at: string;
}

export interface VendorProfileRow {
  id: string; hospital_id: string; kind: string; vendor: string; environment: string;
  capabilities: Record<string, boolean>; verification_status: string;
  last_test_result: string | null; secret_ref_names: string[];
}

/** Facility-scoped diagnostics inbox. RLS keeps every read inside the tenant. */
export function useDiagnostics(hospitalId: string | undefined) {
  const [orders, setOrders] = useState<DiagnosticOrderRow[]>([]);
  const [results, setResults] = useState<DiagnosticResultRow[]>([]);
  const [staging, setStaging] = useState<StagingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setOrders([]); setResults([]); setStaging([]); setLoading(false); return; }
    setLoading(true);
    const [o, r, s] = await Promise.all([
      supabase.from('diagnostic_orders').select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('diagnostic_results').select('*').eq('hospital_id', hospitalId)
        .order('reported_at', { ascending: false }).limit(200),
      supabase.from('external_record_staging').select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(100),
    ]);
    setOrders((o.data as DiagnosticOrderRow[]) ?? []);
    setResults((r.data as DiagnosticResultRow[]) ?? []);
    setStaging((s.data as StagingRow[]) ?? []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const queues = {
    criticalUnacked: results.filter((r) => r.is_critical && !r.acknowledged_at),
    abnormalUnacked: results.filter((r) => r.is_abnormal && !r.is_critical && !r.acknowledged_at),
    amended: results.filter((r) => r.status === 'amended' || r.status === 'corrected'),
    pendingReconciliation: staging.filter((s) => s.status === 'pending'),
    inFlight: orders.filter((o) => ['ready', 'transmission_pending', 'transmitted'].includes(o.status)),
    errored: orders.filter((o) => o.status === 'errored'),
  };

  return { orders, results, staging, queues, loading, refresh };
}

/** Vendor profiles + SMART registrations for the admin readiness screen. */
export function useDiagnosticProfiles(hospitalId: string | undefined) {
  const [profiles, setProfiles] = useState<VendorProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setProfiles([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('diagnostic_vendor_profiles').select('*')
      .eq('hospital_id', hospitalId).order('kind');
    setProfiles((data as VendorProfileRow[]) ?? []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { profiles, loading, refresh };
}
