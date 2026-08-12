import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { estimate } from '@/lib/claims';
import { ShieldCheck, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Coverage { id: string; payer_name: string; plan_name: string | null; copay_amount: number | null; verification_status: string; }
interface Elig { coverage_active: boolean | null; copay_amount: number | null; coinsurance_percent: number | null; deductible_remaining: number | null; status: string; }

/** Patient-facing estimate: insurance vs self-pay. Estimate only, never a guarantee of payment. */
export function CoverageEstimateCard({ patientId, totalCharge }: { patientId: string; totalCharge: number }) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [elig, setElig] = useState<Elig | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [c, e] = await Promise.all([
        supabase.from('patient_insurance').select('id, payer_name, plan_name, copay_amount, verification_status')
          .eq('patient_id', patientId).eq('active', true).order('rank').limit(1).maybeSingle(),
        supabase.from('eligibility_checks').select('coverage_active, copay_amount, coinsurance_percent, deductible_remaining, status')
          .eq('patient_id', patientId).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!live) return;
      setCoverage((c.data as Coverage) ?? null);
      setElig((e.data as Elig) ?? null);
    })();
    return () => { live = false; };
  }, [patientId]);

  const est = estimate(totalCharge, coverage, elig);
  const insured = est.basis === 'insurance';

  return (
    <div className="glass rounded-2xl border border-slate-200 p-4 space-y-2">
      <div className="flex items-center gap-2">
        {insured ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Wallet className="h-4 w-4 text-amber-500" />}
        <h4 className="text-sm font-semibold text-foreground">{insured ? 'Insurance estimate' : 'Self-pay estimate'}</h4>
        <span className={cn('ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
          coverage?.verification_status === 'verified'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
            : 'border-slate-200 bg-slate-100 text-slate-500')}>
          {coverage ? coverage.verification_status : 'no coverage on file'}
        </span>
      </div>
      {coverage && <p className="text-xs text-muted-foreground">{coverage.payer_name}{coverage.plan_name ? ` · ${coverage.plan_name}` : ''}</p>}
      <div className="flex items-end gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Patient responsibility</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">${est.patientResponsibility.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Plan pays (est.)</p>
          <p className="text-lg font-semibold text-muted-foreground tabular-nums">${est.planPays.toFixed(2)}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimate only, based on the last eligibility response. Not a guarantee of coverage or payment.
      </p>
    </div>
  );
}
