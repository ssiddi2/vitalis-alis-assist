import { useEffect } from 'react';
import { ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { ClinicalNote } from '@/types/hospital';
import { DBPatient } from '@/hooks/usePatients';
import { PatientHeader } from './PatientHeader';
import { PatientChartTabs } from './PatientChartTabs';
import { ImagingStudy } from './ImagingPanel';
import { Stethoscope } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { ActiveEncounter } from '@/hooks/useActiveEncounter';

interface PatientDashboardProps {
  patient: DBPatient;
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  clinicalNotes: ClinicalNote[];
  imagingStudies?: ImagingStudy[];
  encounter?: ActiveEncounter | null;
  encounterDuration?: string;
}

export function PatientDashboard({ patient, insights, trends, clinicalNotes, imagingStudies = [], encounter, encounterDuration }: PatientDashboardProps) {
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
        <PatientHeader patient={headerPatient} encounter={encounter} encounterDuration={encounterDuration} />

        {!encounter && (patient.attending_physician || patient.unit) && (
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

        <PatientChartTabs
          patientId={patient.id}
          insights={insights}
          trends={trends}
          clinicalNotes={clinicalNotes}
          imagingStudies={imagingStudies as ImagingStudy[]}
        />
      </div>
    </div>
  );
}
