import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StagedOrder } from '@/types/hospital';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UseStagedOrdersOptions {
  patientId: string;
  useDemoData?: boolean;
  demoOrders?: StagedOrder[];
}

export function useStagedOrders({ patientId, useDemoData = true, demoOrders = [] }: UseStagedOrdersOptions) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<StagedOrder[]>(useDemoData ? demoOrders : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders from database
  const fetchOrders = useCallback(async () => {
    if (useDemoData || !patientId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staged_orders')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map database records to StagedOrder type
      const mappedOrders: StagedOrder[] = (data || []).map(order => ({
        id: order.id,
        conversation_id: order.conversation_id,
        patient_id: order.patient_id,
        order_type: order.order_type,
        order_data: order.order_data as Record<string, unknown>,
        rationale: order.rationale,
        status: order.status,
        created_by: order.created_by,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }));
      
      setOrders(mappedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [patientId, useDemoData]);

  // Stage a new order
  const stageOrder = useCallback(async (order: Omit<StagedOrder, 'id' | 'created_at' | 'updated_at'>) => {
    if (useDemoData) {
      // Demo mode - just add to local state
      const newOrder: StagedOrder = {
        ...order,
        id: `staged-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setOrders(prev => [newOrder, ...prev]);
      toast.success('Order staged for approval');
      return newOrder;
    }

    try {
      const { data, error } = await supabase
        .from('staged_orders')
        .insert({
          patient_id: order.patient_id,
          order_type: order.order_type,
          order_data: order.order_data as unknown as undefined,
          rationale: order.rationale ?? null,
          status: 'staged',
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newOrder: StagedOrder = {
        id: data.id,
        conversation_id: data.conversation_id,
        patient_id: data.patient_id,
        order_type: data.order_type,
        order_data: data.order_data as Record<string, unknown>,
        rationale: data.rationale,
        status: data.status,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      
      setOrders(prev => [newOrder, ...prev]);
      toast.success('Order staged for approval');
      return newOrder;
    } catch (err) {
      console.error('Error staging order:', err);
      toast.error('Failed to stage order');
      return null;
    }
  }, [useDemoData, user?.id]);

  // Approve an order
  const approveOrder = useCallback(async (orderId: string) => {
    if (useDemoData) {
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: 'approved' as const } : order
      ));
      toast.success('Order approved');
      return;
    }

    try {
      const { error } = await supabase
        .from('staged_orders')
        .update({ status: 'approved' })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: 'approved' as const } : order
      ));
      toast.success('Order approved');
    } catch (err) {
      console.error('Error approving order:', err);
      toast.error('Failed to approve order');
    }
  }, [useDemoData]);

  // Approve all pending orders
  const approveAllOrders = useCallback(async () => {
    const pendingIds = orders.filter(o => o.status === 'staged').map(o => o.id);
    
    if (useDemoData) {
      setOrders(prev => prev.map(order => ({ ...order, status: 'approved' as const })));
      toast.success(`${pendingIds.length} orders approved`);
      return;
    }

    try {
      const { error } = await supabase
        .from('staged_orders')
        .update({ status: 'approved' })
        .in('id', pendingIds);

      if (error) throw error;
      
      setOrders(prev => prev.map(order => ({ ...order, status: 'approved' as const })));
      toast.success(`${pendingIds.length} orders approved`);
    } catch (err) {
      console.error('Error approving orders:', err);
      toast.error('Failed to approve orders');
    }
  }, [orders, useDemoData]);

  // Cancel an order
  const cancelOrder = useCallback(async (orderId: string) => {
    if (useDemoData) {
      setOrders(prev => prev.filter(order => order.id !== orderId));
      toast.success('Order cancelled');
      return;
    }

    try {
      const { error } = await supabase
        .from('staged_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(prev => prev.filter(order => order.id !== orderId));
      toast.success('Order cancelled');
    } catch (err) {
      console.error('Error cancelling order:', err);
      toast.error('Failed to cancel order');
    }
  }, [useDemoData]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (useDemoData || !patientId) return;

    const channel = supabase
      .channel(`staged-orders-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staged_orders',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as StagedOrder;
            setOrders(prev => {
              // Avoid duplicates
              if (prev.some(o => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as StagedOrder;
            setOrders(prev => prev.map(o => 
              o.id === updatedOrder.id ? updatedOrder : o
            ));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setOrders(prev => prev.filter(o => o.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, useDemoData]);

  // Fetch on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    stageOrder,
    approveOrder,
    approveAllOrders,
    cancelOrder,
    refreshOrders: fetchOrders,
  };
}
