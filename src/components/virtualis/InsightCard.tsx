import { ClinicalInsight } from '@/types/clinical';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  insight: ClinicalInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const severityStyles = {
    critical: 'border-critical bg-critical/5',
    warning: 'border-warning bg-warning/5',
    info: 'border-info bg-info/5',
    success: 'border-success bg-success/5',
  };

  const badgeStyles = {
    critical: 'bg-critical text-critical-foreground',
    warning: 'bg-warning text-warning-foreground',
    info: 'bg-info text-info-foreground',
    success: 'bg-success text-success-foreground',
  };

  return (
    <div
      className={cn(
        'bg-secondary border rounded-xl p-5 transition-all',
        insight.severity ? severityStyles[insight.severity] : 'border-border'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold mb-1">{insight.title}</h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            {insight.timestamp}
          </span>
        </div>
        {insight.severity && (
          <span
            className={cn(
              'text-[10px] px-2 py-1 rounded font-semibold uppercase tracking-wide',
              badgeStyles[insight.severity]
            )}
          >
            {insight.severity}
          </span>
        )}
      </div>
      
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
        {insight.description}
      </p>
      
      <div className="flex flex-wrap gap-1.5">
        {insight.sources.map((source, index) => (
          <span
            key={index}
            className="text-[11px] px-2 py-1 bg-background/50 border border-border rounded font-mono text-muted-foreground"
          >
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}
