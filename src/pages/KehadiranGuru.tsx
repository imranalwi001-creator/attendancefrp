import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import { 
  Search, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  BookOpen
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { StatCard } from '@/components/dashboard/StatCard';
import { KehadiranStaffAuditModal } from '@/components/kehadiran';
import KehadiranPembelajaranTab from '@/components/kehadiran/KehadiranPembelajaranTab';

interface AttendanceRecord {
  id: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  latitude_masuk: number | null;
  longitude_masuk: number | null;
  status_lokasi_masuk: string | null;
  latitude_pulang: number | null;
  longitude_pulang: number | null;
  status_lokasi_pulang: string | null;
  foto_masuk_url: string | null;
  foto_pulang_url: string | null;
  status: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function KehadiranGuru() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('harian');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

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

  // Fetch staff profile
  const { data: staffProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['my-staff-profile', user?.id],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, phone, avatar_url')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('employee_id, position')
        .eq('id', user?.id)
        .single();

      if (staffError && staffError.code !== 'PGRST116') throw staffError;

      return {
        ...profile,
        employee_id: staff?.employee_id || null,
        position: staff?.position || null,
        role: user?.role || 'guru'
      };
    },
    enabled: !!user?.id
  });

  // Fetch approved leave requests for this staff
  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ['my-approved-leaves', user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengajuan_izin_staff')
        .select('jenis_izin, tanggal_mulai, tanggal_selesai')
        .eq('staff_id', user?.id)
        .eq('status', 'approved')
        .lte('tanggal_mulai', endDate)
        .gte('tanggal_selesai', startDate);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Helper to get actual leave type from approved leaves
  const getActualLeaveType = (tanggal: string): string | null => {
    for (const leave of approvedLeaves) {
      if (tanggal >= leave.tanggal_mulai && tanggal <= leave.tanggal_selesai) {
        return leave.jenis_izin;
      }
    }
    return null;
  };

  // Fetch attendance records
  const { data: attendanceRecords = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['my-attendance-detail', user?.id, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('id, tanggal, jam_masuk, jam_pulang, status, latitude_masuk, longitude_masuk, status_lokasi_masuk, latitude_pulang, longitude_pulang, status_lokasi_pulang, foto_masuk_url, foto_pulang_url')
        .eq('staff_id', user?.id)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Fetch work time rules
  const { data: workTimeRules = [] } = useQuery({
    queryKey: ['work-time-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aturan_waktu_kerja')
        .select('id, jabatan, waktu_masuk, waktu_pulang, toleransi_terlambat');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  // Get applicable work time rule based on staff role
  const workTimeRule = useMemo(() => {
    if (!staffProfile?.role || workTimeRules.length === 0) {
      return { waktu_masuk: '07:30', waktu_pulang: '16:00' };
    }

    const roleRule = workTimeRules.find(r => r.jabatan.toLowerCase() === staffProfile.role.toLowerCase());
    const standarRule = workTimeRules.find(r => r.jabatan === 'Standar');
    
    return roleRule || standarRule || { waktu_masuk: '07:30', waktu_pulang: '16:00' };
  }, [staffProfile?.role, workTimeRules]);

  const jamMasukStandar = workTimeRule.waktu_masuk?.slice(0, 5) || '07:30';
  const jamPulangStandar = workTimeRule.waktu_pulang?.slice(0, 5) || '16:00';

  // Helper functions
  const isLate = (jamMasuk: string | null) => {
    if (!jamMasuk) return false;
    return jamMasuk.slice(0, 5) > jamMasukStandar;
  };

  const isEarlyLeave = (jamPulang: string | null) => {
    if (!jamPulang) return false;
    return jamPulang.slice(0, 5) < jamPulangStandar;
  };

  const getAttendanceStatus = (record: AttendanceRecord): 'hadir' | 'sakit' | 'izin' | 'cuti' | 'dinas_luar' | 'tidak_hadir' => {
    const actualLeaveType = getActualLeaveType(record.tanggal);
    if (actualLeaveType && ['sakit', 'izin', 'cuti', 'dinas_luar', 'lainnya'].includes(actualLeaveType)) {
      if (actualLeaveType === 'lainnya') return 'izin';
      return actualLeaveType as 'sakit' | 'izin' | 'cuti' | 'dinas_luar';
    }
    if (record.status && ['sakit', 'izin', 'cuti', 'dinas_luar'].includes(record.status)) {
      return record.status as 'sakit' | 'izin' | 'cuti' | 'dinas_luar';
    }
    if (record.jam_masuk) return 'hadir';
    return 'tidak_hadir';
  };

  const getLocationStatus = (record: AttendanceRecord) => {
    if (record.status_lokasi_masuk === 'dalam_lokasi') return 'dalam_lokasi';
    if (record.status_lokasi_masuk === 'luar_lokasi') return 'luar_lokasi';
    if (record.latitude_masuk && record.longitude_masuk) return 'dalam_lokasi';
    return 'tidak_diketahui';
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const stats = {
      hadir: 0,
      sakit: 0,
      izin: 0,
      tidakHadir: 0,
      terlambat: 0
    };

    const getDatesInRange = (start: string, end: string) => {
      const dates: string[] = [];
      const startD = new Date(start);
      const endD = new Date(end);
      const current = new Date(startD);
      while (current <= endD) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
          dates.push(format(current, 'yyyy-MM-dd'));
        }
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    const workDays = getDatesInRange(startDate, endDate);
    
    stats.hadir = attendanceRecords.filter(r => r.jam_masuk !== null && (!r.status || r.status === 'hadir')).length;
    stats.sakit = attendanceRecords.filter(r => r.status === 'sakit').length;
    stats.izin = attendanceRecords.filter(r => r.status === 'izin' || r.status === 'cuti' || r.status === 'dinas_luar').length;
    stats.terlambat = attendanceRecords.filter(r => isLate(r.jam_masuk)).length;
    
    const totalRecorded = stats.hadir + stats.sakit + stats.izin;
    stats.tidakHadir = Math.max(0, workDays.length - totalRecorded);

    return stats;
  }, [attendanceRecords, startDate, endDate]);

  // Filter and paginate
  const filteredRecords = useMemo(() => {
    return attendanceRecords
      .filter(record => {
        if (searchTerm) {
          const dateStr = format(parseISO(record.tanggal), 'dd MMMM yyyy', { locale: idLocale });
          return dateStr.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
      })
      .filter(record => {
        if (statusFilter === 'all') return true;
        return getAttendanceStatus(record) === statusFilter;
      });
  }, [attendanceRecords, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.slice(0, 5);
  };

  if (isLoadingProfile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kehadiran Saya"
        subtitle="Riwayat kehadiran dan statistik"
      />

      {/* Tabs - Hide pembelajaran tab for staff role since they don't teach */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {user?.role !== 'staff' && (
          <TabsList variant="admin" className="grid grid-cols-2 mb-4">
            <TabsTrigger value="harian" variant="admin">
              <Calendar className="h-4 w-4 mr-2" />
              Kehadiran Harian
            </TabsTrigger>
            <TabsTrigger value="pembelajaran" variant="admin">
              <BookOpen className="h-4 w-4 mr-2" />
              Kehadiran Pembelajaran
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="harian" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
            <StatCard icon={CheckCircle2} label="Hadir" value={summaryStats.hadir} animationDelay={0} />
            <StatCard icon={AlertCircle} label="Sakit" value={summaryStats.sakit} animationDelay={100} />
            <StatCard icon={Calendar} label="Izin" value={summaryStats.izin} animationDelay={200} />
            <StatCard icon={XCircle} label="Tidak Hadir" value={summaryStats.tidakHadir} animationDelay={300} />
            <StatCard icon={Clock} label="Terlambat" value={summaryStats.terlambat} animationDelay={400} />
          </div>

      {/* Filters & Table */}
      <Card className="rounded-2xl">
        <CardContent className="pt-6 space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari tanggal..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10 rounded-xl"
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
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="hadir">Hadir</SelectItem>
                        <SelectItem value="sakit">Sakit</SelectItem>
                        <SelectItem value="izin">Izin</SelectItem>
                        <SelectItem value="cuti">Cuti</SelectItem>
                        <SelectItem value="dinas_luar">Dinas Luar</SelectItem>
                        <SelectItem value="tidak_hadir">Tidak Hadir</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Periode</label>
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
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-3">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px] rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="hadir">Hadir</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="cuti">Cuti</SelectItem>
                  <SelectItem value="dinas_luar">Dinas Luar</SelectItem>
                  <SelectItem value="tidak_hadir">Tidak Hadir</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px] rounded-xl">
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
          </div>

          {/* Table - Desktop */}
          {isLoadingAttendance ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Waktu Masuk</TableHead>
                      <TableHead>Waktu Pulang</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          Tidak ada data kehadiran
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRecords.map((record) => {
                        const status = getAttendanceStatus(record);
                        const locationStatus = getLocationStatus(record);
                        const late = isLate(record.jam_masuk);
                        const earlyLeave = isEarlyLeave(record.jam_pulang);

                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <span className="font-medium">
                                {format(parseISO(record.tanggal), 'EEEE, dd MMM yyyy', { locale: idLocale })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{formatTime(record.jam_masuk)}</span>
                                {record.jam_masuk && (
                                  <Badge variant={late ? 'destructive' : 'outline'} className="text-xs">
                                    {late ? 'Terlambat' : 'Tepat Waktu'}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{formatTime(record.jam_pulang)}</span>
                                {record.jam_pulang && earlyLeave && (
                                  <Badge variant="secondary" className="text-xs">
                                    Pulang Cepat
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">
                                  {locationStatus === 'dalam_lokasi' && 'Dalam Lokasi'}
                                  {locationStatus === 'luar_lokasi' && 'Di Luar Lokasi'}
                                  {locationStatus === 'tidak_diketahui' && 'Tidak Diketahui'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {status === 'hadir' && (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Hadir
                                </Badge>
                              )}
                              {status === 'sakit' && (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Sakit
                                </Badge>
                              )}
                              {status === 'izin' && (
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  Izin
                                </Badge>
                              )}
                              {status === 'cuti' && (
                                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                  Cuti
                                </Badge>
                              )}
                              {status === 'dinas_luar' && (
                                <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                                  Dinas Luar
                                </Badge>
                              )}
                              {status === 'tidak_hadir' && (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  Tidak Hadir
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setAuditModalOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {paginatedRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-xl">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    Tidak ada data kehadiran
                  </div>
                ) : (
                  paginatedRecords.map((record) => {
                    const status = getAttendanceStatus(record);
                    const locationStatus = getLocationStatus(record);
                    const late = isLate(record.jam_masuk);
                    const earlyLeave = isEarlyLeave(record.jam_pulang);

                    const getStatusBadge = () => {
                      switch (status) {
                        case 'hadir':
                          return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Hadir</Badge>;
                        case 'sakit':
                          return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Sakit</Badge>;
                        case 'izin':
                          return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Izin</Badge>;
                        case 'cuti':
                          return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Cuti</Badge>;
                        case 'dinas_luar':
                          return <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">Dinas Luar</Badge>;
                        case 'tidak_hadir':
                          return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Tidak Hadir</Badge>;
                        default:
                          return null;
                      }
                    };

                    return (
                      <div 
                        key={record.id} 
                        className="border rounded-xl p-3 space-y-3 hover:border-primary/30 transition-colors"
                        onClick={() => {
                          setSelectedRecord(record);
                          setAuditModalOpen(true);
                        }}
                      >
                        {/* Header: Date & Status */}
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {format(parseISO(record.tanggal), 'EEE, dd MMM yyyy', { locale: idLocale })}
                          </span>
                          {getStatusBadge()}
                        </div>

                        {/* Time & Location */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">Masuk</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium">{formatTime(record.jam_masuk)}</span>
                              {record.jam_masuk && late && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">Telat</Badge>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">Pulang</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium">{formatTime(record.jam_pulang)}</span>
                              {record.jam_pulang && earlyLeave && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">Cepat</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {locationStatus === 'dalam_lokasi' && 'Dalam Lokasi'}
                            {locationStatus === 'luar_lokasi' && 'Di Luar Lokasi'}
                            {locationStatus === 'tidak_diketahui' && 'Lokasi Tidak Diketahui'}
                          </span>
                          <Eye className="h-3 w-3 ml-auto text-primary" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} dari {filteredRecords.length} data
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
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

        {user?.role !== 'staff' && (
          <TabsContent value="pembelajaran" className="mt-6">
            <KehadiranPembelajaranTab staffId={user?.id || ''} />
          </TabsContent>
        )}
      </Tabs>

      {/* Audit Modal */}
      <KehadiranStaffAuditModal
        open={auditModalOpen}
        onOpenChange={setAuditModalOpen}
        record={selectedRecord}
        workTimeRule={workTimeRule}
        staffProfile={staffProfile}
      />
    </div>
  );
}
