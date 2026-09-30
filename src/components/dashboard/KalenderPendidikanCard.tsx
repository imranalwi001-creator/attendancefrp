import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Calendar, Bell, ExternalLink, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

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
    icon: any;
    label: string;
  }> = {
    ujian: {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: BookOpen,
      label: 'Ujian'
    },
    libur: {
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: Calendar,
      label: 'Libur'
    },
    acara: {
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: Bell,
      label: 'Acara'
    }
  };
  return config[type] || config.acara;
};

interface KalenderPendidikanCardProps {
  hideLink?: boolean;
}

export function KalenderPendidikanCard({ hideLink = false }: KalenderPendidikanCardProps) {
  const { data: kalenderEvents, isLoading: isLoadingKalender } = useQuery({
    queryKey: ['dashboard-kalender-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('kalender_events')
        .select(`
          id,
          judul,
          deskripsi,
          tanggal_mulai,
          tanggal_selesai,
          kategori_id,
          is_recurring,
          recurrence_type,
          recurrence_end_date,
          kalender_kategori (
            id,
            nama,
            warna
          )
        `)
        // Include: (1) events starting today or future, (2) recurring events that are still active
        .or(
          `tanggal_mulai.gte.${today},and(is_recurring.eq.true,or(recurrence_end_date.is.null,recurrence_end_date.gte.${today}))`
        )
        .order('tanggal_mulai', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full flex flex-col">
      <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm md:text-lg font-semibold">Kalender Pendidikan</CardTitle>
          {!hideLink && (
            <Link 
              to="/admin/kalender"
              className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
            >
              <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-2.5 md:p-4">
        <div className="flex-1 space-y-1.5 md:space-y-2">
          {isLoadingKalender ? (
            <div className="space-y-2 md:space-y-3 py-1 md:py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-2.5 md:gap-3 px-2.5 md:px-4 py-2 md:py-3">
                  <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5 md:space-y-2">
                    <Skeleton className="h-3 md:h-4 w-24 md:w-32" />
                    <Skeleton className="h-2.5 md:h-3 w-16 md:w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : kalenderEvents && kalenderEvents.length > 0 ? (
            kalenderEvents.map((event, index) => {
              const kategoriNama = (event.kalender_kategori as any)?.nama;
              const eventType = getEventTypeFromKategori(kategoriNama);
              const eventConfig = getEventTypeConfig(eventType);
              const EventIcon = eventConfig.icon;
              const eventDate = parseISO(event.tanggal_mulai);
              const daysUntil = differenceInDays(eventDate, new Date());
              const dateLabel = daysUntil === 0 ? 'Hari ini' : daysUntil === 1 ? 'Besok' : format(eventDate, 'd MMM', {
                locale: idLocale
              });
              const isUpcoming = daysUntil > 7 && daysUntil <= 30;
              return (
                <div key={event.id} className="group relative px-2.5 md:px-4 py-2.5 md:py-4 hover:bg-muted/30 transition-all duration-300 cursor-pointer animate-fade-in border-l-2 border-transparent hover:border-muted-foreground/20 rounded-lg" style={{
                  animationDelay: `${index * 50}ms`
                }}>
                  <div className="flex items-start gap-2.5 md:gap-4">
                    <div className={`shrink-0 rounded-lg p-2 md:p-3 ${eventConfig.bgColor} transition-all duration-300 group-hover:scale-105`}>
                      <EventIcon className={`h-4 w-4 md:h-5 md:w-5 ${eventConfig.color}`} strokeWidth={2.5} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                        <h4 className="font-semibold text-xs md:text-sm text-foreground group-hover:text-foreground/90 transition-colors duration-300 truncate">
                          {event.judul}
                        </h4>
                        {isUpcoming && <span className="px-1.5 md:px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] md:text-[10px] font-medium shrink-0">
                            Segera
                          </span>}
                      </div>
                      <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed truncate">
                        {event.deskripsi || kategoriNama || 'Kegiatan akademik'}
                      </p>
                    </div>
                    
                    <div className="shrink-0">
                      <div className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-muted/50 border border-border/50">
                        <span className="text-[10px] md:text-xs font-semibold text-foreground whitespace-nowrap">
                          {dateLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-5 md:py-8 text-center">
              <CalendarDays className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground/50 mb-1.5 md:mb-2" />
              <p className="text-xs md:text-sm text-muted-foreground">Tidak ada agenda mendatang</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
