import { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProviderLicenses, type ProviderLicense } from '@/hooks/useEncounterSafety';

interface Props {
  hospitalId: string;
  /** Admins manage every provider; clinicians see only their own, read-only. */
  canEdit: boolean;
  providerUserId?: string;
}

const emptyDraft = { provider_user_id: '', state_code: '', license_number: '', expiration_date: '' };

export function ProviderLicensesPanel({ hospitalId, canEdit, providerUserId }: Props) {
  const { licenses, loading, save, remove } = useProviderLicenses(hospitalId, canEdit ? undefined : providerUserId);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await save({
        provider_user_id: draft.provider_user_id.trim(),
        hospital_id: hospitalId,
        state_code: draft.state_code.trim().toUpperCase(),
        license_number: draft.license_number.trim(),
        status: 'active',
        effective_date: new Date().toISOString().slice(0, 10),
        expiration_date: draft.expiration_date || null,
        telehealth_permitted: true,
        verification_source: 'admin_attestation',
        verified_at: new Date().toISOString(),
      } as Omit<ProviderLicense, 'id'>);
      setDraft(emptyDraft);
      toast.success('Authorization saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save authorization');
    } finally {
      setBusy(false);
    }
  };

  const expired = (l: ProviderLicense) => !!l.expiration_date && l.expiration_date < new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-sm">
      <header className="mb-3 flex items-center gap-2">
        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Provider state authorizations
        </h3>
        <span className="h-px flex-1 bg-border/70" />
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </header>

      <div className="space-y-1.5">
        {licenses.length === 0 && <p className="text-xs text-muted-foreground">No authorizations on file.</p>}
        {licenses.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
            <span className="font-mono text-xs font-semibold">{l.state_code}</span>
            <span className="text-xs text-muted-foreground">#{l.license_number}</span>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {expired(l) ? 'expired' : l.status}
            </Badge>
            {l.telehealth_permitted && (
              <Badge variant="secondary" className="rounded-full text-[10px]">telehealth</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {l.expiration_date ? `exp ${l.expiration_date}` : 'no expiry'}
            </span>
            {canEdit && (
              <Button size="sm" variant="ghost" className="ml-auto h-7 rounded-lg" onClick={() => void remove(l.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={draft.provider_user_id} maxLength={40} placeholder="Provider user ID"
            onChange={(e) => setDraft({ ...draft, provider_user_id: e.target.value })}
            className="h-8 w-64 rounded-lg text-xs" />
          <Input value={draft.state_code} maxLength={2} placeholder="ST"
            onChange={(e) => setDraft({ ...draft, state_code: e.target.value })}
            className="h-8 w-16 rounded-lg text-xs" />
          <Input value={draft.license_number} maxLength={40} placeholder="License #"
            onChange={(e) => setDraft({ ...draft, license_number: e.target.value })}
            className="h-8 w-40 rounded-lg text-xs" />
          <Input type="date" value={draft.expiration_date}
            onChange={(e) => setDraft({ ...draft, expiration_date: e.target.value })}
            className="h-8 w-40 rounded-lg text-xs" />
          <Button size="sm" disabled={busy} className="h-8 gap-1 rounded-lg text-xs" onClick={() => void add()}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
          </Button>
        </div>
      )}
      {!canEdit && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Authorizations are maintained by your administrator.
        </p>
      )}
    </section>
  );
}
