import { Pill, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatientMedications } from '@/hooks/usePatientClinical';
import { MedicationHistoryStaging } from './MedicationHistoryStaging';


interface MedicationsPanelProps {
  patientId: string;
}

const STATUS_ICON: Record<string, { icon: typeof Pill; color: string }> = {
  active: { icon: CheckCircle2, color: 'text-success' },
  discontinued: { icon: XCircle, color: 'text-muted-foreground' },
  hold: { icon: Clock, color: 'text-warning' },
};

export function MedicationsPanel({ patientId }: MedicationsPanelProps) {
  const { data: meds, loading } = usePatientMedications(patientId);


  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Pill className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Active Medications</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
          {meds.filter(m => m.status === 'active').length} active
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : meds.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No medications on file</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meds.map((med) => {
            const cfg = STATUS_ICON[med.status] || STATUS_ICON.active;
            const Icon = cfg.icon;
            return (
              <div key={med.id} className="p-3 rounded-xl bg-card border border-border/50 flex items-start gap-3">
                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{med.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[med.dose, med.route, med.frequency].filter(Boolean).join(' · ')}
                  </p>
                  {med.prescriber && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Rx: {med.prescriber}</p>
                  )}
                </div>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize',
                  med.status === 'active' ? 'bg-success/10 text-success' :
                  med.status === 'hold' ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                )}>
                  {med.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <MedicationHistoryStaging patientId={patientId} />
    </div>
  );
}

