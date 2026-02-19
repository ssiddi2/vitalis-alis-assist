import { Patient } from '@/types/clinical';
import { Clock, MapPin, Calendar, User, Timer, DoorOpen, Stethoscope, Video, RefreshCw, UserCheck, AlertTriangle, FileText } from 'lucide-react';
import { ActiveEncounter } from '@/hooks/useActiveEncounter';

const ENCOUNTER_TYPE_LABELS: Record<string, { label: string; icon: typeof Stethoscope }> = {
  office_visit: { label: 'Office Visit', icon: Stethoscope },
  telehealth: { label: 'Telehealth', icon: Video },
  follow_up: { label: 'Follow-Up', icon: RefreshCw },
  annual_physical: { label: 'Annual Physical', icon: UserCheck },
  urgent: { label: 'Urgent', icon: AlertTriangle },
  procedure: { label: 'Procedure', icon: FileText },
};

interface PatientHeaderProps {
  patient: Patient;
  encounter?: ActiveEncounter | null;
  encounterDuration?: string;
}

export function PatientHeader({ patient, encounter, encounterDuration }: PatientHeaderProps) {
  const encounterMeta = encounter ? ENCOUNTER_TYPE_LABELS[encounter.encounter_type] || ENCOUNTER_TYPE_LABELS.office_visit : null;
  const EncounterIcon = encounterMeta?.icon || Stethoscope;

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
        {encounter ? (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-info/10 border border-info/30 text-info text-xs font-semibold flex items-center gap-1.5">
              <EncounterIcon className="w-3 h-3" />
              {encounterMeta?.label}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold">
              In Progress
            </div>
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold">
            Active
          </div>
        )}
      </div>

      {encounter ? (
        /* ── Encounter Mode ── */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
            <div className="p-2 rounded-lg bg-info/10">
              <FileText className="w-4 h-4 text-info" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Visit Reason</div>
              <div className="text-sm font-medium text-foreground">{encounter.visit_reason || encounter.chief_complaint || 'Not specified'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
            <div className="p-2 rounded-lg bg-primary/10">
              <DoorOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Room</div>
              <div className="text-sm font-medium text-foreground">{encounter.room_number || '—'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
            <div className="p-2 rounded-lg bg-warning/10">
              <Timer className="w-4 h-4 text-warning" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-sm font-medium text-foreground">{encounterDuration || '0m'}</div>
            </div>
          </div>

          {encounter.chief_complaint && encounter.visit_reason && (
            <div className="col-span-2 lg:col-span-1 p-3 rounded-xl bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Chief Complaint</div>
              <div className="text-sm font-medium text-foreground">{encounter.chief_complaint}</div>
            </div>
          )}
          {!(encounter.chief_complaint && encounter.visit_reason) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Location</div>
                <div className="text-sm font-medium text-foreground">{patient.location}{patient.bed ? ` • ${patient.bed}` : ''}</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Inpatient Mode ── */
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
      )}
    </div>
  );
}
