import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GovStatus = 'draft' | 'in_review' | 'approved' | 'retired';

export interface ProtocolRow {
  id: string; hospital_id: string; kind: string; title: string; version: number;
  service_line_id: string | null; state_code: string | null; scope: string | null;
  owner_user_id: string | null; created_by: string | null; source_evidence: string | null;
  status: GovStatus; effective_start: string | null; effective_end: string | null;
  change_summary: string | null; next_review_date: string | null; generated_by_ai: boolean;
  supersedes_id: string | null; lock_version: number; created_at: string;
}

export interface ConsentDocRow {
  id: string; hospital_id: string; purpose: string; jurisdiction_state_code: string | null;
  service_line_id: string | null; title: string; version: number; status: GovStatus;
  body_hash: string; owner_user_id: string | null; created_by: string | null;
  source_evidence: string | null; effective_start: string | null; effective_end: string | null;
  lock_version: number; created_at: string;
}

export interface ApprovalRow {
  id: string; subject_type: string; subject_id: string; approver_id: string;
  approver_role: string; decision: string; rationale: string; created_at: string;
}

export interface CredentialRow {
  id: string; hospital_id: string; user_id: string; credential_type: string; state_code: string | null;
  issuing_authority: string | null; status: string; effective_date: string | null;
  expiration_date: string | null; psv_source: string | null; psv_verified_at: string | null;
  psv_evidence_ref: string | null; notes: string | null;
}

export interface ReadinessGate { key: string; type: 'internal' | 'external'; status: string; blocker: string | null }
export interface ReadinessResult {
  authorized: boolean; state_code?: string; service_line_id?: string | null;
  gates?: ReadinessGate[]; blockers?: string[]; can_launch?: boolean; note?: string;
}

const DAY = 86_400_000;
export const expiresWithin = (date: string | null, days: number) =>
  !!date && new Date(date).getTime() - Date.now() < days * DAY;

/** Facility-scoped governance registry: protocols, consent versions and approvals. */
export function useGovernance(hospitalId: string | undefined) {
  const [protocols, setProtocols] = useState<ProtocolRow[]>([]);
  const [consentDocs, setConsentDocs] = useState<ConsentDocRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setProtocols([]); setConsentDocs([]); setApprovals([]); setLoading(false); return; }
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const [p, c, a, g] = await Promise.all([
      supabase.from('clinical_protocols').select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('consent_documents').select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('governance_approvals').select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(300),
      supabase.from('governance_roles').select('role').eq('hospital_id', hospitalId)
        .eq('user_id', auth.user?.id ?? '').is('revoked_at', null),
    ]);
    setProtocols((p.data as ProtocolRow[]) ?? []);
    setConsentDocs((c.data as ConsentDocRow[]) ?? []);
    setApprovals((a.data as ApprovalRow[]) ?? []);
    setMyRoles(((g.data as { role: string }[]) ?? []).map((r) => r.role));
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const approvalsFor = (subjectType: string, id: string) =>
    approvals.filter((a) => a.subject_type === subjectType && a.subject_id === id && a.decision === 'approved');

  return { protocols, consentDocs, approvals, approvalsFor, myRoles, loading, refresh };
}

/** Credentialing, access attestations and expiration work queues. */
export function useCredentialing(hospitalId: string | undefined) {
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setCredentials([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('staff_credentials').select('*')
      .eq('hospital_id', hospitalId).order('expiration_date', { ascending: true }).limit(300);
    setCredentials((data as CredentialRow[]) ?? []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const queues = {
    expired: credentials.filter((c) => c.expiration_date && new Date(c.expiration_date) < new Date()),
    expiringSoon: credentials.filter((c) => expiresWithin(c.expiration_date, 60)
      && new Date(c.expiration_date!) >= new Date()),
    unverified: credentials.filter((c) => c.status === 'pending'),
  };

  return { credentials, queues, loading, refresh };
}

/** Internal readiness calculation for one state + service. Never a legal or clinical approval. */
export async function fetchReadiness(hospitalId: string, serviceLineId: string | null, stateCode: string) {
  const { data, error } = await supabase.rpc('launch_readiness', {
    p_hospital_id: hospitalId, p_service_line_id: serviceLineId, p_state_code: stateCode,
  });
  if (error) throw new Error(error.message);
  return (data ?? { authorized: false }) as unknown as ReadinessResult;
}
