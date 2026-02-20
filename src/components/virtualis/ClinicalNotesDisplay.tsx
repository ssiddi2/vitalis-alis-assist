import { ClinicalNote } from '@/types/hospital';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, FileText, CheckCircle2, PenLine, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { TemplatePickerModal } from './TemplatePickerModal';
import { NoteEditorModal } from './NoteEditorModal';
import { NoteTemplate } from '@/hooks/useNoteTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClinicalNotesDisplayProps {
  notes: ClinicalNote[];
  patientId?: string;
  onNoteCreated?: () => void;
}

const noteTypeLabels: Record<string, string> = {
  progress: 'Progress Note',
  consult: 'Consult Note',
  discharge: 'Discharge Summary',
  procedure: 'Procedure Note',
};

const noteTypeBadgeColors: Record<string, string> = {
  progress: 'bg-primary/10 text-primary border-primary/20',
  consult: 'bg-info/10 text-info border-info/20',
  discharge: 'bg-warning/10 text-warning border-warning/20',
  procedure: 'bg-secondary text-foreground border-border',
};

const encounterToNoteType: Record<string, string> = {
  office_visit: 'progress',
  follow_up: 'progress',
  annual_physical: 'progress',
  telehealth: 'progress',
  procedure: 'procedure',
  urgent: 'progress',
};

export function ClinicalNotesDisplay({ notes, patientId, onNoteCreated }: ClinicalNotesDisplayProps) {
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);

  const toggleNote = (noteId: string) => {
    setExpandedNotes(prev => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  const handleTemplateSelect = async (template: NoteTemplate) => {
    if (!patientId) { toast.error('No patient selected'); return; }

    const noteType = template.encounter_type
      ? (encounterToNoteType[template.encounter_type] || 'progress')
      : 'progress';

    const { data, error } = await supabase
      .from('clinical_notes')
      .insert({
        patient_id: patientId,
        note_type: noteType as 'progress' | 'consult' | 'discharge' | 'procedure',
        content: template.template_content,
        status: 'draft',
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('Failed to create note from template');
      return;
    }

    toast.success(`Note created from "${template.name}"`);
    const createdNote: ClinicalNote = {
      id: data.id,
      patient_id: data.patient_id,
      note_type: data.note_type,
      status: data.status,
      content: data.content as ClinicalNote['content'],
      created_at: data.created_at,
      updated_at: data.updated_at,
      signed_at: data.signed_at,
      author_id: data.author_id,
      conversation_id: data.conversation_id,
    };
    setEditingNote(createdNote);
    onNoteCreated?.();
  };

  return (
    <div>
      {patientId && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Clinical Notes</h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] gap-1"
            onClick={() => setShowTemplatePicker(true)}
          >
            <Plus className="w-3 h-3" /> New from Template
          </Button>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          No clinical notes available
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isOpen = expandedNotes[note.id] || false;
            const content = note.content || {};

            return (
              <Collapsible key={note.id} open={isOpen} onOpenChange={() => toggleNote(note.id)}>
                <div className="card-apple overflow-hidden">
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", noteTypeBadgeColors[note.note_type] || noteTypeBadgeColors.procedure)}>
                            {noteTypeLabels[note.note_type] || note.note_type}
                          </span>
                          {note.status === 'signed' ? (
                            <span className="flex items-center gap-1 text-[10px] text-success">
                              <CheckCircle2 className="h-3 w-3" /> Signed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-warning">
                              <PenLine className="h-3 w-3" /> {note.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                      {content.subjective && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Subjective</h4>
                          <p className="text-xs text-foreground leading-relaxed">{content.subjective}</p>
                        </div>
                      )}
                      {content.objective && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Objective</h4>
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{content.objective}</p>
                        </div>
                      )}
                      {content.assessment && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Assessment</h4>
                          <p className="text-xs text-foreground leading-relaxed">{content.assessment}</p>
                        </div>
                      )}
                      {content.plan && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Plan</h4>
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{content.plan}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      <TemplatePickerModal
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        onSelect={handleTemplateSelect}
      />

      <NoteEditorModal
        note={editingNote}
        open={!!editingNote}
        onOpenChange={(open) => { if (!open) setEditingNote(null); }}
        clinicianName=""
        patientId={patientId}
        mode="edit"
      />
    </div>
  );
}
