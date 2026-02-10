import { DBPatient } from '@/hooks/usePatients';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Users, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PatientListSidebarProps {
  patientsByUnit: Record<string, DBPatient[]>;
  selectedPatientId: string | undefined;
  onSelectPatient: (patient: DBPatient) => void;
  loading: boolean;
}

const statusColors: Record<string, string> = {
  critical: 'bg-critical',
  warning: 'bg-warning',
  stable: 'bg-success',
  active: 'bg-success',
};

const statusLabel: Record<string, string> = {
  critical: 'Critical',
  warning: 'Warning',
  stable: 'Stable',
  active: 'Active',
};

export function PatientListSidebar({ patientsByUnit, selectedPatientId, onSelectPatient, loading }: PatientListSidebarProps) {
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});

  const toggleUnit = (unit: string) => {
    setOpenUnits(prev => ({ ...prev, [unit]: !prev[unit] }));
  };

  const unitEntries = Object.entries(patientsByUnit).sort(([a], [b]) => a.localeCompare(b));
  const totalPatients = unitEntries.reduce((sum, [, pts]) => sum + pts.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unitEntries.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No patients found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between bg-secondary/30">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Census
          </span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
          {totalPatients}
        </span>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {unitEntries.map(([unit, patients]) => {
          const isOpen = openUnits[unit] !== false; // default open
          const criticalCount = patients.filter(p => p.status === 'critical').length;

          return (
            <Collapsible key={unit} open={isOpen} onOpenChange={() => toggleUnit(unit)}>
              <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors border-b border-border/50">
                <div className="flex items-center gap-2">
                  <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
                  <span className="text-xs font-semibold text-foreground">{unit}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {criticalCount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-critical/10 text-critical font-bold">
                      {criticalCount}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{patients.length}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => onSelectPatient(patient)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors border-b border-border/30",
                      selectedPatientId === patient.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColors[patient.status || 'active'])} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground truncate">
                            {patient.name}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex-shrink-0 ml-1">
                            {patient.bed}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {patient.age}{patient.sex === 'M' ? 'M' : 'F'}
                          </span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {patient.admission_diagnosis || 'No dx'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
