import { ClinicalInsight } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface InsightCardProps {
  insight: ClinicalInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const severityConfig = {
    critical: {
      border: 'border-critical/50',
      bg: 'bg-critical/5',
      glow: 'glow-critical',
      badge: 'bg-critical text-critical-foreground',
      icon: AlertCircle,
    },
    warning: {
      border: 'border-warning/50',
      bg: 'bg-warning/5',
      glow: 'glow-warning',
      badge: 'bg-warning text-warning-foreground',
      icon: AlertTriangle,
    },
    info: {
      border: 'border-info/50',
      bg: 'bg-info/5',
      glow: '',
      badge: 'bg-info text-info-foreground',
      icon: Info,
    },
    success: {
      border: 'border-success/50',
      bg: 'bg-success/5',
      glow: '',
      badge: 'bg-success text-success-foreground',
      icon: CheckCircle,
    },
  };

  const config = insight.severity ? severityConfig[insight.severity] : null;
  const Icon = config?.icon || Info;

  return (
    <div
      className={cn(
        'relative rounded-2xl p-5 transition-all duration-300 border overflow-hidden group',
        config ? `${config.border} ${config.bg}` : 'border-border/30 bg-secondary/20',
        config?.glow && 'hover:' + config.glow
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            {config && (
              <div className={cn('p-2 rounded-lg', config.bg)}>
                <Icon className={cn('w-4 h-4', insight.severity === 'critical' ? 'text-critical' : insight.severity === 'warning' ? 'text-warning' : 'text-muted-foreground')} />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold">{insight.title}</h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                {insight.timestamp}
              </span>
            </div>
          </div>
          {insight.severity && (
            <span
              className={cn(
                'text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide',
                config?.badge
              )}
            >
              {insight.severity}
            </span>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {insight.description}
        </p>
        
        <div className="flex flex-wrap gap-1.5">
          {insight.sources.map((source, index) => (
            <span
              key={index}
              className="text-[10px] px-2.5 py-1 bg-background/50 border border-border/50 rounded-full font-mono text-muted-foreground"
            >
              {source}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
