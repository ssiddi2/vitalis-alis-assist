import { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Loader2, Lock, RefreshCw, Send, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CONNECTION_COPY, CLAIM_GATE_COPY, CLAIM_STATUS_CLASSES, ClaimPreview, ConnectionState,
  claimPreview, submitClaimAttested,
} from '@/lib/claims';
import { useCoverageClaim, useNoteEncounter } from '@/hooks/useCoverageClaim';

interface Props {
  hospitalId?: string;
  patientId?: string;
  noteId?: string;
  /** Optional explicit encounter; otherwise resolved from the note. */
  encounterId?: string | null;
}

const CONNECTION_CLASS: Record<string, string> = {
  not_connected: 'border-slate-200 bg-slate-100 text-slate-600',
  sandbox: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  production_verified: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
};

function ConnectionChip({ state, label }: { state: ConnectionState; label: string }) {
  return (
    <span
      className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', CONNECTION_CLASS[state.label])}
      title={state.blocked ? (CLAIM_GATE_COPY[state.blocked] ?? state.blocked.replace(/_/g, ' ')) : undefined}
    >
      {label}: {CONNECTION_COPY[state.label]}
    </span>
  );
}

const Row = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className="flex items-start gap-2 text-xs">
    {ok
      ? <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
      : <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
    <span className={ok ? 'text-muted-foreground' : 'text-foreground'}>{children}</span>
    <span className="sr-only">{ok ? 'complete' : 'action needed'}</span>
  </li>
);

/**
 * Coverage & Claim workspace inside VirtualisNote.
 * Read-only for clinicians; eligibility, review and submission require the
 * facility billing role and an explicit human attestation, enforced server-side.
 */
