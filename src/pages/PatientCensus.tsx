import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { usePatients, DBPatient } from '@/hooks/usePatients';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import alisLogo from '@/assets/alis-logo.png';

const statusColors: Record<string, string> = {
  critical: 'bg-critical',
  warning: 'bg-warning',
  stable: 'bg-success',
  active: 'bg-success',
};

const EMR_BADGE: Record<string, { label: string; className: string }> = {
  epic: { label: 'Epic', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cerner: { label: 'Cerner', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  meditech: { label: 'Meditech', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
};

export default function PatientCensus() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { selectedHospital, setSelectedPatientId } = useHospital();
  const { patientsByUnit, loading } = usePatients(selectedHospital?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (!authLoading && !selectedHospital) navigate('/');
  }, [user, authLoading, selectedHospital, navigate]);

  const handleSelectPatient = (patient: DBPatient) => {
    setSelectedPatientId(patient.id);
    navigate('/dashboard');
  };

  const unitEntries = Object.entries(patientsByUnit).sort(([a], [b]) => a.localeCompare(b));
  const totalPatients = unitEntries.reduce((sum, [, pts]) => sum + pts.length, 0);
  const emr = selectedHospital ? EMR_BADGE[selectedHospital.emr_system] : null;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FuturisticBackground variant="lite" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="glass-strong border-b border-border px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={alisLogo} alt="ALIS" className="h-10 sm:h-12" />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                {selectedHospital?.name}
              </h1>
              <div className="flex items-center gap-2">
                {emr && (
                  <span className={cn('text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border', emr.className)}>
                    {emr.label}
                  </span>
                )}
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {selectedHospital?.code}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{totalPatients} patients</span>
          </div>
        </header>

        {/* Census Grid */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {unitEntries.map(([unit, patients]) => {
              const criticalCount = patients.filter(p => p.status === 'critical').length;
              const warningCount = patients.filter(p => p.status === 'warning').length;

              return (
                <section key={unit}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{unit}</h2>
                    <span className="text-xs text-muted-foreground">{patients.length} patients</span>
                    {criticalCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-critical/10 text-critical font-bold">
                        {criticalCount} critical
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-bold">
                        {warningCount} warning
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className="group glass-strong rounded-xl p-4 border border-border/50 hover:border-primary/50 transition-all duration-200 text-left hover:shadow-elevated active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', statusColors[patient.status || 'active'])} />
                            <span className="text-sm font-semibold text-foreground truncate">
                              {patient.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                            {patient.bed}
                          </span>
                        </div>

                        <div className="space-y-1 ml-4.5">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{patient.age}{patient.sex === 'M' ? 'M' : 'F'}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="font-mono">{patient.mrn}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {patient.admission_diagnosis || 'No diagnosis'}
                          </p>
                          {patient.attending_physician && (
                            <p className="text-[10px] text-muted-foreground/70 truncate">
                              Dr. {patient.attending_physician}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}

            {unitEntries.length === 0 && (
              <div className="text-center py-16">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No patients found for this facility</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
