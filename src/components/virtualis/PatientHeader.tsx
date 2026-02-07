import { Patient } from '@/types/clinical';

interface PatientHeaderProps {
  patient: Patient;
}

export function PatientHeader({ patient }: PatientHeaderProps) {
  return (
    <div className="mb-8 pb-6 border-b border-border">
      <h1 className="text-2xl font-semibold mb-2 tracking-tight">{patient.name}</h1>
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>📋</span>
          <span>MRN: {patient.mrn}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span>🎂</span>
          <span>{patient.age}{patient.sex}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span>📍</span>
          <span>{patient.location}, {patient.bed}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span>🏥</span>
          <span>Day {patient.admissionDay} of {patient.expectedLOS}</span>
        </span>
      </div>
    </div>
  );
}
