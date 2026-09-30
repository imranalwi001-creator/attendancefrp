import { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NotificationAlertData {
  id: string;
  title: string;
  message: string;
}

interface NotificationAlertProps {
  notification: NotificationAlertData | null;
  onDismiss: () => void;
}

export function NotificationAlert({ notification, onDismiss }: NotificationAlertProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 400);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <div
      className={cn(
        'fixed top-16 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md transition-all duration-400',
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-4 pointer-events-none'
      )}
    >
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-card p-4 shadow-lg shadow-primary/10">
        <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{notification.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{notification.message}</p>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 400);
          }}
          className="flex-shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
