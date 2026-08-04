import { FlaskConical, Minus, AlertTriangle } from 'lucide-react';
import { usePatientLabs, type LabResult } from '@/hooks/usePatientClinical';
import { cn } from '@/lib/utils';

interface LabResultsProps {
  patientId: string;
}

const Flag = ({ lab }: { lab: LabResult }) =>
  lab.is_abnormal
    ? <AlertTriangle className="w-3 h-3 text-[#EF4444]" />
    : <Minus className="w-3 h-3 text-muted-foreground" />;

export function LabResultsPanel({ patientId }: LabResultsProps) {
  const { data: labs, loading } = usePatientLabs(patientId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          01 — Lab Results
        </h3>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading labs…</p>
      ) : labs.length === 0 ? (
        <div className="py-6 text-center">
          <FlaskConical className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No lab results recorded</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">Results appear here as soon as the lab resulted or synced.</p>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-2 sm:hidden">
            {labs.map((lab) => (
              <div
                key={lab.id}
                className={cn(
                  'rounded-2xl border border-border/50 p-3',
                  lab.is_abnormal && 'bg-[#EF4444]/5 border-[#EF4444]/30',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {lab.is_abnormal && <AlertTriangle className="w-3 h-3 text-[#EF4444] flex-shrink-0" />}
                    <span className={cn('text-xs font-semibold truncate', lab.is_abnormal ? 'text-[#EF4444]' : 'text-foreground')}>
                      {lab.test_name}
                    </span>
                  </div>
                  {lab.panel && <span className="text-[10px] text-muted-foreground truncate">{lab.panel}</span>}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className={cn('text-lg font-bold font-mono tabular-nums', lab.is_abnormal ? 'text-[#EF4444]' : 'text-foreground')}>
                    {lab.value}
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">{lab.unit}</span>
                  </span>
                  {lab.reference_range && (
                    <span className="text-[10px] text-muted-foreground font-mono">Ref: {lab.reference_range}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-2 bg-muted/50 font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Test</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Unit</span>
                  <span className="text-right">Ref Range</span>
                  <span className="text-center">Flag</span>
                </div>
                {labs.map((lab) => (
                  <div
                    key={lab.id}
                    className={cn(
                      'grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-2.5 items-center text-xs border-t border-border/50',
                      lab.is_abnormal && 'bg-[#EF4444]/5',
                    )}
                  >
                    <span className={cn('font-medium truncate', lab.is_abnormal ? 'text-[#EF4444]' : 'text-foreground')}>
                      {lab.test_name}
                    </span>
                    <span className={cn('text-right font-mono font-semibold tabular-nums', lab.is_abnormal ? 'text-[#EF4444]' : 'text-foreground')}>
                      {lab.value}
                    </span>
                    <span className="text-right text-muted-foreground">{lab.unit}</span>
                    <span className="text-right text-muted-foreground font-mono">{lab.reference_range}</span>
                    <div className="flex justify-center"><Flag lab={lab} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
