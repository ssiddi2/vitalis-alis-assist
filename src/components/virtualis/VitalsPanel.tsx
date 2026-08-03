import { ClinicalTrend } from '@/types/clinical';
import { usePatientVitals } from '@/hooks/usePatientClinical';
import { HeartPulse, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VitalsPanelProps {
  patientId?: string;
  trends: ClinicalTrend[];
}

const DIRECTION_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus } as const;
const DIRECTION_CLASS = {
  up: 'text-[#EF4444]',
  down: 'text-[#F59E0B]',
  stable: 'text-muted-foreground',
} as const;

export function VitalsPanel({ patientId, trends }: VitalsPanelProps) {
  const { data: vitals, loading } = usePatientVitals(patientId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse className="w-4 h-4 text-primary" />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          01 — Vital Signs
        </h3>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading vitals…</p>
      ) : vitals.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No vitals recorded</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {vitals.map((vital) => {
            const Icon = DIRECTION_ICON[vital.direction];
            return (
              <div
                key={vital.label}
                className="p-3 sm:p-4 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-soft min-w-0"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <HeartPulse className="w-4 h-4 text-muted-foreground" />
                  <Icon className={cn('w-3.5 h-3.5', DIRECTION_CLASS[vital.direction])} />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums truncate">
                  {vital.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={`${vital.label} · ${vital.unit}`}>
                  {vital.label}{vital.unit && ` · ${vital.unit}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {trends.length > 0 && (
        <div className="mt-4 p-3 rounded-2xl bg-secondary/50 border border-border/50">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            02 — Trend Summary
          </p>
          <div className="space-y-1">
            {trends.map((t) => (
              <div key={t.id} className="flex justify-between gap-2 text-xs">
                <span className="text-foreground truncate">{t.label}</span>
                <span className="text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                  {t.value} {t.change && `(${t.change})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
