import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { AttendanceRecord, UserProfile, OvertimeRecord, LeaveRequest, EmployeeKpiRecord, DisciplinaryRecord } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Download,
  Upload,
  Calendar,
  Building2,
  User,
  Users,
  CheckCircle2,
  Clock,
  Briefcase,
  Award,
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export const HrmOverallAnalyticsTab: React.FC = () => {
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Raw data from service
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [kpis, setKpis] = useState<EmployeeKpiRecord[]>([]);
  const [disciplinaries, setDisciplinaries] = useState<DisciplinaryRecord[]>([]);

  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  const loadAllData = () => {
    setIsLoading(true);
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    setAttendances(hrmService.getAttendances());
    setOvertimes(hrmService.getOvertimeRecords());
    setLeaves(hrmService.getLeaves());
    setKpis(hrmService.getKpiRecords());
    setDisciplinaries(hrmService.getDisciplinaryRecords());
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllData();
    const handleSync = () => loadAllData();
    window.addEventListener('hrm_data_updated', handleSync);
    window.addEventListener('hrm_attendance_updated', handleSync);
    window.addEventListener('hrm_kpi_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_data_updated', handleSync);
      window.removeEventListener('hrm_attendance_updated', handleSync);
      window.removeEventListener('hrm_kpi_updated', handleSync);
    };
  }, []);

  // Filtered dataset according to Month, Division, User
  const filteredAttendances = attendances.filter((a) => {
    const user = users.find((u) => u.id === a.userId);
    const uDiv = a.divisionName || user?.divisionName || user?.division || '';
    const attDate = a.date || a.attendanceDate || '';

    const matchesMonth = attDate.startsWith(selectedMonth);
    const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
    const matchesUser = selectedUser === 'all' || a.userId === selectedUser;

    return matchesMonth && matchesDiv && matchesUser;
  });

  const filteredOvertimes = overtimes.filter((o) => {
    const user = users.find((u) => u.id === o.userId);
    const uDiv = o.divisionName || user?.divisionName || user?.division || '';
    const matchesMonth = (o.date || '').startsWith(selectedMonth);
    const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
    const matchesUser = selectedUser === 'all' || o.userId === selectedUser;
    return matchesMonth && matchesDiv && matchesUser;
  });

  const filteredLeaves = leaves.filter((l) => {
    const user = users.find((u) => u.id === l.userId);
    const uDiv = l.divisionName || user?.divisionName || user?.division || '';
    const matchesMonth = (l.startDate || '').startsWith(selectedMonth);
    const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
    const matchesUser = selectedUser === 'all' || l.userId === selectedUser;
    return matchesMonth && matchesDiv && matchesUser;
  });

  const filteredKpis = kpis.filter((k) => {
    const user = users.find((u) => u.id === k.userId);
    const uDiv = k.divisionName || user?.divisionName || user?.division || '';
    const matchesMonth = k.periodMonth === selectedMonth;
    const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
    const matchesUser = selectedUser === 'all' || k.userId === selectedUser;
    return matchesMonth && matchesDiv && matchesUser;
  });

  const filteredDisciplinaries = disciplinaries.filter((d) => {
    const user = users.find((u) => u.id === d.userId);
    const uDiv = d.divisionName || user?.divisionName || user?.division || '';
    const matchesMonth = (d.violationDate || '').startsWith(selectedMonth);
    const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
    const matchesUser = selectedUser === 'all' || d.userId === selectedUser;
    return matchesMonth && matchesDiv && matchesUser;
  });

  // KPI Calculations
  const totalAttRecords = filteredAttendances.length;
  const onTimeCount = filteredAttendances.filter((a) => a.status === 'hadir').length;
  const lateCount = filteredAttendances.filter((a) => a.status === 'terlambat').length;
  const totalLateMins = filteredAttendances.reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0);
  const attRate = totalAttRecords > 0 ? Math.round((onTimeCount / totalAttRecords) * 100) : 0;

  const totalOtHours = filteredOvertimes
    .filter((o) => o.status === 'approved' || o.status === 'completed')
    .reduce((acc, curr) => acc + (Number(curr.approvedHours ?? curr.durationHours) || 0), 0);

  const totalOtPay = filteredOvertimes
    .filter((o) => o.status === 'approved' || o.status === 'completed')
    .reduce((acc, curr) => acc + (Number(curr.compensationAmount ?? curr.totalPay) || 0), 0);

  const avgKpiScore =
    filteredKpis.length > 0
      ? Math.round(filteredKpis.reduce((acc, curr) => acc + curr.finalScore, 0) / filteredKpis.length)
      : 88;

  // Pie chart status composition
  const pieData = [
    { name: 'Tepat Waktu', value: onTimeCount, color: '#0d9488' },
    { name: 'Terlambat', value: lateCount, color: '#f59e0b' },
    { name: 'Izin / Cuti', value: filteredLeaves.length, color: '#0284c7' },
    { name: 'Sanksi / SP', value: filteredDisciplinaries.length, color: '#e11d48' },
  ];

  // Daily Trend inside the selected month
  const daysInMonthMap: Record<string, { date: string; hadir: number; terlambat: number }> = {};
  filteredAttendances.forEach((a) => {
    const d = a.date || a.attendanceDate || '';
    if (!daysInMonthMap[d]) {
      daysInMonthMap[d] = { date: d.substring(8), hadir: 0, terlambat: 0 };
    }
    if (a.status === 'hadir') daysInMonthMap[d].hadir++;
    if (a.status === 'terlambat') daysInMonthMap[d].terlambat++;
  });
  const trendChartData = Object.values(daysInMonthMap).sort((a, b) => a.date.localeCompare(b.date));

  // Division Comparison Data
  const divComparisonData = divisions.map((div) => {
    const divAtts = filteredAttendances.filter(
      (a) => (a.divisionName || '').toLowerCase() === div.name.toLowerCase()
    );
    const divHadir = divAtts.filter((a) => a.status === 'hadir').length;
    const divTelat = divAtts.filter((a) => a.status === 'terlambat').length;
    return {
      name: div.code || div.name.substring(0, 8),
      fullName: div.name,
      hadir: divHadir,
      terlambat: divTelat,
    };
  });

  // ─── EXPORT TO EXCEL (XLSX) MULTI-SHEET ──────────────────────────────────
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Rekap Presensi
      const attData = filteredAttendances.map((a, idx) => ({
        No: idx + 1,
        Nama: a.userName,
        NIP: a.userNip,
        Divisi: a.divisionName,
        Tanggal: a.date || a.attendanceDate,
        'Jam Masuk': a.clockIn || '-',
        'Jam Pulang': a.clockOut || '-',
        Status: a.status,
        'Keterlambatan (Menit)': a.lateMinutes || 0,
        Catatan: a.notes || '-',
      }));
      const wsAtt = XLSX.utils.json_to_sheet(attData);
      XLSX.utils.book_append_sheet(wb, wsAtt, 'Rekap Presensi');

      // Sheet 2: Rekap Lembur (SPKL)
      const otData = filteredOvertimes.map((o, idx) => ({
        No: idx + 1,
        Nama: o.userName,
        NIP: o.userNip,
        Divisi: o.divisionName,
        Tanggal: o.date,
        'Jam Mulai': o.startTime,
        'Jam Selesai': o.endTime,
        'Durasi (Jam)': o.approvedHours ?? o.durationHours,
        Tugas: o.taskDescription,
        Status: o.status,
        'Kompensasi (Rp)': o.compensationAmount ?? o.totalPay,
      }));
      const wsOt = XLSX.utils.json_to_sheet(otData);
      XLSX.utils.book_append_sheet(wb, wsOt, 'Rekap Lembur (SPKL)');

      // Sheet 3: Rekap Cuti
      const leaveData = filteredLeaves.map((l, idx) => ({
        No: idx + 1,
        Nama: l.userName,
        NIP: l.userNip,
        Divisi: l.divisionName,
        Kategori: l.leaveType,
        'Tanggal Mulai': l.startDate,
        'Tanggal Selesai': l.endDate,
        'Total Hari': l.totalDays,
        Alasan: l.reason,
        Status: l.status,
      }));
      const wsLeave = XLSX.utils.json_to_sheet(leaveData);
      XLSX.utils.book_append_sheet(wb, wsLeave, 'Rekap Izin & Cuti');

      // Sheet 4: Skor Kinerja (KPI)
      const kpiData = filteredKpis.map((k, idx) => ({
        No: idx + 1,
        Nama: k.userName,
        NIP: k.userNip,
        Divisi: k.divisionName,
        Bulan: k.periodMonth,
        'Skor Kehadiran (30%)': k.attendanceScore,
        'Skor Operasional (50%)': k.operationalScore,
        'Skor Kompetensi (20%)': k.competencyScore,
        'Skor Akhir': k.finalScore,
        Grade: k.grade,
        Feedback: k.feedback,
      }));
      const wsKpi = XLSX.utils.json_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(wb, wsKpi, 'Evaluasi KPI');

      // Sheet 5: Data Pelanggaran (SP)
      const spData = filteredDisciplinaries.map((d, idx) => ({
        No: idx + 1,
        Nama: d.userName,
        NIP: d.userNip,
        Divisi: d.divisionName,
        'Tingkat SP': d.spType,
        'No Surat': d.letterNumber,
        'Tgl Terbit': d.violationDate,
        'Berlaku Hingga': d.validUntil,
        Uraian: d.description,
        Status: d.status,
      }));
      const wsSp = XLSX.utils.json_to_sheet(spData);
      XLSX.utils.book_append_sheet(wb, wsSp, 'Sanksi Kedisiplinan (SP)');

      const filename = `HRM_Laporan_Komprehensif_${selectedMonth}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Laporan Excel berhasil diunduh: ${filename}`);
    } catch (err: any) {
      toast.error('Gagal mengekspor laporan Excel: ' + err.message);
    }
  };

  // ─── EXPORT TO PDF OFFICIAL REPORT ────────────────────────────────────────
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header Kop Surat
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PT. FAWWAZ RESKI PERWIRA', 148, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('REKAPITULASI LAPORAN OPERASIONAL & KINERJA KARYAWAN', 148, 21, { align: 'center' });
      doc.text(`Periode Bulan: ${selectedMonth} • Waktu Cetak: ${new Date().toLocaleDateString('id-ID')}`, 148, 26, { align: 'center' });

      doc.setLineWidth(0.5);
      doc.line(14, 29, 283, 29);

      // Metadata Cards in PDF
      doc.setFontSize(9);
      doc.text(`Tingkat Kehadiran: ${attRate}% | Hadir: ${onTimeCount} | Terlambat: ${lateCount} | Lembur: ${totalOtHours.toFixed(1)} Jam | SP Aktif: ${filteredDisciplinaries.length}`, 14, 35);

      // Table Data
      const tableRows = filteredAttendances.slice(0, 35).map((a, i) => [
        i + 1,
        a.userName || 'Karyawan',
        a.userNip || '-',
        a.divisionName || '-',
        a.date || a.attendanceDate || '-',
        a.clockIn?.substring(0, 5) || '-',
        a.clockOut?.substring(0, 5) || '-',
        a.status.toUpperCase(),
        a.lateMinutes ? `${a.lateMinutes}m` : '0m',
        a.notes || '-',
      ]);

      autoTable(doc, {
        head: [['No', 'Nama Karyawan', 'NIP', 'Divisi', 'Tanggal', 'Masuk', 'Pulang', 'Status', 'Telat', 'Catatan']],
        body: tableRows,
        startY: 39,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [13, 148, 136] }, // primary tosca
      });

      // Signatures
      const finalY = (doc as any).lastAutoTable?.finalY || 160;
      const sigY = Math.min(finalY + 15, 175);

      doc.setFontSize(8);
      doc.text('Dibuat Oleh,', 30, sigY);
      doc.text('Staff HRD', 30, sigY + 18);

      doc.text('Diperiksa Oleh,', 148, sigY, { align: 'center' });
      doc.text('Manajer Operasional', 148, sigY + 18, { align: 'center' });

      doc.text('Disetujui Oleh,', 250, sigY, { align: 'right' });
      doc.text('Direktur Utama (Dirut)', 250, sigY + 18, { align: 'right' });

      doc.save(`HRM_Rekap_Resmi_${selectedMonth}.pdf`);
      toast.success('Laporan resmi PDF berhasil diunduh.');
    } catch (err: any) {
      toast.error('Gagal mencetak PDF: ' + err.message);
    }
  };

  // ─── IMPORT TEMPLATE PARSER (EXCEL / CSV) ─────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws);
        setImportedRows(data);
        toast.info(`Berhasil membaca ${data.length} baris data dari file template.`);
      } catch (err: any) {
        toast.error('Format file tidak didukung atau rusak: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleProcessImport = async () => {
    if (importedRows.length === 0) {
      toast.error('Tidak ada data untuk diimpor');
      return;
    }

    setIsProcessingImport(true);
    let successCount = 0;

    for (const row of importedRows) {
      // Heuristic mapping
      const nipKey = Object.keys(row).find((k) => /nip|nik|id/i.test(k));
      const dateKey = Object.keys(row).find((k) => /tanggal|date/i.test(k));
      const inKey = Object.keys(row).find((k) => /masuk|in|jam masuk/i.test(k));
      const outKey = Object.keys(row).find((k) => /pulang|out|jam pulang/i.test(k));
      const statusKey = Object.keys(row).find((k) => /status/i.test(k));

      const nipVal = nipKey ? String(row[nipKey]).trim() : '';
      const matchedUser = users.find((u) => u.nip?.trim() === nipVal || u.fullName?.toLowerCase().includes(String(row.Nama || '').toLowerCase()));

      if (matchedUser) {
        const attDate = dateKey ? String(row[dateKey]).trim() : getTodayDateStr();
        const clockIn = inKey ? String(row[inKey]).trim() : '07:30:00';
        const clockOut = outKey ? String(row[outKey]).trim() : '16:30:00';
        const status = (statusKey ? String(row[statusKey]).toLowerCase() : 'hadir') as any;

        await hrmService.addManualAttendance({
          userId: matchedUser.id,
          attendanceDate: attDate,
          clockIn,
          clockOut,
          status: status === 'terlambat' ? 'terlambat' : 'hadir',
          notes: 'Diimpor dari file template eksternal',
        });
        successCount++;
      }
    }

    setIsProcessingImport(false);
    toast.success(`Impor selesai! Berhasil menyinkronkan ${successCount} catatan presensi.`);
    setImportModalOpen(false);
    setImportedRows([]);
    loadAllData();
  };

  return (
    <div className="space-y-6">
      {/* Executive Controls & Filter Bar */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Multi-Dimensional Analytics Engine</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Dashboard Analitik & Rekapitulasi Data Terintegrasi
              </h2>
              <p className="text-xs text-muted-foreground">
                Penyaringan fleksibel per karyawan, per divisi, dan per bulan dengan sinkronisasi langsung ke database PostgreSQL & PWA.
              </p>
            </div>

            {/* Action Buttons: Export XLSX, PDF, Import */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-8 text-xs rounded-xl gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export Excel (XLSX)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-8 text-xs rounded-xl gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 font-semibold"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                Export PDF Resmi
              </Button>
              <Button
                size="sm"
                onClick={() => setImportModalOpen(true)}
                className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Template Laporan
              </Button>
            </div>
          </div>

          {/* Dimension Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border mt-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Filter Periode Bulan
              </label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Filter Divisi / Departemen
              </label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id || d.name} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Filter Spesifik Karyawan
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Semua Karyawan" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">Semua Karyawan</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.name} ({u.nip || '-'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Tingkat Kehadiran</p>
              <p className="text-xl font-bold text-foreground">{attRate}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Keterlambatan</p>
              <p className="text-xl font-bold text-amber-600">{lateCount}x ({totalLateMins}m)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Jam Lembur (SPKL)</p>
              <p className="text-xl font-bold text-sky-600">{totalOtHours.toFixed(1)} Jam</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Rata-rata Skor KPI</p>
              <p className="text-xl font-bold text-emerald-600">{avgKpiScore}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Pelanggaran & SP</p>
              <p className="text-xl font-bold text-rose-600">{filteredDisciplinaries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Daily Trend in Month */}
        <Card className="lg:col-span-2 border-border bg-card shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Tren Harian Kehadiran & Ketepatan Waktu ({selectedMonth})
            </CardTitle>
            <CardDescription className="text-xs">
              Distribusi presensi hadir tepat waktu vs terlambat per hari kerja.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hadir"
                    name="Tepat Waktu"
                    stroke="#0d9488"
                    fill="#0d9488"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="terlambat"
                    name="Terlambat"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Donut Status Distribution */}
        <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary" />
              Proporsi Status Operasional
            </CardTitle>
            <CardDescription className="text-xs">
              Komposisi perbandingan kehadiran, cuti, dan kedisiplinan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col items-center justify-center">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-1.5 pt-2 border-t border-border text-xs">
              {pieData.map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart 3: Division Comparison */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Komparasi Kedisiplinan Antar Divisi ({selectedMonth})
          </CardTitle>
          <CardDescription className="text-xs">
            Perbandingan tingkat kehadiran tepat waktu dan keterlambatan di masing-masing divisi PT FRP.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="hadir" name="Tepat Waktu" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Modal Import Template Laporan */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Import Template Laporan Eksternal (.xlsx / .csv)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Unggah file rekapan presensi dari format template yang diinginkan. Sistem otomatis memetakan kolom NIP, Tanggal, Jam Masuk, dan Status ke database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-6 text-center space-y-2 bg-muted/20">
              <FileSpreadsheet className="w-8 h-8 text-primary mx-auto" />
              <p className="font-semibold text-foreground">Pilih Berkas Excel atau Tarik ke Sini</p>
              <p className="text-[11px] text-muted-foreground">Mendukung format .xlsx, .xls, .csv</p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="block w-full text-xs text-muted-foreground file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            {importedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Pratinjau Data ({importedRows.length} Baris):</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    File: {importFileName}
                  </Badge>
                </div>
                <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 bg-muted/10 text-[11px]">
                  <pre className="font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(importedRows.slice(0, 3), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleProcessImport}
              disabled={isProcessingImport || importedRows.length === 0}
              className="rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {isProcessingImport ? 'Memproses Impor...' : `Proses Impor ${importedRows.length} Data`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
