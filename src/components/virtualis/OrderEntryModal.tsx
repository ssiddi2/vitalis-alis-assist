import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ClipboardList, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface OrderEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}

const ORDER_TYPES = [
  { value: 'lab', label: 'Laboratory' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'medication', label: 'Medication' },
  { value: 'consult', label: 'Consult' },
  { value: 'procedure', label: 'Procedure' },
];

const PRIORITIES = [
  { value: 'STAT', label: 'STAT', color: 'text-critical' },
  { value: 'Urgent', label: 'Urgent', color: 'text-warning' },
  { value: 'Today', label: 'Today', color: 'text-foreground' },
  { value: 'Routine', label: 'Routine', color: 'text-muted-foreground' },
];

export function OrderEntryModal({ open, onOpenChange, patientId }: OrderEntryModalProps) {
  const { user } = useAuth();
  const [orderType, setOrderType] = useState('lab');
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('Routine');
  const [rationale, setRationale] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Order name is required');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('staged_orders')
      .insert({
        patient_id: patientId,
        order_type: orderType,
        order_data: { name: name.trim(), priority, details: details.trim() || undefined },
        rationale: rationale.trim() || null,
        status: 'staged',
        created_by: user?.id || null,
      });

    setSubmitting(false);

    if (error) {
      toast.error('Failed to create order');
      console.error(error);
      return;
    }

    toast.success('Order staged — awaiting signature');
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setOrderType('lab');
    setName('');
    setPriority('Routine');
    setRationale('');
    setDetails('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md glass border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ClipboardList className="h-5 w-5 text-primary" />
            New Order
          </DialogTitle>
          <DialogDescription>
            Enter order details. It will be staged for signature approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Order Type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger className="mt-1 h-9 text-xs bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1 h-9 text-xs bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value} className={`text-xs ${p.color}`}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Order Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CBC with Differential, CT Chest w/ Contrast"
              className="mt-1 h-9 text-xs bg-secondary/50"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Clinical Indication / Rationale</Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why is this order needed?"
              rows={2}
              className="mt-1 text-xs resize-none bg-secondary/50"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Additional Details <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Dosing, laterality, special instructions..."
              rows={2}
              className="mt-1 text-xs resize-none bg-secondary/50"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 text-xs rounded-lg"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
              className="flex-1 h-10 text-xs rounded-lg btn-primary-gradient"
            >
              <Plus className="h-4 w-4 mr-1" />
              {submitting ? 'Staging...' : 'Stage Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
