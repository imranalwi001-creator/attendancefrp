import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, LogIn, LogOut, MapPin, Search, Download, Settings2, Users, ChevronLeft, ChevronRight, BarChart3, List, UserCheck, UserX, AlertTriangle, Rocket, CheckCircle } from 'lucide-react';
import { DetailButton } from '@/components/ui/action-buttons';
import { StatCard } from '@/components/dashboard/StatCard';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { AbsenStaffModal, AttendanceTimeCard, LaporanKehadiranStaffModal } from '@/components/kehadiran';
import { FileBarChart } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  staff_id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  latitude_masuk: number | null;
  longitude_masuk: number | null;
  status_lokasi_masuk: string | null;
  latitude_pulang: number | null;
  longitude_pulang: number | null;
  status_lokasi_pulang: string | null;
  status: string | null; // Status kehadiran: hadir, sakit, izin, cuti, dinas_luar, dll
}

interface StaffAttendanceStats {
  id: string;
  name: string;
  employee_id: string | null;
  position: string | null;
  role: string;
  hadir: number;
  sakit: number;
  izin: number;
  cuti: number;
  dinasLuar: number;
  tidakHadir: number;
}

const ITEMS_PER_PAGE = 10;

export default function AdminKehadiranStaff() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Modal state for attendance
  const [absenModalOpen, setAbsenModalOpen] = useState(false);
  const [absenModalType, setAbsenModalType] = useState<'masuk' | 'pulang'>('masuk');
  const [laporanOpen, setLaporanOpen] = useState(false);

  // Section 2 states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

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

  // Handler to open modal
  const handleOpenAbsenModal = (type: 'masuk' | 'pulang') => {
    setAbsenModalType(type);
    setAbsenModalOpen(true);
  };

  // Fetch today's attendance for current user
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['kehadiran-staff-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('id, staff_id, tanggal, jam_masuk, jam_pulang, status')
        .eq('staff_id', user.id)
        .eq('tanggal', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as AttendanceRecord | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
  });

  // Fetch all staff with roles
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['staff-list-all'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul']);
      
      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) return [];

      const userIds = roleData.map(r => r.user_id);
      
      // Get profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (profileError) throw profileError;

      // Get staff details
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, employee_id, position')
        .in('id', userIds);

      if (staffError) throw staffError;

      return roleData.map(role => ({
        user_id: role.user_id,
        role: role.role,
        name: profileData?.find(p => p.id === role.user_id)?.name || 'Unknown',
        employee_id: staffData?.find(s => s.id === role.user_id)?.employee_id || null,
        position: staffData?.find(s => s.id === role.user_id)?.position || null
      }));
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Fetch attendance records for date range
  const { data: attendanceRecords = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['kehadiran-staff-range', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('id, staff_id, tanggal, jam_masuk, jam_pulang, status')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .limit(500);
      
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Query kehadiran hari ini untuk semua staff (untuk tab Ringkasan)
  const { data: todayAllAttendance = [], isLoading: isLoadingTodayAll } = useQuery({
    queryKey: ['kehadiran-staff-today-all', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('id, staff_id, tanggal, jam_masuk, jam_pulang, status, status_lokasi_masuk')
        .eq('tanggal', today);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
  });

  // Query aturan waktu kerja
  const { data: waktuKerja } = useQuery({
    queryKey: ['aturan-waktu-kerja-standar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aturan_waktu_kerja')
        .select('jabatan, waktu_masuk, toleransi_terlambat')
        .eq('jabatan', 'Standar')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Helper function for work days calculation - memoized
  const getWorkDaysCount = useCallback((start: string, end: string) => {
    let count = 0;
    const startD = new Date(start);
    const endD = new Date(end);
    const current = new Date(startD);
    while (current <= endD) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }, []);

  // Helper function untuk menghitung keterlambatan dalam menit
  const calculateMinutesLate = useCallback((jamMasuk: string, batasToleransi: string): number => {
    const [h1, m1] = jamMasuk.split(':').map(Number);
    const [h2, m2] = batasToleransi.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  }, []);

  // Statistik hari ini untuk tab Ringkasan
  const todayStats = useMemo(() => {
    const waktuMasukDefault = waktuKerja?.waktu_masuk || '07:30:00';
    const toleransi = waktuKerja?.toleransi_terlambat || 10;
    
    // Parse batas waktu toleransi
    const [h, m] = waktuMasukDefault.split(':').map(Number);
    const totalMinutes = m + toleransi;
    const newHour = h + Math.floor(totalMinutes / 60);
    const newMinute = totalMinutes % 60;
    const batasToleransi = `${String(newHour).padStart(2,'0')}:${String(newMinute).padStart(2,'0')}:00`;
    
    // Staff yang sudah hadir hari ini
    const hadirToday = todayAllAttendance.filter(a => a.jam_masuk);
    
    // Tepat waktu vs Terlambat
    const tepatWaktu = hadirToday.filter(a => a.jam_masuk && a.jam_masuk <= batasToleransi);
    const terlambat = hadirToday.filter(a => a.jam_masuk && a.jam_masuk > batasToleransi);
    
    // Staff belum absen (dari staffList dikurangi yang sudah hadir)
    const hadirIds = new Set(hadirToday.map(a => a.staff_id));
    const belumAbsen = staffList.filter((s: any) => !hadirIds.has(s.user_id));
    
    // Top 10 tercepat (hanya yang tepat waktu, sort by jam_masuk ASC)
    const tercepat = [...tepatWaktu]
      .sort((a, b) => (a.jam_masuk || '').localeCompare(b.jam_masuk || ''))
      .slice(0, 10)
      .map(a => ({
        ...a,
        staff: staffList.find((s: any) => s.user_id === a.staff_id)
      }));
    
    // Top 10 terlambat (sort by keterlambatan DESC)
    const terlambatList = [...terlambat]
      .map(a => ({
        ...a,
        staff: staffList.find((s: any) => s.user_id === a.staff_id),
        menitTerlambat: calculateMinutesLate(a.jam_masuk || '00:00:00', batasToleransi)
      }))
      .sort((a, b) => b.menitTerlambat - a.menitTerlambat)
      .slice(0, 10);
    
    return {
      totalHadir: hadirToday.length,
      tepatWaktu: tepatWaktu.length,
      terlambat: terlambat.length,
      belumAbsen,
      tercepat,
      terlambatList,
      batasToleransi
    };
  }, [todayAllAttendance, staffList, waktuKerja, calculateMinutesLate]);

  // Helper untuk inisial nama
  const getInitials = (name: string | undefined) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const staffStats = useMemo<StaffAttendanceStats[]>(() => {
    if (!staffList.length) return [];
    
    const workDays = getWorkDaysCount(startDate, endDate);
    
    return staffList.map((staff: any) => {
      const staffAttendance = attendanceRecords.filter(a => a.staff_id === staff.user_id);
      
      // Hitung berdasarkan status dari kolom status di kehadiran_staff
      const hadir = staffAttendance.filter(a => a.jam_masuk !== null && (!a.status || a.status === 'hadir')).length;
      const sakit = staffAttendance.filter(a => a.status === 'sakit').length;
      const izin = staffAttendance.filter(a => a.status === 'izin').length;
      const cuti = staffAttendance.filter(a => a.status === 'cuti').length;
      const dinasLuar = staffAttendance.filter(a => a.status === 'dinas_luar').length;
      
      // Total kehadiran = hadir + sakit + izin + cuti + dinas_luar
      const totalRecorded = hadir + sakit + izin + cuti + dinasLuar;
      const tidakHadir = Math.max(0, workDays - totalRecorded);

      return {
        id: staff.user_id,
        name: staff.name,
        employee_id: staff.employee_id,
        position: staff.position,
        role: staff.role,
        hadir,
        sakit,
        izin,
        cuti,
        dinasLuar,
        tidakHadir
      };
    });
  }, [staffList, attendanceRecords, startDate, endDate, getWorkDaysCount]);

  // Filter stats - MEMOIZED
  const filteredStats = useMemo(() => {
    return staffStats
      .filter(s => {
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return s.name.toLowerCase().includes(search) || 
                 (s.employee_id?.toLowerCase().includes(search));
        }
        return true;
      })
      .filter(s => {
        if (roleFilter === 'all') return true;
        return s.role === roleFilter;
      });
  }, [staffStats, searchTerm, roleFilter]);

  // Pagination - MEMOIZED
  const totalPages = useMemo(() => Math.ceil(filteredStats.length / ITEMS_PER_PAGE), [filteredStats.length]);
  
  const paginatedStats = useMemo(() => filteredStats.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  ), [filteredStats, currentPage]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['NIP', 'Nama', 'Jabatan', 'Role', 'Hadir', 'Sakit', 'Izin', 'Cuti', 'Dinas Luar', 'Tidak Hadir'];
    const rows = filteredStats.map(s => [
      s.employee_id || '-',
      s.name,
      s.position || '-',
      s.role,
      s.hadir,
      s.sakit,
      s.izin,
      s.cuti,
      s.dinasLuar,
      s.tidakHadir
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kehadiran-staff-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data berhasil diexport');
  };


  const hasClockIn = !!todayAttendance?.jam_masuk;
  const hasClockOut = !!todayAttendance?.jam_pulang;

  const formatTime = (time: string | null) => {
    if (!time) return '00:00:00';
    return time;
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, any> = {
      admin: 'role-admin',
      guru: 'role-guru',
      walikelas: 'role-walikelas',
      Pembina: 'role-pembina',
      staff: 'role-staff',
      guru_ekskul: 'role-guru',
    };
    return variants[role] || 'outline';
  };

  const formatRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      guru: 'Guru / Wali Kelas',
      walikelas: 'Wali Kelas',
      Pembina: 'Pembina',
      staff: 'Staff',
      guru_ekskul: 'Guru Ekskul',
    };
    return labels[role] || role;
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Kehadiran Staff" 
        subtitle={`${format(new Date(), 'EEEE, d MMMM yyyy', { locale: idLocale })}`}
      >
        <Button size="sm" variant="btn_sec" onClick={() => setLaporanOpen(true)}>
          <FileBarChart className="h-4 w-4" />
          Laporan
        </Button>
      </PageHeader>

      <LaporanKehadiranStaffModal open={laporanOpen} onOpenChange={setLaporanOpen} />

      {/* Absen Staff Modal */}
      {user?.id && (
        <AbsenStaffModal
          open={absenModalOpen}
          onOpenChange={setAbsenModalOpen}
          type={absenModalType}
          staffId={user.id}
          attendanceId={todayAttendance?.id}
        />
      )}

      <Tabs defaultValue="ringkasan" className="space-y-6">
        <TabsList variant="admin" className="grid w-full grid-cols-2">
          <TabsTrigger variant="admin" value="ringkasan">
            <BarChart3 className="h-4 w-4 mr-2" />
            Ringkasan
          </TabsTrigger>
          <TabsTrigger variant="admin" value="list">
            <List className="h-4 w-4 mr-2" />
            List Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="space-y-6">
          {isLoadingStaff || isLoadingTodayAll ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[300px] rounded-xl" />
                <Skeleton className="h-[300px] rounded-xl" />
              </div>
              <Skeleton className="h-[200px] rounded-xl" />
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard 
                  icon={UserCheck} 
                  label="Total Hadir" 
                  value={todayStats.totalHadir} 
                  bgOuter="#DCFCE7" 
                  bgInner="#22C55E" 
                />
                <StatCard 
                  icon={Clock} 
                  label="Tepat Waktu" 
                  value={todayStats.tepatWaktu} 
                  bgOuter="#CFFAFE" 
                  bgInner="#06B6D4" 
                />
                <StatCard 
                  icon={AlertTriangle} 
                  label="Terlambat" 
                  value={todayStats.terlambat} 
                  bgOuter="#FEF3C7" 
                  bgInner="#F59E0B" 
                />
                <StatCard 
                  icon={UserX} 
                  label="Belum Absen" 
                  value={todayStats.belumAbsen.length} 
                  bgOuter="#FEE2E2" 
                  bgInner="#EF4444" 
                />
              </div>

              {/* Grid 2 Kolom: Tercepat & Terlambat */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tabel Staff Tercepat */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-green-500" />
                      Staff Tercepat Hari Ini
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {todayStats.tercepat.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Belum ada staff yang absen hari ini</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Staff</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Jam Masuk</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todayStats.tercepat.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                      {getInitials(item.staff?.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm">{item.staff?.name || 'Unknown'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(item.staff?.role || '')} className="text-xs">
                                  {formatRoleLabel(item.staff?.role || '')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center justify-center min-w-[60px] h-7 px-2 rounded-md bg-green-100 text-green-700 font-medium text-sm dark:bg-green-900/30 dark:text-green-400">
                                  {item.jam_masuk?.slice(0, 5)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Tabel Staff Terlambat */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Staff Terlambat Hari Ini
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {todayStats.terlambatList.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-70" />
                        <p className="text-sm text-green-600">Tidak ada staff yang terlambat hari ini</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Staff</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Jam Masuk</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todayStats.terlambatList.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                      {getInitials(item.staff?.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm">{item.staff?.name || 'Unknown'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(item.staff?.role || '')} className="text-xs">
                                  {formatRoleLabel(item.staff?.role || '')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center justify-center min-w-[60px] h-7 px-2 rounded-md bg-amber-100 text-amber-700 font-medium text-sm dark:bg-amber-900/30 dark:text-amber-400">
                                  {item.jam_masuk?.slice(0, 5)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabel Staff Belum Absen */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-500" />
                    Staff Belum Absen ({todayStats.belumAbsen.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {todayStats.belumAbsen.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-70" />
                      <p className="text-sm text-green-600">Semua staff sudah hadir hari ini</p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Staff</TableHead>
                            <TableHead>NIP</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todayStats.belumAbsen.map((staff: any) => (
                            <TableRow key={staff.user_id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                      {getInitials(staff.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-sm">{staff.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{staff.employee_id || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(staff.role)} className="text-xs">
                                  {formatRoleLabel(staff.role)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive" className="text-xs">Belum Absen</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="list">
          {/* Section 2: Daftar Kehadiran Staff */}
          <Card className="rounded-2xl">
        <CardContent className="space-y-4 pt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama atau NIP..." 
                value={searchTerm} 
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="pl-10 rounded-xl" 
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] rounded-xl">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="guru">Guru</SelectItem>
                <SelectItem value="walikelas">Walikelas</SelectItem>
                <SelectItem value="Pembina">Pembina</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="guru_ekskul">Guru Ekskul</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
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

          {/* Table */}
          {isLoadingStaff || isLoadingAttendance ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Pengguna</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Cuti</TableHead>
                    <TableHead className="text-center">Dinas</TableHead>
                    <TableHead className="text-center">Tidak Hadir</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        Tidak ada data ditemukan
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStats.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-border">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {staff.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{staff.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {staff.employee_id || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(staff.role)} className="text-xs">
                            {formatRoleLabel(staff.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-green-100 text-green-700 font-medium text-sm dark:bg-green-900/30 dark:text-green-400">
                            {staff.hadir}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-amber-100 text-amber-700 font-medium text-sm dark:bg-amber-900/30 dark:text-amber-400">
                            {staff.sakit}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-blue-100 text-blue-700 font-medium text-sm dark:bg-blue-900/30 dark:text-blue-400">
                            {staff.izin}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-purple-100 text-purple-700 font-medium text-sm dark:bg-purple-900/30 dark:text-purple-400">
                            {staff.cuti}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-cyan-100 text-cyan-700 font-medium text-sm dark:bg-cyan-900/30 dark:text-cyan-400">
                            {staff.dinasLuar}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-red-100 text-red-700 font-medium text-sm dark:bg-red-900/30 dark:text-red-400">
                            {staff.tidakHadir}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <DetailButton 
                            onClick={() => navigate(`/admin/kehadiran-staff/${staff.id}`)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredStats.length)} dari {filteredStats.length} data
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {[...Array(totalPages)].map((_, i) => (
                  <Button
                    key={i}
                    variant={currentPage === i + 1 ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
