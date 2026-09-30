import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { AbsenStaffModal } from '@/components/kehadiran/AbsenStaffModal';

interface AttendanceRecord {
  id: string;
  staff_id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  latitude_masuk: number | null;
  longitude_masuk: number | null;
  status_lokasi_masuk: string | null;
  latitude_pulang: number | null;
  longitude_pulang: number | null;
  status_lokasi_pulang: string | null;
  status: string | null;
}

export function KehadiranStaffCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const [absenModalOpen, setAbsenModalOpen] = useState(false);
  const [absenModalType, setAbsenModalType] = useState<'masuk' | 'pulang'>('masuk');

  const handleOpenAbsenModal = (type: 'masuk' | 'pulang') => {
    setAbsenModalType(type);
    setAbsenModalOpen(true);
  };

  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['kehadiran-staff-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('id, staff_id, tanggal, jam_masuk, jam_pulang, status, latitude_masuk, longitude_masuk, latitude_pulang, longitude_pulang, status_lokasi_masuk, status_lokasi_pulang')
        .eq('staff_id', user.id)
        .eq('tanggal', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as AttendanceRecord | null;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute for attendance
    refetchOnWindowFocus: false,
    refetchInterval: false
  });

  // Check if already clocked in - record exists AND jam_masuk is not null
  const hasClockIn = !!todayAttendance?.jam_masuk;
  const hasClockOut = !!todayAttendance?.jam_pulang;

  const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    // Remove seconds if present
    return time.substring(0, 5);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <Card className="rounded-xl md:rounded-2xl">
          <CardContent className="p-3 md:p-6">
            <Skeleton className="h-24 md:h-32 w-full" />
          </CardContent>
        </Card>
        <Card className="rounded-xl md:rounded-2xl">
          <CardContent className="p-3 md:p-6">
            <Skeleton className="h-24 md:h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
        {/* Card Absen Masuk */}
        <Card className="rounded-xl md:rounded-2xl border hover:border-primary/30 transition-all duration-300 shadow-sm">
          <CardHeader className="pb-1.5 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-primary/10 shrink-0">
                  <LogIn className="h-3.5 w-3.5 md:h-5 md:w-5 text-primary" />
                </div>
                <CardTitle className="text-xs md:text-lg font-semibold truncate">Absen Masuk</CardTitle>
              </div>
              <Badge 
                variant={hasClockIn ? 'success' : 'secondary'} 
                className="px-1.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs shrink-0"
              >
                {hasClockIn ? 'Sudah' : 'Belum'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-4 px-3 md:px-6 pb-3 md:pb-6">
            <div className="flex items-center justify-center py-2 md:py-4">
              <div className="text-center">
                <div className="flex items-center gap-1 md:gap-2 justify-center text-muted-foreground mb-0.5 md:mb-1">
                  <Clock className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-[10px] md:text-sm">Jam Masuk</span>
                </div>
                <p className="text-2xl md:text-4xl font-bold font-mono text-foreground">
                  {formatTime(todayAttendance?.jam_masuk ?? null)}
                </p>
              </div>
            </div>

            <Button
              className="w-full text-[10px] md:text-sm h-8 md:h-10"
              size="sm"
              onClick={() => handleOpenAbsenModal('masuk')}
              disabled={hasClockIn}
            >
              <LogIn className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Absen Masuk
            </Button>
          </CardContent>
        </Card>

        {/* Card Absen Pulang */}
        <Card className="rounded-xl md:rounded-2xl border hover:border-primary/30 transition-all duration-300 shadow-sm">
          <CardHeader className="pb-1.5 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-destructive/10 shrink-0">
                  <LogOut className="h-3.5 w-3.5 md:h-5 md:w-5 text-destructive" />
                </div>
                <CardTitle className="text-xs md:text-lg font-semibold truncate">Absen Pulang</CardTitle>
              </div>
              <Badge 
                variant={hasClockOut ? 'success' : 'secondary'} 
                className="px-1.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-xs shrink-0"
              >
                {hasClockOut ? 'Sudah' : 'Belum'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-4 px-3 md:px-6 pb-3 md:pb-6">
            <div className="flex items-center justify-center py-2 md:py-4">
              <div className="text-center">
                <div className="flex items-center gap-1 md:gap-2 justify-center text-muted-foreground mb-0.5 md:mb-1">
                  <Clock className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-[10px] md:text-sm">Jam Pulang</span>
                </div>
                <p className="text-2xl md:text-4xl font-bold font-mono text-foreground">
                  {formatTime(todayAttendance?.jam_pulang ?? null)}
                </p>
              </div>
            </div>

            <Button
              className="w-full text-[10px] md:text-sm h-8 md:h-10"
              size="sm"
              variant={!hasClockIn ? 'outline' : 'default'}
              onClick={() => handleOpenAbsenModal('pulang')}
              disabled={!hasClockIn || hasClockOut}
            >
              <LogOut className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Absen Pulang
            </Button>

            {!hasClockIn && (
              <p className="text-[9px] md:text-xs text-muted-foreground text-center">
                Absen masuk dahulu
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {user?.id && (
        <AbsenStaffModal
          open={absenModalOpen}
          onOpenChange={setAbsenModalOpen}
          type={absenModalType}
          staffId={user.id}
          attendanceId={todayAttendance?.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['kehadiran-staff-today'] });
          }}
        />
      )}
    </>
  );
}
