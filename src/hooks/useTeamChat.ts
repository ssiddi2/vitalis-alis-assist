import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import type { TeamChannel, TeamMessage, ChannelMember, CreateChannelInput, SendMessageInput } from '@/types/team';

interface ChatState {
  /** Context generation the data belongs to. */
  ctxGen: number;
  /** Selection generation the conversation belongs to. */
  selGen: number;
  channels: TeamChannel[];
  activeChannel: TeamChannel | null;
  messages: TeamMessage[];
  members: ChannelMember[];
  loading: boolean;
  error: string | null;
}

const EMPTY = {
  channels: [] as TeamChannel[],
  activeChannel: null as TeamChannel | null,
  messages: [] as TeamMessage[],
  members: [] as ChannelMember[],
  loading: false,
  error: null as string | null,
};

/**
 * Team chat scoped to (authenticated user, selected facility, selected channel).
 *
 * Isolation is enforced with monotonically increasing generations rather than
 * comparable scope strings, so an A -> B -> A switch never accepts a response
 * issued during the first A. Nothing from a superseded generation is ever
 * exposed: the render itself filters by generation, so no transition render can
 * leak the previous facility's or channel's data.
 */
export function useTeamChat() {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const userId = user?.id ?? null;
  const hospitalId = selectedHospital?.id ?? null;

  // Context generation bumps on every user/facility change, during render.
  const ctxGenRef = useRef(0);
  const lastScopeRef = useRef<string | null>(null);
  const scope = `${userId ?? 'anon'}::${hospitalId ?? 'none'}`;
  if (lastScopeRef.current !== scope) {
    lastScopeRef.current = scope;
    ctxGenRef.current += 1;
  }
  const ctxGen = ctxGenRef.current;

  const selGenRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const [state, setState] = useState<ChatState>({ ctxGen, selGen: 0, ...EMPTY });

  /** True only while the issuing generation(s) are still current and mounted. */
  const valid = (gen: number, sel?: number) =>
    aliveRef.current && gen === ctxGenRef.current && (sel === undefined || sel === selGenRef.current);

  const activeChannelRef = useRef<TeamChannel | null>(null);

  // Discard superseded data at render time — never expose a previous context.
  const currentCtx = state.ctxGen === ctxGen;
  const currentSel = currentCtx && state.selGen === selGenRef.current;
  const view = {
    channels: currentCtx ? state.channels : EMPTY.channels,
    activeChannel: currentSel ? state.activeChannel : EMPTY.activeChannel,
    messages: currentSel ? state.messages : EMPTY.messages,
    members: currentSel ? state.members : EMPTY.members,
    loading: currentCtx ? state.loading : false,
    error: currentCtx ? state.error : null,
  };
  activeChannelRef.current = view.activeChannel;

  // Settle the store into the new generation (the render above already hid the old data).
  useEffect(() => {
    selGenRef.current += 1;
    setState({ ctxGen: ctxGenRef.current, selGen: selGenRef.current, ...EMPTY });
  }, [ctxGen]);

  const fetchChannels = useCallback(async () => {
    if (!userId || !hospitalId) return;
    const gen = ctxGen;
    if (!valid(gen)) return;
    setState((s) => (s.ctxGen === gen ? { ...s, loading: true } : s));
    try {
      const { data, error } = await supabase
        .from('team_channels')
        .select('*')
        .eq('hospital_id', hospitalId)
        .order('updated_at', { ascending: false });
      if (!valid(gen)) return;
      if (error) throw error;
      const rows = (data || []).filter((c) => c.hospital_id === hospitalId);
      setState((s) => (s.ctxGen === gen ? { ...s, channels: rows, loading: false } : s));
    } catch (err) {
      console.error('Error fetching channels:', err);
      if (!valid(gen)) return;
      setState((s) => (s.ctxGen === gen ? { ...s, error: 'Failed to load channels', loading: false } : s));
    }
  }, [userId, hospitalId, ctxGen]);

  const fetchConversation = useCallback(async (channelId: string, gen: number, sel: number) => {
    const accept = (patch: Partial<ChatState>) =>
      setState((s) => (s.ctxGen === gen && s.selGen === sel ? { ...s, ...patch } : s));
    try {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });
      if (!valid(gen, sel)) return;
      if (error) throw error;

      const senderIds = [...new Set((data || []).map((m) => m.sender_id))];
      const { data: senderProfiles } = await supabase
        .from('profiles').select('user_id, full_name, avatar_url').in('user_id', senderIds);
      if (!valid(gen, sel)) return;
      const senderMap = new Map(senderProfiles?.map((p) => [p.user_id, p]) || []);

      accept({
        messages: (data || []).map((m) => ({
          ...m,
          read_by: Array.isArray(m.read_by) ? (m.read_by as string[]) : [],
          sender: senderMap.get(m.sender_id)
            ? {
                id: m.sender_id,
                full_name: senderMap.get(m.sender_id)?.full_name || null,
                avatar_url: senderMap.get(m.sender_id)?.avatar_url || null,
              }
            : undefined,
        })) as TeamMessage[],
      });

      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members').select('*').eq('channel_id', channelId);
      if (!valid(gen, sel)) return;
      if (memberError) throw memberError;

      const { data: memberProfiles } = await supabase
        .from('profiles').select('user_id, full_name, avatar_url')
        .in('user_id', (memberRows || []).map((m) => m.user_id));
      if (!valid(gen, sel)) return;
      const memberMap = new Map(memberProfiles?.map((p) => [p.user_id, p]) || []);

      accept({
        members: (memberRows || []).map((m) => ({
          ...m,
          profile: memberMap.get(m.user_id)
            ? {
                full_name: memberMap.get(m.user_id)?.full_name || null,
                avatar_url: memberMap.get(m.user_id)?.avatar_url || null,
              }
            : undefined,
        })) as ChannelMember[],
      });
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  }, []);

  const selectChannel = useCallback(async (channel: TeamChannel | null) => {
    const gen = ctxGen;
    if (!valid(gen)) return;
    const sel = ++selGenRef.current;

    if (!channel) {
      setState((s) => (s.ctxGen === gen ? { ...s, selGen: sel, activeChannel: null, messages: [], members: [] } : s));
      return;
    }
    if (!hospitalId || channel.hospital_id !== hospitalId) {
      setState((s) =>
        s.ctxGen === gen
          ? { ...s, selGen: sel, activeChannel: null, messages: [], members: [], error: 'Channel belongs to another facility' }
          : s,
      );
      return;
    }
    setState((s) =>
      s.ctxGen === gen ? { ...s, selGen: sel, activeChannel: channel, messages: [], members: [], error: null } : s,
    );
    await fetchConversation(channel.id, gen, sel);
  }, [ctxGen, hospitalId, fetchConversation]);

  const createChannel = useCallback(async (input: CreateChannelInput) => {
    const gen = ctxGen;
    // A retained callback from a superseded context must not write anything.
    if (!valid(gen) || !userId || !hospitalId) return null;
    if (input.hospital_id && input.hospital_id !== hospitalId) {
      setState((s) => (s.ctxGen === gen ? { ...s, error: 'Channel facility does not match the selected facility' } : s));
      return null;
    }
    try {
      const { data: channel, error } = await supabase
        .from('team_channels')
        .insert({ ...input, hospital_id: hospitalId, created_by: userId })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('channel_members').insert({ channel_id: channel.id, user_id: userId });
      // The insert result must never steer a context that moved on.
      if (!valid(gen)) return null;
      setState((s) => (s.ctxGen === gen ? { ...s, channels: [channel, ...s.channels] } : s));
      return channel;
    } catch (err) {
      console.error('Error creating channel:', err);
      if (valid(gen)) setState((s) => (s.ctxGen === gen ? { ...s, error: 'Failed to create channel' } : s));
      return null;
    }
  }, [ctxGen, userId, hospitalId]);

  const sendMessage = useCallback(async (input: SendMessageInput) => {
    const gen = ctxGen;
    if (!valid(gen) || !userId || !hospitalId) return null;
    const active = activeChannelRef.current;
    if (!active || active.id !== input.channel_id || active.hospital_id !== hospitalId) {
      setState((s) => (s.ctxGen === gen ? { ...s, error: 'Message target does not match the selected facility' } : s));
      return null;
    }
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
      if (valid(gen)) setState((s) => (s.ctxGen === gen ? { ...s, error: 'Failed to send message' } : s));
      return null;
    }
  }, [ctxGen, userId, hospitalId]);

  const addMember = useCallback(async (channelId: string, userIdToAdd: string) => {
    const gen = ctxGen;
    const sel = selGenRef.current;
    const active = activeChannelRef.current;
    if (!valid(gen, sel) || !userId || !hospitalId) return;
    if (!active || active.id !== channelId || active.hospital_id !== hospitalId) return;
    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({ channel_id: channelId, user_id: userIdToAdd });
      if (error) throw error;
      if (!valid(gen, sel)) return;
      await fetchConversation(channelId, gen, sel);
    } catch (err) {
      console.error('Error adding member:', err);
    }
  }, [ctxGen, userId, hospitalId, fetchConversation]);

  // Realtime is bound to the context AND selection generation.
  const activeId = view.activeChannel?.id;
  const activeHospital = view.activeChannel?.hospital_id;
  useEffect(() => {
    if (!activeId || !hospitalId || activeHospital !== hospitalId) return;
    const gen = ctxGenRef.current;
    const sel = selGenRef.current;
    const rt = supabase
      .channel(`team-messages-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `channel_id=eq.${activeId}` },
        (payload) => {
          if (!valid(gen, sel)) return;
          const row = payload.new as TeamMessage;
          if (row.channel_id !== activeId) return;
          setState((s) => (s.ctxGen === gen && s.selGen === sel ? { ...s, messages: [...s.messages, row] } : s));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(rt); };
  }, [activeId, activeHospital, hospitalId, ctxGen]);

  useEffect(() => { void fetchChannels(); }, [fetchChannels]);

  return {
    ...view,
    createChannel,
    sendMessage,
    selectChannel,
    addMember,
    refreshChannels: fetchChannels,
  };
}
