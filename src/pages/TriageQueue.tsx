import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CalendarPlus, Clock, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { useHospital } from '@/contexts/HospitalContext';
import { useCareRequests, type CareRequest } from '@/hooks/useCareRequests';
import { useCareCatalog } from '@/hooks/useCareCatalog';
import { CARE_REQUEST_LABEL, scheduleCareRequest, updateCareRequest } from '@/lib/careRequests';

const waitMinutes = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

/** Clinical triage queue. No diagnosis is generated here — routing only. */
export default function TriageQueue() {
  const navigate = useNavigate();
  const { selectedHospital } = useHospital();
  const hospitalId = selectedHospital?.id;
  const { requests, refresh } = useCareRequests(hospitalId, 'queue');
  const { assignments } = useCareCatalog(hospitalId);
  const [names, setNames] = useState<Record<string, string>>({});
  const [active, setActive] = useState<CareRequest | null>(null);
  const [providerId, setProviderId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [disposition, setDisposition] = useState('accept');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ids = [...new Set(assignments.map((a) => a.provider_user_id))];
    if (ids.length === 0) return;
    void supabase.from('profiles').select('user_id, full_name').in('user_id', ids).then(({ data }) => {
      setNames(Object.fromEntries((data ?? []).map((p) => [p.user_id, p.full_name ?? 'Clinician'])));
    });
  }, [assignments]);

  const eligibleProviders = useMemo(() => {
    if (!active) return [];
    return assignments.filter((a) => a.active && a.service_line_id === active.service_line_id);
  }, [assignments, active]);

  const sorted = useMemo(
    () => [...requests].sort((a, b) =>
      Number(b.red_flag) - Number(a.red_flag) || a.created_at.localeCompare(b.created_at)),
    [requests],
  );

  const triage = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const next = await updateCareRequest(active.id, active.lock_version, {
        status: disposition === 'decline' ? 'declined' : 'triaged',
        triage_disposition: disposition,
        triage_reason: reason.trim() || null,
        decline_reason: disposition === 'decline' ? (reason.trim() || 'Not appropriate for virtual care') : null,
      });
      toast.success(disposition === 'decline' ? 'Request declined' : 'Triaged');
      setActive({ ...active, ...next } as CareRequest);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Triage failed');
    } finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!active || !providerId || !startAt) return;
    setBusy(true);
    try {
      await scheduleCareRequest(
        { id: active.id, hospital_id: active.hospital_id, patient_id: active.patient_id,
          lock_version: active.lock_version, service_name: active.service?.name ?? 'Virtual visit' },
        providerId,
        new Date(startAt).toISOString(),
      );
      toast.success('Visit scheduled');
      setActive(null); setProviderId(''); setStartAt('');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not schedule');
    } finally { setBusy(false); }
  };

  if (!hospitalId) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Select a facility first.</div>;
  }

  return (
    <div className="relative min-h-screen">
      <FuturisticBackground variant="lite" />
      <main className="relative mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
          </Button>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">01 — Triage queue</p>
            <h1 className="text-2xl font-semibold tracking-tight">{selectedHospital?.name}</h1>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="space-y-2">
            {sorted.length === 0 && <p className="text-sm text-muted-foreground">Queue is clear.</p>}
            {sorted.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setActive(r); setReason(''); setDisposition('accept'); }}
                aria-pressed={active?.id === r.id}
                className={`w-full rounded-2xl border p-3 text-left shadow-soft backdrop-blur-sm transition-all ${
                  active?.id === r.id ? 'border-primary bg-primary/5' : 'border-border/60 bg-card/70 hover:border-primary/40'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {r.patient?.age ?? '—'}y · {r.patient_state_code ?? '—'} · {r.service?.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {r.red_flag && (
                      <Badge variant="outline" className="rounded-full border-destructive/40 bg-destructive/10 text-[10px] text-destructive">
                        <ShieldAlert className="mr-1 h-3 w-3" aria-hidden="true" /> Red flag
                      </Badge>
                    )}
                    <Badge variant="outline" className="rounded-full text-[10px]">{CARE_REQUEST_LABEL[r.status]}</Badge>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden="true" /> {waitMinutes(r.created_at)}m
                    </span>
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {r.requested_urgency} · patient-reported · {r.reason_text ?? 'no summary'}
                </p>
              </button>
            ))}
          </section>

          <aside className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-sm">
            {!active && <p className="text-sm text-muted-foreground">Select a request to triage.</p>}
            {active && (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">02 — Disposition</p>
                {active.red_flag && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Emergency screen positive ({active.red_flag_codes.join(', ')}). Routine scheduling is blocked server-side.
                  </p>
                )}
                <div>
                  <Label htmlFor="disposition" className="text-xs">Disposition</Label>
                  <Select value={disposition} onValueChange={setDisposition}>
                    <SelectTrigger id="disposition" className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accept">Accept for virtual visit</SelectItem>
                      <SelectItem value="needs_in_person">Needs in-person care</SelectItem>
                      <SelectItem value="decline">Decline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="triage-reason" className="text-xs">Reason (no PHI narrative needed)</Label>
                  <Input id="triage-reason" maxLength={500} className="mt-1 h-10 rounded-xl"
                    value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <Button className="w-full rounded-full" disabled={busy} onClick={triage}>Record triage</Button>

                <div className="border-t border-border/60 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">03 — Schedule</p>
                  <Label htmlFor="provider" className="mt-2 block text-xs">State-authorized provider</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger id="provider" className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      {eligibleProviders.map((a) => (
                        <SelectItem key={a.id} value={a.provider_user_id}>
                          {names[a.provider_user_id] ?? 'Clinician'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label htmlFor="start" className="mt-2 block text-xs">Start time</Label>
                  <Input id="start" type="datetime-local" className="mt-1 h-10 rounded-xl"
                    value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                  <Button
                    className="mt-3 w-full rounded-full"
                    disabled={busy || active.status !== 'triaged' || !providerId || !startAt}
                    onClick={schedule}
                  >
                    <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" /> Schedule visit
                  </Button>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Licensing, service authorization and facility containment are re-verified by the server on save.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
