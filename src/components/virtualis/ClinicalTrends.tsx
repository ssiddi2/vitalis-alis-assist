import { ClinicalTrend } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ClinicalTrendsProps {
  trends: ClinicalTrend[];
}

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

export function ClinicalTrends({ trends }: ClinicalTrendsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {trends.map((trend) => {
        const TrendIcon = trendIcons[trend.direction];
        const isUp = trend.direction === 'up';
        const isDown = trend.direction === 'down';
        
        return (
          <div 
            key={trend.id}
            className="card-apple p-4 hover:shadow-soft transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {trend.label}
              </span>
              <div className={cn(
                'p-1.5 rounded-lg border',
                isUp && 'bg-warning/10 border-warning/20',
                isDown && 'bg-critical/10 border-critical/20',
                !isUp && !isDown && 'bg-muted border-border'
              )}>
                <TrendIcon className={cn(
                  'w-3 h-3',
                  isUp && 'text-warning',
                  isDown && 'text-critical',
                  !isUp && !isDown && 'text-muted-foreground'
                )} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-foreground">
                {trend.value}
              </span>
            </div>
            {trend.change && (
              <div className={cn(
                'text-xs mt-1 font-medium',
                isUp && 'text-warning',
                isDown && 'text-critical',
                !isUp && !isDown && 'text-muted-foreground'
              )}>
                {trend.change}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
