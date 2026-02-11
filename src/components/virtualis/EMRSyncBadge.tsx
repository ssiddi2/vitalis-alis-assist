import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EMRSyncBadgeProps {
  emrSystem?: string;
  connectionStatus?: string | null;
  className?: string;
}

export function EMRSyncBadge({ emrSystem, connectionStatus, className }: EMRSyncBadgeProps) {
  const isConnected = connectionStatus === 'connected';
  const syncTime = '2m ago'; // Would be dynamic with real EMR

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium cursor-default transition-colors',
          isConnected
            ? 'bg-success/5 border-success/20 text-success'
            : 'bg-muted border-border text-muted-foreground',
          className
        )}>
          {isConnected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span className="uppercase">{emrSystem || 'EMR'}</span>
          {isConnected && <RefreshCw className="w-2.5 h-2.5 opacity-60" />}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isConnected
          ? `Connected to ${emrSystem?.toUpperCase()} · Last sync: ${syncTime}`
          : `${emrSystem?.toUpperCase() || 'EMR'} disconnected`
        }
      </TooltipContent>
    </Tooltip>
  );
}
