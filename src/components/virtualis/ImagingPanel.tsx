import { useState } from 'react';
import { Scan, Eye, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadiologyReportModal } from './RadiologyReportModal';

export interface ImagingStudy {
  id: string;
  patient_id: string;
  study_type: string;
  study_date: string;
  accession_number: string | null;
  status: string;
  modality: string | null;
  body_part: string | null;
  reading_radiologist: string | null;
  impression: string | null;
  report_text: string | null;
  viewer_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ImagingPanelProps {
  studies: ImagingStudy[];
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-warning', label: 'Pending' },
  in_progress: { icon: AlertCircle, color: 'text-info', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-success', label: 'Completed' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: 'Cancelled' },
};

export function ImagingPanel({ studies }: ImagingPanelProps) {
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);

  if (studies.length === 0) return null;

  return (
    <>
      <section className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
          <div className="p-2 sm:p-2.5 rounded-xl bg-info/10 border border-info/20 shadow-soft">
            <Scan className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-info" />
          </div>
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Radiology / Imaging
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {studies.length}
          </span>
        </div>

        <div className="space-y-2">
          {studies.map((study) => {
            const statusCfg = STATUS_CONFIG[study.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const studyDate = new Date(study.study_date);

            return (
              <button
                key={study.id}
                onClick={() => setSelectedStudy(study)}
                className="w-full text-left p-3 rounded-xl bg-card/80 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {study.study_type}
                      </span>
                      {study.modality && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono">
                          {study.modality}
                        </span>
                      )}
                    </div>
                    {study.body_part && (
                      <p className="text-[10px] text-muted-foreground mb-1">{study.body_part}</p>
                    )}
                    {study.impression && (
                      <p className="text-[10px] text-foreground/80 line-clamp-2 mt-1">
                        {study.impression}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className={cn('flex items-center gap-1', statusCfg.color)}>
                      <StatusIcon className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{statusCfg.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {studyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <RadiologyReportModal
        study={selectedStudy}
        open={!!selectedStudy}
        onOpenChange={(open) => { if (!open) setSelectedStudy(null); }}
      />
    </>
  );
}
