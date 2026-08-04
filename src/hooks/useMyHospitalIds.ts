import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hospital ids the signed-in user is an explicit member of (public.hospital_users).
 * Cross-facility views MUST filter on this set — never query hospitals the user
 * has no membership row for. RLS is the second line of defence.
 */
export function useMyHospitalIds() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIds([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('hospital_users')
        .select('hospital_id')
        .eq('user_id', user.id);
      if (!active) return;
      setIds((data || []).map(r => r.hospital_id).filter(Boolean));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  return { hospitalIds: ids, loading };
}
