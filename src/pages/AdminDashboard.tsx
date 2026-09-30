import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BookOpen, School, Calendar, CalendarDays, RefreshCw } from 'lucide-react';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

import { StatCardSkeleton } from '@/components/skeletons';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';

const attendanceData = [
  { day: 'Senin', present: 120, absent: 5 },
  { day: 'Selasa', present: 118, absent: 7 },
  { day: 'Rabu', present: 122, absent: 3 },
  { day: 'Kamis', present: 115, absent: 10 },
  { day: 'Jumat', present: 125, absent: 0 },
];

const classDistributionData = [
  { name: 'Kelas 7', value: 45, fill: 'var(--color-kelas7)' },
  { name: 'Kelas 8', value: 50, fill: 'var(--color-kelas8)' },
  { name: 'Kelas 9', value: 30, fill: 'var(--color-kelas9)' },
];

const chartConfig = {
  present: {
    label: "Hadir",
    color: "hsl(var(--primary))",
  },
  absent: {
    label: "Absen",
    color: "hsl(var(--destructive))",
  },
  kelas7: {
    label: "Kelas 7",
    color: "hsl(var(--chart-1))",
  },
  kelas8: {
    label: "Kelas 8",
    color: "hsl(var(--chart-2))",
  },
  kelas9: {
    label: "Kelas 9",
    color: "hsl(var(--chart-3))",
  },
};

export default function AdminDashboard() {
  const { activeAcademicYear, getCurrentSemester, isLoading: academicYearLoading } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  // Auto-fetch dashboard stats
  const [shouldFetch, setShouldFetch] = useState(true);

  // Fetch dashboard statistics - requires explicit user interaction
  const { data: stats, isLoading: statsLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats', activeAcademicYear?.name],
    enabled: shouldFetch,
    queryFn: async () => {
      // Total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Total kelas (filtered by active academic year)
      const kelasQuery = supabase
        .from('kelas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aktif');
      
      if (activeAcademicYear?.name) {
        kelasQuery.eq('tahun_ajaran', activeAcademicYear.name);
      }
      const { count: kelasCount } = await kelasQuery;

      // Total mapel (from kelas in active academic year)
      let mapelCount = 0;
      if (activeAcademicYear?.name) {
        const { data: kelasIds } = await supabase
          .from('kelas')
          .select('id')
          .eq('tahun_ajaran', activeAcademicYear.name);
        
        if (kelasIds && kelasIds.length > 0) {
          const { count } = await supabase
            .from('mapel')
            .select('*', { count: 'exact', head: true })
            .in('kelas_id', kelasIds.map(k => k.id))
            .eq('status', 'aktif');
          mapelCount = count || 0;
        }
      } else {
        const { count } = await supabase
          .from('mapel')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aktif');
        mapelCount = count || 0;
      }

      // Today's sessions
      const today = new Date().toISOString().split('T')[0];
      const { count: sesiCount } = await supabase
        .from('sesi_pembelajaran')
        .select('*', { count: 'exact', head: true })
        .eq('tanggal', today);

      return {
        users: usersCount || 0,
        kelas: kelasCount || 0,
        mapel: mapelCount,
        sesi: sesiCount || 0
      };
    }
  });

  // Get semester date range
  const getSemesterDateRange = () => {
    if (!activeAcademicYear || !currentSemester) return null;
    
    if (currentSemester === 'ganjil') {
      return {
        start: activeAcademicYear.odd_semester_start,
        end: activeAcademicYear.odd_semester_end
      };
    } else {
      return {
        start: activeAcademicYear.even_semester_start,
        end: activeAcademicYear.even_semester_end
      };
    }
  };

  const semesterRange = getSemesterDateRange();

  const handleLoadStats = () => {
    setShouldFetch(true);
    if (shouldFetch) {
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Admin</h1>
          <p className="text-muted-foreground">Ringkasan data sistem LMS</p>
        </div>
        <Button 
          onClick={handleLoadStats} 
          variant="outline" 
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {shouldFetch ? 'Refresh Data' : 'Muat Data'}
        </Button>
      </div>

      {/* Academic Year Info Card */}
      {activeAcademicYear && (
        <Card className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <CalendarDays className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tahun Ajaran Aktif</p>
                  <h2 className="text-2xl font-bold text-foreground">{activeAcademicYear.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="text-xs">
                      Semester {currentSemester === 'ganjil' ? 'Ganjil' : currentSemester === 'genap' ? 'Genap' : '-'}
                    </Badge>
                    {semesterRange && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(semesterRange.start), 'd MMM yyyy', { locale: id })} - {format(new Date(semesterRange.end), 'd MMM yyyy', { locale: id })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Aktif
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeAcademicYear && !academicYearLoading && (
        <Card className="rounded-2xl border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-yellow-600">
              <CalendarDays className="h-5 w-5" />
              <p className="text-sm font-medium">Belum ada tahun ajaran aktif. Silakan aktifkan tahun ajaran di menu Pengaturan.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.users ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Pengguna terdaftar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mata Pelajaran</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.mapel ?? '-'}</div>
              <p className="text-xs text-muted-foreground">
                {activeAcademicYear ? `TA ${activeAcademicYear.name}` : 'Total mapel'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kelas</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.kelas ?? '-'}</div>
              <p className="text-xs text-muted-foreground">
                {activeAcademicYear ? `TA ${activeAcademicYear.name}` : 'Kelas aktif'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Jadwal</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.sesi ?? '-'}</div>
              <p className="text-xs text-muted-foreground">Sesi hari ini</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-6">
        <Card className="col-span-4 lg:col-span-4">
          <CardHeader>
            <CardTitle>Statistik Kehadiran Mingguan (Dummy)</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={attendanceData}>
                <CartesianGrid vertical={false} />
                <XAxis 
                  dataKey="day" 
                  tickLine={false} 
                  tickMargin={10} 
                  axisLine={false} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={10} 
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="present" fill="var(--color-present)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="var(--color-absent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 lg:col-span-3">
          <CardHeader>
            <CardTitle>Distribusi Kelas (Dummy)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={classDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {classDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} className="-translate-y-2 flex-wrap gap-2 [&>*]:justify-center" />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
