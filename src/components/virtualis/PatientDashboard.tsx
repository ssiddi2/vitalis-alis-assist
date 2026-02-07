import { Patient, ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { PatientHeader } from './PatientHeader';
import { InsightCard } from './InsightCard';
import { ClinicalTrends } from './ClinicalTrends';
import { Brain, TrendingUp } from 'lucide-react';

interface PatientDashboardProps {
  patient: Patient;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
}

export function PatientDashboard({ patient, insights, trends }: PatientDashboardProps) {
  return (
    <div className="bg-background p-8 overflow-y-auto relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />
      
      <div className="relative max-w-4xl">
        <PatientHeader patient={patient} />

        {/* What Matters Now */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-soft">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-info/10 border border-info/20 shadow-soft">
              <TrendingUp className="w-4 h-4 text-info" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Clinical Trends
            </h2>
          </div>
          <ClinicalTrends trends={trends} />
        </section>
      </div>
    </div>
  );
}
