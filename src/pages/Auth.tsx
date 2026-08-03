import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';
import { AnimatedLogo } from '@/components/virtualis/AnimatedLogo';
import { MfaChallenge } from '@/components/auth/MfaChallenge';


const FEATURES = ['Real-time Monitoring', 'AI Insights', 'Clinical Decision Support', 'HIPAA Compliant'];

/** Decorative flowing-line + waveform motif. */
function FlowMotif() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(900px_460px_at_18%_-8%,hsl(var(--primary)/0.14),transparent),radial-gradient(700px_420px_at_92%_110%,hsl(var(--primary)/0.10),transparent)]" />
      <svg className="absolute inset-x-0 top-1/4 h-64 w-full opacity-[0.55]" viewBox="0 0 1200 300" fill="none" preserveAspectRatio="none">
        {[0, 1, 2, 3].map(i => (
          <path
            key={i}
            d={`M0 ${120 + i * 22} C 220 ${40 + i * 26}, 420 ${230 - i * 12}, 640 ${140 + i * 14} S 1000 ${50 + i * 20}, 1200 ${130 + i * 16}`}
            stroke="hsl(var(--primary))"
            strokeOpacity={0.16 - i * 0.03}
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-end gap-1.5 opacity-40">
        {[10, 22, 38, 26, 46, 30, 18, 34, 24, 12, 28, 40, 20, 14].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-primary/50"
            style={{ height: h, animation: `pulse 2.4s ease-in-out ${i * 0.12}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Auth() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const navigate = useNavigate();
  const { logLogin } = useAuditLog();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && !mfaRequired) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, mfaRequired, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetEmailSent(true);
        toast.success('Password reset link sent! Check your email.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Optional MFA: only step up when the user actually has a verified factor.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
          setMfaRequired(true);
          return;
        }

        logLogin();
        toast.success('Welcome back!');
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setResetEmailSent(false);
  };

  const inputClass =
    'h-12 rounded-full border-border bg-card/80 pl-11 text-sm shadow-sm transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <FlowMotif />

      <div className="relative z-10 flex min-h-screen">
        {/* Left side - Branding */}
        <div className="hidden items-center justify-center p-12 lg:flex lg:w-1/2">
          <div className="max-w-lg">
            <div className="mb-10 flex animate-fade-in justify-center">
              <AnimatedLogo size={240} />
            </div>

            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              01 — Universal EMR intelligence
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight text-foreground">
              Intelligent medicine.
              <span className="block text-primary">Acuity-first.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              One system, smarter care. VirtualisOne unifies clinical workflows and surfaces real-time
              acuity insights across every facility — powered by ALIS.
            </p>

            <div className="mt-10 flex flex-wrap gap-2">
              {FEATURES.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-border bg-card/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex flex-col items-center lg:hidden">
              <AnimatedLogo size={160} compact />
              <p className="-mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Universal EMR intelligence
              </p>
            </div>

            {mfaRequired ? (
              <MfaChallenge
                onVerified={() => {
                  logLogin();
                  setMfaRequired(false);
                  toast.success('Welcome back!');
                  navigate('/', { replace: true });
                }}
                onCancel={() => {
                  setMfaRequired(false);
                  setPassword('');
                }}
              />
            ) : (
            <div className="glass-strong rounded-2xl border border-border p-8 shadow-elevated">

              <div className="mb-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                  Secure clinical access
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {isForgotPassword ? 'Reset password' : 'Welcome back'}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {isForgotPassword
                    ? resetEmailSent
                      ? 'Check your email for the reset link'
                      : 'Enter your email to receive a reset link'
                    : 'Sign in to access your clinical dashboard'}
                </p>
              </div>

              {resetEmailSent ? (
                <div className="py-4 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                    <Mail className="h-8 w-8 text-success" />
                  </div>
                  <p className="mb-6 text-sm text-muted-foreground">
                    We've sent a password reset link to <strong className="text-foreground">{email}</strong>
                  </p>
                  <Button onClick={handleBackToLogin} variant="outline" className="h-12 w-full rounded-full">
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Email
                    </Label>
                    <div className="group relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hospital.com"
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>

                  {!isForgotPassword && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Password
                        </Label>
                        <button
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="group relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputClass} pr-11`}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="btn-primary-gradient h-12 w-full justify-between rounded-full px-6 text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
                  >
                    {loading ? (
                      <span className="flex w-full items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                        Please wait...
                      </span>
                    ) : (
                      <>
                        <span>{isForgotPassword ? 'Send Reset Link' : 'Sign In'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {!resetEmailSent && isForgotPassword && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    Back to Sign In <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              By continuing you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
