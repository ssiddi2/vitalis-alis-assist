import { useState } from 'react';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Pill, Plus, Check, X, FileSignature, Clock, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Clock },
  signed: { label: 'Signed', color: 'bg-primary/10 text-primary', icon: FileSignature },
  sent: { label: 'Sent', color: 'bg-info/10 text-info', icon: Send },
  filled: { label: 'Filled', color: 'bg-success/10 text-success', icon: Check },
  cancelled: { label: 'Cancelled', color: 'bg-critical/10 text-critical', icon: X },
};

const ROUTES = ['PO', 'IV', 'IM', 'SQ', 'Topical', 'Inhaled', 'PR', 'SL'];
const FREQUENCIES = ['QD', 'BID', 'TID', 'QID', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'PRN', 'QHS', 'QAM', 'Weekly'];

interface PrescriptionsPanelProps {
  patientId: string;
}

export function PrescriptionsPanel({ patientId }: PrescriptionsPanelProps) {
  const { prescriptions, loading, createPrescription, signPrescription, cancelPrescription } = usePrescriptions(patientId);
  const [newRxOpen, setNewRxOpen] = useState(false);
  const [form, setForm] = useState({
    medication_name: '',
    dose: '',
    frequency: 'QD',
    route: 'PO',
    quantity: '',
    refills: '0',
    sig: '',
    pharmacy_name: '',
    dea_schedule: '',
  });

  const handleCreate = async () => {
    if (!form.medication_name) return;
    try {
      await createPrescription({
        patient_id: patientId,
        medication_name: form.medication_name,
        dose: form.dose || undefined,
        frequency: form.frequency || undefined,
        route: form.route || undefined,
        quantity: form.quantity ? parseInt(form.quantity) : undefined,
        refills: parseInt(form.refills) || 0,
        sig: form.sig || undefined,
        pharmacy_name: form.pharmacy_name || undefined,
        dea_schedule: form.dea_schedule || undefined,
      });
      toast.success('Prescription created');
      setNewRxOpen(false);
      setForm({ medication_name: '', dose: '', frequency: 'QD', route: 'PO', quantity: '', refills: '0', sig: '', pharmacy_name: '', dea_schedule: '' });
    } catch {
      toast.error('Failed to create prescription');
    }
  };

  const handleSign = async (rxId: string) => {
    try {
      await signPrescription(rxId);
      toast.success('Prescription signed');
    } catch {
      toast.error('Failed to sign');
    }
  };

  const handleCancel = async (rxId: string) => {
    try {
      await cancelPrescription(rxId);
      toast.info('Prescription cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const active = prescriptions.filter(rx => !['cancelled'].includes(rx.status));
  const cancelled = prescriptions.filter(rx => rx.status === 'cancelled');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-soft">
            <Pill className="w-3.5 h-3.5 text-primary" />
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prescriptions</h2>
          <span className="text-[10px] px-1.5 rounded-full bg-muted text-muted-foreground">{active.length}</span>
        </div>

        <Dialog open={newRxOpen} onOpenChange={setNewRxOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1">
              <Plus className="w-3 h-3" /> New Rx
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>New Prescription</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Medication Name *</Label>
                <Input value={form.medication_name} onChange={e => setForm(p => ({ ...p, medication_name: e.target.value }))} placeholder="e.g. Metformin" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Dose</Label>
                  <Input value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} placeholder="500mg" />
                </div>
                <div>
                  <Label>Route</Label>
                  <Select value={form.route} onValueChange={v => setForm(p => ({ ...p, route: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="30" />
                </div>
                <div>
                  <Label>Refills</Label>
                  <Input type="number" value={form.refills} onChange={e => setForm(p => ({ ...p, refills: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>SIG (Patient Instructions)</Label>
                <Input value={form.sig} onChange={e => setForm(p => ({ ...p, sig: e.target.value }))} placeholder="Take 1 tablet by mouth daily with meals" />
              </div>
              <div>
                <Label>Pharmacy</Label>
                <Input value={form.pharmacy_name} onChange={e => setForm(p => ({ ...p, pharmacy_name: e.target.value }))} placeholder="Preferred pharmacy" />
              </div>
              <Button onClick={handleCreate} disabled={!form.medication_name} className="w-full rounded-xl">
                Create Prescription
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Prescriptions */}
      <div className="space-y-2">
        {active.map(rx => {
          const cfg = STATUS_CONFIG[rx.status] || STATUS_CONFIG.draft;
          return (
            <div key={rx.id} className="glass-strong rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{rx.medication_name}</span>
                  <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 rounded-full', cfg.color)}>
                    {cfg.label}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  {rx.status === 'draft' && (
                    <>
                      <Button size="sm" variant="default" className="rounded-lg text-[10px] h-6 px-2 gap-1" onClick={() => handleSign(rx.id)}>
                        <FileSignature className="w-3 h-3" /> Sign
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-lg text-[10px] h-6 px-2 text-critical" onClick={() => handleCancel(rx.id)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {rx.dose && <span>{rx.dose}</span>}
                {rx.route && <><span className="text-muted-foreground/30">·</span><span>{rx.route}</span></>}
                {rx.frequency && <><span className="text-muted-foreground/30">·</span><span>{rx.frequency}</span></>}
                {rx.quantity && <><span className="text-muted-foreground/30">·</span><span>Qty: {rx.quantity}</span></>}
                {rx.refills !== null && <><span className="text-muted-foreground/30">·</span><span>Refills: {rx.refills}</span></>}
              </div>
              {rx.sig && <p className="text-[11px] text-muted-foreground mt-1 italic">{rx.sig}</p>}
              {rx.pharmacy_name && <p className="text-[10px] text-muted-foreground/60 mt-0.5">📍 {rx.pharmacy_name}</p>}
            </div>
          );
        })}

        {!loading && active.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No active prescriptions
          </div>
        )}
      </div>
    </div>
  );
}
