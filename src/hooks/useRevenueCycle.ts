import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClaimRow {
  id: string;
  hospital_id: string;
  patient_id: string;
  encounter_id: string;
  status: string;
  billing_type: string;
  total_charge: number;
  paid_amount: number | null;
  patient_responsibility: number | null;
  denial_code: string | null;
  denial_reason: string | null;
  appeal_status: string | null;
  place_of_service: string | null;
  submitted_at: string | null;
  lock_version: number;
  created_at: string;
}

export interface EligibilityRow {
  id: string; patient_id: string; status: string; response_code: string | null;
  coverage_active: boolean | null; copay_amount: number | null; deductible_remaining: number | null;
  coinsurance_percent: number | null; requested_at: string;
}

export interface RemittanceRow {
  id: string; claim_id: string; transaction_type: string; status: string;
  paid_amount: number | null; patient_responsibility: number | null;
  denial_code: string | null; received_at: string; reconciled_at: string | null;
}

/** Facility-scoped revenue-cycle work queues. RLS keeps every read inside the tenant. */
export function useRevenueCycle(hospitalId: string | undefined) {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityRow[]>([]);
  const [remittances, setRemittances] = useState<RemittanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setClaims([]); setEligibility([]); setRemittances([]); setLoading(false); return; }
    setLoading(true);
    const [c, e, r] = await Promise.all([
      supabase.from('claims').select('*').eq('hospital_id', hospitalId).order('created_at', { ascending: false }).limit(200),
      supabase.from('eligibility_checks').select('id, patient_id, status, response_code, coverage_active, copay_amount, deductible_remaining, coinsurance_percent, requested_at')
        .eq('hospital_id', hospitalId).order('requested_at', { ascending: false }).limit(100),
      supabase.from('claim_remittances').select('id, claim_id, transaction_type, status, paid_amount, patient_responsibility, denial_code, received_at, reconciled_at')
        .eq('hospital_id', hospitalId).order('received_at', { ascending: false }).limit(100),
    ]);
    setClaims((c.data as ClaimRow[]) ?? []);
    setEligibility((e.data as EligibilityRow[]) ?? []);
    setRemittances((r.data as RemittanceRow[]) ?? []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const queues = {
    eligibilityFailures: eligibility.filter(e => e.status !== 'sent' || e.coverage_active === false),
    rejected: claims.filter(c => c.status === 'rejected'),
    denied: claims.filter(c => c.status === 'denied' && !c.appeal_status),
    appeals: claims.filter(c => !!c.appeal_status),
    unreconciled: remittances.filter(r => !r.reconciled_at),
  };

  return { claims, eligibility, remittances, queues, loading, refresh };
}

export function useClearinghouseProfiles(hospitalId: string | undefined) {
  const [profiles, setProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setProfiles([]); setLoading(false); return; }
    const { data } = await supabase.from('clearinghouse_profiles').select('*').eq('hospital_id', hospitalId);
    setProfiles((data as Array<Record<string, unknown>>) ?? []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { profiles, loading, refresh };
}
