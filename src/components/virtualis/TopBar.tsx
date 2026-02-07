import { DemoScenario } from '@/types/clinical';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { Activity, Zap } from 'lucide-react';

interface TopBarProps {
  scenario: DemoScenario;
  onScenarioChange: (scenario: DemoScenario) => void;
  isAIMode: boolean;
  onAIModeToggle: () => void;
}

export function TopBar({ scenario, onScenarioChange, isAIMode, onAIModeToggle }: TopBarProps) {
  const [currentTime, setCurrentTime] = useState('');

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

  return (
    <header className="glass-strong border-b border-border/50 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-info flex items-center justify-center glow-primary">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full animate-pulse-glow" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-gradient">Virtualis</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            Clinical Intelligence
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Scenario Selector */}
        <Select value={scenario} onValueChange={(v) => onScenarioChange(v as DemoScenario)}>
          <SelectTrigger className="w-[220px] h-9 bg-secondary/50 border-border/50 text-sm backdrop-blur-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="glass-strong border-border/50">
            <SelectItem value="day1">Day 1 – Admission</SelectItem>
            <SelectItem value="day2">Day 2 – Trajectory Shift</SelectItem>
            <SelectItem value="prevention">Prevention – Action Bundle</SelectItem>
          </SelectContent>
        </Select>

        {/* AI Mode Toggle */}
        <button
          onClick={onAIModeToggle}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${
            isAIMode
              ? 'bg-gradient-to-r from-primary to-info text-primary-foreground glow-primary'
              : 'bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/50'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${isAIMode ? 'animate-pulse' : ''}`} />
          {isAIMode ? 'AI Live' : 'Demo Mode'}
        </button>

        {/* Time Display */}
        <div className="font-mono text-xs text-muted-foreground px-4 py-2 bg-secondary/30 border border-border/30 rounded-lg">
          {currentTime}
        </div>
      </div>
    </header>
  );
}
