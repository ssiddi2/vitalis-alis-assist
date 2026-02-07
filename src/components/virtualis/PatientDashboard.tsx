import { Patient, ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { PatientHeader } from './PatientHeader';
import { InsightCard } from './InsightCard';
import { ClinicalTrends } from './ClinicalTrends';

interface PatientDashboardProps {
  patient: Patient;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
}

export function PatientDashboard({ patient, insights, trends }: PatientDashboardProps) {
  return (
    <div className="bg-card p-8 border-r border-border overflow-y-auto">
      <PatientHeader patient={patient} />

      {/* What Matters Now */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          What Matters Now
        </h2>
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </section>

      {/* Clinical Trends */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Clinical Trends
        </h2>
        <ClinicalTrends trends={trends} />
      </section>
    </div>
  );
}
