import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UseALISVoiceOptions {
  patientContext?: string;
  onTranscript?: (role: 'user' | 'agent', text: string) => void;
}

export function useALISVoice({ patientContext, onTranscript }: UseALISVoiceOptions) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => { setVoiceEnabled(true); setIsConnecting(false); },
    onDisconnect: () => setVoiceEnabled(false),
    onMessage: (msg: any) => {
      if (!onTranscript) return;
      if (msg?.type === 'user_transcript') onTranscript('user', msg.user_transcription_event?.user_transcript ?? '');
      if (msg?.type === 'agent_response') onTranscript('agent', msg.agent_response_event?.agent_response ?? '');
    },
    onError: (error) => {
      console.error('ALIS Voice error:', error);
      toast.error('Voice connection error. Please try again.');
      setVoiceEnabled(false);
      setIsConnecting(false);
    },
  });

  const startVoice = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token');
      if (error || !data?.token) throw new Error(error?.message || data?.error || 'No token received');

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: 'webrtc',
        ...(patientContext ? { overrides: { agent: { prompt: { prompt: patientContext } } } } : {}),
      } as any);
    } catch (err) {
      console.error('Failed to start voice:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to start voice');
      setIsConnecting(false);
    }
  }, [patientContext, conversation]);

  const stopVoice = useCallback(async () => { await conversation.endSession(); }, [conversation]);

  return { voiceEnabled, isConnecting, isSpeaking: conversation.isSpeaking, startVoice, stopVoice };
}
