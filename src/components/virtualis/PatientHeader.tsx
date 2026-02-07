import { Patient } from '@/types/clinical';
import { Clock, MapPin, Calendar, User } from 'lucide-react';

interface PatientHeaderProps {
  patient: Patient;
}

export function PatientHeader({ patient }: PatientHeaderProps) {
  return (
    <div className="card-apple p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center shadow-soft">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{patient.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground">
                {patient.age}yo {patient.sex === 'M' ? 'Male' : 'Female'}
              </span>
              <span className="text-muted-foreground/30">|</span>
              <span className="font-mono text-sm text-muted-foreground">
                MRN: {patient.mrn}
              </span>
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold">
          Active
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Location</div>
            <div className="text-sm font-medium text-foreground">{patient.location} • {patient.bed}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
          <div className="p-2 rounded-lg bg-info/10">
            <Calendar className="w-4 h-4 text-info" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Admission Day</div>
            <div className="text-sm font-medium text-foreground">Day {patient.admissionDay}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
          <div className="p-2 rounded-lg bg-warning/10">
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Expected LOS</div>
            <div className="text-sm font-medium text-foreground">{patient.expectedLOS} days</div>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 p-3 rounded-xl bg-secondary/50 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Admission Diagnosis</div>
          <div className="text-sm font-medium text-foreground">{patient.admissionDiagnosis}</div>
        </div>
      </div>
    </div>
  );
}
