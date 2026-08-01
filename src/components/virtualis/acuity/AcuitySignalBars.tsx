import { cn } from '@/lib/utils';

export type AcuityLevel = 'High' | 'Moderate' | 'Low';

export const ACUITY_COLOR: Record<AcuityLevel, string> = {
  High: '#EF4444',
  Moderate: '#F59E0B',
  Low: '#10B981',
};

const FILLED: Record<AcuityLevel, number> = { High: 3, Moderate: 2, Low: 1 };

interface AcuitySignalBarsProps {
  level: AcuityLevel;
  unread?: boolean;
  className?: string;
}

/** Three vertical bars encoding acuity: 3=High/red, 2=Moderate/amber, 1=Low/green. */
export function AcuitySignalBars({ level, unread = true, className }: AcuitySignalBarsProps) {
  const filled = FILLED[level];
  const color = ACUITY_COLOR[level];

  return (
    <span
      role="img"
      aria-label={`${level} acuity`}
      className={cn('inline-flex items-end gap-[2px]', !unread && 'opacity-40 saturate-50', className)}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-colors"
          style={{
            height: 5 + i * 4,
            backgroundColor: i < filled ? color : 'rgb(226 232 240)',
          }}
        />
      ))}
    </span>
  );
}
