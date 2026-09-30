import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY_PREFIX = 'forum_last_seen_';

export function useUnreadAnnouncements(subjectId: string, userId?: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  const storageKey = `${STORAGE_KEY_PREFIX}${subjectId}`;

  const fetchUnreadCount = useCallback(async () => {
    if (!subjectId || !userId) {
      setUnreadCount(0);
      return;
    }

    try {
      // Get last seen timestamp from localStorage
      const lastSeenStr = localStorage.getItem(storageKey);
      const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);

      // Fetch announcement posts created after last seen
      const { data, error } = await supabase
        .from('subject_forum_posts')
        .select('id, created_at, user_id')
        .eq('subject_id', subjectId)
        .eq('post_type', 'announcement')
        .gt('created_at', lastSeen.toISOString())
        .neq('user_id', userId); // Don't count own announcements

      if (error) throw error;

      setUnreadCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching unread announcements:', error);
      setUnreadCount(0);
    }
  }, [subjectId, userId, storageKey]);

  // Mark announcements as seen
  const markAsSeen = useCallback(() => {
    localStorage.setItem(storageKey, new Date().toISOString());
    setUnreadCount(0);
  }, [storageKey]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!subjectId) return;

    const channel = supabase
      .channel(`forum-announcements-${subjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'subject_forum_posts',
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload) => {
          // Only count if it's an announcement and not from current user
          if (payload.new.post_type === 'announcement' && payload.new.user_id !== userId) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [subjectId, userId]);

  return {
    unreadCount,
    markAsSeen,
    refetch: fetchUnreadCount,
  };
}
