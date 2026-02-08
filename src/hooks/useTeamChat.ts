import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import type { TeamChannel, TeamMessage, ChannelMember, CreateChannelInput, SendMessageInput } from '@/types/team';

export function useTeamChat() {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const [channels, setChannels] = useState<TeamChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<TeamChannel | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch channels for current hospital
  const fetchChannels = useCallback(async () => {
    if (!selectedHospital?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_channels')
        .select('*')
        .eq('hospital_id', selectedHospital.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
      setError('Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [selectedHospital?.id]);

  // Fetch messages for active channel
  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch sender profiles separately
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const messagesWithSenders: TeamMessage[] = (data || []).map(m => ({
        ...m,
        read_by: Array.isArray(m.read_by) ? m.read_by as string[] : [],
        sender: profileMap.get(m.sender_id) ? {
          id: m.sender_id,
          full_name: profileMap.get(m.sender_id)?.full_name || null,
          avatar_url: profileMap.get(m.sender_id)?.avatar_url || null,
        } : undefined,
      }));
      
      setMessages(messagesWithSenders);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  // Fetch channel members
  const fetchMembers = useCallback(async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('channel_members')
        .select('*')
        .eq('channel_id', channelId);

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = (data || []).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const membersWithProfiles: ChannelMember[] = (data || []).map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) ? {
          full_name: profileMap.get(m.user_id)?.full_name || null,
          avatar_url: profileMap.get(m.user_id)?.avatar_url || null,
        } : undefined,
      }));
      
      setMembers(membersWithProfiles);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }, []);

  // Create a new channel
  const createChannel = useCallback(async (input: CreateChannelInput) => {
    if (!user?.id) return null;

    try {
      const { data: channel, error: channelError } = await supabase
        .from('team_channels')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (channelError) throw channelError;

      // Add creator as member
      await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
        });

      setChannels(prev => [channel, ...prev]);
      return channel;
    } catch (err) {
      console.error('Error creating channel:', err);
      setError('Failed to create channel');
      return null;
    }
  }, [user?.id]);

  // Send a message
  const sendMessage = useCallback(async (input: SendMessageInput) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('team_messages')
        .insert({
          ...input,
          sender_id: user.id,
          message_type: input.message_type || 'text',
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
  }, [user?.id]);

  // Add member to channel
  const addMember = useCallback(async (channelId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: userId,
        });

      if (error) throw error;
      await fetchMembers(channelId);
    } catch (err) {
      console.error('Error adding member:', err);
    }
  }, [fetchMembers]);

  // Select a channel
  const selectChannel = useCallback(async (channel: TeamChannel) => {
    setActiveChannel(channel);
    await Promise.all([
      fetchMessages(channel.id),
      fetchMembers(channel.id),
    ]);
  }, [fetchMessages, fetchMembers]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!activeChannel?.id) return;

    const channel = supabase
      .channel(`team-messages-${activeChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `channel_id=eq.${activeChannel.id}`,
        },
        (payload) => {
          const newMessage = payload.new as TeamMessage;
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel?.id]);

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

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
