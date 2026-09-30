import { useRef, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, startOfWeek, endOfWeek, addMonths, startOfYear, isWithinInterval } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ReportPrintTemplate from '@/components/print/ReportPrintTemplate';
import { KalenderEvent, RenderedEvent } from '@/hooks/useKalenderEvents';
import { useReactToPrint } from 'react-to-print';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

interface KalenderPrintPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: Date;
  events: KalenderEvent[];
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function KalenderPrintPreview({
  open,
  onOpenChange,
  currentMonth,
  events,
}: KalenderPrintPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const semester = getCurrentSemester();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Kalender Pendidikan - Tahun ${currentMonth.getFullYear()}`,
  });

  // Generate all 12 months for the year
  const yearMonths = useMemo(() => {
    const yearStart = startOfYear(currentMonth);
    return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  }, [currentMonth]);

  // Generate eventsByDate for all events across the entire year
  const allEventsByDate = useMemo(() => {
    const map = new Map<string, RenderedEvent[]>();
    
    events.forEach(event => {
      const eventStart = parseISO(event.tanggal_mulai);
      const eventEnd = parseISO(event.tanggal_selesai);
      
      // Generate all dates between start and end
      const allDays = eachDayOfInterval({ start: eventStart, end: eventEnd });
      const isMultiDay = allDays.length > 1;
      
      allDays.forEach((day, idx) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const renderedEvent: RenderedEvent = {
          id: `${event.id}-${dateKey}`,
          originalId: event.id,
          judul: event.judul,
          deskripsi: event.deskripsi,
          date: day,
          isMultiDay,
          isStart: idx === 0,
          isEnd: idx === allDays.length - 1,
          warna: event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)',
          kategoriNama: event.kalender_kategori?.nama || 'Lainnya',
        };
        
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(renderedEvent);
      });
    });
    
    return map;
  }, [events]);

  // Generate calendar weeks for a specific month
  const getCalendarWeeks = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weeks: Date[][] = [];
    
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }
    
    return weeks;
  };

  // Sort all events by date for the list view
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => 
      new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime()
    );
  }, [events]);

  // Group events by category
  const eventsByCategory = useMemo(() => {
    const grouped = new Map<string, KalenderEvent[]>();
    sortedEvents.forEach(event => {
      const kategori = event.kalender_kategori?.nama || 'Lainnya';
      if (!grouped.has(kategori)) {
        grouped.set(kategori, []);
      }
      grouped.get(kategori)!.push(event);
    });
    return grouped;
  }, [sortedEvents]);

  const formatEventDate = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const isSameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
    
    if (isSameDay) {
      return format(start, 'd MMMM yyyy', { locale: localeId });
    }
    return `${format(start, 'd MMM', { locale: localeId })} - ${format(end, 'd MMM yyyy', { locale: localeId })}`;
  };

  // Get events for a specific month
  const getMonthEvents = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return events.filter(event => {
      const eventStart = parseISO(event.tanggal_mulai);
      const eventEnd = parseISO(event.tanggal_selesai);
      return (eventStart >= monthStart && eventStart <= monthEnd) || 
             (eventEnd >= monthStart && eventEnd <= monthEnd) ||
             (eventStart <= monthStart && eventEnd >= monthEnd);
    }).sort((a, b) => new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime());
  };

  // Mini calendar component for each month
  const MiniCalendar = ({ month }: { month: Date }) => {
    const weeks = getCalendarWeeks(month);
    const monthEvents = getMonthEvents(month);
    
    return (
      <div className="border border-border rounded flex flex-col h-full">
        {/* Month Header */}
        <div className="bg-primary text-primary-foreground text-center py-1 text-[9px] font-semibold">
          {MONTHS[month.getMonth()]}
        </div>
        
        {/* Days Header */}
        <table className="w-full border-collapse flex-shrink-0">
          <thead>
            <tr>
              {DAYS.map((day, index) => (
                <th 
                  key={day} 
                  className={`text-[7px] py-0.5 text-center font-medium w-[14.28%] ${
                    index === 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {day.charAt(0)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((date) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayEvents = allEventsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(date, month);
                  const isSunday = getDay(date) === 0;
                  const hasEvents = dayEvents.length > 0;
                  const eventColor = hasEvents ? dayEvents[0].warna : undefined;
                  
                  return (
                    <td 
                      key={dateKey}
                      className={`text-center text-[8px] py-0.5 px-0 w-[14.28%] ${
                        !isCurrentMonth ? 'text-muted-foreground/40' : ''
                      } ${isSunday && isCurrentMonth ? 'text-destructive' : ''}`}
                    >
                      <span 
                        className={`inline-flex items-center justify-center min-w-[14px] min-h-[14px] ${hasEvents && isCurrentMonth ? 'font-bold rounded-full' : ''}`}
                        style={hasEvents && isCurrentMonth && eventColor ? {
                          backgroundColor: `color-mix(in srgb, ${eventColor} 30%, transparent)`,
                          color: eventColor,
                        } : undefined}
                      >
                        {format(date, 'd')}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Event List */}
        {monthEvents.length > 0 && (
          <div className="px-1 py-1 border-t border-border bg-muted/20 space-y-0.5 flex-1 min-h-0">
            {monthEvents.map((event, idx) => (
              <div key={idx} className="flex items-start gap-1 text-[6px] leading-tight">
                <span 
                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)' }}
                />
                <span className="line-clamp-1">{event.judul}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Preview Cetak Kalender Pendidikan {currentMonth.getFullYear()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-auto">
          <ReportPrintTemplate
            ref={printRef}
            title={`Kalender Pendidikan Tahun ${currentMonth.getFullYear()}`}
            tahunAjaran={activeAcademicYear?.name}
            semester={semester}
            showFooter={false}
          >
            {/* 12-Month Calendar Grid (4x3) */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {yearMonths.map((month, index) => (
                <MiniCalendar key={index} month={month} />
              ))}
            </div>

            {/* Event List by Category */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide border-b-2 border-primary pb-2 text-center">
                Daftar Agenda Tahun {currentMonth.getFullYear()}
              </h3>
              
              {sortedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Tidak ada agenda di tahun ini
                </p>
              ) : (
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="border border-border px-2 py-1.5 text-left font-semibold w-6">No</th>
                      <th className="border border-border px-2 py-1.5 text-left font-semibold w-24">Kategori</th>
                      <th className="border border-border px-2 py-1.5 text-left font-semibold">Nama Kegiatan</th>
                      <th className="border border-border px-2 py-1.5 text-left font-semibold w-32">Tanggal</th>
                      <th className="border border-border px-2 py-1.5 text-left font-semibold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEvents.map((event, idx) => (
                      <tr key={event.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                        <td className="border border-border px-2 py-1 text-center">
                          {idx + 1}
                        </td>
                        <td className="border border-border px-2 py-1">
                          <span 
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium inline-block"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)'} 20%, transparent)`,
                              color: event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)',
                            }}
                          >
                            {event.kalender_kategori?.nama || 'Lainnya'}
                          </span>
                        </td>
                        <td className="border border-border px-2 py-1 font-medium">
                          {event.judul}
                        </td>
                        <td className="border border-border px-2 py-1 text-muted-foreground">
                          {formatEventDate(event.tanggal_mulai, event.tanggal_selesai)}
                        </td>
                        <td className="border border-border px-2 py-1 text-muted-foreground">
                          {event.deskripsi || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-border">
              <h4 className="text-[10px] font-semibold mb-2 uppercase">Keterangan Kategori:</h4>
              <div className="flex flex-wrap gap-3">
                {Array.from(eventsByCategory.entries()).map(([kategori, items]) => {
                  const color = items[0]?.kalender_kategori?.warna || 'hsl(174, 85%, 34%)';
                  return (
                    <div key={kategori} className="flex items-center gap-1.5">
                      <span 
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[9px]">{kategori} ({items.length})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ReportPrintTemplate>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => handlePrint()} className="gap-2">
            <Printer className="h-4 w-4" />
            Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
