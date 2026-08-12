import { useState } from 'react';
import { AlertTriangle, Check, FlaskConical, Inbox, Scan, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDiagnostics, type DiagnosticResultRow, type StagingRow } from '@/hooks/useDiagnostics';
import { acceptStagedRecord, acknowledgeResult, rejectStagedRecord } from '@/lib/diagnostics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Label = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{n} — {children}</span>
    <div className="h-px flex-1 bg-border/60" />
  </div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="p-5 rounded-2xl bg-card/80 backdrop-blur border border-border/50 shadow-sm">{children}</div>
);

function ResultRow({ r, onDone }: { r: DiagnosticResultRow; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const ack = async () => {
    if (note.trim().length < 3) return toast.error('Document the callback or review before acknowledging');
    setBusy(true);
    try {
      await acknowledgeResult(r, note.trim(), r.is_critical ? 'phone' : undefined);
      toast.success('Result acknowledged');
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
      <div className="flex items-center gap-2">
        {r.kind === 'lab' ? <FlaskConical className="w-4 h-4 text-primary" /> : <Scan className="w-4 h-4 text-primary" />}
        <span className="text-xs font-semibold text-foreground truncate">{r.display}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
          r.is_critical ? 'border-red-500/40 bg-red-500/10 text-red-600'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-600'}`}>
          {r.is_critical ? 'CRITICAL' : 'ABNORMAL'}
        </span>
        <span className="ml-auto font-mono text-[11px] text-foreground">{r.value_text} {r.unit}</span>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono">
        {r.source_system} · v{r.version} · {r.status} · ref {r.reference_range ?? '—'}
      </p>
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
          placeholder={r.is_critical ? 'Callback documentation (required)' : 'Review note'} className="h-8 text-xs" />
        <Button size="sm" className="h-8 rounded-full" disabled={busy} onClick={ack}>Acknowledge</Button>
      </div>
    </div>
  );
}

function StagingCard({ s, onDone }: { s: StagingRow; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const summary = s.summary as { display?: string; value_text?: string; code?: string };

  const act = async (accept: boolean) => {
    if (reason.trim().length < 3) return toast.error('A review reason is required');
    if (accept && !s.candidate_patient_id) return toast.error('No confirmed patient match');
    setBusy(true);
    try {
      if (accept) await acceptStagedRecord(s.hospital_id, s.id, s.candidate_patient_id!, reason.trim());
      else await rejectStagedRecord(s.id, reason.trim());
      toast.success(accept ? 'Accepted into the chart' : 'Rejected — chart unchanged');
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const pct = Math.round(s.match_confidence * 100);
  return (
    <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground truncate">
          {summary.display || s.resource_type}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
          pct >= 85 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-600'}`}>
          MATCH {pct}%
        </span>
        {!s.signature_verified && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-slate-600 font-medium">
            UNSIGNED SOURCE
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground font-mono">
        {s.source_system} · {s.resource_type} · basis: {s.consent_basis} · {summary.value_text ?? '—'}
      </p>
      <div className="flex gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
          placeholder="Reconciliation reason (required)" className="h-8 text-xs" />
        <Button size="sm" variant="outline" className="h-8 rounded-full" disabled={busy} onClick={() => act(false)}>
          <X className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" className="h-8 rounded-full" disabled={busy} onClick={() => act(true)}>
          <Check className="w-3.5 h-3.5 mr-1" /> Accept
        </Button>
      </div>
    </div>
  );
}

/**
 * Clinician results inbox + external-record reconciliation.
 * Nothing here mutates the chart until a clinician accepts a staged record.
 */
export function DiagnosticsInbox({ hospitalId }: { hospitalId?: string }) {
  const { queues, loading, refresh } = useDiagnostics(hospitalId);

  if (!hospitalId) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <Label n="01">Unresolved results</Label>
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
          <div className="space-y-2">
            {[...queues.criticalUnacked, ...queues.abnormalUnacked].map((r) => (
              <ResultRow key={r.id} r={r} onDone={refresh} />
            ))}
            {queues.criticalUnacked.length + queues.abnormalUnacked.length === 0 && (
              <p className="text-xs text-muted-foreground">No unacknowledged abnormal or critical results.</p>
            )}
            {queues.amended.length > 0 && (
              <div className="flex items-center gap-2 pt-2 text-[10px] font-mono uppercase tracking-widest text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" /> {queues.amended.length} amended / corrected result(s)
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <Label n="02">External record reconciliation</Label>
        {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
          <div className="space-y-2">
            {queues.pendingReconciliation.map((s) => <StagingCard key={s.id} s={s} onDone={refresh} />)}
            {queues.pendingReconciliation.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Inbox className="w-4 h-4" /> Nothing awaiting reconciliation.
              </div>
            )}
          </div>
        )}
        <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Inbound records never change the chart until accepted here.
        </p>
      </Card>
    </div>
  );
}
