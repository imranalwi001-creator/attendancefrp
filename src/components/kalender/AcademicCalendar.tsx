import { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  addMonths, 
  subMonths,
  getDay,
  isToday,
  parseISO
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKalenderEvents, useRenderedEvents, RenderedEvent, KalenderEvent } from '@/hooks/useKalenderEvents';
import { ListCard } from '@/components/ui/list-card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateDetailModal } from './DateDetailModal';
import { AddEventModal, EventToEdit } from './AddEventModal';
import { KalenderPrintPreview } from './KalenderPrintPreview';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const MAX_VISIBLE_EVENTS = 2;

interface SpanningEvent {
  event: RenderedEvent;
  startCol: number;
  span: number;
  row: number;
}

// Calculate spanning events for a week row
function calculateSpanningEvents(
  weekDays: Date[],
  eventsByDate: Map<string, RenderedEvent[]>
): SpanningEvent[] {
  const spanningEvents: SpanningEvent[] = [];
  const processedEventIds = new Set<string>();
  const rowOccupancy: Map<number, Set<string>>[] = weekDays.map(() => new Map());

  weekDays.forEach((date, colIndex) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsByDate.get(dateKey) || [];

    dayEvents.forEach((event) => {
      // Skip if we've already processed this multi-day event
      if (processedEventIds.has(event.originalId)) return;

      // For multi-day events, only process on their start day or first visible day in the week
      if (event.isMultiDay && !event.isStart && colIndex > 0) return;

      // Calculate how many days this event spans in this week
      let span = 1;
      if (event.isMultiDay) {
        processedEventIds.add(event.originalId);
        for (let i = colIndex + 1; i < weekDays.length; i++) {
          const nextDateKey = format(weekDays[i], 'yyyy-MM-dd');
          const nextDayEvents = eventsByDate.get(nextDateKey) || [];
          const continuingEvent = nextDayEvents.find(e => e.originalId === event.originalId);
          if (continuingEvent) {
            span++;
          } else {
            break;
          }
        }
      }

      // Find available row for this event
      let row = 0;
      let foundRow = false;
      while (!foundRow && row < MAX_VISIBLE_EVENTS) {
        let rowAvailable = true;
        for (let c = colIndex; c < colIndex + span; c++) {
          if (rowOccupancy[c]?.get(row)?.size) {
            rowAvailable = false;
            break;
          }
        }
        if (rowAvailable) {
          foundRow = true;
        } else {
          row++;
        }
      }

      if (row < MAX_VISIBLE_EVENTS) {
        // Mark row as occupied
        for (let c = colIndex; c < colIndex + span; c++) {
          if (!rowOccupancy[c].has(row)) {
            rowOccupancy[c].set(row, new Set());
          }
          rowOccupancy[c].get(row)!.add(event.originalId);
        }

        spanningEvents.push({
          event,
          startCol: colIndex,
          span,
          row,
        });
      }
    });
  });

  return spanningEvents;
}

interface EventBadgeProps {
  event: RenderedEvent;
  span?: number;
  isStart?: boolean;
  isEnd?: boolean;
  onClick?: (event: RenderedEvent) => void;
}

