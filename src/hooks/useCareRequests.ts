import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CareRequest {
  id: string;
  hospital_id: string;
  patient_id: string;
  service_line_id: string;
  created_by: string;
  status: string;
  patient_state_code: string | null;
  requested_urgency: string;
  reason_text: string | null;
  symptom_duration: string | null;
  callback_phone: string | null;
  callback_verified_at: string | null;
  preferred_language: string | null;
  accessibility_needs: string | null;
  is_established_patient: boolean;
  referral_status: string;
  records_status: string;
  payer_preference: string;
  consent_version: string | null;
  consent_accepted_at: string | null;
  safety_screen_version: number | null;
  safety_screen_completed_at: string | null;
  red_flag: boolean;
  red_flag_codes: string[];
  emergency_ack_at: string | null;
  triage_disposition: string | null;
  triage_reason: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  assigned_provider_id: string | null;
  appointment_id: string | null;
  decline_reason: string | null;
  lock_version: number;
  submitted_at: string | null;
  created_at: string;
  patient?: { id: string; name: string; mrn: string; age: number } | null;
  service?: { id: string; name: string; code: string; response_window: string } | null;
}

const SELECT =
  '*, patient:patients(id, name, mrn, age), service:service_lines(id, name, code, response_window)';

/**
 * `scope: 'mine'` lists the caller's own requests; `scope: 'queue'` is the
 * facility triage queue. RLS enforces both — the filters are for ergonomics.
 */
export function useCareRequests(hospitalId?: string, scope: 'mine' | 'queue' = 'mine') {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase.from('care_requests').select(SELECT).eq('hospital_id', hospitalId);
    if (scope === 'mine' && user) q = q.eq('created_by', user.id);
    if (scope === 'queue') q = q.in('status', ['submitted', 'waitlisted', 'triaged']);
    const { data } = await q.order('created_at', { ascending: false }).limit(200);
    setRequests((data ?? []) as unknown as CareRequest[]);
    setLoading(false);
  }, [hospitalId, scope, user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!hospitalId) return;
    const channel = supabase
      .channel(`care-requests-${hospitalId}-${scope}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'care_requests', filter: `hospital_id=eq.${hospitalId}` },
        () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [hospitalId, scope, refresh]);

  /** Creates the draft; the trigger stamps the requester and forces `draft`. */
  const createDraft = async (input: { hospital_id: string; patient_id: string; service_line_id: string }) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('care_requests')
      .insert([{ ...input, created_by: user.id, status: 'draft' as const }])
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    await refresh();
    return data as unknown as CareRequest;
  };

  return { requests, loading, refresh, createDraft };
}

export interface CareRequestEvent {
  id: string;
  from_status: string | null;
  to_status: string | null;
  event_code: string;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
}

export function useCareRequestEvents(careRequestId?: string | null) {
  const [events, setEvents] = useState<CareRequestEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!careRequestId) { setEvents([]); return; }
    void supabase
      .from('care_request_events')
      .select('id, from_status, to_status, event_code, reason, actor_id, created_at')
      .eq('care_request_id', careRequestId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (!cancelled) setEvents((data ?? []) as CareRequestEvent[]); });
    return () => { cancelled = true; };
  }, [careRequestId]);

  return events;
}
