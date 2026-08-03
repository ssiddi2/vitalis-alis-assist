import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import { useHospital } from '@/contexts/HospitalContext';
import { useAcuity, type AcuityResult } from '@/hooks/useAcuity';
import { AcuityBadge } from './AcuityBadge';
import { AcuitySignalBars } from './AcuitySignalBars';
import { DsiInfo } from '@/components/virtualis/DsiInfo';
import { cn } from '@/lib/utils';

interface LiveAcuityCardProps {
  patientInfo?: string;
  clinicalReason: string;
  additionalNotes?: string;
  patientId?: string | null;
  onSpecialtySelect?: (specialty: string) => void;
  selectedSpecialty?: string;
  className?: string;
}

const RESPONSE_LABEL: Record<string, string> = {
  immediate: 'Immediate',
  within_15_min: 'Within 15 min',
  within_1_hour: 'Within 1 hour',
  routine: 'Routine',
};

/** Real-time ALIS acuity assessment card — debounced, never blocks typing. */
export function LiveAcuityCard({
  patientInfo,
  clinicalReason,
  additionalNotes,
  patientId,
  onSpecialtySelect,
  selectedSpecialty,
  className,
}: LiveAcuityCardProps) {
  const { selectedHospital } = useHospital();
  const { scoreMessage } = useAcuity();
  const [result, setResult] = useState<AcuityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const reason = clinicalReason.trim();

  useEffect(() => {
    if (!selectedHospital?.id || reason.length < 8) {
      setResult(null);
      setFailed(false);
      return;
    }
    let active = true;
    const handle = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      const text = [patientInfo, reason, additionalNotes].filter(Boolean).join('\n');
      const res = await scoreMessage({
        hospitalId: selectedHospital.id,
        messageText: text,
        patientId: patientId ?? null,
      });
      if (!active) return;
      setLoading(false);
      if (res) setResult(res);
      else setFailed(true);
    }, 1200);
    return () => { active = false; clearTimeout(handle); };
  }, [reason, patientInfo, additionalNotes, patientId, selectedHospital?.id, scoreMessage]);

  if (reason.length < 8) return null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm p-4 shadow-sm space-y-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          01 — AI Clinical Assessment
        </span>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          <DsiInfo interventionId="acuity-engine" />
        </div>
      </div>

      {!result && loading && (
        <p className="text-xs text-slate-500">ALIS is triaging this message…</p>
      )}

      {!result && !loading && failed && (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5" /> Assessment unavailable — you can still submit.
        </p>
      )}

      {result && (
        <>
          <div className="flex items-center gap-2">
            <AcuitySignalBars level={result.suggestedUrgency} />
            <AcuityBadge level={result.suggestedUrgency} confidence={result.confidence} />
            {result.estimatedResponseTime && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" />
                {RESPONSE_LABEL[result.estimatedResponseTime] || result.estimatedResponseTime}
              </span>
            )}
          </div>

          {result.reasoning && (
            <p className="text-xs leading-relaxed text-slate-700">{result.reasoning}</p>
          )}

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Suggested specialty
            </span>
            <p className="text-sm font-semibold text-slate-900">{result.suggestedSpecialty}</p>
            {result.suggestedSpecialties?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {result.suggestedSpecialties.map(s => (
                  <button
                    key={s.name}
                    type="button"
                    title={s.reasoning}
                    onClick={() => onSpecialtySelect?.(s.name)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      selectedSpecialty === s.name
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary',
                    )}
                  >
                    {s.name}
                    <span className="ml-1 opacity-60 tabular-nums">{Math.round(s.confidence)}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {result.immediateActions?.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Immediate actions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {result.immediateActions.map((a, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