function EventBadge({ event, span = 1, isStart = true, isEnd = true, onClick }: EventBadgeProps) {
  const getSoftStyles = (color: string) => {
    return {
      backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
      color: color,
      borderLeft: isStart ? `3px solid ${color}` : 'none',
    };
  };

  return (
    <div
      className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 truncate font-medium whitespace-nowrap overflow-hidden cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity ${
        isStart ? 'rounded-l' : ''
      } ${isEnd ? 'rounded-r' : ''}`}
      style={{
        ...getSoftStyles(event.warna),
        gridColumn: `span ${span}`,
      }}
      title={event.judul}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
    >
      {event.judul}
    </div>
  );
}

interface DayCellProps {
  date: Date;
  currentMonth: Date;
  hiddenCount: number;
  onClick: (date: Date) => void;
}

function DayCell({ date, currentMonth, hiddenCount, onClick }: DayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isSunday = getDay(date) === 0;
  const isCurrentDay = isToday(date);

  return (
    <div
      onClick={() => onClick(date)}
      className={`min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1 border-b border-r border-border transition-colors cursor-pointer hover:bg-muted/50 ${
        !isCurrentMonth ? 'bg-muted/30' : 'bg-card'
      } ${isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
            isCurrentDay
              ? 'bg-primary text-primary-foreground'
              : isSunday
              ? 'text-destructive'
              : !isCurrentMonth
              ? 'text-muted-foreground'
              : 'text-foreground'
          }`}
        >
          {format(date, 'd')}
        </span>
      </div>
      
      {hiddenCount > 0 && (
        <div className="mt-12 text-[10px] sm:text-xs text-primary font-medium">
          +{hiddenCount} lainnya
        </div>
      )}
    </div>
  );
}

interface WeekRowProps {
  weekDays: Date[];
  currentMonth: Date;
  eventsByDate: Map<string, RenderedEvent[]>;
  onDateClick: (date: Date) => void;
  onEventClick: (event: RenderedEvent) => void;
}

function WeekRow({ weekDays, currentMonth, eventsByDate, onDateClick, onEventClick }: WeekRowProps) {
  const spanningEvents = useMemo(
    () => calculateSpanningEvents(weekDays, eventsByDate),
    [weekDays, eventsByDate]
  );

  // Calculate hidden counts per day
  const hiddenCounts = useMemo(() => {
    const counts = new Map<string, number>();
    weekDays.forEach((date, dayCol) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayEvents = eventsByDate.get(dateKey) || [];
      const visibleEventIds = new Set(
        spanningEvents
          .filter(se => {
            const endCol = se.startCol + se.span - 1;
            return dayCol >= se.startCol && dayCol <= endCol;
          })
          .map(se => se.event.originalId)
      );
      const hiddenCount = dayEvents.filter(e => !visibleEventIds.has(e.originalId)).length;
      if (hiddenCount > 0) {
        counts.set(dateKey, hiddenCount);
      }
    });
    return counts;
  }, [weekDays, eventsByDate, spanningEvents]);

  return (
    <div className="relative">
      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {weekDays.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          return (
            <DayCell
              key={dateKey}
              date={date}
              currentMonth={currentMonth}
              hiddenCount={hiddenCounts.get(dateKey) || 0}
              onClick={onDateClick}
            />
          );
        })}
      </div>
      
      {/* Spanning events overlay */}
      <div className="absolute top-7 left-0 right-0 pointer-events-none">
        {[0, 1].map((row) => (
          <div key={row} className="grid grid-cols-7 gap-0.5 px-0.5 mb-0.5">
            {weekDays.map((_, colIndex) => {
              const eventAtPosition = spanningEvents.find(
                (se) => se.row === row && se.startCol === colIndex
              );
              
              if (eventAtPosition) {
                return (
                  <EventBadge
                    key={eventAtPosition.event.id}
                    event={eventAtPosition.event}
                    span={eventAtPosition.span}
                    isStart={eventAtPosition.event.isStart || eventAtPosition.startCol === 0}
                    isEnd={eventAtPosition.event.isEnd || eventAtPosition.startCol + eventAtPosition.span === 7}
                    onClick={onEventClick}
                  />
                );
              }
              
              // Check if this cell is occupied by a spanning event from earlier column
              const isOccupied = spanningEvents.some(
                (se) => se.row === row && colIndex > se.startCol && colIndex < se.startCol + se.span
              );
              
              if (isOccupied) {
                return null;
              }
              
              return <div key={colIndex} className="h-4" />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AcademicCalendarProps {
  isStaffView?: boolean;
  currentMonth?: Date | null;
  onMonthChange?: (month: Date | null) => void;
}

export default function AcademicCalendar({ isStaffView = false, currentMonth: controlledMonth, onMonthChange }: AcademicCalendarProps) {
  const [internalMonth, setInternalMonth] = useState(new Date());
  // Use controlled month if it's a valid Date, otherwise use internal state
  const currentMonth = controlledMonth instanceof Date ? controlledMonth : internalMonth;
  const setCurrentMonth = (month: Date) => {
    if (onMonthChange) {
      onMonthChange(month);
    } else {
      setInternalMonth(month);
    }
  };
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const { data: events, isLoading } = useKalenderEvents(currentMonth);
  const eventsByDate = useRenderedEvents(currentMonth, events);

  // Find selected event for edit modal
  const selectedEventToEdit = useMemo(() => {
    if (!selectedEventId || !events) return null;
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return null;
    return {
      id: event.id,
      judul: event.judul,
      deskripsi: event.deskripsi,
      tanggal_mulai: event.tanggal_mulai,
      tanggal_selesai: event.tanggal_selesai,
      kategori_id: event.kategori_id,
      is_recurring: event.is_recurring,
      recurrence_type: event.recurrence_type,
      recurrence_end_date: event.recurrence_end_date,
      pic_id: event.pic_id,
      status: event.status,
      document_url: event.document_url,
      document_name: event.document_name,
      created_by: event.created_by,
    };
  }, [selectedEventId, events]);

  // Generate calendar weeks
  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weeks: Date[][] = [];
    
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }
    
    return weeks;
  }, [currentMonth]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleMonthChange = (monthIndex: string) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(parseInt(monthIndex));
    setCurrentMonth(newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(parseInt(year));
    setCurrentMonth(newDate);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsDetailModalOpen(true);
  };

  const handleAddEvent = () => {
    setIsDetailModalOpen(false);
    setSelectedEventId(null);
    setIsAddModalOpen(true);
  };

  const handleEventClick = (event: RenderedEvent) => {
    setSelectedEventId(event.originalId);
    setIsAddModalOpen(true);
  };

  const getEventsForSelectedDate = () => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
  };

  const currentYear = currentMonth.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl overflow-hidden">
        {/* Calendar Header */}
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={currentMonth.getMonth().toString()}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={currentYear.toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="w-[90px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintModalOpen(true)}
                className="gap-1"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Cetak</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="text-primary"
              >
                Hari Ini
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map((day, index) => (
              <div
                key={day}
                className={`py-2 text-center text-xs sm:text-sm font-medium ${
                  index === 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid by Weeks */}
          {calendarWeeks.map((weekDays, weekIndex) => (
            <WeekRow
              key={weekIndex}
              weekDays={weekDays}
              currentMonth={currentMonth}
              eventsByDate={eventsByDate}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          ))}
        </CardContent>
      </Card>

      {/* Event List Section */}
      <EventListSection 
        events={events || []} 
        monthName={MONTHS[currentMonth.getMonth()]}
        onEventClick={(eventId) => {
          setSelectedEventId(eventId);
          setIsAddModalOpen(true);
        }}
      />

      {/* Date Detail Modal */}
      <DateDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        date={selectedDate}
        events={getEventsForSelectedDate()}
        onAddEvent={handleAddEvent}
        onEventClick={(event) => {
          setIsDetailModalOpen(false);
          handleEventClick(event);
        }}
      />

      {/* Add Event Modal */}
      <AddEventModal
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) setSelectedEventId(null);
        }}
        initialDate={selectedDate}
        eventToEdit={selectedEventToEdit}
        readOnly={isStaffView}
        isAdminView={!isStaffView}
      />

      {/* Print Preview Modal */}
      <KalenderPrintPreview
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        currentMonth={currentMonth}
        events={events || []}
      />
    </>
  );
}

