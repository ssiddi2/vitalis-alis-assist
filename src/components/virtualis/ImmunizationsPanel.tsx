import { useState } from 'react';
import { useImmunizations } from '@/hooks/useImmunizations';
import { Syringe, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface ImmunizationsPanelProps {
  patientId: string;
}

export function ImmunizationsPanel({ patientId }: ImmunizationsPanelProps) {
  const { immunizations, loading, addImmunization } = useImmunizations(patientId);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vaccine_name: '',
    administered_date: new Date().toISOString().split('T')[0],
    lot_number: '',
    site: 'Left deltoid',
    route: 'IM',
    manufacturer: '',
  });

  const handleAdd = async () => {
    if (!form.vaccine_name) { toast.error('Vaccine name is required'); return; }
    setSaving(true);
    const { error } = await addImmunization({
      patient_id: patientId,
      vaccine_name: form.vaccine_name,
      administered_date: form.administered_date,
      lot_number: form.lot_number || null,
      site: form.site || null,
      route: form.route || null,
      manufacturer: form.manufacturer || null,
      administered_by: null,
      next_due_date: null,
      cvx_code: null,
    });
    setSaving(false);
    if (error) { toast.error('Failed to add immunization'); return; }
    toast.success('Immunization recorded');
    setShowAdd(false);
    setForm({ vaccine_name: '', administered_date: new Date().toISOString().split('T')[0], lot_number: '', site: 'Left deltoid', route: 'IM', manufacturer: '' });
  };

  const isOverdue = (nextDue: string | null) => nextDue && isPast(parseISO(nextDue));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Syringe className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Immunizations</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
          {immunizations.length}
        </span>
        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3" /> Add Vaccine
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : immunizations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Syringe className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No immunization records</p>
        </div>
      ) : (
        <div className="space-y-2">
          {immunizations.map((imm) => (
            <div key={imm.id} className="card-apple p-3 flex items-start gap-3">
              <Syringe className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">{imm.vaccine_name}</p>
                  {isOverdue(imm.next_due_date) && (
                    <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-critical/10 text-critical border border-critical/20 font-semibold">
                      <AlertTriangle className="w-2.5 h-2.5" /> OVERDUE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(parseISO(imm.administered_date), 'MMM d, yyyy')}
                  {imm.manufacturer && ` · ${imm.manufacturer}`}
                  {imm.lot_number && ` · Lot: ${imm.lot_number}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {imm.site && `${imm.site}`}
                  {imm.route && ` · ${imm.route}`}
                  {imm.administered_by && ` · by ${imm.administered_by}`}
                </p>
                {imm.next_due_date && (
                  <p className={cn("text-[10px] mt-0.5", isOverdue(imm.next_due_date) ? "text-critical font-medium" : "text-muted-foreground")}>
                    Next due: {format(parseISO(imm.next_due_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Syringe className="h-5 w-5 text-primary" /> Record Immunization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Vaccine Name *</Label>
              <Input value={form.vaccine_name} onChange={e => setForm(f => ({ ...f, vaccine_name: e.target.value }))} placeholder="e.g. Influenza (Fluzone)" className="mt-1 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date Administered</Label>
                <Input type="date" value={form.administered_date} onChange={e => setForm(f => ({ ...f, administered_date: e.target.value }))} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Lot Number</Label>
                <Input value={form.lot_number} onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))} placeholder="e.g. FL2025-A12" className="mt-1 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Site</Label>
                <Input value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Route</Label>
                <Input value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value }))} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Manufacturer</Label>
                <Input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} className="mt-1 text-xs" />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving} className="w-full h-10 text-xs btn-primary-gradient">
              {saving ? 'Saving...' : 'Record Immunization'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
