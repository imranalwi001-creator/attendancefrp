import React, { useState, useEffect, useMemo } from 'react';
import { hrmService } from '@/services/hrmService';
import { AttendanceRecord, UserProfile, OvertimeRecord, LeaveRequest, EmployeeKpiRecord, DisciplinaryRecord } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { customNotify } from '@/lib/customNotification';
import { MonthPicker } from '@/components/ui/month-picker';
import { HrmEmployeeSearchInput } from '@/components/hrm/HrmEmployeeSearchInput';
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
  Search,
  Check,
  Printer,
  ChevronRight,
  Layers,
  HeartPulse,
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

  // Active view table tab: 'karyawan' | 'divisi' | 'cuti_lembur' | 'harian'
  const [activeTableTab, setActiveTableTab] = useState<'karyawan' | 'divisi' | 'cuti_lembur' | 'harian'>('karyawan');

  // Export PDF Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<'karyawan' | 'divisi' | 'cuti_lembur' | 'lengkap' | 'harian'>('karyawan');

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
  const filteredAttendances = useMemo(() => {
    return attendances.filter((a) => {
      const user = users.find((u) => u.id === a.userId);
      const uDiv = a.divisionName || user?.divisionName || user?.division || '';
      const attDate = a.date || a.attendanceDate || '';

      const matchesMonth = attDate.startsWith(selectedMonth);
      const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
      const matchesUser = selectedUser === 'all' || a.userId === selectedUser;

      return matchesMonth && matchesDiv && matchesUser;
    });
  }, [attendances, users, selectedMonth, selectedDivision, selectedUser]);

  const filteredOvertimes = useMemo(() => {
    return overtimes.filter((o) => {
      const user = users.find((u) => u.id === o.userId);
      const uDiv = o.divisionName || user?.divisionName || user?.division || '';
      const matchesMonth = (o.date || '').startsWith(selectedMonth);
      const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
      const matchesUser = selectedUser === 'all' || o.userId === selectedUser;
      return matchesMonth && matchesDiv && matchesUser;
    });
  }, [overtimes, users, selectedMonth, selectedDivision, selectedUser]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      const user = users.find((u) => u.id === l.userId);
      const uDiv = l.divisionName || user?.divisionName || user?.division || '';
      const matchesMonth = (l.startDate || '').startsWith(selectedMonth);
      const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
      const matchesUser = selectedUser === 'all' || l.userId === selectedUser;
      return matchesMonth && matchesDiv && matchesUser;
    });
  }, [leaves, users, selectedMonth, selectedDivision, selectedUser]);

  const filteredKpis = useMemo(() => {
    return kpis.filter((k) => {
      const user = users.find((u) => u.id === k.userId);
      const uDiv = k.divisionName || user?.divisionName || user?.division || '';
      const matchesMonth = k.periodMonth === selectedMonth;
      const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
      const matchesUser = selectedUser === 'all' || k.userId === selectedUser;
      return matchesMonth && matchesDiv && matchesUser;
    });
  }, [kpis, users, selectedMonth, selectedDivision, selectedUser]);

  const filteredDisciplinaries = useMemo(() => {
    return disciplinaries.filter((d) => {
      const user = users.find((u) => u.id === d.userId);
      const uDiv = d.divisionName || user?.divisionName || user?.division || '';
      const matchesMonth = (d.violationDate || '').startsWith(selectedMonth);
      const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
      const matchesUser = selectedUser === 'all' || d.userId === selectedUser;
      return matchesMonth && matchesDiv && matchesUser;
    });
  }, [disciplinaries, users, selectedMonth, selectedDivision, selectedUser]);

  // ─── AGGREGATED ENGINE: REKAPITULASI PER KARYAWAN (1 BARIS PER KARYAWAN) ───
  const employeeRecap = useMemo(() => {
    // Determine target users (filter by division & user if applicable)
    let targetUsers = users.filter((u) => {
      const uDiv = u.divisionName || u.division || '';
      const matchesDiv = selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();
      const matchesUser = selectedUser === 'all' || u.id === selectedUser;
      return matchesDiv && matchesUser;
    });

    // Also include any user who has attendance in filteredAttendances but might be missing
    const userIdsInTarget = new Set(targetUsers.map((u) => u.id));
    filteredAttendances.forEach((a) => {
      if (a.userId && !userIdsInTarget.has(a.userId)) {
        const found = users.find((u) => u.id === a.userId);
        if (found) {
          targetUsers.push(found);
          userIdsInTarget.add(found.id);
        }
      }
    });

    return targetUsers.map((u) => {
      const uAtts = filteredAttendances.filter((a) => a.userId === u.id);
      const totalHadir = uAtts.filter((a) => a.status === 'hadir').length;
      const totalTelat = uAtts.filter((a) => a.status === 'terlambat').length;
      const totalDaysPresent = totalHadir + totalTelat;
      const totalLateMins = uAtts.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);

      // Leaves per employee
      const uLeaves = filteredLeaves.filter((l) => l.userId === u.id && l.status === 'approved');
      const cutiDays = uLeaves
        .filter((l) => l.leaveType === 'annual_leave' || (l.leaveType as any) === 'cuti')
        .reduce((sum, l) => sum + (l.totalDays || 1), 0);
      const sakitDays = uLeaves
        .filter((l) => l.leaveType === 'sick_leave' || (l.leaveType as any) === 'sakit')
        .reduce((sum, l) => sum + (l.totalDays || 1), 0);
      const izinDays = uLeaves
        .filter((l) => l.leaveType !== 'annual_leave' && l.leaveType !== 'sick_leave' && (l.leaveType as any) !== 'cuti' && (l.leaveType as any) !== 'sakit')
        .reduce((sum, l) => sum + (l.totalDays || 1), 0);

      // Overtime per employee
      const uOts = filteredOvertimes.filter((o) => o.userId === u.id && (o.status === 'approved' || o.status === 'completed'));
      const otHours = uOts.reduce((sum, o) => sum + (Number(o.approvedHours ?? o.durationHours) || 0), 0);
      const otPay = uOts.reduce((sum, o) => sum + (Number(o.compensationAmount ?? o.totalPay) || 0), 0);

      // Discipline & Attendance Rate
      const attRate = totalDaysPresent > 0 ? Math.round((totalHadir / totalDaysPresent) * 100) : (totalHadir > 0 ? 100 : 0);

      const spCount = filteredDisciplinaries.filter((d) => d.userId === u.id).length;

      return {
        userId: u.id,
        name: u.fullName || u.name,
        nip: u.nip || '-',
        division: u.divisionName || u.division || 'Umum',
        totalDaysPresent,
        totalHadir,
        totalTelat,
        totalLateMins,
        cutiDays,
        sakitDays,
        izinDays,
        otHours,
        otPay,
        attRate,
        spCount,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, filteredAttendances, filteredLeaves, filteredOvertimes, filteredDisciplinaries, selectedDivision, selectedUser]);

  // ─── AGGREGATED ENGINE: REKAPITULASI PER DIVISI (1 BARIS PER DIVISI) ───────
  const divisionRecap = useMemo(() => {
    let targetDivisions = divisions;
    if (selectedDivision !== 'all') {
      targetDivisions = divisions.filter((d) => d.name.toLowerCase() === selectedDivision.toLowerCase());
    }

    return targetDivisions.map((div) => {
      const divEmployees = employeeRecap.filter((e) => e.division.toLowerCase() === div.name.toLowerCase());
      const employeeCount = divEmployees.length;

      const totalHadir = divEmployees.reduce((sum, e) => sum + e.totalHadir, 0);
      const totalTelat = divEmployees.reduce((sum, e) => sum + e.totalTelat, 0);
      const totalLateMins = divEmployees.reduce((sum, e) => sum + e.totalLateMins, 0);
      const totalCuti = divEmployees.reduce((sum, e) => sum + e.cutiDays, 0);
      const totalSakit = divEmployees.reduce((sum, e) => sum + e.sakitDays, 0);
      const totalIzin = divEmployees.reduce((sum, e) => sum + e.izinDays, 0);
      const totalOtHours = divEmployees.reduce((sum, e) => sum + e.otHours, 0);
      const totalOtPay = divEmployees.reduce((sum, e) => sum + e.otPay, 0);

      const totalPresences = totalHadir + totalTelat;
      const avgRate = totalPresences > 0 ? Math.round((totalHadir / totalPresences) * 100) : 0;

      return {
        divisionName: div.name,
        divisionCode: div.code || div.name.substring(0, 8),
        employeeCount,
        totalHadir,
        totalTelat,
        totalLateMins,
        totalCuti,
        totalSakit,
        totalIzin,
        totalOtHours,
        totalOtPay,
        avgRate,
      };
    });
  }, [divisions, selectedDivision, employeeRecap]);

  // Overall KPI Statistics
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

  // ─── EXPORT TO EXCEL (XLSX) MULTI-SHEET REKAPITULASI RESMI ────────────────
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Rekapitulasi Per Karyawan (1 Baris Per Karyawan Unik)
      const empData = employeeRecap.map((e, idx) => ({
        No: idx + 1,
        'Nama Karyawan': e.name,
        NIP: e.nip,
        Divisi: e.division,
        'Total Hari Hadir': e.totalDaysPresent,
        'Tepat Waktu': e.totalHadir,
        'Terlambat (Kali)': e.totalTelat,
        'Total Telat (Menit)': e.totalLateMins,
        'Cuti (Hari)': e.cutiDays,
        'Izin (Hari)': e.izinDays,
        'Sakit (Hari)': e.sakitDays,
        'Lembur (Jam)': e.otHours.toFixed(1),
        'Upah Lembur (Rp)': e.otPay,
        'Tingkat Kehadiran (%)': `${e.attRate}%`,
        'Sanksi SP': e.spCount,
      }));
      const wsEmp = XLSX.utils.json_to_sheet(empData);
      XLSX.utils.book_append_sheet(wb, wsEmp, 'Rekap Per Karyawan');

      // Sheet 2: Rekapitulasi Per Divisi (1 Baris Per Divisi)
      const divData = divisionRecap.map((d, idx) => ({
        No: idx + 1,
        'Nama Divisi': d.divisionName,
        'Kode Divisi': d.divisionCode,
        'Jumlah Karyawan': d.employeeCount,
        'Total Hadir': d.totalHadir,
        'Total Terlambat': d.totalTelat,
        'Total Menit Telat': d.totalLateMins,
        'Total Cuti (Hari)': d.totalCuti,
        'Total Izin (Hari)': d.totalIzin,
        'Total Sakit (Hari)': d.totalSakit,
        'Total Jam Lembur': d.totalOtHours.toFixed(1),
        'Total Kompensasi Lembur (Rp)': d.totalOtPay,
        'Rata-rata Kehadiran (%)': `${d.avgRate}%`,
      }));
      const wsDiv = XLSX.utils.json_to_sheet(divData);
      XLSX.utils.book_append_sheet(wb, wsDiv, 'Rekap Per Divisi');

      // Sheet 3: Rekap Cuti, Izin & Sakit Realtime
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
      XLSX.utils.book_append_sheet(wb, wsLeave, 'Rekap Cuti & Izin');

      // Sheet 4: Rekap Lembur (SPKL)
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

      // Sheet 5: Detail Presensi Harian
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
      XLSX.utils.book_append_sheet(wb, wsAtt, 'Log Detail Presensi Harian');

      const filename = `HRM_Rekapitulasi_Komprehensif_${selectedMonth}.xlsx`;
      XLSX.writeFile(wb, filename);
      customNotify.success('Ekspor Excel Berhasil', `File ${filename} telah diunduh dengan 5 lembar kerja terpadu.`);
    } catch (err: any) {
      customNotify.error('Gagal Ekspor Excel', err.message);
    }
  };

  // ─── EXPORT TO PDF RESMI (REKAPITULASI NYATA TANPA DUPLIKASI) ─────────────
  const generateOfficialPDF = (reportType: 'karyawan' | 'divisi' | 'cuti_lembur' | 'lengkap' | 'harian') => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const drawHeader = (title: string, subtitle?: string) => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('PT. FAWWAZ RESKI PERWIRA', 148, 14, { align: 'center' });
        doc.setFontSize(10);
        doc.text(title.toUpperCase(), 148, 19, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(
          `Periode Bulan: ${selectedMonth} • Divisi: ${selectedDivision === 'all' ? 'Seluruh Divisi' : selectedDivision} • Waktu Cetak: ${new Date().toLocaleDateString('id-ID')} WITA`,
          148,
          24,
          { align: 'center' }
        );
        doc.setLineWidth(0.4);
        doc.line(14, 27, 283, 27);

        // Metadata summary bar
        doc.setFontSize(8);
        doc.text(
          `Total Karyawan Aktif: ${employeeRecap.length} | Tingkat Kehadiran: ${attRate}% | Hadir Tepat Waktu: ${onTimeCount} | Terlambat: ${lateCount}x (${totalLateMins}m) | Lembur: ${totalOtHours.toFixed(1)} Jam | Cuti/Izin/Sakit: ${filteredLeaves.length}`,
          14,
          32
        );
      };

      const drawSignatures = () => {
        const finalY = (doc as any).lastAutoTable?.finalY || 160;
        const sigY = Math.min(finalY + 14, 175);

        doc.setFontSize(8);
        doc.text('Dibuat Oleh,', 30, sigY);
        doc.text('Staff HRD PT FRP', 30, sigY + 18);

        doc.text('Diperiksa Oleh,', 148, sigY, { align: 'center' });
        doc.text('Manajer Operasional', 148, sigY + 18, { align: 'center' });

        doc.text('Disetujui Oleh,', 250, sigY, { align: 'right' });
        doc.text('Direktur Utama (Dirut)', 250, sigY + 18, { align: 'right' });
      };

      if (reportType === 'karyawan' || reportType === 'lengkap') {
        // TABEL REKAPITULASI PER KARYAWAN (1 BARIS PER KARYAWAN)
        drawHeader('Rekapitulasi Kinerja & Presensi Per Karyawan (Bulanan)');

        const empTableRows = employeeRecap.map((e, i) => [
          i + 1,
          e.name,
          e.nip,
          e.division,
          `${e.totalDaysPresent} hr`,
          `${e.totalHadir} hr`,
          `${e.totalTelat}x (${e.totalLateMins}m)`,
          `${e.cutiDays} hr`,
          `${e.izinDays} hr`,
          `${e.sakitDays} hr`,
          `${e.otHours.toFixed(1)} j`,
          `Rp ${e.otPay.toLocaleString('id-ID')}`,
          `${e.attRate}%`,
          e.spCount > 0 ? `SP (${e.spCount})` : 'Disiplin',
        ]);

        autoTable(doc, {
          head: [
            [
              'No',
              'Nama Karyawan',
              'NIP',
              'Divisi',
              'Total Hari',
              'Hadir',
              'Terlambat',
              'Cuti',
              'Izin',
              'Sakit',
              'Lembur',
              'Upah Lembur',
              'Kehadiran',
              'Status Disiplin',
            ],
          ],
          body: empTableRows,
          startY: 35,
          styles: { fontSize: 7, cellPadding: 1.8 },
          headStyles: { fillColor: [13, 148, 136] }, // Tosca Primary
        });

        drawSignatures();
      }

      if (reportType === 'divisi' || reportType === 'lengkap') {
        if (reportType === 'lengkap') doc.addPage();
        drawHeader('Rekapitulasi Operasional & Kehadiran Per Divisi');

        const divTableRows = divisionRecap.map((d, i) => [
          i + 1,
          d.divisionName,
          d.divisionCode,
          `${d.employeeCount} Orang`,
          `${d.totalHadir} hr`,
          `${d.totalTelat}x (${d.totalLateMins}m)`,
          `${d.totalCuti} hr`,
          `${d.totalIzin} hr`,
          `${d.totalSakit} hr`,
          `${d.totalOtHours.toFixed(1)} Jam`,
          `Rp ${d.totalOtPay.toLocaleString('id-ID')}`,
          `${d.avgRate}%`,
        ]);

        autoTable(doc, {
          head: [
            [
              'No',
              'Nama Divisi',
              'Kode',
              'Jml Anggota',
              'Total Hadir',
              'Terlambat',
              'Total Cuti',
              'Total Izin',
              'Total Sakit',
              'Total Lembur',
              'Kompensasi Lembur',
              'Rata-rata Disiplin',
            ],
          ],
          body: divTableRows,
          startY: 35,
          styles: { fontSize: 7.5, cellPadding: 2.2 },
          headStyles: { fillColor: [2, 132, 199] }, // Blue primary
        });

        drawSignatures();
      }

      if (reportType === 'cuti_lembur' || reportType === 'lengkap') {
        if (reportType === 'lengkap') doc.addPage();
        drawHeader('Rekapitulasi Izin, Cuti, Sakit & Lembur Realtime');

        // Leaves Section
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Daftar Pengajuan Cuti, Izin, & Surat Sakit Karyawan', 14, 38);

        const leaveRows = filteredLeaves.map((l, i) => [
          i + 1,
          l.userName || '-',
          l.userNip || '-',
          l.divisionName || '-',
          l.leaveType.toUpperCase(),
          `${l.startDate} s/d ${l.endDate}`,
          `${l.totalDays} Hari`,
          l.reason || '-',
          l.status.toUpperCase(),
        ]);

        autoTable(doc, {
          head: [['No', 'Nama Karyawan', 'NIP', 'Divisi', 'Jenis Pengajuan', 'Rentang Tanggal', 'Durasi', 'Alasan', 'Status Verifikasi']],
          body: leaveRows.length > 0 ? leaveRows : [['-', 'Tidak ada pengajuan izin/cuti pada periode ini', '-', '-', '-', '-', '-', '-', '-']],
          startY: 41,
          styles: { fontSize: 7, cellPadding: 1.8 },
          headStyles: { fillColor: [147, 51, 234] }, // Purple
        });

        // Overtime Section
        const nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 100;
        if (nextY < 140) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('B. Daftar Surat Perintah Kerja Lembur (SPKL) Disetujui', 14, nextY);

          const otRows = filteredOvertimes.map((o, i) => [
            i + 1,
            o.userName || '-',
            o.userNip || '-',
            o.divisionName || '-',
            o.date,
            `${o.startTime} - ${o.endTime}`,
            `${o.approvedHours ?? o.durationHours} Jam`,
            `Rp ${(o.compensationAmount ?? o.totalPay ?? 0).toLocaleString('id-ID')}`,
            o.taskDescription || '-',
            o.status.toUpperCase(),
          ]);

          autoTable(doc, {
            head: [['No', 'Nama Karyawan', 'NIP', 'Divisi', 'Tanggal', 'Jam Kerja', 'Durasi', 'Upah Lembur', 'Uraian Tugas', 'Status']],
            body: otRows.length > 0 ? otRows : [['-', 'Tidak ada catatan lembur pada periode ini', '-', '-', '-', '-', '-', '-', '-', '-']],
            startY: nextY + 3,
            styles: { fontSize: 7, cellPadding: 1.8 },
            headStyles: { fillColor: [245, 158, 11] }, // Amber
          });
        }

        drawSignatures();
      }

      if (reportType === 'harian') {
        drawHeader('Log Rincian Presensi Harian Karyawan (Audit Trail)');

        const attRows = filteredAttendances.map((a, i) => [
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
          head: [['No', 'Nama Karyawan', 'NIP', 'Divisi', 'Tanggal', 'Masuk', 'Pulang', 'Status', 'Telat', 'Catatan Audit']],
          body: attRows,
          startY: 35,
          styles: { fontSize: 7, cellPadding: 1.8 },
          headStyles: { fillColor: [13, 148, 136] },
        });

        drawSignatures();
      }

      const filename = `HRM_Rekap_${reportType.toUpperCase()}_${selectedMonth}.pdf`;
      doc.save(filename);
      customNotify.success('Laporan PDF Siap', `Dokumen resmi ${filename} telah berhasil diunduh.`);
      setPdfModalOpen(false);
    } catch (err: any) {
      customNotify.error('Gagal Ekspor PDF', err.message);
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
        customNotify.info('Template Terbaca', `Berhasil membaca ${data.length} baris data dari file template.`);
      } catch (err: any) {
        customNotify.error('File Gagal Dibaca', 'Format file tidak didukung: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleProcessImport = async () => {
    if (importedRows.length === 0) {
      customNotify.warning('Data Kosong', 'Tidak ada data untuk diimpor.');
      return;
    }

    setIsProcessingImport(true);
    let successCount = 0;

    for (const row of importedRows) {
      const nipKey = Object.keys(row).find((k) => /nip|nik|id/i.test(k));
      const dateKey = Object.keys(row).find((k) => /tanggal|date/i.test(k));
      const inKey = Object.keys(row).find((k) => /masuk|in|jam masuk/i.test(k));
      const outKey = Object.keys(row).find((k) => /pulang|out|jam pulang/i.test(k));
      const statusKey = Object.keys(row).find((k) => /status/i.test(k));

      const nipVal = nipKey ? String(row[nipKey]).trim() : '';
      const matchedUser = users.find(
        (u) => u.nip?.trim() === nipVal || u.fullName?.toLowerCase().includes(String(row.Nama || '').toLowerCase())
      );

      if (matchedUser) {
        const attDate = dateKey ? String(row[dateKey]).trim() : `${new Date().toISOString().split('T')[0]}`;
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
    customNotify.success('Impor Selesai', `Berhasil menyinkronkan ${successCount} catatan presensi ke database.`);
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
                <span>Multi-Dimensional Analytics & Rekapitulasi FRP</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Rekapitulasi Bulanan, Per Karyawan & Per Divisi
              </h2>
              <p className="text-xs text-muted-foreground">
                Data presensi, cuti, izin, sakit, lembur dan kedisiplinan terkonsolidasi realtime tanpa duplikasi baris.
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
                Export Excel (5 Sheet)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPdfModalOpen(true)}
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
                Import Template
              </Button>
            </div>
          </div>

          {/* Dimension Selectors with Custom Components (No default inputs/dropdowns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border mt-4">
            {/* Custom Month Picker */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Periode Bulan (Custom)
              </label>
              <MonthPicker
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(val)}
              />
            </div>

            {/* Division Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Filter Divisi / Departemen
              </label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi (Konsolidasi Total)</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id || d.name} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Employee Keyword Search Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Pencarian Karyawan (Dinamis Presisi)
              </label>
              <HrmEmployeeSearchInput
                value={selectedUser}
                onSelect={(uid) => setSelectedUser(uid)}
                users={users}
                allowAll={true}
                allLabel="Semua Karyawan (Semua Anggota)"
                placeholder="Ketik nama, NIP, atau divisi..."
              />
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
              <p className="text-[11px] font-medium text-muted-foreground">Lembur Disetujui</p>
              <p className="text-xl font-bold text-sky-600">{totalOtHours.toFixed(1)} Jam</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Cuti / Izin / Sakit</p>
              <p className="text-xl font-bold text-purple-600">{filteredLeaves.length} Pengajuan</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Sanksi SP Terbit</p>
              <p className="text-xl font-bold text-rose-600">{filteredDisciplinaries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── TABEL REKAPITULASI RESMI TERPADU ────────────────────────────────── */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border bg-muted/15">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Tabel Rekapitulasi Operasional ({selectedMonth})
              </CardTitle>
              <CardDescription className="text-xs">
                Pilih tampilan rekapitulasi terkonsolidasi per karyawan, per divisi, data cuti/lembur, atau audit log.
              </CardDescription>
            </div>

            {/* View Switching Navigation */}
            <div className="inline-flex items-center p-1 rounded-xl bg-muted/50 border border-border text-xs">
              <button
                type="button"
                onClick={() => setActiveTableTab('karyawan')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTableTab === 'karyawan'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Rekap Per Karyawan ({employeeRecap.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('divisi')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTableTab === 'divisi'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Rekap Per Divisi ({divisionRecap.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('cuti_lembur')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTableTab === 'cuti_lembur'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cuti & Lembur
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('harian')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTableTab === 'harian'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Log Harian ({filteredAttendances.length})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* TAB 1: REKAP PER KARYAWAN (1 BARIS PER KARYAWAN UNIK) */}
          {activeTableTab === 'karyawan' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Karyawan</th>
                    <th className="py-2.5 px-3">NIP</th>
                    <th className="py-2.5 px-3">Divisi</th>
                    <th className="py-2.5 px-3 text-center">Hadir</th>
                    <th className="py-2.5 px-3 text-center">Terlambat</th>
                    <th className="py-2.5 px-3 text-center">Cuti</th>
                    <th className="py-2.5 px-3 text-center">Izin</th>
                    <th className="py-2.5 px-3 text-center">Sakit</th>
                    <th className="py-2.5 px-3 text-center">Lembur</th>
                    <th className="py-2.5 px-3 text-right">Upah Lembur</th>
                    <th className="py-2.5 px-3 text-center">Disiplin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employeeRecap.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-muted-foreground">
                        Tidak ada data karyawan yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    employeeRecap.map((e, idx) => (
                      <tr key={e.userId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {e.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                          {e.nip}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {e.division}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-emerald-600 dark:text-emerald-400">
                          {e.totalHadir} hr
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {e.totalTelat > 0 ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                              {e.totalTelat}x ({e.totalLateMins}m)
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {e.cutiDays > 0 ? `${e.cutiDays} hr` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {e.izinDays > 0 ? `${e.izinDays} hr` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {e.sakitDays > 0 ? `${e.sakitDays} hr` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-sky-600 dark:text-sky-400">
                          {e.otHours > 0 ? `${e.otHours.toFixed(1)} Jam` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                          {e.otPay > 0 ? `Rp ${e.otPay.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              e.attRate >= 80
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                            }
                          >
                            {e.attRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: REKAP PER DIVISI (1 BARIS PER DIVISI) */}
          {activeTableTab === 'divisi' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Divisi / Departemen</th>
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-3 text-center">Jml Karyawan</th>
                    <th className="py-2.5 px-3 text-center">Total Hadir</th>
                    <th className="py-2.5 px-3 text-center">Terlambat</th>
                    <th className="py-2.5 px-3 text-center">Cuti (Hari)</th>
                    <th className="py-2.5 px-3 text-center">Izin / Sakit</th>
                    <th className="py-2.5 px-3 text-center">Total Lembur</th>
                    <th className="py-2.5 px-3 text-right">Kompensasi Lembur</th>
                    <th className="py-2.5 px-3 text-center">Rata-rata Disiplin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {divisionRecap.map((d, idx) => (
                    <tr key={d.divisionName} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {d.divisionName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {d.divisionCode}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-primary">
                        {d.employeeCount} Orang
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-emerald-600">
                        {d.totalHadir}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {d.totalTelat > 0 ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                            {d.totalTelat}x ({d.totalLateMins}m)
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {d.totalCuti} hr
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {d.totalIzin + d.totalSakit} hr
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-sky-600">
                        {d.totalOtHours > 0 ? `${d.totalOtHours.toFixed(1)} Jam` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                        {d.totalOtPay > 0 ? `Rp ${d.totalOtPay.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          {d.avgRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: CUTI, IZIN, SAKIT & LEMBUR REALTIME */}
          {activeTableTab === 'cuti_lembur' && (
            <div className="p-4 space-y-6">
              {/* Leaves Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-purple-600" />
                  Rekapitulasi Pengajuan Izin, Cuti & Surat Sakit ({filteredLeaves.length})
                </h4>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-3">Divisi</th>
                        <th className="py-2 px-3">Jenis</th>
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3 text-center">Durasi</th>
                        <th className="py-2 px-3">Alasan</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLeaves.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-muted-foreground">
                            Tidak ada pengajuan izin/cuti pada periode {selectedMonth}.
                          </td>
                        </tr>
                      ) : (
                        filteredLeaves.map((l) => (
                          <tr key={l.id} className="hover:bg-muted/20">
                            <td className="py-2 px-3 font-medium text-foreground">{l.userName}</td>
                            <td className="py-2 px-3 text-muted-foreground">{l.divisionName}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className="text-[10px]">
                                {l.leaveType.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{l.startDate} s/d {l.endDate}</td>
                            <td className="py-2 px-3 text-center font-semibold">{l.totalDays} Hari</td>
                            <td className="py-2 px-3 text-muted-foreground truncate max-w-xs">{l.reason}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  l.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : l.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                }
                              >
                                {l.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overtime Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                  Rekapitulasi Lembur SPKL Disetujui ({filteredOvertimes.length})
                </h4>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-3">Divisi</th>
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3">Jam Lembur</th>
                        <th className="py-2 px-3 text-center">Durasi</th>
                        <th className="py-2 px-3 text-right">Kompensasi</th>
                        <th className="py-2 px-3">Tugas</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOvertimes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-4 text-center text-muted-foreground">
                            Tidak ada pengajuan lembur pada periode {selectedMonth}.
                          </td>
                        </tr>
                      ) : (
                        filteredOvertimes.map((o) => (
                          <tr key={o.id} className="hover:bg-muted/20">
                            <td className="py-2 px-3 font-medium text-foreground">{o.userName}</td>
                            <td className="py-2 px-3 text-muted-foreground">{o.divisionName}</td>
                            <td className="py-2 px-3 text-muted-foreground">{o.date}</td>
                            <td className="py-2 px-3 text-muted-foreground">{o.startTime} - {o.endTime}</td>
                            <td className="py-2 px-3 text-center font-semibold text-sky-600">
                              {o.approvedHours ?? o.durationHours} Jam
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[11px]">
                              Rp {(o.compensationAmount ?? o.totalPay ?? 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground truncate max-w-xs">{o.taskDescription}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                {o.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LOG HARIAN LENGKAP */}
          {activeTableTab === 'harian' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Karyawan</th>
                    <th className="py-2.5 px-3">NIP</th>
                    <th className="py-2.5 px-3">Divisi</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Masuk</th>
                    <th className="py-2.5 px-3">Pulang</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Keterlambatan</th>
                    <th className="py-2.5 px-3">Catatan / Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground">
                        Tidak ada log presensi harian pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((a, idx) => (
                      <tr key={a.id || idx} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{a.userName}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">{a.userNip || '-'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{a.divisionName || '-'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{a.date || a.attendanceDate}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{a.clockIn?.substring(0, 5) || '-'}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{a.clockOut?.substring(0, 5) || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              a.status === 'hadir'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            }
                          >
                            {a.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {a.lateMinutes ? `${a.lateMinutes}m` : '-'}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground truncate max-w-xs">{a.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* ─── MODAL EXPORT PDF DENGAN PILIHAN FORMAT REKAPITULASI ──────────────── */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="w-4 h-4 text-rose-600" />
              Pilih Jenis Rekapitulasi PDF Resmi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih format dokumen resmi PT. Fawwaz Reski Perwira untuk periode {selectedMonth}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-2 text-xs">
            <label
              onClick={() => setPdfReportType('karyawan')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                pdfReportType === 'karyawan'
                  ? 'border-primary bg-primary/5 text-foreground shadow-xs'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {pdfReportType === 'karyawan' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">1. Rekapitulasi Per Karyawan (Rekomendasi)</p>
                <p className="text-[11px] text-muted-foreground">
                  Satu baris per karyawan tanpa duplikasi: Total Hadir, Telat (kali & menit), Cuti, Sakit, Izin, Lembur, dan Skor Disiplin.
                </p>
              </div>
            </label>

            <label
              onClick={() => setPdfReportType('divisi')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                pdfReportType === 'divisi'
                  ? 'border-primary bg-primary/5 text-foreground shadow-xs'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {pdfReportType === 'divisi' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">2. Rekapitulasi Per Divisi / Departemen</p>
                <p className="text-[11px] text-muted-foreground">
                  Konsolidasi kehadiran per divisi: Jml Anggota, Total Hadir, Keterlambatan, Cuti/Sakit, dan Rata-rata Kedisiplinan.
                </p>
              </div>
            </label>

            <label
              onClick={() => setPdfReportType('cuti_lembur')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                pdfReportType === 'cuti_lembur'
                  ? 'border-primary bg-primary/5 text-foreground shadow-xs'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {pdfReportType === 'cuti_lembur' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">3. Rekapitulasi Cuti, Izin, Sakit & Lembur Realtime</p>
                <p className="text-[11px] text-muted-foreground">
                  Audit trail pengajuan cuti tahunan, sakit dengan surat, dan Surat Perintah Kerja Lembur (SPKL) terverifikasi.
                </p>
              </div>
            </label>

            <label
              onClick={() => setPdfReportType('lengkap')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                pdfReportType === 'lengkap'
                  ? 'border-primary bg-primary/5 text-foreground shadow-xs'
                  : 'border-border hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {pdfReportType === 'lengkap' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">4. Laporan Eksekutif Lengkap (Semua Rekapan)</p>
                <p className="text-[11px] text-muted-foreground">
                  Buku laporan resmi gabungan (Multi-Halaman) mencakup Rekap Karyawan, Rekap Divisi, dan Rekap Cuti/Lembur.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPdfModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => generateOfficialPDF(pdfReportType)}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Dokumen PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
