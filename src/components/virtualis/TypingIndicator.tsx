import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-message-slide">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-info glow-primary flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="flex gap-1.5 px-4 py-3.5 bg-card border border-border/30 rounded-2xl rounded-tl-md items-center">
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-typing-bounce" />
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-typing-bounce [animation-delay:0.15s]" />
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-typing-bounce [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
