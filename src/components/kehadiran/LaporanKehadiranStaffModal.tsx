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
import { Calendar } from '@/components/ui/calendar';
import { Download, Users, TrendingUp, Clock, CalendarDays, Filter, User, FileText, Printer, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AttendanceStatCard from './AttendanceStatCard';
import PrintButton from '@/components/print/PrintButton';
import ExportButton from '@/components/ui/export-button';
import { StaffAttendancePrintReport } from '@/components/print';

interface LaporanKehadiranStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


const ROLE_OPTIONS = [
  { value: 'all', label: 'Semua Role' },
  { value: 'admin', label: 'Admin' },
  { value: 'guru', label: 'Guru' },
  { value: 'walikelas', label: 'Wali Kelas' },
  { value: 'Pembina', label: 'Pembina' },
  { value: 'staff', label: 'Staff' },
  { value: 'guru_ekskul', label: 'Guru Ekskul' },
];

function getWorkDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (current <= last) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function LaporanKehadiranStaffModal({ open, onOpenChange }: LaporanKehadiranStaffModalProps) {
  const now = new Date();
  // Default: bulan berjalan
  const defaultRange: DateRange = {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultRange);
  const [roleFilter, setRoleFilter] = useState('all');
  const printRef = useRef<HTMLDivElement>(null);

  const fromDate = dateRange?.from ?? defaultRange.from!;
  const toDate = dateRange?.to ?? dateRange?.from ?? defaultRange.to!;

  const startDate = toISO(fromDate);
  const endDate = toISO(toDate);

  const periodeLabel = useMemo(() => {
    if (fromDate.toDateString() === toDate.toDateString()) {
      return format(fromDate, 'd MMMM yyyy', { locale: localeID });
    }
    const sameYear = fromDate.getFullYear() === toDate.getFullYear();
    const sameMonth = sameYear && fromDate.getMonth() === toDate.getMonth();
    if (sameMonth) {
      return `${format(fromDate, 'd', { locale: localeID })}–${format(toDate, 'd MMMM yyyy', { locale: localeID })}`;
    }
    if (sameYear) {
      return `${format(fromDate, 'd MMM', { locale: localeID })} – ${format(toDate, 'd MMM yyyy', { locale: localeID })}`;
    }
    return `${format(fromDate, 'd MMM yyyy', { locale: localeID })} – ${format(toDate, 'd MMM yyyy', { locale: localeID })}`;
  }, [fromDate, toDate]);

  const fileLabel = useMemo(() => `${toISO(fromDate)}_sd_${toISO(toDate)}`, [fromDate, toDate]);

  const workDays = useMemo(() => getWorkDaysInRange(fromDate, toDate), [fromDate, toDate]);

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list-all'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul']);
      if (roleError) throw roleError;
      if (!roleData?.length) return [];

      const userIds = roleData.map(r => r.user_id);
      const { data: profileData } = await supabase.from('profiles').select('id, name').in('id', userIds);
      const { data: staffData } = await supabase.from('staff').select('id, employee_id, position').in('id', userIds);

      return roleData.map(role => ({
        user_id: role.user_id,
        role: role.role,
        name: profileData?.find(p => p.id === role.user_id)?.name || 'Unknown',
        employee_id: staffData?.find(s => s.id === role.user_id)?.employee_id || null,
        position: staffData?.find(s => s.id === role.user_id)?.position || null,
      }));
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ['kehadiran-staff-laporan', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kehadiran_staff')
        .select('staff_id, jam_masuk, status')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 3,
  });

  const rekapData = useMemo(() => {
    return staffList
      .filter(s => roleFilter === 'all' || s.role === roleFilter)
      .map(staff => {
        const records = attendanceRecords.filter(a => a.staff_id === staff.user_id);
        const hadir = records.filter(a => a.jam_masuk && (!a.status || a.status === 'hadir')).length;
        const sakit = records.filter(a => a.status === 'sakit').length;
        const izin = records.filter(a => a.status === 'izin').length;
        const cuti = records.filter(a => a.status === 'cuti').length;
        const dinasLuar = records.filter(a => a.status === 'dinas_luar').length;
        const totalRecorded = hadir + sakit + izin + cuti + dinasLuar;
        const tidakHadir = Math.max(0, workDays - totalRecorded);
        const denominator = Math.max(workDays, totalRecorded);
        const persen = denominator > 0 ? Math.round((hadir / denominator) * 100) : 0;

        return { ...staff, hadir, sakit, izin, cuti, dinasLuar, tidakHadir, persen };
      });
  }, [staffList, attendanceRecords, roleFilter, workDays]);

  const summaryStats = useMemo(() => {
    const total = rekapData.length;
    const avgPersen = total > 0 ? Math.round(rekapData.reduce((acc, s) => acc + s.persen, 0) / total) : 0;
    const lateThreshold = '08:00:00';
    const totalLate = attendanceRecords.filter(a => a.jam_masuk && a.jam_masuk > lateThreshold).length;
    const totalHadir = attendanceRecords.filter(a => a.jam_masuk).length;
    const latePersen = totalHadir > 0 ? Math.round((totalLate / totalHadir) * 100) : 0;
    const needsAttention = rekapData.filter(s => s.persen < 60).length;
    return { total, avgPersen, latePersen, needsAttention };
  }, [rekapData, attendanceRecords]);

  const getPersenColor = (p: number) => {
    if (p >= 80) return 'text-green-600';
    if (p >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin', guru: 'Guru', walikelas: 'Wali Kelas',
      Pembina: 'Pembina', staff: 'Staff', guru_ekskul: 'Guru Ekskul',
    };
    return labels[role] || role;
  };

  const handleExportCSV = useCallback(() => {
    const escCsv = (val: string | number) => {
      const s = String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines: string[] = [];

    // Header info
    lines.push(`LAPORAN KEHADIRAN STAFF`);
    lines.push(`Periode,${periodeLabel}`);
    lines.push(`Hari Kerja,${workDays} hari`);
    lines.push(`Total Staff,${rekapData.length} orang`);
    lines.push('');

    // Summary stats
    lines.push('RINGKASAN');
    lines.push(`Rata-rata Kehadiran,${summaryStats.avgPersen}%`);
    lines.push(`Keterlambatan,${summaryStats.latePersen}%`);
    lines.push(`Perlu Perhatian (< 60%),${summaryStats.needsAttention} orang`);
    lines.push('');

    // Detail table
    lines.push('REKAP KEHADIRAN PER STAFF');
    const headers = ['No', 'NIP', 'Nama', 'Jabatan', 'Role', 'Hadir', 'Sakit', 'Izin', 'Cuti', 'Dinas Luar', 'Tidak Hadir', '% Kehadiran'];
    lines.push(headers.map(escCsv).join(','));

    rekapData.forEach((s, i) => {
      const row = [
        String(i + 1),
        escCsv(s.employee_id || '-'),
        escCsv(s.name),
        escCsv(s.position || '-'),
        escCsv(formatRoleLabel(s.role)),
        String(s.hadir),
        String(s.sakit),
        String(s.izin),
        String(s.cuti),
        String(s.dinasLuar),
        String(s.tidakHadir),
        escCsv(`${s.persen}%`),
      ];
      lines.push(row.join(','));
    });

    lines.push('');

    // Totals row
    const totals = rekapData.reduce((acc, s) => ({
      hadir: acc.hadir + s.hadir, sakit: acc.sakit + s.sakit, izin: acc.izin + s.izin,
      cuti: acc.cuti + s.cuti, dinasLuar: acc.dinasLuar + s.dinasLuar, tidakHadir: acc.tidakHadir + s.tidakHadir,
    }), { hadir: 0, sakit: 0, izin: 0, cuti: 0, dinasLuar: 0, tidakHadir: 0 });
    lines.push(['', '', escCsv('TOTAL'), '', '', String(totals.hadir), String(totals.sakit), String(totals.izin), String(totals.cuti), String(totals.dinasLuar), String(totals.tidakHadir), escCsv(`${summaryStats.avgPersen}%`)].join(','));

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-kehadiran-staff-${fileLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan CSV berhasil diexport');
  }, [rekapData, periodeLabel, fileLabel, workDays, summaryStats, rekapData]);

  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    
    // Build worksheet data
    const wsData: (string | number)[][] = [];
    
    // Header section
    wsData.push(['LAPORAN KEHADIRAN STAFF']);
    wsData.push(['Periode', periodeLabel]);
    wsData.push(['Hari Kerja', `${workDays} hari`]);
    wsData.push(['Total Staff', `${rekapData.length} orang`]);
    wsData.push([]);
    
    // Summary
    wsData.push(['RINGKASAN']);
    wsData.push(['Rata-rata Kehadiran', `${summaryStats.avgPersen}%`]);
    wsData.push(['Keterlambatan', `${summaryStats.latePersen}%`]);
    wsData.push(['Perlu Perhatian (< 60%)', `${summaryStats.needsAttention} orang`]);
    wsData.push([]);
    
    // Table header
    const headers = ['No', 'NIP', 'Nama', 'Jabatan', 'Role', 'Hadir', 'Sakit', 'Izin', 'Cuti', 'Dinas Luar', 'Tidak Hadir', '% Kehadiran'];
    wsData.push(headers);
    
    // Table data
    rekapData.forEach((s, i) => {
      wsData.push([
        i + 1,
        s.employee_id || '-',
        s.name,
        s.position || '-',
        formatRoleLabel(s.role),
        s.hadir, s.sakit, s.izin, s.cuti, s.dinasLuar, s.tidakHadir,
        `${s.persen}%`,
      ]);
    });
    
    // Totals
    const totals = rekapData.reduce((acc, s) => ({
      hadir: acc.hadir + s.hadir, sakit: acc.sakit + s.sakit, izin: acc.izin + s.izin,
      cuti: acc.cuti + s.cuti, dinasLuar: acc.dinasLuar + s.dinasLuar, tidakHadir: acc.tidakHadir + s.tidakHadir,
    }), { hadir: 0, sakit: 0, izin: 0, cuti: 0, dinasLuar: 0, tidakHadir: 0 });
    wsData.push(['', '', 'TOTAL', '', '', totals.hadir, totals.sakit, totals.izin, totals.cuti, totals.dinasLuar, totals.tidakHadir, `${summaryStats.avgPersen}%`]);
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Column widths
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 18 },  // NIP
      { wch: 30 },  // Nama
      { wch: 15 },  // Jabatan
      { wch: 12 },  // Role
      { wch: 8 },   // Hadir
      { wch: 8 },   // Sakit
      { wch: 8 },   // Izin
      { wch: 8 },   // Cuti
      { wch: 12 },  // Dinas Luar
      { wch: 12 },  // Tidak Hadir
      { wch: 13 },  // % Kehadiran
    ];
    
    // Merge title row
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Kehadiran');
    XLSX.writeFile(wb, `laporan-kehadiran-staff-${fileLabel}.xlsx`);
    toast.success('Laporan Excel berhasil diexport');
  }, [rekapData, periodeLabel, fileLabel, workDays, summaryStats, rekapData]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // === KOP SURAT ===
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SMPIT Digital Islamic Boarding School', centerX, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Jln. Bintang Mujur, Pangkajene Kepulauan, Sulawesi Selatan', centerX, 21, { align: 'center' });
    doc.text('Website: digiss.co.id | Email: digissemail@gmail.com', centerX, 26, { align: 'center' });

    // Garis pemisah KOP
    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.line(14, 30, pageWidth - 14, 30);
    doc.setLineWidth(0.3);
    doc.line(14, 31, pageWidth - 14, 31);

    // === JUDUL LAPORAN ===
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN KEHADIRAN STAFF', centerX, 39, { align: 'center' });

    // === INFO TABLE ===
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const infoStartY = 46;
    const infoData = [
      ['Bulan', periodeLabel],
      ['Hari Kerja', `${workDays} hari`],
      ['Total Staff', `${rekapData.length} orang`],
    ];
    infoData.forEach(([label, value], i) => {
      const y = infoStartY + i * 6;
      doc.setFont('helvetica', 'normal');
      doc.text(`${label}`, 14, y);
      doc.text(':', 45, y);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 48, y);
    });

    // === TABEL DATA ===
    autoTable(doc, {
      startY: infoStartY + infoData.length * 6 + 4,
      head: [['No', 'NIP', 'Nama', 'Role', 'Hadir', 'Sakit', 'Izin', 'Cuti', 'Dinas', 'TH', '%']],
      body: rekapData.map((s, i) => [
        i + 1,
        s.employee_id || '-',
        s.name,
        formatRoleLabel(s.role),
        s.hadir,
        s.sakit,
        s.izin,
        s.cuti,
        s.dinasLuar,
        s.tidakHadir,
        `${s.persen}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'center' },
        9: { halign: 'center' },
        10: { halign: 'center', fontStyle: 'bold' },
      },
    });

    // === TANDA TANGAN ===
    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    const sigX = pageWidth - 80;
    const sigY = finalY + 12;
    const today = new Date();
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateStr = `Pangkajene, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(dateStr, sigX, sigY);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.text('Kepala Sekolah', sigX, sigY + 5);

    // Garis tanda tangan
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY + 25, sigX + 55, sigY + 25);

    doc.setFont('helvetica', 'bold');
    doc.text('________________________', sigX, sigY + 26);

    doc.save(`Laporan-Kehadiran-Staff-${fileLabel}.pdf`);
    toast.success('Laporan PDF berhasil diexport');
  }, [rekapData, periodeLabel, fileLabel, workDays]);


  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] flex flex-col">
        {/* Header */}
        <DrawerHeader className="flex-shrink-0 border-b pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle>Laporan Kehadiran Staff {periodeLabel}</DrawerTitle>
            <div className="flex items-center gap-2">
              <PrintButton
                contentRef={printRef}
                documentTitle={`Laporan_Kehadiran_Staff_${fileLabel}`}
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
                    {roleFilter !== 'all' && (
                      <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">1</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Rentang Tanggal</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 w-full justify-start text-left font-normal text-xs",
                            !dateRange?.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "d MMM yyyy", { locale: localeID })} – {format(dateRange.to, "d MMM yyyy", { locale: localeID })}
                              </>
                            ) : (
                              format(dateRange.from, "d MMM yyyy", { locale: localeID })
                            )
                          ) : (
                            <span>Pilih rentang tanggal</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                          locale={localeID}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Role</label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 flex-shrink-0">
          <AttendanceStatCard icon={Users} label="Total Staff" value={summaryStats.total} bgOuter="#DBEAFE" bgInner="#3B82F6" index={0} />
          <AttendanceStatCard icon={TrendingUp} label="Rata-rata Kehadiran" value={`${summaryStats.avgPersen}%`} bgOuter="#D1FAE5" bgInner="#10B981" index={1} />
          <AttendanceStatCard icon={Clock} label="Keterlambatan" value={`${summaryStats.latePersen}%`} bgOuter="#FEF3C7" bgInner="#F59E0B" index={2} />
          <AttendanceStatCard icon={CalendarDays} label="Hari Kerja" value={`${workDays} hari`} bgOuter="#E0E7FF" bgInner="#6366F1" index={3} />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0 px-4">
          <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[180px]">Pengguna</TableHead>
                <TableHead className="text-xs">NIP</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-center text-xs">Hadir</TableHead>
                <TableHead className="text-center text-xs">Sakit</TableHead>
                <TableHead className="text-center text-xs">Izin</TableHead>
                <TableHead className="text-center text-xs">Cuti</TableHead>
                <TableHead className="text-center text-xs whitespace-nowrap">Dinas</TableHead>
                <TableHead className="text-center text-xs whitespace-nowrap">Tidak Hadir</TableHead>
                <TableHead className="text-center text-xs min-w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm">Memuat data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rekapData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 opacity-30" />
                      <span className="text-sm">Tidak ada data</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rekapData.map((s, idx) => (
                  <TableRow key={s.user_id} className="group hover:bg-muted/30 transition-colors">
                    {/* User info with avatar */}
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
                    <TableCell className="text-muted-foreground text-xs font-mono">{s.employee_id || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-medium">{formatRoleLabel(s.role)}</Badge>
                    </TableCell>
                    {/* Attendance numbers with conditional coloring */}
                    <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">{s.hadir || '-'}</TableCell>
                    <TableCell className="text-center text-amber-600 dark:text-amber-400">{s.sakit || '-'}</TableCell>
                    <TableCell className="text-center text-blue-600 dark:text-blue-400">{s.izin || '-'}</TableCell>
                    <TableCell className="text-center text-purple-600 dark:text-purple-400">{s.cuti || '-'}</TableCell>
                    <TableCell className="text-center text-orange-600 dark:text-orange-400">{s.dinasLuar || '-'}</TableCell>
                    <TableCell className="text-center text-destructive font-medium">{s.tidakHadir || '-'}</TableCell>
                    {/* Progress bar + percentage */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 min-w-[90px]">
                            <Progress 
                              value={s.persen} 
                              className="h-2 flex-1" 
                            />
                            <span className={`text-xs font-bold min-w-[32px] text-right ${getPersenColor(s.persen)}`}>
                              {s.persen}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {s.hadir} hadir dari {workDays} hari kerja
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </TooltipProvider>
        </ScrollArea>


        {/* Hidden Print Template */}
        <div className="hidden">
          <StaffAttendancePrintReport
            ref={printRef}
            periodeLabel={periodeLabel}
            workDays={workDays}
            semester={fromDate.getMonth() < 6 ? 'genap' : 'ganjil'}
            signer={{ name: "Kepala Sekolah", jabatan: "Kepala Sekolah" }}
            rows={rekapData.map((staff) => ({
              id: staff.user_id,
              employeeId: staff.employee_id,
              nama: staff.name,
              hadir: staff.hadir,
              sakit: staff.sakit,
              izin: staff.izin,
              cuti: staff.cuti,
              tidakHadir: staff.tidakHadir,
              persen: staff.persen,
            }))}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default LaporanKehadiranStaffModal;
