import { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { Button } from '@/components/ui/button';
import { Send, Sparkles } from 'lucide-react';

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;
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
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 grid-pattern pointer-events-none" />
      
      {/* Header */}
      <div className="relative px-6 py-5 bg-gradient-to-r from-primary via-info to-primary border-b border-primary/30">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="w-5 h-5 text-primary-foreground animate-float" />
              <div className="absolute inset-0 blur-lg bg-white/30" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary-foreground">ALIS</span>
                {isAIMode && (
                  <span className="text-[9px] px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full uppercase font-bold tracking-wider">
                    Live AI
                  </span>
                )}
              </div>
              <span className="text-xs text-primary-foreground/70">
                Ambient Clinical Intelligence
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
            <span className="text-xs text-primary-foreground/80 font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 relative" ref={scrollRef}>
        <div className="flex flex-col gap-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 border border-primary/30 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ready to assist</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask me about clinical patterns, patient trajectories, or let me help with orders and documentation.
              </p>
            </div>
          )}
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
      <div className="relative p-4 border-t border-border/30 bg-card/50 backdrop-blur-xl">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAIMode ? "Ask ALIS anything..." : "Type a message..."}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-secondary/50 border border-border/50 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            size="icon"
            className="h-11 w-11 rounded-xl bg-gradient-to-r from-primary to-info hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
