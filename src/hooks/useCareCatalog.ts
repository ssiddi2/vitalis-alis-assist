import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceLine {
  id: string;
  hospital_id: string;
  code: string;
  name: string;
  patient_description: string;
  active: boolean;
  visible_to_patients: boolean;
  allows_new_patients: boolean;
  allows_established_patients: boolean;
  min_age: number;
  modality: string;
  response_window: string;
  requires_referral: boolean;
  requires_records: boolean;
  sort_order: number;
}

export interface StateCoverage {
  id: string;
  service_line_id: string;
  state_code: string;
  status: 'available' | 'waitlist' | 'unavailable';
  launch_date: string | null;
  reason: string | null;
}

export interface ProviderServiceLine {
  id: string;
  provider_user_id: string;
  service_line_id: string;
  active: boolean;
  effective_date: string;
  end_date: string | null;
  daily_capacity: number;
}

export interface SafetyScreenTemplate {
  id: string;
  service_line_id: string | null;
  version: number;
  questions: { code: string; text: string }[];
  approval_required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  active: boolean;
}

export interface RoutingStatus {
  authorized: boolean;
  status?: 'available' | 'waitlist' | 'unavailable';
  launch_date?: string | null;
  reason?: string | null;
  modality?: string;
  response_window?: string;
  provider_count?: number;
  can_route?: boolean;
  blocks?: string[];
}

/**
 * Facility-scoped care catalog. Reads are RLS-filtered to the caller's
 * facilities; writes are admin-only and rejected by the database otherwise.
 * Provider licence numbers are never selected here.
 */
export function useCareCatalog(hospitalId?: string) {
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [coverage, setCoverage] = useState<StateCoverage[]>([]);
  const [assignments, setAssignments] = useState<ProviderServiceLine[]>([]);
  const [templates, setTemplates] = useState<SafetyScreenTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hospitalId) {
      setServices([]); setCoverage([]); setAssignments([]); setTemplates([]); setLoading(false);
      return;
    }
    setLoading(true);
    const [s, c, a, t] = await Promise.all([
      supabase.from('service_lines').select('*').eq('hospital_id', hospitalId).order('sort_order'),
      supabase.from('state_service_availability')
        .select('id, service_line_id, state_code, status, launch_date, reason')
        .eq('hospital_id', hospitalId).order('state_code'),
      supabase.from('provider_service_lines')
        .select('id, provider_user_id, service_line_id, active, effective_date, end_date, daily_capacity')
        .eq('hospital_id', hospitalId),
      supabase.from('safety_screen_templates')
        .select('id, service_line_id, version, questions, approval_required, approved_by, approved_at, active')
        .eq('hospital_id', hospitalId).order('version', { ascending: false }),
    ]);
    setServices((s.data ?? []) as ServiceLine[]);
    setCoverage((c.data ?? []) as StateCoverage[]);
    setAssignments((a.data ?? []) as ProviderServiceLine[]);
    setTemplates((t.data ?? []) as unknown as SafetyScreenTemplate[]);
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const saveService = async (patch: Partial<ServiceLine> & { id: string }) => {
    const { id, ...rest } = patch;
    const { error } = await supabase.from('service_lines').update(rest as never).eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  };

  const saveCoverage = async (row: {
    service_line_id: string; state_code: string;
    status: StateCoverage['status']; launch_date?: string | null; reason?: string | null;
  }) => {
    if (!hospitalId) return;
    const existing = coverage.find(
      (c) => c.service_line_id === row.service_line_id && c.state_code === row.state_code,
    );
    const { error } = existing
      ? await supabase.from('state_service_availability').update(row as never).eq('id', existing.id)
      : await supabase.from('state_service_availability').insert([{ ...row, hospital_id: hospitalId }] as never);
    if (error) throw new Error(error.message);
    await refresh();
  };

  const saveAssignment = async (row: { provider_user_id: string; service_line_id: string; active?: boolean }) => {
    if (!hospitalId) return;
    const existing = assignments.find(
      (a) => a.provider_user_id === row.provider_user_id && a.service_line_id === row.service_line_id,
    );
    const { error } = existing
      ? await supabase.from('provider_service_lines').update({ active: row.active ?? true } as never).eq('id', existing.id)
      : await supabase.from('provider_service_lines').insert([{ ...row, hospital_id: hospitalId }] as never);
    if (error) throw new Error(error.message);
    await refresh();
  };

  /** Medical-director approval gate — the database refuses to activate without it. */
  const approveTemplate = async (id: string, approverId: string) => {
    const { error } = await supabase.from('safety_screen_templates')
      .update({ approved_by: approverId, approved_at: new Date().toISOString(), active: true } as never)
      .eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  };

  return { services, coverage, assignments, templates, loading, refresh, saveService, saveCoverage, saveAssignment, approveTemplate };
}

/** Server-computed routing truth: coverage status + whether a licensed provider exists. */
export function useRoutingStatus(hospitalId?: string, serviceLineId?: string, stateCode?: string) {
  const [routing, setRouting] = useState<RoutingStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!hospitalId || !serviceLineId || !stateCode) { setRouting(null); return; }
    setLoading(true);
    void supabase
      .rpc('care_routing_status', {
        p_hospital_id: hospitalId, p_service_line_id: serviceLineId, p_state_code: stateCode,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setRouting((data as unknown as RoutingStatus) ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [hospitalId, serviceLineId, stateCode]);

  return { routing, loading };
}
