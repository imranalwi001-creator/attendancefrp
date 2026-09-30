import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LiburanActivity } from '@/hooks/useLiburanLog';

interface LiburanCalendarGridProps {
  liburanStart: Date;
  liburanEnd: Date;
  activities: LiburanActivity[];
  santriId: string;
  onDayClick: (date: Date, day: number) => void;
  hideReminder?: boolean;
}

function useLiburan30DayLogs(santriId: string | undefined, startDate: Date, endDate: Date) {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['liburan-30day-logs', santriId, startStr],
    queryFn: async () => {
      if (!santriId) return [];
      const { data: completedData, error: err1 } = await supabase
        .from('liburan_daily_logs' as any)
        .select('*')
        .eq('santri_id', santriId)
        .gte('date', startStr)
        .lte('date', endStr)
        .eq('is_completed', true);
      if (err1) throw err1;

      const { data: excusedData, error: err2 } = await supabase
        .from('liburan_daily_logs' as any)
        .select('*')
        .eq('santri_id', santriId)
        .gte('date', startStr)
        .lte('date', endStr)
        .eq('is_completed', false)
        .not('excuse_reason', 'is', null);
      if (err2) throw err2;

      return [...(completedData || []), ...(excusedData || [])] as unknown as { date: string; activity_id: string; is_completed: boolean; excuse_reason: string | null }[];
    },
    enabled: !!santriId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}

function DayCircle({ percentage, size = 56, strokeWidth = 3.5, isFuture, isToday, isComplete, day }: { percentage: number; size?: number; strokeWidth?: number; isFuture: boolean; isToday: boolean; isComplete: boolean; day: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {isComplete && <Star className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 fill-amber-400 text-amber-400 z-20 drop-shadow-sm" />}
      <svg width={size} height={size} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill={isComplete ? 'hsl(var(--primary))' : 'none'} stroke={isFuture ? 'hsl(var(--border))' : percentage > 0 ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--border))'} strokeWidth={strokeWidth} />
        {!isComplete && !isFuture && percentage > 0 && (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--primary))" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-500" />
        )}
      </svg>
      <div className="relative z-10 flex items-center justify-center">
        {isComplete ? <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} /> : !isFuture && percentage > 0 ? <span className="text-[11px] font-bold text-primary">{percentage}%</span> : <span className={cn('text-sm font-medium', isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground')}>{day}</span>}
      </div>
    </div>
  );
}

export function LiburanCalendarGrid({ liburanStart, liburanEnd, activities, santriId, onDayClick, hideReminder }: LiburanCalendarGridProps) {
  const { data: logs = [], isLoading } = useLiburan30DayLogs(santriId, liburanStart, liburanEnd);
  const totalActivities = activities.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedByDate = new Map<string, number>();
  logs.forEach((log) => { if (log.is_completed) completedByDate.set(log.date, (completedByDate.get(log.date) || 0) + 1); });

  const totalDays = Math.round((liburanEnd.getTime() - liburanStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(liburanStart);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    const dateStr = format(date, 'yyyy-MM-dd');
    const completed = completedByDate.get(dateStr) || 0;
    const percentage = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;
    const isToday = date.getTime() === today.getTime();
    const hasData = completed > 0;
    const isFuture = date.getTime() > today.getTime() && !hasData;
    const isComplete = percentage === 100 && hasData;
    return { day: i + 1, date, dateStr, percentage, isToday, isFuture, isComplete };
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-3 px-2">
        {Array.from({ length: Math.min(15, totalDays) }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1"><div className="h-14 w-14 rounded-full bg-muted animate-pulse" /><div className="h-3 w-10 rounded bg-muted animate-pulse" /></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-foreground">Kalender Liburan</h3></div>

        {!hideReminder && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5"><Sparkles className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-sm font-medium text-primary">Jangan lupa isi aktivitas anak!</p>
              <p className="text-xs text-primary/70 mt-0.5">Catat aktivitas harian anak setiap hari selama liburan agar progressnya tercatat lengkap.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 gap-x-2 gap-y-3">
          {days.map((d) => (
            <button key={d.day} onClick={() => onDayClick(d.date, d.day)} className={cn('relative flex flex-col items-center gap-1 transition-all duration-200', d.isFuture ? 'cursor-default' : 'cursor-pointer active:scale-95', d.isToday && 'scale-105 bg-primary/5 rounded-xl ring-1 ring-primary/30 py-1')}>
              <DayCircle percentage={d.percentage} isFuture={d.isFuture} isToday={d.isToday} isComplete={d.isComplete} day={d.day} />
              <span className={cn('text-[11px] font-medium', d.isComplete ? 'text-primary' : d.isToday ? 'text-primary font-semibold' : d.isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground')}>Hari {d.day}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-5 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary" />Selesai</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-primary bg-transparent" />Proses</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-border bg-transparent" />Mendatang</span>
        </div>
      </div>
    </div>
  );
}
