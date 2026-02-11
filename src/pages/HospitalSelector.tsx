import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHospital, Hospital } from '@/contexts/HospitalContext';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  AlertTriangle, 
  ChevronRight, 
  Wifi, 
  LogOut,
} from 'lucide-react';
import alisLogo from '@/assets/alis-logo.png';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { HospitalCardSkeleton } from '@/components/ui/skeleton-patterns';

const EMR_CONFIG = {
  epic: { 
    name: 'Epic', 
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20'
  },
  cerner: { 
    name: 'Cerner', 
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  },
  meditech: { 
    name: 'Meditech', 
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20'
  },
};

export default function HospitalSelector() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { hospitals, setSelectedHospital, loading, error } = useHospital();

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    navigate('/census');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FuturisticBackground />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="glass-strong border-b border-border px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={alisLogo} alt="ALIS" className="h-10 sm:h-12" />
            <span className="text-lg sm:text-xl font-bold text-foreground">ALIS</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2 text-muted-foreground hover:text-critical"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-4xl">
            {/* Welcome */}
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-3">
                Select a Facility
              </h1>
              <p className="text-sm sm:text-lg text-muted-foreground">
                Choose a hospital to view its patient census and clinical data
              </p>
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-critical/10 border border-critical/20 rounded-2xl text-center">
                <p className="text-critical text-sm sm:text-base">{error}</p>
              </div>
            )}

            {/* Hospital Grid - Single column on mobile */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="group relative glass-strong rounded-2xl p-4 sm:p-6 border border-border/50 hover:border-primary/50 transition-all duration-300 text-left hover:shadow-elevated hover:-translate-y-1 active:scale-[0.98]"
                  >
                    {/* EMR Badge */}
                    <div className={`absolute top-3 sm:top-4 right-3 sm:right-4 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${emrConfig.bgColor} ${emrConfig.borderColor} border`}>
                      <span className={`bg-gradient-to-r ${emrConfig.color} bg-clip-text text-transparent`}>
                        {emrConfig.name}
                      </span>
                    </div>

                    {/* Hospital Icon */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${emrConfig.color} flex items-center justify-center mb-3 sm:mb-4 shadow-lg`}>
                      <Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                    </div>

                    {/* Hospital Name */}
                    <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 pr-12 sm:pr-16">
                      {hospital.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                      {hospital.code} • {hospital.address?.split(',')[1]?.trim() || 'Location'}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 flex-wrap">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm font-medium text-foreground">
                          {hospital.patientCount} patients
                        </span>
                      </div>
                      {(hospital.alertCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
                          <span className="text-xs sm:text-sm font-medium text-warning">
                            {hospital.alertCount} alerts
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Connection Status */}
                    <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-border/50">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                        <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                          {hospital.connection_status}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Empty State */}
            {hospitals.length === 0 && !error && (
              <div className="text-center py-8 sm:py-12">
                <Building2 className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/30 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                  No facilities available
                </h3>
                <p className="text-sm text-muted-foreground">
                  Contact your administrator to request access to hospital facilities.
                </p>
              </div>
            )}

            {/* Integration Info */}
            <div className="mt-8 sm:mt-12 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">
                Powered by ALIS Interoperability Layer
              </p>
              <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
                {Object.entries(EMR_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-1.5 sm:gap-2">
                    <Wifi className={`h-3 w-3`} style={{ color: key === 'epic' ? '#ef4444' : key === 'cerner' ? '#3b82f6' : '#22c55e' }} />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{config.name}</span>
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
