import { useState, useEffect } from 'react';
import { useConsultRequests } from '@/hooks/useConsultRequests';
import { useConsultationThread } from '@/hooks/useConsultationThread';
import { useHospital } from '@/contexts/HospitalContext';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Brain, Clock, Stethoscope, Sparkles, Loader2 } from 'lucide-react';
import { LiveAcuityCard } from '@/components/virtualis/acuity/LiveAcuityCard';
import type { ConsultUrgency } from '@/types/team';

interface ConsultRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

const SPECIALTIES = [
  'Cardiology', 'Pulmonology', 'Nephrology', 'Infectious Disease',
  'Hematology', 'Gastroenterology', 'Neurology', 'Oncology',
  'Rheumatology', 'Endocrinology', 'Surgery - General',
  'Surgery - Vascular', 'Surgery - Cardiothoracic',
  'Psychiatry', 'Palliative Care',
];

const URGENCY_CONFIG: Record<ConsultUrgency, { label: string; color: string; icon: React.ReactNode }> = {
  routine: { label: 'Routine', color: 'bg-muted text-muted-foreground', icon: <Clock className="h-4 w-4" /> },
  urgent: { label: 'Urgent', color: 'bg-yellow-500/20 text-yellow-700', icon: <AlertTriangle className="h-4 w-4" /> },
  stat: { label: 'STAT', color: 'bg-destructive/20 text-destructive', icon: <AlertTriangle className="h-4 w-4" /> },
};

export function ConsultRequestModal({ isOpen, onClose, patientId, patientName }: ConsultRequestModalProps) {
  const { selectedHospital } = useHospital();
  const { createConsult, loading } = useConsultRequests();
  const { createThread, loading: threadLoading, suggestUrgency } = useConsultationThread();

  const [specialty, setSpecialty] = useState('');
  const [urgency, setUrgency] = useState<ConsultUrgency>('routine');
  const [reason, setReason] = useState('');
  const [startAIThread, setStartAIThread] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<ConsultUrgency | null>(null);
  const [userOverrode, setUserOverrode] = useState(false);

  // Debounced AI urgency suggestion when reason + specialty are set
  useEffect(() => {
    if (!specialty || reason.trim().length < 15) {
      setSuggested(null);
      return;
    }
    const handle = setTimeout(async () => {
      setSuggesting(true);
      const result = await suggestUrgency({ specialty, reason: reason.trim() });
      setSuggesting(false);
      if (result) {
        setSuggested(result);
        if (!userOverrode) setUrgency(result);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [specialty, reason, suggestUrgency, userOverrode]);

  const handleUrgencyChange = (u: ConsultUrgency) => {
    setUserOverrode(true);
    setUrgency(u);
  };

  const handleSubmit = async () => {
    if (!specialty || !reason.trim() || !selectedHospital?.id) return;

    const result = await createConsult({
      patient_id: patientId,
      hospital_id: selectedHospital.id,
      specialty,
      urgency,
      reason: reason.trim(),
    });

    if (result && startAIThread) {
      await createThread({
        patientId,
        hospitalId: selectedHospital.id,
        specialty,
        reason: reason.trim(),
        consultRequestId: result.id,
      });
    }

    if (result) {
      onClose();
      setSpecialty('');
      setUrgency('routine');
      setReason('');
    }
  };

  const busy = loading || threadLoading;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Request Consult
          </DialogTitle>
          <DialogDescription>Request a specialty consultation for {patientName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="specialty">Specialty</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger><SelectValue placeholder="Select specialty..." /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Acuity</Label>
              {suggesting && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />ALIS triaging…
                </span>
              )}
              {!suggesting && suggested && (
                <span className="text-[11px] text-primary inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  ALIS suggests {URGENCY_CONFIG[suggested].label}{userOverrode && urgency !== suggested ? ' (overridden)' : ''}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {(Object.keys(URGENCY_CONFIG) as ConsultUrgency[]).map(u => {
                const config = URGENCY_CONFIG[u];
                return (
                  <Button key={u} type="button" variant={urgency === u ? 'default' : 'outline'} size="sm" onClick={() => handleUrgencyChange(u)} className="flex-1">
                    {config.icon}<span className="ml-1">{config.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Consult</Label>
            <Textarea id="reason" placeholder="Describe the clinical question or concern..." value={reason} onChange={e => setReason(e.target.value)} rows={4} maxLength={4000} />
          </div>

          <LiveAcuityCard
            clinicalReason={reason}
            patientInfo={`Patient: ${patientName}`}
            patientId={patientId}
            selectedSpecialty={specialty}
            onSpecialtySelect={setSpecialty}
          />


          {/* AI Thread Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Brain className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Start AI Consultation Thread</p>
              <p className="text-xs text-muted-foreground">ALIS will load patient context and generate role-specific insights</p>
            </div>
            <Button size="sm" variant={startAIThread ? 'default' : 'outline'} onClick={() => setStartAIThread(!startAIThread)}>
              {startAIThread ? 'On' : 'Off'}
            </Button>
          </div>

          {specialty && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={URGENCY_CONFIG[urgency].color}>{URGENCY_CONFIG[urgency].label}</Badge>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!specialty || !reason.trim() || busy}>
            {busy ? 'Sending...' : startAIThread ? 'Send & Start AI Thread' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
