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
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ALIS-Assisted Progress Note</DialogTitle>
          <DialogDescription>
            Review and sign the generated clinical documentation
          </DialogDescription>
        </DialogHeader>

        <div className="bg-secondary border border-border rounded-xl p-6 font-mono text-xs leading-relaxed space-y-4">
          <div className="font-semibold text-foreground text-sm pb-2 border-b border-border">
            HOSPITAL DAY 2 - PROGRESS NOTE
          </div>

          <div>
            <strong className="text-foreground">SUBJECTIVE:</strong>
            <p className="text-muted-foreground mt-1">{note.subjective}</p>
          </div>

          <div>
            <strong className="text-foreground">OBJECTIVE:</strong>
            <pre className="text-muted-foreground mt-1 whitespace-pre-wrap">{note.objective}</pre>
          </div>

          <div>
            <strong className="text-foreground">ASSESSMENT:</strong>
            <pre className="text-muted-foreground mt-1 whitespace-pre-wrap">{note.assessment}</pre>
          </div>

          <div>
            <strong className="text-foreground">PLAN:</strong>
            <pre className="text-muted-foreground mt-1 whitespace-pre-wrap">{note.plan}</pre>
          </div>

          <div className="pt-4 border-t border-border text-[10px] text-muted-foreground">
            Note assisted by ALIS | Reviewed and approved by attending physician
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Edit Note
          </Button>
          <Button onClick={onSign} className="bg-success hover:bg-success/90">
            Sign & Commit to EMR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
