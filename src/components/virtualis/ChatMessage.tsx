import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import alisLogo from '@/assets/alis-logo.png';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
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
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-soft',
        isAlis 
          ? 'bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20' 
          : 'bg-secondary border border-border'
      )}>
        {isAlis ? (
          <img src={alisLogo} alt="ALIS" className="w-6 h-6 object-contain" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col max-w-[85%]', isAlis ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-soft',
            isAlis
              ? 'bg-card border border-border rounded-tl-md'
              : 'bg-gradient-to-r from-primary to-info text-primary-foreground rounded-tr-md'
          )}
        >
          {isAlis ? (
            <div className="prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 text-foreground [&_strong]:text-foreground [&_a]:text-primary">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <span>{message.content}</span>
          )}
        </div>
        
        <span className="text-[10px] font-mono text-muted-foreground mt-1.5 px-1">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}
