import { ClinicalTrend } from '@/types/clinical';
import { HeartPulse, Thermometer, Wind, Droplets, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VitalsPanelProps {
  trends: ClinicalTrend[];
}

interface VitalSign {
  label: string;
  value: string;
  unit: string;
  icon: typeof HeartPulse;
  status: 'normal' | 'warning' | 'critical';
}

function generateDemoVitals(): VitalSign[] {
  return [
    { label: 'Heart Rate', value: '88', unit: 'bpm', icon: HeartPulse, status: 'normal' },
    { label: 'Blood Pressure', value: '142/88', unit: 'mmHg', icon: Activity, status: 'warning' },
    { label: 'SpO2', value: '96', unit: '%', icon: Droplets, status: 'normal' },
    { label: 'Temperature', value: '37.8', unit: '°C', icon: Thermometer, status: 'warning' },
    { label: 'Respiratory Rate', value: '18', unit: '/min', icon: Wind, status: 'normal' },
  ];
}

const statusColors: Record<string, string> = {
  normal: 'border-success/30 bg-success/5',
  warning: 'border-warning/30 bg-warning/5',
  critical: 'border-critical/30 bg-critical/5',
};

const statusDot: Record<string, string> = {
  normal: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-critical',
};

export function VitalsPanel({ trends }: VitalsPanelProps) {
  const vitals = generateDemoVitals();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Vital Signs</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">Last recorded: 2h ago</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {vitals.map((vital) => {
          const Icon = vital.icon;
          return (
            <div
              key={vital.label}
              className={cn('p-4 rounded-xl border', statusColors[vital.status])}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div className={cn('w-2 h-2 rounded-full', statusDot[vital.status])} />
              </div>
              <p className="text-2xl font-bold text-foreground font-mono">{vital.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{vital.label} · {vital.unit}</p>
            </div>
          );
        })}
      </div>

      {trends.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-secondary/50 border border-border/50">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trend Summary</p>
          <div className="space-y-1">
            {trends.map((t) => (
              <div key={t.id} className="flex justify-between text-xs">
                <span className="text-foreground">{t.label}</span>
                <span className="text-muted-foreground font-mono">{t.value} {t.change && `(${t.change})`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
