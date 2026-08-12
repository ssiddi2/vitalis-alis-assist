import { useState } from 'react';
import { FlaskConical, PlugZap, Scan, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDiagnosticProfiles } from '@/hooks/useDiagnostics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const KINDS = ['lab', 'imaging', 'records_exchange'] as const;

const StatusPill = ({ env, verified, tested }: { env: string; verified: boolean; tested: boolean }) => {
  const live = env === 'production' && verified && tested;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase tracking-widest ${
      live ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
        : env === 'sandbox' ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
        : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
      {live ? 'Connected' : env === 'sandbox' ? 'Test mode' : 'Not connected'}
    </span>
  );
};

/**
 * Admin readiness for lab, imaging and record-exchange vendors.
 * Only secret NAMES are stored; no endpoint credentials ever reach the browser.
 */
export function DiagnosticsIntegrationAdmin({ hospitalId }: { hospitalId: string }) {
  const { profiles, loading, refresh } = useDiagnosticProfiles(hospitalId);
  const [vendor, setVendor] = useState('');
  const [kind, setKind] = useState<typeof KINDS[number]>('lab');
  const [secretNames, setSecretNames] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!vendor.trim()) return toast.error('Vendor name is required');
    setBusy(true);
    const { error } = await supabase.from('diagnostic_vendor_profiles').insert({
      hospital_id: hospitalId, kind, vendor: vendor.trim(), environment: 'sandbox',
      capabilities: { order_transmit: true, result_receive: true, study_link: kind === 'imaging' },
      standards: kind === 'lab'
        ? { hl7v2: ['ORM^O01', 'ORU^R01'], fhir: 'R4' }
        : { dicomweb: 'PS3.18', fhir: 'R4' },
      secret_ref_names: secretNames.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setVendor(''); setSecretNames('');
    toast.success('Sandbox profile created — TEST MODE');
    refresh();
  };

  const recordTest = async (id: string, passed: boolean) => {
    const { error } = await supabase.from('diagnostic_vendor_profiles')
      .update({ last_test_result: passed ? 'passed' : 'failed', last_test_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`End-to-end test recorded as ${passed ? 'passed' : 'failed'}`);
    refresh();
  };

  return (
    <div className="p-5 rounded-2xl bg-card/80 backdrop-blur border border-border/50 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <PlugZap className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Lab, imaging & record exchange</h3>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          No vendor contracted
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof KINDS[number])}
          className="h-9 rounded-xl border border-border bg-background px-3 text-xs">
          {KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
        </select>
        <Input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={60}
          placeholder="Vendor" className="h-9 text-xs" />
        <Input value={secretNames} onChange={(e) => setSecretNames(e.target.value)} maxLength={200}
          placeholder="SECRET_NAMES (comma separated)" className="h-9 text-xs sm:col-span-2" />
      </div>
      <Button size="sm" className="rounded-full" disabled={busy} onClick={create}>Add sandbox profile</Button>

      <div className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-secondary/30 border border-border/40">
            {p.kind === 'imaging' ? <Scan className="w-4 h-4 text-primary" /> : <FlaskConical className="w-4 h-4 text-primary" />}
            <span className="text-xs font-semibold text-foreground">{p.vendor}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{p.kind} · {p.environment}</span>
            <StatusPill env={p.environment} verified={p.verification_status === 'verified'} tested={p.last_test_result === 'passed'} />
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              secrets: {p.secret_ref_names.join(', ') || 'none'}
            </span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px]" onClick={() => recordTest(p.id, true)}>
                Test passed
              </Button>
              <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px]" onClick={() => recordTest(p.id, false)}>
                Test failed
              </Button>
            </div>
          </div>
        ))}
        {!loading && profiles.length === 0 && (
          <p className="text-xs text-muted-foreground">No vendor profiles configured — all diagnostic exchange is disabled.</p>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
        <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Production endpoints stay disabled until a vendor is contracted, credentialed and an end-to-end test is
          recorded as passed. Only secret <em>names</em> are stored — never credentials, raw HL7/FHIR payloads or
          imaging binaries. No exchange-network participation or certification is claimed.
        </p>
      </div>
    </div>
  );
}
