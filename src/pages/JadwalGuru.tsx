import { useState } from 'react';
import { Calendar, BookOpen, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { JadwalHariIni, SemuaJadwalGuru, RiwayatMengajarTab } from '@/components/jadwal';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';

export default function JadwalGuru() {
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester, isLoading: isLoadingAY } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const [activeTab, setActiveTab] = useState('jadwal-hari-ini');
  
  // Fetch staff ID for the current user
  const { data: staffData, isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-data', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('staff')
        .select('id, position')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Loading state
  if (isLoadingAY || isLoadingStaff) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state - no active academic year
  if (!activeAcademicYear) {
    return (
      <div className="space-y-4">
        <PageHeader 
          title="Aktifitas Mengajar"
          subtitle="Tidak ada tahun ajaran aktif"
        />
        <Card className="rounded-xl border-2 border-dashed border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Calendar className="h-10 w-10 text-destructive/50 mb-3" />
            <p className="text-sm text-destructive font-medium">
              Tidak ada tahun ajaran aktif
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hubungi admin untuk mengaktifkan tahun ajaran
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <PageHeader 
        title="Aktifitas Mengajar"
        subtitle={<BadgeTahunAjaran />}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="admin" className="grid-cols-3">
          <TabsTrigger value="jadwal-hari-ini" variant="admin" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Jadwal Hari Ini</span>
            <span className="sm:hidden">Hari Ini</span>
          </TabsTrigger>
          <TabsTrigger value="semua-jadwal" variant="admin" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Jadwal Mingguan</span>
            <span className="sm:hidden">Mingguan</span>
          </TabsTrigger>
          <TabsTrigger value="kehadiran" variant="admin" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Riwayat Mengajar</span>
            <span className="sm:hidden">Riwayat</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Jadwal Hari Ini - Filtered by pengampu */}
        <TabsContent value="jadwal-hari-ini">
          <JadwalHariIni 
            pengampuId={staffData?.id}
            tahunAjaran={activeAcademicYear.name}
            semester={currentSemester}
            showFilters={true}
            showTahunAjaranFilter={false}
            showKelasFilter={true}
            showHariFilter={true}
            showSearchFilter={true}
            mode="guru"
          />
        </TabsContent>

        {/* Tab: Semua Jadwal - Show all days */}
        <TabsContent value="semua-jadwal">
          <SemuaJadwalGuru 
            pengampuId={staffData?.id}
            semester={currentSemester}
          />
        </TabsContent>

        {/* Tab: Riwayat Mengajar */}
        <TabsContent value="kehadiran">
          {staffData?.id ? (
            <RiwayatMengajarTab 
              guruId={staffData.id} 
              guruName={user?.name}
            />
          ) : (
            <Card className="rounded-2xl border-2 border-dashed border-muted">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Data staff tidak ditemukan
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
