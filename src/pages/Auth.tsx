import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import alisLogo from '@/assets/alis-logo.png';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';

export default function Auth() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const { logLogin } = useAuditLog();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FuturisticBackground />
      
      <div className="relative z-10 min-h-screen flex">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <div className="text-center max-w-lg">
            <div className="mb-12 relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
              <img src={alisLogo} alt="ALIS" className="h-32 mx-auto relative z-10 drop-shadow-lg" />
            </div>
            <div className="space-y-6">
              <h1 className="text-5xl font-bold text-foreground tracking-tight">Welcome to ALIS</h1>
              <p className="text-lg text-muted-foreground">Ambient Learning Intelligence System</p>
              <p className="text-xl text-muted-foreground leading-relaxed">
                AI-powered clinical intelligence for modern healthcare. 
                Monitor patient trajectories, surface real-time insights, and make data-driven decisions.
              </p>
            </div>
            <div className="mt-12 flex flex-wrap justify-center gap-3">
              {['Real-time Monitoring', 'AI Insights', 'Clinical Decision Support', 'Secure & HIPAA Compliant'].map((feature) => (
                <span key={feature} className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <img src={alisLogo} alt="ALIS" className="h-20 mx-auto drop-shadow-lg" />
              <h2 className="text-xl font-bold text-foreground mt-4">ALIS</h2>
              <p className="text-sm text-muted-foreground">Ambient Learning Intelligence System</p>
            </div>

            <div className="glass-strong rounded-3xl p-8 shadow-elevated border border-border/50">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 flex items-center justify-center shadow-lg border border-primary/20">
                  <img src={alisLogo} alt="ALIS" className="h-10 w-10 object-contain" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {isForgotPassword ? 'Reset Password' : 'Welcome back'}
                </h2>
                <p className="text-muted-foreground mt-2">
                  {isForgotPassword
                    ? resetEmailSent
                      ? 'Check your email for the reset link'
                      : 'Enter your email to receive a reset link'
                    : 'Sign in to access your clinical dashboard'}
                </p>
              </div>

              {resetEmailSent ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-success" />
                  </div>
                  <p className="text-muted-foreground mb-6">
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                  <Button onClick={handleBackToLogin} variant="outline" className="w-full h-12 rounded-xl">
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hospital.com"
                        className="pl-11 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-primary/20 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {!isForgotPassword && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                        <button
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-11 pr-11 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-primary/20 transition-all"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl btn-primary-gradient text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Please wait...
                      </span>
                    ) : isForgotPassword ? (
                      'Send Reset Link'
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              )}

              {!resetEmailSent && isForgotPassword && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
            
            <p className="text-center text-xs text-muted-foreground mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
