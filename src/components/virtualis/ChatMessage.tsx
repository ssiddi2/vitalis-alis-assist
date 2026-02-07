import { ChatMessage as ChatMessageType, ChatAction } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChatMessageProps {
  message: ChatMessageType;
  onAction?: (action: string) => void;
}

export function ChatMessage({ message, onAction }: ChatMessageProps) {
  const isAlis = message.role === 'alis';

  return (
    <div
      className={cn(
        'max-w-[85%] animate-message-slide',
        isAlis ? 'self-start' : 'self-end'
      )}
    >
      <div
        className={cn(
          'px-4 py-3.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap',
          isAlis
            ? 'bg-card border border-border'
            : 'bg-primary text-primary-foreground'
        )}
      >
        {message.content}
      </div>
      
      <div
        className={cn(
          'text-[10px] font-mono mt-1.5',
          isAlis ? 'text-left text-muted-foreground' : 'text-right text-primary-foreground/60'
        )}
      >
        {message.timestamp}
      </div>

      {message.actions && message.actions.length > 0 && (
        <div className="flex gap-2 mt-3">
          {message.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.primary ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => onAction?.(action.action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
