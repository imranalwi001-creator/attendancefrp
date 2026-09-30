import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  isAfter,
  format,
} from 'date-fns';

// Parse date string (YYYY-MM-DD) to local Date without timezone shift
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export interface KalenderKategori {
  id: string;
  nama: string;
  warna: string;
  deskripsi: string | null;
}

export interface KalenderEvent {
  id: string;
  judul: string;
  deskripsi: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  kategori_id: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_end_date: string | null;
  academic_year_id: string | null;
  kalender_kategori: KalenderKategori | null;
  status: string;
  pic_id: string | null;
  document_url: string | null;
  document_name: string | null;
  created_by: string | null;
}

export interface RenderedEvent {
  id: string;
  originalId: string;
  judul: string;
  deskripsi: string | null;
  date: Date;
  isMultiDay: boolean;
  isStart: boolean;
  isEnd: boolean;
  warna: string;
  kategoriNama: string;
}

// Generate recurring event instances for a given month
function generateRecurringInstances(
  event: KalenderEvent,
  monthStart: Date,
  monthEnd: Date
): RenderedEvent[] {
  const instances: RenderedEvent[] = [];
  const eventStart = parseLocalDate(event.tanggal_mulai);
  const eventEnd = parseLocalDate(event.tanggal_selesai);
  const recurrenceEnd = event.recurrence_end_date ? parseLocalDate(event.recurrence_end_date) : addYears(monthEnd, 1);
  const eventDuration = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));
  
  const warna = event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)';
  const kategoriNama = event.kalender_kategori?.nama || 'Lainnya';

  let currentStart = new Date(eventStart);
  let iterationCount = 0;
  const maxIterations = 365; // Safety limit

  while (isBefore(currentStart, monthEnd) && isBefore(currentStart, recurrenceEnd) && iterationCount < maxIterations) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + eventDuration);

    // Check if this instance overlaps with the visible month
    if (isAfter(currentEnd, monthStart) || isSameDay(currentEnd, monthStart)) {
      const daysInRange = eachDayOfInterval({
        start: isBefore(currentStart, monthStart) ? monthStart : currentStart,
        end: isAfter(currentEnd, monthEnd) ? monthEnd : currentEnd,
      });

      daysInRange.forEach((date, index) => {
        instances.push({
          id: `${event.id}-${currentStart.toISOString()}-${date.toISOString()}`,
          originalId: event.id,
          judul: event.judul,
          deskripsi: event.deskripsi,
          date,
          isMultiDay: eventDuration > 0,
          isStart: index === 0 && isSameDay(currentStart, date),
          isEnd: index === daysInRange.length - 1 && isSameDay(currentEnd, date),
          warna,
          kategoriNama,
        });
      });
    }

    // Move to next occurrence
    switch (event.recurrence_type) {
      case 'mingguan':
        currentStart = addWeeks(currentStart, 1);
        break;
      case 'bulanan':
        currentStart = addMonths(currentStart, 1);
        break;
      case 'tahunan':
        currentStart = addYears(currentStart, 1);
        break;
      default:
        iterationCount = maxIterations; // Exit loop for unknown type
    }
    iterationCount++;
  }

  return instances;
}

// Generate single/multi-day event instances for a given month
function generateSingleEventInstances(
  event: KalenderEvent,
  monthStart: Date,
  monthEnd: Date
): RenderedEvent[] {
  const instances: RenderedEvent[] = [];
  const eventStart = parseLocalDate(event.tanggal_mulai);
  const eventEnd = parseLocalDate(event.tanggal_selesai);
  
  const warna = event.kalender_kategori?.warna || 'hsl(174, 85%, 34%)';
  const kategoriNama = event.kalender_kategori?.nama || 'Lainnya';

  // Check if event overlaps with visible month
  if (isAfter(eventEnd, monthStart) || isSameDay(eventEnd, monthStart)) {
    if (isBefore(eventStart, monthEnd) || isSameDay(eventStart, monthEnd)) {
      const visibleStart = isBefore(eventStart, monthStart) ? monthStart : eventStart;
      const visibleEnd = isAfter(eventEnd, monthEnd) ? monthEnd : eventEnd;

      const daysInRange = eachDayOfInterval({ start: visibleStart, end: visibleEnd });
      const isMultiDay = !isSameDay(eventStart, eventEnd);

      daysInRange.forEach((date, index) => {
        instances.push({
          id: `${event.id}-${date.toISOString()}`,
          originalId: event.id,
          judul: event.judul,
          deskripsi: event.deskripsi,
          date,
          isMultiDay,
          isStart: isSameDay(date, eventStart),
          isEnd: isSameDay(date, eventEnd),
          warna,
          kategoriNama,
        });
      });
    }
  }

  return instances;
}

export function useKalenderKategori() {
  return useQuery({
    queryKey: ['kalender-kategori'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kalender_kategori')
        .select('id, nama, warna, deskripsi')
        .order('nama')
        .limit(50);
      if (error) throw error;
      return data as KalenderKategori[];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

export function useKalenderEvents(currentMonth: Date) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  return useQuery({
    queryKey: ['kalender-events', monthStart.toISOString()],
    queryFn: async () => {
      // Fetch events that could be visible in this month - OPTIMIZED
      const { data, error } = await supabase
        .from('kalender_events')
        .select(`
          id, judul, deskripsi, tanggal_mulai, tanggal_selesai, kategori_id, 
          is_recurring, recurrence_type, recurrence_end_date, academic_year_id, 
          status, pic_id, document_url, document_name, created_by,
          kalender_kategori (id, nama, warna, deskripsi)
        `)
        .eq('status', 'approved')
        .or(`tanggal_selesai.gte.${monthStart.toISOString().split('T')[0]},is_recurring.eq.true`)
        .limit(200);
      
      if (error) throw error;
      return data as KalenderEvent[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

export function useRenderedEvents(currentMonth: Date, events: KalenderEvent[] | undefined) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  if (!events) return new Map<string, RenderedEvent[]>();

  const eventsByDate = new Map<string, RenderedEvent[]>();

  events.forEach(event => {
    let instances: RenderedEvent[];
    
    if (event.is_recurring && event.recurrence_type) {
      instances = generateRecurringInstances(event, monthStart, monthEnd);
    } else {
      instances = generateSingleEventInstances(event, monthStart, monthEnd);
    }

    instances.forEach(instance => {
      const dateKey = format(instance.date, 'yyyy-MM-dd');
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey)!.push(instance);
    });
  });

  return eventsByDate;
}
