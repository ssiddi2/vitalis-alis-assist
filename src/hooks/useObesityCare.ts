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
    const { data } = await supabase.rpc('obesity_launch_readiness', {
      p_hospital_id: hospitalId,
      p_service_line_id: serviceLineId ?? null,
      p_state_code: stateCode,
      p_prescribing: prescribing,
      p_controlled: controlled,
    });
    setResult((data as unknown as ObesityReadiness) ?? { authorized: false });
    setLoading(false);
  }, [hospitalId, serviceLineId, stateCode, prescribing, controlled]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { result, loading, refresh };
}

const bmi = (kg: number, cm: number | null) =>
  cm && cm > 0 ? Math.round((kg / ((cm / 100) ** 2)) * 10) / 10 : null;

/** Encounter-scoped obesity workspace: cash-pay boundary, intake screens, weight trend. */
export function useObesityCare(encounterId?: string | null, patientId?: string | null) {
  const [cashPay, setCashPay] = useState<CashPayRow | null>(null);
  const [screens, setScreens] = useState<IntakeScreen[]>([]);
  const [trend, setTrend] = useState<WeightPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!encounterId) { setCashPay(null); setScreens([]); return; }
    setLoading(true);
    const [c, s, v] = await Promise.all([
      supabase.from('encounter_cash_pay').select('*').eq('encounter_id', encounterId).maybeSingle(),
      supabase.from('obesity_intake_screens')
        .select('id, template_protocol_id, template_version, red_flags, pregnancy_applicable, completed_at')
        .eq('encounter_id', encounterId).order('completed_at', { ascending: false }),
      patientId
        ? supabase.from('patient_vitals').select('trends').eq('patient_id', patientId).maybeSingle()
        : Promise.resolve({ data: null } as { data: { trends: unknown } | null }),
    ]);
    setCashPay((c.data as unknown as CashPayRow) ?? null);
    setScreens((s.data ?? []) as unknown as IntakeScreen[]);
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

  /** Records a PHI-minimized external payment reference. No card data is ever collected. */
  const recordPayment = useCallback(async (patch: Partial<CashPayRow>) => {
    if (!encounterId) return 'no_encounter';
    setBusy(true);
    const { error } = cashPay
      ? await supabase.from('encounter_cash_pay').update(patch as never).eq('id', cashPay.id)
      : await supabase.from('encounter_cash_pay').insert({ encounter_id: encounterId, ...patch } as never);
    setBusy(false);
    await refresh();
    return error?.message ?? null;
  }, [cashPay, encounterId, refresh]);

  /** Short-lived, server-issued embedded prescribing launch. Never returns credentials. */
  const requestPrescribingLaunch = useCallback(async () => {
    if (!encounterId) return { data: null, error: 'no_encounter' };
    setBusy(true);
    const res = await authenticatedFetch<{ status: string; url?: string; reason?: string; blockers?: string[] }>(
      'erx-adapter',
      { body: { action: 'dosespot_launch', encounter_id: encounterId, environment: 'production' }, silent: true },
    );
    setBusy(false);
    return res;
  }, [encounterId]);

  return { cashPay, screens, trend, loading, busy, refresh, recordPayment, requestPrescribingLaunch };
}
