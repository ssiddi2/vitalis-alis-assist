import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { toast } from 'sonner';

const TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-conversation-token`;

interface UseALISVoiceOptions {
  agentId: string;
  patientContext?: string;
  onTranscript?: (role: 'user' | 'agent', text: string) => void;
}

export function useALISVoice({ agentId, patientContext, onTranscript }: UseALISVoiceOptions) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      setVoiceEnabled(true);
      setIsConnecting(false);
    },
    onDisconnect: () => {
      setVoiceEnabled(false);
    },
    onMessage: (message) => {
      if (message.type === 'user_transcript' && onTranscript) {
        onTranscript('user', (message as any).user_transcription_event?.user_transcript ?? '');
      }
      if (message.type === 'agent_response' && onTranscript) {
        onTranscript('agent', (message as any).agent_response_event?.agent_response ?? '');
      }
    },
    onError: (error) => {
      console.error('ALIS Voice error:', error);
      toast.error('Voice connection error. Please try again.');
      setVoiceEnabled(false);
      setIsConnecting(false);
    },
  });

  const startVoice = useCallback(async () => {
    if (!agentId) {
      toast.error('No Agent ID configured. Please set your ElevenLabs Agent ID.');
      return;
    }
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ agent_id: agentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Token request failed: ${res.status}`);
      }

      const { token } = await res.json();
      if (!token) throw new Error('No token received');

      await conversation.startSession({
        conversationToken: token,
        connectionType: 'webrtc',
        ...(patientContext
          ? {
              overrides: {
                agent: {
                  prompt: {
                    prompt: patientContext,
                  },
                },
              },
            }
          : {}),
      } as any);
    } catch (err) {
      console.error('Failed to start voice:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start voice';
      toast.error(msg);
      setIsConnecting(false);
    }
  }, [agentId, patientContext, conversation]);

  const stopVoice = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return {
    voiceEnabled,
    isConnecting,
    isSpeaking: conversation.isSpeaking,
    status: conversation.status,
    startVoice,
    stopVoice,
  };
}
