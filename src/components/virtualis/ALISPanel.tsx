import { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ALISPanelProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  onSendMessage: (message: string) => void;
  onAction: (action: string) => void;
  isAIMode: boolean;
}

export function ALISPanel({
  messages,
  isTyping,
  onSendMessage,
  onAction,
  isAIMode,
}: ALISPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-primary to-primary/80 flex-shrink-0">
        <div className="flex items-center gap-2 text-primary-foreground">
          <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse-glow" />
          <span className="font-semibold">ALIS</span>
          {isAIMode && (
            <span className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded uppercase font-medium ml-1">
              Live
            </span>
          )}
        </div>
        <div className="text-xs text-primary-foreground/80 mt-1">
          Ambient Clinical Intelligence
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onAction={onAction}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card flex-shrink-0">
        <div className="flex gap-3">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ALIS anything..."
            className="flex-1 bg-secondary border-border"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
