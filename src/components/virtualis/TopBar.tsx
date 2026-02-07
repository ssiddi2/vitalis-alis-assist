import { DemoScenario } from '@/types/clinical';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect } from 'react';

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
    <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm">
          V
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Virtualis</span>
          <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
            Universal Clinical Layer
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Scenario Selector */}
        <Select value={scenario} onValueChange={(v) => onScenarioChange(v as DemoScenario)}>
          <SelectTrigger className="w-[200px] h-9 bg-secondary border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day1">Day 1 – Admission</SelectItem>
            <SelectItem value="day2">Day 2 – Trajectory Shift</SelectItem>
            <SelectItem value="prevention">Prevention – Action Bundle</SelectItem>
          </SelectContent>
        </Select>

        {/* AI Mode Toggle */}
        <button
          onClick={onAIModeToggle}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isAIMode
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          {isAIMode ? 'AI Mode' : 'Demo Mode'}
        </button>

        {/* Time Display */}
        <div className="font-mono text-xs text-muted-foreground px-3 py-2 bg-secondary rounded-md">
          {currentTime}
        </div>
      </div>
    </header>
  );
}
