import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, CheckCircle2, AlertCircle, HelpCircle, XCircle, TrendingUp, Search } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
interface KehadiranRecord {
  id: string;
  status: string;
  tanggal: string;
  mapel: string;
  jam: string;
}
const statusConfig = {
  hadir: {
    label: 'Hadir',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800'
  },
  sakit: {
    label: 'Sakit',
    icon: AlertCircle,
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-800'
  },
  izin: {
    label: 'Izin',
    icon: HelpCircle,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800'
  },
  alpha: {
    label: 'Alpha',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800'
  }
};
export default function KehadiranSantri() {
  const {
    user
  } = useAuth();
  const {
    activeAcademicYear,
    getCurrentSemester
  } = useAcademicYear();
  const navigate = useNavigate();
  const semester = getCurrentSemester() || 'ganjil';
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const {
    startDate,
    endDate
  } = useMemo(() => {
    if (activeAcademicYear) {
      return semester === 'ganjil' ? {
        startDate: activeAcademicYear.odd_semester_start,
        endDate: activeAcademicYear.odd_semester_end
      } : {
        startDate: activeAcademicYear.even_semester_start,
        endDate: activeAcademicYear.even_semester_end
      };
    }
    // Fallback to current year if no academic year
    const now = new Date();
    return {
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`
    };
  }, [activeAcademicYear, semester]);

  // Fetch children IDs for orangtua
  const { data: childrenData } = useQuery({
    queryKey: ['parent-children', user?.id],
    queryFn: async () => {
      if (!user?.id || user.role !== 'orangtua') return null;
      const { data, error } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      if (error) throw error;
      return data?.map(c => c.child_id) || [];
    },
    enabled: !!user?.id && user?.role === 'orangtua'
  });

  // Determine which santri IDs to query
  const santriIds = useMemo(() => {
    if (user?.role === 'orangtua') {
      return childrenData || [];
    }
    return user?.id ? [user.id] : [];
  }, [user?.id, user?.role, childrenData]);

  // Fetch kehadiran records
  const {
    data: kehadiranList = [],
    isLoading
  } = useQuery({
    queryKey: ['kehadiran-santri-self', santriIds, startDate, endDate],
    queryFn: async () => {
      if (santriIds.length === 0) return [];
      const {
        data,
        error
      } = await supabase.from('kehadiran_santri').select(`
          id,
          status,
          santri_id,
          sesi:sesi_pembelajaran!kehadiran_santri_sesi_id_fkey(
            id,
            tanggal,
            waktu_mulai,
            jadwal:jadwal!sesi_pembelajaran_jadwal_id_fkey(
              id,
              jam_mulai,
              jam_selesai,
              mapel:mapel!jadwal_mapel_id_fkey(
                id,
                nama
              )
            )
          )
        `).in('santri_id', santriIds).gte('sesi.tanggal', startDate).lte('sesi.tanggal', endDate).order('created_at', {
        ascending: false
      });
      if (error) throw error;

      // Transform and filter data
      const records: KehadiranRecord[] = [];
      data?.forEach((item: any) => {
        if (item.sesi && item.sesi.jadwal) {
          records.push({
            id: item.id,
            status: item.status,
            tanggal: item.sesi.tanggal,
            mapel: item.sesi.jadwal.mapel?.nama || '-',
            jam: `${item.sesi.jadwal.jam_mulai} - ${item.sesi.jadwal.jam_selesai}`
          });
        }
      });

      // Sort by date descending
      return records.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    },
    enabled: santriIds.length > 0
  });

  // Filter by time helper
  const filterByTime = (tanggal: string) => {
    const recordDate = new Date(tanggal);
    const now = new Date();
    if (timeFilter === 'today') {
      return recordDate.toDateString() === now.toDateString();
    } else if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return recordDate >= weekAgo;
    } else if (timeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return recordDate >= monthAgo;
    }
    return true;
  };

  // Filtered list based on search and time filter
  const filteredKehadiranList = useMemo(() => {
    return kehadiranList.filter(record => {
      const matchesSearch = record.mapel.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTime = filterByTime(record.tanggal);
      return matchesSearch && matchesTime;
    });
  }, [kehadiranList, searchQuery, timeFilter]);

  // Calculate stats from filtered list
  const stats = useMemo(() => {
    const hadir = filteredKehadiranList.filter(k => k.status === 'hadir').length;
    const sakit = filteredKehadiranList.filter(k => k.status === 'sakit').length;
    const izin = filteredKehadiranList.filter(k => k.status === 'izin').length;
    const alpha = filteredKehadiranList.filter(k => k.status === 'alpha').length;
    const total = filteredKehadiranList.length;
    const persentase = total > 0 ? Math.round(hadir / total * 100) : 0;
    return {
      hadir,
      sakit,
      izin,
      alpha,
      total,
      persentase
    };
  }, [filteredKehadiranList]);
  if (!user) return null;
  return <div className="space-y-6">
      {/* Header dengan gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
        
        <div className="relative flex items-start gap-4 z-10">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/dashboard')} className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{user.role === 'orangtua' ? 'Kehadiran Anak' : 'Kehadiran Saya'}</h1>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white/90 font-medium text-xs">
                Tahun Ajaran {activeAcademicYear?.name || "-"} • Semester {semester === "ganjil" ? "Ganjil" : "Genap"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div> : <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Persentase Kehadiran */}
          <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium opacity-90">Kehadiran</span>
            </div>
            <p className="text-3xl font-bold">{stats.persentase}%</p>
            
          </div>
          
          {/* Status Cards */}
          {[{
        icon: CheckCircle2,
        label: 'Hadir',
        value: stats.hadir,
        bgOuter: '#DCFCE7',
        bgInner: '#22C55E'
      }, {
        icon: AlertCircle,
        label: 'Sakit',
        value: stats.sakit,
        bgOuter: '#FFEDD5',
        bgInner: '#F97316'
      }, {
        icon: HelpCircle,
        label: 'Izin',
        value: stats.izin,
        bgOuter: '#DBEAFE',
        bgInner: '#3B82F6'
      }, {
        icon: XCircle,
        label: 'Alpha',
        value: stats.alpha,
        bgOuter: '#FEE2E2',
        bgInner: '#EF4444'
      }].map((stat, index) => {
        const Icon = stat.icon;
        return <div key={stat.label} className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-xl p-3 sm:p-4" style={{
          animationDelay: `${index * 100}ms`
        }}>
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2 sm:p-2.5 shrink-0" style={{
              backgroundColor: stat.bgOuter
            }}>
                    <div className="rounded-full p-1 sm:p-1.5" style={{
                backgroundColor: stat.bgInner
              }}>
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{
                  color: '#FFFFFF'
                }} strokeWidth={2} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</h3>
                  </div>
                </div>
              </div>;
      })}
        </div>}

      {/* Container: Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Header with filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b bg-muted/30">
          
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari mapel..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 rounded-xl w-full" />
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 rounded-xl">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Pilih waktu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">Minggu Ini</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-0">
          {isLoading ? <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div> : filteredKehadiranList.length === 0 ? <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada data kehadiran {searchQuery || timeFilter !== 'all' ? 'yang cocok' : 'pada periode ini'}</p>
            </div> : <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="w-[50px] text-center font-semibold">No</TableHead>
                  <TableHead className="font-semibold">Tanggal</TableHead>
                  <TableHead className="font-semibold hidden sm:table-cell">Mata Pelajaran</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Jam</TableHead>
                  <TableHead className="text-center font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKehadiranList.map((record, index) => {
              const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.alpha;
              const Icon = config.icon;
              const formattedDate = format(new Date(record.tanggal), 'EEE, d MMM yyyy', {
                locale: id
              });
              return <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formattedDate}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{record.mapel}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{record.mapel}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{record.jam}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${config.className} gap-1`}>
                          <Icon className="h-3 w-3" />
                          <span className="hidden sm:inline">{config.label}</span>
                        </Badge>
                      </TableCell>
                    </TableRow>;
            })}
              </TableBody>
            </Table>}
        </div>
      </div>
    </div>;
}