import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth, getMonth, getYear, setMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, Trash2, Pencil, CalendarIcon, X, Settings, FileText, ExternalLink, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListCard } from '@/components/ui/list-card';
import { ActionButtonGroup, DetailButton, DeleteButton } from '@/components/ui/action-buttons';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useKalenderKategori, KalenderKategori } from '@/hooks/useKalenderEvents';
import { AddEventModal, EventToEdit } from './AddEventModal';
import { logActivity } from '@/lib/activityLogger';

interface StaffProfile {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  position: string | null;
  profiles: StaffProfile | null;
}

interface KalenderEventRow {
  id: string;
  judul: string;
  deskripsi: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  kategori_id: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_end_date: string | null;
  kalender_kategori: KalenderKategori | null;
  pic_id: string | null;
  status: string;
  document_url: string | null;
  document_name: string | null;
  created_by: string | null;
  staff: Staff | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'pending' }> = {
  pending: { label: 'Ditangguhkan', variant: 'warning' },
  approved: { label: 'Disetujui', variant: 'success' },
  rejected: { label: 'Ditolak', variant: 'destructive' },
  postponed: { label: 'Ditunda', variant: 'secondary' },
};

const ITEMS_PER_PAGE = 10;

interface EventListTabProps {
  isStaffView?: boolean;
  filterMonth?: Date | null;
  onMonthChange?: (month: Date | null) => void;
}

