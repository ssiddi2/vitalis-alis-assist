import { useState } from 'react';
import { Menu, Clock, Zap, CalendarDays, Users, DollarSign, BarChart3, Server, Shield, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAmbulatory } from '@/config/deployment';
import { DirectMessageSidebar } from './DirectMessageSidebar';

interface MobileMenuProps {
  currentTime: string;
}

export function MobileMenu({ currentTime }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const navItems: Array<{ label: string; path: string; icon: LucideIcon; show?: boolean }> = [
    { label: 'Schedule', path: '/schedule', icon: CalendarDays },
    { label: 'Clinic', path: '/clinic', icon: Users },
    { label: 'RCM', path: '/billing', icon: DollarSign },
    { label: 'Quality', path: '/quality', icon: BarChart3, show: !isAmbulatory },
    { label: 'EMR Sandbox', path: '/emr-sandbox', icon: Server },
    { label: 'Admin Panel', path: '/admin', icon: Shield, show: isAdmin },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI Powered</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono text-muted-foreground">{currentTime}</span>
          </div>

          <nav className="flex flex-col gap-1 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pb-1">Navigate</p>
            {navItems
              .filter((item) => item.show !== false)
              .map(({ label, path, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-secondary/70 border border-transparent hover:border-border transition-all text-left"
                >
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {label}
                </button>
              ))}
          </nav>

          <div className="pt-2 border-t border-border">
            <DirectMessageSidebar />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
