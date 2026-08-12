import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useCareCatalog, type StateCoverage } from '@/hooks/useCareCatalog';
import { US_STATES } from '@/lib/careRequests';

const STATUSES: StateCoverage['status'][] = ['available', 'waitlist', 'unavailable'];

/** Admin configuration for the care catalog. Availability defaults to unavailable. */
export function CareCatalogAdmin({ hospitalId }: { hospitalId?: string }) {
  const { user } = useAuth();
  const { services, coverage, assignments, templates, saveService, saveCoverage, saveAssignment, approveTemplate } =
    useCareCatalog(hospitalId);
  const [providers, setProviders] = useState<{ user_id: string; full_name: string }[]>([]);
  const [cov, setCov] = useState({ service_line_id: '', state_code: '', status: 'unavailable' as StateCoverage['status'], launch_date: '', reason: '' });
  const [asg, setAsg] = useState({ provider_user_id: '', service_line_id: '' });

  useEffect(() => {
    if (!hospitalId) return;
    void supabase.from('hospital_users').select('user_id').eq('hospital_id', hospitalId).then(async ({ data }) => {
      const ids = (data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return setProviders([]);
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      setProviders((profs ?? []).map((p) => ({ user_id: p.user_id, full_name: p.full_name ?? 'Clinician' })));
    });
  }, [hospitalId]);

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Update rejected'); }
  };

  return (
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="rounded-full">
        <TabsTrigger value="services" className="rounded-full">Services</TabsTrigger>
        <TabsTrigger value="coverage" className="rounded-full">State coverage</TabsTrigger>
        <TabsTrigger value="providers" className="rounded-full">Provider assignment</TabsTrigger>
        <TabsTrigger value="screens" className="rounded-full">Safety screens</TabsTrigger>
      </TabsList>

      <TabsContent value="services" className="mt-4 space-y-2">
        {services.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft backdrop-blur-sm">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.code} · min age {s.min_age} · {s.modality} · {s.response_window}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <Switch checked={s.active} onCheckedChange={(v) => guard(() => saveService({ id: s.id, active: v }), 'Service updated')} />
                Active
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={s.visible_to_patients} onCheckedChange={(v) => guard(() => saveService({ id: s.id, visible_to_patients: v }), 'Visibility updated')} />
                Visible
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={s.allows_new_patients} onCheckedChange={(v) => guard(() => saveService({ id: s.id, allows_new_patients: v }), 'Eligibility updated')} />
                New patients
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={s.requires_referral} onCheckedChange={(v) => guard(() => saveService({ id: s.id, requires_referral: v }), 'Referral rule updated')} />
                Referral
              </label>
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="coverage" className="mt-4 space-y-3">
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft backdrop-blur-sm sm:grid-cols-5">
          <div>
            <Label className="text-xs">Service</Label>
            <Select value={cov.service_line_id} onValueChange={(v) => setCov({ ...cov, service_line_id: v })}>
              <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Select value={cov.state_code} onValueChange={(v) => setCov({ ...cov, state_code: v })}>
              <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent className="max-h-64">{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={cov.status} onValueChange={(v) => setCov({ ...cov, status: v as StateCoverage['status'] })}>
              <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Launch date</Label>
            <Input type="date" className="mt-1 h-10 rounded-xl" value={cov.launch_date}
              onChange={(e) => setCov({ ...cov, launch_date: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full rounded-full"
              disabled={!cov.service_line_id || !cov.state_code}
              onClick={() => guard(() => saveCoverage({
                service_line_id: cov.service_line_id, state_code: cov.state_code, status: cov.status,
                launch_date: cov.launch_date || null, reason: cov.reason || null,
              }), 'Coverage saved')}
            >
              Save
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {coverage.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs shadow-soft backdrop-blur-sm">
              <span>{services.find((s) => s.id === c.service_line_id)?.name ?? '—'} · {c.state_code}</span>
              <Badge variant="outline" className="rounded-full text-[10px]">{c.status}</Badge>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="providers" className="mt-4 space-y-3">
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft backdrop-blur-sm sm:grid-cols-3">
          <div>
            <Label className="text-xs">Provider</Label>
            <Select value={asg.provider_user_id} onValueChange={(v) => setAsg({ ...asg, provider_user_id: v })}>
              <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>{providers.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Service</Label>
            <Select value={asg.service_line_id} onValueChange={(v) => setAsg({ ...asg, service_line_id: v })}>
              <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full rounded-full" disabled={!asg.provider_user_id || !asg.service_line_id}
              onClick={() => guard(() => saveAssignment({ ...asg, active: true }), 'Assignment saved')}>
              Assign
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs shadow-soft backdrop-blur-sm">
              <span>{providers.find((p) => p.user_id === a.provider_user_id)?.full_name ?? 'Clinician'} · {services.find((s) => s.id === a.service_line_id)?.name}</span>
              <Switch checked={a.active}
                onCheckedChange={(v) => guard(() => saveAssignment({ provider_user_id: a.provider_user_id, service_line_id: a.service_line_id, active: v }), 'Assignment updated')} />
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="screens" className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Safety screens are static and never AI-generated. Templates stay inactive until a medical director approves them.
        </p>
        {templates.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft backdrop-blur-sm">
            <div>
              <p className="text-sm font-semibold">
                {services.find((s) => s.id === t.service_line_id)?.name ?? 'Global screen'} · v{t.version}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.questions.length} questions · {t.active ? 'active' : 'pending medical-director approval'}
              </p>
            </div>
            {t.active ? (
              <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600">
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Approved
              </Badge>
            ) : (
              <Button size="sm" className="rounded-full" disabled={!user}
                onClick={() => guard(() => approveTemplate(t.id, user!.id), 'Template approved')}>
                <ShieldCheck className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Approve &amp; activate
              </Button>
            )}
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
