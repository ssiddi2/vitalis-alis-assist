import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DBAppointment {
  id: string;
  patient_id: string;
  provider_id: string;
  hospital_id: string;
  encounter_type: string;
  visit_reason: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  encounter_id: string | null;
  recurring_rule: unknown;
  created_at: string;
  updated_at: string;
  // Joined
  patient?: { id: string; name: string; mrn: string; age: number; sex: string };
}

export function useAppointments(hospitalId: string | undefined, dateRange?: { start: Date; end: Date }) {
  const [appointments, setAppointments] = useState<DBAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchAppointments = useCallback(async () => {
    if (!hospitalId) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('appointments')
        .select('*, patient:patients(id, name, mrn, age, sex)')
        .eq('hospital_id', hospitalId)
        .order('start_time', { ascending: true });

      if (dateRange) {
        query = query
          .gte('start_time', dateRange.start.toISOString())
          .lte('start_time', dateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setAppointments((data as DBAppointment[]) || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Realtime subscription
  useEffect(() => {
    if (!hospitalId) return;

    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `hospital_id=eq.${hospitalId}` },
        () => fetchAppointments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hospitalId, fetchAppointments]);

  const createAppointment = async (appointment: {
    patient_id: string;
    hospital_id: string;
    encounter_type: 'office_visit' | 'telehealth' | 'follow_up' | 'annual_physical' | 'urgent' | 'procedure';
    visit_reason?: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    notes?: string;
  }) => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('appointments')
      .insert([{ ...appointment, provider_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateAppointmentStatus = async (appointmentId: string, status: 'scheduled' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show') => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId);

    if (error) throw error;
  };

  return { appointments, loading, createAppointment, updateAppointmentStatus, refetch: fetchAppointments };
}
