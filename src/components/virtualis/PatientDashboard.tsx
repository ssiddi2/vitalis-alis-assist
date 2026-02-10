import { useEffect } from 'react';
import { ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { ClinicalNote } from '@/types/hospital';
import { DBPatient } from '@/hooks/usePatients';
import { PatientHeader } from './PatientHeader';
import { InsightCard } from './InsightCard';
import { ClinicalTrends } from './ClinicalTrends';
import { ClinicalNotesDisplay } from './ClinicalNotesDisplay';
import { Brain, TrendingUp, FileText, Stethoscope } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';

interface PatientDashboardProps {
  patient: DBPatient;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  clinicalNotes: ClinicalNote[];
}

export function PatientDashboard({ patient, insights, trends, clinicalNotes }: PatientDashboardProps) {
  const { logView } = useAuditLog();

  useEffect(() => {
    if (patient?.id) {
      logView('patient', patient.id, patient.id, {
        view_type: 'dashboard',
        patient_name: patient.name,
        mrn: patient.mrn,
      });
    }
  }, [patient?.id, logView]);

  // Convert DBPatient to PatientHeader-compatible format
  const headerPatient = {
    id: patient.id,
    name: patient.name,
    mrn: patient.mrn,
    age: patient.age,
    sex: patient.sex as 'M' | 'F',
    location: patient.location,
    bed: patient.bed,
    admissionDay: patient.admission_day,
    expectedLOS: patient.expected_los,
    admissionDiagnosis: patient.admission_diagnosis || '',
  };

  return (
    <div className="bg-background p-4 sm:p-6 lg:p-8 overflow-y-auto relative pb-24 lg:pb-8 h-full">
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />
      
      <div className="relative max-w-4xl mx-auto lg:mx-0">
        <PatientHeader patient={headerPatient} />

        {/* Attending & Care Team */}
        {(patient.attending_physician || patient.unit) && (
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            {patient.attending_physician && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border">
                <Stethoscope className="w-3 h-3 text-primary" />
                <span className="text-xs text-foreground">
                  <span className="text-muted-foreground">Attending:</span> {patient.attending_physician}
                </span>
              </div>
            )}
            {patient.unit && (
              <div className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-border">
                <span className="text-xs text-foreground">
                  <span className="text-muted-foreground">Unit:</span> {patient.unit}
                </span>
              </div>
            )}
          </div>
        )}

        {/* What Matters Now */}
        {insights.length > 0 && (
          <section className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-soft">
                <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              </div>
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                What Matters Now
              </h2>
            </div>
            <div className="space-y-3">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Clinical Trends */}
        {trends.length > 0 && (
          <section className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="p-2 sm:p-2.5 rounded-xl bg-info/10 border border-info/20 shadow-soft">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-info" />
              </div>
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Clinical Trends
              </h2>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <ClinicalTrends trends={trends} />
            </div>
          </section>
        )}

        {/* Clinical Notes */}
        <section>
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-warning/10 border border-warning/20 shadow-soft">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />
            </div>
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Clinical Notes
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {clinicalNotes.length}
            </span>
          </div>
          <ClinicalNotesDisplay notes={clinicalNotes} />
        </section>
      </div>
    </div>
  );
}
