import { ClinicalTrend } from '@/types/clinical';
import { cn } from '@/lib/utils';

interface ClinicalTrendsProps {
  trends: ClinicalTrend[];
}

export function ClinicalTrends({ trends }: ClinicalTrendsProps) {
  const directionStyles = {
    up: 'text-critical',
    down: 'text-warning',
    stable: 'text-muted-foreground',
  };

  return (
    <div className="space-y-0">
      {trends.map((trend) => (
        <div
          key={trend.id}
          className="flex justify-between items-center py-3 border-b border-border last:border-b-0"
        >
          <span className="text-sm text-muted-foreground">{trend.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold font-mono">{trend.value}</span>
            {trend.change && (
              <span className={cn('text-xs', directionStyles[trend.direction])}>
                {trend.change}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
