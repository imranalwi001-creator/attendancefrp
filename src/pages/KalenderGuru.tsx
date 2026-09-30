import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, FileText, Plus } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import AcademicCalendar from '@/components/kalender/AcademicCalendar';
import EventListTab from '@/components/kalender/EventListTab';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { StaffAddEventModal } from '@/components/kalender/StaffAddEventModal';
export default function KalenderGuru() {
  const {
    user
  } = useAuth();
  const {
    activeAcademicYear
  } = useAcademicYear();
  const [activeTab, setActiveTab] = useState('kalender');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);

  // Restrict access for guru_ekskul role
  if (user?.role === 'guru_ekskul') {
    return <Navigate to="/app/dashboard" replace />;
  }

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
      }).limit(10);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false
  });
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
          <span className="hidden sm:inline">Ajukan Agenda</span>
        </Button>
      </PageHeader>

      {/* Add Event Modal for Staff */}
      <StaffAddEventModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} initialDate={new Date()} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="admin" className="grid-cols-2">
          <TabsTrigger value="kalender" variant="admin" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Kalender</span>
          </TabsTrigger>
          <TabsTrigger value="uraian" variant="admin" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Ajukan Agenda </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kalender" className="mt-4">
          <AcademicCalendar isStaffView currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
        </TabsContent>

        <TabsContent value="uraian" className="mt-4">
          <EventListTab isStaffView filterMonth={currentMonth} onMonthChange={setCurrentMonth} />
        </TabsContent>
      </Tabs>
    </div>;
}