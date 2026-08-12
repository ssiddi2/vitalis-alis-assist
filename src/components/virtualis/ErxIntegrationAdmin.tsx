import { useState } from 'react';
import { useErxProfiles } from '@/hooks/useErx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plug, ShieldOff, Plus } from 'lucide-react';

const CAPABILITIES = ['new_rx', 'cancel', 'change', 'refill', 'med_history', 'eligibility'] as const;

/**
 * Admin connectivity checklist for pharmacy / e-Rx integrations.
 * Only secret NAMES are ever stored — never credentials, seeds or signing keys.
 */
export function ErxIntegrationAdmin({ hospitalId }: { hospitalId: string }) {
  const { profiles, loading, refresh } = useErxProfiles(hospitalId);
  const [vendor, setVendor] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [secretNames, setSecretNames] = useState('');

  const create = async () => {
    const secret_ref_names = secretNames.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const { error } = await supabase.from('erx_integration_profiles').insert({
      hospital_id: hospitalId, vendor: vendor.trim(), environment, secret_ref_names,
    });
    if (error) return toast.error(error.message);
    toast.success('Integration profile created (unverified)');
    setVendor(''); setSecretNames('');
    refresh();
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('erx_integration_profiles').update(patch as never).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="glass-strong rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Plug className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">e-Prescribing integrations</h3>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-3 py-2 text-[11px] text-[#EF4444]">
        <ShieldOff className="w-3.5 h-3.5 mt-px shrink-0" />
        <p>
          Controlled-substance prescribing and EPCS are disabled platform-wide. They cannot be enabled here:
          they require a contracted vendor, DEA identity proofing, two-factor signing certification and a tested
          production connection. No Surescripts or PDMP connectivity is claimed.
        </p>
      </div>

      {loading ? (
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      ) : profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">No integration profile — the facility is NOT CONNECTED.</p>
      ) : profiles.map(p => (
        <div key={p.id} className="rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold text-foreground">
              {p.vendor} <span className="font-mono text-[10px] uppercase text-muted-foreground">{p.environment}</span>
            </div>
            <Select value={p.verification_status} onValueChange={v => update(p.id, { verification_status: v })}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['unverified', 'testing', 'verified', 'suspended'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map(c => {
              const on = Boolean(p.capabilities?.[c]);
              return (
                <button key={c} onClick={() => update(p.id, { capabilities: { ...p.capabilities, [c]: !on, epcs: false } })}
                  className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                    on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600' : 'border-slate-200 bg-slate-100 text-slate-500')}>
                  {c.replace('_', ' ')}
                </button>
              );
            })}
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              epcs · disabled
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Secret references: {p.secret_ref_names.length ? p.secret_ref_names.join(', ') : 'none'} · last test {p.last_test_at ?? 'never'}
          </p>
        </div>
      ))}

      <div className="grid gap-2 sm:grid-cols-4 items-end">
        <div><Label className="text-xs">Vendor</Label><Input value={vendor} maxLength={60} onChange={e => setVendor(e.target.value)} placeholder="surescripts" /></div>
        <div>
          <Label className="text-xs">Environment</Label>
          <Select value={environment} onValueChange={v => setEnvironment(v as 'sandbox' | 'production')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="sandbox">sandbox</SelectItem><SelectItem value="production">production</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Secret names (comma separated)</Label><Input value={secretNames} onChange={e => setSecretNames(e.target.value)} placeholder="ERX_CLIENT_ID, ERX_CLIENT_SECRET" /></div>
        <Button className="rounded-xl gap-1" disabled={!vendor.trim()} onClick={create}><Plus className="w-3 h-3" /> Add profile</Button>
      </div>
    </div>
  );
}
