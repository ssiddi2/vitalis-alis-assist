import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDsiEntry } from '@/data/dsiRegistry';

/** Point-of-care intelligibility: a tiny model-card popover for a DSI. */
export function DsiInfo({ interventionId }: { interventionId: string }) {
  const entry = getDsiEntry(interventionId);
  if (!entry) return null;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`About ${entry.name}`}
        className="text-slate-400 hover:text-primary transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-2xl border-slate-200 bg-white/90 backdrop-blur-sm shadow-lg p-4 space-y-2.5"
      >
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            01 — Model card
          </span>
          <p className="text-sm font-semibold text-slate-900 leading-tight mt-1">{entry.name}</p>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{entry.intendedUse}</p>
        <div className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Models</span>
          <p className="text-xs text-slate-600">{entry.models}</p>
        </div>
        <p className="text-xs font-medium text-primary">AI-generated — clinician reviews and decides.</p>
        <div className="space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Cautions</span>
          <p className="text-xs text-slate-600 leading-relaxed">{entry.cautions}</p>
        </div>
        <Link
          to="/governance"
          className="inline-block text-xs font-medium text-primary hover:underline"
        >
          View full AI governance →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