export function CoverageClaimPanel({ hospitalId, patientId, noteId, encounterId }: Props) {
  const resolved = useNoteEncounter(encounterId ? undefined : noteId);
  const encounter = encounterId ?? resolved;
  const { caps, readiness, coverage, eligibility, timeline, loading, busy, error, refresh, runEligibility } =
    useCoverageClaim(hospitalId, patientId, encounter);

  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const claim = readiness?.claim ?? null;
  const blocks = readiness?.readiness?.blocks ?? [];
  const canSubmit = !!caps?.can_submit;

  const openPreview = async () => {
    if (!hospitalId || !claim) return;
    try {
      const res = await claimPreview(hospitalId, claim.id);
      setPreview(res.preview);
      setAttested(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build the claim preview');
    }
  };

  const doSubmit = async () => {
    if (!hospitalId || !claim || !attested || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitClaimAttested(hospitalId, claim.id);
      if (res.status === 'submitted') toast.success('Claim submitted to the clearinghouse');
      else if (res.status === 'duplicate') toast.info('Already submitted — duplicate suppressed');
      else toast.warning(CLAIM_GATE_COPY[res.reason ?? ''] ?? `Not submitted: ${res.reason ?? 'blocked'}`);
      setPreview(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Coverage and claim"
      className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm p-3 space-y-3 shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-2">
        <ShieldCheck aria-hidden className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Coverage &amp; Claim</h4>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {caps && <ConnectionChip state={caps.eligibility} label="Eligibility" />}
          {caps && <ConnectionChip state={caps.claim} label="Claim" />}
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh coverage and claim state"
            className="rounded-full border border-slate-200 p-1 text-slate-500 hover:text-primary"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {loading && <div className="h-16 rounded-xl bg-muted animate-pulse" aria-busy="true" />}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-600">
          {error}
          <Button variant="outline" size="sm" className="ml-2 h-6 text-[10px]" onClick={refresh}>Retry</Button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* 01 — Eligibility */}
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">01 — Eligibility</p>
            {coverage ? (
              <p className="text-xs text-foreground">
                {coverage.payer_name}{coverage.plan_name ? ` · ${coverage.plan_name}` : ''}
                <span className="ml-2 text-muted-foreground">{coverage.verification_status}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No active coverage on file for this patient.</p>
            )}
            {eligibility ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-4">
                <div><dt className="text-slate-500">Result</dt><dd className="font-medium">{eligibility.coverage_active == null ? 'Unknown' : eligibility.coverage_active ? 'Eligible' : 'Ineligible'}</dd></div>
                <div><dt className="text-slate-500">Copay</dt><dd className="tabular-nums">{eligibility.copay_amount != null ? `$${eligibility.copay_amount}` : '—'}</dd></div>
                <div><dt className="text-slate-500">Deductible left</dt><dd className="tabular-nums">{eligibility.deductible_remaining != null ? `$${eligibility.deductible_remaining}` : '—'}</dd></div>
                <div><dt className="text-slate-500">Coinsurance</dt><dd className="tabular-nums">{eligibility.coinsurance_percent != null ? `${eligibility.coinsurance_percent}%` : '—'}</dd></div>
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-slate-500">Last checked</dt>
                  <dd>{new Date(eligibility.requested_at).toLocaleString()} · {eligibility.status}
                    {eligibility.response_code ? ` · ${CLAIM_GATE_COPY[eligibility.response_code] ?? eligibility.response_code.replace(/_/g, ' ')}` : ''}</dd>
                </div>
                {!!eligibility.plan_summary?.messages?.length && (
                  <div className="col-span-2 sm:col-span-4 text-muted-foreground">{eligibility.plan_summary.messages.join(' · ')}</div>
                )}
              </dl>
            ) : (
              <p className="text-[11px] text-muted-foreground">No eligibility response recorded for this patient yet.</p>
            )}
            {caps?.eligibility.label !== 'production_verified' && (
              <p className="text-[11px] font-medium text-amber-600">
                {caps?.eligibility.label === 'sandbox'
                  ? 'Sandbox / test data — this does not reflect real coverage.'
                  : 'Not connected — no clearinghouse traffic is possible; nothing here reflects real coverage.'}
              </p>
            )}
            {canSubmit ? (
              <Button
                type="button" size="sm" variant="outline"
                className="h-7 rounded-full text-[11px]"
                disabled={busy || !patientId}
                onClick={async () => {
                  const res = await runEligibility();
                  if (res) toast.info(res.status === 'sent' ? 'Eligibility response received' : (CLAIM_GATE_COPY[res.reason ?? ''] ?? `Not connected: ${res.reason ?? 'unavailable'}`));
                }}
              >
                {busy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                Check eligibility
              </Button>
            ) : (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock aria-hidden className="h-3 w-3" /> View only — a billing role initiates eligibility.
              </p>
            )}
          </div>

          {/* 02 — Claim readiness */}
          <div className="space-y-1.5 border-t border-slate-100 pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">02 — Claim readiness</p>
            {!encounter && <p className="text-xs text-muted-foreground">This note is not linked to an encounter yet.</p>}
            {encounter && !claim && <p className="text-xs text-muted-foreground">No claim has been created for this encounter.</p>}
            {claim && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase', CLAIM_STATUS_CLASSES[claim.status])}>
                    {claim.status.replace(/_/g, ' ')}
                  </span>
                  <span className="tabular-nums text-muted-foreground">${claim.total_charge.toFixed(2)}</span>
                  <span className="text-muted-foreground">POS {claim.place_of_service ?? '—'}</span>
                </div>
                <ul className="space-y-1">
                  <Row ok={!!readiness?.note_signed}>Signed &amp; locked clinical note</Row>
                  <Row ok={(readiness?.diagnosis_count ?? 0) > 0}>ICD-10 diagnosis links ({readiness?.diagnosis_count ?? 0})</Row>
                  <Row ok={(readiness?.line_count ?? 0) > 0}>CPT/HCPCS service lines ({readiness?.line_count ?? 0})</Row>
                  <Row ok={!!claim.place_of_service}>Place of service (telehealth POS when applicable)</Row>
                  <Row ok={blocks.length === 0}>Coverage, provider NPI, enrollment and scrubber checks</Row>
                </ul>
                {blocks.length > 0 && (
                  <ul className="space-y-0.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2">
                    {blocks.map(b => <li key={b} className="text-[11px] text-amber-700">{b}</li>)}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Coding suggestions are never applied automatically, and billing never edits a signed note — use a coding query or signed addendum.
                </p>
              </>
            )}
          </div>

          {/* 03 — Review & submit */}
          {claim && (
            <div className="space-y-2 border-t border-slate-100 pt-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">03 — Review &amp; submit</p>
              {!canSubmit ? (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock aria-hidden className="h-3 w-3" /> Clinician view — only an authorized billing role may review, submit or correct a claim.
                </p>
              ) : !preview ? (
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={openPreview}>
                  <ClipboardList className="mr-1.5 h-3 w-3" /> Review 837P (normalized)
                </Button>
              ) : (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Payer {preview.payer ?? '—'} · NPI {preview.billing_provider_npi ?? '—'} · POS {preview.place_of_service ?? '—'}</p>
                  <ul className="space-y-0.5 text-[11px]">
                    {preview.service_lines.map((l, i) => (
                      <li key={`${l.cpt_code}-${i}`} className="flex justify-between gap-2">
                        <span className="font-mono">{l.cpt_code}{l.modifiers?.length ? ` · ${l.modifiers.join(',')}` : ''} ×{l.units}</span>
                        <span className="tabular-nums">${l.charge_amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">Dx: {preview.diagnoses.map(d => d.code).join(', ') || '—'}</p>
                  <label className="flex items-start gap-2 text-[11px] text-foreground">
                    <input
                      type="checkbox"
                      checked={attested}
                      onChange={(e) => setAttested(e.target.checked)}
                      className="mt-0.5"
                    />
                    I have reviewed this claim against the signed record and attest that the coding is accurate and supported.
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="h-7 rounded-full text-[11px]" disabled={!attested || submitting} onClick={doSubmit}>
                      {submitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
                      Submit claim
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 rounded-full text-[11px]" onClick={() => setPreview(null)}>Cancel</Button>
                  </div>
                </div>
              )}
              {caps?.attachments_enabled && (
                <p className="text-[11px] text-muted-foreground">
                  275 attachments are provisioned — select individual documents; the note is never sent wholesale.
                </p>
              )}
            </div>
          )}

          {/* 04 — Status timeline */}
          {timeline.length > 0 && (
            <div className="space-y-1 border-t border-slate-100 pt-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">04 — Status timeline</p>
              <ol className="space-y-0.5">
                {timeline.map(t => (
                  <li key={t.id} className="flex justify-between gap-2 text-[11px]">
                    <span className="text-foreground">{t.event_code.replace(/[._]/g, ' ')}{t.reason ? ` — ${CLAIM_GATE_COPY[t.reason] ?? t.reason.replace(/_/g, ' ')}` : ''}</span>
                    <span className="shrink-0 text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
