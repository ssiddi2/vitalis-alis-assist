import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium transition-all duration-300 animate-message-slide',
        isOnline
          ? 'bg-success/10 text-success border-b border-success/20'
          : 'bg-critical/10 text-critical border-b border-critical/20'
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          Connection restored
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          No internet connection — changes may not be saved
        </>
      )}
    </div>
  );
}
