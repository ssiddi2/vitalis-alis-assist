import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import type { ReadinessGate } from '@/hooks/useGovernance';

export interface ObesityReadiness {
  authorized: boolean;
  state_code?: string;
  prescribing?: boolean;
  controlled?: boolean;
  gates?: (ReadinessGate & { owner?: string; next_step?: string | null })[];
  blockers?: string[];
  can_launch?: boolean;
  note?: string;
}

export interface CashPayRow {
  id: string;
  encounter_id: string;
  fee_reference: string | null;
  amount_cents: number | null;
  currency: string;
  payment_status: string;
  processor: string | null;
  payment_reference: string | null;
  receipt_status: string | null;
  refund_status: string | null;
  waiver_reason: string | null;
  waived_by: string | null;
  settled_at: string | null;
}

export interface IntakeScreen {
  id: string;
  template_protocol_id: string;
  template_version: number;
  red_flags: string[] | null;
  pregnancy_applicable: boolean;
  completed_at: string;
}

/** Conservative structured question schema, mirrored from the approved template. */
export interface IntakeQuestion {
  id: string;
  label?: string;
  type?: 'boolean' | 'choice' | 'number' | 'text';
  required?: boolean;
  options?: (string | number | boolean)[];
  applies_when?: { question_id: string; equals: unknown };
  pregnancy?: boolean;
}

export interface IntakeTemplate { id: string; version: number; title: string; questions: IntakeQuestion[] }

export type CashPayAction = 'settle' | 'waive' | 'refund' | 'void' | 'chargeback';

export interface WeightPoint { date: string; weight_kg: number; height_cm: number | null; bmi: number | null }

