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

    // Realtime subscription for staged_orders
    const ordersChannel = supabase
      .channel(`staged-orders-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staged_orders',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const newOrder = payload.new as Record<string, unknown>;
          setStagedOrders((prev) => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            return [{
              ...newOrder,
              order_data: (typeof newOrder.order_data === 'object' ? newOrder.order_data : {}) as Record<string, unknown>,
            } as StagedOrder, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'staged_orders',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setStagedOrders((prev) =>
            prev.map(o => o.id === updated.id
              ? { ...o, ...updated, order_data: (typeof updated.order_data === 'object' ? updated.order_data : {}) as Record<string, unknown> } as StagedOrder
              : o
            )
          );
        }
      )
      .subscribe();

    // Realtime subscription for clinical_notes
    const notesChannel = supabase
      .channel(`clinical-notes-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clinical_notes',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const newNote = payload.new as Record<string, unknown>;
          setClinicalNotes((prev) => {
            if (prev.some(n => n.id === newNote.id)) return prev;
            return [{
              ...newNote,
              content: (typeof newNote.content === 'object' ? newNote.content : {}) as ClinicalNote['content'],
            } as ClinicalNote, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clinical_notes',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setClinicalNotes((prev) =>
            prev.map(n => n.id === updated.id
              ? { ...n, ...updated, content: (typeof updated.content === 'object' ? updated.content : {}) as ClinicalNote['content'] } as ClinicalNote
              : n
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(notesChannel);
    };
  }, [patientId]);

  return { clinicalNotes, insights, trends, stagedOrders, billingEvents, loading, setStagedOrders, setClinicalNotes };
}
