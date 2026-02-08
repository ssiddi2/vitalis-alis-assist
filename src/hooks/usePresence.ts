import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  online_at: string;
}

export function usePresence() {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Track presence for the current user
  const trackPresence = useCallback(async () => {
    if (!user?.id || !selectedHospital?.id) return;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', user.id)
      .single();

    const presenceChannel = supabase.channel(`presence-${selectedHospital.id}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: PresenceState[] = [];
        
        for (const [userId, presences] of Object.entries(state)) {
          const presence = (presences as any[])[0];
          if (presence && userId !== user.id) {
            users.push({
              id: presence.presence_ref,
              user_id: userId,
              full_name: presence.full_name,
              avatar_url: presence.avatar_url,
              online_at: presence.online_at,
            });
          }
        }
        
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            full_name: profile?.full_name || 'Unknown',
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user?.id, selectedHospital?.id]);

  // Check if a specific user is online
  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.some(u => u.user_id === userId);
  }, [onlineUsers]);

  // Start tracking on mount
  useEffect(() => {
    const cleanup = trackPresence();
    return () => {
      cleanup?.then(fn => fn?.());
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [trackPresence]);

  return {
    onlineUsers,
    isUserOnline,
    onlineCount: onlineUsers.length,
  };
}
