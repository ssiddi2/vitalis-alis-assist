import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import alisLogo from '@/assets/alis-logo.png';

interface MobileALISFabProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function MobileALISFab({ onClick, hasUnread }: MobileALISFabProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50 lg:hidden",
        "h-14 w-14 rounded-full shadow-elevated",
        "btn-primary-gradient",
        "flex items-center justify-center",
        "animate-fade-in"
      )}
    >
      <img src={alisLogo} alt="ALIS" className="h-8 w-8 object-contain" />
      {hasUnread && (
        <span className="absolute top-0 right-0 h-3 w-3 bg-critical rounded-full border-2 border-background" />
      )}
    </Button>
  );
}
