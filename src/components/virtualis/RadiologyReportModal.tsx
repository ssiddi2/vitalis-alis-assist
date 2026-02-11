import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Scan, ExternalLink, User, Calendar } from 'lucide-react';
import type { ImagingStudy } from './ImagingPanel';

interface RadiologyReportModalProps {
  study: ImagingStudy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RadiologyReportModal({ study, open, onOpenChange }: RadiologyReportModalProps) {
  if (!study) return null;

  const studyDate = new Date(study.study_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Scan className="h-5 w-5 text-info" />
            {study.study_type}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-3 flex-wrap text-[10px]">
              {study.modality && (
                <span className="px-1.5 py-0.5 bg-secondary rounded font-mono">{study.modality}</span>
              )}
              {study.body_part && (
                <span className="text-muted-foreground">{study.body_part}</span>
              )}
              {study.accession_number && (
                <span className="text-muted-foreground font-mono">#{study.accession_number}</span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {studyDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {study.reading_radiologist && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {study.reading_radiologist}
              </div>
            )}
          </div>

          {/* Impression */}
          {study.impression && (
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Impression
              </label>
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                <p className="text-xs text-foreground leading-relaxed">{study.impression}</p>
              </div>
            </div>
          )}

          {/* Full Report */}
          {study.report_text && (
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Full Report
              </label>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3 max-h-[300px] overflow-y-auto">
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{study.report_text}</p>
              </div>
            </div>
          )}

          {/* No report yet */}
          {!study.report_text && !study.impression && (
            <div className="text-center py-6">
              <Scan className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Report not yet available</p>
            </div>
          )}

          {/* PACS Viewer Link */}
          {study.viewer_url && (
            <Button
              variant="outline"
              className="w-full h-10 text-xs rounded-lg"
              onClick={() => window.open(study.viewer_url!, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in PACS Viewer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
