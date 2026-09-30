import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ExternalLink, ChevronLeft, ChevronRight, Sparkles, PartyPopper, GraduationCap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, getDay, isSunday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const getEventTypeFromKategori = (kategoriNama: string | undefined): string => {
  if (!kategoriNama) return 'acara';
  const lower = kategoriNama.toLowerCase();
  if (lower.includes('ujian') || lower.includes('tes') || lower.includes('exam')) return 'ujian';
  if (lower.includes('libur') || lower.includes('cuti') || lower.includes('holiday')) return 'libur';
  return 'acara';
};

const getEventTypeConfig = (type: string) => {
  const config: Record<string, {
    color: string;
    bgColor: string;
    dotColor: string;
    borderColor: string;
    icon: any;
    label: string;
    emoji: string;
  }> = {
    ujian: {
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/20',
      dotColor: 'bg-rose-500',
      borderColor: 'border-rose-200 dark:border-rose-800',
      icon: GraduationCap,
      label: 'Ujian',
      emoji: '📝'
    },
    libur: {
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20',
      dotColor: 'bg-emerald-500',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      icon: PartyPopper,
      label: 'Libur',
      emoji: '🎉'
    },
    acara: {
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/30 dark:to-sky-900/20',
      dotColor: 'bg-sky-500',
      borderColor: 'border-sky-200 dark:border-sky-800',
      icon: Sparkles,
      label: 'Acara',
      emoji: '✨'
    }
  };
  return config[type] || config.acara;
};

interface KalenderPendidikanSantriCardProps {
  hideLink?: boolean;
}

export function KalenderPendidikanSantriCard({ hideLink = false }: KalenderPendidikanSantriCardProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: kalenderEvents = [], isLoading: isLoadingKalender } = useQuery({
    queryKey: ['dashboard-kalender-events-month', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(monthStart, 'yyyy-MM-dd');
      const end = format(monthEnd, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('kalender_events')
        .select(`
          id,
          judul,
          deskripsi,
          tanggal_mulai,
          tanggal_selesai,
          kategori_id,
          kalender_kategori (
            id,
            nama,
            warna
          )
        `)
        .or(`and(tanggal_mulai.lte.${end},tanggal_selesai.gte.${start})`)
        .order('tanggal_mulai', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Get calendar days with padding for week alignment
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPadding = getDay(monthStart); // 0 = Sunday
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);
    return [...paddedDays, ...days];
  }, [monthStart, monthEnd]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return kalenderEvents.filter(event => {
      const eventStart = parseISO(event.tanggal_mulai);
      const eventEnd = parseISO(event.tanggal_selesai);
      return date >= new Date(eventStart.setHours(0, 0, 0, 0)) && 
             date <= new Date(eventEnd.setHours(23, 59, 59, 999));
    });
  };

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDate(selectedDate);
  }, [selectedDate, kalenderEvents]);

  // Count total events this month
  const totalEventsThisMonth = kalenderEvents.length;

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const weekDays = [
    { short: 'Min', color: 'text-rose-500' },
    { short: 'Sen', color: 'text-foreground' },
    { short: 'Sel', color: 'text-foreground' },
    { short: 'Rab', color: 'text-foreground' },
    { short: 'Kam', color: 'text-foreground' },
    { short: 'Jum', color: 'text-foreground' },
    { short: 'Sab', color: 'text-foreground' }
  ];

  return (
    <Card className="border-2 border-border/50 hover:border-primary/40 transition-all duration-300 shadow-lg hover:shadow-xl rounded-2xl md:rounded-3xl h-full flex flex-col overflow-hidden">
      {/* Fun Header with Gradient */}
      <CardHeader className="px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-t-2xl md:rounded-t-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg font-bold text-primary-foreground">
                Kalender Kita 📅
              </CardTitle>
              {totalEventsThisMonth > 0 && (
                <p className="text-[10px] md:text-xs text-primary-foreground/80">
                  {totalEventsThisMonth} kegiatan bulan ini
                </p>
              )}
            </div>
          </div>
          {!hideLink && (
            <Link 
              to="/app/kalender"
              className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-primary-foreground hover:scale-110 transition-all duration-300 flex items-center justify-center"
            >
              <ExternalLink className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-3 md:p-5 gap-4">
        {isLoadingKalender ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Month Navigation - More Fun */}
            <div className="flex items-center justify-between bg-muted/30 rounded-2xl p-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h3 className="text-sm md:text-base font-bold text-foreground capitalize">
                  {format(currentMonth, 'MMMM', { locale: idLocale })}
                </h3>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  {format(currentMonth, 'yyyy')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Calendar Grid - Larger & More Colorful */}
            <div className="grid grid-cols-7 gap-1 md:gap-1.5">
              {/* Week days header */}
              {weekDays.map((day, idx) => (
                <div
                  key={day.short}
                  className={cn(
                    "text-center text-[11px] md:text-xs font-bold py-2 rounded-lg",
                    idx === 0 ? "text-rose-500 bg-rose-50 dark:bg-rose-950/30" : "text-muted-foreground bg-muted/30"
                  )}
                >
                  {day.short}
                </div>
              ))}
              
              {/* Calendar days - Bigger Touch Targets */}
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const dayEvents = getEventsForDate(day);
                const hasEvents = dayEvents.length > 0;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const isSundayDay = isSunday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 relative active:scale-95",
                      isSelected
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                        : isTodayDate
                        ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/50 font-bold"
                        : hasEvents
                        ? "bg-muted/50 hover:bg-muted text-foreground"
                        : "hover:bg-muted/30 text-foreground",
                      isSundayDay && !isSelected && "text-rose-500",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground/40"
                    )}
                  >
                    {format(day, 'd')}
                    {hasEvents && (
                      <div className="absolute bottom-1 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event, i) => {
                          const kategoriNama = (event.kalender_kategori as any)?.nama;
                          const eventType = getEventTypeFromKategori(kategoriNama);
                          const eventConfig = getEventTypeConfig(eventType);
                          return (
                            <span
                              key={i}
                              className={cn(
                                "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full",
                                isSelected ? "bg-primary-foreground" : eventConfig.dotColor
                              )}
                            />
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Date Events - More Engaging */}
            <div className="flex-1 bg-muted/20 rounded-2xl p-3 md:p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs md:text-sm font-bold text-foreground">
                  {selectedDate
                    ? format(selectedDate, "EEEE, d MMM", { locale: idLocale })
                    : "Pilih tanggal"}
                </h4>
                {isToday(selectedDate || new Date()) && selectedDate && (
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px] md:text-xs font-semibold">
                    Hari ini ⭐
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {selectedDateEvents.length > 0 ? (
                  selectedDateEvents.map((event) => {
                    const kategoriNama = (event.kalender_kategori as any)?.nama;
                    const eventType = getEventTypeFromKategori(kategoriNama);
                    const eventConfig = getEventTypeConfig(eventType);

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] cursor-pointer",
                          eventConfig.bgColor,
                          eventConfig.borderColor
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-lg",
                          "bg-white/50 dark:bg-black/20"
                        )}>
                          {eventConfig.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs md:text-sm font-semibold truncate", eventConfig.color)}>
                            {event.judul}
                          </p>
                          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                            {eventConfig.label} {kategoriNama ? `• ${kategoriNama}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
                      <span className="text-2xl">📭</span>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground font-medium">
                      Tidak ada kegiatan
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
