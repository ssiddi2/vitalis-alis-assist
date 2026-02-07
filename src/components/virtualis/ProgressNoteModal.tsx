import { ProgressNote } from '@/types/clinical';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileEdit, Sparkles } from 'lucide-react';

interface ProgressNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: ProgressNote;
  onSign: () => void;
}

export function ProgressNoteModal({
  isOpen,
  onClose,
  note,
  onSign,
}: ProgressNoteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col glass-strong border-border/50">
        <DialogHeader className="pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-info/20 border border-primary/30">
              <FileEdit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg flex items-center gap-2">
                ALIS-Assisted Progress Note
                <Sparkles className="w-4 h-4 text-primary" />
              </DialogTitle>
              <DialogDescription className="text-sm">
                Review and sign the generated clinical documentation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="bg-secondary/30 border border-border/30 rounded-xl p-6 font-mono text-xs leading-relaxed space-y-5">
            <div className="font-semibold text-foreground text-sm pb-3 border-b border-border/30 flex items-center justify-between">
              <span>HOSPITAL DAY 2 - PROGRESS NOTE</span>
              <span className="text-[10px] text-muted-foreground font-normal">{note.timestamp}</span>
            </div>

            <NoteSection title="SUBJECTIVE" content={note.subjective} />
            <NoteSection title="OBJECTIVE" content={note.objective} />
            <NoteSection title="ASSESSMENT" content={note.assessment} />
            <NoteSection title="PLAN" content={note.plan} />

            <div className="pt-4 border-t border-border/30 text-[10px] text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" />
              Note assisted by ALIS | Reviewed and approved by attending physician
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose} className="border-border/50">
            Edit Note
          </Button>
          <Button 
            onClick={onSign} 
            className="bg-gradient-to-r from-success to-success/80 hover:opacity-90"
          >
            Sign & Commit to EMR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <strong className="text-primary text-[11px] uppercase tracking-wider">{title}:</strong>
      <pre className="text-muted-foreground mt-2 whitespace-pre-wrap font-mono">{content}</pre>
    </div>
  );
}
