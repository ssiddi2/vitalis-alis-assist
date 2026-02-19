import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActiveEncounter {
  id: string;
  encounter_type: string;
  visit_reason: string | null;
  chief_complaint: string | null;
  check_in_at: string | null;
  status: string;
  room_number: string | null;
}

export function useActiveEncounter(encounterId: string | null) {
  const [encounter, setEncounter] = useState<ActiveEncounter | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!encounterId) {
      setEncounter(null);
      setElapsedMinutes(0);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('encounters')
      .select('id, encounter_type, visit_reason, chief_complaint, check_in_at, status, room_number')
      .eq('id', encounterId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setEncounter(null);
          setLoading(false);
          return;
        }
        setEncounter(data as ActiveEncounter);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [encounterId]);

  // Live timer based on check_in_at
  useEffect(() => {
    if (!encounter?.check_in_at) {
      setElapsedMinutes(0);
      return;
    }

    const compute = () => {
      const diff = Date.now() - new Date(encounter.check_in_at!).getTime();
      setElapsedMinutes(Math.max(0, Math.floor(diff / 60000)));
    };

    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [encounter?.check_in_at]);

  const formattedDuration = elapsedMinutes >= 60
    ? `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`
    : `${elapsedMinutes}m`;

  return { encounter, elapsedMinutes, formattedDuration, loading };
}
