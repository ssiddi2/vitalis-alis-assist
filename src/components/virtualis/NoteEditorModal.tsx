import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, FileSignature, Shield, Save } from 'lucide-react';
import { ClinicalNote, NoteType } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  progress: 'Progress Note',
  consult: 'Consult Note',
  discharge: 'Discharge Summary',
  procedure: 'Procedure Note',
};

interface NoteEditorModalProps {
  note: ClinicalNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicianName: string;
  patientId?: string;
  mode: 'edit' | 'sign';
}

export function NoteEditorModal({
  note,
  open,
  onOpenChange,
  clinicianName,
  patientId,
  mode,
}: NoteEditorModalProps) {
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const { logSign, logAction } = useAuditLog();

  useEffect(() => {
    if (note && open) {
      setSubjective(note.content.subjective || '');
      setObjective(note.content.objective || '');
      setAssessment(note.content.assessment || '');
      setPlan(note.content.plan || '');
      setSigned(false);
    }
  }, [note?.id, open]);

  if (!note) return null;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('clinical_notes')
      .update({ content: { subjective, objective, assessment, plan } })
      .eq('id', note.id);

    setSaving(false);
    if (error) {
      toast.error('Failed to save note');
      return;
    }

    if (patientId) {
      logAction('update', 'clinical_note', note.id, patientId, { note_type: note.note_type });
    }
    toast.success('Note saved');
    onOpenChange(false);
  };

  const handleSign = async () => {
    setSigned(true);

    const { error } = await supabase
      .from('clinical_notes')
      .update({
        content: { subjective, objective, assessment, plan },
        status: 'signed' as const,
        signed_at: new Date().toISOString(),
      })
      .eq('id', note.id);

    if (error) {
      toast.error('Failed to sign note');
      setSigned(false);
      return;
    }

    if (patientId) {
      logSign('clinical_note', note.id, patientId, {
        note_type: note.note_type,
        signed_by: clinicianName,
        signature_method: 'electronic',
      });
    }

    setTimeout(() => {
      toast.success('Note signed');
      setSigned(false);
      onOpenChange(false);
    }, 800);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving && !signed) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg glass border-border/50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileSignature className="h-5 w-5 text-info" />
            {mode === 'sign' ? 'Review & Sign' : 'Edit Note'}
          </DialogTitle>
          <DialogDescription asChild>
            <span className="text-[10px] px-2 py-0.5 bg-info/10 text-info rounded-full font-semibold uppercase">
              {NOTE_TYPE_LABELS[note.note_type]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {([
            { label: 'Subjective', value: subjective, setter: setSubjective, placeholder: 'Patient complaints, symptoms, history...' },
            { label: 'Objective', value: objective, setter: setObjective, placeholder: 'Vitals, physical exam, lab results...' },
            { label: 'Assessment', value: assessment, setter: setAssessment, placeholder: 'Clinical assessment and diagnosis...' },
            { label: 'Plan', value: plan, setter: setPlan, placeholder: 'Treatment plan and next steps...' },
          ] as const).map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {label.charAt(0)}
                <span className="text-muted-foreground font-normal"> — {label}</span>
              </label>
              <Textarea
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="text-xs resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
                disabled={signed}
              />
            </div>
          ))}

          {mode === 'sign' && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                  Electronic Signature
                </span>
              </div>
              <p className="text-sm text-foreground font-medium">{clinicianName}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {' · '}
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {mode === 'edit' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-10 text-xs rounded-lg"
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-10 text-xs rounded-lg btn-primary-gradient"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSign}
                disabled={signed || saving}
                className={cn(
                  'w-full h-11 text-sm font-semibold rounded-lg transition-all',
                  signed ? 'bg-success text-success-foreground' : 'btn-primary-gradient'
                )}
              >
                {signed ? (
                  <>
                    <Check className="h-4 w-4 mr-2 animate-in zoom-in" />
                    Note Signed
                  </>
                ) : (
                  <>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Sign Note
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
