import { useState } from 'react';
import { useConsultRequests } from '@/hooks/useConsultRequests';
import { useHospital } from '@/contexts/HospitalContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Stethoscope } from 'lucide-react';
import type { ConsultUrgency } from '@/types/team';

interface ConsultRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

const SPECIALTIES = [
  'Cardiology',
  'Pulmonology',
  'Nephrology',
  'Infectious Disease',
  'Hematology',
  'Gastroenterology',
  'Neurology',
  'Oncology',
  'Rheumatology',
  'Endocrinology',
  'Surgery - General',
  'Surgery - Vascular',
  'Surgery - Cardiothoracic',
  'Psychiatry',
  'Palliative Care',
];

const URGENCY_CONFIG: Record<ConsultUrgency, { label: string; color: string; icon: React.ReactNode }> = {
  routine: { 
    label: 'Routine', 
    color: 'bg-muted text-muted-foreground',
    icon: <Clock className="h-4 w-4" />
  },
  urgent: { 
    label: 'Urgent', 
    color: 'bg-yellow-500/20 text-yellow-700',
    icon: <AlertTriangle className="h-4 w-4" />
  },
  stat: { 
    label: 'STAT', 
    color: 'bg-destructive/20 text-destructive',
    icon: <AlertTriangle className="h-4 w-4" />
  },
};

export function ConsultRequestModal({
  isOpen,
  onClose,
  patientId,
  patientName,
}: ConsultRequestModalProps) {
  const { selectedHospital } = useHospital();
  const { createConsult, loading } = useConsultRequests();
  
  const [specialty, setSpecialty] = useState('');
  const [urgency, setUrgency] = useState<ConsultUrgency>('routine');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!specialty || !reason.trim() || !selectedHospital?.id) return;

    const result = await createConsult({
      patient_id: patientId,
      hospital_id: selectedHospital.id,
      specialty,
      urgency,
      reason: reason.trim(),
    });

    if (result) {
      onClose();
      setSpecialty('');
      setUrgency('routine');
      setReason('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Request Consult
          </DialogTitle>
          <DialogDescription>
            Request a specialty consultation for {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Specialty */}
          <div className="space-y-2">
            <Label htmlFor="specialty">Specialty</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger>
                <SelectValue placeholder="Select specialty..." />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <Label>Urgency</Label>
            <div className="flex gap-2">
              {(Object.keys(URGENCY_CONFIG) as ConsultUrgency[]).map((u) => {
                const config = URGENCY_CONFIG[u];
                return (
                  <Button
                    key={u}
                    type="button"
                    variant={urgency === u ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUrgency(u)}
                    className="flex-1"
                  >
                    {config.icon}
                    <span className="ml-1">{config.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Consult</Label>
            <Textarea
              id="reason"
              placeholder="Describe the clinical question or concern..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          {/* Preview */}
          {specialty && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={URGENCY_CONFIG[urgency].color}>
                  {URGENCY_CONFIG[urgency].label}
                </Badge>
                <span className="font-medium">{specialty}</span>
              </div>
              <p className="text-muted-foreground">
                Consult will be sent to the on-call {specialty} team. 
                {urgency === 'stat' && ' Immediate response expected.'}
                {urgency === 'urgent' && ' Response expected within 4 hours.'}
                {urgency === 'routine' && ' Response expected within 24 hours.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!specialty || !reason.trim() || loading}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
