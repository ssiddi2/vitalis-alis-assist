import { useEffect } from 'react';
import { FileText, Check, Clock, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClinicalNote, NoteStatus } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';

interface ClinicalNotesPanelProps {
  notes: ClinicalNote[];
  patientId?: string;
  onEdit?: (noteId: string) => void;
  onSign?: (noteId: string) => void;
}

const STATUS_CONFIG: Record<NoteStatus, { label: string; color: string; icon: typeof Check }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground bg-muted', icon: Edit3 },
  pending_signature: { label: 'Pending', color: 'text-warning bg-warning/10', icon: Clock },
  signed: { label: 'Signed', color: 'text-success bg-success/10', icon: Check },
  amended: { label: 'Amended', color: 'text-info bg-info/10', icon: Edit3 },
};

export function ClinicalNotesPanel({ notes, patientId, onEdit, onSign }: ClinicalNotesPanelProps) {
  const { logView, logSign } = useAuditLog();

  // Log view of clinical notes for HIPAA audit
  useEffect(() => {
    if (notes.length > 0 && patientId) {
      logView('clinical_note', notes[0].id, patientId, {
        note_count: notes.length,
        note_status: notes[0].status,
      });
    }
  }, [notes, patientId, logView]);

  const handleSign = (noteId: string) => {
    if (patientId) {
      logSign('clinical_note', noteId, patientId, {
        note_type: notes.find(n => n.id === noteId)?.note_type,
        signature_method: 'electronic',
      });
    }
    onSign?.(noteId);
  };

  if (notes.length === 0) {
    return (
      <div className="glass rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-info" />
          <h4 className="text-sm font-semibold text-foreground">Progress Note</h4>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          No notes generated yet
        </p>
      </div>
    );
  }

  const latestNote = notes[0];
  const statusConfig = STATUS_CONFIG[latestNote.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="glass rounded-xl p-4 border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-info" />
          <h4 className="text-sm font-semibold text-foreground">Progress Note</h4>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusConfig.color}`}>
          <StatusIcon className="h-3 w-3" />
          {statusConfig.label}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {latestNote.content.subjective && (
          <div>
            <span className="font-semibold text-foreground">S: </span>
            <span className="text-muted-foreground line-clamp-2">{latestNote.content.subjective}</span>
          </div>
        )}
        {latestNote.content.objective && (
          <div>
            <span className="font-semibold text-foreground">O: </span>
            <span className="text-muted-foreground line-clamp-2">{latestNote.content.objective}</span>
          </div>
        )}
        {latestNote.content.assessment && (
          <div>
            <span className="font-semibold text-foreground">A: </span>
            <span className="text-muted-foreground line-clamp-2">{latestNote.content.assessment}</span>
          </div>
        )}
        {latestNote.content.plan && (
          <div>
            <span className="font-semibold text-foreground">P: </span>
            <span className="text-muted-foreground line-clamp-2">{latestNote.content.plan}</span>
          </div>
        )}
      </div>

      {(latestNote.status === 'draft' || latestNote.status === 'pending_signature') && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs rounded-lg"
            onClick={() => onEdit?.(latestNote.id)}
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs rounded-lg btn-primary-gradient"
            onClick={() => handleSign(latestNote.id)}
          >
            <Check className="h-3 w-3 mr-1" />
            Sign
          </Button>
        </div>
      )}
    </div>
  );
}
