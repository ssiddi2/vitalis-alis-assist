import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Building2, Clock, Radar, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useHospital } from '@/contexts/HospitalContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TopBar } from '@/components/virtualis/TopBar';
import { AcuitySignalBars, ACUITY_COLOR, type AcuityLevel } from '@/components/virtualis/acuity/AcuitySignalBars';
import { AcuityBadge } from '@/components/virtualis/acuity/AcuityBadge';
import { AcuityAvatar } from '@/components/virtualis/acuity/AcuityAvatar';
import { ACUITY_RANK } from '@/hooks/useAcuity';
import { useMyHospitalIds } from '@/hooks/useMyHospitalIds';


interface ConsultRow {
  id: string;
  patient_id: string;
  hospital_id: string;

  reason: string;
  specialty: string;
  urgency: string;
  status: string;
  created_at: string;
  patient?: { name: string; mrn: string } | null;
}

interface AcuityRow {
  level: AcuityLevel;
  confidence: number | null;
  suggestedSpecialty: string | null;
  suggestedSpecialties: string[];
  immediateActions: string[];
  estimatedResponseTime: string | null;
  rationale: string | null;
}

type BoardItem = ConsultRow & { acuity: AcuityRow | null };

const LEVELS: AcuityLevel[] = ['High', 'Moderate', 'Low'];
const toLevel = (v: unknown): AcuityLevel =>
  LEVELS.includes(v as AcuityLevel) ? (v as AcuityLevel) : 'Moderate';

const initials = (name?: string | null) =>
  (name || '?')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{children}</p>
  );
}

