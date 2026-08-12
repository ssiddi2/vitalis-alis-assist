import { useCallback, useEffect, useState } from 'react';
import { Globe2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchReadiness, type ReadinessResult } from '@/hooks/useGovernance';
import { GovCard, StatusChip } from './GovernanceRegistry';
import { Button } from '@/components/ui/button';

interface Coverage { state_code: string; service_line_id: string | null; status: string }
interface ServiceLine { id: string; name: string }

/**
 * National launch readiness by state and service, split into internal gates
 * (controls we own) and external gates (contracts, credentialing, vendors).
 * Internal readiness only — never a legal, clinical or regulatory approval.
 */
export function LaunchReadinessDashboard({ hospitalId }: { hospitalId: string }) {
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [results, setResults] = useState<Record<string, ReadinessResult>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sl }, { data: cov }] = await Promise.all([
      supabase.from('service_lines').select('id,name').eq('hospital_id', hospitalId).order('name'),
      supabase.from('state_service_availability').select('state_code,service_line_id,status')
        .eq('hospital_id', hospitalId).order('state_code'),
    ]);
    const svc = (sl as ServiceLine[]) ?? [];
    const rows = (cov as Coverage[]) ?? [];
    setServices(svc);
    setCoverage(rows);
    const entries = await Promise.all(rows.map(async (r) => {
      try {
        return [`${r.state_code}:${r.service_line_id}`, await fetchReadiness(hospitalId, r.service_line_id, r.state_code)] as const;
      } catch {
        return [`${r.state_code}:${r.service_line_id}`, { authorized: false } as ReadinessResult] as const;
      }
    }));
    setResults(Object.fromEntries(entries));
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => { load(); }, [load]);

  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name ?? 'All services';

  return (
    <GovCard title="National launch readiness" icon={Globe2}
      aside={<Button size="sm" variant="ghost" className="h-7 rounded-full text-[10px]" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Recalculate'}
      </Button>}>
      {loading && <p className="text-xs text-muted-foreground">Evaluating gates…</p>}
      {!loading && coverage.length === 0 && (
        <p className="text-xs text-muted-foreground">No state coverage configured for this facility yet.</p>
      )}
      <div className="space-y-2">
        {coverage.map((row) => {
          const r = results[`${row.state_code}:${row.service_line_id}`];
          const gates = r?.gates ?? [];
          const internal = gates.filter((g) => g.type === 'internal');
          const external = gates.filter((g) => g.type === 'external');
          return (
            <div key={`${row.state_code}:${row.service_line_id}`}
              className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{row.state_code}</span>
                <span className="text-[11px] text-muted-foreground">{serviceName(row.service_line_id)}</span>
                <StatusChip status={row.status} />
                <span className="ml-auto">
                  <StatusChip status={r?.can_launch ? 'verified' : 'blocked'} />
                </span>
              </div>
              {[['Internal gates', internal], ['External gates', external]].map(([label, list]) => (
                <div key={String(label)} className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{String(label)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(list as typeof gates).map((g) => (
                      <span key={g.key} title={g.blocker ?? 'Verified'}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                          g.status === 'verified'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                            : 'border-red-500/40 bg-red-500/10 text-red-600'}`}>
                        {g.key.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {(list as typeof gates).length === 0 && (
                      <span className="text-[11px] text-muted-foreground">No data.</span>
                    )}
                  </div>
                </div>
              ))}
              {!!r?.blockers?.length && (
                <p className="text-[11px] text-red-600">
                  Blocked by: {r.blockers.map((b) => b.replace(/_/g, ' ')).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          A service cannot be marked available in a state while any gate is unverified — the database rejects it.
          This dashboard reflects internal control status only and does not represent legal, clinical, HIPAA or
          operational approval.
        </p>
      </div>
    </GovCard>
  );
}
