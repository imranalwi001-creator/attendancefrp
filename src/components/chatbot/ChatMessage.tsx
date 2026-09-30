import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: string;
  isBot: boolean;
  timestamp: Date;
  noAvatar?: boolean;
}

export function ChatMessage({ message, isBot, timestamp, noAvatar }: ChatMessageProps) {
  return (
    <div className={cn('flex gap-2 mb-3', isBot ? 'justify-start' : 'justify-end')}>
      {isBot && !noAvatar && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
        isBot
          ? 'bg-muted text-foreground rounded-bl-md'
          : 'bg-primary text-primary-foreground rounded-br-md'
      )}>
        {isBot ? (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>pre]:text-xs [&>pre]:bg-background/50 [&>pre]:rounded [&>pre]:p-2">
            <ReactMarkdown>{message}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message}</p>
        )}
        <span className={cn(
          'text-[10px] mt-1 block',
          isBot ? 'text-muted-foreground' : 'text-primary-foreground/70'
        )}>
          {timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {!isBot && !noAvatar && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
