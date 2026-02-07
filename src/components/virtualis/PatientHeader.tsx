import { Patient } from '@/types/clinical';
import { User, Hash, Calendar, MapPin, Clock } from 'lucide-react';

interface PatientHeaderProps {
  patient: Patient;
}

export function PatientHeader({ patient }: PatientHeaderProps) {
  return (
    <div className="mb-8 pb-6 border-b border-border/30">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 border border-primary/30 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{patient.admissionDiagnosis}</p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold">
          Active
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetaItem icon={Hash} label="MRN" value={patient.mrn} />
        <MetaItem icon={Calendar} label="Age" value={`${patient.age}${patient.sex}`} />
        <MetaItem icon={MapPin} label="Location" value={`${patient.location}, ${patient.bed}`} />
        <MetaItem icon={Clock} label="LOS" value={`Day ${patient.admissionDay} of ${patient.expectedLOS}`} />
      </div>
    </div>
  );
}

function MetaItem({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
