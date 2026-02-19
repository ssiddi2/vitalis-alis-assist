import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DBEncounter {
  id: string;
  patient_id: string;
  provider_id: string;
  hospital_id: string;
  encounter_type: string;
  visit_reason: string | null;
  chief_complaint: string | null;
  scheduled_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  duration_minutes: number | null;
  room_number: string | null;
  billing_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useEncounters(hospitalId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const createEncounter = async (data: {
    patient_id: string;
    hospital_id: string;
    encounter_type: 'office_visit' | 'telehealth' | 'follow_up' | 'annual_physical' | 'urgent' | 'procedure';
    visit_reason?: string;
    chief_complaint?: string;
    scheduled_at?: string;
    room_number?: string;
  }): Promise<DBEncounter> => {
    if (!user) throw new Error('Not authenticated');

    setLoading(true);
    try {
      const { data: encounter, error } = await supabase
        .from('encounters')
        .insert([{
          ...data,
          provider_id: user.id,
          status: 'scheduled' as const,
        }])
        .select()
        .single();

      if (error) throw error;
      return encounter as DBEncounter;
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async (encounterId: string) => {
    const { error } = await supabase
      .from('encounters')
      .update({ status: 'checked_in', check_in_at: new Date().toISOString() })
      .eq('id', encounterId);
    if (error) throw error;
  };

  const startEncounter = async (encounterId: string) => {
    const { error } = await supabase
      .from('encounters')
      .update({ status: 'in_progress' })
      .eq('id', encounterId);
    if (error) throw error;
  };

  const completeEncounter = async (encounterId: string) => {
    const { error } = await supabase
      .from('encounters')
      .update({ status: 'completed', check_out_at: new Date().toISOString() })
      .eq('id', encounterId);
    if (error) throw error;
  };

  return { createEncounter, checkIn, startEncounter, completeEncounter, loading };
}
