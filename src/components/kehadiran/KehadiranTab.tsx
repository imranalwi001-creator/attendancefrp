import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Calendar, ChevronDown, BookOpen, CheckCircle2, UserCheck, User } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface KehadiranTabProps {
  mapelId: string;
  mapelNama: string;
  kelasId: string;
  userRole: string;
  santriList: {
    id: string;
    name: string;
  }[];
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

export default function KehadiranTab({
  mapelId
}: KehadiranTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Fetch sesi_pembelajaran with kehadiran_santri
  const { data: riwayatKehadiran, isLoading } = useQuery({
    queryKey: ['riwayat-kehadiran', mapelId],
    queryFn: async () => {
      // Fetch jadwal as supporting context only (attendance history must survive deleted jadwal)
      const { data: jadwalData, error: jadwalError } = await supabase
        .from('jadwal')
        .select('id, hari, jam_mulai, jam_selesai, pengampu_id')
        .eq('mapel_id', mapelId);

      if (jadwalError) throw jadwalError;

      const jadwalList = jadwalData || [];
      const jadwalMap = new Map(jadwalList.map(j => [j.id, j]));

      const { data: sesiData, error: sesiError } = await supabase
        .from('sesi_pembelajaran')
        .select(`
          id,
          jadwal_id,
          tanggal,
          waktu_mulai,
          waktu_selesai,
          foto_guru_url,
          status,
          pengampu_id,
          metadata,
          hari,
          jam_mulai,
          jam_selesai,
          jadwal_pengampu_id,
          mapel_id
        `)
        .eq('mapel_id', mapelId)
        .order('tanggal', { ascending: false });

      if (sesiError) throw sesiError;
      if (!sesiData || sesiData.length === 0) return [];

      const materiIds = sesiData
        .map(s => (s.metadata as any)?.materi_id)
        .filter((id): id is string => !!id);

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

      const { data: mapelInfoData } = await supabase
        .from('mapel_info')
        .select('tujuan_pembelajaran')
        .eq('mapel_id', mapelId)
        .maybeSingle();

      const tujuanList: { text: string }[] = Array.isArray(mapelInfoData?.tujuan_pembelajaran)
        ? (mapelInfoData.tujuan_pembelajaran as any[]).map((item: any) => ({
            text: typeof item === 'string' ? item : item?.text || ''
          }))
        : [];

      const sesiIds = sesiData.map(s => s.id);
      const { data: kehadiranData, error: kehadiranError } = await supabase
        .from('kehadiran_santri')
        .select(`
          id,
          sesi_id,
          santri_id,
          status
        `)
        .in('sesi_id', sesiIds);

      if (kehadiranError) throw kehadiranError;

      const santriIds = [...new Set(kehadiranData?.map(k => k.santri_id).filter((id): id is string => !!id) || [])];
      const { data: profilesData } = santriIds.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', santriIds)
        : { data: [] };

      const profilesMap = new Map<string, string>(profilesData?.map(p => [p.id, p.name] as [string, string]) || []);

      const sesiPengampuIds = [...new Set(sesiData.map(s => s.pengampu_id).filter((id): id is string => !!id))];
      const historicalPengampuIds = [...new Set(sesiData.map(s => s.jadwal_pengampu_id).filter((id): id is string => !!id))];
      const jadwalPengampuIds = jadwalList.map(j => j.pengampu_id).filter((id): id is string => !!id);
      const allPengampuIds = [...new Set([...sesiPengampuIds, ...historicalPengampuIds, ...jadwalPengampuIds])];

      let pengampuMap = new Map<string, string>();
      if (allPengampuIds.length > 0) {
        const { data: pengampuData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allPengampuIds);

        if (pengampuData) {
          pengampuMap = new Map(pengampuData.map(p => [p.id, p.name]));
        }
      }

      return sesiData.map(sesi => {
        const jadwal = sesi.jadwal_id ? jadwalMap.get(sesi.jadwal_id) : undefined;
        const kehadiranSesi = kehadiranData?.filter(k => k.sesi_id === sesi.id) || [];
        const metadata = sesi.metadata as any;

        const materiId = metadata?.materi_id;
        const materiInfo = materiId ? materiMap.get(materiId) : null;

        const tujuanTercapaiIds: number[] = metadata?.tujuan_tercapai_ids || [];
        const tujuanTercapaiTexts = tujuanTercapaiIds
          .map(idx => tujuanList[idx]?.text)
          .filter((text): text is string => !!text);

        const pengampuAsliId = sesi.jadwal_pengampu_id || jadwal?.pengampu_id || null;
        const isSubstitute = !!(pengampuAsliId && sesi.pengampu_id && pengampuAsliId !== sesi.pengampu_id);
        const substituteTeacherName = isSubstitute ? pengampuMap.get(sesi.pengampu_id) : null;
        const hariValue = sesi.hari || jadwal?.hari || '';

        return {
          id: sesi.id,
          tanggal: sesi.tanggal,
          hari: hariValue ? (HARI_MAP[hariValue.toLowerCase()] || hariValue) : '',
          jamMulai: sesi.jam_mulai || jadwal?.jam_mulai || '',
          jamSelesai: sesi.jam_selesai || jadwal?.jam_selesai || '',
          guruHadirAt: sesi.waktu_mulai ? format(new Date(sesi.waktu_mulai), 'HH:mm') : '-',
          status: sesi.status,
          materiJudul: materiInfo?.judul || null,
          materiBab: materiInfo?.bab || null,
          tujuanTercapai: tujuanTercapaiTexts,
          isSubstitute,
          substituteTeacherName,
          kehadiran: kehadiranSesi.map(k => ({
            santriId: k.santri_id,
            nama: profilesMap.get(k.santri_id) || 'Unknown',
            status: mapStatusToCode(k.status),
            keterangan: undefined
          }))
        };
      });
    },
    enabled: !!mapelId
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

  // Filter berdasarkan bulan
  const filteredRiwayat = selectedMonth === 'all' 
    ? riwayatKehadiran || []
    : (riwayatKehadiran || []).filter(r => r.tanggal.startsWith(selectedMonth));

  // Hitung statistik kehadiran guru
  const guruStats = {
    kehadiranGuru: filteredRiwayat.filter(sesi => !sesi.isSubstitute).length,
    kehadiranPengganti: filteredRiwayat.filter(sesi => sesi.isSubstitute).length,
  };

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
      return format(new Date(tanggal), 'd MMMM yyyy', {
        locale: idLocale
      });
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
      {/* Section: Riwayat Kehadiran */}
      <Card className="rounded-2xl border-2 border-border/50 shadow-md">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Riwayat Kehadiran</CardTitle>
              </div>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter bulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {getMonthOptions().map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* StatCard Kehadiran Guru */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <StatCard 
              icon={User} 
              label="Kehadiran Guru" 
              value={guruStats.kehadiranGuru}
              animationDelay={0}
              bgOuter="#DCFCE7"
              bgInner="#22C55E"
            />
            <StatCard 
              icon={UserCheck} 
              label="Kehadiran Guru Pengganti" 
              value={guruStats.kehadiranPengganti}
              animationDelay={100}
              bgOuter="#FED7AA"
              bgInner="#EA580C"
            />
          </div>
          {filteredRiwayat.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Belum ada riwayat kehadiran</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRiwayat.map(sesi => {
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
                            <div className="text-left flex-1 space-y-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">
                                    {sesi.hari}, {formatTanggal(sesi.tanggal)}
                                  </p>
                                  {sesi.isSubstitute && (
                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      Guru Pengganti
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {sesi.jamMulai} - {sesi.jamSelesai} • Guru hadir: {sesi.guruHadirAt}
                                  {sesi.isSubstitute && sesi.substituteTeacherName && (
                                    <span className="text-amber-600 font-medium"> • Oleh {sesi.substituteTeacherName}</span>
                                  )}
                                </p>
                              </div>
                              
                              {/* Materi & Bab Info */}
                              {sesi.materiJudul && (
                                <div className="flex items-center gap-2 text-sm">
                                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                                  <span className="font-medium text-foreground">{sesi.materiJudul}</span>
                                  {sesi.materiBab && (
                                    <Badge variant="outline" className="text-xs">
                                      {sesi.materiBab}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              
                              {/* Capaian Pembelajaran */}
                              {sesi.tujuanTercapai && sesi.tujuanTercapai.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    Capaian Pembelajaran:
                                  </p>
                                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                                    {sesi.tujuanTercapai.slice(0, 3).map((tp, idx) => (
                                      <li key={idx} className="line-clamp-1">• {tp}</li>
                                    ))}
                                    {sesi.tujuanTercapai.length > 3 && (
                                      <li className="text-primary">+{sesi.tujuanTercapai.length - 3} lainnya</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
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
                            <TableHead className="font-semibold">Keterangan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sesi.kehadiran.map((siswa, index) => (
                            <TableRow key={siswa.santriId} className="border-b border-border/30">
                              <TableCell className="text-center font-medium text-muted-foreground">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">{siswa.nama}</TableCell>
                              <TableCell className="text-center">
                                {getStatusBadge(siswa.status)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {siswa.keterangan || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
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