/** Server-authoritative cash-pay obesity go-live gate for a hospital + state. */
export function useObesityLaunchReadiness(
  hospitalId?: string | null,
  serviceLineId?: string | null,
  stateCode?: string | null,
  opts: { prescribing?: boolean; controlled?: boolean } = {},
) {
  const [result, setResult] = useState<ObesityReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const { prescribing = true, controlled = false } = opts;

  const refresh = useCallback(async () => {
    if (!hospitalId || !stateCode) { setResult(null); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('obesity_launch_readiness', {
      p_hospital_id: hospitalId,
      p_service_line_id: serviceLineId ?? null,
      p_state_code: stateCode,
      p_prescribing: prescribing,
      p_controlled: controlled,
    });
    // An RPC failure is a blocked verdict, never a blank or optimistic screen.
    setResult(error || !data
      ? { authorized: false, can_launch: false, gates: [], blockers: [error ? 'readiness_unavailable' : 'not_authorized'] }
      : (data as unknown as ObesityReadiness));
    setLoading(false);

  }, [hospitalId, serviceLineId, stateCode, prescribing, controlled]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { result, loading, refresh };
}

const bmi = (kg: number, cm: number | null) =>
  cm && cm > 0 ? Math.round((kg / ((cm / 100) ** 2)) * 10) / 10 : null;

/**
 * Encounter-scoped obesity workspace: cash-pay boundary, intake screens, weight trend.
 *
 * The browser never supplies an authoritative amount, facility, patient or fee:
 * payment actions and intake submissions go through server-side database
 * functions that derive those values from the encounter itself.
 */
export function useObesityCare(
  encounterId?: string | null,
  patientId?: string | null,
  hospitalId?: string | null,
) {
  const [cashPay, setCashPay] = useState<CashPayRow | null>(null);
  const [screens, setScreens] = useState<IntakeScreen[]>([]);
  const [trend, setTrend] = useState<WeightPoint[]>([]);
  const [serviceCode, setServiceCode] = useState<string | null>(null);
  const [template, setTemplate] = useState<IntakeTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!encounterId) { setCashPay(null); setScreens([]); setServiceCode(null); return; }
    setLoading(true);
    const [c, s, v, sl] = await Promise.all([
      supabase.from('encounter_cash_pay').select('*').eq('encounter_id', encounterId).maybeSingle(),
      supabase.from('obesity_intake_screens')
        .select('id, template_protocol_id, template_version, red_flags, pregnancy_applicable, completed_at')
        .eq('encounter_id', encounterId).order('completed_at', { ascending: false }),
      patientId
        ? supabase.from('patient_vitals').select('trends').eq('patient_id', patientId).maybeSingle()
        : Promise.resolve({ data: null } as { data: { trends: unknown } | null }),
      supabase.from('care_requests')
        .select('service_line_id, service_lines(code)')
        .eq('encounter_id', encounterId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setCashPay((c.data as unknown as CashPayRow) ?? null);
    setScreens((s.data ?? []) as unknown as IntakeScreen[]);
    setServiceCode(((sl.data as { service_lines?: { code?: string } } | null)?.service_lines?.code) ?? null);
    const rows = Array.isArray(v.data?.trends) ? (v.data!.trends as Record<string, unknown>[]) : [];
    setTrend(
      rows
        .filter((r) => typeof r.weight_kg === 'number')
        .map((r) => {
          const kg = r.weight_kg as number;
          const cm = (r.height_cm as number) ?? null;
          return { date: String(r.date ?? r.recorded_at ?? ''), weight_kg: kg, height_cm: cm, bmi: bmi(kg, cm) };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
    setLoading(false);
  }, [encounterId, patientId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // The server selects the approved template for this exact encounter, so the
  // form and the submission validator can never diverge.
  useEffect(() => {
    let live = true;
    if (!encounterId) { setTemplate(null); return; }
    void (async () => {
      const { data } = await supabase.rpc('obesity_intake_template', { p_encounter_id: encounterId });
      if (!live) return;
      const res = data as { status?: string; id?: string; version?: number; title?: string; questions?: IntakeQuestion[] } | null;
      setTemplate(res?.status === 'ok' && Array.isArray(res.questions)
        ? { id: res.id!, version: res.version!, title: res.title ?? 'Obesity intake', questions: res.questions }
        : null);
    })();
    return () => { live = false; };
  }, [encounterId]);


  /**
   * Records a PHI-minimized external payment outcome. The client supplies only
   * the action plus a non-card reference or waiver reason.
   */
  const recordPayment = useCallback(async (
    action: CashPayAction,
    opts: { reference?: string; reason?: string } = {},
  ) => {
    if (!encounterId) return 'no_encounter';
    setBusy(true);
    const { data, error } = await supabase.rpc('record_cash_pay', {
      p_encounter_id: encounterId,
      p_action: action,
      p_payment_reference: opts.reference ?? null,
      p_reason: opts.reason ?? null,
    });
    setBusy(false);
    await refresh();
    const res = data as { status?: string; reason?: string } | null;
    return error?.message ?? (res?.status === 'ok' ? null : res?.reason ?? 'payment_action_failed');
  }, [encounterId, refresh]);

  /** Submits template answers; red flags are derived server-side, never sent. */
  const submitIntake = useCallback(async (answers: Record<string, unknown>) => {
    if (!encounterId) return 'no_encounter';
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_obesity_intake', {
      p_encounter_id: encounterId, p_answers: answers as never,
    });
    setBusy(false);
    await refresh();
    const res = data as { status?: string; reason?: string; question_id?: string } | null;
    if (error) return error.message;
    return res?.status === 'ok'
      ? null
      : [res?.reason ?? 'intake_failed', res?.question_id].filter(Boolean).join(': ');
  }, [encounterId, refresh]);

  /** Short-lived, server-issued embedded prescribing launch. Never returns credentials. */
  const requestPrescribingLaunch = useCallback(async () => {
    if (!encounterId || !hospitalId) return { data: null, error: 'no_encounter' };
    setBusy(true);
    const res = await authenticatedFetch<{ status: string; url?: string; reason?: string; blockers?: string[] }>(
      'erx-adapter',
      {
        body: {
          action: 'dosespot_launch', hospital_id: hospitalId,
          encounter_id: encounterId, environment: 'production',
        },
        silent: true,
      },
    );
    setBusy(false);
    return res;
  }, [encounterId, hospitalId]);

  return {
    cashPay, screens, trend, serviceCode, template, loading, busy,
    refresh, recordPayment, submitIntake, requestPrescribingLaunch,
  };
}
