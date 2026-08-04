import { Loader2, PlugZap, AlertTriangle } from 'lucide-react';
import { useHospital } from '@/contexts/HospitalContext';
import { cn } from '@/lib/utils';

const EMR_LABEL: Record<string, string> = { epic: 'Epic', cerner: 'Cerner', meditech: 'Meditech' };

/** Persistent EMR connection status for the ACTIVE facility. */
export function EmrConnectionPill({ className }: { className?: string }) {
  const { emrConnection, selectedHospital } = useHospital();
  if (!emrConnection) return null;

  const emr = EMR_LABEL[emrConnection.emr] ?? emrConnection.emr;
  const { status } = emrConnection;

  const tone =
    status === 'connected'
      ? 'border-success/25 bg-success/10 text-success'
      : status === 'error'
        ? 'border-critical/25 bg-critical/10 text-critical'
        : 'border-primary/25 bg-primary/5 text-primary';

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider',
        tone,
        className,
      )}
      title={emrConnection.sandbox ? 'Synthetic sandbox issuer (non-production)' : undefined}
    >
      {status === 'connecting' ? (
        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
      ) : status === 'error' ? (
        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      ) : (
        <PlugZap className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="truncate">
        {status === 'connecting' && `Connecting to ${emr}…`}
        {status === 'error' && `${emr} unavailable`}
        {status === 'connected' && (
          <>
            Connected · {emr}
            <span className="hidden md:inline"> · {selectedHospital?.name}</span>
          </>
        )}
      </span>
      {status === 'connected' && emrConnection.sandbox && (
        <span className="hidden flex-shrink-0 rounded-full bg-success/15 px-1.5 text-[9px] lg:inline">sandbox</span>
      )}
    </div>
  );
}
