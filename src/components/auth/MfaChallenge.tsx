import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from './OtpInput';
import { challengeAndVerify } from '@/hooks/useMfa';

interface MfaChallengeProps {
  onVerified: () => void;
  onCancel?: () => void;
}

/** Login step-up: verify a 6-digit TOTP code against the user's verified factor. */
export function MfaChallenge({ onVerified, onCancel }: MfaChallengeProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factor = data?.totp?.find(f => f.status === 'verified');
      if (!factor) throw new Error('No authenticator enrolled for this account');
      await challengeAndVerify(factor.id, value);
      toast.success('Verified');
      onVerified();
    } catch (e) {
      setCode('');
      toast.error(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    await supabase.auth.signOut();
    onCancel?.();
  };

  return (
    <div className="glass-strong rounded-2xl border border-border p-8 shadow-elevated">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Two-factor verification
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Enter your code</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Open your authenticator app and enter the 6-digit code.
        </p>
      </div>

      <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={loading} />

      <Button
        onClick={() => submit(code)}
        disabled={loading || code.length !== 6}
        className="btn-primary-gradient mt-6 h-12 w-full justify-between rounded-full px-6 text-sm font-semibold"
      >
        {loading ? (
          <span className="flex w-full items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            Verifying...
          </span>
        ) : (
          <>
            <span>Verify</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <button
        type="button"
        onClick={cancel}
        className="mt-4 w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Sign in with a different account
      </button>
    </div>
  );
}
