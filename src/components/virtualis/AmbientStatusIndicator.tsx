import { Mic, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AmbientStatusIndicatorProps {
  isAmbient: boolean;
  onToggle: () => void;
  className?: string;
}

export function AmbientStatusIndicator({ isAmbient, onToggle, className }: AmbientStatusIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all',
            isAmbient
              ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
              : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/20',
            className
          )}
        >
          {isAmbient ? (
            <>
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[10px] font-semibold">ALIS Listening</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">Ambient Off</span>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isAmbient
          ? 'ALIS is listening for voice commands. Say "Hey ALIS" followed by your request.'
          : 'Enable ambient mode for hands-free ALIS interaction'
        }
      </TooltipContent>
    </Tooltip>
  );
}
