import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Wifi, WifiOff, RefreshCw, Server, CheckCircle2, XCircle, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EMRConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital?: {
    name: string;
    emr_system: string;
    connection_status: string | null;
  };
}

const FHIR_RESOURCES = [
  { name: 'Patient Demographics', status: 'synced', count: 248 },
  { name: 'Encounters', status: 'synced', count: 1842 },
  { name: 'Observations (Vitals)', status: 'synced', count: 12340 },
  { name: 'DiagnosticReport', status: 'synced', count: 3421 },
  { name: 'MedicationRequest', status: 'partial', count: 892 },
  { name: 'AllergyIntolerance', status: 'synced', count: 456 },
  { name: 'Condition (Problems)', status: 'synced', count: 1567 },
  { name: 'Procedure', status: 'pending', count: 0 },
];

const statusConfig = {
  synced: { icon: CheckCircle2, color: 'text-success', label: 'Synced' },
  partial: { icon: Clock, color: 'text-warning', label: 'Partial' },
  pending: { icon: XCircle, color: 'text-muted-foreground', label: 'Pending' },
};

export function EMRConnectionModal({ open, onOpenChange, hospital }: EMRConnectionModalProps) {
  const isConnected = hospital?.connection_status === 'connected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Server className="h-5 w-5 text-primary" />
            EMR Connection
          </DialogTitle>
          <DialogDescription>
            FHIR R4 integration status for {hospital?.name || 'this facility'}
          </DialogDescription>
        </DialogHeader>

        {/* Connection Status */}
        <div className={cn(
          'flex items-center gap-3 p-4 rounded-xl border',
          isConnected ? 'bg-success/5 border-success/20' : 'bg-critical/5 border-critical/20'
        )}>
          {isConnected ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-critical" />}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {hospital?.emr_system?.toUpperCase()} {isConnected ? 'Connected' : 'Disconnected'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isConnected ? 'Bidirectional FHIR R4 · Circuit breaker: closed' : 'Check network or credentials'}
            </p>
          </div>
          <div className={cn('w-3 h-3 rounded-full', isConnected ? 'bg-success animate-pulse' : 'bg-critical')} />
        </div>

        {/* FHIR Resources */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">FHIR Resources</p>
          </div>
          <div className="space-y-1.5">
            {FHIR_RESOURCES.map(r => {
              const cfg = statusConfig[r.status as keyof typeof statusConfig];
              const Icon = cfg.icon;
              return (
                <div key={r.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-3 h-3', cfg.color)} />
                    <span className="text-xs text-foreground">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.count > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">{r.count.toLocaleString()}</span>
                    )}
                    <span className={cn('text-[9px] font-medium', cfg.color)}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-9 text-xs rounded-lg gap-1.5" disabled={!isConnected}>
            <RefreshCw className="w-3 h-3" /> Force Sync
          </Button>
          <Button variant="outline" className="flex-1 h-9 text-xs rounded-lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
