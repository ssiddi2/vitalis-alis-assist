import { DemoScenario } from '@/types/clinical';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { Zap, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import virtualisLogo from '@/assets/virtualis-logo.png';

interface TopBarProps {
  scenario: DemoScenario;
  onScenarioChange: (scenario: DemoScenario) => void;
  isAIMode: boolean;
  onAIModeToggle: () => void;
}

export function TopBar({ scenario, onScenarioChange, isAIMode, onAIModeToggle }: TopBarProps) {
  const [currentTime, setCurrentTime] = useState('');
  const { user, role, signOut, isAdmin } = useAuth();
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
    navigate('/auth');
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

  return (
    <header className="glass-strong border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <img 
          src={virtualisLogo} 
          alt="Virtualis" 
          className="h-10"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Scenario Selector */}
        <Select value={scenario} onValueChange={(v) => onScenarioChange(v as DemoScenario)}>
          <SelectTrigger className="w-[200px] h-9 bg-secondary/50 border-border text-sm rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border shadow-elevated">
            <SelectItem value="day1">Day 1 – Admission</SelectItem>
            <SelectItem value="day2">Day 2 – Trajectory Shift</SelectItem>
            <SelectItem value="prevention">Prevention – Action Bundle</SelectItem>
          </SelectContent>
        </Select>

        {/* AI Mode Toggle */}
        <Button
          onClick={onAIModeToggle}
          variant={isAIMode ? 'default' : 'outline'}
          size="sm"
          className={`rounded-xl h-9 px-4 gap-2 transition-all duration-300 ${
            isAIMode
              ? 'btn-primary-gradient'
              : 'bg-secondary/50 border-border hover:bg-secondary'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${isAIMode ? 'animate-pulse' : ''}`} />
          {isAIMode ? 'AI Live' : 'Demo Mode'}
        </Button>

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
                <DropdownMenuItem className="gap-2 cursor-pointer">
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
    </header>
  );
}
