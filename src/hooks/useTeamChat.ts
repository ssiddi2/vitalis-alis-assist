import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import type { TeamChannel, TeamMessage, ChannelMember, CreateChannelInput, SendMessageInput } from '@/types/team';

export function useTeamChat() {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const userId = user?.id ?? null;
  const hospitalId = selectedHospital?.id ?? null;
  /** Identity+facility scope. Any async result from a previous scope is discarded. */
  const contextKey = `${userId ?? 'anon'}::${hospitalId ?? 'none'}`;
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const isCurrent = (key: string) => contextRef.current === key;

  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<TeamChannel | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hard reset whenever the signed-in user or facility changes: no cross-tenant bleed.
  useEffect(() => {
    setChannels([]);
    setActiveChannel(null);
    setMessages([]);
    setMembers([]);
    setError(null);
    setLoading(false);
  }, [contextKey]);

  const fetchChannels = useCallback(async () => {
    if (!userId || !hospitalId) return;
    const key = contextKey;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_channels')
        .select('*')
        .eq('hospital_id', hospitalId)
        .order('updated_at', { ascending: false });
      if (!isCurrent(key)) return;
      if (error) throw error;
      setChannels((data || []).filter((c) => c.hospital_id === hospitalId));
    } catch (err) {
      if (!isCurrent(key)) return;
      console.error('Error fetching channels:', err);
      setError('Failed to load channels');
    } finally {
      if (isCurrent(key)) setLoading(false);
    }
  }, [userId, hospitalId, contextKey]);

  const fetchMessages = useCallback(async (channelId: string) => {
    const key = contextKey;
    try {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });
      if (!isCurrent(key)) return;
      if (error) throw error;

      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);
      if (!isCurrent(key)) return;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setMessages((data || []).map(m => ({
        ...m,
        read_by: Array.isArray(m.read_by) ? m.read_by as string[] : [],
        sender: profileMap.get(m.sender_id) ? {
          id: m.sender_id,
          full_name: profileMap.get(m.sender_id)?.full_name || null,
          avatar_url: profileMap.get(m.sender_id)?.avatar_url || null,
        } : undefined,
      })) as TeamMessage[]);
    } catch (err) {
      if (isCurrent(key)) console.error('Error fetching messages:', err);
    }
  }, [contextKey]);

  const fetchMembers = useCallback(async (channelId: string) => {
    const key = contextKey;
    try {
      const { data, error } = await supabase
        .from('channel_members')
        .select('*')
        .eq('channel_id', channelId);
      if (!isCurrent(key)) return;
      if (error) throw error;

      const userIds = (data || []).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      if (!isCurrent(key)) return;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setMembers((data || []).map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) ? {
          full_name: profileMap.get(m.user_id)?.full_name || null,
          avatar_url: profileMap.get(m.user_id)?.avatar_url || null,
        } : undefined,
      })) as ChannelMember[]);
    } catch (err) {
      if (isCurrent(key)) console.error('Error fetching members:', err);
    }
  }, [contextKey]);

  const createChannel = useCallback(async (input: CreateChannelInput) => {
    if (!userId || !hospitalId) return null;
    if (input.hospital_id && input.hospital_id !== hospitalId) {
      setError('Channel facility does not match the selected facility');
      return null;
    }
    const key = contextKey;
    try {
      const { data: channel, error: channelError } = await supabase
        .from('team_channels')
        .insert({ ...input, hospital_id: hospitalId, created_by: userId })
        .select()
        .single();
      if (channelError) throw channelError;

      await supabase.from('channel_members').insert({ channel_id: channel.id, user_id: userId });
      if (isCurrent(key)) setChannels(prev => [channel, ...prev]);
      return channel;
    } catch (err) {
      console.error('Error creating channel:', err);
      if (isCurrent(key)) setError('Failed to create channel');
      return null;
    }
  }, [userId, hospitalId, contextKey]);

  const sendMessage = useCallback(async (input: SendMessageInput) => {
    if (!userId || !hospitalId) return null;
    if (!activeChannel || activeChannel.id !== input.channel_id || activeChannel.hospital_id !== hospitalId) {
      setError('Message target does not match the selected facility');
      return null;
    }
    const key = contextKey;
    try {
      const { data, error } = await supabase
        .from('team_messages')
        .insert({ ...input, sender_id: userId, message_type: input.message_type || 'text' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      if (isCurrent(key)) setError('Failed to send message');
      return null;
    }
  }, [userId, hospitalId, activeChannel, contextKey]);

  const addMember = useCallback(async (channelId: string, userIdToAdd: string) => {
    if (!activeChannel || activeChannel.hospital_id !== hospitalId) return;
    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({ channel_id: channelId, user_id: userIdToAdd });
      if (error) throw error;
      await fetchMembers(channelId);
    } catch (err) {
      console.error('Error adding member:', err);
    }
  }, [fetchMembers, activeChannel, hospitalId]);

  const selectChannel = useCallback(async (channel: TeamChannel | null) => {
    setMessages([]);
    setMembers([]);
    if (!channel) {
      setActiveChannel(null);
      return;
    }
    if (!hospitalId || channel.hospital_id !== hospitalId) {
      setActiveChannel(null);
      setError('Channel belongs to another facility');
      return;
    }
    setActiveChannel(channel);
    await Promise.all([fetchMessages(channel.id), fetchMembers(channel.id)]);
  }, [fetchMessages, fetchMembers, hospitalId]);

  // Realtime: one subscription per (context, channel); torn down on any change.
  useEffect(() => {
    if (!activeChannel?.id || !hospitalId || activeChannel.hospital_id !== hospitalId) return;
    const key = contextKey;
    const channel = supabase
      .channel(`team-messages-${activeChannel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `channel_id=eq.${activeChannel.id}` },
        (payload) => {
          if (!isCurrent(key)) return;
          setMessages(prev => [...prev, payload.new as TeamMessage]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannel?.id, activeChannel?.hospital_id, hospitalId, contextKey]);

  useEffect(() => { void fetchChannels(); }, [fetchChannels]);

  return {
    channels,
    activeChannel,
    messages,
    members,
    loading,
    error,
    createChannel,
    sendMessage,
    selectChannel,
    addMember,
    refreshChannels: fetchChannels,
  };
}