function StatTile({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        <Label>{label}</Label>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

type Scope = 'facility' | 'all';

export default function CommandCenter() {
  const { selectedHospital, hospitals } = useHospital();
  const navigate = useNavigate();
  const { hospitalIds: myHospitalIds } = useMyHospitalIds();
  const [scope, setScope] = useState<Scope>('facility');
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState<string | null>(null);
  const hospitalId = selectedHospital?.id;

  const facilityNames = useMemo(
    () => Object.fromEntries(hospitals.map(h => [h.id, h.name])) as Record<string, string>,
    [hospitals],
  );

  // Strictly the user's own memberships. In "all" scope we never widen beyond
  // hospital_users rows for auth.uid(); RLS enforces the same boundary server-side.
  const scopeIds = useMemo(() => {
    if (scope === 'all') return myHospitalIds;
    return hospitalId ? [hospitalId] : [];
  }, [scope, myHospitalIds, hospitalId]);
  const scopeKey = scopeIds.join(',');

  const fetchBoard = useCallback(async () => {
    const ids = scopeKey ? scopeKey.split(',') : [];
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data: consults } = await supabase
      .from('consult_requests')
      .select('id, patient_id, hospital_id, reason, specialty, urgency, status, created_at, patient:patients(name, mrn)')
      .in('hospital_id', ids)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });


    const rows = (consults || []) as unknown as ConsultRow[];
    const ids = rows.map(r => r.id);

    const acuityMap: Record<string, AcuityRow> = {};
    if (ids.length) {
      const { data: scores } = await supabase
        .from('acuity_scores')
        .select(
          'source_id, acuity_level, confidence, rationale, suggested_specialty, suggested_specialties, immediate_actions, estimated_response_time, created_at',
        )
        .eq('source_table', 'consult_requests')
        .in('source_id', ids)
        .order('created_at', { ascending: false });

      for (const s of scores || []) {
        if (!s.source_id || acuityMap[s.source_id]) continue;
        const specs = Array.isArray(s.suggested_specialties)
          ? (s.suggested_specialties as unknown[])
              .map(x => (typeof x === 'string' ? x : (x as { name?: string })?.name))
              .filter((x): x is string => !!x)
          : [];
        acuityMap[s.source_id] = {
          level: toLevel(s.acuity_level),
          confidence: s.confidence != null ? Number(s.confidence) : null,
          suggestedSpecialty: s.suggested_specialty ?? null,
          suggestedSpecialties: specs,
          immediateActions: (s.immediate_actions as string[] | null) ?? [],
          estimatedResponseTime: s.estimated_response_time ?? null,
          rationale: s.rationale ?? null,
        };
      }
    }

    setItems(rows.map(r => ({ ...r, acuity: acuityMap[r.id] ?? null })));
    setLoading(false);
  }, [hospitalId]);

  useEffect(() => {
    if (!hospitalId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchBoard();


    const channel = supabase
      .channel(`command-center-${hospitalId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consult_requests', filter: `hospital_id=eq.${hospitalId}` }, () => void fetchBoard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acuity_scores', filter: `hospital_id=eq.${hospitalId}` }, () => void fetchBoard())
      .subscribe();

    const poll = setInterval(() => void fetchBoard(), 20000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [hospitalId, fetchBoard]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const ra = a.acuity ? ACUITY_RANK[a.acuity.level] : 3;
        const rb = b.acuity ? ACUITY_RANK[b.acuity.level] : 3;
        if (ra !== rb) return ra - rb;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items],
  );

  const stats = useMemo(() => {
    const counts = { High: 0, Moderate: 0, Low: 0 } as Record<AcuityLevel, number>;
    let confSum = 0;
    let confN = 0;
    for (const i of items) {
      if (!i.acuity) continue;
      counts[i.acuity.level] += 1;
      if (i.acuity.confidence != null) {
        confSum += i.acuity.confidence;
        confN += 1;
      }
    }
    return { ...counts, total: items.length, avgConfidence: confN ? Math.round(confSum / confN) : null };
  }, [items]);

  const routeToOnCall = async (item: BoardItem) => {
    const specialty = item.acuity?.suggestedSpecialty || item.specialty;
    setRouting(item.id);
    const { error } = await supabase
      .from('consult_requests')
      .update({ status: 'accepted' })
      .eq('id', item.id);
    setRouting(null);
    if (error) {
      toast.error('Could not route consult');
      return;
    }
    toast.success(`Routing to on-call ${specialty}`);
    void fetchBoard();
  };

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(1200px_500px_at_50%_-10%,hsl(var(--primary)/0.08),transparent)]">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <Label>
              01 — Live acuity operations · {selectedHospital?.name ?? 'No facility selected'}
            </Label>
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            ALIS <span className="text-primary">Command Center</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Facility-wide acuity triage, ranked in real time by the patented ALIS acuity engine.
          </p>
        </header>

        {/* Stats */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="High" value={stats.High} color={ACUITY_COLOR.High} />
          <StatTile label="Moderate" value={stats.Moderate} color={ACUITY_COLOR.Moderate} />
          <StatTile label="Low" value={stats.Low} color={ACUITY_COLOR.Low} />
          <StatTile label="Total active" value={stats.total} sub="open consults" />
          <StatTile label="Avg confidence" value={stats.avgConfidence != null ? `${stats.avgConfidence}%` : '—'} sub="engine certainty" />
        </section>

        {/* Board */}
        <div className="mb-3 flex items-center gap-2">
          <Radar className="h-3.5 w-3.5 text-primary" />
          <Label>02 — Acuity board</Label>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-2xl border border-border py-20 text-center shadow-sm">
            <ShieldCheck className="mb-3 h-8 w-8 text-emerald-500" />
            <p className="text-lg font-medium text-foreground">No active acuity items — all clear</p>
            <p className="mt-1 text-sm text-muted-foreground">New consults appear here the moment they are scored.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(item => {
              const level = item.acuity?.level;
              const color = level ? ACUITY_COLOR[level] : 'hsl(var(--border))';
              const specialty = item.acuity?.suggestedSpecialty || item.specialty;
              return (
                <article
                  key={item.id}
                  className="glass group relative overflow-hidden rounded-2xl border border-border p-4 pl-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <AcuityAvatar level={level} fallback={initials(item.patient?.name)} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-foreground">
                          {item.patient?.name ?? 'Unknown patient'}
                        </h2>
                        {item.patient?.mrn && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            MRN {item.patient.mrn}
                          </span>
                        )}
                        {level && <AcuitySignalBars level={level} />}
                        {level && <AcuityBadge level={level} confidence={item.acuity?.confidence} />}
                      </div>

                      <p className="mt-1.5 text-sm text-foreground/80">{item.reason}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {specialty}
                        </span>
                        {(item.acuity?.suggestedSpecialties ?? [])
                          .filter(s => s !== specialty)
                          .slice(0, 2)
                          .map(s => (
                            <span key={s} className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        {(item.acuity?.immediateActions ?? []).slice(0, 3).map(a => (
                          <span key={a} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-foreground/70">
                            {a}
                          </span>
                        ))}
                      </div>

                      {item.acuity?.estimatedResponseTime && (
                        <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Clock className="h-3 w-3" /> Target response · {item.acuity.estimatedResponseTime}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:w-56">
                      <Button
                        onClick={() => routeToOnCall(item)}
                        disabled={routing === item.id}
                        className="w-full justify-between rounded-full"
                      >
                        <span className="truncate">Route to on-call {specialty}</span>
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => navigate('/dashboard')}
                        className="w-full justify-between rounded-full text-muted-foreground"
                      >
                        Open <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Activity className="h-3 w-3 text-primary" /> Live · realtime stream + 20s reconcile
        </p>
      </main>
    </div>
  );
}
