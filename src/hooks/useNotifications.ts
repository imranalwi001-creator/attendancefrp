import { useState, useEffect, useCallback, useRef } from 'react';
import type { NotificationAlertData } from '@/components/layout/NotificationAlert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { performanceConfig } from '@/lib/performanceConfig';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(limit?: number) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [latestAlert, setLatestAlert] = useState<NotificationAlertData | null>(null);
  const hasFetched = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      // Combine both queries in parallel for better performance - OPTIMIZED
      const [notificationsResult, countResult] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, user_id, title, message, is_read, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit ?? 20),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),
      ]);

      if (notificationsResult.error) throw notificationsResult.error;

      setNotifications(notificationsResult.data || []);
      
      if (!countResult.error) {
        setUnreadCount(countResult.count || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      hasFetched.current = true;
    }
  }, [user, limit]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user]);

  // Initial fetch - only once
  useEffect(() => {
    if (!hasFetched.current) {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Subscribe to real-time updates - only in preview/production mode
  useEffect(() => {
    if (!user || !performanceConfig.features.enableRealtimeSubscriptions) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev].slice(0, limit || prev.length + 1));
          setUnreadCount(prev => prev + 1);
          setLatestAlert({ id: newNotification.id, title: newNotification.title, message: newNotification.message });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, limit]);

  const dismissAlert = useCallback(() => setLatestAlert(null), []);

  return {
    notifications,
    unreadCount,
    isLoading,
    latestAlert,
    dismissAlert,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
