import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { useAcuity } from '@/hooks/useAcuity';
import type { ConsultRequest, CreateConsultInput, ConsultStatus } from '@/types/team';


export function useConsultRequests(patientId?: string) {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const { scoreMessage } = useAcuity();
  const [consults, setConsults] = useState<ConsultRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch consult requests
  const fetchConsults = useCallback(async () => {
    if (!selectedHospital?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('consult_requests')
        .select(`
          *,
          patient:patients(name, mrn),
          consultant:consultants(name, specialty)
        `)
        .eq('hospital_id', selectedHospital.id)
        .order('created_at', { ascending: false });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConsults(data || []);
    } catch (err) {
      console.error('Error fetching consults:', err);
      setError('Failed to load consult requests');
    } finally {
      setLoading(false);
    }
  }, [selectedHospital?.id, patientId]);

  // Score a consult once and mirror the result onto its notification row (no extra LLM call).
  const scoreConsult = useCallback(async (consult: ConsultRequest) => {
    if (!user?.id) return;
    try {
      const result = await scoreMessage({
        hospitalId: consult.hospital_id,
        messageText: consult.reason || `${consult.specialty} consult`,
        patientId: consult.patient_id ?? null,
        sourceTable: 'consult_requests',
        sourceId: consult.id,
      });
      if (!result) return;

      const { data: notif } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          hospital_id: consult.hospital_id,
          patient_id: consult.patient_id ?? null,
          type: 'consult_response',
          title: `${consult.specialty} consult requested`,
          body: consult.reason,
          metadata: { consult_id: consult.id },
        })
        .select('id')
        .single();

      if (!notif?.id) return;

      const r = result as unknown as Record<string, unknown>;
      await supabase.from('acuity_scores').insert({
        hospital_id: consult.hospital_id,
        patient_id: consult.patient_id ?? null,
        source_table: 'notifications',
        source_id: notif.id,
        message_text: consult.reason,
        classification: r.classification as string ?? null,
        acuity_level: result.suggestedUrgency,
        score: result.score,
        color: result.color,
        rationale: result.reasoning,
        recommendation: result.recommendation ?? null,
        confidence: result.confidence,
        service_category: result.serviceCategory,
        hospital_priority: result.hospitalPriority,
        risk_level: result.riskLevel,
        estimated_response_time: result.estimatedResponseTime,
        extracted_keywords: result.extractedKeywords,
        immediate_actions: result.immediateActions,
        suggested_specialty: result.suggestedSpecialty,
        suggested_specialties: result.suggestedSpecialties,
        created_by: user.id,
      });
    } catch (err) {
      console.warn('Acuity scoring skipped:', err);
    }
  }, [user?.id, scoreMessage]);

  // Create a new consult request
  const createConsult = useCallback(async (input: CreateConsultInput) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('consult_requests')
        .insert({
          ...input,
          requesting_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setConsults(prev => [data, ...prev]);
      void scoreConsult(data as ConsultRequest);
      return data;
    } catch (err) {
      console.error('Error creating consult:', err);
      setError('Failed to create consult request');
      return null;
    }
  }, [user?.id, scoreConsult]);


  // Accept a consult (for consultants)
  const acceptConsult = useCallback(async (consultId: string, consultantId: string) => {
    try {
      const { data, error } = await supabase
        .from('consult_requests')
        .update({
          status: 'accepted' as ConsultStatus,
          consultant_id: consultantId,
          response_time_minutes: calculateResponseTime(consultId),
        })
        .eq('id', consultId)
        .select()
        .single();

      if (error) throw error;

      setConsults(prev => prev.map(c => c.id === consultId ? data : c));
      return data;
    } catch (err) {
      console.error('Error accepting consult:', err);
      setError('Failed to accept consult');
      return null;
    }
  }, []);

  // Complete a consult
  const completeConsult = useCallback(async (consultId: string) => {
    try {
      const { data, error } = await supabase
        .from('consult_requests')
        .update({ status: 'completed' as ConsultStatus })
        .eq('id', consultId)
        .select()
        .single();

      if (error) throw error;

      setConsults(prev => prev.map(c => c.id === consultId ? data : c));
      return data;
    } catch (err) {
      console.error('Error completing consult:', err);
      setError('Failed to complete consult');
      return null;
    }
  }, []);

  // Cancel a consult
  const cancelConsult = useCallback(async (consultId: string) => {
    try {
      const { data, error } = await supabase
        .from('consult_requests')
        .update({ status: 'cancelled' as ConsultStatus })
        .eq('id', consultId)
        .select()
        .single();

      if (error) throw error;

      setConsults(prev => prev.map(c => c.id === consultId ? data : c));
      return data;
    } catch (err) {
      console.error('Error cancelling consult:', err);
      setError('Failed to cancel consult');
      return null;
    }
  }, []);

  // Helper to calculate response time
  const calculateResponseTime = (consultId: string): number => {
    const consult = consults.find(c => c.id === consultId);
    if (!consult) return 0;
    
    const created = new Date(consult.created_at);
    const now = new Date();
    return Math.round((now.getTime() - created.getTime()) / 60000);
  };

  // Fetch on mount
  useEffect(() => {
    fetchConsults();
  }, [fetchConsults]);

  return {
    consults,
    loading,
    error,
    createConsult,
    acceptConsult,
    completeConsult,
    cancelConsult,
    refreshConsults: fetchConsults,
  };
}
