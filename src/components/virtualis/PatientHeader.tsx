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

interface StatTileProps {
  icon: typeof Stethoscope;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  className?: string;
}

function StatTile({ icon: Icon, iconBg, iconColor, label, value, className = '' }: StatTileProps) {
  return (
    <div className={`flex items-center gap-2.5 p-3 rounded-xl bg-secondary/50 border border-border min-w-0 ${className}`}>
      <div className={`p-2 rounded-lg ${iconBg} flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground truncate">{label}</div>
        <div className="text-sm font-medium text-foreground truncate" title={value}>{value}</div>
      </div>
    </div>
  );
}


export function PatientHeader({ patient, encounter, encounterDuration }: PatientHeaderProps) {
  const encounterMeta = encounter ? ENCOUNTER_TYPE_LABELS[encounter.encounter_type] || ENCOUNTER_TYPE_LABELS.office_visit : null;
  const EncounterIcon = encounterMeta?.icon || Stethoscope;

  return (
    <div className="card-apple p-4 @2xl:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center shadow-soft flex-shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg @2xl:text-xl font-semibold text-foreground truncate" title={patient.name}>{patient.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {patient.age}yo {patient.sex === 'M' ? 'Male' : 'Female'}
              </span>
              <span className="text-muted-foreground/30">|</span>
              <span className="font-mono text-xs text-muted-foreground truncate">
                MRN: {patient.mrn}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {encounter ? (
            <>
              <div className="px-2.5 py-1 rounded-lg bg-info/10 border border-info/30 text-info text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <EncounterIcon className="w-3 h-3" />
                {encounterMeta?.label}
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-success/10 border border-success/30 text-success text-[11px] font-semibold whitespace-nowrap">
                In Progress
              </div>
            </>
          ) : (
            <div className="px-2.5 py-1 rounded-lg bg-success/10 border border-success/30 text-success text-[11px] font-semibold whitespace-nowrap">
              Active
            </div>
          )}
        </div>
      </div>

      {encounter ? (
        <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-2.5">
          <StatTile icon={FileText} iconBg="bg-info/10" iconColor="text-info" label="Visit Reason" value={encounter.visit_reason || encounter.chief_complaint || 'Not specified'} />
          <StatTile icon={DoorOpen} iconBg="bg-primary/10" iconColor="text-primary" label="Room" value={encounter.room_number || '—'} />
          <StatTile icon={Timer} iconBg="bg-warning/10" iconColor="text-warning" label="Duration" value={encounterDuration || '0m'} />
          {encounter.chief_complaint && encounter.visit_reason ? (
            <div className="@md:col-span-2 @4xl:col-span-1 p-3 rounded-xl bg-secondary/50 border border-border min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Chief Complaint</div>
              <div className="text-sm font-medium text-foreground break-words">{encounter.chief_complaint}</div>
            </div>
          ) : (
            <StatTile icon={MapPin} iconBg="bg-primary/10" iconColor="text-primary" label="Location" value={`${patient.location}${patient.bed ? ` • ${patient.bed}` : ''}`} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-2.5">
          <StatTile icon={MapPin} iconBg="bg-primary/10" iconColor="text-primary" label="Location" value={`${patient.location} • ${patient.bed}`} />
          <StatTile icon={Calendar} iconBg="bg-info/10" iconColor="text-info" label="Admission Day" value={`Day ${patient.admissionDay}`} />
          <StatTile icon={Clock} iconBg="bg-warning/10" iconColor="text-warning" label="Expected LOS" value={`${patient.expectedLOS} days`} />
          <div className="@md:col-span-2 @4xl:col-span-1 p-3 rounded-xl bg-secondary/50 border border-border min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Admission Dx</div>
            <div className="text-sm font-medium text-foreground break-words">{patient.admissionDiagnosis}</div>
          </div>
        </div>
      )}
    </div>
  );
}

