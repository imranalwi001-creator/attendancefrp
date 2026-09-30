import { useState, useMemo, useCallback, useRef } from 'react';
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
import { Download, Users, TrendingUp, Clock, CalendarDays, Filter, Printer, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import AttendanceStatCard from './AttendanceStatCard';
import PrintButton from '@/components/print/PrintButton';
import ExportButton from '@/components/ui/export-button';
import ReportPrintTemplate from '@/components/print/ReportPrintTemplate';

interface LaporanKehadiranGuruModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getWorkDaysInMonth(year: number, month: number): number {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getWaktuMulaiStatus(waktuMulai: string | null, jamMulai: string): 'tepat_waktu' | 'terlambat' | null {
  if (!waktuMulai || !jamMulai) return null;
  const waktuMulaiDate = parseISO(waktuMulai);
  const waktuMulaiMinutes = waktuMulaiDate.getHours() * 60 + waktuMulaiDate.getMinutes();
  const [jamHour, jamMin] = jamMulai.split(':').map(Number);
  const jamMulaiMinutes = jamHour * 60 + jamMin;
  if (waktuMulaiMinutes > jamMulaiMinutes + 10) return 'terlambat';
  return 'tepat_waktu';
}

export function LaporanKehadiranGuruModal({ open, onOpenChange }: LaporanKehadiranGuruModalProps) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const printRef = useRef<HTMLDivElement>(null);

  const selectedMonth = parseInt(month);
  const selectedYear = parseInt(year);

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const workDays = useMemo(() => getWorkDaysInMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const datesInRange = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);

  // Fetch all mapel with pengampu
  const { data: mapelData = [] } = useQuery({
    queryKey: ['laporan-guru-mapel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapel')
        .select('id, nama, pengampu_id')
        .eq('status', 'aktif');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  // Get unique guru IDs from mapel
  const guruIds = useMemo(() => {
    return [...new Set(mapelData.map(m => m.pengampu_id).filter(Boolean))] as string[];
  }, [mapelData]);

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['laporan-guru-profiles', guruIds],
    queryFn: async () => {
      if (guruIds.length === 0) return [];
      const { data, error } = await supabase.from('profiles').select('id, name').in('id', guruIds);
      if (error) throw error;
      return data || [];
    },
    enabled: open && guruIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch jadwal for schedule counting
  const { data: jadwalData = [] } = useQuery({
    queryKey: ['laporan-guru-jadwal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jadwal')
        .select('id, pengampu_id, jam_mulai, hari')
        .eq('status', 'aktif');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch holiday dates from kalender_events
  const { data: holidayDates = [] } = useQuery({
    queryKey: ['laporan-guru-holidays', startDate, endDate],
    queryFn: async () => {
      // Find libur kategori IDs
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

      // Expand date ranges into individual dates
      const dates = new Set<string>();
      (data || []).forEach(ev => {
        const start = new Date(ev.tanggal_mulai);
        const end = new Date(ev.tanggal_selesai);
        const current = new Date(start);
        while (current <= end) {
          dates.add(format(current, 'yyyy-MM-dd'));
          current.setDate(current.getDate() + 1);
        }
      });
      return [...dates];
    },
    enabled: open,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch sesi pembelajaran in date range
  const { data: sesiData = [], isLoading } = useQuery({
    queryKey: ['laporan-guru-sesi', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sesi_pembelajaran')
        .select('id, tanggal, waktu_mulai, status, pengampu_id, jadwal:jadwal!sesi_pembelajaran_jadwal_id_fkey(id, jam_mulai, pengampu_id)')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 3,
  });

  const rekapData = useMemo(() => {
    return guruIds.map(guruId => {
      const profile = profiles.find(p => p.id === guruId);
      const teacherMapel = mapelData.filter(m => m.pengampu_id === guruId).map(m => m.nama);
      const teacherJadwal = jadwalData.filter(j => j.pengampu_id === guruId);
      const teacherSesi = sesiData.filter((s: any) => s.pengampu_id === guruId);

      let hadir = 0;
      let tepatWaktu = 0;
      let terlambat = 0;
      let sebagaiPengganti = 0;

      teacherSesi.forEach((sesi: any) => {
        if (sesi.status === 'selesai') {
          hadir++;
          const waktuStatus = getWaktuMulaiStatus(sesi.waktu_mulai, sesi.jadwal?.jam_mulai);
          if (waktuStatus === 'tepat_waktu') tepatWaktu++;
          else if (waktuStatus === 'terlambat') terlambat++;
          if (sesi.jadwal?.pengampu_id && sesi.pengampu_id !== sesi.jadwal.pengampu_id) {
            sebagaiPengganti++;
          }
        }
      });

      // Calculate tidak hadir: only past dates, exclude holidays
      const today = format(new Date(), 'yyyy-MM-dd');
      let tidakHadir = 0;
      datesInRange.forEach(dateStr => {
        // Skip future dates
        if (dateStr > today) return;
        // Skip holidays
        if (holidayDates.includes(dateStr)) return;

        const dateObj = new Date(dateStr);
        const dayName = dayNames[dateObj.getDay()];
        const jadwalForDay = teacherJadwal.filter(j => j.hari === dayName);
        jadwalForDay.forEach(jadwal => {
          const hasSesi = sesiData.some((s: any) => s.jadwal?.id === jadwal.id && s.tanggal === dateStr);
          if (!hasSesi) tidakHadir++;
        });
      });

      const totalSesi = hadir + tidakHadir;
      const persen = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0;

      return {
        id: guruId,
        name: profile?.name || 'Unknown',
        mapelList: teacherMapel,
        hadir,
        tidakHadir,
        tepatWaktu,
        terlambat,
        sebagaiPengganti,
        persen,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [guruIds, profiles, mapelData, jadwalData, sesiData, datesInRange, holidayDates]);

  const summaryStats = useMemo(() => {
    const total = rekapData.length;
    const avgPersen = total > 0 ? Math.round(rekapData.reduce((acc, s) => acc + s.persen, 0) / total) : 0;
    const totalTerlambat = rekapData.reduce((acc, s) => acc + s.terlambat, 0);
    const totalHadir = rekapData.reduce((acc, s) => acc + s.hadir, 0);
    const terlambatPersen = totalHadir > 0 ? Math.round((totalTerlambat / totalHadir) * 100) : 0;
    return { total, avgPersen, terlambatPersen };
  }, [rekapData]);

  const getPersenColor = (p: number) => {
    if (p >= 80) return 'text-green-600';
    if (p >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];

    wsData.push(['LAPORAN KEHADIRAN MENGAJAR']);
    wsData.push(['Periode', `${MONTHS[selectedMonth]} ${selectedYear}`]);
    wsData.push(['Total Guru', `${rekapData.length} orang`]);
    wsData.push([]);

    wsData.push(['RINGKASAN']);
    wsData.push(['Rata-rata Kehadiran', `${summaryStats.avgPersen}%`]);
    wsData.push(['Keterlambatan', `${summaryStats.terlambatPersen}%`]);
    wsData.push([]);

    const headers = ['No', 'Nama', 'Mapel', 'Hadir', 'Tepat Waktu', 'Terlambat', 'Pengganti'];
    wsData.push(headers);

    rekapData.forEach((s, i) => {
      wsData.push([
        i + 1,
        s.name,
        s.mapelList.join(', '),
        s.hadir,
        s.tepatWaktu,
        s.terlambat,
        s.sebagaiPengganti,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Kehadiran Mengajar');
    XLSX.writeFile(wb, `laporan-kehadiran-mengajar-${MONTHS[selectedMonth]}-${selectedYear}.xlsx`);
    toast.success('Laporan Excel berhasil diexport');
  }, [rekapData, selectedMonth, selectedYear, summaryStats]);

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
    doc.text('LAPORAN KEHADIRAN MENGAJAR', centerX, 39, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const infoRows = [
      ['Periode', periode],
      ['Total Guru', `${rekapData.length} orang`],
      ['Rata-rata Kehadiran', `${summaryStats.avgPersen}%`],
      ['Keterlambatan', `${summaryStats.terlambatPersen}%`],
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
      startY: 75,
      head: [['No', 'Nama Guru', 'Mapel', 'Hadir', 'Tepat Waktu', 'Terlambat', 'Pengganti']],
      body: rekapData.map((row, index) => [
        index + 1,
        row.name,
        row.mapelList.join(', ') || '-',
        row.hadir,
        row.tepatWaktu,
        row.terlambat,
        row.sebagaiPengganti,
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

    doc.save(`laporan-kehadiran-mengajar-${MONTHS[selectedMonth]}-${selectedYear}.pdf`);
    toast.success('Laporan PDF berhasil diexport');
  }, [rekapData, selectedMonth, selectedYear, summaryStats]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] flex flex-col">
        {/* Header */}
        <DrawerHeader className="flex-shrink-0 border-b pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle>Laporan Kehadiran Mengajar {MONTHS[selectedMonth]}</DrawerTitle>
            <div className="flex items-center gap-2">
              <PrintButton
                contentRef={printRef}
                documentTitle={`Laporan_Kehadiran_Mengajar_${MONTHS[selectedMonth]}_${selectedYear}`}
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
          <AttendanceStatCard icon={Users} label="Total Guru" value={summaryStats.total} bgOuter="#DBEAFE" bgInner="#3B82F6" index={0} />
          <AttendanceStatCard icon={TrendingUp} label="Rata-rata Kehadiran" value={`${summaryStats.avgPersen}%`} bgOuter="#D1FAE5" bgInner="#10B981" index={1} />
          <AttendanceStatCard icon={Clock} label="Keterlambatan" value={`${summaryStats.terlambatPersen}%`} bgOuter="#FEF3C7" bgInner="#F59E0B" index={2} />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0 px-4">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[180px]">Guru</TableHead>
                  <TableHead className="text-xs min-w-[120px]">Mapel</TableHead>
                  <TableHead className="text-center text-xs">Hadir</TableHead>
                  <TableHead className="text-center text-xs whitespace-nowrap">Tepat Waktu</TableHead>
                  <TableHead className="text-center text-xs">Terlambat</TableHead>
                  <TableHead className="text-center text-xs">Pengganti</TableHead>
                  {/* <TableHead className="text-center text-xs whitespace-nowrap">Tidak Hadir</TableHead> */}
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-sm">Memuat data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rekapData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 opacity-30" />
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
                        <div className="flex flex-wrap gap-1">
                          {s.mapelList.slice(0, 2).map((m, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>
                          ))}
                          {s.mapelList.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">+{s.mapelList.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{s.hadir || '-'}</TableCell>
                      <TableCell className="text-center text-emerald-600 dark:text-emerald-400">{s.tepatWaktu || '-'}</TableCell>
                      <TableCell className="text-center text-amber-600 dark:text-amber-400">{s.terlambat || '-'}</TableCell>
                      <TableCell className="text-center text-blue-600 dark:text-blue-400">{s.sebagaiPengganti || '-'}</TableCell>
                      {/* <TableCell className="text-center text-destructive font-medium">{s.tidakHadir || '-'}</TableCell> */}
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
            title="LAPORAN KEHADIRAN MENGAJAR"
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
                    <td className="pr-4 py-1 text-muted-foreground">Total Guru</td>
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
                  <th>Mapel</th>
                  <th className="text-center">Hadir</th>
                  <th className="text-center">TW</th>
                  <th className="text-center">TL</th>
                  <th className="text-center">PG</th>
                  {/* <th className="text-center">TH</th> */}
                  
                </tr>
              </thead>
              <tbody>
                {rekapData.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-center">{i + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.mapelList.join(', ')}</td>
                    <td className="text-center">{s.hadir}</td>
                    <td className="text-center">{s.tepatWaktu}</td>
                    <td className="text-center">{s.terlambat}</td>
                    <td className="text-center">{s.sebagaiPengganti}</td>
                    {/* <td className="text-center">{s.tidakHadir}</td> */}
                    
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

export default LaporanKehadiranGuruModal;
