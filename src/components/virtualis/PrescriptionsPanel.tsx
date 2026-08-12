import { useEffect, useMemo, useState } from 'react';
import { usePrescriptions, type DBPrescription } from '@/hooks/usePrescriptions';
import { useSafetyChecks, useErxProfiles } from '@/hooks/useErx';
import { useHospital } from '@/contexts/HospitalContext';
import { ERX_STATUS_COPY, runSafetyChecks, signingBlockers, transmitPrescription, type SafetyCheck } from '@/lib/erx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Pill, Plus, Check, X, FileSignature, Clock, Send, ShieldAlert, Loader2, AlertTriangle, Plug, HardDrive } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Clock },
  ready_for_review: { label: 'Ready for review', color: 'bg-warning/10 text-warning', icon: Clock },
  signed: { label: 'Signed', color: 'bg-primary/10 text-primary', icon: FileSignature },
  transmission_pending: { label: 'Transmission pending', color: 'bg-info/10 text-info', icon: Send },
  transmitted: { label: 'Transmitted', color: 'bg-info/10 text-info', icon: Send },
  accepted: { label: 'Accepted', color: 'bg-success/10 text-success', icon: Check },
  errored: { label: 'Errored', color: 'bg-critical/10 text-critical', icon: AlertTriangle },
  sent: { label: 'Sent', color: 'bg-info/10 text-info', icon: Send },
  filled: { label: 'Filled', color: 'bg-success/10 text-success', icon: Check },
  cancelled: { label: 'Cancelled', color: 'bg-critical/10 text-critical', icon: X },
  discontinued: { label: 'Discontinued', color: 'bg-muted text-muted-foreground', icon: X },
};

const ROUTES = ['PO', 'IV', 'IM', 'SQ', 'Topical', 'Inhaled', 'PR', 'SL'];
const FREQUENCIES = ['QD', 'BID', 'TID', 'QID', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'PRN', 'QHS', 'QAM', 'Weekly'];
const UNITS = ['tablet', 'capsule', 'mL', 'gram', 'patch', 'inhaler', 'vial'];

interface PrescriptionsPanelProps {
  patientId: string;
  encounterId?: string;
}

