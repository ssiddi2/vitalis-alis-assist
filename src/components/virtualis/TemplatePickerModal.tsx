import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNoteTemplates, NoteTemplate } from '@/hooks/useNoteTemplates';
import { FileText, Stethoscope } from 'lucide-react';

interface TemplatePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: NoteTemplate) => void;
}

const encounterTypeLabels: Record<string, string> = {
  office_visit: 'Office Visit',
  follow_up: 'Follow-Up',
  annual_physical: 'Annual Physical',
  telehealth: 'Telehealth',
  procedure: 'Procedure',
  urgent: 'Urgent',
};

export function TemplatePickerModal({ open, onOpenChange, onSelect }: TemplatePickerModalProps) {
  const { templates, loading } = useNoteTemplates();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-primary" /> Choose Note Template
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No templates available</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => { onSelect(t); onOpenChange(false); }}
                className="w-full text-left p-3 rounded-xl border border-border/50 hover:bg-secondary/50 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-foreground">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {t.encounter_type && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                      {encounterTypeLabels[t.encounter_type] || t.encounter_type}
                    </span>
                  )}
                  {t.specialty && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {t.specialty}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
