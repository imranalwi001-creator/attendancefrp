import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, Calendar, FileText, Plus } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import PageHeader from '@/components/layout/PageHeader';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import AcademicCalendar from '@/components/kalender/AcademicCalendar';
import EventListTab from '@/components/kalender/EventListTab';
import { AddEventModal } from '@/components/kalender/AddEventModal';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
  odd_semester_start: string;
  odd_semester_end: string;
  even_semester_start: string;
  even_semester_end: string;
}
export default function AdminKalenderPendidikan() {
  const {
    activeAcademicYear,
    getCurrentSemester
  } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const today = new Date();
  const [activeTab, setActiveTab] = useState('kalender');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);

  // Fetch all academic years
  const {
    data: academicYears = [],
    isLoading
  } = useQuery({
    queryKey: ['kalender-academic-years'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('academic_years').select('id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end').order('is_active', {
        ascending: false
      }).order('name', {
        ascending: false
      });
      if (error) throw error;
      return data as AcademicYear[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'd MMMM yyyy', {
      locale: localeId
    });
  };
  const isCurrentPeriod = (start: string, end: string) => {
    try {
      return isWithinInterval(today, {
        start: parseISO(start),
        end: parseISO(end)
      });
    } catch {
      return false;
    }
  };
  if (isLoading) {
    return <div className="space-y-6 p-4 pb-24">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>;
  }
  return <div className="space-y-6 p-4 pb-24 px-0 py-0">
      {/* Header */}
      <PageHeader title="Kalender Pendidikan" subtitle={<BadgeTahunAjaran />}>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tambah Agenda</span>
        </Button>
      </PageHeader>

      {/* Add Event Modal */}
      <AddEventModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} initialDate={new Date()} />

      {/* Tabs — Panel variant (Design System) */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList variant="panel" className="rounded-b-none border-b-0">
            <TabsTrigger value="kalender" variant="panel">
              <Calendar className="h-4 w-4" strokeWidth={1.75} />
              <span>Kalender</span>
            </TabsTrigger>
            <TabsTrigger value="uraian" variant="panel">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              <span>Uraian Kegiatan</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Kalender */}
          <TabsContent value="kalender" className="mt-0">
            <div className="p-4">
              <AcademicCalendar currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
            </div>
          </TabsContent>

          {/* Tab: Uraian Kegiatan */}
          <TabsContent value="uraian" className="mt-0">
            <div className="p-4">
              <EventListTab filterMonth={currentMonth} onMonthChange={setCurrentMonth} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}