import { ClinicalTrend } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ClinicalTrendsProps {
  trends: ClinicalTrend[];
}

export function ClinicalTrends({ trends }: ClinicalTrendsProps) {
  const directionConfig = {
    up: { 
      icon: TrendingUp, 
      color: 'text-critical',
      bg: 'bg-critical/10',
    },
    down: { 
      icon: TrendingDown, 
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    stable: { 
      icon: Minus, 
      color: 'text-muted-foreground',
      bg: 'bg-muted/30',
    },
  };

  return (
    <div className="grid gap-2">
      {trends.map((trend) => {
        const config = directionConfig[trend.direction];
        const Icon = config.icon;
        
        return (
          <div
            key={trend.id}
            className="flex justify-between items-center py-3.5 px-4 rounded-xl bg-secondary/20 border border-border/20 hover:border-border/40 transition-colors group"
          >
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {trend.label}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold font-mono">{trend.value}</span>
              {trend.change && (
                <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.bg, config.color)}>
                  <Icon className="w-3 h-3" />
                  <span>{trend.change}</span>
                </div>
              )}
              {!trend.change && trend.direction !== 'stable' && (
                <div className={cn('p-1 rounded-full', config.bg)}>
                  <Icon className={cn('w-3.5 h-3.5', config.color)} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
