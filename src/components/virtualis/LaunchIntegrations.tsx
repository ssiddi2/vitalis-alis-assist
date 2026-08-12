import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVendorOnboarding, type VendorOnboarding } from '@/hooks/useVendorOnboarding';
import { STATE_ORDER, STATE_TONE, VENDORS, VENDOR_ORDER, checklistFor, type VendorKey } from '@/lib/vendorRegistry';
import { Plug, ShieldAlert, Download, FlaskConical, ArrowRight, Lock } from 'lucide-react';

const label = (k: string) => k.replace(/_/g, ' ');

/**
 * Admin > Launch Integrations. Single command center for the three launch
 * vendors plus the DocUpdate standalone runbook. Every state is explicit —
 * there is no generic "connected" boolean, and production stays unreachable.
 */
export function LaunchIntegrations({ hospitalId }: { hospitalId: string }) {
  const { rows, loading, busy, seed, testConnection, exportPacket, update } = useVendorOnboarding(hospitalId);
  const [open, setOpen] = useState<VendorKey | null>(null);

  const byVendor = useMemo(() => {
    const map = new Map<VendorKey, { sandbox?: VendorOnboarding; production?: VendorOnboarding }>();
    for (const r of rows) {
      const entry = map.get(r.vendor_key) ?? {};
      entry[r.environment] = r;
      map.set(r.vendor_key, entry);
    }
    return map;
  }, [rows]);

  const runTest = async (key: VendorKey, capability: string) => {
    const { data, error } = await testConnection(key, capability);
    if (error) return;
    const d = data as { status?: string; reason?: string } | null;
    toast[d?.status === 'ok' ? 'success' : 'info'](
      `Sandbox test — ${d?.status ?? 'blocked'}${d?.reason ? `: ${label(d.reason)}` : ''}`,
    );
  };

  const downloadPacket = async (key: VendorKey) => {
    const { data, error } = await exportPacket(key);
    if (error || !data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}-onboarding-packet.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PHI-free onboarding packet exported');
  };

  return (
    <div className="glass-strong rounded-2xl border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-primary" />
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            01 — Launch integrations
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/shipping-checklist" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Shipping checklist <ArrowRight className="w-3 h-3" />
          </Link>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => seed()}>
            Seed vendor templates
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
        <ShieldAlert className="mt-px w-3.5 h-3.5 shrink-0" />
        <p>
          INTERNAL READINESS ONLY. No vendor is contracted, certified or connected. Production transport is disabled
          and unreachable by application code until contract/BAA, credentials, vendor certification, provider
          enrollment, end-to-end test evidence and independent approval are all current and unexpired.
          Only secret <em>reference names</em> are stored — never keys, tokens or credentials.
        </p>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No vendor profiles yet — seed the templates to begin onboarding.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {VENDOR_ORDER.map((key) => {
            const meta = VENDORS[key];
            const envs = byVendor.get(key);
            const sandbox = envs?.sandbox;
            const production = envs?.production;
            const checklist = checklistFor(key);
            const done = checklist.filter((c) => sandbox?.checklist?.[c]).length;

            return (
              <div key={key} className="rounded-2xl border border-border bg-background/60 p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.tagline}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{meta.domain}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {(['sandbox', 'production'] as const).map((env) => {
                    const row = env === 'sandbox' ? sandbox : production;
                    return (
                      <div key={env} className="rounded-xl border border-border/70 p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{env}</span>
                          {env === 'production' && <Lock className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        {row ? (
                          <>
                            <Select value={row.state} onValueChange={async (v) => {
                              const err = await update(row.id, { state: v as VendorOnboarding['state'] });
                              if (err) toast.error(err);
                            }}>
                              <SelectTrigger className={cn('h-7 rounded-full border px-2 text-[10px] font-mono uppercase tracking-wider', STATE_TONE[row.state])}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATE_ORDER.map((s) => <SelectItem key={s} value={s} className="text-xs">{label(s)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-7 text-[11px]" placeholder="Implementation owner" maxLength={120}
                              defaultValue={row.owner_name ?? ''}
                              onBlur={(e) => e.target.value !== (row.owner_name ?? '') && update(row.id, { owner_name: e.target.value })}
                            />
                            <Input
                              className="h-7 text-[11px]" placeholder="Blocker" maxLength={200}
                              defaultValue={row.blocker ?? ''}
                              onBlur={(e) => e.target.value !== (row.blocker ?? '') && update(row.id, { blocker: e.target.value })}
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Next: {row.next_action ?? '—'}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              test {row.last_test_at ? new Date(row.last_test_at).toLocaleDateString() : 'never'} · {row.last_test_result ?? 'n/a'}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground break-all">
                              evidence {row.approval_evidence_hash?.slice(0, 12) ?? 'none'} · expires {row.evidence_expires_at?.slice(0, 10) ?? 'n/a'}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Not seeded</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {meta.warning && (
                  <p className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-2 py-1.5 text-[10px] text-[#EF4444]">
                    {meta.warning}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    checklist {done}/{checklist.length}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    secrets {(sandbox?.secret_ref_names ?? meta.secretRefs).join(' · ') || 'none'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 rounded-full gap-1 text-[11px]"
                    disabled={busy || !meta.capabilities.length}
                    onClick={() => runTest(key, meta.capabilities[0])}>
                    <FlaskConical className="w-3 h-3" /> Test connection (sandbox)
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 rounded-full gap-1 text-[11px]" disabled={busy}
                    onClick={() => downloadPacket(key)}>
                    <Download className="w-3 h-3" /> Export packet
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11px]"
                    onClick={() => setOpen(open === key ? null : key)}>
                    {open === key ? 'Hide' : 'Checklist & certification'}
                  </Button>
                </div>

                {open === key && sandbox && (
                  <div className="grid gap-3 rounded-xl border border-border/70 p-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Onboarding</p>
                      {checklist.map((item) => (
                        <label key={item} className="flex items-center gap-2 text-[11px] text-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(sandbox.checklist?.[item])}
                            onChange={(e) => update(sandbox.id, {
                              checklist: { ...sandbox.checklist, [item]: e.target.checked },
                            })}
                          />
                          {label(item)}
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Certification matrix</p>
                      {meta.certification.length
                        ? meta.certification.map((c) => (
                          <p key={c} className="text-[11px] text-muted-foreground">· {c}</p>
                        ))
                        : <p className="text-[11px] text-muted-foreground">Not applicable — standalone tool.</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
