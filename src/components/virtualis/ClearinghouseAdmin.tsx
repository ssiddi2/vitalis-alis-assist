import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClearinghouseProfiles } from '@/hooks/useRevenueCycle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Landmark, ShieldOff, Plus } from 'lucide-react';

const CAPABILITIES = ['eligibility', 'claim_submission', 'remittance', 'claim_status'] as const;

/**
 * Admin readiness checklist for clearinghouse / payer connectivity.
 * Only secret NAMES are stored — never credentials, payer logins or bank data.
 * Production submission stays fail-closed until a profile is verified AND a
 * full end-to-end test has passed.
 */
export function ClearinghouseAdmin({ hospitalId }: { hospitalId: string }) {
  const { profiles, loading, refresh } = useClearinghouseProfiles(hospitalId);
  const [vendor, setVendor] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [secretNames, setSecretNames] = useState('');

  const create = async () => {
    const secret_ref_names = secretNames.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const { error } = await supabase.from('clearinghouse_profiles').insert({
      hospital_id: hospitalId, vendor: vendor.trim(), environment, secret_ref_names,
    });
    if (error) return toast.error(error.message);
    toast.success('Clearinghouse profile created (unverified)');
    setVendor(''); setSecretNames('');
    refresh();
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('clearinghouse_profiles').update(patch as never).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="glass rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Clearinghouse & payer connectivity</h3>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          <ShieldOff className="h-3 w-3" /> Not connected
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        External blockers before live claim submission: a signed clearinghouse contract, payer enrollment
        and EDI trading-partner IDs, credentialed rendering/billing NPIs, and a passed end-to-end
        837/999/277CA/835 test. Until then every submission fails closed in TEST MODE.
      </p>

      {loading ? (
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      ) : profiles.map((p) => {
        const id = p.id as string;
        const verified = p.verification_status === 'verified';
        const caps = (p.capabilities ?? {}) as Record<string, boolean>;
        return (
          <div key={id} className="rounded-xl border border-slate-200 bg-white/60 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{p.vendor as string}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{p.environment as string}</span>
              <span className={cn('ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase',
                verified ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600' : 'border-amber-500/40 bg-amber-500/10 text-amber-600')}>
                {String(p.verification_status)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITIES.map(c => (
                <button key={c} onClick={() => update(id, { capabilities: { ...caps, [c]: !caps[c] } })}
                  className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                    caps[c] ? 'border-primary/30 bg-primary/10 text-primary' : 'border-slate-200 bg-slate-50 text-slate-400')}>
                  {c.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-full"
                onClick={() => update(id, { last_test_at: new Date().toISOString(), last_test_result: 'failed' })}>
                Run connectivity test
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Last test: {p.last_test_at ? `${new Date(p.last_test_at as string).toLocaleString()} · ${String(p.last_test_result ?? 'n/a')}` : 'never'}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-400">
                secrets: {((p.secret_ref_names as string[]) ?? []).join(', ') || 'none'}
              </span>
            </div>
          </div>
        );
      })}

      <div className="grid gap-2 sm:grid-cols-4 items-end">
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-wider">Vendor</Label>
          <Input value={vendor} onChange={e => setVendor(e.target.value)} maxLength={60} placeholder="e.g. availity" />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-wider">Environment</Label>
          <Select value={environment} onValueChange={v => setEnvironment(v as 'sandbox' | 'production')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">sandbox</SelectItem>
              <SelectItem value="production">production</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-wider">Secret names</Label>
          <Input value={secretNames} onChange={e => setSecretNames(e.target.value)} maxLength={200} placeholder="CLEARINGHOUSE_API_KEY" />
        </div>
        <Button onClick={create} disabled={!vendor.trim()} className="rounded-full">
          <Plus className="h-4 w-4 mr-1" /> Add profile
        </Button>
      </div>
    </div>
  );
}
