import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Copy, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { OtpInput } from '@/components/auth/OtpInput';
import { useMfaFactors, challengeAndVerify } from '@/hooks/useMfa';

interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

/** Security → Two-Factor panel. Optional: users may enroll, nobody is forced. */
export function TwoFactorSetup() {
  const { verified, enabled, loading, error, refresh } = useMfaFactors();
  const [enrolling, setEnrolling] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${Date.now()}`,
      });
      if (error) throw error;
      setCode('');
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start enrollment');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (value: string) => {
    if (!enrolling || value.length !== 6 || busy) return;
    setBusy(true);
    try {
      await challengeAndVerify(enrolling.factorId, value);
      toast.success('Two-factor authentication enabled');
      setEnrolling(null);
      setCode('');
      await refresh();
    } catch (e) {
      setCode('');
      toast.error(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setCode('');
  };

  const unenroll = async (factorId: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Two-factor authentication removed');
    refresh();
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          01 — Two-Factor Authentication
        </h3>
        <span className="h-px flex-1 bg-border/70" />
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            enabled
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-border bg-secondary/60 text-muted-foreground'
          }`}
        >
          {loading ? '…' : enabled ? 'Enabled' : 'Not enabled'}
        </span>
      </header>

      {error && <p className="text-xs text-critical">{error}</p>}

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
      ) : enrolling ? (
        <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-soft backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div className="mt-4 flex flex-col items-center gap-4">
            <img
              src={enrolling.qr}
              alt="Two-factor QR code"
              className="h-44 w-44 rounded-xl border border-border bg-white p-2"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(enrolling.secret);
                toast.success('Setup key copied');
              }}
              className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 font-mono text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-primary"
            >
              {enrolling.secret}
              <Copy className="h-3 w-3" />
            </button>
            <OtpInput value={code} onChange={setCode} onComplete={confirmEnroll} disabled={busy} />
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="h-10 flex-1 rounded-full" onClick={cancelEnroll} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="btn-primary-gradient h-10 flex-1 rounded-full"
              onClick={() => confirmEnroll(code)}
              disabled={busy || code.length !== 6}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </div>
      ) : enabled ? (
        <div className="space-y-2">
          {verified.map(f => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-4 shadow-soft backdrop-blur-sm"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {f.friendly_name || 'Authenticator'}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Added {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-critical" disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove two-factor authentication?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll sign in with just your password until you enroll again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="rounded-full bg-critical text-white hover:bg-critical/90" onClick={() => unenroll(f.id)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-soft backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-sm text-muted-foreground">
              Add an authenticator app for a second layer of protection at sign-in. Optional — your
              account keeps working without it.
            </p>
          </div>
          <Button
            className="btn-primary-gradient mt-4 h-10 w-full rounded-full"
            onClick={startEnroll}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set up authenticator'}
          </Button>
        </div>
      )}
    </div>
  );
}
