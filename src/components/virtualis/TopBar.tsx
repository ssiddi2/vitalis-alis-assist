import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { User, LogOut, Shield, Building2, ChevronLeft, DollarSign, BarChart3, CalendarDays, Users, Radar, ShieldCheck, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TwoFactorSetup } from './TwoFactorSetup';
import { useMfaFactors } from '@/hooks/useMfa';

import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { useNavigate } from 'react-router-dom';
import { DirectMessageSidebar } from './DirectMessageSidebar';
import { MobileMenu } from './MobileMenu';
import { NotificationCenter } from './NotificationCenter';
import { EMRSyncBadge } from './EMRSyncBadge';
import { AmbientStatusIndicator } from './AmbientStatusIndicator';
import virtualisOneIcon from '@/assets/virtualis-one-header-icon.png.asset.json';

export function TopBar() {
  const [currentTime, setCurrentTime] = useState('');
  const [isAmbient, setIsAmbient] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(
    () => localStorage.getItem('mfa-nudge-dismissed') === '1'
  );
  const { user, role, signOut, isAdmin } = useAuth();
  const { enabled: mfaEnabled, loading: mfaLoading } = useMfaFactors();
  const { selectedHospital, setSelectedHospital } = useHospital();
  const navigate = useNavigate();

  const showMfaNudge = !!user && !mfaLoading && !mfaEnabled && !nudgeDismissed;
  const dismissNudge = () => {
    localStorage.setItem('mfa-nudge-dismissed', '1');
    setNudgeDismissed(true);
  };


  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      setCurrentTime(now.toLocaleDateString('en-US', options));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setSelectedHospital(null);
    navigate('/auth');
  };

  const handleBackToHospitals = () => {
    setSelectedHospital(null);
    navigate('/');
  };

  const getRoleBadge = () => {
    if (!role) return null;
    const colors = {
      admin: 'bg-critical/10 text-critical border-critical/20',
      clinician: 'bg-primary/10 text-primary border-primary/20',
      viewer: 'bg-muted text-muted-foreground border-border',
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${colors[role]}`}>
        {role}
      </span>
    );
  };

  const getEmrColor = () => {
    switch (selectedHospital?.emr_system) {
      case 'epic': return 'text-red-500';
      case 'cerner': return 'text-blue-500';
      case 'meditech': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <header className="sticky top-0 z-50 px-2 sm:px-4 pt-2 sm:pt-3 pb-1 sm:pb-2">
      <div className="glass-strong rounded-full border border-border px-3 sm:px-5 py-2 flex items-center justify-between">
      {/* Logo and Hospital */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <img src={virtualisOneIcon.url} alt="VirtualisOne" className="h-7 sm:h-8 w-auto" />
        </div>
        
        {selectedHospital && (
          <>
            <div className="w-px h-6 sm:h-8 bg-border hidden sm:block" />
            <button
              onClick={handleBackToHospitals}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-secondary/60 border border-border hover:bg-accent transition-colors group min-w-0"
            >
              <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
              <Building2 className={`w-3 h-3 sm:w-4 sm:h-4 ${getEmrColor()} flex-shrink-0 hidden sm:block`} />
              <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[80px] sm:max-w-[150px]">
                {selectedHospital.name}
              </span>
              <span className={`text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full bg-secondary font-semibold uppercase ${getEmrColor()} hidden sm:block`}>
                {selectedHospital.emr_system}
              </span>
            </button>
          </>
        )}

        {/* Active-facility EMR connection state */}
        <EmrConnectionPill className="hidden sm:flex max-w-[240px]" />
      </div>

      {/* Desktop Controls */}
      <div className="hidden lg:flex items-center gap-2">


        {/* Ambient Mode */}
        <AmbientStatusIndicator isAmbient={isAmbient} onToggle={() => setIsAmbient(prev => !prev)} />

        {/* Nav Links */}
        <button onClick={() => navigate('/command')} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent border border-transparent hover:border-border transition-all">
          <Radar className="w-3 h-3" /> Command
        </button>
        <button onClick={() => navigate('/schedule')} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent border border-transparent hover:border-border transition-all">
          <CalendarDays className="w-3 h-3" /> Schedule
        </button>
        <button onClick={() => navigate('/clinic')} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent border border-transparent hover:border-border transition-all">
          <Users className="w-3 h-3" /> Clinic
        </button>
        <button onClick={() => navigate('/billing')} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent border border-transparent hover:border-border transition-all">
          <DollarSign className="w-3 h-3" /> RCM
        </button>
        <button onClick={() => navigate('/quality')} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-accent border border-transparent hover:border-border transition-all">
          <BarChart3 className="w-3 h-3" /> Quality
        </button>

        {/* Notifications */}
        <NotificationCenter />

        {/* Direct Messages */}
        <DirectMessageSidebar />

        {/* Time Display */}
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1.5 bg-secondary/60 border border-border rounded-full">
          {currentTime}
        </div>

        {/* Optional MFA nudge — dismissible, never blocking */}
        {showMfaNudge && (
          <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 pl-3 pr-1.5 py-1">
            <button
              onClick={() => setSecurityOpen(true)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-primary"
            >
              <ShieldCheck className="w-3 h-3" /> Enable two-factor
            </button>
            <button onClick={dismissNudge} aria-label="Dismiss" className="p-0.5 text-primary/60 hover:text-primary">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* User Menu */}

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full h-9 gap-2 bg-card border-border hover:bg-secondary"
              >
                <User className="w-4 h-4" />
                <span className="max-w-[100px] truncate text-sm">
                  {user.email?.split('@')[0]}
                </span>
                {getRoleBadge()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border shadow-elevated">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role} Access</p>
              </div>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate('/admin')} className="gap-2 cursor-pointer">
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSecurityOpen(true)} className="gap-2 cursor-pointer">
                <ShieldCheck className="w-4 h-4" />
                Security
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-critical cursor-pointer">

                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            onClick={() => navigate('/auth')}
            variant="outline"
            size="sm"
            className="rounded-full h-9 bg-primary text-primary-foreground border-transparent hover:bg-primary/90"
          >
            Sign In
          </Button>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="flex lg:hidden items-center gap-2">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <User className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border shadow-elevated">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role} Access</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSecurityOpen(true)} className="gap-2 cursor-pointer">
                <ShieldCheck className="w-4 h-4" />
                Security
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-critical cursor-pointer">

                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <MobileMenu currentTime={currentTime} />
      </div>
      </div>

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Security</DialogTitle>
          </DialogHeader>
          {securityOpen && <TwoFactorSetup />}
        </DialogContent>
      </Dialog>
    </header>
  );
}

