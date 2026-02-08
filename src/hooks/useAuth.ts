import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'clinician' | 'viewer';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });

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
      async (event, session) => {
        if (session?.user) {
          const role = await fetchUserRole(session.user.id);
          setState({
            user: session.user,
            session,
            role,
            loading: false,
          });
        } else {
          setState({
            user: null,
            session: null,
            role: null,
            loading: false,
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        setState({
          user: session.user,
          session,
          role,
          loading: false,
        });
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  const signOut = useCallback(async () => {
    // Note: Audit logging for logout is handled by the component calling signOut
    // to avoid circular dependency with useAuditLog
    await supabase.auth.signOut();
  }, []);

  return {
    ...state,
    signOut,
    isAdmin: state.role === 'admin',
    isClinician: state.role === 'clinician' || state.role === 'admin',
  };
}
