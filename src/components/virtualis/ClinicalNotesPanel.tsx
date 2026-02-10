import { useEffect, useState } from 'react';
import { FileText, Check, Clock, Edit3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClinicalNote, NoteStatus, NoteType } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';
import { NoteEditorModal } from './NoteEditorModal';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<NoteStatus, { label: string; color: string; icon: typeof Check }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground bg-muted', icon: Edit3 },
  pending_signature: { label: 'Pending', color: 'text-warning bg-warning/10', icon: Clock },
  signed: { label: 'Signed', color: 'text-success bg-success/10', icon: Check },
  amended: { label: 'Amended', color: 'text-info bg-info/10', icon: Edit3 },
};

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  progress: 'Progress Note',
  consult: 'Consult Note',
  discharge: 'Discharge Summary',
  procedure: 'Procedure Note',
};

interface ClinicalNotesPanelProps {
  notes: ClinicalNote[];
  patientId?: string;
  clinicianName?: string;
}

export function ClinicalNotesPanel({ notes, patientId, clinicianName = 'Clinician' }: ClinicalNotesPanelProps) {
  const { logView } = useAuditLog();
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'sign'>('edit');
  const [newNoteIds, setNewNoteIds] = useState<Set<string>>(new Set());

  const actionableNotes = notes.filter(n => n.status === 'draft' || n.status === 'pending_signature');

  // Track newly added notes for pulse animation
  useEffect(() => {
    const fresh = notes.filter(n => !newNoteIds.has(n.id) && n.status === 'draft');
    if (fresh.length > 0) {
      setNewNoteIds(prev => {
        const next = new Set(prev);
        fresh.forEach(n => next.add(n.id));
        return next;
      });
      setTimeout(() => {
        setNewNoteIds(prev => {
          const next = new Set(prev);
          fresh.forEach(n => next.delete(n.id));
          return next;
        });
      }, 3000);
    }
  }, [notes.length]);

  useEffect(() => {
    if (notes.length > 0 && patientId) {
      logView('clinical_note', notes[0].id, patientId, { note_count: notes.length });
    }
  }, [notes, patientId, logView]);

  if (notes.length === 0) {
    return (
      <div className="glass rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-info" />
          <h4 className="text-sm font-semibold text-foreground">Clinical Notes</h4>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">No notes generated yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-xl p-4 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-info" />
            <h4 className="text-sm font-semibold text-foreground">Clinical Notes</h4>
          </div>
          {actionableNotes.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 bg-warning/10 text-warning rounded-full font-medium">
              {actionableNotes.length} draft{actionableNotes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {notes.map((note) => {
            const statusConfig = STATUS_CONFIG[note.status];
            const StatusIcon = statusConfig.icon;
            const isNew = newNoteIds.has(note.id);
            const isAIGenerated = !note.author_id;
            const canEdit = note.status === 'draft' || note.status === 'pending_signature';

            return (
              <div
                key={note.id}
                className={cn(
                  'p-2.5 bg-secondary/50 rounded-lg border border-border/50 transition-all',
                  isNew && 'animate-pulse border-primary/40 bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
                      {NOTE_TYPE_LABELS[note.note_type]}
                    </span>
                    {isAIGenerated && (
                      <span className="flex items-center gap-0.5 text-[9px] text-primary/70 bg-primary/10 px-1 py-0.5 rounded">
                        <Sparkles className="h-2.5 w-2.5" />
                        ALIS
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusConfig.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  {note.content.subjective && (
                    <div>
                      <span className="font-semibold text-foreground">S: </span>
                      <span className="text-muted-foreground line-clamp-1">{note.content.subjective}</span>
                    </div>
                  )}
                  {note.content.assessment && (
                    <div>
                      <span className="font-semibold text-foreground">A: </span>
                      <span className="text-muted-foreground line-clamp-1">{note.content.assessment}</span>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] rounded-lg"
                      onClick={() => { setEditorMode('edit'); setEditingNote(note); }}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-[10px] rounded-lg btn-primary-gradient"
                      onClick={() => { setEditorMode('sign'); setEditingNote(note); }}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Sign
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <NoteEditorModal
        note={editingNote}
        open={!!editingNote}
        onOpenChange={(open) => { if (!open) setEditingNote(null); }}
        clinicianName={clinicianName}
        patientId={patientId}
        mode={editorMode}
      />
    </>
  );
}
