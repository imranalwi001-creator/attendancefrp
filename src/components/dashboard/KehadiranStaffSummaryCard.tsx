import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { ExternalLink, Users } from 'lucide-react';
import { useMemo } from 'react';

const COLORS = {
  hadir: '#22c55e',      // Green
  sakit: '#f97316',      // Orange  
  izin: '#3b82f6',       // Blue
  tidakHadir: '#ef4444', // Red
};

export function KehadiranStaffSummaryCard() {
  const today = new Date();
  const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

  // Fetch staff list
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['dashboard-staff-list'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'guru', 'walikelas', 'Pembina']);
      
      if (roleError) throw roleError;
      return roleData || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Fetch attendance records for this month
  const { data: attendanceRecords = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['dashboard-kehadiran-staff', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('staff_id, jam_masuk, status')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!staffList.length) {
      return { hadir: 0, sakit: 0, izin: 0, tidakHadir: 0, total: 0 };
    }

    let hadir = 0;
    let sakit = 0;
    let izin = 0;

    attendanceRecords.forEach(record => {
      if (record.jam_masuk && (!record.status || record.status === 'hadir')) {
        hadir++;
      } else if (record.status === 'sakit') {
        sakit++;
      } else if (record.status === 'izin') {
        izin++;
      }
    });

    // Calculate work days in current month (up to today)
    const getWorkDaysCount = (start: string, end: string) => {
      let count = 0;
      const startD = new Date(start);
      const endD = new Date(end);
      const current = new Date(startD);
      while (current <= endD) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++;
        current.setDate(current.getDate() + 1);
      }
      return count;
    };

    const workDays = getWorkDaysCount(startDate, format(today, 'yyyy-MM-dd'));
    const expectedRecords = staffList.length * workDays;
    const totalRecorded = hadir + sakit + izin;
    const tidakHadir = Math.max(0, expectedRecords - totalRecorded);

    return { hadir, sakit, izin, tidakHadir, total: expectedRecords };
  }, [staffList, attendanceRecords, startDate]);

  const chartData = [
    { name: 'Hadir', value: stats.hadir, color: COLORS.hadir },
    { name: 'Sakit', value: stats.sakit, color: COLORS.sakit },
    { name: 'Izin', value: stats.izin, color: COLORS.izin },
    { name: 'Tidak Hadir', value: stats.tidakHadir, color: COLORS.tidakHadir },
  ].filter(item => item.value > 0);

  const isLoading = isLoadingStaff || isLoadingAttendance;
  const hasData = chartData.length > 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">{payload[0].value} kali</p>
        </div>
      );
    }
    return null;
  };

  const legendItems = [
    { name: 'Hadir', value: stats.hadir, color: COLORS.hadir },
    { name: 'Sakit', value: stats.sakit, color: COLORS.sakit },
    { name: 'Izin', value: stats.izin, color: COLORS.izin },
    { name: 'Tidak Hadir', value: stats.tidakHadir, color: COLORS.tidakHadir },
  ];

  return (
    <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-2xl">
      <CardHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-2xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Kehadiran Staff</CardTitle>
          <Link 
            to="/admin/kehadiran-staff"
            className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
          >
            <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-6 pb-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[180px] w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </div>
        ) : hasData ? (
          <div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {legendItems.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                  <span className="text-xs font-semibold ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              Data bulan {format(today, 'MMMM yyyy', { locale: idLocale })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="bg-muted/50 p-4 rounded-full mb-3">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada data kehadiran</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
