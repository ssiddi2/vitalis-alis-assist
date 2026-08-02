import { ReactNode } from 'react';
import { ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { InsightCard } from './InsightCard';
import { ClinicalTrends } from './ClinicalTrends';
import { generateDemoVitals } from './VitalsPanel';
import { generateDemoLabs } from './LabResultsPanel';
import { usePatientProblems, usePatientMedications } from '@/hooks/usePatientClinical';
import { cn } from '@/lib/utils';
import { Brain, HeartPulse, ClipboardList, Pill, FlaskConical, TrendingUp } from 'lucide-react';

interface OverviewCardProps {
  index: string;
  label: string;
  icon: typeof Brain;
  onViewAll?: () => void;
  className?: string;
  children: ReactNode;
}

function OverviewCard({ index, label, icon: Icon, onViewAll, className, children }: OverviewCardProps) {
  return (
    <section className={cn('rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-soft p-4 flex flex-col', className)}>
      <header className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {index} — {label}
        </h3>
        <span className="flex-1 h-px bg-border/70" />
        {onViewAll && (
          <button onClick={onViewAll} className="text-[11px] font-medium text-primary hover:underline shrink-0">
            View all →
          </button>
        )}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground py-4 text-center">{text}</p>
);

interface ChartOverviewProps {
  patientId: string;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  onNavigate: (tab: string) => void;
}

export function ChartOverview({ patientId, insights, trends, onNavigate }: ChartOverviewProps) {
  const { data: problems } = usePatientProblems(patientId);
  const { data: meds } = usePatientMedications(patientId);
  const vitals = generateDemoVitals().slice(0, 4);
  const labs = generateDemoLabs().slice(0, 5);

  const activeProblems = problems.filter(p => p.status === 'active').slice(0, 5);
  const activeMeds = meds.filter(m => m.status === 'active').slice(0, 5);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OverviewCard index="01" label="Latest Vitals" icon={HeartPulse} onViewAll={() => onNavigate('vitals')}>
          <div className="grid grid-cols-2 gap-2">
            {vitals.map(v => (
              <div key={v.label} className="rounded-xl border border-border/50 bg-background/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground truncate">{v.label}</p>
                <p className="text-lg font-semibold text-foreground leading-tight">
                  {v.value}
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">{v.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </OverviewCard>

        <OverviewCard index="02" label="Active Problems" icon={ClipboardList} onViewAll={() => onNavigate('problems')}>
          {activeProblems.length === 0 ? <Empty text="No active problems" /> : (
            <ul className="space-y-1.5">
              {activeProblems.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-xs text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{p.description}</span>
                  {p.icd10_code && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{p.icd10_code}</span>}
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>

        <OverviewCard index="03" label="Active Medications" icon={Pill} onViewAll={() => onNavigate('meds')}>
          {activeMeds.length === 0 ? <Empty text="No active medications" /> : (
            <ul className="space-y-1.5">
              {activeMeds.map(m => (
                <li key={m.id} className="flex items-baseline gap-2 text-xs text-foreground">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {[m.dose, m.frequency].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>

        <OverviewCard index="04" label="Recent Labs" icon={FlaskConical} onViewAll={() => onNavigate('labs')}>
          <ul className="space-y-1.5">
            {labs.map(l => (
              <li key={l.name} className="flex items-baseline gap-2 text-xs">
                <span className="truncate text-foreground">{l.name}</span>
                <span className={cn('ml-auto font-semibold tabular-nums', l.is_abnormal ? 'text-critical' : 'text-foreground')}>
                  {l.value}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">{l.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </OverviewCard>

        {trends.length > 0 && (
          <OverviewCard index="05" label="Clinical Trends" icon={TrendingUp} className="md:col-span-2">
            <ClinicalTrends trends={trends} />
          </OverviewCard>
        )}
      </div>

      <OverviewCard index="00" label="ALIS — What Matters Now" icon={Brain} className="xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto">
        {insights.length === 0 ? <Empty text="No active insights" /> : (
          <div className="space-y-3">
            {insights.map(i => <InsightCard key={i.id} insight={i} />)}
          </div>
        )}
      </OverviewCard>
    </div>
  );
}
