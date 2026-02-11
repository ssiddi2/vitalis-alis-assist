import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Allergy {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: string;
  onset_date: string | null;
}

interface AllergiesPanelProps {
  patientId: string;
}

const severityColors: Record<string, string> = {
  mild: 'bg-success/10 text-success border-success/20',
  moderate: 'bg-warning/10 text-warning border-warning/20',
  severe: 'bg-critical/10 text-critical border-critical/20',
};

export function AllergiesPanel({ patientId }: AllergiesPanelProps) {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from('patient_allergies')
        .select('*')
        .eq('patient_id', patientId)
        .order('severity', { ascending: false });
      setAllergies((data as Allergy[]) || []);
      setLoading(false);
    }
    fetch();
  }, [patientId]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-4 h-4 text-critical" />
        <h3 className="text-sm font-semibold text-foreground">Allergies</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
          {allergies.length}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : allergies.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No Known Drug Allergies (NKDA)</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allergies.map((a) => (
            <div key={a.id} className={cn('p-3 rounded-xl border flex items-start gap-3', severityColors[a.severity] || severityColors.moderate)}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{a.allergen}</p>
                {a.reaction && <p className="text-[10px] opacity-80 mt-0.5">Reaction: {a.reaction}</p>}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{a.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
