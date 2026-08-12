import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { SafetyScreen, redFlagCodes } from '@/components/virtualis/SafetyScreen';
import { useHospital } from '@/contexts/HospitalContext';
import { usePatients } from '@/hooks/usePatients';
import { useCareCatalog, useRoutingStatus } from '@/hooks/useCareCatalog';
import { useCareRequests, type CareRequest } from '@/hooks/useCareRequests';
import {
  CARE_REQUEST_LABEL, CONSENT_VERSION, SAFETY_SCREEN_QUESTIONS, SAFETY_SCREEN_VERSION,
  US_STATES, updateCareRequest,
} from '@/lib/careRequests';

const statusTone: Record<string, string> = {
  available: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  waitlist: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  unavailable: 'bg-muted text-muted-foreground border-border',
};

export default function FindCare() {
  const navigate = useNavigate();
  const { selectedHospital } = useHospital();
  const hospitalId = selectedHospital?.id;
  const { patients } = usePatients(hospitalId);
  const { services, coverage, loading } = useCareCatalog(hospitalId);
  const { requests, refresh, createDraft } = useCareRequests(hospitalId, 'mine');

  // Physical state is asked first — availability is meaningless without it.
  const [stateCode, setStateCode] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [form, setForm] = useState({
    reason: '', duration: '', urgency: 'routine', callback: '', language: 'English',
    accessibility: '', established: 'new', payer: 'unknown', referral: 'not_required', records: 'not_required',
  });
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const { routing } = useRoutingStatus(hospitalId, serviceId || undefined, stateCode || undefined);
  const flagged = redFlagCodes(answers);
  const screenComplete = SAFETY_SCREEN_QUESTIONS.every((q) => typeof answers[q.code] === 'boolean');

  const coverageFor = useMemo(() => {
    const map = new Map<string, string>();
    coverage.filter((c) => c.state_code === stateCode).forEach((c) => map.set(c.service_line_id, c.status));
    return map;
  }, [coverage, stateCode]);

  const visible = services.filter((s) => s.active && s.visible_to_patients);

  const blockers: string[] = [];
  if (!stateCode) blockers.push('Select the state you are physically in');
  if (!serviceId) blockers.push('Choose a service');
  if (!patientId) blockers.push('Select the patient');
  if (!form.reason.trim()) blockers.push('Describe the reason for the visit');
  if (!form.callback.trim()) blockers.push('Provide a callback number we can verify');
  if (!screenComplete) blockers.push('Complete the safety screen');
  if (!consent) blockers.push('Acknowledge the telehealth consent');
  if (flagged.length > 0) blockers.push('Emergency symptoms reported — routine requests are blocked');
  if (routing && routing.status === 'unavailable') blockers.push('This service is not available in your state yet');

  const submit = async () => {
    if (!hospitalId || !service) return;
    setBusy(true);
    try {
      const draft = await createDraft({
        hospital_id: hospitalId, patient_id: patientId, service_line_id: service.id,
      });
      const now = new Date().toISOString();
      // One enforced write: intake + screen + consent, then the status move.
      const intake = await updateCareRequest(draft.id, draft.lock_version, {
        patient_state_code: stateCode,
        requested_urgency: form.urgency,
        reason_text: form.reason.trim(),
        symptom_duration: form.duration.trim() || null,
        callback_phone: form.callback.trim(),
        callback_verified_at: now,
        preferred_language: form.language.trim() || null,
        accessibility_needs: form.accessibility.trim() || null,
        is_established_patient: form.established === 'established',
        referral_status: form.referral,
        records_status: form.records,
        payer_preference: form.payer,
        consent_version: CONSENT_VERSION,
        consent_accepted_at: now,
        safety_screen_version: SAFETY_SCREEN_VERSION,
        safety_screen_completed_at: now,
        red_flag: flagged.length > 0,
        red_flag_codes: flagged,
        emergency_ack_at: flagged.length > 0 ? now : null,
      });
      if (flagged.length > 0) {
        toast.error('Emergency guidance recorded. Call 911 — this request was not submitted.');
        await refresh();
        return;
      }
      const done = await updateCareRequest(intake.id, intake.lock_version, { status: 'submitted' });
      toast.success(
        done.status === 'waitlisted'
          ? 'Added to the waitlist for your state — we will contact you when care opens.'
          : `Request submitted. ${service.response_window}.`,
      );
      setServiceId(''); setPatientId(''); setAnswers({}); setConsent(false);
      setForm({ ...form, reason: '', duration: '' });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit this request');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r: CareRequest) => {
    try {
      await updateCareRequest(r.id, r.lock_version, { status: 'cancelled' });
      toast.success('Request cancelled');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    }
  };

  if (!hospitalId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a facility first.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <FuturisticBackground variant="lite" />
      <main className="relative mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back
          </Button>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">01 — Find care</p>
            <h1 className="text-2xl font-semibold tracking-tight">Request a virtual visit</h1>
          </div>
        </div>

        {/* state first */}
        <section className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-sm">
          <Label htmlFor="state" className="flex items-center gap-2 text-xs font-medium">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> What state are you physically in today?
          </Label>
          <Select value={stateCode} onValueChange={setStateCode}>
            <SelectTrigger id="state" className="mt-2 h-11 w-full rounded-xl sm:w-56"><SelectValue placeholder="Select state" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Care is licensed state by state. Availability below is shown exactly as configured for your state.
          </p>
        </section>

        {/* catalog */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && <p className="text-sm text-muted-foreground">Loading services…</p>}
          {visible.map((s) => {
            const status = stateCode ? (coverageFor.get(s.id) ?? 'unavailable') : null;
            const selected = serviceId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setServiceId(s.id)}
                className={`rounded-2xl border p-4 text-left shadow-soft backdrop-blur-sm transition-all ${
                  selected ? 'border-primary bg-primary/5' : 'border-border/60 bg-card/70 hover:border-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  {status && (
                    <Badge variant="outline" className={`shrink-0 rounded-full text-[10px] ${statusTone[status]}`}>
                      {status === 'available' ? 'Available' : status === 'waitlist' ? 'Waitlist' : 'Not yet'}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.patient_description}</p>
                <p className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" /> {s.response_window}
                </p>
              </button>
            );
          })}
        </section>

        {routing && service && (
          <p className="rounded-2xl border border-border/60 bg-card/70 p-3 text-xs text-muted-foreground shadow-soft backdrop-blur-sm">
            {routing.can_route
              ? `${service.name} is open in ${stateCode} · ${routing.provider_count} state-authorized provider(s) · ${routing.response_window}`
              : `${service.name} in ${stateCode}: ${(routing.blocks ?? []).join(' · ')}${routing.reason ? ` — ${routing.reason}` : ''}${routing.launch_date ? ` (expected ${routing.launch_date})` : ''}`}
          </p>
        )}

        {/* intake */}
        {service && (
          <section className="space-y-4 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">03 — About this visit</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="patient" className="text-xs">Patient</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger id="patient" className="mt-1 h-11 rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.mrn}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="callback" className="text-xs">Callback number (verified at submission)</Label>
                <Input id="callback" inputMode="tel" maxLength={32} className="mt-1 h-11 rounded-xl"
                  value={form.callback} onChange={(e) => setForm({ ...form, callback: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reason" className="text-xs">What would you like help with?</Label>
                <Textarea id="reason" maxLength={2000} rows={3} className="mt-1 rounded-xl"
                  value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="duration" className="text-xs">How long has this been going on?</Label>
                <Input id="duration" maxLength={120} className="mt-1 h-11 rounded-xl"
                  value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="urgency" className="text-xs">How soon do you feel you need care?</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger id="urgency" className="mt-1 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="soon">In the next day or two</SelectItem>
                    <SelectItem value="urgent">Today</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="established" className="text-xs">Have you been seen here before?</Label>
                <Select value={form.established} onValueChange={(v) => setForm({ ...form, established: v })}>
                  <SelectTrigger id="established" className="mt-1 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New patient</SelectItem>
                    <SelectItem value="established">Established patient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payer" className="text-xs">How would you like to pay?</Label>
                <Select value={form.payer} onValueChange={(v) => setForm({ ...form, payer: v })}>
                  <SelectTrigger id="payer" className="mt-1 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="self_pay">Self-pay</SelectItem>
                    <SelectItem value="unknown">Not sure yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="language" className="text-xs">Preferred language</Label>
                <Input id="language" maxLength={80} className="mt-1 h-11 rounded-xl"
                  value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="accessibility" className="text-xs">Accessibility needs (interpreter, captions, screen reader)</Label>
                <Input id="accessibility" maxLength={500} className="mt-1 h-11 rounded-xl"
                  value={form.accessibility} onChange={(e) => setForm({ ...form, accessibility: e.target.value })} />
              </div>
              {service.requires_referral && (
                <div>
                  <Label htmlFor="referral" className="text-xs">Referral status (required for this service)</Label>
                  <Select value={form.referral} onValueChange={(v) => setForm({ ...form, referral: v })}>
                    <SelectTrigger id="referral" className="mt-1 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Requested</SelectItem>
                      <SelectItem value="received">On file</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {service.requires_records && (
                <div>
                  <Label htmlFor="records" className="text-xs">Prior records (required for this service)</Label>
                  <Select value={form.records} onValueChange={(v) => setForm({ ...form, records: v })}>
                    <SelectTrigger id="records" className="mt-1 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Requested</SelectItem>
                      <SelectItem value="received">On file</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <SafetyScreen answers={answers} onChange={setAnswers} callbackPhone={form.callback} />

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I acknowledge the telehealth consent ({CONSENT_VERSION}): a virtual visit may not be appropriate for every
                condition, and I may be asked to be seen in person.
              </span>
            </label>

            {blockers.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {blockers.map((b) => <li key={b}>• {b}</li>)}
              </ul>
            )}

            <Button
              className="w-full rounded-full sm:w-auto"
              disabled={busy || blockers.length > 0}
              onClick={submit}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
              Submit request
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </section>
        )}

        {/* my requests */}
        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">04 — My care requests</p>
          {requests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
          {requests.map((r) => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft backdrop-blur-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {r.service?.name ?? 'Service'} · {r.patient?.name ?? 'Patient'}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.patient_state_code ?? '—'} · {new Date(r.created_at).toLocaleString()}
                  {r.red_flag && ' · emergency guidance given'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full text-[10px]">{CARE_REQUEST_LABEL[r.status]}</Badge>
                {['draft', 'submitted', 'waitlisted'].includes(r.status) && (
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => cancel(r)}>Cancel</Button>
                )}
                {r.status === 'scheduled' && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
