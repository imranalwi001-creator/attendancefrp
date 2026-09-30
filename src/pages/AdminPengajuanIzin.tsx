import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, FileText, Calendar as CalendarIcon, ExternalLink, AlertCircle, Users, Upload, X, Pencil, Trash2, Check, ChevronsUpDown, Filter } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ActionButtonGroup, DetailButton, DeleteButton } from '@/components/ui/action-buttons';
import { format, parseISO, subDays, startOfMonth, endOfMonth, addDays, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { FormDrawer } from '@/components/ui/form-drawer';
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
  staff?: {
    id: string;
    position: string | null;
    profiles?: {
      name: string;
    };
  };
  user_roles?: {
    role: string;
  }[];
}

interface IzinSantri {
  id: string;
  santri_id: string;
  jenis_izin: JenisIzin;
  tanggal_mulai: string;
  tanggal_selesai: string;
  keterangan: string | null;
  lampiran_url: string | null;
  status: StatusIzin;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  santri?: {
    id: string;
    kelas?: {
      nama: string;
    };
    profiles?: {
      id: string;
      name: string;
    };
  };
}

const jenisIzinLabels: Record<JenisIzin, string> = {
  sakit: 'Sakit',
  izin: 'Izin',
  cuti: 'Cuti',
  dinas_luar: 'Dinas Luar',
  lainnya: 'Lainnya'
};

const statusLabels: Record<StatusIzin, string> = {
  pending: 'Menunggu Konfirmasi',
  approved: 'Terkonfirmasi',
  rejected: 'Ditolak'
};

const getRoleBadgeVariant = (role: string) => {
  const variants: Record<string, any> = {
    admin: 'role-admin',
    guru: 'role-guru',
    walikelas: 'role-walikelas',
    Pembina: 'role-pembina',
    staff: 'role-staff',
    guru_ekskul: 'role-guru'
  };
  return variants[role] || 'secondary';
};

const getRoleLabel = (role: string | null | undefined): string => {
  if (!role) return '-';
  const labels: Record<string, string> = {
    admin: 'Administrator',
    guru: 'Guru',
    walikelas: 'Wali Kelas',
    Pembina: 'Pembina',
    staff: 'Staff',
    guru_ekskul: 'Guru Ekskul'
  };
  return labels[role] || role;
};

const ITEMS_PER_PAGE = 10;

