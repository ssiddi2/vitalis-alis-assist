import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Clock, ShieldAlert } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 60 * 1000; // Show warning 60s before logout

interface InactivityGuardProps {
  children: React.ReactNode;
}

export function InactivityGuard({ children }: InactivityGuardProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setCountdown(60);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    logoutTimerRef.current = setTimeout(async () => {
      await signOut();
      navigate('/auth', { replace: true });
    }, INACTIVITY_TIMEOUT_MS);
  }, [signOut, navigate]);

  const handleStayActive = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

    const handleActivity = () => {
      // Only reset if warning is NOT showing (once warning shows, only button resets)
      if (!showWarning) {
        lastActivityRef.current = Date.now();
        resetTimers();
      }
    };

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, resetTimers, showWarning]);

  return (
    <>
      {children}
      <AlertDialog open={showWarning}>
        <AlertDialogContent className="glass-strong border-warning/30 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-foreground">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              Session Expiring
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              For HIPAA compliance, your session will expire due to inactivity.
              You will be logged out in{' '}
              <span className="font-bold text-warning">{countdown} seconds</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-warning to-critical transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(countdown / 60) * 100}%` }}
            />
          </div>
          <AlertDialogFooter>
            <Button
              onClick={handleStayActive}
              className="gap-2 rounded-xl btn-primary-gradient"
            >
              <Clock className="h-4 w-4" />
              I'm Still Here
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