/** Safety alerts + acknowledgment for one prescription. */
function SafetyBlock({ rx, onChanged }: { rx: DBPrescription; onChanged: (c: SafetyCheck[]) => void }) {
  const { checks, overrides, acknowledge, refresh } = useSafetyChecks(rx.id);
  const [target, setTarget] = useState<SafetyCheck | null>(null);
  const [rationale, setRationale] = useState('');

  useEffect(() => { onChanged(checks); }, [checks, onChanged]);

  const submit = async () => {
    if (!target) return;
    try {
      await acknowledge(target, rx.patient_id, rationale.trim());
      toast.success('Alert acknowledged');
      setTarget(null); setRationale('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Acknowledgment rejected');
    }
  };

  const visible = checks.filter(c => c.severity !== 'info');
  if (!visible.length) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {visible.map(c => (
        <div key={c.id} className={cn(
          'flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px]',
          c.severity === 'hard' ? 'border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444]' : 'border-[#F59E0B]/30 bg-[#F59E0B]/5 text-[#F59E0B]',
        )}>
          <ShieldAlert className="w-3.5 h-3.5 mt-px shrink-0" />
          <div className="flex-1">
            <p className="font-mono uppercase tracking-widest text-[9px] opacity-70">
              {c.severity === 'hard' ? 'Hard stop' : 'Review required'} · {c.check_type} · {c.source} {c.source_version}
            </p>
            <p>{c.message}</p>
            {overrides[c.id] && <p className="mt-0.5 opacity-70">Acknowledged: {overrides[c.id]}</p>}
          </div>
          {c.severity === 'reviewable' && !overrides[c.id] && (
            <Button size="sm" variant="outline" className="h-6 rounded-lg text-[10px]" onClick={() => setTarget(c)}>
              Acknowledge
            </Button>
          )}
        </div>
      ))}

      <Dialog open={!!target} onOpenChange={o => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Acknowledge safety alert</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{target?.message}</p>
          <Label className="text-xs">Clinical rationale (no patient identifiers, 10–500 characters)</Label>
          <Textarea value={rationale} maxLength={500} onChange={e => setRationale(e.target.value)} rows={3} />
          <Button className="rounded-xl" disabled={rationale.trim().length < 10} onClick={submit}>
            Record acknowledgment
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PrescriptionsPanel({ patientId, encounterId }: PrescriptionsPanelProps) {
  const { prescriptions, loading, createPrescription, setStatus, refresh } = usePrescriptions(patientId);
  const { selectedHospital } = useHospital();
  const { active: profile, connected } = useErxProfiles(selectedHospital?.id);
  const [newRxOpen, setNewRxOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { status: string; reason?: string }>>({});
  const [checksByRx, setChecksByRx] = useState<Record<string, SafetyCheck[]>>({});

  const [form, setForm] = useState({
    medication_name: '', rxcui: '', rxnorm_name: '', dose: '', frequency: 'QD', route: 'PO',
    quantity: '', units: 'tablet', days_supply: '', refills: '0', sig: '', indication_text: '',
    pharmacy_name: '', dispense_as_written: false, no_encounter_reason: '', prescriber_state_code: '',
  });

  const connectionPill = useMemo(() => {
    if (connected) return { label: `Connected · ${profile?.vendor}`, icon: Plug, cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600' };
    if (profile) return { label: `Test mode · ${profile.vendor} ${profile.environment}`, icon: HardDrive, cls: 'border-amber-500/40 bg-amber-500/10 text-amber-600' };
    return { label: 'Not connected · no e-Rx network', icon: HardDrive, cls: 'border-slate-200 bg-slate-100 text-slate-500' };
  }, [connected, profile]);

  const handleCreate = async () => {
    if (!form.medication_name) return;
    try {
      const rx = await createPrescription({
        patient_id: patientId,
        encounter_id: encounterId ?? null,
        medication_name: form.medication_name,
        rxcui: form.rxcui || null,
        rxnorm_name: form.rxnorm_name || form.medication_name || null,
        dose: form.dose || null,
        frequency: form.frequency || null,
        route: form.route || null,
        quantity: form.quantity ? parseInt(form.quantity) : null,
        units: form.units || null,
        days_supply: form.days_supply ? parseInt(form.days_supply) : null,
        refills: parseInt(form.refills) || 0,
        sig: form.sig || null,
        indication_text: form.indication_text || null,
        pharmacy_name: form.pharmacy_name || null,
        dispense_as_written: form.dispense_as_written,
        no_encounter_reason: form.no_encounter_reason || null,
        prescriber_state_code: form.prescriber_state_code.toUpperCase() || null,
      });
      toast.success('Prescription drafted');
      setNewRxOpen(false);
      if (selectedHospital) await runSafetyChecks(rx.id, selectedHospital.id).catch(() => undefined);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create prescription');
    }
  };

  const handleSign = async (rx: DBPrescription) => {
    if (!selectedHospital) return;
    setBusy(rx.id);
    try {
      await runSafetyChecks(rx.id, selectedHospital.id);
      const ready = rx.status === 'draft' ? await setStatus(rx, 'ready_for_review') : rx;
      await setStatus(ready, 'signed');
      toast.success('Prescription signed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Signing blocked');
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const handleTransmit = async (rx: DBPrescription) => {
    if (!selectedHospital) return;
    setBusy(rx.id);
    const res = await transmitPrescription(rx.id, selectedHospital.id).catch(e => ({ status: 'error', reason: e.message }));
    setResults(prev => ({ ...prev, [rx.id]: res }));
    setBusy(null);
    toast[res.status === 'blocked' ? 'error' : 'info'](ERX_STATUS_COPY[res.reason ?? res.status]?.label ?? res.status);
    await refresh();
  };

  const handleCancel = async (rx: DBPrescription) => {
    try { await setStatus(rx, 'cancelled'); toast.info('Prescription cancelled'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to cancel'); }
  };

  const active = prescriptions.filter(rx => !['cancelled', 'discontinued'].includes(rx.status));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-soft">
            <Pill className="w-3.5 h-3.5 text-primary" />
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prescriptions</h2>
          <span className="text-[10px] px-1.5 rounded-full bg-muted text-muted-foreground">{active.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', connectionPill.cls)}>
            <connectionPill.icon className="h-3 w-3" />{connectionPill.label}
          </span>

          <Dialog open={newRxOpen} onOpenChange={setNewRxOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1">
                <Plus className="w-3 h-3" /> New Rx
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Prescription</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Medication *</Label>
                    <Input maxLength={300} value={form.medication_name} onChange={e => setForm(p => ({ ...p, medication_name: e.target.value }))} placeholder="Metformin 500 mg tablet" />
                  </div>
                  <div>
                    <Label>RxNorm RxCUI *</Label>
                    <Input maxLength={20} value={form.rxcui} onChange={e => setForm(p => ({ ...p, rxcui: e.target.value }))} placeholder="860975" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Dose</Label><Input maxLength={60} value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} placeholder="500mg" /></div>
                  <div>
                    <Label>Route *</Label>
                    <Select value={form.route} onValueChange={v => setForm(p => ({ ...p, route: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequency *</Label>
                    <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div><Label>Qty *</Label><Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} /></div>
                  <div>
                    <Label>Units *</Label>
                    <Select value={form.units} onValueChange={v => setForm(p => ({ ...p, units: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Days *</Label><Input type="number" value={form.days_supply} onChange={e => setForm(p => ({ ...p, days_supply: e.target.value }))} /></div>
                  <div><Label>Refills *</Label><Input type="number" value={form.refills} onChange={e => setForm(p => ({ ...p, refills: e.target.value }))} /></div>
                </div>
                <div><Label>SIG *</Label><Input maxLength={300} value={form.sig} onChange={e => setForm(p => ({ ...p, sig: e.target.value }))} placeholder="Take 1 tablet by mouth daily with meals" /></div>
                <div><Label>Indication / diagnosis *</Label><Input maxLength={200} value={form.indication_text} onChange={e => setForm(p => ({ ...p, indication_text: e.target.value }))} placeholder="Type 2 diabetes mellitus" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Pharmacy *</Label><Input maxLength={200} value={form.pharmacy_name} onChange={e => setForm(p => ({ ...p, pharmacy_name: e.target.value }))} /></div>
                  <div><Label>Patient state *</Label><Input maxLength={2} value={form.prescriber_state_code} onChange={e => setForm(p => ({ ...p, prescriber_state_code: e.target.value }))} placeholder="TX" /></div>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={form.dispense_as_written} onChange={e => setForm(p => ({ ...p, dispense_as_written: e.target.checked }))} />
                  Dispense as written (no substitution)
                </label>
                {!encounterId && (
                  <div>
                    <Label>No-encounter exception reason *</Label>
                    <Textarea maxLength={300} rows={2} value={form.no_encounter_reason} onChange={e => setForm(p => ({ ...p, no_encounter_reason: e.target.value }))} placeholder="Why this prescription is written outside an encounter" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Controlled substances are disabled — EPCS is not certified.
                </p>
                <Button onClick={handleCreate} disabled={!form.medication_name} className="w-full rounded-xl">
                  Create draft
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        {active.map(rx => {
          const cfg = STATUS_CONFIG[rx.status] || STATUS_CONFIG.draft;
          const blockers = signingBlockers(rx, checksByRx[rx.id] ?? []);
          const signable = ['draft', 'ready_for_review'].includes(rx.status);
          const result = results[rx.id];
          const copy = result ? (ERX_STATUS_COPY[result.reason ?? result.status] ?? ERX_STATUS_COPY.blocked) : null;
          return (
            <div key={rx.id} className="glass-strong rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{rx.medication_name}</span>
                  <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 rounded-full', cfg.color)}>{cfg.label}</Badge>
                  {rx.rxcui && <span className="font-mono text-[9px] text-muted-foreground">RxCUI {rx.rxcui}</span>}
                </div>
                <div className="flex gap-1">
                  {signable && (
                    <>
                      <Button size="sm" disabled={busy === rx.id || blockers.length > 0} className="rounded-lg text-[10px] h-6 px-2 gap-1" onClick={() => handleSign(rx)}>
                        {busy === rx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSignature className="w-3 h-3" />} Sign
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-lg text-[10px] h-6 px-2 text-critical" onClick={() => handleCancel(rx)}>Cancel</Button>
                    </>
                  )}
                  {rx.status === 'signed' && (
                    <Button size="sm" variant="outline" disabled={!selectedHospital || busy === rx.id} className="rounded-lg text-[10px] h-6 px-2 gap-1" onClick={() => handleTransmit(rx)}>
                      {busy === rx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Transmit
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {[rx.dose, rx.route, rx.frequency,
                  rx.quantity != null ? `Qty ${rx.quantity}${rx.units ? ` ${rx.units}` : ''}` : null,
                  rx.days_supply != null ? `${rx.days_supply} days` : null,
                  rx.refills != null ? `Refills ${rx.refills}` : null,
                  rx.dispense_as_written ? 'DAW' : null,
                ].filter(Boolean).join(' · ')}
              </div>
              {rx.sig && <p className="text-[11px] text-muted-foreground mt-1 italic">{rx.sig}</p>}
              {rx.indication_text && <p className="text-[10px] text-muted-foreground/70 mt-0.5">Indication: {rx.indication_text}</p>}
              {rx.pharmacy_name && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Pharmacy: {rx.pharmacy_name}</p>}

              <SafetyBlock rx={rx} onChanged={c => setChecksByRx(prev => (prev[rx.id] === c ? prev : { ...prev, [rx.id]: c }))} />

              {signable && blockers.length > 0 && (
                <div className="mt-2 rounded-xl border border-border bg-muted/40 px-2.5 py-2">
                  <p className="font-mono uppercase tracking-widest text-[9px] text-muted-foreground">Signing blocked</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                    {blockers.map(b => <li key={b}>· {b}</li>)}
                  </ul>
                </div>
              )}

              {copy && (
                <div className={cn('mt-2 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px]',
                  copy.tone === 'blocked' && 'border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444]',
                  copy.tone === 'info' && 'border-border bg-muted/50 text-muted-foreground',
                  copy.tone === 'success' && 'border-[#10B981]/30 bg-[#10B981]/5 text-[#10B981]',
                  copy.tone === 'error' && 'border-[#F59E0B]/30 bg-[#F59E0B]/5 text-[#F59E0B]',
                )}>
                  <ShieldAlert className="w-3.5 h-3.5 mt-px shrink-0" />
                  <div>
                    <p className="font-mono uppercase tracking-widest text-[9px] opacity-70">Transmission</p>
                    <p>{copy.label}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!loading && active.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No active prescriptions</div>
        )}
      </div>
    </div>
  );
}
