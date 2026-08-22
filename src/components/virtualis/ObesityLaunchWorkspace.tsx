import { useEffect, useState } from 'react';
import { Activity, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useObesityLaunchReadiness } from '@/hooks/useObesityCare';
import { GovCard, StatusChip } from './GovernanceRegistry';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Coverage { state_code: string; service_line_id: string | null }
interface ServiceLine { id: string; name: string }

/**
 * Cash-pay obesity go-live workspace. Every verdict comes from the
 * database gate — internal readiness only, never a legal or vendor approval.
 */
export function ObesityLaunchWorkspace({ hospitalId }: { hospitalId: string }) {
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [serviceLineId, setServiceLineId] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [prescribing, setPrescribing] = useState(true);
  const [controlled, setControlled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ data: sl }, { data: cov }] = await Promise.all([
        // Only the cash-pay obesity medicine service is in scope for this launch.
        supabase.from('service_lines').select('id,name').eq('hospital_id', hospitalId)
          .eq('code', 'obesity_medicine').order('name'),
        supabase.from('state_service_availability').select('state_code,service_line_id').eq('hospital_id', hospitalId),
      ]);
      if (cancelled) return;
      const lines = (sl ?? []) as ServiceLine[];
      setServices(lines);
      setCoverage((cov ?? []) as Coverage[]);
      setServiceLineId((prev) => prev ?? lines[0]?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [hospitalId]);

  // Only states applicable to the selected obesity service line (generic rows
  // count only because the server treats a null service line as applicable).
  const states = [...new Set(
    coverage
      .filter((r) => !serviceLineId || r.service_line_id === serviceLineId || r.service_line_id === null)
      .map((r) => r.state_code),
  )].sort();

  useEffect(() => {
    setStateCode((prev) => (prev && states.includes(prev) ? prev : states[0] ?? null));
  }, [states.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps


  const { result, loading, refresh } = useObesityLaunchReadiness(hospitalId, serviceLineId, stateCode, { prescribing, controlled });
  const gates = result?.gates ?? [];

  return (
    <GovCard title="Cash-pay obesity launch" icon={Activity}
      aside={<Button size="sm" variant="ghost" className="h-7 rounded-full text-[10px]" onClick={() => void refresh()} disabled={loading}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Re-evaluate'}
      </Button>}>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={serviceLineId ?? undefined} onValueChange={setServiceLineId}>
          <SelectTrigger className="h-8 w-56 rounded-xl text-xs" aria-label="Service line">
            <SelectValue placeholder="Service line" />
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stateCode ?? undefined} onValueChange={setStateCode}>
          <SelectTrigger className="h-8 w-28 rounded-xl text-xs" aria-label="State"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            {states.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="obesity-prescribing" checked={prescribing} onCheckedChange={setPrescribing} />
          <Label htmlFor="obesity-prescribing" className="text-[11px] text-muted-foreground">Service promises prescribing</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="obesity-controlled" checked={controlled} onCheckedChange={setControlled} />
          <Label htmlFor="obesity-controlled" className="text-[11px] text-muted-foreground">Controlled (EPCS) in scope</Label>
        </div>
        <span className="ml-auto"><StatusChip status={result?.can_launch ? 'verified' : 'blocked'} /></span>
      </div>

      {!result?.authorized && !loading && (
        <p role="status" className="text-xs text-red-600">
          {result?.blockers?.includes('readiness_unavailable')
            ? 'Blocked — the readiness gate could not be evaluated. Nothing may launch until it returns a verdict.'
            : result
              ? 'Blocked — you are not authorized to evaluate this facility’s obesity launch gate.'
              : 'Select a facility state and service to evaluate the gate.'}
        </p>
      )}


      <div className="space-y-1.5">
        {gates.map((g) => (
          <div key={g.key} className="flex flex-wrap items-start gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/40">
            <StatusChip status={g.status} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-mono uppercase tracking-widest text-foreground">{g.key.replace(/_/g, ' ')}</p>
              {g.blocker && <p className="text-[11px] text-red-600">{g.blocker}</p>}
              {g.next_step && <p className="text-[11px] text-muted-foreground">Next: {g.next_step}</p>}
            </div>
            <span className="text-[10px] text-muted-foreground">{g.owner ?? (g.type === 'external' ? 'External' : 'Internal')}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {result?.note ?? 'INTERNAL READINESS ONLY'} — this surface reflects recorded internal evidence. It is not a
          legal, clinical, regulatory or vendor certification approval, and controlled prescribing stays hard-blocked
          until EPCS evidence exists for both the facility and the individual prescriber.
        </p>
      </div>
    </GovCard>
  );
}
