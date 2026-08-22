import { useMemo, useState } from 'react';
import { Loader2, Scale, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useObesityCare, type IntakeQuestion } from '@/hooks/useObesityCare';
import { useNoteEncounter } from '@/hooks/useCoverageClaim';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
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
const humanize = (s: string) => s.replace(/_/g, ' ');

/**
 * Encounter-level obesity care boundary: weight/BMI trend, structured intake
 * driven only by the approved medical-director template, cash-pay settlement
 * and the server-issued embedded prescribing launch. No card data is collected,
 * no red flag is client-derived and no AI decision is stored.
 */
export function ObesityCarePanel({ encounterId, patientId, noteId }: Props) {
  const resolved = useNoteEncounter(encounterId ? undefined : noteId);
  const encounter = encounterId ?? resolved;
  const { isAdmin } = useAuth();
  const { selectedHospital } = useHospital();
  const {
    cashPay, screens, trend, serviceCode, template, loading, busy,
    recordPayment, submitIntake, requestPrescribingLaunch,
  } = useObesityCare(encounter, patientId, selectedHospital?.id ?? null);
  const [reference, setReference] = useState('');
  const [waiver, setWaiver] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [launchBlockers, setLaunchBlockers] = useState<string[]>([]);

  const latest = trend.at(-1);
  const delta = useMemo(
    () => (trend.length > 1 ? Math.round((trend.at(-1)!.weight_kg - trend[0].weight_kg) * 10) / 10 : null),
    [trend],
  );
  const paymentSettled = SETTLED.has(cashPay?.payment_status ?? '');
  const processorConnected = !!cashPay?.processor && cashPay.processor !== 'not_connected';
  const redFlags = screens.flatMap((s) => s.red_flags ?? []);

  const visible = (q: IntakeQuestion) =>
    !q.applies_when || answers[q.applies_when.question_id] === q.applies_when.equals;

  const prescribe = async () => {
    const { data, error } = await requestPrescribingLaunch();
    if (data?.status === 'ok' && data.url) {
      setLaunchBlockers([]);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const list = data?.blockers?.length ? data.blockers : [error ?? data?.reason ?? 'prescribing_unavailable'];
    setLaunchBlockers(list);
    toast.error(`Prescribing unavailable: ${humanize(list[0])}`);
  };

  // Scoped strictly to the cash-pay obesity medicine service line.
  if (!encounter || serviceCode !== 'obesity_medicine') return null;

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

      <div className="space-y-1.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Intake &amp; safety screen</p>
        {screens.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            v{screens[0].template_version} completed {new Date(screens[0].completed_at).toLocaleDateString()}
            {screens[0].pregnancy_applicable ? ' · pregnancy questions applicable' : ''}
          </p>
        ) : !template ? (
          <p className="text-[11px] text-muted-foreground">
            No approved, current medical-director intake template is available for this facility, so an intake cannot be
            recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">{template.title} · v{template.version}</p>
            {template.questions.filter(visible).map((q) => (
              <div key={q.id} className="space-y-1">
                <Label htmlFor={`iq-${q.id}`} className="text-[11px] text-foreground">
                  {q.label ?? q.id}{q.required ? ' *' : ''}
                </Label>
                {q.type === 'boolean' ? (
                  <div className="flex gap-1.5">
                    {[true, false].map((val) => (
                      <Button key={String(val)} type="button" size="sm"
                        variant={answers[q.id] === val ? 'default' : 'outline'}
                        className="h-7 rounded-full text-[11px]"
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: val }))}>
                        {val ? 'Yes' : 'No'}
                      </Button>
                    ))}
                  </div>
                ) : q.options?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt) => (
                      <Button key={String(opt)} type="button" size="sm"
                        variant={answers[q.id] === opt ? 'default' : 'outline'}
                        className="h-7 rounded-full text-[11px]"
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}>
                        {String(opt)}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Input id={`iq-${q.id}`} type={q.type === 'number' ? 'number' : 'text'}
                    className="h-8 rounded-xl text-xs"
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => setAnswers((a) => {
                      const next = { ...a };
                      // An empty optional field is left unanswered, never coerced to 0 or ''.
                      if (e.target.value === '') { delete next[q.id]; return next; }
                      next[q.id] = q.type === 'number' ? Number(e.target.value) : e.target.value;
                      return next;
                    })} />

                )}
              </div>
            ))}
            <Button size="sm" className="h-8 rounded-full text-[11px]" disabled={busy}
              onClick={async () => {
                const err = await submitIntake(answers);
                if (err) toast.error(humanize(err));
                else { setAnswers({}); toast.success('Intake recorded'); }
              }}>
              Submit intake
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Answers and provenance are stored as recorded. Red flags are derived on the server from the approved
              template — never from this form and never by AI.
            </p>
          </div>
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
        {!processorConnected && (
          <p className="text-[11px] text-amber-600">
            Payment processor not connected — record an externally collected payment reference only. Never enter card,
            CVV or bank details in VirtualisONE.
          </p>
        )}
        {cashPay?.amount_cents != null && (
          <p className="text-[11px] text-muted-foreground">
            Facility fee {(cashPay.amount_cents / 100).toFixed(2)} {cashPay.currency}
            {cashPay.fee_reference ? ` · ${cashPay.fee_reference}` : ''} (set by the facility fee schedule)
          </p>
        )}
        {!isAdmin ? (
          <p className="text-[11px] text-muted-foreground">
            Payment status is read-only for your role. Settlement, refunds, voids and waivers are recorded by an
            administrator.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="cash-ref" className="text-[10px] text-muted-foreground">External payment reference</Label>
                <Input id="cash-ref" value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder="Receipt / transaction reference" className="h-8 w-56 rounded-xl text-xs" />
              </div>
              <Button size="sm" className="h-8 rounded-full text-[11px]" disabled={busy || !reference.trim()}
                onClick={async () => {
                  const err = await recordPayment('settle', { reference: reference.trim() });
                  if (err) toast.error(humanize(err));
                  else { setReference(''); toast.success('Payment reference recorded'); }
                }}>
                Record settled payment
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-full text-[11px]"
                disabled={busy || !paymentSettled}
                onClick={async () => {
                  const err = await recordPayment('refund', { reason: 'refund_requested' });
                  if (err) toast.error(humanize(err)); else toast.success('Refund work item opened');
                }}>
                Refund / chargeback
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="cash-waiver" className="text-[10px] text-muted-foreground">Administrative waiver reason</Label>
                <Input id="cash-waiver" value={waiver} onChange={(e) => setWaiver(e.target.value)}
                  placeholder="Documented, audited reason" className="h-8 w-56 rounded-xl text-xs" />
              </div>
              <Button size="sm" variant="outline" className="h-8 rounded-full text-[11px]"
                disabled={busy || waiver.trim().length < 10}
                onClick={async () => {
                  const err = await recordPayment('waive', { reason: waiver.trim() });
                  if (err) toast.error(humanize(err));
                  else { setWaiver(''); toast.success('Waiver recorded and audited'); }
                }}>
                Record waiver
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <Button size="sm" className="h-8 rounded-full text-[11px]" disabled={busy || !paymentSettled}
          aria-describedby="obesity-prescribe-help" onClick={() => void prescribe()}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Open embedded prescribing'}
        </Button>
        <p id="obesity-prescribe-help" className="text-[11px] text-muted-foreground">
          {!paymentSettled
            ? 'Disabled until payment is settled or an audited waiver is recorded.'
            : 'Opens a short-lived vendor session only when every server-side prescribing check passes.'}
        </p>
        {launchBlockers.length > 0 && (
          <ul className="text-[11px] text-red-600 space-y-0.5" aria-live="polite">
            {launchBlockers.map((b) => <li key={b}>Blocked: {humanize(b)}</li>)}
          </ul>
        )}
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
