import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type {
  ConsultationThread,
  ConsultationMessage,
  AIIntelligenceLog,
  ConsultationNote,
} from '@/types/consultation';

const FUNC = 'consultation-ai';

export function useConsultationThread(threadId?: string) {
  const { user } = useAuth();
  const [thread, setThread] = useState<ConsultationThread | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [insights, setInsights] = useState<AIIntelligenceLog[]>([]);
  const [note, setNote] = useState<ConsultationNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch thread data
  const fetchThread = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [threadRes, msgsRes, insightsRes, noteRes] = await Promise.all([
        supabase.from('consultation_threads').select('*').eq('id', id).single(),
        supabase.from('consultation_messages').select('*').eq('thread_id', id).order('created_at'),
        supabase.from('ai_intelligence_log').select('*').eq('thread_id', id).order('created_at', { ascending: false }),
        supabase.from('consultation_notes').select('*').eq('thread_id', id).order('created_at', { ascending: false }).limit(1),
      ]);

      if (threadRes.data) setThread(threadRes.data as unknown as ConsultationThread);
      if (msgsRes.data) setMessages(msgsRes.data as unknown as ConsultationMessage[]);
      if (insightsRes.data) setInsights(insightsRes.data as unknown as AIIntelligenceLog[]);
      if (noteRes.data?.[0]) setNote(noteRes.data[0] as unknown as ConsultationNote);
    } catch (err) {
      console.error('Error fetching thread:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new thread
  const createThread = useCallback(async (params: {
    patientId: string;
    hospitalId: string;
    specialty: string;
    reason: string;
    consultRequestId?: string;
  }) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke(FUNC, {
        body: {
          action: 'create_thread',
          patientId: params.patientId,
          hospitalId: params.hospitalId,
          specialty: params.specialty,
          reason: params.reason,
          consultRequestId: params.consultRequestId,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;
      const created = res.data.thread as ConsultationThread;
      setThread(created);
      await fetchThread(created.id);
      toast.success('Consultation thread created');
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create thread';
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchThread]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!thread?.id || !content.trim()) return null;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke(FUNC, {
        body: { action: 'send_message', threadId: thread.id, content },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;

      // Refresh thread data
      await fetchThread(thread.id);
      return res.data.message;
    } catch (err) {
      toast.error('Failed to send message');
      return null;
    } finally {
      setSending(false);
    }
  }, [thread?.id, fetchThread]);

  // Generate consultation note
  const generateNote = useCallback(async () => {
    if (!thread?.id) return null;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke(FUNC, {
        body: { action: 'generate_note', threadId: thread.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;
      setNote(res.data.note as ConsultationNote);
      setThread(prev => prev ? { ...prev, status: 'completed' } : null);
      toast.success('Consultation note generated');
      return res.data.note;
    } catch (err) {
      toast.error('Failed to generate note');
      return null;
    } finally {
      setLoading(false);
    }
  }, [thread?.id]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!threadId) return;
    fetchThread(threadId);

    const channel = supabase
      .channel(`consultation-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'consultation_messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as unknown as ConsultationMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetchThread]);

  // Filter insights by role
  const myInsights = insights.filter(i => {
    if (!user?.id || !thread) return false;
    if (thread.primary_clinician_id === user.id) return i.target === 'primary_clinician' || i.target === 'shared';
    return i.target === 'specialist' || i.target === 'shared';
  });

  return {
    thread,
    messages,
    insights: myInsights,
    allInsights: insights,
    note,
    loading,
    sending,
    createThread,
    sendMessage,
    generateNote,
    fetchThread,
  };
}
