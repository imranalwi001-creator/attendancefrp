import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Eye, Trash2, Calendar as CalendarIcon, Upload, X, FileText, Clock, CheckCircle, XCircle, ClipboardList, Search, SlidersHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import { FormDrawer } from '@/components/ui/form-drawer';
import PageHeader from '@/components/layout/PageHeader';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import { StatCard } from '@/components/dashboard';

type JenisIzin = 'sakit' | 'izin' | 'cuti' | 'dinas_luar' | 'lainnya';
type StatusIzin = 'pending' | 'approved' | 'rejected';

interface IzinStaff {
  id: string;
  staff_id: string;
  jenis_izin: JenisIzin;
  tanggal_mulai: string;
  tanggal_selesai: string;
  keterangan: string | null;
  lampiran_url: string | null;
  status: StatusIzin;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

const jenisIzinLabels: Record<JenisIzin, string> = {
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  dinas_luar: 'Dinas Luar',
  lainnya: 'Lainnya'
};

const getStatusBadge = (status: StatusIzin) => {
  switch (status) {
    case 'approved':
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Disetujui</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Ditolak</Badge>;
    default:
      return <Badge variant="secondary">Menunggu</Badge>;
  }
};

const getJenisIzinBadge = (jenis: JenisIzin) => {
  const colors: Record<JenisIzin, string> = {
    sakit: 'bg-red-500/10 text-red-600 border-red-500/20',
    izin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    cuti: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    dinas_luar: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    lainnya: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  };
  return <Badge className={colors[jenis]}>{jenisIzinLabels[jenis]}</Badge>;
};

export default function PengajuanIzinGuru() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState<IzinStaff | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    jenis_izin: 'izin' as JenisIzin,
    tanggal_mulai: format(new Date(), 'yyyy-MM-dd'),
    tanggal_selesai: format(new Date(), 'yyyy-MM-dd'),
    keterangan: '',
    lampiran_url: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  // Calculate date range based on created_at (when submitted)
  const getDateRange = () => {
    const todayDate = new Date();
    switch (dateRange) {
      case 'today':
        return { start: format(todayDate, 'yyyy-MM-dd'), end: format(todayDate, 'yyyy-MM-dd') };
      case 'last-7-days':
        return { start: format(subDays(todayDate, 7), 'yyyy-MM-dd'), end: format(todayDate, 'yyyy-MM-dd') };
      case 'last-30-days':
        return { start: format(subDays(todayDate, 30), 'yyyy-MM-dd'), end: format(todayDate, 'yyyy-MM-dd') };
      case 'this-month':
        return { start: format(startOfMonth(todayDate), 'yyyy-MM-dd'), end: format(endOfMonth(todayDate), 'yyyy-MM-dd') };
      case 'all':
      default:
        return { start: null, end: null };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Fetch current user's staff ID
  const { data: staffId } = useQuery({
    queryKey: ['current-staff-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('staff')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      return data?.id || user.id;
    },
    enabled: !!user?.id
  });

  // Fetch user's own izin data
  const { data: izinData = [], isLoading } = useQuery({
    queryKey: ['my-pengajuan-izin', staffId, startDate, endDate],
    queryFn: async () => {
      if (!staffId) return [];
      
      let query = supabase
        .from('pengajuan_izin_staff')
        .select('id, staff_id, jenis_izin, tanggal_mulai, tanggal_selesai, keterangan, lampiran_url, status, approved_by, approved_at, created_at')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false });
      
      // Apply date filter based on created_at if not showing all
      if (startDate && endDate) {
        query = query
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching izin:', error);
        return [];
      }
      return data as IzinStaff[];
    },
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Filter data
  const filteredData = useMemo(() => {
    return izinData.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      // Search filter - search by jenis izin or keterangan
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const jenisLabel = jenisIzinLabels[item.jenis_izin].toLowerCase();
        const keterangan = (item.keterangan || '').toLowerCase();
        if (!jenisLabel.includes(search) && !keterangan.includes(search)) return false;
      }
      return true;
    });
  }, [izinData, statusFilter, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = izinData.length;
    const pending = izinData.filter(i => i.status === 'pending').length;
    const approved = izinData.filter(i => i.status === 'approved').length;
    const rejected = izinData.filter(i => i.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [izinData]);

  // Create izin mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!staffId) throw new Error('Staff ID not found');
      
      const { error } = await supabase
        .from('pengajuan_izin_staff')
        .insert({
          staff_id: staffId,
          jenis_izin: data.jenis_izin,
          tanggal_mulai: data.tanggal_mulai,
          tanggal_selesai: data.tanggal_selesai,
          keterangan: data.keterangan || null,
          lampiran_url: data.lampiran_url || null,
          status: 'pending'
        });
      if (error) throw error;

      // Send push notification to all admins
      // Note: In-app notifications are handled by database trigger (notify_pengajuan_izin_staff)
      try {
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (adminRoles && adminRoles.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', staffId)
            .single();
          
          const staffName = profile?.name || 'Staff';
          const message = `${staffName} mengajukan izin ${jenisIzinLabels[data.jenis_izin]} (${format(parseISO(data.tanggal_mulai), 'dd MMM yyyy', { locale: idLocale })} - ${format(parseISO(data.tanggal_selesai), 'dd MMM yyyy', { locale: idLocale })})`;

          // Send push notification to each admin
          for (const admin of adminRoles) {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: admin.user_id,
                title: 'Pengajuan Izin Baru',
                message,
                url: '/admin/pengajuan-izin',
                tag: `izin-new-${Date.now()}`
              }
            });
          }
        }
      } catch (notifError) {
        console.error('Failed to send push notification:', notifError);
      }
    },
    onSuccess: () => {
      toast.success('Pengajuan izin berhasil dikirim');
      logActivity({
        action: 'leave_add',
        category: 'leave_request',
        description: `Mengajukan izin ${jenisIzinLabels[formData.jenis_izin]}`,
        metadata: { jenisIzin: formData.jenis_izin, tanggalMulai: formData.tanggal_mulai, tanggalSelesai: formData.tanggal_selesai }
      });
      queryClient.invalidateQueries({ queryKey: ['my-pengajuan-izin'] });
      setFormOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Gagal mengirim: ${error.message}`);
    }
  });

  // Delete izin mutation (only for pending status)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pengajuan_izin_staff')
        .delete()
        .eq('id', id)
        .eq('status', 'pending'); // Only allow delete if still pending
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pengajuan izin berhasil dihapus');
      logActivity({
        action: 'leave_delete',
        category: 'leave_request',
        description: `Menghapus pengajuan izin`,
        metadata: {}
      });
      queryClient.invalidateQueries({ queryKey: ['my-pengajuan-izin'] });
      setDeleteOpen(false);
      setSelectedIzin(null);
    },
    onError: (error: any) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      jenis_izin: 'izin',
      tanggal_mulai: format(new Date(), 'yyyy-MM-dd'),
      tanggal_selesai: format(new Date(), 'yyyy-MM-dd'),
      keterangan: '',
      lampiran_url: ''
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `izin-lampiran/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('user-documents')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, lampiran_url: urlData.publicUrl }));
      toast.success('File berhasil diunggah');
    } catch (error: any) {
      toast.error(`Gagal mengunggah: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.tanggal_selesai < formData.tanggal_mulai) {
      toast.error('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (selectedIzin) {
      deleteMutation.mutate(selectedIzin.id);
    }
  };

  const statCards = [
    { icon: ClipboardList, label: 'Total Pengajuan', value: stats.total },
    { icon: Clock, label: 'Menunggu', value: stats.pending },
    { icon: CheckCircle, label: 'Disetujui', value: stats.approved },
    { icon: XCircle, label: 'Ditolak', value: stats.rejected },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <PageHeader 
        title="Pengajuan Izin" 
        subtitle="Kelola pengajuan izin Anda"
      >
        <Button onClick={() => setFormOpen(true)} className="rounded-xl w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Ajukan Izin
        </Button>
      </PageHeader>

      {/* Stats Cards - Same style as Admin Dashboard */}
      <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            animationDelay={index * 100}
          />
        ))}
      </div>

      {/* Filters & List Card */}
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-2xl animate-fade-in" style={{ animationDelay: '400ms' }}>
        <CardContent className="p-6 space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full rounded-xl"
              />
            </div>
            
            {/* Mobile Filter Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden rounded-xl shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Filter</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Periode</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Periode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        <SelectItem value="today">Hari Ini</SelectItem>
                        <SelectItem value="last-7-days">7 Hari</SelectItem>
                        <SelectItem value="last-30-days">30 Hari</SelectItem>
                        <SelectItem value="this-month">Bulan Ini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="pending">Menunggu</SelectItem>
                        <SelectItem value="approved">Disetujui</SelectItem>
                        <SelectItem value="rejected">Ditolak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[130px] rounded-xl">
                  <SelectValue placeholder="Periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="last-7-days">7 Hari</SelectItem>
                  <SelectItem value="last-30-days">30 Hari</SelectItem>
                  <SelectItem value="this-month">Bulan Ini</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center">
              <div className="rounded-full p-4 mx-auto w-fit mb-4" style={{ backgroundColor: '#E7F6F8' }}>
                <div className="rounded-full p-3" style={{ backgroundColor: '#0DA8B6' }}>
                  <FileText className="h-8 w-8 text-white" />
                </div>
              </div>
              <p className="text-muted-foreground mb-4">Belum ada pengajuan izin</p>
              {user?.role !== 'staff' && (
                <Button variant="outline" className="rounded-xl" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajukan Izin
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredData.map((izin, index) => (
                <Card 
                  key={izin.id} 
                  className="border hover:border-primary/30 cursor-pointer hover:shadow-md transition-all duration-300 rounded-xl animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => {
                    setSelectedIzin(izin);
                    setDetailOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-4">
                        <div 
                          className="rounded-full p-3 shrink-0" 
                          style={{ backgroundColor: '#E7F6F8' }}
                        >
                          <div 
                            className="rounded-full p-2" 
                            style={{ backgroundColor: '#0DA8B6' }}
                          >
                            <CalendarIcon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {getJenisIzinBadge(izin.jenis_izin)}
                            {getStatusBadge(izin.status)}
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            {format(parseISO(izin.tanggal_mulai), 'd MMM yyyy', { locale: idLocale })}
                            {izin.tanggal_mulai !== izin.tanggal_selesai && (
                              <> - {format(parseISO(izin.tanggal_selesai), 'd MMM yyyy', { locale: idLocale })}</>
                            )}
                          </p>
                          {izin.keterangan && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{izin.keterangan}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {izin.lampiran_url && (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Drawer */}
      <FormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Ajukan Izin"
        description="Isi form berikut untuk mengajukan izin"
        onSubmit={handleSubmit}
        submitLabel="Kirim Pengajuan"
        loading={createMutation.isPending}
      >
        <div className="space-y-4">
          {/* Jenis Izin */}
          <div className="space-y-2">
            <Label>Jenis Izin <span className="text-destructive">*</span></Label>
            <Select 
              value={formData.jenis_izin} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, jenis_izin: v as JenisIzin }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(jenisIzinLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tanggal Mulai */}
          <div className="space-y-2">
            <Label>Tanggal Mulai <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal rounded-xl">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(parseISO(formData.tanggal_mulai), 'd MMMM yyyy', { locale: idLocale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(formData.tanggal_mulai)}
                  onSelect={(date) => date && setFormData(prev => ({ 
                    ...prev, 
                    tanggal_mulai: format(date, 'yyyy-MM-dd'),
                    tanggal_selesai: prev.tanggal_selesai < format(date, 'yyyy-MM-dd') ? format(date, 'yyyy-MM-dd') : prev.tanggal_selesai
                  }))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tanggal Selesai */}
          <div className="space-y-2">
            <Label>Tanggal Selesai <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal rounded-xl">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(parseISO(formData.tanggal_selesai), 'd MMMM yyyy', { locale: idLocale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(formData.tanggal_selesai)}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, tanggal_selesai: format(date, 'yyyy-MM-dd') }))}
                  disabled={(date) => date < parseISO(formData.tanggal_mulai)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Keterangan */}
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Textarea
              value={formData.keterangan}
              onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
              placeholder="Alasan mengajukan izin..."
              rows={3}
              className="rounded-xl"
            />
          </div>

          {/* Lampiran */}
          <div className="space-y-2">
            <Label>Lampiran (Opsional)</Label>
            {formData.lampiran_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm flex-1 truncate">File terlampir</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, lampiran_url: '' }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button type="button" variant="outline" className="w-full rounded-xl" disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Mengunggah...' : 'Unggah File'}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Format: PDF, JPG, PNG (maks. 5MB)</p>
          </div>
        </div>
      </FormDrawer>

      {/* Detail Drawer */}
      <FormDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Detail Pengajuan"
        showFooter={false}
      >
        {selectedIzin && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {getJenisIzinBadge(selectedIzin.jenis_izin)}
              {getStatusBadge(selectedIzin.status)}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tanggal</Label>
                <p className="text-sm font-medium">
                  {format(parseISO(selectedIzin.tanggal_mulai), 'd MMMM yyyy', { locale: idLocale })}
                  {selectedIzin.tanggal_mulai !== selectedIzin.tanggal_selesai && (
                    <> - {format(parseISO(selectedIzin.tanggal_selesai), 'd MMMM yyyy', { locale: idLocale })}</>
                  )}
                </p>
              </div>

              {selectedIzin.keterangan && (
                <div>
                  <Label className="text-xs text-muted-foreground">Keterangan</Label>
                  <p className="text-sm">{selectedIzin.keterangan}</p>
                </div>
              )}

              {selectedIzin.lampiran_url && (
                <div>
                  <Label className="text-xs text-muted-foreground">Lampiran</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-1 rounded-xl"
                    onClick={() => window.open(selectedIzin.lampiran_url!, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Lihat Lampiran
                  </Button>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Diajukan pada</Label>
                <p className="text-sm">
                  {format(parseISO(selectedIzin.created_at), 'd MMMM yyyy, HH:mm', { locale: idLocale })}
                </p>
              </div>

              {selectedIzin.approved_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {selectedIzin.status === 'approved' ? 'Disetujui pada' : 'Ditolak pada'}
                  </Label>
                  <p className="text-sm">
                    {format(parseISO(selectedIzin.approved_at), 'd MMMM yyyy, HH:mm', { locale: idLocale })}
                  </p>
                </div>
              )}
            </div>

            {/* Delete Button - Only for pending status */}
            {selectedIzin.status === 'pending' && (
              <div className="pt-4 border-t">
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl"
                  onClick={() => {
                    setDetailOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Pengajuan
                </Button>
              </div>
            )}
          </div>
        )}
      </FormDrawer>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengajuan?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengajuan izin ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
