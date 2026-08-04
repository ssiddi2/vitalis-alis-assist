import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wifi, WifiOff, RefreshCw, Server, CheckCircle2, Shield, Activity, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface EMRConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital?: {
    name: string;
    emr_system: string;
    connection_status: string | null;
  };
}

interface SyncPayload {
  server: string;
  fhir_version: string;
  synced_at: string;
  latency_ms: number;
  resources: { name: string; count: number }[];
  sample_patient: { id: string; lastUpdated: string | null } | null;
}

export function EMRConnectionModal({ open, onOpenChange, hospital }: EMRConnectionModalProps) {
  const isConnected = hospital?.connection_status === 'connected';
  const [data, setData] = useState<SyncPayload | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      // The FHIR base must be explicitly allowlisted server-side (ALLOWED_FHIR_ISS).
      const iss = import.meta.env.VITE_FHIR_BASE as string | undefined;
      const { data: res, error } = await supabase.functions.invoke<SyncPayload>('fhir-sync', { body: { iss } });
      if (!error && res) setData(res);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (open && isConnected && !data) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isConnected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Server className="h-5 w-5 text-primary" />
            EMR Connection
          </DialogTitle>
          <DialogDescription>
            Live FHIR R4 integration · {hospital?.name || 'this facility'}
          </DialogDescription>
        </DialogHeader>

        <div className={cn(
          'flex items-center gap-3 p-4 rounded-xl border',
          isConnected ? 'bg-success/5 border-success/20' : 'bg-critical/5 border-critical/20'
        )}>
          {isConnected ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-critical" />}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {hospital?.emr_system?.toUpperCase()} {isConnected ? 'Connected' : 'Disconnected'}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {data?.server || 'Bidirectional FHIR R4 · Circuit breaker: closed'}
            </p>
          </div>
          <div className={cn('w-3 h-3 rounded-full', isConnected ? 'bg-success animate-pulse' : 'bg-critical')} />
        </div>

        {data && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-secondary/30">
              <p className="text-[9px] uppercase text-muted-foreground">FHIR</p>
              <p className="text-sm font-mono text-foreground">{data.fhir_version}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/30">
              <p className="text-[9px] uppercase text-muted-foreground">Latency</p>
              <p className="text-sm font-mono text-foreground">{data.latency_ms}ms</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/30">
              <p className="text-[9px] uppercase text-muted-foreground">Synced</p>
              <p className="text-sm font-mono text-foreground">{new Date(data.synced_at).toLocaleTimeString()}</p>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              FHIR Resources {data ? '· Live counts' : ''}
            </p>
          </div>
          <div className="space-y-1.5">
            {(data?.resources || []).map(r => (
              <div key={r.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  <span className="text-xs text-foreground">{r.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{r.count.toLocaleString()}</span>
                  <span className="text-[9px] font-medium text-success">Synced</span>
                </div>
              </div>
            ))}
            {!data && syncing && (
              <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
                <Activity className="w-3 h-3 animate-pulse" /> Querying FHIR endpoint…
              </div>
            )}
          </div>
        </div>

        {data?.sample_patient && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Connectivity Probe
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
              <p className="text-[10px] text-muted-foreground font-mono">
                Resource ID: {data.sample_patient.id}
                {data.sample_patient.lastUpdated ? ` · updated ${data.sample_patient.lastUpdated}` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-9 text-xs rounded-lg gap-1.5"
            disabled={!isConnected || syncing}
            onClick={sync}
          >
            <RefreshCw className={cn('w-3 h-3', syncing && 'animate-spin')} /> {syncing ? 'Syncing…' : 'Force Sync'}
          </Button>
          <Button variant="outline" className="flex-1 h-9 text-xs rounded-lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
