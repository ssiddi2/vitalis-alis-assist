import { useState, useCallback } from 'react';
import { ChatMessage } from '@/types/clinical';
import { toast } from 'sonner';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alis-chat`;

interface ToolCallResult {
  tool_name: string;
  tool_args: Record<string, unknown>;
  result: { success: boolean; message?: string; order?: Record<string, unknown> };
}

interface UseALISChatOptions {
  patientContext?: Record<string, unknown>;
  onToolCall?: (toolName: string, args: Record<string, unknown>, result: unknown) => void;
}

let messageIdCounter = 0;
const generateId = () => `ai-msg-${++messageIdCounter}`;

export function useALISChat(options: UseALISChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role === 'alis' ? 'assistant' : m.role,
            content: m.content,
          })),
          patientContext: options.patientContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';
      let assistantMessageId = '';
      let currentEventType = 'message'; // track SSE event type

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          
          // Track event type from SSE
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          
          if (line.startsWith(':') || line.trim() === '') {
            // Reset event type on empty line (end of SSE block)
            if (line.trim() === '') currentEventType = 'message';
            continue;
          }
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          // Handle tool_result events
          if (currentEventType === 'tool_result') {
            try {
              const toolResult: ToolCallResult = JSON.parse(jsonStr);
              if (options.onToolCall) {
                options.onToolCall(toolResult.tool_name, toolResult.tool_args, toolResult.result);
              }
            } catch (e) {
              console.error('Error parsing tool result:', e);
            }
            currentEventType = 'message';
            continue;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];
            
            const deltaContent = choice?.delta?.content;
            if (deltaContent) {
              assistantContent += deltaContent;

              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.role === 'alis' && lastMsg.id === assistantMessageId) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                assistantMessageId = generateId();
                return [
                  ...prev,
                  {
                    id: assistantMessageId,
                    role: 'alis',
                    content: assistantContent,
                    timestamp,
                  },
                ];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('ALIS chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
      toast.error(errorMessage);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, options.patientContext, options.onToolCall]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdCounter = 0;
  }, []);

  const addInitialMessage = useCallback((content: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    setMessages([{
      id: generateId(),
      role: 'alis',
      content,
      timestamp,
    }]);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearMessages,
    addInitialMessage,
  };
}
