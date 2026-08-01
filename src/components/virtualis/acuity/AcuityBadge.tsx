import { cn } from '@/lib/utils';
import { ACUITY_COLOR, type AcuityLevel } from './AcuitySignalBars';

interface AcuityBadgeProps {
  level: AcuityLevel;
  confidence?: number | null;
  className?: string;
}

/** Small rounded-full acuity pill: LEVEL + confidence%. */
export function AcuityBadge({ level, confidence, className }: AcuityBadgeProps) {
  const color = ACUITY_COLOR[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'font-mono text-[10px] font-semibold uppercase tracking-wider',
        className,
      )}
      style={{ color, borderColor: `${color}59`, backgroundColor: `${color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {level}
      {confidence != null && (
        <span className="text-[10px] font-medium opacity-70 tabular-nums">{Math.round(confidence)}%</span>
      )}
    </span>
  );
}
