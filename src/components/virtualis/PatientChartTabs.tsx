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
import { PrescriptionsPanel } from './PrescriptionsPanel';
import { ImmunizationsPanel } from './ImmunizationsPanel';
import { ConsultationThreadView } from './ConsultationThreadView';
import { Brain, TrendingUp, FileText, Scan, FlaskConical, HeartPulse, Pill, ShieldAlert, ClipboardList, FileSignature, Syringe, Stethoscope } from 'lucide-react';

interface PatientChartTabsProps {
  patientId: string;
  hospitalId?: string;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  clinicalNotes: ClinicalNote[];
  imagingStudies: ImagingStudy[];
}

const TAB_CLS = "shrink-0 text-[11px] gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

export function PatientChartTabs({ patientId, hospitalId, insights, trends, clinicalNotes, imagingStudies }: PatientChartTabsProps) {
  return (
    <Tabs defaultValue="summary" className="w-full">
      {/* Sticky, horizontally scrollable tab bar */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-background/80 backdrop-blur-md">
        <div className="relative">
          <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
            <TabsList className="inline-flex w-max min-w-full gap-1 bg-secondary/50 p-1.5 rounded-xl border border-border/50">
              <TabsTrigger value="summary" className={TAB_CLS}><Brain className="w-3 h-3" /> Summary</TabsTrigger>
              <TabsTrigger value="labs" className={TAB_CLS}><FlaskConical className="w-3 h-3" /> Labs</TabsTrigger>
              <TabsTrigger value="vitals" className={TAB_CLS}><HeartPulse className="w-3 h-3" /> Vitals</TabsTrigger>
              <TabsTrigger value="meds" className={TAB_CLS}><Pill className="w-3 h-3" /> Meds</TabsTrigger>
              <TabsTrigger value="allergies" className={TAB_CLS}><ShieldAlert className="w-3 h-3" /> Allergies</TabsTrigger>
              <TabsTrigger value="problems" className={TAB_CLS}><ClipboardList className="w-3 h-3" /> Problems</TabsTrigger>
              <TabsTrigger value="notes" className={TAB_CLS}>
                <FileText className="w-3 h-3" /> Notes
                <span className="text-[9px] px-1 rounded-full bg-muted text-muted-foreground">{clinicalNotes.length}</span>
              </TabsTrigger>
              <TabsTrigger value="imaging" className={TAB_CLS}>
                <Scan className="w-3 h-3" /> Imaging
                {imagingStudies.length > 0 && <span className="text-[9px] px-1 rounded-full bg-muted text-muted-foreground">{imagingStudies.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="rx" className={TAB_CLS}><FileSignature className="w-3 h-3" /> eRx</TabsTrigger>
              <TabsTrigger value="immunizations" className={TAB_CLS}><Syringe className="w-3 h-3" /> Vaccines</TabsTrigger>
              <TabsTrigger value="consults" className={TAB_CLS}><Stethoscope className="w-3 h-3" /> Consults</TabsTrigger>
            </TabsList>
          </div>
          {/* Edge fade hints */}
          <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>

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

      <TabsContent value="labs" className="mt-4"><LabResultsPanel patientId={patientId} /></TabsContent>
      <TabsContent value="vitals" className="mt-4"><VitalsPanel trends={trends} /></TabsContent>
      <TabsContent value="meds" className="mt-4"><MedicationsPanel patientId={patientId} /></TabsContent>
      <TabsContent value="allergies" className="mt-4"><AllergiesPanel patientId={patientId} /></TabsContent>
      <TabsContent value="problems" className="mt-4"><ProblemListPanel patientId={patientId} /></TabsContent>
      <TabsContent value="notes" className="mt-4"><ClinicalNotesDisplay notes={clinicalNotes} patientId={patientId} /></TabsContent>
      <TabsContent value="imaging" className="mt-4"><ImagingPanel studies={imagingStudies} /></TabsContent>
      <TabsContent value="rx" className="mt-4"><PrescriptionsPanel patientId={patientId} /></TabsContent>
      <TabsContent value="immunizations" className="mt-4"><ImmunizationsPanel patientId={patientId} /></TabsContent>
      <TabsContent value="consults" className="mt-4"><ConsultationThreadView patientId={patientId} hospitalId={hospitalId} /></TabsContent>
    </Tabs>
  );
}
