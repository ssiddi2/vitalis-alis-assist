import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Problem {
  id: string;
  description: string;
  icd10_code: string | null;
  status: string;
  onset_date: string | null;
  resolved_date: string | null;
}

interface ProblemListPanelProps {
  patientId: string;
}

export function ProblemListPanel({ patientId }: ProblemListPanelProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from('patient_problems')
        .select('*')
        .eq('patient_id', patientId)
        .order('status', { ascending: true })
        .order('onset_date', { ascending: false });
      setProblems((data as Problem[]) || []);
      setLoading(false);
    }
    fetch();
  }, [patientId]);

  const active = problems.filter(p => p.status === 'active');
  const resolved = problems.filter(p => p.status === 'resolved');

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Problem List</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
          {active.length} active
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No problems documented</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active</p>
              <div className="space-y-1.5">
                {active.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border/50">
                    <Circle className="w-3 h-3 text-critical flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{p.description}</p>
                      {p.onset_date && <p className="text-[10px] text-muted-foreground">Since {new Date(p.onset_date).toLocaleDateString()}</p>}
                    </div>
                    {p.icd10_code && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono text-muted-foreground flex-shrink-0">
                        {p.icd10_code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {resolved.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resolved</p>
              <div className="space-y-1.5">
                {resolved.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/30 opacity-60">
                    <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{p.description}</p>
                    </div>
                    {p.icd10_code && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono text-muted-foreground flex-shrink-0">
                        {p.icd10_code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
