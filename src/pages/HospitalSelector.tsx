import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHospital, Hospital } from '@/contexts/HospitalContext';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  AlertTriangle,
  ArrowRight,
  Wifi,
  LogOut,
} from 'lucide-react';
import virtualisOneIcon from '@/assets/virtualis-one-header-icon.png.asset.json';
import { HospitalCardSkeleton } from '@/components/ui/skeleton-patterns';

const EMR_CONFIG = {
  epic: { name: 'Epic', dot: '#EF4444' },
  cerner: { name: 'Cerner', dot: '#2563EB' },
  meditech: { name: 'Meditech', dot: '#10B981' },
};

export default function HospitalSelector() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { hospitals, selectedHospital, setSelectedHospital, loading, error } = useHospital();

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    navigate('/census');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_460px_at_50%_-12%,hsl(var(--primary)/0.12),transparent),radial-gradient(700px_380px_at_100%_100%,hsl(var(--primary)/0.08),transparent)]"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="glass-strong flex items-center justify-between rounded-full border border-border px-4 py-2 shadow-sm sm:px-5">
            <img src={virtualisOneIcon.url} alt="VirtualisOne" className="h-8 w-auto sm:h-9" />
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:block">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 rounded-full text-muted-foreground hover:text-critical"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-5xl">
            {/* Welcome */}
            <div className="mb-8 sm:mb-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                01 — Select facility
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Choose your <span className="text-primary">facility</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Open a hospital to work its patient census, clinical data, and live acuity board.
              </p>

              {selectedHospital?.name && (
                <Button
                  onClick={() => navigate('/command')}
                  className="btn-primary-gradient mt-5 h-11 justify-between gap-3 rounded-full px-5 text-sm font-semibold shadow-lg hover:shadow-xl"
                >
                  Enter Command Center <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-6 rounded-2xl border border-critical/20 bg-critical/10 p-4 text-center sm:mb-8">
                <p className="text-sm text-critical sm:text-base">{error}</p>
              </div>
            )}

            {/* Hospital Grid - Single column on mobile */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {loading ? (
                <>
                  {[1, 2, 3].map(i => <HospitalCardSkeleton key={i} />)}
                </>
              ) : hospitals.map((hospital) => {
                const emrConfig = EMR_CONFIG[hospital.emr_system];

                return (
                  <button
                    key={hospital.id}
                    onClick={() => handleSelectHospital(hospital)}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 text-left shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-elevated active:scale-[0.98] sm:p-6"
                  >
                    {/* EMR Badge */}
                    <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: emrConfig.dot }} />
                      {emrConfig.name}
                    </div>

                    {/* Hospital Icon */}
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-14 sm:w-14">
                      <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>

                    {/* Hospital Name */}
                    <h3 className="pr-16 text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      {hospital.name}
                    </h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {hospital.code} · {hospital.address?.split(',')[1]?.trim() || 'Location'}
                    </p>

                    {/* Stats */}
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {hospital.patientCount} patients
                        </span>
                      </div>
                      {(hospital.alertCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <span className="text-sm font-medium tabular-nums text-warning">
                            {hospital.alertCount} alerts
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Connection Status */}
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {hospital.connection_status}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Empty State */}
            {hospitals.length === 0 && !error && (
              <div className="glass rounded-2xl border border-border py-12 text-center shadow-sm">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30 sm:h-16 sm:w-16" />
                <h3 className="mb-2 text-base font-semibold text-foreground sm:text-lg">
                  No facilities available
                </h3>
                <p className="text-sm text-muted-foreground">
                  Contact your administrator to request access to hospital facilities.
                </p>
              </div>
            )}

            {/* Integration Info */}
            <div className="mt-10 text-center sm:mt-14">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Powered by the ALIS interoperability layer
              </p>
              <div className="flex flex-wrap items-center justify-center gap-5">
                {Object.entries(EMR_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <Wifi className="h-3 w-3" style={{ color: config.dot }} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {config.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
