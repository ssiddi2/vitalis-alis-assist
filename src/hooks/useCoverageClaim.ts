import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ClaimCapabilities, ClaimReadiness, checkEncounterEligibility, claimCapabilities, claimReadiness,
} from '@/lib/claims';

export interface CoverageRow {
  id: string; payer_name: string; plan_name: string | null; copay_amount: number | null;
  verification_status: string; effective_date: string | null; termination_date: string | null;
}
export interface EligibilitySnapshot {
  status: string; response_code: string | null; coverage_active: boolean | null;
  copay_amount: number | null; deductible_remaining: number | null; coinsurance_percent: number | null;
  plan_summary: { plan_begin?: string | null; plan_end?: string | null; messages?: string[] } | null;
  requested_at: string;
}
export interface ClaimTimelineEvent {
  id: string; event_code: string; reason: string | null; to_status: string | null; created_at: string;
}

/**
 * Encounter-scoped coverage + claim state for VirtualisNote.
 * Every mutation goes through the server claims adapter; the browser never
 * talks to a clearinghouse and never holds a vendor key.
 */
export function useCoverageClaim(hospitalId?: string, patientId?: string, encounterId?: string | null) {
  const [caps, setCaps] = useState<ClaimCapabilities | null>(null);
  const [readiness, setReadiness] = useState<ClaimReadiness | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow | null>(null);
  const [eligibility, setEligibility] = useState<EligibilitySnapshot | null>(null);
  const [timeline, setTimeline] = useState<ClaimTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hospitalId || !patientId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [capsRes, cov, elig, ready] = await Promise.all([
        claimCapabilities(hospitalId),
        supabase.from('patient_insurance')
          .select('id, payer_name, plan_name, copay_amount, verification_status, effective_date, termination_date')
          .eq('patient_id', patientId).eq('active', true).order('rank').limit(1).maybeSingle(),
        supabase.from('eligibility_checks')
          .select('status, response_code, coverage_active, copay_amount, deductible_remaining, coinsurance_percent, plan_summary, requested_at')
          .eq('patient_id', patientId).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
        encounterId ? claimReadiness(hospitalId, encounterId) : Promise.resolve(null),
      ]);
      setCaps(capsRes);
      setCoverage((cov.data as CoverageRow) ?? null);
      setEligibility((elig.data as unknown as EligibilitySnapshot) ?? null);
      setReadiness(ready);
      if (ready?.claim?.id) {
        const { data } = await supabase.from('claim_events')
          .select('id, event_code, reason, to_status, created_at')
          .eq('claim_id', ready.claim.id).order('created_at', { ascending: false }).limit(20);
        setTimeline((data as ClaimTimelineEvent[]) ?? []);
      } else {
        setTimeline([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load coverage and claim state');
    } finally {
      setLoading(false);
    }
  }, [hospitalId, patientId, encounterId]);

  useEffect(() => { refresh(); }, [refresh]);

  const runEligibility = useCallback(async () => {
    if (!hospitalId || !patientId || busy) return null;
    setBusy(true);
    try {
      const res = await checkEncounterEligibility(hospitalId, patientId, encounterId ?? undefined, coverage?.id);
      await refresh();
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eligibility request failed');
      return null;
    } finally {
      setBusy(false);
    }
  }, [hospitalId, patientId, encounterId, coverage?.id, busy, refresh]);

  return { caps, readiness, coverage, eligibility, timeline, loading, busy, error, refresh, runEligibility };
}

/** Resolve the encounter a note belongs to, so the panel stays bound to one encounter. */
export function useNoteEncounter(noteId?: string) {
  const [encounterId, setEncounterId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!noteId) { setEncounterId(null); return; }
    supabase.from('clinical_notes').select('encounter_id').eq('id', noteId).maybeSingle()
      .then(({ data }) => { if (live) setEncounterId((data?.encounter_id as string) ?? null); });
    return () => { live = false; };
  }, [noteId]);
  return encounterId;
}
