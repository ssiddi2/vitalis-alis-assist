import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { ClinicalNote } from '@/types/hospital';
import { ImagingStudy } from './ImagingPanel';
import { ChartOverview } from './ChartOverview';
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
import { LayoutGrid, FileText, Scan, FlaskConical, HeartPulse, Pill, ShieldAlert, ClipboardList, FileSignature, Syringe, Stethoscope } from 'lucide-react';

interface PatientChartTabsProps {
  patientId: string;
  hospitalId?: string;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  clinicalNotes: ClinicalNote[];
  imagingStudies: ImagingStudy[];
  value?: string;
  onValueChange?: (v: string) => void;
}

const TAB_CLS =
  "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium gap-1.5 text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-soft";

const COUNT_CLS = "text-[10px] px-1.5 rounded-full bg-foreground/10";

export function PatientChartTabs({ patientId, hospitalId, insights, trends, clinicalNotes, imagingStudies, value, onValueChange }: PatientChartTabsProps) {
  const [internalTab, setInternalTab] = useState('overview');
  const active = value ?? internalTab;
  const setActive = onValueChange ?? setInternalTab;

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      {/* Sticky, horizontally scrollable tab bar */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/85 backdrop-blur-md">
        <div className="relative min-w-0">
          <div className="overflow-x-auto scrollbar-none -mx-1 px-1">

            <TabsList className="inline-flex h-auto w-max min-w-full gap-1 bg-card/60 backdrop-blur-sm p-1.5 rounded-2xl border border-border/60 shadow-soft">
              <TabsTrigger value="overview" className={TAB_CLS}><LayoutGrid className="w-3.5 h-3.5" /> Overview</TabsTrigger>
              <TabsTrigger value="labs" className={TAB_CLS}><FlaskConical className="w-3.5 h-3.5" /> Labs</TabsTrigger>
              <TabsTrigger value="vitals" className={TAB_CLS}><HeartPulse className="w-3.5 h-3.5" /> Vitals</TabsTrigger>
              <TabsTrigger value="meds" className={TAB_CLS}><Pill className="w-3.5 h-3.5" /> Meds</TabsTrigger>
              <TabsTrigger value="allergies" className={TAB_CLS}><ShieldAlert className="w-3.5 h-3.5" /> Allergies</TabsTrigger>
              <TabsTrigger value="problems" className={TAB_CLS}><ClipboardList className="w-3.5 h-3.5" /> Problems</TabsTrigger>
              <TabsTrigger value="notes" className={TAB_CLS}>
                <FileText className="w-3.5 h-3.5" /> Notes
                <span className={COUNT_CLS}>{clinicalNotes.length}</span>
              </TabsTrigger>
              <TabsTrigger value="imaging" className={TAB_CLS}>
                <Scan className="w-3.5 h-3.5" /> Imaging
                {imagingStudies.length > 0 && <span className={COUNT_CLS}>{imagingStudies.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="rx" className={TAB_CLS}><FileSignature className="w-3.5 h-3.5" /> eRx</TabsTrigger>
              <TabsTrigger value="immunizations" className={TAB_CLS}><Syringe className="w-3.5 h-3.5" /> Vaccines</TabsTrigger>
              <TabsTrigger value="consults" className={TAB_CLS}><Stethoscope className="w-3.5 h-3.5" /> Consults</TabsTrigger>
            </TabsList>
          </div>
          {/* Edge fade hints */}
          <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-6 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />

        </div>
      </div>

      <TabsContent value="overview" className="mt-4">
        <ChartOverview patientId={patientId} insights={insights} trends={trends} onNavigate={setActive} />
      </TabsContent>

      <TabsContent value="labs" className="mt-4"><LabResultsPanel patientId={patientId} /></TabsContent>
      <TabsContent value="vitals" className="mt-4"><VitalsPanel patientId={patientId} trends={trends} /></TabsContent>
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
