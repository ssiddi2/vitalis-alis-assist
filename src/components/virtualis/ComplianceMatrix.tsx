import { useState } from 'react';
import { Download, Loader2, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { GovCard, StatusChip } from './GovernanceRegistry';
import {
  useCompliance, isBlocking, CLAIM_BANNER,
  type RequirementRow, type AssessmentRow, type ComplianceStatus,
} from '@/hooks/useCompliance';

const STATUSES: ComplianceStatus[] = ['not_started', 'in_progress', 'internally_ready',
  'ready_for_external_test', 'externally_verified', 'not_applicable'];

const Field = ({ label, ...rest }: { label: string } & React.ComponentProps<typeof Input>) => (
  <label className="space-y-1 block">
    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
    <Input className="h-8 text-xs rounded-lg" maxLength={200} {...rest} />
  </label>
);

function RequirementRowView({ req, assessment, onSave, onDecide, onAttest }: {
  req: RequirementRow; assessment?: AssessmentRow;
  onSave: (patch: Partial<AssessmentRow>) => Promise<void>;
  onDecide: (patch: Partial<RequirementRow>) => Promise<void>;
  onAttest: (input: { statement: string; attestor_org: string; evidence_hash: string; expires_at: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    status: assessment?.status ?? 'not_started', blocker: assessment?.blocker ?? '',
    evidence_ref: assessment?.evidence_ref ?? '', evidence_hash: assessment?.evidence_hash ?? '',
    authority: assessment?.authority ?? '', assessor_org: assessment?.assessor_org ?? '',
    assessor_id: assessment?.assessor_id ?? '', test_method: assessment?.test_method ?? '',
    test_version: assessment?.test_version ?? '', tested_at: assessment?.tested_at ?? '',
    target_date: assessment?.target_date ?? '', expires_at: assessment?.expires_at ?? '',
  });
  const [att, setAtt] = useState({ statement: '', attestor_org: '', evidence_hash: '', expires_at: '' });
  const [rationale, setRationale] = useState(req.applicability_rationale ?? '');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); toast.success('Saved'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Rejected'); }
    finally { setBusy(false); }
  };

  const blocking = isBlocking(req, assessment);

  return (
    <div className="rounded-xl border border-border/50 bg-background/60">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left p-3 flex items-start gap-3">
        {blocking ? <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          : <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">{req.title}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
            {req.framework_ref} · {req.criterion}
          </p>
          {assessment?.blocker && <p className="text-[11px] text-red-600 mt-1">{assessment.blocker}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusChip status={assessment?.status ?? 'not_started'} />
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {req.external_dependency ? 'external' : 'internal'} · {req.applicability}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 p-3 space-y-3">
          {req.description && <p className="text-[11px] text-muted-foreground">{req.description}</p>}

          <div className="grid sm:grid-cols-2 gap-2">
            <label className="space-y-1 block">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ComplianceStatus })}
                className="w-full h-8 text-xs rounded-lg border border-input bg-background px-2">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <Field label="Blocker" value={form.blocker} onChange={(e) => setForm({ ...form, blocker: e.target.value })} />
            <Field label="Internal control / evidence ref" value={form.evidence_ref} onChange={(e) => setForm({ ...form, evidence_ref: e.target.value })} />
            <Field label="Evidence hash" value={form.evidence_hash} onChange={(e) => setForm({ ...form, evidence_hash: e.target.value })} />
            <Field label="Authority" value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} />
            <Field label="Assessor organization" value={form.assessor_org} onChange={(e) => setForm({ ...form, assessor_org: e.target.value })} />
            <Field label="Assessor user id" value={form.assessor_id} onChange={(e) => setForm({ ...form, assessor_id: e.target.value })} />
            <Field label="Test method" value={form.test_method} onChange={(e) => setForm({ ...form, test_method: e.target.value })} />
            <Field label="Test version" value={form.test_version} onChange={(e) => setForm({ ...form, test_version: e.target.value })} />
            <Field label="Tested at" type="date" value={form.tested_at} onChange={(e) => setForm({ ...form, tested_at: e.target.value })} />
            <Field label="Target date" type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            <Field label="Expires" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </div>
          <Button size="sm" disabled={busy || !assessment} className="h-7 rounded-full text-[11px]"
            onClick={() => assessment && run(() => onSave({
              status: form.status, blocker: form.blocker || null,
              evidence_ref: form.evidence_ref || null, evidence_hash: form.evidence_hash || null,
              authority: form.authority || null, assessor_org: form.assessor_org || null,
              assessor_id: form.assessor_id || null, test_method: form.test_method || null,
              test_version: form.test_version || null, tested_at: form.tested_at || null,
              target_date: form.target_date || null, expires_at: form.expires_at || null,
            }))}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save assessment'}
          </Button>

          <div className="pt-2 border-t border-border/50 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Applicability decision</p>
            <Textarea value={rationale} maxLength={1000} rows={2} className="text-xs rounded-lg"
              placeholder="Counsel or compliance rationale" onChange={(e) => setRationale(e.target.value)} />
            <div className="flex gap-2">
              {(['applicable', 'not_applicable'] as const).map((v) => (
                <Button key={v} size="sm" variant="outline" disabled={busy || !rationale.trim()}
                  className="h-7 rounded-full text-[11px]"
                  onClick={() => run(() => onDecide({ applicability: v, applicability_rationale: rationale }))}>
                  Mark {v.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Independent attestation (immutable)
            </p>
            <Textarea value={att.statement} maxLength={1000} rows={2} className="text-xs rounded-lg"
              placeholder="Attestation statement" onChange={(e) => setAtt({ ...att, statement: e.target.value })} />
            <div className="grid sm:grid-cols-3 gap-2">
              <Field label="Attesting org" value={att.attestor_org} onChange={(e) => setAtt({ ...att, attestor_org: e.target.value })} />
              <Field label="Evidence hash" value={att.evidence_hash} onChange={(e) => setAtt({ ...att, evidence_hash: e.target.value })} />
              <Field label="Expires" type="date" value={att.expires_at} onChange={(e) => setAtt({ ...att, expires_at: e.target.value })} />
            </div>
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]"
              disabled={busy || !att.statement.trim() || !att.attestor_org.trim() || !att.evidence_hash.trim()}
              onClick={() => run(() => onAttest({ ...att, expires_at: att.expires_at || null }))}>
              Record attestation
            </Button>
            <p className="text-[10px] text-muted-foreground">
              An implementer or owner of a control can never attest to it; the database rejects self-attestation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Certification, compliance and external-dependency gap matrix.
 * Everything shown is INTERNAL READINESS ONLY — external claims require
 * evidence plus an authorized independent attestation recorded in the database.
 */
export function ComplianceMatrix({ hospitalId }: { hospitalId: string }) {
  const c = useCompliance(hospitalId);
  const domains = [...new Set(c.requirements.map((r) => r.domain))];

  const download = () => {
    const blob = new Blob([JSON.stringify(c.exportReport(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `internal-readiness-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const externalBlockers = c.blockers.filter((r) => r.external_dependency);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
        <p className="text-[11px] font-mono uppercase tracking-widest text-amber-700">{CLAIM_BANNER}</p>
      </div>

      <GovCard title="Release gate" icon={ShieldAlert}
        aside={<Button size="sm" variant="ghost" className="h-7 rounded-full text-[10px] gap-1" onClick={download}>
          <Download className="w-3 h-3" /> PHI-free report
        </Button>}>
        <div className="grid sm:grid-cols-3 gap-3">
          {[['Requirements', c.requirements.length], ['Open gates', c.blockers.length],
            ['External blockers', externalBlockers.length]].map(([l, v]) => (
            <div key={l as string} className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{l}</p>
              <p className="text-lg font-semibold text-foreground">{v as number}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-foreground">
          National production release is <span className="font-semibold">
            {c.blockers.length === 0 ? 'internally ready pending external verification' : 'BLOCKED'}</span>.
          State and service production enablement is rejected by the database while any applicable gate is unverified,
          and administrators cannot bypass it.
        </p>
        {externalBlockers.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            External blockers: {externalBlockers.map((r) => `${r.domain}:${r.criterion}`).join(', ')}
          </p>
        )}
      </GovCard>

      {c.renewals.length > 0 && (
        <GovCard title="Expiration & renewal queue" icon={Clock}>
          <div className="space-y-1">
            {c.renewals.map((a) => {
              const r = c.requirements.find((x) => x.id === a.requirement_id);
              return (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <StatusChip status={new Date(a.expires_at!) < new Date() ? 'expired' : 'in_progress'} />
                  <span className="truncate">{r?.title ?? a.requirement_id}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{a.expires_at}</span>
                </div>
              );
            })}
          </div>
        </GovCard>
      )}

      {c.loading && <p className="text-xs text-muted-foreground">Loading matrix…</p>}

      {domains.map((d) => (
        <GovCard key={d} title={d} icon={ShieldCheck}>
          <div className="space-y-2">
            {c.requirements.filter((r) => r.domain === d).map((r) => (
              <RequirementRowView key={r.id} req={r} assessment={c.byRequirement[r.id]}
                onSave={(patch) => c.saveAssessment(c.byRequirement[r.id], patch)}
                onDecide={(patch) => c.setApplicability(r, patch)}
                onAttest={(input) => c.addAttestation({
                  assessment_id: c.byRequirement[r.id].id, attestor_role: 'independent_assessor',
                  attestor_org: input.attestor_org, statement: input.statement,
                  evidence_ref: null, evidence_hash: input.evidence_hash,
                  effective_at: new Date().toISOString().slice(0, 10), expires_at: input.expires_at,
                })} />
            ))}
          </div>
        </GovCard>
      ))}
    </div>
  );
}
