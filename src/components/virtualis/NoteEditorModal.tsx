import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, FileSignature, Shield, Save, Sparkles, Loader2, Plug, HardDrive, Lock, History, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { VoiceDictationButton } from './VoiceDictationButton';
import { ClinicalNote, NoteType } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useHospital } from '@/contexts/HospitalContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { loadSmartSession } from '@/lib/smart';
import { writeNoteToEhr, isExternalWritebackConfigured } from '@/lib/ehrWriteback';
import { cn } from '@/lib/utils';
import { DsiInfo } from '@/components/virtualis/DsiInfo';
import { useAuth } from '@/contexts/AuthContext';
import { useNoteIntegrity } from '@/hooks/useNoteIntegrity';
import { addAddendum, cosignNote, signNote } from '@/lib/noteIntegrity';
import { CoverageClaimPanel } from '@/components/virtualis/CoverageClaimPanel';
import { ObesityCarePanel } from '@/components/virtualis/ObesityCarePanel';


const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  progress: 'Progress Note',
  consult: 'Consult Note',
  discharge: 'Discharge Summary',
  procedure: 'Procedure Note',
};

interface BillingCode {
  code: string;
  description: string;
  type: 'CPT' | 'ICD-10';
}

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
  const [transcript, setTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [codes, setCodes] = useState<BillingCode[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [addReason, setAddReason] = useState('');
  const [addText, setAddText] = useState('');
  const [busy, setBusy] = useState(false);
  const { logSign, logAction } = useAuditLog();
  const { selectedHospital } = useHospital();
  const { user } = useAuth();

  const isSigned = !!note && (note.status === 'signed' || note.status === 'amended');
  const { versions, addenda, refresh } = useNoteIntegrity(note?.id, open && isSigned);

  const smart = loadSmartSession();
  const issHost = (() => {
    try { return smart ? new URL(smart.iss).host : null; } catch { return null; }
  })();

  useEffect(() => {
    if (note && open) {
      setSubjective(note.content.subjective || '');
      setObjective(note.content.objective || '');
      setAssessment(note.content.assessment || '');
      setPlan(note.content.plan || '');
      setTranscript('');
      setCodes([]);
      setAccepted([]);
      setSigned(false);
    }
  }, [note?.id, open]);

  if (!note) return null;

  const buildBody = () =>
    `Subjective:\n${subjective}\n\nObjective:\n${objective}\n\nAssessment:\n${assessment}\n\nPlan:\n${plan}` +
    (accepted.length ? `\n\nBilling Codes:\n${accepted.join('\n')}` : '');

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      toast.error('Add or dictate a transcript first');
      return;
    }
    if (!selectedHospital?.id) {
      toast.error('No facility selected');
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke('generate-note', {
      body: {
        transcript,
        hospital_id: selectedHospital.id,
        note_type: note.note_type,
        patientContext: patientId ? { patient_id: patientId } : undefined,
      },
    });
    setGenerating(false);

    if (error || !data) {
      toast.error('ALIS could not draft the note');
      return;
    }
    const res = data as Partial<BillingCode> & {
      subjective?: string; objective?: string; assessment?: string; plan?: string;
      suggestedBillingCodes?: BillingCode[]; error?: string;
    };
    if (res.error && !res.subjective) {
      toast.error('ALIS is temporarily unavailable — note left unchanged');
      return;
    }
    if (res.subjective) setSubjective(res.subjective);
    if (res.objective) setObjective(res.objective);
    if (res.assessment) setAssessment(res.assessment);
    if (res.plan) setPlan(res.plan);
    setCodes(res.suggestedBillingCodes || []);
    toast.success('Draft generated — review before signing');
  };

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
    if (!selectedHospital?.id) {
      toast.error('No facility selected');
      return;
    }
    setSigned(true);

    const { error } = await signNote({
      note_id: note.id,
      hospital_id: selectedHospital.id,
      lock_version: note.lock_version ?? undefined,
      content: { subjective, objective, assessment, plan, billing_codes: accepted },
    });

    if (error) {
      toast.error(error);
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

    // Local signing NEVER claims external delivery: only an authoritative
    // facility/endpoint binding can produce a push, and none exists today.
    const externalConfigured = isExternalWritebackConfigured();
    logAction(
      'export',
      'note.push_to_ehr',
      note.id,
      patientId,
      {
        note_type: note.note_type,
        status: 'local_record',
        external_delivery: externalConfigured ? 'attempted' : 'not_configured',
        iss: issHost,
      },
    );

    if (externalConfigured && smart?.patient_id) {
      void writeNoteToEhr(smart.patient_id, NOTE_TYPE_LABELS[note.note_type] || 'Clinical Note', buildBody());
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
            {isSigned ? 'Signed Note' : mode === 'sign' ? 'Review & Sign' : 'Edit Note'}
          </DialogTitle>
          <DialogDescription asChild>
            <span className="text-[10px] px-2 py-0.5 bg-info/10 text-info rounded-full font-semibold uppercase">
              {NOTE_TYPE_LABELS[note.note_type]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Ambient scribe */}
          <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                01 — Encounter transcript
              </span>
              <VoiceDictationButton
                onTranscript={(text) => setTranscript(prev => (prev ? prev + ' ' : '') + text)}
                size="sm"
              />
            </div>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Dictate or paste the encounter conversation…"
              rows={3}
              maxLength={20000}
              className="text-xs resize-none bg-white border-slate-200"
              disabled={signed || generating || isSigned}
            />
            <div className="flex items-center justify-end">
              <DsiInfo interventionId="ambient-note" />
            </div>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generating || signed || isSigned}
              className="w-full h-9 text-xs rounded-xl btn-primary-gradient"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
              {generating ? 'ALIS is drafting…' : 'Generate with ALIS'}
            </Button>

            {codes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  02 — Suggested billing codes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {codes.map((c) => {
                    const label = `${c.type} ${c.code} — ${c.description}`;
                    const isOn = accepted.includes(label);
                    return (
                      <button
                        key={c.type + c.code}
                        type="button"
                        title={c.description}
                        onClick={() => setAccepted(prev => isOn ? prev.filter(x => x !== label) : [...prev, label])}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                          isOn
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary',
                        )}
                      >
                        <span className="font-mono">{c.code}</span>
                        <span className="ml-1 opacity-70">{c.type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {([
            { label: 'Subjective', value: subjective, setter: setSubjective, placeholder: 'Patient complaints, symptoms, history...' },
            { label: 'Objective', value: objective, setter: setObjective, placeholder: 'Vitals, physical exam, lab results...' },
            { label: 'Assessment', value: assessment, setter: setAssessment, placeholder: 'Clinical assessment and diagnosis...' },
            { label: 'Plan', value: plan, setter: setPlan, placeholder: 'Treatment plan and next steps...' },
          ] as const).map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">
                  {label.charAt(0)}
                  <span className="text-muted-foreground font-normal"> — {label}</span>
                </label>
                <VoiceDictationButton
                  onTranscript={(text) => setter(prev => (prev ? prev + ' ' : '') + text)}
                  size="sm"
                />
              </div>
              <Textarea
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                rows={3}
                maxLength={8000}
                className="text-xs resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
                disabled={signed || isSigned}
                readOnly={isSigned}
              />
            </div>
          ))}

          <ObesityCarePanel noteId={note.id} patientId={patientId} />

          <CoverageClaimPanel hospitalId={selectedHospital?.id} patientId={patientId} noteId={note.id} />



          {isSigned && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-700">
                    Signed &amp; locked{note.cosigned_at ? ' · Cosigned' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {note.signed_at ? new Date(note.signed_at).toLocaleString() : '—'}
                  {note.cosigned_at ? ` · cosigned ${new Date(note.cosigned_at).toLocaleString()}` : ''}
                </p>
                {note.content_hash && (
                  <p className="font-mono text-[10px] text-slate-500 break-all">
                    SHA-256 {note.content_hash.slice(0, 32)}…
                  </p>
                )}
                {versions.map((v) => (
                  <p key={v.id} className="font-mono text-[10px] text-slate-500">
                    v{v.version} · {new Date(v.signed_at).toLocaleString()} · {v.content_hash.slice(0, 12)}…
                  </p>
                ))}
                {!note.cosigned_at && user?.id !== note.signed_by && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="mt-1 h-8 rounded-xl text-[11px]"
                    onClick={async () => {
                      if (!selectedHospital?.id) return;
                      setBusy(true);
                      const { error } = await cosignNote({ note_id: note.id, hospital_id: selectedHospital.id });
                      setBusy(false);
                      if (error) return toast.error(error);
                      toast.success('Note cosigned');
                      onOpenChange(false);
                    }}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                    Cosign as supervising clinician
                  </Button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                  <History className="h-3 w-3" /> Addendum history ({addenda.length})
                </span>
                {addenda.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-2">
                    <p className="text-[10px] font-mono text-slate-500">
                      #{a.sequence} · {new Date(a.created_at).toLocaleString()} · {a.content_hash.slice(0, 12)}…
                    </p>
                    <p className="text-[11px] font-semibold text-slate-700">Reason: {a.reason}</p>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{a.content?.text}</p>
                  </div>
                ))}
                <Input
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  placeholder="Reason for correction (required)"
                  maxLength={500}
                  className="h-8 text-xs"
                />
                <Textarea
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="Addendum text…"
                  rows={3}
                  maxLength={8000}
                  className="text-xs resize-none"
                />
                <Button
                  size="sm"
                  disabled={busy || !addReason.trim() || !addText.trim()}
                  className="w-full h-8 rounded-xl text-[11px] btn-primary-gradient"
                  onClick={async () => {
                    if (!selectedHospital?.id) return;
                    setBusy(true);
                    const { error } = await addAddendum({
                      note_id: note.id, hospital_id: selectedHospital.id,
                      reason: addReason.trim(), text: addText.trim(),
                    });
                    setBusy(false);
                    if (error) return toast.error(error);
                    setAddReason(''); setAddText('');
                    await refresh();
                    toast.success('Addendum recorded');
                  }}
                >
                  Add addendum
                </Button>
              </div>
            </div>
          )}

          {mode === 'sign' && !isSigned && (
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

          <div className="flex items-center justify-end">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                issHost
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                  : 'border-slate-200 bg-slate-100 text-slate-500',
              )}
            >
              {issHost ? <Plug className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
              {issHost ? `Connected · ${issHost}` : 'Local record'}
            </span>
          </div>

          {!isSigned && (
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
                    Sign &amp; Push to EMR
                  </>
                )}
              </Button>
            )}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