export default function AdminPengajuanIzin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'staff' | 'santri'>('staff');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState<IzinStaff | IzinSantri | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  
  // Form states
  const [formData, setFormData] = useState({
    user_id: '',
    jenis_izin: 'izin' as JenisIzin,
    status: 'pending' as StatusIzin,
    tanggal_mulai: format(new Date(), 'yyyy-MM-dd'),
    tanggal_selesai: format(new Date(), 'yyyy-MM-dd'),
    keterangan: '',
    lampiran_url: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  // Calculate date range
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
      default:
        return { start: format(startOfMonth(todayDate), 'yyyy-MM-dd'), end: format(endOfMonth(todayDate), 'yyyy-MM-dd') };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Fetch staff list for dropdown with role - show ALL staff
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-dropdown-with-role'],
    queryFn: async () => {
      // Get all staff with profiles
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select(`
          id,
          profiles!staff_id_fkey(id, name)
        `);
      
      if (staffError) {
        console.error('Error fetching staff:', staffError);
        return [];
      }

      // Get roles for these staff
      const staffIds = staffData?.map(s => s.id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', staffIds);
      
      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
      
      // Return ALL staff, don't filter by role
      return staffData
        ?.map((s: any) => ({
          id: s.id,
          name: s.profiles?.name || 'Unknown',
          role: rolesMap.get(s.id) || '-'
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) || [];
    }
  });

  // Fetch santri list for dropdown with kelas
  const { data: santriList = [] } = useQuery({
    queryKey: ['santri-dropdown-with-kelas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri')
        .select(`
          id,
          profiles!santri_id_fkey(id, name),
          kelas!santri_kelas_id_fkey(id, nama)
        `);
      
      if (error) {
        console.error('Error fetching santri:', error);
        return [];
      }
      
      return data?.map((s: any) => ({
        id: s.id,
        name: s.profiles?.name || 'Unknown',
        kelas: s.kelas?.nama || '-'
      })) || [];
    }
  });

  // Fetch staff izin data
  const { data: izinStaffData = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['pengajuan-izin-staff', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengajuan_izin_staff')
        .select(`
          id, staff_id, jenis_izin, tanggal_mulai, tanggal_selesai, keterangan, lampiran_url, status, approved_by, approved_at, created_at,
          staff!pengajuan_izin_staff_staff_id_fkey(
            id,
            position,
            profiles!staff_id_fkey(name)
          )
        `)
        .gte('tanggal_mulai', startDate)
        .lte('tanggal_mulai', endDate)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching staff izin:', error);
        return [];
      }

      // Fetch user roles for each staff
      const staffIds = data.map(item => item.staff_id).filter(Boolean);
      if (staffIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', staffIds);

        // Map roles to izin data
        const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
        return data.map(item => ({
          ...item,
          user_roles: rolesMap.get(item.staff_id) ? [{ role: rolesMap.get(item.staff_id) as string }] : []
        })) as IzinStaff[];
      }

      return data as IzinStaff[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch santri izin data
  const { data: izinSantriData = [], isLoading: isLoadingSantri } = useQuery({
    queryKey: ['pengajuan-izin-santri', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengajuan_izin_santri')
        .select(`
          id, santri_id, jenis_izin, tanggal_mulai, tanggal_selesai, keterangan, lampiran_url, status, approved_by, approved_at, created_at,
          santri!pengajuan_izin_santri_santri_id_fkey(
            id,
            kelas!santri_kelas_id_fkey(nama),
            profiles!santri_id_fkey(id, name)
          )
        `)
        .gte('tanggal_mulai', startDate)
        .lte('tanggal_mulai', endDate)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching santri izin:', error);
        return [];
      }
      return data as IzinSantri[];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Create izin mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData = {
        jenis_izin: data.jenis_izin,
        tanggal_mulai: data.tanggal_mulai,
        tanggal_selesai: data.tanggal_selesai,
        keterangan: data.keterangan || null,
        lampiran_url: data.lampiran_url || null,
        status: data.status,
        approved_by: data.status !== 'pending' ? user?.id : null,
        approved_at: data.status !== 'pending' ? new Date().toISOString() : null
      };

      if (activeTab === 'staff') {
        const { error } = await supabase
          .from('pengajuan_izin_staff')
          .insert({ ...insertData, staff_id: data.user_id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pengajuan_izin_santri')
          .insert({ ...insertData, santri_id: data.user_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Pengajuan izin berhasil ditambahkan');
      
      const userName = activeTab === 'staff' 
        ? staffList.find(s => s.id === formData.user_id)?.name 
        : santriList.find(s => s.id === formData.user_id)?.name;
      
      logActivity({
        action: 'leave_add',
        category: 'leave_request',
        description: `Menambahkan pengajuan izin ${jenisIzinLabels[formData.jenis_izin]} untuk ${activeTab === 'staff' ? 'staff' : 'santri'} ${userName}`,
        metadata: { jenisIzin: formData.jenis_izin, tanggalMulai: formData.tanggal_mulai, tanggalSelesai: formData.tanggal_selesai }
      });
      
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-santri'] });
      setFormOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Gagal menambahkan: ${error.message}`);
    }
  });

  // Helper function to get dates between range
  const getDatesBetween = (startDateStr: string, endDateStr: string): string[] => {
    const dates: string[] = [];
    const start = parseISO(startDateStr);
    const end = parseISO(endDateStr);
    const daysDiff = differenceInDays(end, start);
    
    for (let i = 0; i <= daysDiff; i++) {
      dates.push(format(addDays(start, i), 'yyyy-MM-dd'));
    }
    return dates;
  };

  // Helper function to map jenis_izin to kehadiran status
  // Simpan jenis izin sebenarnya agar tabel kehadiran bisa menampilkan status yang tepat
  const mapJenisIzinToStatus = (jenisIzin: JenisIzin): string => {
    switch (jenisIzin) {
      case 'sakit': return 'sakit';
      case 'izin': return 'izin';
      case 'cuti': return 'cuti';
      case 'dinas_luar': return 'dinas_luar';
      case 'lainnya': return 'izin';
      default: return 'izin';
    }
  };

  // Update status mutation with auto-update attendance
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, type, izinData }: { 
      id: string; 
      status: StatusIzin; 
      type: 'staff' | 'santri';
      izinData?: IzinStaff | IzinSantri;
    }) => {
      const table = type === 'staff' ? 'pengajuan_izin_staff' : 'pengajuan_izin_santri';
      
      // Update status izin
      const { error } = await supabase
        .from(table)
        .update({ 
          status,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;

      // Auto-generate attendance only if status is approved (Terkonfirmasi)
      if (status === 'approved' && izinData) {
        const dates = getDatesBetween(izinData.tanggal_mulai, izinData.tanggal_selesai);
        const kehadiranStatus = mapJenisIzinToStatus(izinData.jenis_izin);

        if (type === 'staff') {
          const staffIzin = izinData as IzinStaff;
          
          // Loop setiap tanggal dalam rentang izin
          for (const date of dates) {
            // Check if record exists for this date
            const { data: existingRecord } = await supabase
              .from('kehadiran_staff')
              .select('id')
              .eq('staff_id', staffIzin.staff_id)
              .eq('tanggal', date)
              .maybeSingle();

            if (existingRecord) {
              // Update existing record dengan status sesuai jenis izin
              // TIDAK mengubah jam_masuk dan jam_pulang
              await supabase
                .from('kehadiran_staff')
                .update({ 
                  status: kehadiranStatus,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingRecord.id);
            } else {
              // Insert new record:
              // - TANPA absen masuk (jam_masuk = null)
              // - TANPA absen pulang (jam_pulang = null)
              // - Dengan status sesuai jenis izin
              await supabase
                .from('kehadiran_staff')
                .insert({
                  staff_id: staffIzin.staff_id,
                  tanggal: date,
                  jam_masuk: null,
                  jam_pulang: null,
                  status: kehadiranStatus
                });
            }
          }

          // Send push notification to staff member
          try {
            const staffName = staffIzin.staff?.profiles?.name || 'Staff';
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: staffIzin.staff_id,
                title: 'Izin Dikonfirmasi',
                message: `Pengajuan izin ${jenisIzinLabels[staffIzin.jenis_izin]} Anda telah dikonfirmasi`,
                url: '/admin/pengajuan-izin',
                tag: `izin-approved-${id}`
              }
            });
            console.log('Push notification sent to staff:', staffIzin.staff_id);
          } catch (pushError) {
            // Don't fail the mutation if push notification fails
            console.error('Failed to send push notification:', pushError);
          }
        } else {
          const santriIzin = izinData as IzinSantri;
          
          // Loop setiap tanggal dalam rentang izin
          for (const date of dates) {
            // Cari semua sesi pembelajaran untuk santri ini pada tanggal tersebut
            const { data: sesiData } = await supabase
              .from('sesi_pembelajaran')
              .select(`
                id,
                jadwal:jadwal_id(kelas_id)
              `)
              .eq('tanggal', date);
            
            if (sesiData && sesiData.length > 0) {
              // Filter sesi yang sesuai dengan kelas santri
              const santriKelasId = santriIzin.santri?.kelas ? 
                (await supabase.from('santri').select('kelas_id').eq('id', santriIzin.santri_id).single()).data?.kelas_id 
                : null;
              
              for (const sesi of sesiData) {
                const jadwal = sesi.jadwal as any;
                if (jadwal?.kelas_id === santriKelasId) {
                  // Check if attendance record exists
                  const { data: existingRecord } = await supabase
                    .from('kehadiran_santri')
                    .select('id')
                    .eq('santri_id', santriIzin.santri_id)
                    .eq('sesi_id', sesi.id)
                    .maybeSingle();

                  if (existingRecord) {
                    await supabase
                      .from('kehadiran_santri')
                      .update({ status: kehadiranStatus })
                      .eq('id', existingRecord.id);
                  } else {
                    await supabase
                      .from('kehadiran_santri')
                      .insert({
                        santri_id: santriIzin.santri_id,
                        sesi_id: sesi.id,
                        status: kehadiranStatus
                      });
                  }
                }
              }
            }
          }

          // Send push notification to santri
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: santriIzin.santri_id,
                title: 'Izin Dikonfirmasi',
                message: `Pengajuan izin ${jenisIzinLabels[santriIzin.jenis_izin]} Anda telah dikonfirmasi`,
                url: '/dashboard',
                tag: `izin-approved-${id}`
              }
            });
          } catch (pushError) {
            console.error('Failed to send push notification to santri:', pushError);
          }
        }
      }

      // Send push notification for rejected status
      if (status === 'rejected' && izinData) {
        const userId = type === 'staff' ? (izinData as IzinStaff).staff_id : (izinData as IzinSantri).santri_id;
        const jenisIzin = izinData.jenis_izin;
        
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              user_id: userId,
              title: 'Izin Ditolak',
              message: `Pengajuan izin ${jenisIzinLabels[jenisIzin]} Anda telah ditolak`,
              url: type === 'staff' ? '/guru/pengajuan-izin' : '/dashboard',
              tag: `izin-rejected-${id}`
            }
          });
        } catch (pushError) {
          console.error('Failed to send push notification for rejection:', pushError);
        }
      }
    },
    onSuccess: (_, variables) => {
      const statusMessage = variables.status === 'approved' 
        ? 'Izin berhasil dikonfirmasi dan absensi diperbarui' 
        : 'Status berhasil diperbarui';
      toast.success(statusMessage);
      
      // Log activity based on status
      const actionType = variables.status === 'approved' ? 'leave_approve' : 'leave_reject';
      const actionDesc = variables.status === 'approved' ? 'mengonfirmasi' : 'menolak';
      
      logActivity({
        action: actionType,
        category: 'leave_request',
        description: `${actionDesc.charAt(0).toUpperCase() + actionDesc.slice(1)} izin ${variables.type === 'staff' ? 'staff' : 'santri'}`,
        metadata: { izinId: variables.id, status: variables.status, type: variables.type }
      });
      
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-santri'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-staff'] });
      setDetailOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Gagal memperbarui: ${error.message}`);
    }
  });

  // Helper function to delete old attendance records
  const deleteOldAttendance = async (
    type: 'staff' | 'santri', 
    userId: string, 
    oldStartDate: string, 
    oldEndDate: string
  ) => {
    const oldDates = getDatesBetween(oldStartDate, oldEndDate);
    
    if (type === 'staff') {
      // Delete staff attendance for old date range
      for (const date of oldDates) {
        await supabase
          .from('kehadiran_staff')
          .delete()
          .eq('staff_id', userId)
          .eq('tanggal', date)
          .not('jam_masuk', 'is', null); // Only delete if actually attended (has jam_masuk)
        
        // For izin records (no jam_masuk), delete them
        await supabase
          .from('kehadiran_staff')
          .delete()
          .eq('staff_id', userId)
          .eq('tanggal', date)
          .is('jam_masuk', null);
      }
    } else {
      // For santri, delete kehadiran_santri records
      // We need to find sesi_ids for those dates first
      for (const date of oldDates) {
        const { data: sesiData } = await supabase
          .from('sesi_pembelajaran')
          .select('id')
          .eq('tanggal', date);
        
        if (sesiData) {
          for (const sesi of sesiData) {
            await supabase
              .from('kehadiran_santri')
              .delete()
              .eq('santri_id', userId)
              .eq('sesi_id', sesi.id);
          }
        }
      }
    }
  };

  // Helper function to generate new attendance records
  const generateNewAttendance = async (
    type: 'staff' | 'santri',
    izinData: IzinStaff | IzinSantri,
    jenisIzin: JenisIzin
  ) => {
    const dates = getDatesBetween(izinData.tanggal_mulai, izinData.tanggal_selesai);
    const kehadiranStatus = mapJenisIzinToStatus(jenisIzin);

    if (type === 'staff') {
      const staffIzin = izinData as IzinStaff;
      for (const date of dates) {
        await supabase
          .from('kehadiran_staff')
          .insert({
            staff_id: staffIzin.staff_id,
            tanggal: date,
            jam_masuk: null,
            jam_pulang: null,
            status: kehadiranStatus
          });
      }
    } else {
      const santriIzin = izinData as IzinSantri;
      for (const date of dates) {
        const { data: sesiData } = await supabase
          .from('sesi_pembelajaran')
          .select(`id, jadwal:jadwal_id(kelas_id)`)
          .eq('tanggal', date);
        
        if (sesiData) {
          const santriKelasId = santriIzin.santri?.kelas ? 
            (await supabase.from('santri').select('kelas_id').eq('id', santriIzin.santri_id).single()).data?.kelas_id 
            : null;
          
          for (const sesi of sesiData) {
            const jadwal = sesi.jadwal as any;
            if (jadwal?.kelas_id === santriKelasId) {
              await supabase
                .from('kehadiran_santri')
                .insert({
                  santri_id: santriIzin.santri_id,
                  sesi_id: sesi.id,
                  status: kehadiranStatus
                });
            }
          }
        }
      }
    }
  };

  // Edit izin mutation - handles approved izin with attendance regeneration
  const editMutation = useMutation({
    mutationFn: async ({ 
      izinId, 
      type, 
      oldIzin, 
      newData 
    }: { 
      izinId: string; 
      type: 'staff' | 'santri'; 
      oldIzin: IzinStaff | IzinSantri;
      newData: typeof formData;
    }) => {
      const table = type === 'staff' ? 'pengajuan_izin_staff' : 'pengajuan_izin_santri';
      const isApproved = oldIzin.status === 'approved';
      const dateOrTypeChanged = 
        oldIzin.tanggal_mulai !== newData.tanggal_mulai ||
        oldIzin.tanggal_selesai !== newData.tanggal_selesai ||
        oldIzin.jenis_izin !== newData.jenis_izin;

      // If status was approved AND (date or type changed), regenerate attendance
      if (isApproved && dateOrTypeChanged) {
        // 1. Delete old attendance records
        const userId = type === 'staff' 
          ? (oldIzin as IzinStaff).staff_id 
          : (oldIzin as IzinSantri).santri_id;
        
        await deleteOldAttendance(type, userId, oldIzin.tanggal_mulai, oldIzin.tanggal_selesai);
        
        // 2. Generate new attendance records with new data
        const newIzinData = type === 'staff'
          ? { ...oldIzin, tanggal_mulai: newData.tanggal_mulai, tanggal_selesai: newData.tanggal_selesai } as IzinStaff
          : { ...oldIzin, tanggal_mulai: newData.tanggal_mulai, tanggal_selesai: newData.tanggal_selesai } as IzinSantri;
        
        await generateNewAttendance(type, newIzinData, newData.jenis_izin);
      }

      // 3. Update izin record
      const { error } = await supabase
        .from(table)
        .update({
          jenis_izin: newData.jenis_izin,
          tanggal_mulai: newData.tanggal_mulai,
          tanggal_selesai: newData.tanggal_selesai,
          keterangan: newData.keterangan || null,
          lampiran_url: newData.lampiran_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', izinId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pengajuan izin berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-santri'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-staff'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-santri'] });
      setFormOpen(false);
      resetForm();
      setSelectedIzin(null);
    },
    onError: (error: any) => {
      toast.error(`Gagal memperbarui: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, type, izinData }: { id: string; type: 'staff' | 'santri'; izinData?: IzinStaff | IzinSantri }) => {
      const table = type === 'staff' ? 'pengajuan_izin_staff' : 'pengajuan_izin_santri';
      
      // If izin was approved, also delete the generated attendance records
      if (izinData && izinData.status === 'approved') {
        const userId = type === 'staff' 
          ? (izinData as IzinStaff).staff_id 
          : (izinData as IzinSantri).santri_id;
        
        await deleteOldAttendance(type, userId, izinData.tanggal_mulai, izinData.tanggal_selesai);
      }
      
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pengajuan izin berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-staff'] });
      queryClient.invalidateQueries({ queryKey: ['pengajuan-izin-santri'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-staff'] });
      queryClient.invalidateQueries({ queryKey: ['kehadiran-santri'] });
      setDeleteOpen(false);
      setSelectedIzin(null);
    },
    onError: (error: any) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      user_id: '',
      jenis_izin: 'izin',
      status: 'pending',
      tanggal_mulai: format(new Date(), 'yyyy-MM-dd'),
      tanggal_selesai: format(new Date(), 'yyyy-MM-dd'),
      keterangan: '',
      lampiran_url: ''
    });
  };

  // Filter data
  const filteredStaff = useMemo(() => {
    return izinStaffData.filter(item => {
      const matchSearch = !searchTerm || 
        (item.staff?.profiles?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [izinStaffData, searchTerm, statusFilter]);

  const filteredSantri = useMemo(() => {
    return izinSantriData.filter(item => {
      const matchSearch = !searchTerm || 
        (item.santri?.profiles?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [izinSantriData, searchTerm, statusFilter]);

  // Pagination
  const currentData = activeTab === 'staff' ? filteredStaff : filteredSantri;
  const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE);
  const paginatedData = currentData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);


  const getStatusBadge = (status: StatusIzin) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">{statusLabels[status]}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{statusLabels[status]}</Badge>;
      default:
        return <Badge variant="secondary">{statusLabels[status]}</Badge>;
    }
  };

  const handleOpenDetail = (item: IzinStaff | IzinSantri) => {
    setSelectedIzin(item);
    setDetailOpen(true);
  };

  const handleOpenDelete = (item: IzinStaff | IzinSantri) => {
    setSelectedIzin(item);
    setDeleteOpen(true);
  };

  const handleOpenEdit = (item: IzinStaff | IzinSantri) => {
    setSelectedIzin(item);
    setFormMode('edit');
    const userId = activeTab === 'staff' 
      ? (item as IzinStaff).staff_id 
      : (item as IzinSantri).santri_id;
    
    setFormData({
      user_id: userId,
      jenis_izin: item.jenis_izin,
      status: item.status,
      tanggal_mulai: item.tanggal_mulai,
      tanggal_selesai: item.tanggal_selesai,
      keterangan: item.keterangan || '',
      lampiran_url: item.lampiran_url || ''
    });
    setDetailOpen(false);
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'edit' && selectedIzin) {
      editMutation.mutate({
        izinId: selectedIzin.id,
        type: activeTab,
        oldIzin: selectedIzin,
        newData: formData
      });
    } else {
      if (!formData.user_id) {
        toast.error('Pilih pengguna terlebih dahulu');
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const isLoading = activeTab === 'staff' ? isLoadingStaff : isLoadingSantri;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Pengajuan Izin" 
        subtitle="Kelola Perizinan Semua Staff & Santri"
      >
        <Button onClick={() => { setFormMode('add'); resetForm(); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah
        </Button>
      </PageHeader>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'staff' | 'santri'); setCurrentPage(1); }}>
        <TabsList variant="admin" className="grid-cols-2">
          <TabsTrigger value="staff" variant="admin">Staff</TabsTrigger>
          <TabsTrigger value="santri" variant="admin">Santri</TabsTrigger>
        </TabsList>

        <Card className="rounded-2xl mt-4">
          <CardContent className="space-y-4 pt-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={activeTab === 'staff' ? 'Cari staff...' : 'Cari santri...'}
                  value={searchTerm} 
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                  className="pl-10 rounded-xl" 
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="rounded-xl gap-2">
                    <Filter className="h-4 w-4" />
                    Filter
                    {(statusFilter !== 'all' || dateRange !== 'this-month') && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {(statusFilter !== 'all' ? 1 : 0) + (dateRange !== 'this-month' ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="pending">Menunggu Konfirmasi</SelectItem>
                          <SelectItem value="approved">Terkonfirmasi</SelectItem>
                          <SelectItem value="rejected">Ditolak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Periode</Label>
                      <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder="Periode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Hari Ini</SelectItem>
                          <SelectItem value="last-7-days">7 Hari Terakhir</SelectItem>
                          <SelectItem value="last-30-days">30 Hari Terakhir</SelectItem>
                          <SelectItem value="this-month">Bulan Ini</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(statusFilter !== 'all' || dateRange !== 'this-month') && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-muted-foreground"
                        onClick={() => {
                          setStatusFilter('all');
                          setDateRange('this-month');
                          setCurrentPage(1);
                        }}
                      >
                        Reset Filter
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Table */}
            <TabsContent value="staff" className="mt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama Staff</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Jenis Izin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lampiran</TableHead>
                        <TableHead className="text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            Tidak ada data ditemukan
                          </TableCell>
                        </TableRow>
                      ) : (
                        (paginatedData as IzinStaff[]).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                {format(parseISO(item.tanggal_mulai), 'dd MMM yyyy', { locale: idLocale })}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{item.staff?.profiles?.name || '-'}</TableCell>
                            <TableCell>
                              {item.user_roles?.[0]?.role ? (
                                <Badge variant="secondary" className="capitalize">
                                  {item.user_roles[0].role}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{jenisIzinLabels[item.jenis_izin]}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              {item.lampiran_url ? (
                                <a href={item.lampiran_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" /> Lihat
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <ActionButtonGroup>
                                <DetailButton onClick={() => handleOpenDetail(item)} />
                                <DeleteButton onClick={() => handleOpenDelete(item)} />
                              </ActionButtonGroup>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="santri" className="mt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama Santri</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Jenis Izin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lampiran</TableHead>
                        <TableHead className="text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            Tidak ada data ditemukan
                          </TableCell>
                        </TableRow>
                      ) : (
                        (paginatedData as IzinSantri[]).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                {format(parseISO(item.tanggal_mulai), 'dd MMM yyyy', { locale: idLocale })}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{item.santri?.profiles?.name || '-'}</TableCell>
                            <TableCell>{item.santri?.kelas?.nama || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{jenisIzinLabels[item.jenis_izin]}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell>
                              {item.lampiran_url ? (
                                <a href={item.lampiran_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" /> Lihat
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <ActionButtonGroup>
                                <DetailButton onClick={() => handleOpenDetail(item)} />
                                <DeleteButton onClick={() => handleOpenDelete(item)} />
                              </ActionButtonGroup>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, currentData.length)} dari {currentData.length} data
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Form Drawer */}
      <FormDrawer
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setFormMode('add');
            setSelectedIzin(null);
          }
        }}
        title={formMode === 'edit' 
          ? `Edit Pengajuan Izin ${activeTab === 'staff' ? 'Staff' : 'Santri'}` 
          : `Tambah Pengajuan Izin ${activeTab === 'staff' ? 'Staff' : 'Santri'}`}
        description={formMode === 'edit'
          ? `Edit izin untuk ${activeTab === 'staff' ? 'staff' : 'santri'}${selectedIzin?.status === 'approved' ? ' (absensi akan diperbarui)' : ''}`
          : `Tambah izin untuk ${activeTab === 'staff' ? 'staff' : 'santri'}`}
        onSubmit={handleSubmit}
        submitLabel={formMode === 'edit' ? 'Perbarui' : 'Simpan'}
        loading={createMutation.isPending || editMutation.isPending || isUploading}
      >
        <div className="space-y-4">
          {/* Nama Staff/Santri */}
          <div className="space-y-2">
            <Label>{activeTab === 'staff' ? 'Nama Staff' : 'Nama Santri'} <span className="text-destructive">*</span></Label>
            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userSearchOpen}
                  className={cn(
                    "w-full justify-between rounded-xl font-normal",
                    !formData.user_id && "text-muted-foreground",
                    formMode === 'edit' && "opacity-60 pointer-events-none"
                  )}
                  disabled={formMode === 'edit'}
                >
                  {formData.user_id
                    ? activeTab === 'staff'
                      ? staffList.find((item: any) => item.id === formData.user_id)?.name || 'Pilih staff'
                      : santriList.find((item: any) => item.id === formData.user_id)?.name || 'Pilih santri'
                    : `Pilih ${activeTab === 'staff' ? 'staff' : 'santri'}`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder={`Cari ${activeTab === 'staff' ? 'staff' : 'santri'}...`}
                    value={userSearchQuery}
                    onValueChange={setUserSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {activeTab === 'staff'
                        ? staffList
                            .filter((item: any) => 
                              item.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              item.role?.toLowerCase().includes(userSearchQuery.toLowerCase())
                            )
                            .map((item: any) => (
                              <CommandItem
                                key={item.id}
                                value={item.name}
                                onSelect={() => {
                                  setFormData(f => ({ ...f, user_id: item.id }));
                                  setUserSearchOpen(false);
                                  setUserSearchQuery('');
                                }}
                                className="flex items-center justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  {item.name}
                                  <Badge variant={getRoleBadgeVariant(item.role)} className="text-xs capitalize">{item.role}</Badge>
                                </span>
                                <Check className={cn("h-4 w-4", formData.user_id === item.id ? "opacity-100" : "opacity-0")} />
                              </CommandItem>
                            ))
                        : santriList
                            .filter((item: any) => 
                              item.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              item.kelas?.toLowerCase().includes(userSearchQuery.toLowerCase())
                            )
                            .map((item: any) => (
                              <CommandItem
                                key={item.id}
                                value={item.name}
                                onSelect={() => {
                                  setFormData(f => ({ ...f, user_id: item.id }));
                                  setUserSearchOpen(false);
                                  setUserSearchQuery('');
                                }}
                                className="flex items-center justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  {item.name}
                                  {item.kelas && <Badge variant="secondary" className="text-xs">{item.kelas}</Badge>}
                                </span>
                                <Check className={cn("h-4 w-4", formData.user_id === item.id ? "opacity-100" : "opacity-0")} />
                              </CommandItem>
                            ))
                      }
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {formMode === 'edit' && (
              <p className="text-xs text-muted-foreground">Nama tidak dapat diubah saat edit</p>
            )}
          </div>

          {/* Jenis Izin */}
          <div className="space-y-2">
            <Label>Jenis Izin <span className="text-destructive">*</span></Label>
            <Select value={formData.jenis_izin} onValueChange={(v) => setFormData(f => ({ ...f, jenis_izin: v as JenisIzin }))}>
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

          {/* Status (Admin dapat langsung menentukan) */}
          <div className="space-y-2">
            <Label>Status <span className="text-destructive">*</span></Label>
            <Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v as StatusIzin }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tanggal Izin (Date Range with Datepicker) */}
          <div className="space-y-2">
            <Label>Tanggal Izin <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Mulai</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl",
                        !formData.tanggal_mulai && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.tanggal_mulai 
                        ? format(parseISO(formData.tanggal_mulai), 'dd MMM yyyy', { locale: idLocale }) 
                        : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.tanggal_mulai ? parseISO(formData.tanggal_mulai) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const dateStr = format(date, 'yyyy-MM-dd');
                          setFormData(f => ({ 
                            ...f, 
                            tanggal_mulai: dateStr,
                            // Reset tanggal_selesai if it's before tanggal_mulai
                            tanggal_selesai: f.tanggal_selesai < dateStr ? dateStr : f.tanggal_selesai
                          }));
                        }
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Selesai</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl",
                        !formData.tanggal_selesai && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.tanggal_selesai 
                        ? format(parseISO(formData.tanggal_selesai), 'dd MMM yyyy', { locale: idLocale }) 
                        : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.tanggal_selesai ? parseISO(formData.tanggal_selesai) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setFormData(f => ({ ...f, tanggal_selesai: format(date, 'yyyy-MM-dd') }));
                        }
                      }}
                      disabled={(date) => date < parseISO(formData.tanggal_mulai)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Keterangan */}
          <div className="space-y-2">
            <Label>Keterangan</Label>
            <Textarea 
              value={formData.keterangan}
              onChange={(e) => setFormData(f => ({ ...f, keterangan: e.target.value }))}
              placeholder="Keterangan izin (opsional)..."
              className="rounded-xl"
            />
          </div>

          {/* Dokumen Pendukung (Upload) */}
          <div className="space-y-2">
            <Label>Dokumen Pendukung</Label>
            {formData.lampiran_url ? (
              <div className="flex items-center gap-2 p-3 border rounded-xl bg-muted/30">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={formData.lampiran_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex-1 truncate"
                >
                  {formData.lampiran_url.split('/').pop()}
                </a>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFormData(f => ({ ...f, lampiran_url: '' }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-4">
                <label className="flex flex-col items-center gap-2 cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Klik untuk upload dokumen</span>
                  <span className="text-xs text-muted-foreground">(PDF, JPG, PNG - Max 5MB)</span>
                  <input 
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Ukuran file maksimal 5MB');
                        return;
                      }
                      
                      setIsUploading(true);
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}.${fileExt}`;
                        const filePath = `izin/${activeTab}/${fileName}`;
                        
                        const { error: uploadError } = await supabase.storage
                          .from('user-documents')
                          .upload(filePath, file);
                        
                        if (uploadError) throw uploadError;
                        
                        const { data: urlData } = supabase.storage
                          .from('user-documents')
                          .getPublicUrl(filePath);
                        
                        setFormData(f => ({ ...f, lampiran_url: urlData.publicUrl }));
                        toast.success('Dokumen berhasil diupload');
                      } catch (error: any) {
                        toast.error(`Gagal upload: ${error.message}`);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  />
                </label>
                {isUploading && (
                  <div className="mt-2 text-center text-sm text-muted-foreground">
                    Mengupload...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </FormDrawer>

      {/* Detail Drawer */}
      <FormDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Detail Pengajuan Izin"
        description={`Detail izin ${activeTab === 'staff' ? 'staff' : 'santri'}`}
        showFooter={false}
      >
        {selectedIzin && (
          <div className="space-y-6">
            {/* Info Card */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              {/* Nama & Status */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Nama</p>
                  <p className="font-semibold text-lg">
                    {activeTab === 'staff' 
                      ? (selectedIzin as IzinStaff).staff?.profiles?.name 
                      : (selectedIzin as IzinSantri).santri?.profiles?.name}
                  </p>
                </div>
                {getStatusBadge(selectedIzin.status)}
              </div>

              {/* Jabatan/Kelas */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {activeTab === 'staff' ? 'Jabatan' : 'Kelas'}
                </p>
                <p className="font-medium">
                  {activeTab === 'staff' 
                    ? getRoleLabel((selectedIzin as IzinStaff).user_roles?.[0]?.role)
                    : (selectedIzin as IzinSantri).santri?.kelas?.nama || '-'}
                </p>
              </div>

              {/* Jenis Izin */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Jenis Izin</p>
                <Badge variant="outline" className="mt-1">{jenisIzinLabels[selectedIzin.jenis_izin]}</Badge>
              </div>

              {/* Tanggal Izin (Range) */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Tanggal Izin</p>
                <p className="font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {format(parseISO(selectedIzin.tanggal_mulai), 'dd MMM yyyy', { locale: idLocale })}
                  {selectedIzin.tanggal_mulai !== selectedIzin.tanggal_selesai && (
                    <>
                      <span className="text-muted-foreground">—</span>
                      {format(parseISO(selectedIzin.tanggal_selesai), 'dd MMM yyyy', { locale: idLocale })}
                    </>
                  )}
                </p>
              </div>

              {/* Keterangan */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Keterangan</p>
                <p className="font-medium text-sm">
                  {selectedIzin.keterangan || <span className="text-muted-foreground italic">Tidak ada keterangan</span>}
                </p>
              </div>

              {/* Dokumen Pendukung */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Dokumen Pendukung</p>
                {selectedIzin.lampiran_url ? (
                  <a 
                    href={selectedIzin.lampiran_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-1 text-primary hover:underline font-medium"
                  >
                    <FileText className="h-4 w-4" />
                    Lihat Dokumen
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-muted-foreground italic text-sm">Tidak ada dokumen</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {/* Edit Button - always visible */}
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => handleOpenEdit(selectedIzin)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Izin
              </Button>

              {selectedIzin.status === 'pending' && (
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => updateStatusMutation.mutate({ 
                      id: selectedIzin.id, 
                      status: 'rejected', 
                      type: activeTab,
                      izinData: selectedIzin
                    })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Tolak
                  </Button>
                  <Button 
                    variant="default"
                    className="flex-1"
                    onClick={() => updateStatusMutation.mutate({ 
                      id: selectedIzin.id, 
                      status: 'approved', 
                      type: activeTab,
                      izinData: selectedIzin
                    })}
                    disabled={updateStatusMutation.isPending}
                  >
                    Konfirmasi
                  </Button>
                </div>
              )}

              {/* Info for approved izin */}
              {selectedIzin.status === 'approved' && (
                <p className="text-xs text-muted-foreground text-center bg-muted/50 rounded-lg p-2">
                  Mengubah jenis/tanggal izin akan menghapus absensi lama dan membuat ulang absensi baru
                </p>
              )}

              <Button 
                variant="outline" 
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setDetailOpen(false);
                  handleOpenDelete(selectedIzin);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Hapus
              </Button>
            </div>
          </div>
        )}
      </FormDrawer>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Hapus Pengajuan Izin
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {selectedIzin?.status === 'approved' ? (
                  <>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                      <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold">Peringatan: Izin ini sudah Terkonfirmasi</p>
                        <p className="mt-1">Menghapus izin yang sudah terkonfirmasi akan menghapus data absensi terkait. Data historis absensi akan di-rollback.</p>
                      </div>
                    </div>
                    <p>Apakah Anda yakin ingin melanjutkan? Tindakan ini tidak dapat dibatalkan.</p>
                  </>
                ) : (
                  <p>Apakah Anda yakin ingin menghapus pengajuan izin ini? Tindakan ini tidak dapat dibatalkan.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedIzin && deleteMutation.mutate({ id: selectedIzin.id, type: activeTab, izinData: selectedIzin })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Menghapus...' : selectedIzin?.status === 'approved' ? 'Hapus & Rollback Absensi' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
