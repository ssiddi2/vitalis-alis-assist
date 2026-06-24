import { useState } from 'react';
import {
  Menu, Clock, Zap,
  Home, CalendarDays, Users, DollarSign, BarChart3,
  Server, Rocket, FileText, Calculator, Globe,
  Shield, LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAmbulatory } from '@/config/deployment';
import { DirectMessageSidebar } from './DirectMessageSidebar';

interface MobileMenuProps {
  currentTime: string;
}

type Item = { label: string; desc: string; path: string; icon: LucideIcon; external?: boolean; show?: boolean };
type Group = { title: string; items: Item[] };

export function MobileMenu({ currentTime }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const go = (item: Item) => {
    if (item.external) window.open(item.path, '_blank');
    else navigate(item.path);
    setOpen(false);
  };

  const groups: Group[] = [
    {
      title: 'Home',
      items: [{ label: 'Home', desc: 'Workspaces & quick links', path: '/', icon: Home }],
    },
    {
      title: 'Clinical',
      items: [
        { label: 'Schedule', desc: "Today's appointments", path: '/schedule', icon: CalendarDays },
        { label: 'Clinic', desc: 'Clinic-wide patient list', path: '/clinic', icon: Users },
      ],
    },
    {
      title: 'Revenue',
      items: [
        { label: 'RCM / Billing', desc: 'Charges, claims & remits', path: '/billing', icon: DollarSign },
        { label: 'Quality', desc: 'CMS quality measures', path: '/quality', icon: BarChart3, show: !isAmbulatory },
      ],
    },
    {
      title: 'Tools & Demos',
      items: [
        { label: 'FHIR Data Inspector', desc: 'Live FHIR sync viewer', path: '/emr-sandbox', icon: Server },
        { label: 'SMART-on-FHIR Launcher', desc: 'Test EHR app launch', path: '/smart/launch', icon: Rocket },
        { label: 'Integration Spec', desc: 'Printable FHIR docs', path: '/integration-spec', icon: FileText },
        { label: 'ROI Calculator', desc: 'Savings estimator', path: '/roi-calculator', icon: Calculator },
        { label: 'Product Page', desc: 'Public marketing site', path: '/product', icon: Globe, external: true },
      ],
    },
    {
      title: 'Admin',
      items: [{ label: 'Admin Panel', desc: 'Users & roles', path: '/admin', icon: Shield, show: isAdmin }],
    },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] p-0 overflow-y-auto">
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

          {groups.map((group) => {
            const visible = group.items.filter((i) => i.show !== false);
            if (!visible.length) return null;
            return (
              <nav key={group.title} className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pb-1">
                  {group.title}
                </p>
                {visible.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => go(item)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-secondary/70 border border-transparent hover:border-border transition-all text-left"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">{item.label}</div>
                      <div className="text-xs text-muted-foreground leading-tight mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </nav>
            );
          })}

          <div className="pt-2 border-t border-border">
            <DirectMessageSidebar />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
