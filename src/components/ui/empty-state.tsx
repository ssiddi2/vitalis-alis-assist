import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  tone?: 'default' | 'positive';
}

/** On-brand first-run / sparse-data placeholder. Never leave a blank area. */
export function EmptyState({ icon: Icon, title, hint, action, className, tone = 'default' }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'glass flex flex-col items-center justify-center rounded-2xl border border-border px-6 py-14 text-center shadow-sm',
        className,
      )}
    >
      <Icon className={cn('mb-3 h-8 w-8', tone === 'positive' ? 'text-emerald-500' : 'text-muted-foreground/50')} />
      <p className="text-base font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
