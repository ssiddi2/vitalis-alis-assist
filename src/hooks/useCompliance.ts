import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ComplianceStatus =
  | 'not_started' | 'in_progress' | 'internally_ready'
  | 'ready_for_external_test' | 'externally_verified' | 'not_applicable';
export type Applicability = 'undetermined' | 'applicable' | 'not_applicable';
export type AttestorRole =
  | 'independent_assessor' | 'external_counsel' | 'compliance_officer' | 'medical_director' | 'vendor';

export interface RequirementRow {
  id: string; hospital_id: string; domain: string; framework_ref: string; criterion: string;
  title: string; description: string | null; external_dependency: boolean;
  applicability: Applicability; applicability_rationale: string | null;
  applicability_decided_by: string | null; owner_user_id: string | null;
  version: number; retired: boolean; created_by: string | null;
}
export interface AssessmentRow {
  id: string; hospital_id: string; requirement_id: string; status: ComplianceStatus;
  blocker: string | null; target_date: string | null; evidence_ref: string | null;
  evidence_hash: string | null; assessor_id: string | null; assessor_org: string | null;
  authority: string | null; test_method: string | null; test_version: string | null;
  tested_at: string | null; expires_at: string | null; lock_version: number; created_by: string | null;
}
export interface AttestationRow {
  id: string; assessment_id: string; attestor_id: string; attestor_role: AttestorRole;
  attestor_org: string | null; statement: string; evidence_ref: string | null;
  evidence_hash: string | null; effective_at: string; expires_at: string | null; created_at: string;
}

export const CLAIM_BANNER =
  'INTERNAL READINESS ONLY — nothing here asserts certification, regulatory compliance, an executed contract or a live external connection.';

const expired = (d: string | null) => !!d && new Date(d) < new Date();

/** A requirement blocks national release unless it is verified at the level its dependency demands. */
export const isBlocking = (r: RequirementRow, a?: AssessmentRow) => {
  if (r.retired) return false;
  if (r.applicability === 'not_applicable' && a?.status === 'not_applicable') return false;
  if (r.applicability === 'undetermined') return true;
  if (r.external_dependency) return a?.status !== 'externally_verified' || expired(a?.expires_at ?? null);
  return !a || !['internally_ready', 'externally_verified'].includes(a.status);
};

/** Facility-scoped certification / compliance / external-dependency matrix. */
export function useCompliance(hospitalId: string | undefined) {
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) { setRequirements([]); setAssessments([]); setAttestations([]); setLoading(false); return; }
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const [r, a, t] = await Promise.all([
      supabase.from('compliance_requirements').select('*').eq('hospital_id', hospitalId).order('domain'),
      supabase.from('compliance_assessments').select('*').eq('hospital_id', hospitalId),
      supabase.from('compliance_attestations').select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(500),
    ]);
    setUserId(auth.user?.id ?? null);
    setRequirements((r.data as RequirementRow[]) ?? []);
    setAssessments((a.data as AssessmentRow[]) ?? []);
    setAttestations((t.data as AttestationRow[]) ?? []);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const byRequirement = useMemo(
    () => Object.fromEntries(assessments.map((a) => [a.requirement_id, a])) as Record<string, AssessmentRow>,
    [assessments]);

  const blockers = useMemo(
    () => requirements.filter((r) => isBlocking(r, byRequirement[r.id])),
    [requirements, byRequirement]);

  /** Renewal queue: verified evidence expiring inside 90 days or already lapsed. */
  const renewals = useMemo(() => assessments.filter((a) => a.expires_at &&
    new Date(a.expires_at).getTime() - Date.now() < 90 * 86_400_000), [assessments]);

  const saveAssessment = async (row: AssessmentRow, patch: Partial<AssessmentRow>) => {
    const { error } = await supabase.from('compliance_assessments')
      .update({ ...patch, lock_version: row.lock_version + 1 }).eq('id', row.id).eq('lock_version', row.lock_version);
    if (error) throw error;
    await refresh();
  };

  const setApplicability = async (r: RequirementRow, patch: Partial<RequirementRow>) => {
    const { error } = await supabase.from('compliance_requirements')
      .update({ ...patch, applicability_decided_by: userId }).eq('id', r.id);
    if (error) throw error;
    await refresh();
  };

  const addAttestation = async (input: Omit<AttestationRow, 'id' | 'created_at' | 'attestor_id'>) => {
    const { error } = await supabase.from('compliance_attestations')
      .insert({ ...input, hospital_id: hospitalId!, attestor_id: userId! });
    if (error) throw error;
    await refresh();
  };

  /** PHI-free export: catalog, status and evidence references only — never patient data. */
  const exportReport = () => ({
    generated_at: new Date().toISOString(),
    disclaimer: CLAIM_BANNER,
    internal_ready: blockers.length === 0,
    national_production_ready: false,
    external_blockers: blockers.filter((r) => r.external_dependency).map((r) => `${r.domain}:${r.criterion}`),
    internal_blockers: blockers.filter((r) => !r.external_dependency).map((r) => `${r.domain}:${r.criterion}`),
    requirements: requirements.map((r) => {
      const a = byRequirement[r.id];
      return {
        domain: r.domain, framework: r.framework_ref, criterion: r.criterion, title: r.title,
        external_dependency: r.external_dependency, applicability: r.applicability,
        status: a?.status ?? 'not_started', blocker: a?.blocker ?? null,
        target_date: a?.target_date ?? null, authority: a?.authority ?? null,
        assessor_org: a?.assessor_org ?? null, test_method: a?.test_method ?? null,
        test_version: a?.test_version ?? null, tested_at: a?.tested_at ?? null,
        expires_at: a?.expires_at ?? null, evidence_hash: a?.evidence_hash ?? null,
      };
    }),
  });

  return { requirements, assessments, attestations, byRequirement, blockers, renewals,
    userId, loading, refresh, saveAssessment, setApplicability, addAttestation, exportReport };
}
