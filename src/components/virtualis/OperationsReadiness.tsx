import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertOctagon, LifeBuoy, RefreshCw, Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GovCard, StatusChip } from './GovernanceRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Row { id: string; status: string; created_at?: string; [k: string]: unknown }

const TABLES = [
  { table: 'incident_reports', label: 'Incidents · privacy · security · breach assessment', title: 'summary', meta: (r: Row) => `${r.kind} · ${r.severity}` },
  { table: 'complaints', label: 'Complaints & grievances', title: 'summary', meta: (r: Row) => `${r.source} · ${r.category}` },
  { table: 'continuity_exercises', label: 'Downtime · BCP · DR · backup-restore exercises', title: 'kind', meta: (r: Row) => `${r.result} · next due ${r.next_due_date ?? 'n/a'}` },
  { table: 'vendor_agreements', label: 'Vendor & BAA inventory', title: 'vendor', meta: (r: Row) => `${r.service} · BAA ${r.baa_status}${r.phi_access ? ' · PHI' : ''}` },
  { table: 'workforce_training', label: 'Workforce training', title: 'curriculum', meta: (r: Row) => `expires ${r.expires_at ?? 'n/a'}` },
] as const;

/** Operational readiness trackers plus a PHI-minimized support-case intake. */
export function OperationsReadiness({ hospitalId }: { hospitalId: string }) {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [support, setSupport] = useState<Row[]>([]);
  const [form, setForm] = useState({ subject: '', description: '', category: 'technical', priority: 'normal' });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const results = await Promise.all(TABLES.map((t) =>
      supabase.from(t.table).select('*').eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }).limit(25)));
    setData(Object.fromEntries(TABLES.map((t, i) => [t.table, (results[i].data as Row[]) ?? []])));
    const { data: s } = await supabase.from('support_cases').select('*').eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false }).limit(25);
    setSupport((s as Row[]) ?? []);
  }, [hospitalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submitCase = async () => {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('support_cases').insert({
      hospital_id: hospitalId, subject: form.subject.trim(), description: form.description.trim(),
      category: form.category, priority: form.priority, requester_id: auth.user?.id ?? '',
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Support case opened');
    setForm({ ...form, subject: '', description: '' });
    refresh();
  };

  return (
    <div className="space-y-4">
      <GovCard title="Operational readiness trackers" icon={Server}
        aside={<Button size="sm" variant="ghost" className="h-7 rounded-full text-[10px]" onClick={refresh}>
          <RefreshCw className="w-3 h-3 mr-1" />Refresh</Button>}>
        <div className="grid gap-3 md:grid-cols-2">
          {TABLES.map((t) => (
            <div key={t.table} className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {t.label} · {(data[t.table] ?? []).length}
              </p>
              {(data[t.table] ?? []).slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/40">
                  <span className="text-[11px] text-foreground truncate">{String(r[t.title] ?? '—')}</span>
                  <StatusChip status={r.status} />
                  <span className="text-[10px] text-muted-foreground ml-auto truncate">{t.meta(r)}</span>
                </div>
              ))}
              {(data[t.table] ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No records — this counts as an open readiness gap.</p>
              )}
            </div>
          ))}
        </div>
      </GovCard>

      <GovCard title="Support cases" icon={LifeBuoy}>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input value={form.subject} maxLength={120} placeholder="Subject" className="h-9 text-xs sm:col-span-2"
            onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <select value={form.category} className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['technical', 'clinical_workflow', 'billing', 'access', 'other'].map((c) =>
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={form.priority} className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
            onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <Input value={form.description} maxLength={500} className="h-9 text-xs"
          placeholder="Description — no patient identifiers, dates of birth or record numbers"
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button size="sm" className="rounded-full" disabled={busy || !form.subject.trim()} onClick={submitCase}>
          Open case
        </Button>
        <div className="space-y-1.5">
          {support.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/40">
              <span className="text-[11px] text-foreground truncate">{String(c.subject)}</span>
              <StatusChip status={c.status} />
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{String(c.priority)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <AlertOctagon className="w-3.5 h-3.5 mt-0.5 text-amber-500" />
          Support descriptions are PHI-minimized server-side: identifiers such as SSNs, dates of birth and
          record numbers are rejected on write.
        </div>
      </GovCard>
    </div>
  );
}
