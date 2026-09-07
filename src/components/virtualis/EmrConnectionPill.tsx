import { Loader2, PlugZap, AlertTriangle, HardDrive } from 'lucide-react';
import { useHospital } from '@/contexts/HospitalContext';
import { cn } from '@/lib/utils';

const EMR_LABEL: Record<string, string> = { epic: 'Epic', cerner: 'Cerner', meditech: 'Meditech' };

/** Persistent external-EHR status for the ACTIVE facility. Standalone is the normal state. */
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
        : status === 'unavailable'
          ? 'border-border bg-muted/40 text-muted-foreground'
          : status === 'standalone'
            ? 'border-slate-200 bg-slate-100 text-slate-500'
            : 'border-primary/25 bg-primary/5 text-primary';

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider',
        tone,
        className,
      )}
      title={
        emrConnection.sandbox
          ? 'Synthetic sandbox issuer (non-production)'
          : status === 'standalone'
            ? 'virtualisONE is running standalone — external EHR exchange is optional and not configured for this facility'
            : emrConnection.reason === 'smart_session_not_bound_to_facility'
              ? 'A SMART session exists but is not bound to this facility'
              : status === 'unavailable'
                ? 'No verified EMR connection is configured for this facility'
                : undefined
      }
    >
      {status === 'connecting' ? (
        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
      ) : status === 'error' || status === 'unavailable' ? (
        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      ) : status === 'standalone' ? (
        <HardDrive className="h-3 w-3 flex-shrink-0" />
      ) : (
        <PlugZap className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="truncate">
        {status === 'connecting' && `Connecting to ${emr}…`}
        {status === 'error' && `${emr} error`}
        {status === 'unavailable' && `${emr} not connected`}
        {status === 'standalone' && (
          <>
            Standalone
            <span className="hidden md:inline"> · External EHR not configured</span>
          </>
        )}
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

