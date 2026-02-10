import { useState } from 'react';
import { Menu, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DirectMessageSidebar } from './DirectMessageSidebar';

interface MobileMenuProps {
  currentTime: string;
}

export function MobileMenu({ currentTime }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

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
          {/* AI Status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI Powered</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono text-muted-foreground">{currentTime}</span>
          </div>

          {/* Direct Messages */}
          <div className="pt-2">
            <DirectMessageSidebar />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
