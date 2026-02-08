import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import alisLogo from '@/assets/alis-logo.png';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { logLogin } = useAuditLog();
  const { user, loading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        logLogin(); // Log successful login for HIPAA audit
        toast.success('Welcome back!');
        // Navigation will happen via the useEffect when user state updates
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success('Please check your email to verify your account');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Futuristic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-info/5" />
      <div className="absolute inset-0 grid-pattern opacity-30" />
      
      {/* Floating Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-info/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-success/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <div className="text-center max-w-lg">
            <div className="mb-12 relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
              <img 
                src={alisLogo} 
                alt="ALIS" 
                className="h-32 mx-auto relative z-10 drop-shadow-lg"
              />
            </div>
            
            <div className="space-y-6">
              <h1 className="text-5xl font-bold text-foreground tracking-tight">
                Welcome to ALIS
              </h1>
              <p className="text-lg text-muted-foreground">
                Ambient Learning Intelligence System
              </p>
              <p className="text-xl text-muted-foreground leading-relaxed">
                AI-powered clinical intelligence for modern healthcare. 
                Monitor patient trajectories, surface real-time insights, and make data-driven decisions.
              </p>
            </div>
            
            {/* Feature Pills */}
            <div className="mt-12 flex flex-wrap justify-center gap-3">
              {['Real-time Monitoring', 'AI Insights', 'Clinical Decision Support', 'Secure & HIPAA Compliant'].map((feature) => (
                <span 
                  key={feature}
                  className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden mb-8 text-center">
              <img 
                src={alisLogo} 
                alt="ALIS" 
                className="h-20 mx-auto drop-shadow-lg"
              />
              <h2 className="text-xl font-bold text-foreground mt-4">ALIS</h2>
              <p className="text-sm text-muted-foreground">Ambient Learning Intelligence System</p>
            </div>

            <div className="glass-strong rounded-3xl p-8 shadow-elevated border border-border/50">
              {/* Header with logo */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 flex items-center justify-center shadow-lg border border-primary/20">
                  <img src={alisLogo} alt="ALIS" className="h-10 w-10 object-contain" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {isLogin ? 'Welcome back' : 'Get started'}
                </h2>
                <p className="text-muted-foreground mt-2">
                  {isLogin 
                    ? 'Sign in to access your clinical dashboard' 
                    : 'Create your account to begin'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                      Full Name
                    </Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Jane Smith"
                        className="pl-11 h-12 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-primary/20 transition-all"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </Label>
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

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
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
                  ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-4 text-muted-foreground">or</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="mt-6 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
            
            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}