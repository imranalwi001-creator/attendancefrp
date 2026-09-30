import { useState, useMemo, useCallback, useRef } from 'react';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Users, TrendingUp, CalendarDays, Filter, Printer, GraduationCap, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AttendanceStatCard from './AttendanceStatCard';
import PrintButton from '@/components/print/PrintButton';
import ExportButton from '@/components/ui/export-button';
import ReportPrintTemplate from '@/components/print/ReportPrintTemplate';

interface LaporanKehadiranSantriModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endD = new Date(end);
  while (current <= endD) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

interface SantriRekap {
  id: string;
  name: string;
  kelas: string;
  kelasId: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  totalJadwal: number;
  persen: number;
}

export function LaporanKehadiranSantriModal({ open, onOpenChange }: LaporanKehadiranSantriModalProps) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [kelasFilter, setKelasFilter] = useState<string>('all');
  const printRef = useRef<HTMLDivElement>(null);
  const { activeAcademicYear } = useAcademicYear();

  const selectedMonth = parseInt(month);
  const selectedYear = parseInt(year);

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const datesInRange = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);

  // Fetch kelas list (only active in current academic year)
  const { data: kelasList = [] } = useQuery({
    queryKey: ['laporan-santri-kelas', activeAcademicYear?.name],
    queryFn: async () => {
      let query = supabase
        .from('kelas')
        .select('id, nama')
        .eq('status', 'aktif');
      
      if (activeAcademicYear?.name) {
        query = query.eq('tahun_ajaran', activeAcademicYear.name);
      }

      const { data, error } = await query.order('nama');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch santri with profiles and kelas
  const { data: santriData = [] } = useQuery({
    queryKey: ['laporan-santri-data', kelasFilter],
    queryFn: async () => {
      let query = supabase
        .from('santri')
        .select('id, kelas_id, profiles:profiles!santri_id_fkey(id, name), kelas:kelas!santri_kelas_id_fkey(id, nama, status)');
      
      if (kelasFilter !== 'all') {
        query = query.eq('kelas_id', kelasFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter((s: any) => s.kelas?.status === 'aktif');
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  const santriIds = useMemo(() => santriData.map((s: any) => s.id), [santriData]);
  const kelasIds = useMemo(() => [...new Set(santriData.map((s: any) => s.kelas_id).filter(Boolean))] as string[], [santriData]);

  // Fetch jadwal per kelas (to count scheduled lessons)
  const { data: jadwalData = [] } = useQuery({
    queryKey: ['laporan-santri-jadwal', kelasIds],
    queryFn: async () => {
      if (kelasIds.length === 0) return [];
      const { data, error } = await supabase
        .from('jadwal')
        .select('id, kelas_id, hari')
        .eq('status', 'aktif')
        .in('kelas_id', kelasIds);
      if (error) throw error;
      return data || [];
    },
    enabled: open && kelasIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch holiday dates
  const { data: holidayDates = [] } = useQuery({
    queryKey: ['laporan-santri-holidays', startDate, endDate],
    queryFn: async () => {
      const { data: kategoriData } = await supabase
        .from('kalender_kategori')
        .select('id')
        .ilike('nama', '%libur%');
      if (!kategoriData || kategoriData.length === 0) return [];
      const kategoriIds = kategoriData.map(k => k.id);

      const { data, error } = await supabase
        .from('kalender_events')
        .select('tanggal_mulai, tanggal_selesai')
        .in('kategori_id', kategoriIds)
        .eq('status', 'approved')
        .lte('tanggal_mulai', endDate)
        .gte('tanggal_selesai', startDate);
      if (error) throw error;

      const dates = new Set<string>();
      (data || []).forEach(ev => {
        const s = new Date(ev.tanggal_mulai);
        const e = new Date(ev.tanggal_selesai);
        const cur = new Date(s);
        while (cur <= e) {
          dates.add(format(cur, 'yyyy-MM-dd'));
          cur.setDate(cur.getDate() + 1);
        }
      });
      return [...dates];
    },
    enabled: open,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch sesi IDs in date range
  const { data: validSesiIds = [] } = useQuery({
    queryKey: ['laporan-santri-sesi', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select('id')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .limit(5000);
      if (error) throw error;
      return (data || []).map(s => s.id);
    },
    enabled: open,
    staleTime: 1000 * 60 * 3,
  });

  // Fetch kehadiran
  const { data: kehadiranData = [], isLoading } = useQuery({
    queryKey: ['laporan-santri-kehadiran', santriIds.length, validSesiIds.length, startDate, endDate],
    queryFn: async () => {
      if (santriIds.length === 0 || validSesiIds.length === 0) return [];
      
      const batchSize = 200;
      let all: any[] = [];
      for (let i = 0; i < validSesiIds.length; i += batchSize) {
        const batch = validSesiIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('kehadiran_santri')
          .select('santri_id, status, sesi_id')
          .in('santri_id', santriIds)
          .in('sesi_id', batch);
        if (error) throw error;
        all = all.concat(data || []);
      }
      return all;
    },
    enabled: open && santriIds.length > 0 && validSesiIds.length > 0,
    staleTime: 1000 * 60 * 3,
  });

  // Pre-compute total jadwal per kelas: only past dates, exclude holidays
  const jadwalPerKelas = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const map: Record<string, number> = {};
    kelasIds.forEach(kelasId => {
      const kelasJadwal = jadwalData.filter((j: any) => j.kelas_id === kelasId);
      let total = 0;
      datesInRange.forEach(dateStr => {
        if (dateStr > today) return;
        if (holidayDates.includes(dateStr)) return;
        const dateObj = new Date(dateStr);
        const dayName = dayNames[dateObj.getDay()];
        total += kelasJadwal.filter((j: any) => j.hari === dayName).length;
      });
      map[kelasId] = total;
    });
    return map;
  }, [kelasIds, jadwalData, datesInRange, holidayDates]);

  const rekapData = useMemo<SantriRekap[]>(() => {
    return santriData.map((santri: any) => {
      const records = kehadiranData.filter((k: any) => k.santri_id === santri.id);
      let hadir = 0, sakit = 0, izin = 0, alpha = 0;
      records.forEach((k: any) => {
        switch (k.status) {
          case 'hadir': hadir++; break;
          case 'sakit': sakit++; break;
          case 'izin': izin++; break;
          case 'alpha': alpha++; break;
        }
      });
      const totalJadwal = jadwalPerKelas[santri.kelas_id] || 0;
      const persen = totalJadwal > 0 ? Math.round((hadir / totalJadwal) * 100) : 0;

      return {
        id: santri.id,
        name: santri.profiles?.name || 'Unknown',
        kelas: santri.kelas?.nama || '-',
        kelasId: santri.kelas_id || '',
        hadir,
        sakit,
        izin,
        alpha,
        totalJadwal,
        persen,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [santriData, kehadiranData, jadwalPerKelas]);

  const summaryStats = useMemo(() => {
    const total = rekapData.length;
    const avgPersen = total > 0 ? Math.round(rekapData.reduce((acc, s) => acc + s.persen, 0) / total) : 0;
    const totalAlpha = rekapData.reduce((acc, s) => acc + s.alpha, 0);
    const totalJadwalAll = rekapData.reduce((acc, s) => acc + s.totalJadwal, 0);
    const alphaPersen = totalJadwalAll > 0 ? Math.round((totalAlpha / totalJadwalAll) * 100) : 0;
    return { total, avgPersen, alphaPersen };
  }, [rekapData]);

  const getPersenColor = (p: number) => {
    if (p >= 80) return 'text-green-600';
    if (p >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const selectedKelasName = kelasFilter === 'all' ? 'Semua Kelas' : kelasList.find(k => k.id === kelasFilter)?.nama || '';

  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];

    wsData.push(['LAPORAN KEHADIRAN SANTRI']);
    wsData.push(['Periode', `${MONTHS[selectedMonth]} ${selectedYear}`]);
    wsData.push(['Kelas', selectedKelasName]);
    wsData.push(['Total Santri', `${rekapData.length} orang`]);
    wsData.push([]);

    wsData.push(['RINGKASAN']);
    wsData.push(['Rata-rata Kehadiran', `${summaryStats.avgPersen}%`]);
    wsData.push(['Alpha', `${summaryStats.alphaPersen}%`]);
    wsData.push([]);

    const headers = ['No', 'Nama', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpha'];
    wsData.push(headers);

    rekapData.forEach((s, i) => {
      wsData.push([
        i + 1, s.name, s.kelas, s.hadir, s.sakit, s.izin, s.alpha,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 13 },
    ];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Kehadiran Santri');
    XLSX.writeFile(wb, `laporan-kehadiran-santri-${MONTHS[selectedMonth]}-${selectedYear}.xlsx`);
    toast.success('Laporan Excel berhasil diexport');
  }, [rekapData, selectedMonth, selectedYear, summaryStats, selectedKelasName]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    const periode = `${MONTHS[selectedMonth]} ${selectedYear}`;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SMPIT Digital Islamic Boarding School', centerX, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Jln. Bintang Mujur, Pangkajene Kepulauan, Sulawesi Selatan', centerX, 21, { align: 'center' });
    doc.text('Website: digiss.co.id | Email: digissemail@gmail.com', centerX, 26, { align: 'center' });
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.line(14, 30, pageWidth - 14, 30);
    doc.setLineWidth(0.3);
    doc.line(14, 31, pageWidth - 14, 31);

    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN KEHADIRAN SANTRI', centerX, 39, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const infoRows = [
      ['Periode', periode],
      ['Kelas', selectedKelasName],
      ['Total Santri', `${rekapData.length} orang`],
      ['Rata-rata Kehadiran', `${summaryStats.avgPersen}%`],
      ['Alpha', `${summaryStats.alphaPersen}%`],
    ];
    infoRows.forEach(([label, value], index) => {
      const y = 47 + index * 6;
      doc.setFont('helvetica', 'normal');
      doc.text(label, 14, y);
      doc.text(':', 52, y);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 56, y);
    });

    autoTable(doc, {
      startY: 82,
      head: [['No', 'Nama Santri', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Total Jadwal', '% Kehadiran']],
      body: rekapData.map((row, index) => [
        index + 1,
        row.name,
        row.kelas,
        row.hadir,
        row.sakit,
        row.izin,
        row.alpha,
        row.totalJadwal,
        `${row.persen}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'center', fontStyle: 'bold' },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 170;
    const sigX = pageWidth - 82;
    const sigY = Math.min(finalY + 14, 180);
    const today = new Date();
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pangkajene, ${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`, sigX, sigY);
    doc.text('Kepala Sekolah', sigX, sigY + 6);
    doc.setFont('helvetica', 'bold');
    doc.text('________________________', sigX, sigY + 28);

    doc.save(`laporan-kehadiran-santri-${MONTHS[selectedMonth]}-${selectedYear}.pdf`);
    toast.success('Laporan PDF berhasil diexport');
  }, [rekapData, selectedMonth, selectedYear, summaryStats, selectedKelasName]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 border-b pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle>Laporan Kehadiran Santri {MONTHS[selectedMonth]}</DrawerTitle>
            <div className="flex items-center gap-2">
              <PrintButton
                contentRef={printRef}
                documentTitle={`Laporan_Kehadiran_Santri_${MONTHS[selectedMonth]}_${selectedYear}`}
                variant="btn_sec"
                size="sm"
                className="h-8 gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="text-xs">Print</span>
              </PrintButton>
              <ExportButton className="h-8 gap-1.5" onClick={handleExportExcel} disabled={rekapData.length === 0}>
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Excel</span>
              </ExportButton>
              <ExportButton className="h-8 gap-1.5" onClick={handleExportPDF} disabled={rekapData.length === 0}>
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">PDF</span>
              </ExportButton>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="btn_sec" size="sm" className="h-8 gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="text-xs">Filter</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Kelas</label>
                    <Select value={kelasFilter} onValueChange={setKelasFilter}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {kelasList.map(k => (
                          <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Bulan</label>
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tahun</label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </DrawerHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 flex-shrink-0">
          <AttendanceStatCard icon={GraduationCap} label="Total Santri" value={summaryStats.total} bgOuter="#DBEAFE" bgInner="#3B82F6" index={0} />
          <AttendanceStatCard icon={TrendingUp} label="Rata-rata Kehadiran" value={`${summaryStats.avgPersen}%`} bgOuter="#D1FAE5" bgInner="#10B981" index={1} />
          <AttendanceStatCard icon={AlertTriangle} label="Alpha" value={`${summaryStats.alphaPersen}%`} bgOuter="#FEF3C7" bgInner="#F59E0B" index={2} />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0 px-4">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[180px]">Santri</TableHead>
                  <TableHead className="text-xs min-w-[80px]">Kelas</TableHead>
                  <TableHead className="text-center text-xs">Hadir</TableHead>
                  <TableHead className="text-center text-xs">Sakit</TableHead>
                  <TableHead className="text-center text-xs">Izin</TableHead>
                  <TableHead className="text-center text-xs">Alpha</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-sm">Memuat data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rekapData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="h-8 w-8 opacity-30" />
                        <span className="text-sm">Tidak ada data</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rekapData.map((s) => (
                    <TableRow key={s.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="sticky left-0 bg-card group-hover:bg-muted/30 z-10 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {s.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm truncate max-w-[140px]">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{s.kelas}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{s.hadir || '-'}</TableCell>
                      <TableCell className="text-center text-orange-600 dark:text-orange-400">{s.sakit || '-'}</TableCell>
                      <TableCell className="text-center text-blue-600 dark:text-blue-400">{s.izin || '-'}</TableCell>
                      <TableCell className="text-center text-destructive font-medium">{s.alpha || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </ScrollArea>

        {/* Hidden Print Template */}
        <div className="hidden">
          <ReportPrintTemplate
            ref={printRef}
            title="LAPORAN KEHADIRAN SANTRI"
            semester={selectedMonth < 6 ? 'genap' : 'ganjil'}
            signer={{ name: "Kepala Sekolah", jabatan: "Kepala Sekolah" }}
          >
            <div className="mb-4">
              <table className="text-sm">
                <tbody>
                  <tr>
                    <td className="pr-4 py-1 text-muted-foreground">Bulan</td>
                    <td className="pr-2">:</td>
                    <td className="font-semibold">{MONTHS[selectedMonth]} {selectedYear}</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1 text-muted-foreground">Kelas</td>
                    <td className="pr-2">:</td>
                    <td className="font-semibold">{selectedKelasName}</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1 text-muted-foreground">Total Santri</td>
                    <td className="pr-2">:</td>
                    <td className="font-semibold">{rekapData.length} orang</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="print-table">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: '30px' }}>No</th>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th className="text-center">Hadir</th>
                  <th className="text-center">Sakit</th>
                  <th className="text-center">Izin</th>
                  <th className="text-center">Alpha</th>
                  
                </tr>
              </thead>
              <tbody>
                {rekapData.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-center">{i + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.kelas}</td>
                    <td className="text-center">{s.hadir}</td>
                    <td className="text-center">{s.sakit}</td>
                    <td className="text-center">{s.izin}</td>
                    <td className="text-center">{s.alpha}</td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportPrintTemplate>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default LaporanKehadiranSantriModal;
