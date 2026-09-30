import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Square, GraduationCap, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AkhiriPembelajaranModal } from './AkhiriPembelajaranModal';
import { differenceInMinutes, differenceInSeconds, parse, format } from 'date-fns';
import { performanceConfig } from '@/lib/performanceConfig';
import { useDraggable } from '@/hooks/useDraggable';

interface ActiveSession {
  id: string;
  jadwal_id: string;
  waktu_mulai: string;
  status: string;
  metadata?: { materi_id?: string } | null;
  jadwal: {
    jam_mulai: string;
    jam_selesai: string;
    mapel: {
      id: string;
      nama: string;
    };
    kelas: {
      nama: string;
    };
  };
}

export function ActiveSessionBadge() {
  const { user } = useAuth();
  const [showEndModal, setShowEndModal] = useState(false);
  const [remainingTime, setRemainingTime] = useState<{ minutes: number; seconds: number } | null>(null);

  const { position, elementRef, handlers } = useDraggable({
    storageKey: 'active-session-badge-pos',
  });

  // Only fetch for guru/walikelas/Pembina roles
  const isTeacher = user?.role === 'guru' || user?.role === 'walikelas' || user?.role === 'Pembina';

  // Fetch active session for current user
  const { data: activeSession, refetch } = useQuery({
    queryKey: ['active-session', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select(`
          id,
          jadwal_id,
          waktu_mulai,
          status,
          metadata,
          jadwal:jadwal_id (
            jam_mulai,
            jam_selesai,
            mapel:mapel_id (id, nama),
            kelas:kelas_id (nama)
          )
        `)
        .eq('pengampu_id', user.id)
        .in('status', ['berlangsung', 'aktif'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active session:', error);
        return null;
      }

      return data as unknown as ActiveSession | null;
    },
    enabled: !!user?.id && isTeacher,
    refetchInterval: performanceConfig.polling.activeSession,
    staleTime: performanceConfig.queryClient.staleTime,
  });

  // Calculate remaining time
  const calculateRemainingTime = useCallback(() => {
    if (!activeSession?.jadwal?.jam_selesai) return null;

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const endTime = parse(`${today} ${activeSession.jadwal.jam_selesai}`, 'yyyy-MM-dd HH:mm', new Date());
    
    const diffSeconds = differenceInSeconds(endTime, now);
    
    if (diffSeconds <= 0) {
      return { minutes: 0, seconds: 0 };
    }
    
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    
    return { minutes, seconds };
  }, [activeSession]);

  // Update remaining time every second
  useEffect(() => {
    if (!activeSession) {
      setRemainingTime(null);
      return;
    }

    const updateTime = () => {
      setRemainingTime(calculateRemainingTime());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [activeSession, calculateRemainingTime]);

  const handleSessionEnded = () => {
    refetch();
  };

  // Don't render if no active session
  if (!activeSession) return null;

  const isOvertime = remainingTime && remainingTime.minutes <= 0 && remainingTime.seconds <= 0;
  const isLowTime = remainingTime && remainingTime.minutes < 10 && !isOvertime;

  return (
    <>
      {/* Floating Card - Draggable */}
      <div
        ref={elementRef}
        {...handlers}
        className="fixed z-50 touch-none select-none"
        style={position
          ? { left: position.x, top: position.y }
          : { top: '5rem', left: '1rem', right: '1rem' }
        }
      >
        <div className="bg-primary text-primary-foreground rounded-xl shadow-2xl overflow-hidden border-2 border-primary-foreground/20 md:max-w-lg md:min-w-[400px]">
          {/* Drag Handle + Header */}
          <div className="bg-primary-foreground/10 px-4 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 opacity-50" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold">Sesi Pembelajaran Aktif</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              isOvertime 
                ? 'bg-red-500 text-white' 
                : isLowTime 
                  ? 'bg-amber-400 text-amber-900'
                  : 'bg-primary-foreground/20 text-primary-foreground'
            }`}>
              {isOvertime ? (
                'WAKTU HABIS'
              ) : remainingTime ? (
                `${remainingTime.minutes}:${remainingTime.seconds.toString().padStart(2, '0')}`
              ) : (
                '...'
              )}
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-3 flex items-center gap-4">
            {/* Class & Subject Info */}
            <div className="h-12 w-12 rounded-lg bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-lg truncate">
                {activeSession.jadwal?.mapel?.nama || 'Mata Pelajaran'}
              </p>
              <p className="text-sm opacity-80">
                {activeSession.jadwal?.kelas?.nama || 'Kelas'} • {activeSession.jadwal?.jam_mulai} - {activeSession.jadwal?.jam_selesai}
              </p>
            </div>

            {/* End Session Button */}
            <Button 
              onClick={() => setShowEndModal(true)}
              variant="secondary"
              size="sm"
              className="shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold"
            >
              <Square className="h-4 w-4 mr-1.5" />
              Akhiri
            </Button>
          </div>
        </div>
      </div>

      {/* End Session Modal */}
      <AkhiriPembelajaranModal
        open={showEndModal}
        onOpenChange={setShowEndModal}
        sesi={{
          id: activeSession.id,
          jadwal_id: activeSession.jadwal_id,
          metadata: activeSession.metadata as { materi_id?: string } | null,
        }}
        jadwalInfo={{
          mapelNama: activeSession.jadwal?.mapel?.nama,
          kelasNama: activeSession.jadwal?.kelas?.nama,
          jamMulai: activeSession.jadwal?.jam_mulai,
          jamSelesai: activeSession.jadwal?.jam_selesai,
          mapelId: activeSession.jadwal?.mapel?.id,
        }}
        onSuccess={handleSessionEnded}
      />
    </>
  );
}
