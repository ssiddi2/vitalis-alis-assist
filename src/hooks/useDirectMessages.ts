import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import type { DirectConversation, DirectMessage, CreateDirectMessageInput } from '@/types/team';

export function useDirectMessages() {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all conversations for current user
  const fetchConversations = useCallback(async () => {
    if (!user?.id || !selectedHospital?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('hospital_id', selectedHospital.id)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedHospital?.id]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch sender profiles separately
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const messagesWithSenders: DirectMessage[] = (data || []).map(m => ({
        ...m,
        sender: profileMap.get(m.sender_id) ? {
          id: m.sender_id,
          full_name: profileMap.get(m.sender_id)?.full_name || null,
          avatar_url: profileMap.get(m.sender_id)?.avatar_url || null,
        } : undefined,
      }));
      
      setMessages(messagesWithSenders);

      // Mark messages as read
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user?.id);

    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [user?.id]);

  // Start or get existing conversation
  const startConversation = useCallback(async (recipientId: string, patientId?: string) => {
    if (!user?.id || !selectedHospital?.id) return null;

    try {
      // Check if conversation exists
      const { data: existing } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('hospital_id', selectedHospital.id)
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipientId}),and(participant_1.eq.${recipientId},participant_2.eq.${user.id})`)
        .single();

      if (existing) {
        setActiveConversation(existing);
        await fetchMessages(existing.id);
        return existing;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('direct_conversations')
        .insert({
          participant_1: user.id,
          participant_2: recipientId,
          hospital_id: selectedHospital.id,
          patient_id: patientId,
        })
        .select()
        .single();

      if (error) throw error;

      setConversations(prev => [newConv, ...prev]);
      setActiveConversation(newConv);
      setMessages([]);
      return newConv;
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Failed to start conversation');
      return null;
    }
  }, [user?.id, selectedHospital?.id, fetchMessages]);

  // Send a direct message
  const sendMessage = useCallback(async (content: string) => {
    if (!user?.id || !activeConversation?.id) return null;

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return null;
    }
  }, [user?.id, activeConversation?.id]);

  // Select a conversation
  const selectConversation = useCallback(async (conversation: DirectConversation) => {
    setActiveConversation(conversation);
    await fetchMessages(conversation.id);
  }, [fetchMessages]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!activeConversation?.id) return;

    const channel = supabase
      .channel(`dm-${activeConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as DirectMessage;
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    activeConversation,
    messages,
    loading,
    error,
    startConversation,
    sendMessage,
    selectConversation,
    refreshConversations: fetchConversations,
  };
}
