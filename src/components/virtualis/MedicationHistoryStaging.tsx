import { useMedicationHistoryStaging } from '@/hooks/useErx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Import, Check, X } from 'lucide-react';

/**
 * Unverified external medication history. Nothing here touches the active
 * medication list until a clinician accepts the individual candidate.
 */
export function MedicationHistoryStaging({ patientId }: { patientId: string }) {
  const { candidates, loading, review } = useMedicationHistoryStaging(patientId);

  if (loading || candidates.length === 0) return null;

  const act = async (c: Parameters<typeof review>[0], accept: boolean) => {
    try {
      await review(c, accept);
      toast.success(accept ? 'Added to medication list' : 'Candidate rejected');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Import className="w-3.5 h-3.5 text-primary" />
        <p className="font-mono uppercase tracking-widest text-[9px] text-muted-foreground">
          Unverified external history · {candidates.length} to reconcile
        </p>
      </div>
      <div className="space-y-2">
        {candidates.map(c => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{c.medication_text}</p>
              <p className="text-[10px] text-muted-foreground">
                {[c.dose, c.route, c.frequency].filter(Boolean).join(' · ')} · source {c.source}{c.source_version ? ` ${c.source_version}` : ''}
              </p>
            </div>
            <Button size="sm" className="h-6 rounded-lg text-[10px] gap-1" onClick={() => act(c, true)}><Check className="w-3 h-3" />Accept</Button>
            <Button size="sm" variant="ghost" className="h-6 rounded-lg text-[10px] gap-1 text-critical" onClick={() => act(c, false)}><X className="w-3 h-3" />Reject</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