export default function EventListTab({ isStaffView = false, filterMonth = null, onMonthChange }: EventListTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<EventToEdit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Use filterMonth from parent if provided
  const selectedMonth = filterMonth;

  // Fetch categories
  const { data: categories = [] } = useKalenderKategori();

  // Fetch all events
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['kalender-events-list', isStaffView],
    queryFn: async () => {
      let query = supabase
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
          pic_id,
          status,
          document_url,
          document_name,
          created_by,
          kalender_kategori (
            id,
            nama,
            warna,
            deskripsi
          ),
          staff (
            id,
            position,
            profiles (
              id,
              name
            )
          )
        `)
        .order('tanggal_mulai', { ascending: false });
      
      // Filter by created_by for staff view
      if (isStaffView) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq('created_by', user.id);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as KalenderEventRow[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('kalender_events')
        .delete()
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Get the deleted event info for logging
      const deletedEvent = allEvents.find(e => e.id === deleteEventId);
      
      logActivity({
        action: 'calendar_agenda_delete',
        category: 'calendar',
        description: `Menghapus agenda Kalender Pendidikan "${deletedEvent?.judul || ''}"`,
        metadata: { eventId: deleteEventId, judul: deletedEvent?.judul }
      });
      
      queryClient.invalidateQueries({ queryKey: ['kalender-events'] });
      queryClient.invalidateQueries({ queryKey: ['kalender-events-list'] });
      toast.success('Agenda berhasil dihapus');
      setDeleteEventId(null);
    },
    onError: (error) => {
      toast.error('Gagal menghapus agenda: ' + error.message);
    },
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        event.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase());

      // Month filter
      let matchesMonth = true;
      if (selectedMonth) {
        const eventStart = parseISO(event.tanggal_mulai);
        const eventEnd = parseISO(event.tanggal_selesai);
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        matchesMonth = eventStart <= monthEnd && eventEnd >= monthStart;
      }

      // Category filter
      const matchesCategory =
        selectedCategories.length === 0 ||
        (event.kategori_id && selectedCategories.includes(event.kategori_id));

      return matchesSearch && matchesMonth && matchesCategory;
    });
  }, [allEvents, searchQuery, selectedMonth, selectedCategories]);

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, currentPage]);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMonth, selectedCategories]);

  // Format date range
  const formatEventDate = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    
    if (start === end) {
      return format(startDate, 'd MMM yyyy', { locale: localeId });
    }
    
    if (getMonth(startDate) === getMonth(endDate) && getYear(startDate) === getYear(endDate)) {
      return `${format(startDate, 'd', { locale: localeId })} - ${format(endDate, 'd MMM yyyy', { locale: localeId })}`;
    }
    
    return `${format(startDate, 'd MMM yyyy', { locale: localeId })} - ${format(endDate, 'd MMM yyyy', { locale: localeId })}`;
  };

  // Recurrence label
  const getRecurrenceLabel = (type: string) => {
    switch (type) {
      case 'mingguan':
        return 'Mingguan';
      case 'bulanan':
        return 'Bulanan';
      case 'tahunan':
        return 'Tahunan';
      default:
        return type;
    }
  };

  // Check if any filters are active (excluding parent-controlled month filter)
  const hasActiveFilters = searchQuery || selectedCategories.length > 0;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
  };

  // Pagination rendering
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => setCurrentPage(i)}
              isActive={currentPage === i}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            onClick={() => setCurrentPage(1)}
            isActive={currentPage === 1}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if needed
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => setCurrentPage(i)}
              isActive={currentPage === i}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if needed
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Always show last page
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            onClick={() => setCurrentPage(totalPages)}
            isActive={currentPage === totalPages}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari agenda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          {/* Month Filter Dropdown */}
          {onMonthChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {selectedMonth ? format(selectedMonth, 'MMMM yyyy', { locale: localeId }) : 'Semua Bulan'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto bg-popover">
                <DropdownMenuCheckboxItem
                  checked={!selectedMonth}
                  onCheckedChange={() => onMonthChange(null)}
                >
                  Semua Bulan
                </DropdownMenuCheckboxItem>
                {[
                  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ].map((monthName, idx) => (
                  <DropdownMenuCheckboxItem
                    key={idx}
                    checked={selectedMonth ? getMonth(selectedMonth) === idx : false}
                    onCheckedChange={() => {
                      const newDate = setMonth(new Date(), idx);
                      onMonthChange(newDate);
                    }}
                  >
                    {monthName}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Month Badge - show when no onMonthChange callback */}
          {selectedMonth && !onMonthChange && (
            <Badge variant="secondary" className="py-2 px-3 text-sm font-medium">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              {format(selectedMonth, 'MMMM yyyy', { locale: localeId })}
            </Badge>
          )}

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  selectedCategories.length > 0 && 'text-primary'
                )}
              >
                Kategori
                {selectedCategories.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {selectedCategories.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.id}
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCategories([...selectedCategories, category.id]);
                    } else {
                      setSelectedCategories(selectedCategories.filter((id) => id !== category.id));
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.warna }}
                    />
                    {category.nama}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Settings Kategori - Admin only */}
          {!isStaffView && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate('/admin/kalender/kategori')}
              title="Pengaturan Kategori"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Card List */}
        <div className="space-y-3">
          {paginatedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              {hasActiveFilters
                ? 'Tidak ada agenda yang sesuai dengan filter'
                : 'Belum ada agenda'}
            </div>
          ) : (
            paginatedEvents.map((event) => (
              <ListCard
                key={event.id}
                icon={<CalendarIcon className="h-5 w-5 text-primary" />}
                iconBgColor="hsl(var(--primary) / 0.1)"
                columns={[
                  {
                    value: event.judul,
                    subValue: (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs">{formatEventDate(event.tanggal_mulai, event.tanggal_selesai)}</span>
                        {event.is_recurring && event.recurrence_type && (
                          <Badge variant="outline" className="text-xs">
                            {getRecurrenceLabel(event.recurrence_type)}
                          </Badge>
                        )}
                      </div>
                    ),
                  },
                  {
                    label: 'PIC',
                    value: event.staff?.profiles?.name || '-',
                    width: '150px',
                  },
                  {
                    label: 'Status',
                    value: (
                      <Badge 
                        variant={STATUS_CONFIG[event.status]?.variant || 'secondary'}
                      >
                        {STATUS_CONFIG[event.status]?.label || event.status}
                      </Badge>
                    ),
                    width: '120px',
                  },
                ]}
                actions={
                  <ActionButtonGroup>
                    {/* Document Link */}
                    {event.document_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(event.document_url!, '_blank');
                        }}
                        title={event.document_name || 'Lihat dokumen'}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {!isStaffView && (
                      <DeleteButton
                        onClick={() => setDeleteEventId(event.id)}
                      />
                    )}
                    <DetailButton
                      onClick={() => {
                        setEditEvent({
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
                        });
                        setIsEditModalOpen(true);
                      }}
                    />
                  </ActionButtonGroup>
                }
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} dari{' '}
              {filteredEvents.length} agenda
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEventId} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Agenda</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus agenda ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEventId && deleteMutation.mutate(deleteEventId)}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <AddEventModal
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) setEditEvent(null);
        }}
        eventToEdit={editEvent}
        readOnly={isStaffView}
        isAdminView={!isStaffView}
      />
    </Card>
  );
}