import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCredentialing, type CredentialRow } from '@/hooks/useGovernance';
import { GovCard, StatusChip } from './GovernanceRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPES = ['license', 'dea_registration', 'state_cds', 'malpractice', 'payer_enrollment',
  'training', 'background_check', 'privileges'] as const;
const ATTESTATIONS = ['onboarding', 'access_review', 'termination'] as const;

/**
 * Staff / provider credentialing lifecycle with expiration work queues and
 * access attestations. Only metadata and primary-source evidence references are
 * stored — never credential values, ID images or biometric artifacts.
 */
export function CredentialingPanel({ hospitalId, isAdmin }: { hospitalId: string; isAdmin: boolean }) {
  const { credentials, queues, loading, refresh } = useCredentialing(hospitalId);
  const [uid, setUid] = useState('');
  const [form, setForm] = useState({ user_id: '', credential_type: 'license', state_code: '', expiration_date: '', psv_source: '' });
  const [att, setAtt] = useState({ user_id: '', kind: 'access_review', notes: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? '')); }, []);

  const run = async (op: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await op;
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ok);
    refresh();
  };

  const rows = useMemo(() => [
    ['Expired', queues.expired, 'expired'] as const,
    ['Expiring within 60 days', queues.expiringSoon, 'in_review'] as const,
    ['Awaiting primary-source verification', queues.unverified, 'draft'] as const,
  ], [queues]);

  const Item = ({ c }: { c: CredentialRow }) => (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/40">
      <span className="text-[11px] font-mono text-muted-foreground">{c.credential_type.replace(/_/g, ' ')}</span>
      {c.state_code && <span className="text-[11px] font-mono text-muted-foreground">{c.state_code}</span>}
      <StatusChip status={c.status} />
      <span className="text-[10px] text-muted-foreground ml-auto">
        {c.expiration_date ? `expires ${c.expiration_date}` : 'no expiration'} ·{' '}
        {c.psv_verified_at ? `PSV ${c.psv_source ?? 'verified'}` : 'PSV pending'}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      <GovCard title="Credential work queues" icon={BadgeCheck}>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {rows.map(([label, list]) => (
          <div key={label} className="space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {label} · {list.length}
            </p>
            {list.length === 0
              ? <p className="text-xs text-muted-foreground">Clear.</p>
              : list.map((c) => <Item key={c.id} c={c} />)}
          </div>
        ))}
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          all credentials · {credentials.length}
        </p>
      </GovCard>

      {isAdmin && (
        <GovCard title="Record credential & access attestation" icon={UserCog}>
          <div className="grid gap-2 sm:grid-cols-5">
            <Input value={form.user_id} maxLength={40} placeholder="Provider user id" className="h-9 text-xs"
              onChange={(e) => setForm({ ...form, user_id: e.target.value })} />
            <select value={form.credential_type} className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
              onChange={(e) => setForm({ ...form, credential_type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <Input value={form.state_code} maxLength={2} placeholder="State" className="h-9 text-xs"
              onChange={(e) => setForm({ ...form, state_code: e.target.value.toUpperCase() })} />
            <Input type="date" value={form.expiration_date} className="h-9 text-xs"
              onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
            <Input value={form.psv_source} maxLength={80} placeholder="PSV source / evidence ref" className="h-9 text-xs"
              onChange={(e) => setForm({ ...form, psv_source: e.target.value })} />
          </div>
          <Button size="sm" className="rounded-full" disabled={busy || !form.user_id.trim()}
            onClick={() => run(supabase.from('staff_credentials').insert({
              hospital_id: hospitalId, user_id: form.user_id.trim(), credential_type: form.credential_type,
              state_code: form.state_code || null, expiration_date: form.expiration_date || null,
              psv_source: form.psv_source.trim() || null, created_by: uid,
            }), 'Credential recorded')}>Record credential</Button>

          <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-border/40">
            <Input value={att.user_id} maxLength={40} placeholder="User id" className="h-9 text-xs"
              onChange={(e) => setAtt({ ...att, user_id: e.target.value })} />
            <select value={att.kind} className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
              onChange={(e) => setAtt({ ...att, kind: e.target.value })}>
              {ATTESTATIONS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
            <Input value={att.notes} maxLength={200} placeholder="Notes" className="h-9 text-xs"
              onChange={(e) => setAtt({ ...att, notes: e.target.value })} />
          </div>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy || !att.user_id.trim()}
            onClick={() => run(supabase.from('access_attestations').insert({
              hospital_id: hospitalId, user_id: att.user_id.trim(), kind: att.kind,
              attested_by: uid, notes: att.notes.trim() || null,
            }), att.kind === 'termination' ? 'Termination recorded — access revoked' : 'Attestation recorded')}>
            Record attestation
          </Button>
          <p className="text-[11px] text-muted-foreground">
            A termination attestation immediately revokes facility access server-side. Store references only —
            never license numbers, DEA numbers, ID images or any credential value.
          </p>
        </GovCard>
      )}
    </div>
  );
}
