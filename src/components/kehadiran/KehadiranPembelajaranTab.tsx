import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Calendar, ChevronDown, BookOpen, CheckCircle2, Users, Target } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DataExportPanel from '@/components/ui/data-export-panel';
import { exportToPdf, exportToXlsx, type DataExportColumn } from '@/lib/dataExport';
import { useMemo } from 'react';

interface KehadiranPembelajaranTabProps {
  staffId: string;
}

const HARI_MAP: Record<string, string> = {
  'senin': 'Senin',
  'selasa': 'Selasa',
  'rabu': 'Rabu',
  'kamis': 'Kamis',
  'jumat': 'Jumat',
  'sabtu': 'Sabtu',
  'minggu': 'Minggu'
};

export default function KehadiranPembelajaranTab({ staffId }: KehadiranPembelajaranTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedMapel, setSelectedMapel] = useState<string>('all');

  // Fetch mapel list for this teacher
  const { data: mapelList = [] } = useQuery({
    queryKey: ['guru-mapel-list', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama, kelas:kelas_id(nama)')
        .eq('pengampu_id', staffId)
        .eq('status', 'aktif');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId
  });

  // Fetch jadwal for this teacher
  const { data: jadwalList = [] } = useQuery({
    queryKey: ['guru-jadwal-list', staffId, selectedMapel],
    queryFn: async () => {
      let query = supabase
        .from('jadwal')
        .select('id, hari, jam_mulai, jam_selesai, mapel_id')
        .eq('pengampu_id', staffId)
        .eq('status', 'aktif');
      
      if (selectedMapel !== 'all') {
        query = query.eq('mapel_id', selectedMapel);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId
  });

  // Fetch sesi_pembelajaran with kehadiran_santri
  const { data: riwayatKehadiran = [], isLoading } = useQuery({
    queryKey: ['guru-riwayat-kehadiran', staffId, jadwalList?.map(j => j.id), selectedMonth],
    queryFn: async () => {
      if (!jadwalList || jadwalList.length === 0) return [];

      const jadwalIds = jadwalList.map(j => j.id);
      
      // Fetch sesi_pembelajaran
      const { data: sesiData, error: sesiError } = await supabase
        .from('sesi_pembelajaran')
        .select(`
          id,
          jadwal_id,
          tanggal,
          waktu_mulai,
          waktu_selesai,
          status,
          metadata
        `)
        .eq('pengampu_id', staffId)
        .in('jadwal_id', jadwalIds)
        .order('tanggal', { ascending: false });

      if (sesiError) throw sesiError;
      if (!sesiData || sesiData.length === 0) return [];

      // Filter by month if selected
      const filteredSesi = selectedMonth === 'all' 
        ? sesiData 
        : sesiData.filter(s => s.tanggal.startsWith(selectedMonth));

      if (filteredSesi.length === 0) return [];

      // Extract materi_ids from metadata
      const materiIds = filteredSesi
        .map(s => (s.metadata as any)?.materi_id)
        .filter((id): id is string => !!id);

      // Fetch materi data if any
      let materiMap = new Map<string, { judul: string; bab: string }>();
      if (materiIds.length > 0) {
        const { data: materiData } = await supabase
          .from('materi')
          .select('id, judul, deskripsi')
          .in('id', materiIds);
        
        if (materiData) {
          materiMap = new Map(materiData.map(m => [m.id, { judul: m.judul, bab: m.deskripsi || '' }]));
        }
      }

      // Fetch kehadiran for all sesi
      const sesiIds = filteredSesi.map(s => s.id);
      const { data: kehadiranData, error: kehadiranError } = await supabase
        .from('kehadiran_santri')
        .select(`id, sesi_id, santri_id, status`)
        .in('sesi_id', sesiIds);

      if (kehadiranError) throw kehadiranError;

      // Fetch santri profiles for names
      const santriIds = [...new Set(kehadiranData?.map(k => k.santri_id) || [])];
      let profilesMap = new Map<string, string>();
      if (santriIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', santriIds);
        profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);
      }

      // Fetch mapel info for jadwal (including tujuan pembelajaran)
      const mapelIds = [...new Set(jadwalList.map(j => j.mapel_id).filter(Boolean))];
      let mapelInfoMap = new Map<string, string>();
      let tujuanPembelajaranMap = new Map<string, { text: string }[]>();
      if (mapelIds.length > 0) {
        const { data: mapelData } = await supabase
          .from('mapel')
          .select('id, nama')
          .in('id', mapelIds);
        mapelInfoMap = new Map(mapelData?.map(m => [m.id, m.nama]) || []);

        // Fetch mapel_info for tujuan pembelajaran
        const { data: mapelInfoData } = await supabase
          .from('mapel_info')
          .select('mapel_id, tujuan_pembelajaran')
          .in('mapel_id', mapelIds);
        
        if (mapelInfoData) {
          mapelInfoData.forEach(mi => {
            if (mi.tujuan_pembelajaran) {
              tujuanPembelajaranMap.set(mi.mapel_id, mi.tujuan_pembelajaran as { text: string }[]);
            }
          });
        }
      }

      // Map jadwal info
      const jadwalMap = new Map(jadwalList.map(j => [j.id, j]));

      // Combine data
      return filteredSesi.map(sesi => {
        const jadwal = jadwalMap.get(sesi.jadwal_id);
        const kehadiranSesi = kehadiranData?.filter(k => k.sesi_id === sesi.id) || [];
        const metadata = sesi.metadata as any;
        
        // Get materi info
        const materiId = metadata?.materi_id;
        const materiInfo = materiId ? materiMap.get(materiId) : null;
        
        // Get tujuan pembelajaran tercapai
        const mapelId = jadwal?.mapel_id;
        const tujuanList = mapelId ? tujuanPembelajaranMap.get(mapelId) : null;
        const tujuanTercapaiIds = metadata?.tujuan_tercapai_ids as number[] | undefined;
        const tujuanTercapai = tujuanList && tujuanTercapaiIds 
          ? tujuanTercapaiIds.map(idx => tujuanList[idx]?.text).filter(Boolean)
          : [];
        
        return {
          id: sesi.id,
          tanggal: sesi.tanggal,
          hari: jadwal ? HARI_MAP[jadwal.hari.toLowerCase()] || jadwal.hari : '',
          jamMulai: jadwal?.jam_mulai?.slice(0, 5) || '',
          jamSelesai: jadwal?.jam_selesai?.slice(0, 5) || '',
          guruHadirAt: sesi.waktu_mulai ? format(new Date(sesi.waktu_mulai), 'HH:mm') : '-',
          status: sesi.status,
          mapelNama: jadwal?.mapel_id ? mapelInfoMap.get(jadwal.mapel_id) || '' : '',
          materiJudul: materiInfo?.judul || null,
          tujuanTercapai,
          kehadiran: kehadiranSesi.map(k => ({
            santriId: k.santri_id,
            nama: profilesMap.get(k.santri_id) || 'Unknown',
            status: mapStatusToCode(k.status)
          }))
        };
      });
    },
    enabled: !!jadwalList && jadwalList.length > 0
  });

  // Map status from DB to display code
  function mapStatusToCode(status: string): 'H' | 'S' | 'I' | 'A' {
    switch (status.toLowerCase()) {
      case 'hadir': return 'H';
      case 'sakit': return 'S';
      case 'izin': return 'I';
      case 'alpha': return 'A';
      default: return 'A';
    }
  }

  // Hitung statistik per sesi
  const getStats = (kehadiran: { status: 'H' | 'S' | 'I' | 'A' }[]) => ({
    hadir: kehadiran.filter(k => k.status === 'H').length,
    sakit: kehadiran.filter(k => k.status === 'S').length,
    izin: kehadiran.filter(k => k.status === 'I').length,
    alpa: kehadiran.filter(k => k.status === 'A').length,
    total: kehadiran.length
  });

  // Format tanggal
  const formatTanggal = (tanggal: string) => {
    try {
      return format(new Date(tanggal), 'd MMMM yyyy', { locale: idLocale });
    } catch {
      return tanggal;
    }
  };

  // Get status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'H':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">H</Badge>;
      case 'S':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20">S</Badge>;
      case 'I':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20">I</Badge>;
      case 'A':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20">A</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Generate month options dynamically
  const getMonthOptions = () => {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: idLocale });
      months.push({ value, label });
    }
    return months;
  };

  const exportColumns = useMemo(() => {
    const cols: DataExportColumn[] = [
      { key: 'no', label: 'No.', width: 40 },
      { key: 'nama_santri', label: 'Nama Santri', width: 200 }
    ];

    // Build columns from sorted sessions (ascending order for export)
    const sortedSesi = [...riwayatKehadiran].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
    sortedSesi.forEach(s => {
      const label = `${formatTanggal(s.tanggal)}\n${s.mapelNama || 'Mapel'}`;
      cols.push({ key: `sesi_${s.id}`, label, width: 100 });
    });
    
    // Add total columns
    cols.push({ key: 'total_h', label: 'Hadir', width: 60 });
    cols.push({ key: 'total_s', label: 'Sakit', width: 60 });
    cols.push({ key: 'total_i', label: 'Izin', width: 60 });
    cols.push({ key: 'total_a', label: 'Alpa', width: 60 });

    return cols;
  }, [riwayatKehadiran]);

  const exportData = useMemo(() => {
    // Extract unique santri
    const santriMap = new Map<string, { id: string; nama: string }>();
    riwayatKehadiran.forEach(sesi => {
      sesi.kehadiran.forEach(k => {
        if (!santriMap.has(k.santriId)) {
          santriMap.set(k.santriId, { id: k.santriId, nama: k.nama });
        }
      });
    });

    const rows = Array.from(santriMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
    
    return rows.map((santri, index) => {
      const row: any = { no: index + 1, nama_santri: santri.nama };
      let total_h = 0;
      let total_s = 0;
      let total_i = 0;
      let total_a = 0;

      riwayatKehadiran.forEach(sesi => {
        const k = sesi.kehadiran.find(x => x.santriId === santri.id);
        const status = k ? k.status : '-';
        row[`sesi_${sesi.id}`] = status;

        if (status === 'H') total_h++;
        if (status === 'S') total_s++;
        if (status === 'I') total_i++;
        if (status === 'A') total_a++;
      });

      row.total_h = total_h;
      row.total_s = total_s;
      row.total_i = total_i;
      row.total_a = total_a;

      return row;
    });
  }, [riwayatKehadiran]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="rounded-2xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map(j => (
                  <div key={j} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="rounded-2xl border-2 border-border/50 shadow-md">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Riwayat Kehadiran Pembelajaran</CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {riwayatKehadiran.length > 0 && (
                <DataExportPanel
                  data={exportData}
                  columns={exportColumns}
                  filename="Rekap_Kehadiran_Pembelajaran"
                  title="Rekap Kehadiran Pembelajaran"
                  subtitle={`Bulan: ${selectedMonth === 'all' ? 'Semua Bulan' : selectedMonth}`}
                  exportToPdf={exportToPdf}
                  exportToXlsx={exportToXlsx}
                />
              )}
              <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter mapel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Mapel</SelectItem>
                  {mapelList.map(mapel => (
                    <SelectItem key={mapel.id} value={mapel.id}>
                      {mapel.nama} - {(mapel.kelas as any)?.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter bulan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Bulan</SelectItem>
                  {getMonthOptions().map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {riwayatKehadiran.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Belum ada riwayat kehadiran pembelajaran</p>
            </div>
          ) : (
            <div className="space-y-4">
              {riwayatKehadiran.map(sesi => {
                const stats = getStats(sesi.kehadiran);
                return (
                  <Collapsible key={sesi.id} className="rounded-xl border border-border/50 overflow-hidden">
                    <CollapsibleTrigger className="w-full">
                      <div className="p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-card border border-border/50 mt-0.5">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="text-left flex-1 space-y-1">
                              <p className="font-semibold text-foreground">
                                {sesi.hari}, {formatTanggal(sesi.tanggal)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {sesi.jamMulai} - {sesi.jamSelesai} • Hadir: {sesi.guruHadirAt}
                              </p>
                              {sesi.mapelNama && (
                                <div className="flex items-center gap-2 text-sm">
                                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                                  <span className="font-medium text-foreground">{sesi.mapelNama}</span>
                                </div>
                              )}
                              {sesi.materiJudul && (
                                <p className="text-xs text-muted-foreground">
                                  Materi: {sesi.materiJudul}
                                </p>
                              )}
                              {sesi.tujuanTercapai && sesi.tujuanTercapai.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs text-primary">
                                    <Target className="h-3 w-3" />
                                    <span className="font-medium">Capaian Pembelajaran:</span>
                                  </div>
                                  <ul className="text-xs text-muted-foreground pl-4 space-y-0.5">
                                    {sesi.tujuanTercapai.map((tp, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>{tp}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <Badge variant="outline" className="gap-1">
                              <Users className="h-3 w-3" />
                              {stats.total}
                            </Badge>
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                              H: {stats.hadir}
                            </Badge>
                            <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              S: {stats.sakit}
                            </Badge>
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                              I: {stats.izin}
                            </Badge>
                            <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
                              A: {stats.alpa}
                            </Badge>
                            <ChevronDown className="h-4 w-4 text-muted-foreground ml-2 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-t border-b border-border/50 bg-muted/20">
                            <TableHead className="w-[60px] text-center font-semibold">No</TableHead>
                            <TableHead className="font-semibold">Nama Siswa</TableHead>
                            <TableHead className="text-center font-semibold w-[100px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sesi.kehadiran.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                Belum ada data kehadiran siswa
                              </TableCell>
                            </TableRow>
                          ) : (
                            sesi.kehadiran.map((siswa, index) => (
                              <TableRow key={siswa.santriId} className="border-b border-border/30">
                                <TableCell className="text-center font-medium text-muted-foreground">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-medium">{siswa.nama}</TableCell>
                                <TableCell className="text-center">
                                  {getStatusBadge(siswa.status)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
