import { useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import alisLogo from '@/assets/alis-logo.png';

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
  const { user, signOut, loading: authLoading } = useAuth();
  const { hospitals, setSelectedHospital, loading, error } = useHospital();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    navigate('/dashboard');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading facilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-info/5" />
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-info/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="glass-strong border-b border-border px-8 py-4 flex items-center justify-between">
          <img src={alisLogo} alt="ALIS" className="h-12" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2 text-muted-foreground hover:text-critical"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl">
            {/* Welcome */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-foreground mb-3">
                Select a Facility
              </h1>
              <p className="text-lg text-muted-foreground">
                Choose a hospital to view its patient census and clinical data
              </p>
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-8 p-4 bg-critical/10 border border-critical/20 rounded-2xl text-center">
                <p className="text-critical">{error}</p>
              </div>
            )}

            {/* Hospital Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hospitals.map((hospital) => {
                const emrConfig = EMR_CONFIG[hospital.emr_system];
                
                return (
                  <button
                    key={hospital.id}
                    onClick={() => handleSelectHospital(hospital)}
                    className="group relative glass-strong rounded-2xl p-6 border border-border/50 hover:border-primary/50 transition-all duration-300 text-left hover:shadow-elevated hover:-translate-y-1"
                  >
                    {/* EMR Badge */}
                    <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emrConfig.bgColor} ${emrConfig.borderColor} border`}>
                      <span className={`bg-gradient-to-r ${emrConfig.color} bg-clip-text text-transparent`}>
                        {emrConfig.name}
                      </span>
                    </div>

                    {/* Hospital Icon */}
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${emrConfig.color} flex items-center justify-center mb-4 shadow-lg`}>
                      <Building2 className="h-7 w-7 text-white" />
                    </div>

                    {/* Hospital Name */}
                    <h3 className="text-lg font-semibold text-foreground mb-1 pr-16">
                      {hospital.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {hospital.code} • {hospital.address?.split(',')[1]?.trim() || 'Location'}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {hospital.patientCount} patients
                        </span>
                      </div>
                      {(hospital.alertCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <span className="text-sm font-medium text-warning">
                            {hospital.alertCount} alerts
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Connection Status */}
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                        <span className="text-xs text-muted-foreground capitalize">
                          {hospital.connection_status}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Empty State */}
            {hospitals.length === 0 && !error && (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No facilities available
                </h3>
                <p className="text-muted-foreground">
                  Contact your administrator to request access to hospital facilities.
                </p>
              </div>
            )}

            {/* Integration Info */}
            <div className="mt-12 text-center">
              <p className="text-xs text-muted-foreground mb-4">
                Powered by Virtualis Interoperability Layer
              </p>
              <div className="flex items-center justify-center gap-6">
                {Object.entries(EMR_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Wifi className={`h-3 w-3 bg-gradient-to-r ${config.color} bg-clip-text`} style={{ color: key === 'epic' ? '#ef4444' : key === 'cerner' ? '#3b82f6' : '#22c55e' }} />
                    <span className="text-xs text-muted-foreground">{config.name}</span>
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
