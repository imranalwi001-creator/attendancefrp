import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, LineChart } from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartTooltip, ChartConfig } from '@/components/ui/chart';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const attendanceConfig: ChartConfig = {
  hadir: { label: "Hadir", color: "#10b981" },
  izin: { label: "Izin", color: "#f59e0b" },
  sakit: { label: "Sakit", color: "#3b82f6" },
  alfa: { label: "Alfa", color: "#ef4444" },
};

const gradeConfig: ChartConfig = {
  average: { label: "Rata-rata Nilai", color: "#8b5cf6" },
};

export function GuruMandiriCharts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        // Fetch Attendance Data for the last 5 days
        const last5Days = Array.from({ length: 5 }).map((_, i) => {
          const d = subDays(new Date(), 4 - i);
          return {
            dateStr: format(d, 'yyyy-MM-dd'),
            dayName: format(d, 'EEEE', { locale: idLocale }),
          };
        });

        const startDate = last5Days[0].dateStr;
        const endDate = last5Days[4].dateStr;

        // Get sessions by this teacher in date range
        const { data: sessions } = await supabase
          .from('sesi_pembelajaran')
          .select('id, tanggal')
          .eq('pengampu_id', user.id)
          .gte('tanggal', startDate)
          .lte('tanggal', endDate);

        let attData = last5Days.map(d => ({
          day: d.dayName,
          hadir: 0,
          izin: 0,
          sakit: 0,
          alfa: 0
        }));

        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          const { data: attendance } = await supabase
            .from('kehadiran_santri')
            .select('status, sesi_id')
            .in('sesi_id', sessionIds);

          if (attendance) {
            attendance.forEach(att => {
              const session = sessions.find(s => s.id === att.sesi_id);
              if (session) {
                const dayObj = last5Days.find(d => d.dateStr === session.tanggal);
                if (dayObj) {
                  const dataIndex = attData.findIndex(d => d.day === dayObj.dayName);
                  if (dataIndex !== -1) {
                    const statusMap: any = {
                      'hadir': 'hadir',
                      'izin': 'izin',
                      'sakit': 'sakit',
                      'alfa': 'alfa',
                      'terlambat': 'hadir' // count terlambat as hadir for simplicity
                    };
                    const mappedStatus = statusMap[att.status];
                    if (mappedStatus) {
                      attData[dataIndex][mappedStatus as keyof typeof attData[0]] += 1;
                    }
                  }
                }
              }
            });
          }
        }
        setAttendanceData(attData);

        // Fetch Grade Data
        const { data: tasks } = await supabase
          .from('tugas')
          .select('id, judul')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (tasks && tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const { data: submissions } = await supabase
            .from('pengumpulan_tugas')
            .select('tugas_id, nilai')
            .in('tugas_id', taskIds)
            .not('nilai', 'is', null);

          // reverse tasks to show chronological order left-to-right
          const sortedTasks = [...tasks].reverse();
          const grData = sortedTasks.map(t => {
            const taskSubmissions = submissions?.filter(s => s.tugas_id === t.id) || [];
            const avg = taskSubmissions.length > 0 
              ? Math.round(taskSubmissions.reduce((sum, s) => sum + (s.nilai || 0), 0) / taskSubmissions.length)
              : 0;
              
            // Limit task title length for chart
            const shortTitle = t.judul.length > 15 ? t.judul.substring(0, 15) + '...' : t.judul;
            return {
              task: shortTitle,
              average: avg,
              fullTitle: t.judul
            };
          });
          setGradeData(grData);
        } else {
          setGradeData([]);
        }

      } catch (error) {
        console.error('Error fetching dashboard charts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-[380px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
        <Card className="h-[380px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: '600ms' }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Tren Kehadiran Siswa (5 Hari Terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={attendanceConfig} className="h-[300px] w-full">
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
              <ChartTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} content={<ChartTooltipContent />} />
              <Bar dataKey="hadir" fill="var(--color-hadir)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="izin" fill="var(--color-izin)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sakit" fill="var(--color-sakit)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="alfa" fill="var(--color-alfa)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
          {attendanceData.every(d => d.hadir === 0 && d.izin === 0 && d.sakit === 0 && d.alfa === 0) && (
            <p className="text-center text-sm text-muted-foreground mt-2">Belum ada data kehadiran dalam 5 hari terakhir.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Distribusi Nilai Rata-rata Tugas</CardTitle>
        </CardHeader>
        <CardContent>
          {gradeData.length > 0 ? (
            <ChartContainer config={gradeConfig} className="h-[300px] w-full">
              <LineChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="task" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="average" stroke="var(--color-average)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-average)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="h-[300px] w-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground text-center">Belum ada data tugas yang dinilai.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
