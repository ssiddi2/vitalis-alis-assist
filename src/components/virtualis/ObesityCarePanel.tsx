import { useMemo, useState } from 'react';
import { Loader2, Scale, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useObesityCare } from '@/hooks/useObesityCare';
import { useNoteEncounter } from '@/hooks/useCoverageClaim';
import { GovCard, StatusChip } from './GovernanceRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  encounterId?: string | null;
  patientId?: string | null;
  /** Resolves the encounter from the note when no explicit encounter is given. */
  noteId?: string;
}

const SETTLED = new Set(['settled', 'waived']);

/**
 * Encounter-level obesity care boundary: weight/BMI trend, structured intake
 * provenance, cash-pay settlement and the server-issued embedded prescribing
 * launch. No card data is collected here and no AI decision is stored.
 */
export function ObesityCarePanel({ encounterId, patientId, noteId }: Props) {
  const resolved = useNoteEncounter(encounterId ? undefined : noteId);
  const encounter = encounterId ?? resolved;
  const { cashPay, screens, trend, loading, busy, recordPayment, requestPrescribingLaunch } =
    useObesityCare(encounter, patientId);
  const [reference, setReference] = useState('');
  const [waiver, setWaiver] = useState('');
  const [launchBlock, setLaunchBlock] = useState<string | null>(null);

  const latest = trend.at(-1);
  const delta = useMemo(
    () => (trend.length > 1 ? Math.round((trend.at(-1)!.weight_kg - trend[0].weight_kg) * 10) / 10 : null),
    [trend],
  );
  const paymentSettled = SETTLED.has(cashPay?.payment_status ?? '');
  const redFlags = screens.flatMap((s) => s.red_flags ?? []);

  const prescribe = async () => {
    const { data, error } = await requestPrescribingLaunch();
    const reason = error ?? data?.reason ?? null;
    if (data?.status === 'ok' && data.url) {
      setLaunchBlock(null);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setLaunchBlock(reason ?? 'prescribing_unavailable');
    toast.error(`Prescribing unavailable: ${(reason ?? '').replace(/_/g, ' ')}`);
  };

  if (!encounter) return null;

  return (
    <GovCard title="Obesity care" icon={Scale}
      aside={loading ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : null}>
      <div className="grid grid-cols-3 gap-2">
        {[['Weight', latest ? `${latest.weight_kg} kg` : '—'],
          ['BMI', latest?.bmi ? String(latest.bmi) : '—'],
          ['Change', delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta} kg`]].map(([k, v]) => (
          <div key={k} className="p-2.5 rounded-xl bg-secondary/30 border border-border/40">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{k}</p>
            <p className="text-sm font-semibold text-foreground">{v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Intake &amp; safety screen</p>
        {screens.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No structured intake recorded for this encounter. An approved medical-director template is required.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            v{screens[0].template_version} completed {new Date(screens[0].completed_at).toLocaleDateString()}
            {screens[0].pregnancy_applicable ? ' · pregnancy questions applicable' : ''}
          </p>
        )}
        {redFlags.length > 0 && (
          <p className="text-[11px] text-red-600">Clinician review required: {redFlags.join(', ')}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Cash-pay</p>
          <StatusChip status={cashPay?.payment_status ?? 'not_started'} />
          {cashPay?.refund_status && cashPay.refund_status !== 'none' && <StatusChip status={cashPay.refund_status} />}
        </div>
        {!cashPay?.processor && (
          <p className="text-[11px] text-amber-600">
            Payment processor not connected — record an externally collected payment reference only. Never enter card,
            CVV or bank details in VirtualisONE.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="cash-ref" className="text-[10px] text-muted-foreground">External payment reference</Label>
            <Input id="cash-ref" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Receipt / transaction reference" className="h-8 w-56 rounded-xl text-xs" />
          </div>
          <Button size="sm" className="h-8 rounded-full text-[11px]" disabled={busy || !reference.trim()}
            onClick={async () => {
              const err = await recordPayment({
                payment_reference: reference.trim(), payment_status: 'settled',
                receipt_status: 'issued', settled_at: new Date().toISOString(),
              });
              if (err) toast.error(err); else { setReference(''); toast.success('Payment reference recorded'); }
            }}>
            Record settled payment
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="cash-waiver" className="text-[10px] text-muted-foreground">Administrative waiver reason</Label>
            <Input id="cash-waiver" value={waiver} onChange={(e) => setWaiver(e.target.value)}
              placeholder="Documented, audited reason" className="h-8 w-56 rounded-xl text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-8 rounded-full text-[11px]" disabled={busy || waiver.trim().length < 10}
            onClick={async () => {
              const err = await recordPayment({ payment_status: 'waived', waiver_reason: waiver.trim() });
              if (err) toast.error(err); else { setWaiver(''); toast.success('Waiver recorded and audited'); }
            }}>
            Record waiver
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Button size="sm" className="h-8 rounded-full text-[11px]" disabled={busy || !paymentSettled}
          aria-describedby="obesity-prescribe-help" onClick={() => void prescribe()}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Open embedded prescribing'}
        </Button>
        <p id="obesity-prescribe-help" className="text-[11px] text-muted-foreground">
          {!paymentSettled
            ? 'Disabled until payment is settled or an audited waiver is recorded.'
            : launchBlock
              ? `Blocked: ${launchBlock.replace(/_/g, ' ')}.`
              : 'Opens a short-lived vendor session. Controlled substances remain hard-blocked until EPCS evidence is verified.'}
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          VirtualisONE stays the system of record. AI never selects a medication, determines eligibility, clears a
          contraindication, downgrades a red flag or signs a note.
        </p>
      </div>
    </GovCard>
  );
}
