import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { ClinicalNote } from '@/types/hospital';
import { ImagingStudy } from './ImagingPanel';
import { InsightCard } from './InsightCard';
import { ClinicalTrends } from './ClinicalTrends';
import { ClinicalNotesDisplay } from './ClinicalNotesDisplay';
import { ImagingPanel } from './ImagingPanel';
import { LabResultsPanel } from './LabResultsPanel';
import { VitalsPanel } from './VitalsPanel';
import { MedicationsPanel } from './MedicationsPanel';
import { AllergiesPanel } from './AllergiesPanel';
import { ProblemListPanel } from './ProblemListPanel';
import { StagedOrdersPanel } from './StagedOrdersPanel';
import { BillingPanel } from './BillingPanel';
import { PrescriptionsPanel } from './PrescriptionsPanel';
import { ImmunizationsPanel } from './ImmunizationsPanel';
import { Brain, TrendingUp, FileText, Scan, FlaskConical, HeartPulse, Pill, ShieldAlert, ClipboardList, PackageCheck, DollarSign, FileSignature, Syringe } from 'lucide-react';

interface PatientChartTabsProps {
  patientId: string;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  clinicalNotes: ClinicalNote[];
  imagingStudies: ImagingStudy[];
}

export function PatientChartTabs({ patientId, insights, trends, clinicalNotes, imagingStudies }: PatientChartTabsProps) {
  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="w-full flex-wrap h-auto gap-1 bg-secondary/50 p-1.5 rounded-xl border border-border/50">
        <TabsTrigger value="summary" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Brain className="w-3 h-3" /> Summary
        </TabsTrigger>
        <TabsTrigger value="labs" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <FlaskConical className="w-3 h-3" /> Labs
        </TabsTrigger>
        <TabsTrigger value="vitals" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <HeartPulse className="w-3 h-3" /> Vitals
        </TabsTrigger>
        <TabsTrigger value="meds" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Pill className="w-3 h-3" /> Meds
        </TabsTrigger>
        <TabsTrigger value="allergies" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <ShieldAlert className="w-3 h-3" /> Allergies
        </TabsTrigger>
        <TabsTrigger value="problems" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <ClipboardList className="w-3 h-3" /> Problems
        </TabsTrigger>
        <TabsTrigger value="notes" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <FileText className="w-3 h-3" /> Notes
          <span className="text-[9px] px-1 rounded-full bg-muted text-muted-foreground">{clinicalNotes.length}</span>
        </TabsTrigger>
        <TabsTrigger value="imaging" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Scan className="w-3 h-3" /> Imaging
          {imagingStudies.length > 0 && <span className="text-[9px] px-1 rounded-full bg-muted text-muted-foreground">{imagingStudies.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="rx" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <FileSignature className="w-3 h-3" /> eRx
        </TabsTrigger>
        <TabsTrigger value="immunizations" className="text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Syringe className="w-3 h-3" /> Vaccines
        </TabsTrigger>
      </TabsList>

      {/* Summary Tab */}
      <TabsContent value="summary" className="space-y-6 mt-4">
        {insights.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-soft">
                <Brain className="w-3.5 h-3.5 text-primary" />
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What Matters Now</h2>
            </div>
            <div className="space-y-3">
              {insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
            </div>
          </section>
        )}
        {trends.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-info/10 border border-info/20 shadow-soft">
                <TrendingUp className="w-3.5 h-3.5 text-info" />
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical Trends</h2>
            </div>
            <ClinicalTrends trends={trends} />
          </section>
        )}
      </TabsContent>

      {/* Labs */}
      <TabsContent value="labs" className="mt-4">
        <LabResultsPanel patientId={patientId} />
      </TabsContent>

      {/* Vitals */}
      <TabsContent value="vitals" className="mt-4">
        <VitalsPanel trends={trends} />
      </TabsContent>

      {/* Meds */}
      <TabsContent value="meds" className="mt-4">
        <MedicationsPanel patientId={patientId} />
      </TabsContent>

      {/* Allergies */}
      <TabsContent value="allergies" className="mt-4">
        <AllergiesPanel patientId={patientId} />
      </TabsContent>

      {/* Problems */}
      <TabsContent value="problems" className="mt-4">
        <ProblemListPanel patientId={patientId} />
      </TabsContent>

      {/* Notes */}
      <TabsContent value="notes" className="mt-4">
        <ClinicalNotesDisplay notes={clinicalNotes} patientId={patientId} />
      </TabsContent>

      {/* Imaging */}
      <TabsContent value="imaging" className="mt-4">
        <ImagingPanel studies={imagingStudies} />
      </TabsContent>

      {/* Prescriptions (eRx) */}
      <TabsContent value="rx" className="mt-4">
        <PrescriptionsPanel patientId={patientId} />
      </TabsContent>

      {/* Immunizations */}
      <TabsContent value="immunizations" className="mt-4">
        <ImmunizationsPanel patientId={patientId} />
      </TabsContent>
    </Tabs>
  );
}
