import { useEffect } from 'react';
import { Patient, ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { PatientHeader } from './PatientHeader';
import { InsightCard } from './InsightCard';
import { ClinicalTrends } from './ClinicalTrends';
import { Brain, TrendingUp } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';

interface PatientDashboardProps {
  patient: Patient;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
}

export function PatientDashboard({ patient, insights, trends }: PatientDashboardProps) {
  const { logView } = useAuditLog();

  // Log patient view for HIPAA audit trail
  useEffect(() => {
    if (patient?.id) {
      logView('patient', patient.id, patient.id, {
        view_type: 'dashboard',
        patient_name: patient.name,
        mrn: patient.mrn,
      });
    }
  }, [patient?.id, logView]);

  return (
    <div className="bg-background p-4 sm:p-6 lg:p-8 overflow-y-auto relative pb-24 lg:pb-8">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />
      
      <div className="relative max-w-4xl mx-auto lg:mx-0">
        <PatientHeader patient={patient} />

        {/* What Matters Now */}
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

        {/* Clinical Trends */}
        <section>
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
      </div>
    </div>
  );
}
