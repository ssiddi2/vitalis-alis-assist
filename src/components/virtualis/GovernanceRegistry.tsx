import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, FileSignature, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGovernance, type ConsentDocRow, type ProtocolRow } from '@/hooks/useGovernance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const GovCard = ({ title, icon: Icon, children, aside }: {
  title: string; icon: React.ElementType; children: React.ReactNode; aside?: React.ReactNode;
}) => (
  <div className="p-5 rounded-2xl bg-card/80 backdrop-blur border border-border/50 shadow-sm space-y-4">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
    {children}
  </div>
);

export const StatusChip = ({ status }: { status: string }) => (
  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-widest ${
    status === 'approved' || status === 'verified' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
      : status === 'in_review' || status === 'in_progress' ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
      : status === 'blocked' || status === 'expired' ? 'border-red-500/40 bg-red-500/10 text-red-600'
      : status === 'retired' ? 'border-slate-200 bg-slate-100 text-slate-400'
      : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
    {status.replace(/_/g, ' ')}
  </span>
);

const KINDS = ['protocol', 'order_set', 'red_flag_screen', 'escalation_rule',
  'documentation_template', 'prescribing_limit', 'service_scope_map'] as const;
const PURPOSES = ['telehealth', 'treatment', 'privacy', 'financial', 'communication'] as const;

type Artifact = (ProtocolRow | ConsentDocRow) & { kind?: string; purpose?: string };
type Table = 'clinical_protocols' | 'consent_documents';

/**
 * Versioned clinical protocol / order-set registry and consent-document registry.
 * Approval needs a medical director plus an independent compliance officer; authors
 * can never approve their own content and approved versions are frozen server-side.
 */
export function GovernanceRegistry({ hospitalId }: { hospitalId: string }) {
  const { protocols, consentDocs, approvalsFor, myRoles, loading, refresh } = useGovernance(hospitalId);
  const [uid, setUid] = useState<string>('');
  const [rationale, setRationale] = useState<Record<string, string>>({});
  const [pTitle, setPTitle] = useState(''); const [pKind, setPKind] = useState<string>('protocol');
  const [pEvidence, setPEvidence] = useState(''); const [pState, setPState] = useState('');
  const [cTitle, setCTitle] = useState(''); const [cPurpose, setCPurpose] = useState<string>('telehealth');
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? '')); }, []);

  const run = async (op: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await op;
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok);
    refresh();
    return true;
  };

  const setStatus = (table: Table, row: Artifact, status: string) =>
    run(supabase.from(table).update({ status, lock_version: row.lock_version + 1 }).eq('id', row.id),
      `Moved to ${status.replace(/_/g, ' ')}`);

  const approve = (table: Table, row: Artifact, role: string) => {
    const text = (rationale[row.id] ?? '').trim();
    if (text.length < 5) { toast.error('An approval rationale is required'); return; }
    return run(supabase.from('governance_approvals').insert({
      hospital_id: hospitalId, subject_type: table, subject_id: row.id,
      approver_id: uid, approver_role: role, decision: 'approved', rationale: text,
    }), `Recorded ${role.replace(/_/g, ' ')} approval`);
  };

  const ArtifactRow = ({ row, table, label }: { row: Artifact; table: Table; label: string }) => {
    const acks = approvalsFor(table, row.id);
    const hasMd = acks.some((a) => a.approver_role === 'medical_director');
    const hasComp = acks.some((a) => a.approver_role === 'compliance');
    const isAuthor = row.created_by === uid || row.owner_user_id === uid;
    return (
      <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{row.title}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{label} · v{row.version}</span>
          <StatusChip status={row.status} />
          {row.status === 'approved' && <Lock className="w-3 h-3 text-emerald-600" />}
        </div>
        <p className="text-[10px] font-mono text-muted-foreground">
          MD {hasMd ? '✓' : '—'} · Compliance {hasComp ? '✓' : '—'} · evidence {row.source_evidence ? '✓' : 'missing'}
          {'state_code' in row && row.state_code ? ` · ${row.state_code}` : ''}
          {isAuthor ? ' · you authored this version' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {row.status === 'draft' && (
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px]" disabled={busy}
              onClick={() => setStatus(table, row, 'in_review')}>Submit for review</Button>
          )}
          {row.status === 'in_review' && (
            <>
              <Input value={rationale[row.id] ?? ''} maxLength={300} className="h-7 text-[11px] w-56"
                placeholder="Approval rationale"
                onChange={(e) => setRationale((r) => ({ ...r, [row.id]: e.target.value }))} />
              {myRoles.includes('medical_director') && !isAuthor && (
                <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px]" disabled={busy}
                  onClick={() => approve(table, row, 'medical_director')}>Medical-director approval</Button>
              )}
              {myRoles.includes('compliance') && !isAuthor && (
                <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px]" disabled={busy}
                  onClick={() => approve(table, row, 'compliance')}>Compliance approval</Button>
              )}
              <Button size="sm" className="h-7 rounded-full text-[10px]" disabled={busy || !hasMd || !hasComp}
                onClick={() => setStatus(table, row, 'approved')}>Publish approved version</Button>
            </>
          )}
          {row.status === 'approved' && (
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px]" disabled={busy}
              onClick={() => setStatus(table, row, 'retired')}>Retire</Button>
          )}
        </div>
      </div>
    );
  };

  const createProtocol = async () => {
    const ok = await run(supabase.from('clinical_protocols').insert({
      hospital_id: hospitalId, kind: pKind, title: pTitle.trim(), state_code: pState || null,
      source_evidence: pEvidence.trim() || null, created_by: uid, owner_user_id: uid,
    }), 'Draft version created');
    if (ok) { setPTitle(''); setPEvidence(''); setPState(''); }
  };

  const createConsent = async () => {
    const ok = await run(supabase.from('consent_documents').insert({
      hospital_id: hospitalId, purpose: cPurpose, title: cTitle.trim(),
      body_hash: crypto.randomUUID().replace(/-/g, ''), created_by: uid, owner_user_id: uid,
    }), 'Consent draft created');
    if (ok) setCTitle('');
  };

  return (
    <div className="space-y-4">
      <GovCard title="Clinical protocol & order-set registry" icon={BookOpen}
        aside={<span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {myRoles.length ? myRoles.join(' · ').replace(/_/g, ' ') : 'no governance role'}
        </span>}>
        <div className="grid gap-2 sm:grid-cols-4">
          <select value={pKind} onChange={(e) => setPKind(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs">
            {KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
          </select>
          <Input value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={120}
            placeholder="Title" className="h-9 text-xs" />
          <Input value={pState} onChange={(e) => setPState(e.target.value.toUpperCase())} maxLength={2}
            placeholder="State (optional)" className="h-9 text-xs" />
          <Input value={pEvidence} onChange={(e) => setPEvidence(e.target.value)} maxLength={200}
            placeholder="Source / evidence" className="h-9 text-xs" />
        </div>
        <Button size="sm" className="rounded-full" disabled={busy || !pTitle.trim()} onClick={createProtocol}>
          Create draft version
        </Button>
        <div className="space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {protocols.map((p) => (
            <ArtifactRow key={p.id} row={p} table="clinical_protocols" label={p.kind.replace(/_/g, ' ')} />
          ))}
          {!loading && protocols.length === 0 && (
            <p className="text-xs text-muted-foreground">No protocol versions yet.</p>
          )}
        </div>
      </GovCard>

      <GovCard title="Consent document registry" icon={FileSignature}>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={cPurpose} onChange={(e) => setCPurpose(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs">
            {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} maxLength={120}
            placeholder="Title" className="h-9 text-xs sm:col-span-2" />
        </div>
        <Button size="sm" className="rounded-full" disabled={busy || !cTitle.trim()} onClick={createConsent}>
          Create consent draft
        </Button>
        <div className="space-y-2">
          {consentDocs.map((c) => (
            <ArtifactRow key={c.id} row={c} table="consent_documents" label={c.purpose} />
          ))}
          {!loading && consentDocs.length === 0 && (
            <p className="text-xs text-muted-foreground">No consent versions yet.</p>
          )}
        </div>
      </GovCard>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
        <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Approval requires one medical director and one independent compliance approver; the author is always
          excluded. Approved versions are immutable and can only be superseded by a new version. This registry is
          an internal control record — it does not constitute legal, clinical, HIPAA or regulatory approval.
        </p>
      </div>
    </div>
  );
}
