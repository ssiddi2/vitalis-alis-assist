import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrugInteractionAlertProps {
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: 'high' | 'moderate' | 'low';
    description: string;
  }>;
  className?: string;
}

const severityConfig = {
  high: { bg: 'bg-critical/10 border-critical/30', text: 'text-critical', label: 'High Risk' },
  moderate: { bg: 'bg-warning/10 border-warning/30', text: 'text-warning', label: 'Moderate' },
  low: { bg: 'bg-info/10 border-info/30', text: 'text-info', label: 'Low Risk' },
};

export function DrugInteractionAlert({ interactions, className }: DrugInteractionAlertProps) {
  if (interactions.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {interactions.map((ix, i) => {
        const cfg = severityConfig[ix.severity];
        return (
          <div key={i} className={cn('flex items-start gap-2.5 p-3 rounded-xl border', cfg.bg)}>
            {ix.severity === 'high' ? (
              <ShieldAlert className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.text)} />
            ) : (
              <AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cfg.text)} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.text)}>{cfg.label}</span>
              </div>
              <p className="text-xs font-medium text-foreground">
                {ix.drug1} × {ix.drug2}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{ix.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
