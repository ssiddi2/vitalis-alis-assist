import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: ChatMessageType;
  onAction?: (action: string) => void;
}

export function ChatMessage({ message, onAction }: ChatMessageProps) {
  const isAlis = message.role === 'alis';

  return (
    <div
      className={cn(
        'flex gap-3 animate-message-slide',
        isAlis ? 'flex-row' : 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
        isAlis 
          ? 'bg-gradient-to-br from-primary to-info glow-primary' 
          : 'bg-secondary border border-border/50'
      )}>
        {isAlis ? (
          <Bot className="w-4 h-4 text-primary-foreground" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col max-w-[85%]', isAlis ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isAlis
              ? 'bg-card border border-border/30 rounded-tl-md'
              : 'bg-gradient-to-r from-primary to-info text-primary-foreground rounded-tr-md'
          )}
        >
          {isAlis ? (
            <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <span>{message.content}</span>
          )}
        </div>
        
        <span className="text-[10px] font-mono text-muted-foreground mt-1.5 px-1">
          {message.timestamp}
        </span>

        {message.actions && message.actions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                variant={action.primary ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'text-xs h-8',
                  action.primary && 'bg-gradient-to-r from-primary to-info hover:opacity-90'
                )}
                onClick={() => onAction?.(action.action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
