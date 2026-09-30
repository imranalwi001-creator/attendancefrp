import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ActiveSession {
  id: string;
  jadwal_id: string;
  mapel_id: string | null;
  status: string;
  waktu_mulai: string | null;
}

interface UseActiveSessionResult {
  hasActiveSession: boolean;
  activeSession: ActiveSession | null;
  isLoading: boolean;
}

/**
 * Hook to check if there's an active learning session for a specific mapel or for the current user
 * When an active session exists, modifications to Mapel data, Capaian Pembelajaran, and Materi should be blocked
 */
export function useActiveSession(mapelId?: string): UseActiveSessionResult {
  const { user } = useAuth();
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkActiveSession = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      // Only check for guru/walikelas/Pembina roles
      if (user.role !== 'guru' && user.role !== 'walikelas' && user.role !== 'Pembina') {
        setIsLoading(false);
        return;
      }

      try {
        // Get staff record for current user
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!staffData) {
          setIsLoading(false);
          return;
        }

        // Check for active session (status = 'berlangsung' and waktu_selesai is null)
        let query = supabase
          .from('sesi_pembelajaran')
          .select(`
            id,
            jadwal_id,
            status,
            waktu_mulai,
            jadwal:jadwal_id (
              mapel_id
            )
          `)
          .eq('pengampu_id', staffData.id)
          .eq('status', 'berlangsung')
          .is('waktu_selesai', null);

        const { data: sessionData, error } = await query.maybeSingle();

        if (error) {
          console.error('Error checking active session:', error);
          setIsLoading(false);
          return;
        }

        if (sessionData) {
          const jadwalData = sessionData.jadwal as any;
          const sessionMapelId = jadwalData?.mapel_id;

          // If mapelId is provided, only set active if it matches
          if (mapelId) {
            if (sessionMapelId === mapelId) {
              setActiveSession({
                id: sessionData.id,
                jadwal_id: sessionData.jadwal_id,
                mapel_id: sessionMapelId,
                status: sessionData.status,
                waktu_mulai: sessionData.waktu_mulai
              });
              setHasActiveSession(true);
            } else {
              setActiveSession(null);
              setHasActiveSession(false);
            }
          } else {
            // If no mapelId provided, return any active session
            setActiveSession({
              id: sessionData.id,
              jadwal_id: sessionData.jadwal_id,
              mapel_id: sessionMapelId,
              status: sessionData.status,
              waktu_mulai: sessionData.waktu_mulai
            });
            setHasActiveSession(true);
          }
        } else {
          setActiveSession(null);
          setHasActiveSession(false);
        }
      } catch (error) {
        console.error('Error in useActiveSession:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkActiveSession();

    // Set up realtime subscription to track session changes
    const channel = supabase
      .channel('active-session-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sesi_pembelajaran'
      }, () => {
        checkActiveSession();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role, mapelId]);

  return { hasActiveSession, activeSession, isLoading };
}
