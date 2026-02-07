export function TypingIndicator() {
  return (
    <div className="self-start animate-message-slide">
      <div className="flex gap-1 px-4 py-3.5 bg-card border border-border rounded-xl w-fit">
        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-typing-bounce" />
        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-typing-bounce [animation-delay:0.2s]" />
        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-typing-bounce [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
