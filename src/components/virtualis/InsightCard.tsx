import { ClinicalInsight } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface InsightCardProps {
  insight: ClinicalInsight;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    cardClass: 'border-critical/30 bg-critical/5',
    iconClass: 'text-critical',
    badgeClass: 'bg-critical/10 text-critical border-critical/20',
  },
  warning: {
    icon: AlertCircle,
    cardClass: 'border-warning/30 bg-warning/5',
    iconClass: 'text-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
  },
  info: {
    icon: Info,
    cardClass: 'border-info/30 bg-info/5',
    iconClass: 'text-info',
    badgeClass: 'bg-info/10 text-info border-info/20',
  },
  success: {
    icon: CheckCircle,
    cardClass: 'border-success/30 bg-success/5',
    iconClass: 'text-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },
};

export function InsightCard({ insight }: InsightCardProps) {
  const config = insight.severity ? severityConfig[insight.severity] : null;
  const Icon = config?.icon || Info;

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all hover:shadow-soft',
      config ? config.cardClass : 'border-border bg-secondary/30'
    )}>
      <div className="flex gap-3">
        {config && (
          <div className={cn('mt-0.5 flex-shrink-0', config.iconClass)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
            {insight.severity && config && (
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider',
                config.badgeClass
              )}>
                {insight.severity}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {insight.sources.map((source, idx) => (
              <span key={idx} className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border">
                {source}
              </span>
            ))}
            <span className="text-xs text-muted-foreground/60">
              {insight.timestamp}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
