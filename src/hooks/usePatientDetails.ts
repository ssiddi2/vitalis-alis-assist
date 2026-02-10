import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClinicalInsight, ClinicalTrend } from '@/types/clinical';
import { ClinicalNote, StagedOrder, BillingEvent } from '@/types/hospital';

export function usePatientDetails(patientId: string | undefined) {
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [insights, setInsights] = useState<ClinicalInsight[]>([]);
  const [trends, setTrends] = useState<ClinicalTrend[]>([]);
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>([]);
  const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) {
      setClinicalNotes([]);
      setInsights([]);
      setTrends([]);
      setStagedOrders([]);
      setBillingEvents([]);
      setLoading(false);
      return;
    }

    async function fetchDetails() {
      setLoading(true);
      try {
        const [notesRes, vitalsRes, ordersRes, billingRes] = await Promise.all([
          supabase
            .from('clinical_notes')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          supabase
            .from('patient_vitals')
            .select('*')
            .eq('patient_id', patientId)
            .maybeSingle(),
          supabase
            .from('staged_orders')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          supabase
            .from('billing_events')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
        ]);

        if (notesRes.data) {
          setClinicalNotes(notesRes.data.map(n => ({
            ...n,
            content: (typeof n.content === 'object' ? n.content : {}) as ClinicalNote['content'],
          })));
        }

        if (vitalsRes.data) {
          setInsights((vitalsRes.data.insights as unknown as ClinicalInsight[]) || []);
          setTrends((vitalsRes.data.trends as unknown as ClinicalTrend[]) || []);
        } else {
          setInsights([]);
          setTrends([]);
        }

        if (ordersRes.data) {
          setStagedOrders(ordersRes.data.map(o => ({
            ...o,
            order_data: (typeof o.order_data === 'object' ? o.order_data : {}) as Record<string, unknown>,
          })));
        }

        if (billingRes.data) {
          setBillingEvents(billingRes.data as unknown as BillingEvent[]);
        }
      } catch (err) {
        console.error('Error fetching patient details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [patientId]);

  return { clinicalNotes, insights, trends, stagedOrders, billingEvents, loading, setStagedOrders, setClinicalNotes };
}