// Event List Section Component
interface EventListSectionProps {
  events: KalenderEvent[];
  monthName: string;
  onEventClick: (eventId: string) => void;
}

function EventListSection({ events, monthName, onEventClick }: EventListSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Sort events by start date
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => 
      new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime()
    );
  }, [events]);

  // Pagination
  const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedEvents.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedEvents, currentPage, itemsPerPage]);

  // Reset page when events change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [events.length]);

  const formatEventDate = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const isSameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
    
    if (isSameDay) {
      return format(start, 'd MMMM yyyy', { locale: localeId });
    }
    return `${format(start, 'd MMM', { locale: localeId })} - ${format(end, 'd MMM yyyy', { locale: localeId })}`;
  };

  if (events.length === 0) {
    return (
      <Card className="rounded-2xl mt-4">
        <CardContent className="py-8 text-center text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Tidak ada agenda di bulan {monthName}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl mt-4">
      <CardContent className="p-4 space-y-2">
        {paginatedEvents.map((event) => {
          const kategoriColor = event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)';
          return (
            <ListCard
              key={event.id}
              icon={<CalendarDays className="h-5 w-5" style={{ color: kategoriColor }} />}
              iconBgColor={`color-mix(in srgb, ${kategoriColor} 15%, transparent)`}
              columns={[
                {
                  value: event.judul,
                  subValue: formatEventDate(event.tanggal_mulai, event.tanggal_selesai),
                },
              ]}
              badge={{
                label: event.kalender_kategori?.nama || 'Lainnya',
                variant: 'secondary',
              }}
              onClick={() => onEventClick(event.id)}
            />
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
            <p className="text-xs text-muted-foreground">
              Menampilkan {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, sortedEvents.length)} dari {sortedEvents.length} agenda
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
