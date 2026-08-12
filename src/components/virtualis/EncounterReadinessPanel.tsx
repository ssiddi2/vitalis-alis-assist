import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEncounterSafety } from '@/hooks/useEncounterSafety';
import {
  ENCOUNTER_FLOW,
  ENCOUNTER_STATUS_LABEL,
  StaleEncounterError,
  transitionEncounter,
  type EncounterStatus,
} from '@/lib/encounterLifecycle';

interface Props {
  encounterId: string;
  patientId: string;
  hospitalId: string;
  status: string;
  className?: string;
}

const BlockList = ({ items }: { items: string[] }) => (
  <ul className="space-y-1">
    {items.map((b) => (
      <li key={b} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
        <span>{b}</span>
      </li>
    ))}
  </ul>
);

/** Compact, server-truth readiness checklist + enforced lifecycle controls. */
export function EncounterReadinessPanel({ encounterId, patientId, hospitalId, status, className }: Props) {
  const { readiness, diagnoses, events, loading, refresh, addDiagnosis, removeDiagnosis } =
    useEncounterSafety(encounterId);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');

  const current = readiness?.status ?? status;
  const lockVersion = readiness?.lock_version ?? 0;
  const next = ENCOUNTER_FLOW[current] ?? [];

  const move = async (to: EncounterStatus) => {
    setBusy(true);
    try {
      await transitionEncounter(encounterId, to, lockVersion);
      toast.success(`Visit moved to ${ENCOUNTER_STATUS_LABEL[to]}`);
      await refresh();
    } catch (err) {
      if (err instanceof StaleEncounterError) await refresh();
      toast.error(err instanceof Error ? err.message : 'Transition rejected');
    } finally {
      setBusy(false);
    }
  };

  const addDx = async () => {
    if (!code.trim() || !desc.trim()) return;
    try {
      await addDiagnosis({ icd10_code: code, description: desc, patient_id: patientId, hospital_id: hospitalId });
      setCode('');
      setDesc('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add diagnosis');
    }
  };

  const startBlocks = readiness?.start_blocks ?? [];
  const completeBlocks = readiness?.complete_blocks ?? [];
  const open = !['completed', 'cancelled', 'no_show'].includes(current);

  return (
    <section className={cn('rounded-2xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-sm', className)}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          07 — Encounter Readiness
        </h3>
        <span className="h-px flex-1 bg-border/70" />
        <Badge variant="outline" className="rounded-full text-[10px]">
          {ENCOUNTER_STATUS_LABEL[current] ?? current}
        </Badge>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/50 p-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Start of care</p>
          {startBlocks.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> All start prerequisites met
            </p>
          ) : (
            <BlockList items={startBlocks} />
          )}
        </div>
        <div className="rounded-xl border border-border/50 p-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Completion</p>
          {completeBlocks.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[11px] text-success">
              <CheckCircle2 className="h-3 w-3" /> Ready to complete
            </p>
          ) : (
            <BlockList items={completeBlocks} />
          )}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border/50 p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Encounter diagnoses</p>
        <div className="flex flex-wrap gap-1.5">
          {diagnoses.length === 0 && <span className="text-[11px] text-muted-foreground">None recorded</span>}
          {diagnoses.map((d) => (
            <Badge key={d.id} variant="secondary" className="gap-1 rounded-full text-[10px]">
              <span className="font-mono">{d.icd10_code}</span> {d.description}
              {open && (
                <button aria-label={`Remove ${d.icd10_code}`} onClick={() => void removeDiagnosis(d.id)}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        {open && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} placeholder="ICD-10"
              className="h-8 w-28 rounded-lg text-xs" />
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} placeholder="Description"
              className="h-8 flex-1 min-w-[10rem] rounded-lg text-xs" />
            <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg text-xs" onClick={() => void addDx()}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {next.map((to) => {
          const blocked =
            (to === 'in_progress' && !readiness?.can_start) || (to === 'completed' && !readiness?.can_complete);
          return (
            <Button
              key={to}
              size="sm"
              disabled={busy || blocked}
              variant={to === 'cancelled' || to === 'no_show' ? 'ghost' : 'default'}
              className="h-8 rounded-lg text-xs"
              onClick={() => void move(to as EncounterStatus)}
            >
              {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {ENCOUNTER_STATUS_LABEL[to]}
            </Button>
          );
        })}
        {!open && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ClipboardCheck className="h-3 w-3" /> Record locked — corrections via note addenda or admin reopen.
          </span>
        )}
      </div>

      {events.length > 0 && (
        <ol className="mt-3 space-y-1 border-t border-border/50 pt-2">
          {events.slice(0, 5).map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono">{new Date(ev.created_at).toLocaleTimeString()}</span>
              <span>
                {ev.from_status ? `${ev.from_status} → ${ev.to_status}` : ev.event_code}
                {ev.reason ? ` · ${ev.reason}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
