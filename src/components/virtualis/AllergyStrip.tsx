import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatientAllergies } from '@/hooks/usePatientClinical';

interface AllergyStripProps {
  patientId: string;
  onViewAll?: () => void;
}

export function AllergyStrip({ patientId, onViewAll }: AllergyStripProps) {
  const { data: allergies, loading } = usePatientAllergies(patientId);
  const active = allergies.filter(a => a.severity !== 'resolved');

  if (loading) return <div className="h-10 rounded-2xl bg-muted/60 animate-pulse mb-4" />;

  const hasAllergies = active.length > 0;

  return (
    <div
      className={cn(
        'mb-5 flex items-center gap-3 flex-wrap rounded-2xl border px-4 py-2.5 shadow-soft backdrop-blur-sm',
        hasAllergies ? 'border-critical/30 bg-critical/5' : 'border-border/60 bg-card/60'
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {hasAllergies ? (
          <ShieldAlert className="w-3.5 h-3.5 text-critical" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
        )}
        Allergies
      </span>

      {hasAllergies ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {active.map(a => (
            <span
              key={a.id}
              title={a.reaction || undefined}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-critical/10 text-critical border border-critical/25"
            >
              {a.allergen}
              {a.severity && <span className="ml-1.5 font-normal opacity-70">{a.severity}</span>}
            </span>
          ))}
        </div>
      ) : (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-success/10 text-success border border-success/20">
          No known allergies
        </span>
      )}

      {onViewAll && (
        <button
          onClick={onViewAll}
          className="ml-auto text-[11px] font-medium text-primary hover:underline"
        >
          View all →
        </button>
      )}
    </div>
  );
}
