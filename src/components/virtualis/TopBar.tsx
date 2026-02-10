import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { User, LogOut, Shield, Building2, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { useNavigate } from 'react-router-dom';
import { DirectMessageSidebar } from './DirectMessageSidebar';
import { MobileMenu } from './MobileMenu';
import alisLogo from '@/assets/alis-logo.png';

export function TopBar() {
  const [currentTime, setCurrentTime] = useState('');
  const { user, role, signOut, isAdmin } = useAuth();
  const { selectedHospital, setSelectedHospital } = useHospital();
  const navigate = useNavigate();

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
    <header className="glass-strong border-b border-border px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Logo and Hospital */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <img src={alisLogo} alt="ALIS" className="h-8 sm:h-10" />
          <span className="hidden sm:block text-lg font-bold text-foreground">ALIS</span>
        </div>
        
        {selectedHospital && (
          <>
            <div className="w-px h-6 sm:h-8 bg-border hidden sm:block" />
            <button
              onClick={handleBackToHospitals}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors group min-w-0"
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
      </div>

      {/* Desktop Controls */}
      <div className="hidden lg:flex items-center gap-3">
        {/* AI Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-xs font-medium text-primary">AI Powered</span>
        </div>

        {/* Direct Messages */}
        <DirectMessageSidebar />

        {/* Time Display */}
        <div className="font-mono text-xs text-muted-foreground px-4 py-2 bg-secondary/50 border border-border rounded-xl">
          {currentTime}
        </div>

        {/* User Menu */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl h-9 gap-2 bg-secondary/50 border-border hover:bg-secondary"
              >
                <User className="w-4 h-4" />
                <span className="max-w-[100px] truncate text-sm">
                  {user.email?.split('@')[0]}
                </span>
                {getRoleBadge()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-border shadow-elevated">
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
            className="rounded-xl h-9 bg-secondary/50 border-border hover:bg-secondary"
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
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-border shadow-elevated">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role} Access</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-critical cursor-pointer">
                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <MobileMenu currentTime={currentTime} />
      </div>
    </header>
  );
}
