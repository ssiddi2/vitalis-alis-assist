import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'clinician' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isClinician: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_role', { _user_id: userId });
      
      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }
      return data as AppRole;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event, newSession?.user?.id);
        
        if (newSession?.user) {
          setUser(newSession.user);
          setSession(newSession);
          
          // Fetch role using setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            const userRole = await fetchUserRole(newSession.user.id);
            setRole(userRole);
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setSession(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      console.log('Initial session check:', existingSession?.user?.id);
      
      if (existingSession?.user) {
        setUser(existingSession.user);
        setSession(existingSession);
        const userRole = await fetchUserRole(existingSession.user.id);
        setRole(userRole);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextType = {
    user,
    session,
    role,
    loading,
    signOut,
    isAdmin: role === 'admin',
    isClinician: role === 'clinician' || role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
