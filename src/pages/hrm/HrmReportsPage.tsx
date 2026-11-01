import React, { useState, useEffect, useRef } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, Division, AppSettings, OfficeLocation, OvertimeRecord, UserProfile, Shift, isOfficialFrEmployee, LeaveRequest } from '@/types/hrm';
import { HrmAbsenSplModal } from '@/components/hrm/HrmAbsenSplModal';
import { HrmEmployeeMonthlyCalendarModal } from '@/components/hrm/HrmEmployeeMonthlyCalendarModal';
import { HrmLeaveOvertimeLiabilityView } from '@/components/hrm/HrmLeaveOvertimeLiabilityView';
import defaultLogo from '@/assets/logo.png';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  Calendar,
  X,
  Eye,
  TrendingUp,
  FileDown,
  Coins,
  Wallet,
  CreditCard,
  CheckCheck,
  ShieldAlert,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import * as XLSX from 'xlsx';

export const HrmReportsPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [activeTab, setActiveTab] = useState<'attendance' | 'overtime' | 'liability'>('attendance');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(hrmService.getAppSettings());
  const [office, setOffice] = useState<OfficeLocation>(hrmService.getOfficeLocation());

  // Attendance Filters & Monthly Navigation (Synchronized with Active Fiscal Period)
  const fiscalPeriod = hrmService.getFiscalPeriod();
  const defaultFiscalMonthStr = `${fiscalPeriod.activeYear}-${String(fiscalPeriod.activeMonth).padStart(2, '0')}`;
  const currentMonthStr = getTodayDateStr().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultFiscalMonthStr || currentMonthStr);
  const [attendanceViewMode, setAttendanceViewMode] = useState<'recap' | 'logs'>('recap');
  const [selectedDate, setSelectedDate] = useState<string>(''); // Default kosong agar menampilkan data bulan terpilih
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetchingMonth, setIsFetchingMonth] = useState<boolean>(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);
  const [selectedCalendarUser, setSelectedCalendarUser] = useState<UserProfile | null>(null);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);

  // Overtime Filters
  const [selectedOtDate, setSelectedOtDate] = useState<string>('');
  const [filterOtDivision, setFilterOtDivision] = useState<string>('all');
  const [filterOtStatus, setFilterOtStatus] = useState<string>('all');
  const [filterOtPayment, setFilterOtPayment] = useState<string>('all');
  const [otSearchQuery, setOtSearchQuery] = useState('');

  // Professional Print Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [otPrintModalOpen, setOtPrintModalOpen] = useState(false);
  const [absenSplModalOpen, setAbsenSplModalOpen] = useState(false);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [leaderSignName, setLeaderSignName] = useState('Drs. Hendra Setiawan, M.M.');
  const [hrdSignName, setHrdSignName] = useState(user?.fullName || 'Budi Santoso, S.Psi.');
  const [financeSignName, setFinanceSignName] = useState('Siti Aminah, S.E.');

  const printAreaRef = useRef<HTMLDivElement>(null);
  const otPrintAreaRef = useRef<HTMLDivElement>(null);

  // Parsing Tahun & Bulan Terpilih
  const [selectedYearNum, selectedMonthNum] = React.useMemo(() => {
    const parts = (selectedMonth || currentMonthStr).split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth, currentMonthStr]);

  const selectedMonthLabel = React.useMemo(() => {
    const d = new Date(selectedYearNum, selectedMonthNum - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedYearNum, selectedMonthNum]);

  // Fetch data presensi dari PostgreSQL API saat bulan berganti
  const fetchMonthAttendances = React.useCallback(async (monthStr: string) => {
    try {
      setIsFetchingMonth(true);
      const res = await fetch(`/api/attendances?month=${monthStr}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const monthAtts: AttendanceRecord[] = json.data.filter((a: any) => isOfficialFrEmployee(a.userNip));
          setAttendances((prev) => {
            const map = new Map(prev.map((a) => [a.id, a]));
            monthAtts.forEach((a) => map.set(a.id, a));
            return Array.from(map.values());
          });
        }
      }
    } catch (e) {
      console.warn('[ReportsPage] Fetch month attendances warning:', e);
    } finally {
      setIsFetchingMonth(false);
    }
  }, []);

  const loadData = async () => {
    setAttendances(hrmService.getAttendances().filter((a) => isOfficialFrEmployee(a.userNip)));
    setOvertimes(hrmService.getOvertimeRecords().filter((o) => isOfficialFrEmployee(o.userNip)));
    setLeaves(hrmService.getLeaves().filter((l) => isOfficialFrEmployee(l.userNip || l.userId)));
    setDivisions(hrmService.getDivisions());
    setAppSettings(hrmService.getAppSettings());
    setOffice(hrmService.getOfficeLocation());
    setEmployees(hrmService.getUsers().filter((u) => u.isActive && isOfficialFrEmployee(u)));
    setAllShifts(hrmService.getShifts());
    fetchMonthAttendances(selectedMonth);

    // Refresh data karyawan langsung dari API PostgreSQL
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const frUsers = json.data.filter((u: any) => u.isActive && isOfficialFrEmployee(u));
          if (frUsers.length > 0) {
            setEmployees(frUsers);
          }
        }
      }
    } catch (e) {
      console.warn('[ReportsPage] Fetch fresh users warning:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    fetchMonthAttendances(selectedMonth);
  }, [selectedMonth, fetchMonthAttendances]);

  // Navigasi Bulan
  const handlePrevMonth = () => {
    let nextY = selectedYearNum;
    let nextM = selectedMonthNum - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    const newMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setSelectedDate('');
  };

  const handleNextMonth = () => {
    let nextY = selectedYearNum;
    let nextM = selectedMonthNum + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const newMonthStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setSelectedDate('');
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
    setSelectedDate('');
  };

  // Matriks Rekapitulasi Presensi Bulanan Per Karyawan
  const monthlyEmployeeRecap = React.useMemo(() => {
    return employees.map((emp) => {
      const isFaceEnrolled = Boolean(
        emp.isFaceEnrolled ||
        emp.faceEnrolledPhoto ||
        (emp.faceDescriptor && (emp.faceDescriptor as any).length > 0) ||
        (emp as any).is_face_enrolled
      );

      const empAtts = attendances.filter((a) => {
        const isEmp = a.userId === emp.id || a.userId === emp.nip || (a.userNip && a.userNip === emp.nip);
        const aDate = a.attendanceDate || (a as any).date;
        const inMonth = aDate && aDate.startsWith(selectedMonth);
        return isEmp && inMonth;
      });

      // Filter Overtime yang telah disetujui (SPKL sah) untuk bulan ini
      const empOvertimes = overtimes.filter((o) => {
        const isEmp = o.userId === emp.id || o.userNip === emp.nip;
        const inMonth = o.date && o.date.startsWith(selectedMonth);
        return isEmp && inMonth && o.status === 'approved';
      });

      // Filter Cuti & Sakit dari data Leaves yang telah disetujui
      const empApprovedLeaves = leaves.filter((l) => {
        const isEmp = l.userId === emp.id || l.userNip === emp.nip;
        const inMonth = (l.startDate && l.startDate.startsWith(selectedMonth)) || (l.endDate && l.endDate.startsWith(selectedMonth));
        return isEmp && inMonth && l.status === 'approved';
      });

      // Hitung Hari Cuti, Sakit, Izin secara akurat & bebas duplikasi tanggal
      const cutiDates = new Set<string>();
      const sakitDates = new Set<string>();
      const izinDates = new Set<string>();

      empAtts.forEach((a) => {
        const dt = a.attendanceDate || (a as any).date;
        if (!dt) return;
        if (a.status === 'cuti') cutiDates.add(dt);
        if (a.status === 'sakit') sakitDates.add(dt);
        if (a.status === 'izin') izinDates.add(dt);
      });

      empApprovedLeaves.forEach((l) => {
        const type = (l.leaveType || '').toLowerCase();
        try {
          const start = new Date(l.startDate);
          const end = new Date(l.endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const ymd = d.toISOString().slice(0, 10);
            if (ymd.startsWith(selectedMonth)) {
              if (type === 'sakit') {
                sakitDates.add(ymd);
              } else if (type === 'izin') {
                izinDates.add(ymd);
              } else {
                cutiDates.add(ymd);
              }
            }
          }
        } catch (e) {
          console.warn('Error parsing leave dates:', e);
        }
      });

      // ── ATURAN BAKU KARYAWAN BELUM REGISTRASI WAJAH ──
      // Jika karyawan belum melakukan perekaman wajah biometrik (akun baru / proses pendaftaran):
      // Status biometrik: "Belum Aktif (Belum Registrasi Wajah)".
      // Sesuai mandat pimpinan: TIDAK BERLAKU akumulasi mangkir/alpa berjalan, denda, atau metrik kehadiran.
      if (!isFaceEnrolled) {
        return {
          user: emp,
          isFaceEnrolled: false,
          statusBiometrikLabel: 'Belum Aktif (Belum Registrasi Wajah)',
          statusBadge: 'Belum Registrasi',
          totalAttendances: 0,
          onTimeCount: 0,
          lateCount: 0,
          totalLateMinutes: 0,
          lateDeduction: 0,
          cutiCount: 0,
          sakitCount: 0,
          izinCount: 0,
          overtimeHours: 0,
          totalWorkHours: 0,
          perimeterBreachCount: 0,
          alpaCount: 0,
          keterangan: 'Menunggu Registrasi Biometrik Wajah',
          attendances: [],
        };
      }

      // Karyawan Aktif Terdaftar Wajah
      const onTimeCount = empAtts.filter((a) => a.status === 'hadir').length;
      const lateAtts = empAtts.filter((a) => a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0));
      const lateCount = lateAtts.length;
      const totalLateMinutes = empAtts.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
      const lateDeduction = totalLateMinutes * 1000;
      const totalWorkMinutes = empAtts.reduce((sum, a) => sum + (a.workDurationMinutes || 0), 0);
      const totalWorkHours = Number((totalWorkMinutes / 60).toFixed(1));
      const perimeterBreachCount = empAtts.reduce((sum, a) => sum + (a.perimeterBreachCount || (a.isPerimeterBreached ? 1 : 0)), 0);

      const otFromRecords = empOvertimes.reduce((sum, o) => sum + (o.durationHours || 0), 0);
      const otFromAtts = empAtts.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
      const overtimeHours = Number(Math.max(otFromRecords, otFromAtts).toFixed(1));

      const alpaCount = empAtts.filter((a) => a.status === 'alfa' || a.status === 'mangkir').length;

      return {
        user: emp,
        isFaceEnrolled: true,
        statusBiometrikLabel: 'Aktif (Wajah Terdaftar)',
        statusBadge: 'Aktif Terdaftar',
        totalAttendances: onTimeCount + lateCount,
        onTimeCount,
        lateCount,
        totalLateMinutes,
        lateDeduction,
        cutiCount: cutiDates.size,
        sakitCount: sakitDates.size,
        izinCount: izinDates.size,
        overtimeHours,
        totalWorkHours,
        perimeterBreachCount,
        alpaCount,
        keterangan: 'Aktif Bekerja',
        attendances: empAtts,
      };
    });
  }, [employees, attendances, overtimes, leaves, selectedMonth]);

  const filteredMonthlyRecap = React.useMemo(() => {
    return monthlyEmployeeRecap.filter((item) => {
      const matchDiv = filterDivision === 'all' || (item.user.divisionName || '').toLowerCase() === filterDivision.toLowerCase() || item.user.divisionId === filterDivision;
      const matchSearch =
        item.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.user.nip.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDiv && matchSearch;
    });
  }, [monthlyEmployeeRecap, filterDivision, searchQuery]);

  // Export Rekapitulasi Bulanan Seluruh Karyawan ke Excel (.xlsx)
  const exportMonthlyRecapToExcel = () => {
    const dataToExport = filteredMonthlyRecap.map((r, idx) => ({
      No: idx + 1,
      'Periode Bulan': selectedMonthLabel,
      NIP: r.user.nip,
      'Nama Karyawan': r.user.fullName,
      Divisi: r.user.divisionName || '-',
      'Status Biometrik': r.statusBiometrikLabel,
      'Total Kehadiran': r.isFaceEnrolled ? r.totalAttendances : '-',
      'Hadir Tepat Waktu': r.isFaceEnrolled ? r.onTimeCount : '-',
      'Hadir Terlambat': r.isFaceEnrolled ? r.lateCount : '-',
      'Total Menit Terlambat': r.isFaceEnrolled ? r.totalLateMinutes : '-',
      'Cuti (Hari)': r.isFaceEnrolled ? r.cutiCount : '-',
      'Sakit (Hari)': r.isFaceEnrolled ? r.sakitCount : '-',
      'Lembur (Jam SPKL)': r.isFaceEnrolled ? r.overtimeHours : '-',
      'Akumulasi Jam Kerja (Jam)': r.isFaceEnrolled ? r.totalWorkHours : '-',
      'Alpa / Mangkir (Hari)': r.isFaceEnrolled ? r.alpaCount : '-',
      'Estimasi Denda Terlambat (Rp)': r.isFaceEnrolled ? r.lateDeduction : 0,
      Keterangan: r.keterangan,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap ${selectedMonth}`);

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 14 },
      { wch: 26 },
      { wch: 22 },
      { wch: 30 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 26 },
      { wch: 32 },
    ];

    XLSX.writeFile(workbook, `Rekapitulasi_Presensi_Bulanan_${selectedMonth}.xlsx`);
  };

  // Unduh PDF Rekapitulasi Presensi, Keterlambatan, Cuti, Sakit, Jam Kerja & Lembur Bulanan
  const handleDownloadMonthlyRecapPdf = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 297;
      const pageHeight = 210;
      const marginX = 10;
      const contentWidth = pageWidth - marginX * 2; // 277mm

      // Helper konversi gambar ke dataURL canvas
      const loadImgData = (src: string): Promise<string> => {
        return new Promise((resolve) => {
          if (!src || src.startsWith('data:')) {
            resolve(src);
            return;
          }
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              } else {
                resolve(src);
              }
            } catch {
              resolve(src);
            }
          };
          img.onerror = () => resolve(src);
          img.src = src;
        });
      };

      // 1. KOP SURAT RESMI PT. FAWWAZ RESKI PERWIRA & LOGO
      const logoSrc = appSettings?.companyLogo || defaultLogo;
      try {
        const logoData = await loadImgData(logoSrc);
        if (logoData) {
          doc.addImage(logoData, 'PNG', marginX + 1, 6, 13, 13);
        }
      } catch (e) {
        console.warn('Gagal memuat logo untuk PDF:', e);
      }

      // Keterangan Instansi di samping logo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('PT. FAWWAZ RESKI PERWIRA', marginX + 16, 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(4, 120, 87); // emerald-700
      doc.text('PENGELOLAAN FASILITAS OPERASIONAL & SUMBER DAYA KARYAWAN', marginX + 16, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('Bontoa, Minasatene, Pangkajene and Islands Regency, South Sulawesi • Web: fawwazreskiperwira.com', marginX + 16, 17.5);

      // Kanan Kop: Judul Dokumen & Periode
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('REKAPITULASI PRESENSI, CUTI, SAKIT & LEMBUR', pageWidth - marginX - 1, 10, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text(`PERIODE: ${selectedMonthLabel.toUpperCase()}`, pageWidth - marginX - 1, 14, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Laporan Resmi Eksekutif Perusahaan (Format Sah)', pageWidth - marginX - 1, 17.5, { align: 'right' });

      // Garis Ganda Pembatas Kop Surat
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      doc.line(marginX, 20.5, pageWidth - marginX, 20.5);

      doc.setLineWidth(0.12);
      doc.line(marginX, 21.2, pageWidth - marginX, 21.2);

      // 2. EXECUTIVE KPI OVERVIEW CARDS (5 KOTAK RINGKASAN METRIK BULANAN)
      const kpiY = 23;
      const kpiH = 13.5;
      const gap = 2.5;
      const cardW = (contentWidth - gap * 4) / 5; // ~53.4mm

      const totalEmployeesCount = filteredMonthlyRecap.length;
      const activeEnrolledCount = filteredMonthlyRecap.filter((r) => r.isFaceEnrolled).length;
      const pendingEnrollmentCount = filteredMonthlyRecap.filter((r) => !r.isFaceEnrolled).length;
      const grandTotalHadir = filteredMonthlyRecap.reduce((sum, r) => sum + r.totalAttendances, 0);
      const grandTotalOnTime = filteredMonthlyRecap.reduce((sum, r) => sum + r.onTimeCount, 0);
      const grandTotalLate = filteredMonthlyRecap.reduce((sum, r) => sum + r.lateCount, 0);
      const grandTotalLateMinutes = filteredMonthlyRecap.reduce((sum, r) => sum + r.totalLateMinutes, 0);
      const grandTotalCuti = filteredMonthlyRecap.reduce((sum, r) => sum + r.cutiCount, 0);
      const grandTotalSakit = filteredMonthlyRecap.reduce((sum, r) => sum + r.sakitCount, 0);
      const grandTotalAlpa = filteredMonthlyRecap.reduce((sum, r) => sum + r.alpaCount, 0);
      const grandTotalOtHours = Number(filteredMonthlyRecap.reduce((sum, r) => sum + r.overtimeHours, 0).toFixed(1));
      const grandTotalWorkHours = Number(filteredMonthlyRecap.reduce((sum, r) => sum + r.totalWorkHours, 0).toFixed(1));

      const kpiCards = [
        {
          label: 'TOTAL PERSONEL RESMI',
          val: `${totalEmployeesCount} Orang`,
          sub: 'Personel PT. FRP Resmi',
          bg: [248, 250, 252],
          border: [203, 213, 225],
          valColor: [15, 23, 42],
        },
        {
          label: 'STATUS BIOMETRIK WAJAH',
          val: `${activeEnrolledCount} Aktif / ${pendingEnrollmentCount} Belum`,
          sub: activeEnrolledCount === totalEmployeesCount ? '100% Terverifikasi' : `${pendingEnrollmentCount} Belum Registrasi`,
          bg: [240, 253, 244],
          border: [187, 247, 208],
          valColor: [22, 101, 52],
        },
        {
          label: 'KEHADIRAN & KETEPATAN',
          val: `${grandTotalHadir} Hadir (${grandTotalOnTime} Tepat)`,
          sub: `${grandTotalLate}x Terlambat (${grandTotalLateMinutes} mnt)`,
          bg: [239, 246, 255],
          border: [191, 219, 254],
          valColor: [29, 78, 216],
        },
        {
          label: 'CUTI, SAKIT & ALPA',
          val: `${grandTotalCuti} Cuti / ${grandTotalSakit} Sakit`,
          sub: grandTotalAlpa > 0 ? `${grandTotalAlpa} Alpa Terakumulasi` : '0 Alpa (Disiplin Terjaga)',
          bg: [254, 252, 232],
          border: [254, 240, 138],
          valColor: [133, 77, 14],
        },
        {
          label: 'TOTAL JAM KERJA & LEMBUR',
          val: `${grandTotalWorkHours} Jam Kerja`,
          sub: `${grandTotalOtHours} Jam Lembur Sah SPKL`,
          bg: [255, 247, 237],
          border: [254, 215, 170],
          valColor: [154, 52, 18],
        },
      ];

      kpiCards.forEach((c, i) => {
        const curX = marginX + i * (cardW + gap);
        doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
        doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
        doc.setLineWidth(0.2);
        doc.roundedRect(curX, kpiY, cardW, kpiH, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.8);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, curX + 2.5, kpiY + 3.4);

        doc.setFontSize(8.2);
        doc.setTextColor(c.valColor[0], c.valColor[1], c.valColor[2]);
        doc.text(c.val, curX + 2.5, kpiY + 7.6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(c.sub, curX + 2.5, kpiY + 11.2);
      });

      // 3. TABEL UTAMA REKAPITULASI (jspdf-autotable)
      const tableHead = [
        [
          'NO',
          'NIP',
          'NAMA KARYAWAN',
          'DIVISI / PENUGASAN',
          'STATUS BIOMETRIK',
          'HADIR',
          'TERLAMBAT',
          'CUTI',
          'SAKIT',
          'LEMBUR',
          'JAM KERJA',
          'ALPA',
          'KETERANGAN',
        ],
      ];

      const tableBody = filteredMonthlyRecap.map((r, idx) => {
        const isEnrolled = r.isFaceEnrolled;
        return [
          String(idx + 1),
          r.user.nip,
          (r.user.fullName || '').toUpperCase(),
          r.user.divisionName || '-',
          isEnrolled ? 'Aktif (Terdaftar)' : 'Belum Registrasi Wajah',
          isEnrolled ? `${r.totalAttendances} Hari` : '-',
          isEnrolled ? (r.lateCount > 0 ? `${r.lateCount}x (${r.totalLateMinutes}m)` : '-') : '-',
          isEnrolled ? (r.cutiCount > 0 ? `${r.cutiCount} Hari` : '-') : '-',
          isEnrolled ? (r.sakitCount > 0 ? `${r.sakitCount} Hari` : '-') : '-',
          isEnrolled ? (r.overtimeHours > 0 ? `${r.overtimeHours} Jam` : '-') : '-',
          isEnrolled ? `${r.totalWorkHours} Jam` : '-',
          isEnrolled ? (r.alpaCount > 0 ? `${r.alpaCount} Hari` : '-') : '-',
          isEnrolled ? r.keterangan : 'Menunggu Registrasi Wajah',
        ];
      });

      // Baris Total Akumulasi (Foot Row)
      const tableFoot = [
        [
          'TOTAL',
          '',
          `TOTAL KESELURUHAN (${filteredMonthlyRecap.length} PERSONEL)`,
          '',
          `${activeEnrolledCount} Aktif / ${pendingEnrollmentCount} Belum`,
          `${grandTotalHadir} Hari`,
          `${grandTotalLate}x (${grandTotalLateMinutes}m)`,
          `${grandTotalCuti} Hari`,
          `${grandTotalSakit} Hari`,
          `${grandTotalOtHours} Jam`,
          `${grandTotalWorkHours} Jam`,
          `${grandTotalAlpa} Hari`,
          '-',
        ],
      ];

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        foot: tableFoot,
        startY: 38.5,
        margin: { left: marginX, right: marginX, bottom: 25 },
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 6.8,
          cellPadding: 1.6,
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          valign: 'middle',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center',
          cellPadding: 2,
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 6.8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, // NO
          1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // NIP
          2: { cellWidth: 42, halign: 'left', fontStyle: 'bold' }, // NAMA
          3: { cellWidth: 32, halign: 'left' }, // DIVISI
          4: { cellWidth: 32, halign: 'center', fontStyle: 'bold' }, // STATUS BIOMETRIK
          5: { cellWidth: 14, halign: 'center' }, // HADIR
          6: { cellWidth: 20, halign: 'center' }, // TERLAMBAT
          7: { cellWidth: 13, halign: 'center' }, // CUTI
          8: { cellWidth: 13, halign: 'center' }, // SAKIT
          9: { cellWidth: 16, halign: 'center' }, // LEMBUR
          10: { cellWidth: 18, halign: 'center' }, // JAM KERJA
          11: { cellWidth: 14, halign: 'center' }, // ALPA
          12: { cellWidth: 33, halign: 'left' }, // KETERANGAN
        },
        didParseCell: (data) => {
          // Highlight kolom status biometrik
          if (data.section === 'body' && data.column.index === 4) {
            const rawVal = String(data.cell.raw || '');
            if (rawVal.includes('Aktif')) {
              data.cell.styles.textColor = [22, 101, 52]; // green-800
              data.cell.styles.fillColor = [240, 253, 244]; // green-50
            } else {
              data.cell.styles.textColor = [194, 65, 12]; // amber-700
              data.cell.styles.fillColor = [254, 243, 199]; // amber-100
            }
          }
          // Highlight baris karyawan yang belum terdaftar agar metrik '-' berwarna lembut
          if (data.section === 'body') {
            const rowData = filteredMonthlyRecap[data.row.index];
            if (rowData && !rowData.isFaceEnrolled) {
              if (data.column.index >= 5 && data.column.index <= 11) {
                data.cell.styles.textColor = [148, 163, 184]; // muted slate-400
              }
              if (data.column.index === 12) {
                data.cell.styles.textColor = [194, 65, 12]; // amber note
                data.cell.styles.fontStyle = 'italic';
              }
            } else if (rowData && rowData.isFaceEnrolled) {
              // Jika ada keterlambatan
              if (data.column.index === 6 && rowData.lateCount > 0) {
                data.cell.styles.textColor = [180, 83, 9];
                data.cell.styles.fontStyle = 'bold';
              }
              // Jika ada alpa
              if (data.column.index === 11 && rowData.alpaCount > 0) {
                data.cell.styles.textColor = [225, 29, 72];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        },
      });

      // Ambil posisi akhir tabel
      const finalY = (doc as any).lastAutoTable?.finalY || 160;

      // Cek apakah sisa halaman cukup untuk tanda tangan (butuh ~34mm)
      let signY = finalY + 7;
      if (signY + 32 > pageHeight - 12) {
        doc.addPage();
        signY = 20;
      }

      // Catatan Penjelasan Resmi di atas tanda tangan
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(
        '* Catatan Kebijakan: Karyawan berstatus "Belum Registrasi Wajah" adalah akun baru/dalam proses pendaftaran yang belum diwajibkan absensi biometrik, sehingga TIDAK dikenakan sanksi mangkir/alpa berjalan.',
        marginX,
        signY
      );

      signY += 5;

      // 4. DUAL-TIER LEGAL SIGNATURE BLOCK (3 KOLOM PENGESAHAN RESMI)
      const colW = (contentWidth - 20) / 3;
      const col1X = marginX + 5;
      const col2X = marginX + colW + 10;
      const col3X = marginX + colW * 2 + 15;

      // Kolom 1: HR & Administrasi
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text('Diperiksa & Divalidasi oleh,', col1X, signY);
      doc.setFont('helvetica', 'bold');
      doc.text('HR & Administrasi Operasional', col1X, signY + 3.8);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.8);
      doc.setTextColor(148, 163, 184);
      doc.text('( Tanda Tangan & Verifikasi Sistem )', col1X, signY + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(hrdSignName || 'Budi Prakoso, S.Psi.', col1X, signY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Dept. Human Capital & General', col1X, signY + 25);

      // Kolom 2: Pimpinan PT. FRP
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text('Mengetahui,', col2X, signY);
      doc.setFont('helvetica', 'bold');
      doc.text('Pimpinan PT. FAWWAZ RESKI PERWIRA', col2X, signY + 3.8);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.8);
      doc.setTextColor(148, 163, 184);
      doc.text('( Tanda Tangan & Cap Resmi )', col2X, signY + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('RESKI FAISAL', col2X, signY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Pimpinan PT. FRP', col2X, signY + 25);

      // Kolom 3: Direktur Utama
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text('Menyetujui,', col3X, signY);
      doc.setFont('helvetica', 'bold');
      doc.text('Direktur Utama PT. FAWWAZ RESKI PERWIRA', col3X, signY + 3.8);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.8);
      doc.setTextColor(148, 163, 184);
      doc.text('( Tanda Tangan & Cap Perusahaan )', col3X, signY + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ALAM AS SIMPUANG AGO, S.Sos', col3X, signY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Direktur Utama', col3X, signY + 25);

      // 5. FOOTER TIMESTAMP & PAGE NUMBERING (SEMUA HALAMAN)
      const pageCount = (doc as any).internal.getNumberOfPages();
      const printDateStr = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Makassar',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(marginX, pageHeight - 8, pageWidth - marginX, pageHeight - 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Dokumen Resmi Terverifikasi Sistem HRM PT. FAWWAZ RESKI PERWIRA • Waktu Cetak (WITA): ${printDateStr} WITA`,
          marginX,
          pageHeight - 5
        );
        doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
      }

      // Download File PDF
      const filename = `Rekapitulasi_Presensi_Bulanan_FRP_${selectedMonth}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('Gagal generate PDF Rekap Bulanan:', error);
    }
  };

  const filteredList = attendances.filter((a) => {
    const aDate = a.attendanceDate || (a as any).date;
    const matchMonth = aDate && aDate.startsWith(selectedMonth);
    const matchDate = !selectedDate || aDate === selectedDate;
    const matchDiv = filterDivision === 'all' || (a.divisionName || '').toLowerCase() === filterDivision.toLowerCase();
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchSearch =
      (a.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.userNip || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchMonth && matchDate && matchDiv && matchStatus && matchSearch;
  });

  const totalRecords = filteredList.length;
  const onTimeCount = filteredList.filter((a) => a.status === 'hadir').length;
  const lateCount = filteredList.filter((a) => a.status === 'terlambat').length;
  const totalLateMins = filteredList.reduce((acc, a) => acc + (a.lateMinutes || 0), 0);
  const totalWorkMins = filteredList.reduce((acc, a) => acc + (a.workDurationMinutes || 0), 0);
  const totalWorkHours = (totalWorkMins / 60).toFixed(1);

  const exportToExcel = () => {
    const dataToExport = filteredList.map((a, idx) => ({
      No: idx + 1,
      Tanggal: a.attendanceDate,
      NIP: a.userNip,
      'Nama Karyawan': a.userName,
      Divisi: a.divisionName || '-',
      'Jam Masuk': a.clockIn || '-',
      'Jam Pulang': a.clockOut || '-',
      'Durasi Kerja (Menit)': a.workDurationMinutes || 0,
      'Durasi Kerja (Jam)': ((a.workDurationMinutes || 0) / 60).toFixed(2),
      'Terlambat (Menit)': a.lateMinutes || 0,
      'Disiplin Perimeter': a.isPerimeterBreached ? `TERDETEKSI (${a.perimeterBreachCount || 1}x Keluar)` : 'PATUH (NIHIL)',
      'Waktu Luar Perimeter (Menit)': a.timeOutsideMinutes || 0,
      'Status Kunci Checkout': a.isLocked ? 'TERKUNCI' : 'NORMAL',
      Status: (a.status || '').toUpperCase(),
      Catatan: a.notes || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Presensi');

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 24 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
    ];

    XLSX.writeFile(workbook, `Rekap_Presensi_${selectedDate || 'Semua'}.xlsx`);
  };

  const exportToCsv = () => {
    const headers = ['No', 'Tanggal', 'NIP', 'Nama Karyawan', 'Divisi', 'Jam Masuk', 'Jam Pulang', 'Durasi (Menit)', 'Terlambat (Menit)', 'Disiplin Perimeter', 'Status Kunci', 'Status', 'Catatan'];
    const rows = filteredList.map((a, idx) => [
      idx + 1,
      a.attendanceDate,
      `"${a.userNip}"`,
      `"${a.userName}"`,
      `"${a.divisionName || '-'}"`,
      a.clockIn || '-',
      a.clockOut || '-',
      a.workDurationMinutes || 0,
      a.lateMinutes || 0,
      a.isPerimeterBreached ? `"TERDETEKSI (${a.perimeterBreachCount || 1}x)"` : '"PATUH"',
      a.isLocked ? '"TERKUNCI"' : '"NORMAL"',
      a.status,
      `"${a.notes || '-'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Presensi_${selectedDate || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintDocument = () => {
    window.print();
  };

  // ==========================================
  // OVERTIME DATA & EXPORT LOGIC
  // ==========================================
  const filteredOtList = overtimes.filter((o) => {
    const matchDate = !selectedOtDate || o.date === selectedOtDate;
    const matchDiv = filterOtDivision === 'all' || o.divisionName?.toLowerCase() === filterOtDivision.toLowerCase();
    const matchStatus = filterOtStatus === 'all' || o.status === filterOtStatus;
    const matchPayment = filterOtPayment === 'all' || o.paymentStatus === filterOtPayment;
    const matchSearch =
      (o.userName || '').toLowerCase().includes(otSearchQuery.toLowerCase()) ||
      (o.userNip || '').toLowerCase().includes(otSearchQuery.toLowerCase()) ||
      (o.taskDescription || '').toLowerCase().includes(otSearchQuery.toLowerCase());
    return matchDate && matchDiv && matchStatus && matchPayment && matchSearch;
  });

  // Chart data for attendance
  const divisionChartData = divisions.map((d) => {
    const divAttendances = filteredList.filter(
      (a) => a.divisionId === d.id || ((a.divisionName || '').toLowerCase() === (d.name || '').toLowerCase())
    );
    const tepatWaktu = divAttendances.filter((a) => a.status === 'hadir').length;
    const terlambat = divAttendances.filter((a) => a.status === 'terlambat').length;
    return {
      name: d.name,
      tepatWaktu,
      terlambat,
    };
  });

  const totalOtRecords = filteredOtList.length;
  const totalOtHours = Number(filteredOtList.reduce((acc, o) => acc + (o.durationHours || 0), 0).toFixed(1));
  const totalOtPay = filteredOtList.reduce((acc, o) => acc + Number(o.totalPay ?? o.compensationAmount ?? 0), 0);
  const approvedOtPay = filteredOtList
    .filter((o) => o.status === 'approved')
    .reduce((acc, o) => acc + Number(o.totalPay ?? o.compensationAmount ?? 0), 0);
  const paidOtPay = filteredOtList
    .filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'included_in_payroll')
    .reduce((acc, o) => acc + Number(o.totalPay ?? o.compensationAmount ?? 0), 0);
  const pendingOtCount = filteredOtList.filter((o) => o.status === 'pending').length;

  const otDivisionChartData = divisions.map((d) => {
    const divOts = filteredOtList.filter(
      (o) => o.divisionId === d.id || ((o.divisionName || '').toLowerCase() === (d.name || '').toLowerCase())
    );
    const hours = divOts.reduce((sum, o) => sum + (o.durationHours || 0), 0);
    const pay = divOts.reduce((sum, o) => sum + Number(o.totalPay ?? o.compensationAmount ?? 0), 0);
    return {
      name: d.name,
      hours: Number(hours.toFixed(1)),
      pay,
    };
  });

  // Selected Month Lateness Summary (Realtime & Historical Synchronized)
  const currentMonthAttendances = attendances.filter((a) => (a.attendanceDate || (a as any).date)?.startsWith(selectedMonth));
  const lateRecordsMonth = currentMonthAttendances.filter((a) => a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0));

  const employeeLatenessMap = new Map<string, {
    userName: string;
    userNip: string;
    divisionName: string;
    lateCount: number;
    totalLateMinutes: number;
  }>();

  lateRecordsMonth.forEach((a) => {
    const key = a.userId;
    const existing = employeeLatenessMap.get(key) || {
      userName: a.userName,
      userNip: a.userNip,
      divisionName: a.divisionName || '-',
      lateCount: 0,
      totalLateMinutes: 0,
    };
    existing.lateCount += 1;
    existing.totalLateMinutes += (a.lateMinutes || 0);
    employeeLatenessMap.set(key, existing);
  });

  const employeeLatenessList = Array.from(employeeLatenessMap.values()).sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);
  const totalLateMinutesMonth = employeeLatenessList.reduce((sum, e) => sum + e.totalLateMinutes, 0);
  const totalEstimatedDeduction = totalLateMinutesMonth * 1000;

  const exportOtToExcel = () => {
    const dataToExport = filteredOtList.map((o, idx) => ({
      No: idx + 1,
      Tanggal: o.date,
      NIP: o.userNip,
      'Nama Karyawan': o.userName,
      Divisi: o.divisionName || '-',
      'Jam Mulai': o.startTime,
      'Jam Selesai': o.endTime,
      'Kategori Hari': o.isWeekendHoliday ? 'Hari Libur / Akhir Pekan' : 'Hari Kerja Normal',
      'Durasi (Jam)': o.durationHours,
      'Tarif / Jam (Rp)': Number(o.hourlyRate ?? o.rateApplied ?? 30000),
      'Multiplier': `${o.rateMultiplier || 1}x`,
      'Total Uang Lembur (Rp)': Number(o.totalPay ?? o.compensationAmount ?? 0),
      'Uraian Tugas': o.taskDescription,
      'Status Persetujuan': o.status.toUpperCase(),
      'Status Pencairan': o.paymentStatus === 'paid' ? 'DITRANSFER' : o.paymentStatus === 'included_in_payroll' ? 'MASUK SLIP GAJI' : 'BELUM CAIR',
      'Disetujui Oleh': o.approvedByName || '-',
      'Catatan': o.approvalNotes || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Lembur');
    XLSX.writeFile(workbook, `Rekap_Uang_Lembur_${selectedOtDate || 'Semua'}.xlsx`);
  };

  const exportOtToCsv = () => {
    const headers = [
      'No',
      'Tanggal',
      'NIP',
      'Nama Karyawan',
      'Divisi',
      'Jam Mulai',
      'Jam Selesai',
      'Kategori Hari',
      'Durasi Jam',
      'Tarif Per Jam',
      'Total Uang Lembur',
      'Uraian Tugas',
      'Status Persetujuan',
      'Status Pencairan',
    ];

    const rows = filteredOtList.map((o, idx) => [
      idx + 1,
      o.date,
      o.userNip,
      `"${o.userName}"`,
      `"${o.divisionName || '-'}"`,
      o.startTime,
      o.endTime,
      o.isWeekendHoliday ? 'Hari Libur' : 'Hari Kerja',
      o.durationHours,
      o.hourlyRate,
      o.totalPay,
      `"${o.taskDescription.replace(/"/g, '""')}"`,
      o.status,
      o.paymentStatus,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Uang_Lembur_${selectedOtDate || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusPieData = [
    { name: 'Tepat Waktu', value: onTimeCount, color: '#0d9488' },
    { name: 'Terlambat', value: lateCount, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Dual Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            {activeTab === 'attendance' ? (
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            ) : activeTab === 'overtime' ? (
              <Coins className="w-6 h-6 text-primary" />
            ) : (
              <Wallet className="w-6 h-6 text-primary" />
            )}
            {activeTab === 'attendance'
              ? 'Rekapitulasi & Laporan Kehadiran'
              : activeTab === 'overtime'
              ? 'Laporan Rekapitulasi & Anggaran Lembur'
              : 'Audit Saldo Cuti & Kewajiban Lembur'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeTab === 'attendance'
              ? 'Laporan presensi lengkap dengan visualisasi data, ekspor Excel/CSV, dan cetak dokumen resmi ber-kop surat.'
              : activeTab === 'overtime'
              ? 'Laporan rincian jam lembur, tarif per jam, total kompensasi uang lembur, dan pencairan slip gaji.'
              : 'Pantau sisa hak cuti tahunan, jam lembur belum terbayar, dan valuasi liabilitas nominal (rupiah) per karyawan & divisi.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
              <span>Presensi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overtime')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'overtime'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span>Lembur & Anggaran</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('liability')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'liability'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-primary" />
              <span>Saldo Cuti & Lembur (Kewajiban)</span>
            </button>
          </div>

          {activeTab === 'attendance' ? (
            <>
              <Button
                onClick={() => setAbsenSplModalOpen(true)}
                className="bg-teal-700 hover:bg-teal-600 text-white text-xs gap-2 font-semibold shadow-sm rounded-xl h-9 border border-teal-500/40"
              >
                <FileText className="w-4 h-4 text-teal-200" /> Form ABSEN/SPL Resmi
              </Button>
              <Button
                onClick={() => setPrintModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-2 font-medium shadow-sm rounded-xl h-9"
              >
                <Printer className="w-4 h-4" /> Cetak Dokumen Resmi
              </Button>
              <Button
                variant="outline"
                onClick={exportMonthlyRecapToExcel}
                className="text-xs gap-1.5 rounded-xl h-9 font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                title={`Ekspor Rekapitulasi Presensi Bulanan Seluruh Karyawan (${selectedMonthLabel})`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Rekap Bulanan (.xlsx)
              </Button>
              <Button
                variant="outline"
                onClick={exportToExcel}
                className="text-xs gap-1.5 rounded-xl h-9 font-medium"
                title="Ekspor Log Presensi Harian"
              >
                <FileDown className="w-4 h-4 text-primary" /> Log Excel
              </Button>
              <Button
                variant="outline"
                onClick={exportToCsv}
                className="text-xs gap-1.5 rounded-xl h-9 font-medium"
              >
                <Download className="w-4 h-4 text-primary" /> CSV
              </Button>
            </>
          ) : activeTab === 'overtime' ? (
            <>
              <Button
                onClick={() => setOtPrintModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-2 font-medium shadow-sm rounded-xl h-9"
              >
                <Printer className="w-4 h-4" /> Cetak Dokumen Lembur
              </Button>
              <Button
                variant="outline"
                onClick={exportOtToExcel}
                className="text-xs gap-2 rounded-xl h-9 font-medium"
              >
                <FileDown className="w-4 h-4 text-primary" /> Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                onClick={exportOtToCsv}
                className="text-xs gap-2 rounded-xl h-9 font-medium"
              >
                <Download className="w-4 h-4 text-primary" /> CSV
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {activeTab === 'attendance' ? (
        <>
          {/* Summary Metrics - Clean & Uniform */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Total Rekap Presensi</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {totalRecords} <span className="text-xs font-normal text-muted-foreground">Catatan</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Hadir Tepat Waktu</p>
                <p className="text-2xl font-bold text-primary mt-1">{onTimeCount}</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Total Keterlambatan</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {lateCount} <span className="text-xs font-normal text-muted-foreground">({totalLateMins} Menit)</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Akumulasi Jam Kerja</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {totalWorkHours} <span className="text-xs font-normal text-muted-foreground">Jam</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Visual Analytics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Kehadiran Karyawan Berdasarkan Divisi
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Perbandingan kehadiran tepat waktu dan keterlambatan per departemen
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={divisionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="tepatWaktu" fill="#0d9488" radius={[4, 4, 0, 0]} name="Tepat Waktu" />
                      <Bar dataKey="terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Terlambat" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Rasio Ketepatan Waktu
                </CardTitle>
                <CardDescription className="text-xs">
                  Persentase disiplin jam hadir masuk kerja
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="flex items-center justify-center h-[130px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-muted-foreground text-[10px]">Tepat Waktu</p>
                    <p className="font-bold text-primary text-base">
                      {totalRecords > 0 ? Math.round((onTimeCount / totalRecords) * 100) : 0}%
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-muted-foreground text-[10px]">Terlambat</p>
                    <p className="font-bold text-amber-600 text-base">
                      {totalRecords > 0 ? Math.round((lateCount / totalRecords) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── INTERACTIVE MONTH NAVIGATOR & VIEW MODE SWITCHER ── */}
          <Card className="border-primary/30 bg-gradient-to-r from-card via-card to-primary/5 rounded-2xl shadow-xs overflow-hidden">
            <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Month Navigator Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border border-border">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePrevMonth}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <div className="flex items-center gap-1.5 px-3 font-semibold text-xs text-foreground min-w-[140px] justify-center">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>{selectedMonthLabel}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleNextMonth}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>

                {selectedMonth !== currentMonthStr && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetToCurrentMonth}
                    className="h-7 px-2.5 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-medium gap-1"
                  >
                    <RotateCw size={11} />
                    Bulan Berjalan
                  </Button>
                )}

                <Badge variant="outline" className="text-xs bg-muted/40 font-mono border-border">
                  {isFetchingMonth ? 'Sinkronisasi PostgreSQL...' : `${filteredMonthlyRecap.length} Karyawan`}
                </Badge>
              </div>

              {/* View Mode Toggle: Rekap Bulanan Karyawan vs Rincian Log Harian */}
              <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border border-border self-end sm:self-auto">
                <Button
                  size="sm"
                  variant={attendanceViewMode === 'recap' ? 'default' : 'ghost'}
                  onClick={() => setAttendanceViewMode('recap')}
                  className="h-7 px-2.5 text-xs rounded-lg font-medium gap-1.5"
                >
                  <Users size={12} />
                  <span>Rekapan Bulanan Karyawan</span>
                </Button>
                <Button
                  size="sm"
                  variant={attendanceViewMode === 'logs' ? 'default' : 'ghost'}
                  onClick={() => setAttendanceViewMode('logs')}
                  className="h-7 px-2.5 text-xs rounded-lg font-medium gap-1.5"
                >
                  <FileText size={12} />
                  <span>Log Detail Harian</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── SUB-VIEW 1: REKAPAN BULANAN PER KARYAWAN ── */}
          {attendanceViewMode === 'recap' ? (
            <div className="space-y-4">
              {/* Filter Bar Rekapan */}
              <Card className="border-border bg-card rounded-xl shadow-xs">
                <CardContent className="p-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          type="text"
                          placeholder="Cari nama karyawan, NIP..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 text-xs rounded-xl h-9"
                        />
                      </div>
                      <Select value={filterDivision} onValueChange={setFilterDivision}>
                        <SelectTrigger className="text-xs rounded-xl h-9">
                          <SelectValue placeholder="Semua Divisi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Divisi</SelectItem>
                          {divisions.map((d) => (
                            <SelectItem key={d.id} value={d.name}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleDownloadMonthlyRecapPdf}
                        className="h-9 px-3.5 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-sm"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        Unduh Rekap Bulanan (PDF)
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportMonthlyRecapToExcel}
                        className="h-9 px-3 text-xs rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        Ekspor Excel (.xlsx)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabel Matriks Rekapitulasi Presensi Bulanan Seluruh Karyawan */}
              <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Rekapitulasi Presensi Bulanan Karyawan ({selectedMonthLabel})
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ringkasan kehadiran, status biometrik, frekuensi keterlambatan, cuti, sakit, lembur, dan audit disiplin seluruh personel aktif.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono bg-muted/40 border-border">
                    {filteredMonthlyRecap.length} Personel
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-2 text-center font-semibold w-8">#</th>
                        <th className="py-3 px-3 font-semibold min-w-[180px]">Karyawan</th>
                        <th className="py-3 px-3 font-semibold min-w-[110px]">Divisi</th>
                        <th className="py-3 px-3 text-center font-semibold min-w-[130px]">Status Biometrik</th>
                        <th className="py-3 px-2 text-center font-semibold">Hadir</th>
                        <th className="py-3 px-2 text-center font-semibold">Telat</th>
                        <th className="py-3 px-2 text-center font-semibold">Cuti</th>
                        <th className="py-3 px-2 text-center font-semibold">Sakit</th>
                        <th className="py-3 px-2 text-center font-semibold">Lembur</th>
                        <th className="py-3 px-2 text-center font-semibold">Jam Kerja</th>
                        <th className="py-3 px-2 text-center font-semibold">Alpa</th>
                        <th className="py-3 px-3 text-center font-semibold w-24">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMonthlyRecap.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-8 text-center text-muted-foreground">
                            Tidak ada data karyawan yang cocok dengan kriteria pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredMonthlyRecap.map((r, idx) => (
                          <tr key={r.user.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-2 text-center font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                  {r.user.fullName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{r.user.fullName}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{r.user.nip}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">
                              {r.user.divisionName || '-'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {r.isFaceEnrolled ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] rounded-full font-medium gap-1">
                                  <CheckCircle2 size={10} className="text-emerald-600" />
                                  Aktif Terdaftar
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] rounded-full font-medium gap-1" title="Karyawan belum melakukan pendaftaran wajah biometrik (tidak berlaku mangkir/alpa).">
                                  <ShieldAlert size={10} className="text-amber-600" />
                                  Belum Registrasi Wajah
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono font-semibold text-foreground">
                              {r.isFaceEnrolled ? `${r.totalAttendances} Hari` : <span className="text-muted-foreground/40 font-normal">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {r.isFaceEnrolled ? (
                                r.lateCount > 0 ? (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] rounded-full">
                                    {r.lateCount}x ({r.totalLateMinutes}m)
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {r.isFaceEnrolled ? (
                                r.cutiCount > 0 ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] rounded-full">
                                    {r.cutiCount} Hari
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {r.isFaceEnrolled ? (
                                r.sakitCount > 0 ? (
                                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] rounded-full">
                                    {r.sakitCount} Hari
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono">
                              {r.isFaceEnrolled ? (
                                r.overtimeHours > 0 ? (
                                  <span className="font-bold text-orange-600">{r.overtimeHours} Jam</span>
                                ) : (
                                  <span className="text-muted-foreground/40">-</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/40">-</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-foreground">
                              {r.isFaceEnrolled ? `${r.totalWorkHours} Jam` : <span className="text-muted-foreground/40">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {r.isFaceEnrolled ? (
                                r.alpaCount > 0 ? (
                                  <Badge variant="destructive" className="text-[10px] rounded-full">
                                    {r.alpaCount} Hari
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                                )
                              ) : (
                                <span className="text-muted-foreground/40 font-mono text-[11px]" title="Tidak dikenakan alpa">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-[11px] rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10 font-medium"
                                onClick={() => {
                                  setSelectedCalendarUser(r.user);
                                  setCalendarModalOpen(true);
                                }}
                                title={`Buka Kalender Presensi Bulanan ${r.user.fullName}`}
                              >
                                <CalendarDays size={12} />
                                <span>Kalender</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            /* ── SUB-VIEW 2: RINCIAN LOG DETAIL HARIAN ── */
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <Card className="border-border bg-card rounded-xl shadow-sm">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="text"
                        placeholder="Cari karyawan, NIP..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 text-xs rounded-xl h-9"
                      />
                    </div>

                    <div>
                      <DatePicker
                        value={selectedDate}
                        onChange={(v) => setSelectedDate(v)}
                        placeholder="Filter tanggal spesifik..."
                      />
                    </div>

                    <div>
                      <Select value={filterDivision} onValueChange={setFilterDivision}>
                        <SelectTrigger className="text-xs rounded-xl h-9">
                          <SelectValue placeholder="Semua Divisi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Divisi</SelectItem>
                          {divisions.map((d) => (
                            <SelectItem key={d.id} value={d.name}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="text-xs rounded-xl h-9">
                          <SelectValue placeholder="Status Kehadiran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="hadir">Hadir Tepat Waktu</SelectItem>
                          <SelectItem value="terlambat">Terlambat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Rincian Data Log Presensi ({selectedMonthLabel})</h2>
                    <p className="text-xs text-muted-foreground">
                      Menampilkan {filteredList.length} data presensi sesuai kriteria filter
                    </p>
                  </div>
                  {selectedDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate('')}
                      className="text-xs text-muted-foreground hover:text-foreground h-8"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Tampilkan Semua Tanggal Bulan Ini
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Tanggal</th>
                        <th className="py-3 px-4 font-semibold">Karyawan</th>
                        <th className="py-3 px-4 font-semibold">Divisi</th>
                        <th className="py-3 px-4 font-semibold">Jam Masuk</th>
                        <th className="py-3 px-4 font-semibold">Jam Pulang</th>
                        <th className="py-3 px-4 font-semibold">Keterlambatan</th>
                        <th className="py-3 px-4 font-semibold">Disiplin Perimeter</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-muted-foreground">
                            Tidak ada data log presensi yang cocok dengan kriteria pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((a) => (
                          <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                              {a.attendanceDate}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-foreground">{a.userName}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{a.userNip}</p>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{a.divisionName || '-'}</td>
                            <td className="py-3 px-4 font-mono text-foreground font-medium">
                              {a.clockIn || '-'}
                            </td>
                            <td className="py-3 px-4 font-mono text-foreground">
                              {a.clockOut || '-'}
                            </td>
                            <td className="py-3 px-4">
                              {a.lateMinutes > 0 ? (
                                <span className="text-amber-600 font-medium">{a.lateMinutes} Menit</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {a.isPerimeterBreached || a.isLocked ? (
                                <Badge variant="outline" className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] gap-1 font-semibold">
                                  <ShieldAlert size={10} /> {a.perimeterBreachCount || 1}x Keluar
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-medium">✓ Patuh</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {a.status === 'hadir' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">Hadir</span>
                              ) : a.status === 'terlambat' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600">Terlambat</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">{a.status}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground max-w-xs truncate text-[11px]">
                              {a.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      ) : activeTab === 'overtime' ? (
        /* OVERTIME REPORT VIEW */
        <div className="space-y-6">
          {/* Overtime KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total Jam Lembur</p>
                  <Clock className="w-4 h-4 text-primary/70" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1 font-mono">
                  {totalOtHours} <span className="text-xs font-normal text-muted-foreground font-sans">Jam</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Dari {totalOtRecords} pengajuan lembur
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total Anggaran Lembur</p>
                  <Coins className="w-4 h-4 text-primary/70" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-primary mt-1 font-mono">
                  Rp {totalOtPay.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Estimasi kompensasi total
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Lembur Disetujui</p>
                  <CheckCheck className="w-4 h-4 text-emerald-600/70" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 font-mono">
                  Rp {approvedOtPay.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Siap diproses / dicairkan
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Realisasi Pencairan</p>
                  <Wallet className="w-4 h-4 text-primary/70" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 font-mono">
                  Rp {paidOtPay.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sudah masuk payroll / transfer
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Overtime Analytics Graphic */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border bg-card rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Distribusi Biaya & Jam Lembur Per Divisi
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Akumulasi total jam lembur yang dilakukan oleh karyawan pada setiap divisi
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={otDivisionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: string) => [
                          name === 'hours' ? `${value} Jam` : `Rp ${Number(value).toLocaleString('id-ID')}`,
                          name === 'hours' ? 'Total Jam Lembur' : 'Total Biaya (Rp)',
                        ]}
                      />
                      <Bar dataKey="hours" fill="#0d9488" radius={[4, 4, 0, 0]} name="hours" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" /> Status Finansial Lembur
                </CardTitle>
                <CardDescription className="text-xs">
                  Ringkasan alokasi & status antrean
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending Persetujuan:
                    </span>
                    <span className="font-bold font-mono text-foreground">{pendingOtCount} Pengajuan</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Total Disetujui:
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {filteredOtList.filter((o) => o.status === 'approved').length} Pengajuan
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Ditolak / Tidak Sah:
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {filteredOtList.filter((o) => o.status === 'rejected').length} Pengajuan
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                  <p className="text-[11px] font-semibold text-primary">Rata-rata Tarif & Kompensasi</p>
                  <p className="text-xs text-foreground">
                    Rata-rata per pengajuan: <span className="font-bold font-mono">Rp {filteredOtList.length ? Math.round(totalOtPay / filteredOtList.length).toLocaleString('id-ID') : 0}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Tarif dasar lembur: Rp 25.000 / jam (2.0x saat akhir pekan)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overtime Filter Toolbar */}
          <Card className="border-border bg-card rounded-xl shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Cari karyawan, NIP, tugas..."
                    value={otSearchQuery}
                    onChange={(e) => setOtSearchQuery(e.target.value)}
                    className="pl-9 text-xs rounded-xl h-9"
                  />
                </div>

                {/* Filter Tanggal */}
                <div>
                  <DatePicker
                    value={selectedOtDate}
                    onChange={(v) => setSelectedOtDate(v)}
                    placeholder="Filter tanggal..."
                  />
                </div>

                {/* Filter Divisi */}
                <div>
                  <Select value={filterOtDivision} onValueChange={setFilterOtDivision}>
                    <SelectTrigger className="text-xs rounded-xl h-9">
                      <SelectValue placeholder="Semua Divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Divisi</SelectItem>
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status Approval */}
                <div>
                  <Select value={filterOtStatus} onValueChange={setFilterOtStatus}>
                    <SelectTrigger className="text-xs rounded-xl h-9">
                      <SelectValue placeholder="Status Persetujuan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status Approval</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Disetujui</SelectItem>
                      <SelectItem value="rejected">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Status Pembayaran */}
                <div>
                  <Select value={filterOtPayment} onValueChange={setFilterOtPayment}>
                    <SelectTrigger className="text-xs rounded-xl h-9">
                      <SelectValue placeholder="Status Pencairan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Pencairan</SelectItem>
                      <SelectItem value="unpaid">Belum Cair</SelectItem>
                      <SelectItem value="included_in_payroll">Masuk Slip Gaji</SelectItem>
                      <SelectItem value="paid">Sudah Ditransfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Realtime Current Month Lateness Recap Card */}
          <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Rekapitulasi Keterlambatan Bulan {selectedMonthLabel}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitoring akumulasi menit keterlambatan terhadap batas toleransi shift dan estimasi potongan denda payroll.
                </p>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px] font-mono">
                {selectedMonth === currentMonthStr ? 'Real-Time' : 'Arsip Bulanan'}
              </Badge>
            </div>

            <CardContent className="p-4 space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-muted-foreground text-xs block">Karyawan Terlambat</span>
                  <span className="text-lg font-bold text-foreground font-mono">{employeeLatenessList.length} Orang</span>
                  <span className="text-[10px] text-muted-foreground block">({lateRecordsMonth.length} kali kejadian di {selectedMonthLabel})</span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-muted-foreground text-xs block">Akumulasi Keterlambatan</span>
                  <span className="text-lg font-bold text-amber-600 font-mono">{totalLateMinutesMonth} Menit</span>
                  <span className="text-[10px] text-muted-foreground block">Melebihi batas toleransi shift</span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                  <span className="text-muted-foreground text-xs block">Estimasi Potongan Denda Payroll</span>
                  <span className="text-lg font-bold text-rose-600 font-mono">Rp {totalEstimatedDeduction.toLocaleString('id-ID')}</span>
                  <span className="text-[10px] text-muted-foreground block">@Rp 1.000 / menit keterlambatan</span>
                </div>
              </div>

              {/* Lateness Detail Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Karyawan</th>
                      <th className="py-2.5 px-3 font-semibold">Divisi</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Frekuensi Telat</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Total Menit</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Estimasi Potongan (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employeeLatenessList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          Luar biasa! Tidak ada catatan keterlambatan di {selectedMonthLabel}.
                        </td>
                      </tr>
                    ) : (
                      employeeLatenessList.map((emp) => (
                        <tr key={emp.userNip} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-foreground block">{emp.userName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{emp.userNip}</span>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{emp.divisionName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                              {emp.lateCount}x Kejadian
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                            {emp.totalLateMinutes} mnt
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                            Rp {(emp.totalLateMinutes * 1000).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Overtime Detailed Table */}
          <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Rincian Perhitungan Lembur Karyawan</h2>
                <p className="text-xs text-muted-foreground">
                  Menampilkan {filteredOtList.length} data lembur terfilter
                </p>
              </div>
              {selectedOtDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOtDate('')}
                  className="text-xs text-muted-foreground hover:text-foreground h-8"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Reset Tanggal
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Tanggal & Hari</th>
                    <th className="py-3 px-4 font-semibold">Karyawan</th>
                    <th className="py-3 px-4 font-semibold">Divisi</th>
                    <th className="py-3 px-4 font-semibold">Waktu & Durasi</th>
                    <th className="py-3 px-4 font-semibold">Tarif / Jam</th>
                    <th className="py-3 px-4 font-semibold">Total Uang Lembur</th>
                    <th className="py-3 px-4 font-semibold">Tugas & Aktivitas</th>
                    <th className="py-3 px-4 font-semibold">Approval</th>
                    <th className="py-3 px-4 font-semibold">Pencairan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOtList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Tidak ada catatan lembur yang sesuai dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOtList.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                          <div>{o.date}</div>
                          {o.isWeekendHoliday ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[9px] mt-0.5">
                              Akhir Pekan (2x)
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Hari Kerja</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-foreground">{o.userName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{o.userNip}</p>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{o.divisionName || '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono text-foreground font-medium">{o.startTime} - {o.endTime}</div>
                          <div className="text-[10px] text-primary font-medium">{o.durationHours} Jam Lembur</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono text-foreground">Rp {Number(o.hourlyRate ?? o.rateApplied ?? 30000).toLocaleString('id-ID')}</div>
                          <div className="text-[10px] text-muted-foreground">Mult: {o.rateMultiplier || 1}x</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-primary">
                          Rp {Number(o.totalPay ?? o.compensationAmount ?? 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                          {o.taskDescription}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {o.status === 'approved' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
                              Disetujui
                            </span>
                          ) : o.status === 'rejected' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600">
                              Ditolak
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {o.paymentStatus === 'paid' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                              Ditransfer
                            </span>
                          ) : o.paymentStatus === 'included_in_payroll' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600">
                              Slip Gaji
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                              Belum Cair
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* LEAVE & OVERTIME LIABILITY VIEW (PER EMPLOYEE, PER DIVISION & COMPANY-WIDE) */
        <HrmLeaveOvertimeLiabilityView />
      )}

      {/* Professional Formal Print Dialog Modal */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent className="max-w-4xl rounded-2xl max-h-[92vh] overflow-y-auto p-0">
          {/* Action Bar inside modal */}
          <div className="p-4 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 bg-background/95 backdrop-blur z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pratinjau Cetak Dokumen Resmi</h3>
                <p className="text-[11px] text-muted-foreground">Tata letak formal A4 siap cetak atau disimpan sebagai PDF</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Tutup
              </Button>
              <Button
                size="sm"
                onClick={handlePrintDocument}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 rounded-xl shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Sekarang (Print / PDF)
              </Button>
            </div>
          </div>

          {/* PRINTABLE OFFICIAL DOCUMENT SHEET */}
          <div id="printable-report-sheet" className="p-8 sm:p-12 bg-white text-slate-900 font-sans space-y-6">
            {/* KOP SURAT FORMAL */}
            <div className="flex items-center gap-5 pb-3">
              <img
                src={appSettings.logoUrl || defaultLogo}
                alt="Logo Instansi"
                className="w-20 h-20 object-contain shrink-0"
              />
              <div className="flex-1 text-center pr-10">
                <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900 leading-snug">
                  {appSettings.appName || 'HRM ATTENDANCE SYSTEM'}
                </h2>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  DEPARTEMEN SUMBER DAYA MANUSIA & MANAJEMEN OPERASIONAL
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {office.address || 'Gedung Graha HRM, Jl. Jenderal Sudirman Kav. 52-53, Jakarta'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Telp: (021) 555-0199 • Email: hrd@perusahaan.local • Web: www.hrm-system.local
                </p>
              </div>
            </div>

            {/* GARIS GANDA KOP SURAT */}
            <div className="border-t-2 border-slate-900 pt-0.5">
              <div className="border-t border-slate-700" />
            </div>

            {/* JUDUL DOKUMEN & METADATA */}
            <div className="text-center py-2 space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider underline text-slate-900">
                LAPORAN REKAPITULASI PRESENSI & KEDISIPLINAN PEGAWAI
              </h3>
              <p className="text-[11px] font-mono text-slate-600">
                Nomor Berkas: HRM/LAP-PRES/{selectedDate ? selectedDate.replace(/-/g, '') : 'ALL'}/{totalRecords}
              </p>
            </div>

            {/* TABEL KETERANGAN PERIODE */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <p><span className="text-slate-500 font-medium">Periode Tanggal:</span> <strong className="text-slate-800">{selectedDate || 'Semua Periode'}</strong></p>
                <p><span className="text-slate-500 font-medium">Unit Kerja / Divisi:</span> <strong className="text-slate-800">{filterDivision === 'all' ? 'Seluruh Divisi' : filterDivision}</strong></p>
              </div>
              <div className="text-right">
                <p><span className="text-slate-500 font-medium">Waktu Cetak:</span> <strong className="text-slate-800">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
                <p><span className="text-slate-500 font-medium">Dicetak Oleh:</span> <strong className="text-slate-800">{user?.fullName || 'Administrator'} ({user?.nip})</strong></p>
              </div>
            </div>

            {/* RINGKASAN DATA STATISTIK */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 border border-slate-200 rounded">
                <p className="text-[10px] text-slate-500 uppercase">Total Kehadiran</p>
                <p className="font-bold text-sm text-slate-900">{totalRecords} Orang</p>
              </div>
              <div className="p-2 border border-slate-200 rounded">
                <p className="text-[10px] text-slate-500 uppercase">Tepat Waktu</p>
                <p className="font-bold text-sm text-teal-700">{onTimeCount} Orang</p>
              </div>
              <div className="p-2 border border-slate-200 rounded">
                <p className="text-[10px] text-slate-500 uppercase">Terlambat</p>
                <p className="font-bold text-sm text-amber-700">{lateCount} Orang</p>
              </div>
              <div className="p-2 border border-slate-200 rounded">
                <p className="text-[10px] text-slate-500 uppercase">Total Jam Kerja</p>
                <p className="font-bold text-sm text-slate-900">{totalWorkHours} Jam</p>
              </div>
            </div>

            {/* TABEL DATA FORMAL */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center w-8">No</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Tanggal</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">NIP</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Nama Karyawan</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Divisi</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Masuk</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Pulang</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Durasi</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Terlambat</th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center">Perimeter</th>
                    <th className="py-2 px-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-4 text-center text-slate-500 italic">
                        Tidak ada catatan presensi pada kriteria ini.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((a, idx) => (
                      <tr key={a.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-mono text-[10px]">{a.attendanceDate}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-mono text-[10px]">{a.userNip}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-medium">{a.userName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-[10px]">{a.divisionName || '-'}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-mono text-[10px]">{a.clockIn || '-'}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-mono text-[10px]">{a.clockOut || '-'}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center text-[10px]">
                          {Math.floor((a.workDurationMinutes || 0) / 60)}j {(a.workDurationMinutes || 0) % 60}m
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center text-[10px]">
                          {a.lateMinutes > 0 ? `${a.lateMinutes} mnt` : '-'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center text-[10px] font-medium">
                          {a.isPerimeterBreached ? (
                            <span className="text-rose-600 font-bold">⚠️ Melanggar</span>
                          ) : (
                            <span className="text-emerald-700">Patuh</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center text-[10px] uppercase font-semibold">
                          {a.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* BLOK TANDA TANGAN FORMAL */}
            <div className="pt-8 grid grid-cols-2 text-center text-xs">
              {/* Kolom Pimpinan */}
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-900">Mengetahui / Menyetujui,</p>
                  <p className="text-slate-600 text-[11px]">Pimpinan / Direktur Operasional</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900 text-xs">{leaderSignName}</p>
                  <p className="text-[10px] text-slate-500">NIP: DIR-2024-001</p>
                </div>
              </div>

              {/* Kolom HRD */}
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-900">
                    Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-slate-600 text-[11px]">Dibuat Oleh: HRD & Personalia</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900 text-xs">{hrdSignName}</p>
                  <p className="text-[10px] text-slate-500">NIP: {user?.nip || 'HRD-001'}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                Total {filteredList.length} baris data disiapkan untuk cetak.
              </span>
              <Button
                onClick={handlePrintDocument}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 rounded-xl shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Dokumen / Unduh PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Professional Formal Overtime Print Dialog Modal */}
      <Dialog open={otPrintModalOpen} onOpenChange={setOtPrintModalOpen}>
        <DialogContent className="max-w-4xl rounded-2xl max-h-[92vh] overflow-y-auto p-0">
          {/* Action Bar inside modal */}
          <div className="p-4 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 bg-background/95 backdrop-blur z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pratinjau Cetak Dokumen Rekapitulasi Lembur</h3>
                <p className="text-[11px] text-muted-foreground">Tata letak formal A4 siap cetak dan pertanggungjawaban pencairan anggaran</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOtPrintModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Tutup
              </Button>
              <Button
                size="sm"
                onClick={handlePrintDocument}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 rounded-xl shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Sekarang (Print / PDF)
              </Button>
            </div>
          </div>

          {/* PRINTABLE OFFICIAL OVERTIME SHEET */}
          <div id="printable-overtime-sheet" className="p-8 sm:p-12 bg-white text-slate-900 font-sans space-y-6">
            {/* KOP SURAT FORMAL */}
            <div className="flex items-center gap-5 pb-3">
              <img
                src={appSettings.logoUrl || defaultLogo}
                alt="Logo Instansi"
                className="w-20 h-20 object-contain shrink-0"
              />
              <div className="flex-1 text-center pr-10">
                <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900 leading-snug">
                  {appSettings.appName || 'HRM ATTENDANCE SYSTEM'}
                </h2>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  DEPARTEMEN SUMBER DAYA MANUSIA & KEUANGAN OPERASIONAL
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {office.address || 'Gedung Graha HRM, Jl. Jenderal Sudirman Kav. 52-53, Jakarta'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Telp: (021) 555-0199 • Email: hrd@perusahaan.local • Web: www.hrm-system.local
                </p>
              </div>
            </div>

            {/* GARIS PEMISAH KOP SURAT GANDA */}
            <div className="border-t-2 border-slate-900 pt-0.5 border-b border-slate-400" />

            {/* JUDUL DAN META DOKUMEN */}
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 underline">
                BERITA ACARA REKAPITULASI BIAYA & SURAT PERINTAH KERJA LEMBUR
              </h3>
              <p className="text-[11px] text-slate-600 font-mono">
                Nomor Dokumen: SPL/BIAYA/{new Date().getFullYear()}/{String(new Date().getMonth() + 1).padStart(2, '0')}/HRM
              </p>
            </div>

            {/* INFO PERIODE & FILTER */}
            <div className="grid grid-cols-2 text-xs border border-slate-300 rounded-lg p-3 bg-slate-50 text-slate-700">
              <div className="space-y-1">
                <p>
                  <span className="font-semibold text-slate-900">Periode Lembur:</span>{' '}
                  {selectedOtDate || 'Semua Tanggal Catatan'}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Filter Departemen / Divisi:</span>{' '}
                  {filterOtDivision === 'all' ? 'Seluruh Divisi Terdaftar' : filterOtDivision}
                </p>
              </div>
              <div className="space-y-1 text-right sm:text-left">
                <p>
                  <span className="font-semibold text-slate-900">Tanggal Cetak:</span>{' '}
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Total Pengajuan Lembur:</span>{' '}
                  {filteredOtList.length} Catatan ({totalOtHours} Jam Total)
                </p>
              </div>
            </div>

            {/* TABEL DATA FORMAL */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[10.5px] border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900 uppercase tracking-tight">
                  <tr>
                    <th className="py-2 px-2.5 text-center border-r border-slate-300 w-8">No</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Tanggal</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">NIP & Nama Karyawan</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Divisi</th>
                    <th className="py-2 px-2.5 text-center border-r border-slate-300">Waktu</th>
                    <th className="py-2 px-2.5 text-center border-r border-slate-300">Durasi</th>
                    <th className="py-2 px-2.5 text-right border-r border-slate-300">Tarif / Jam</th>
                    <th className="py-2 px-2.5 text-right border-r border-slate-300">Uang Lembur (Rp)</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Uraian Tugas</th>
                    <th className="py-2 px-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOtList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-500 italic">
                        Tidak ada data rekapan lembur yang memenuhi kriteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOtList.map((o, idx) => (
                      <tr key={o.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-2 px-2 text-center border-r border-slate-200 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 font-mono whitespace-nowrap">
                          {o.date}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200">
                          <p className="font-semibold text-slate-900">{o.userName}</p>
                          <p className="text-[9.5px] text-slate-500 font-mono">{o.userNip}</p>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200">{o.divisionName || '-'}</td>
                        <td className="py-2 px-2 text-center border-r border-slate-200 font-mono text-[10px] whitespace-nowrap">
                          {o.startTime} - {o.endTime}
                        </td>
                        <td className="py-2 px-2 text-center border-r border-slate-200 font-mono font-medium">
                          {o.durationHours} Jam
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200 font-mono whitespace-nowrap">
                          Rp {Number(o.hourlyRate ?? o.rateApplied ?? 30000).toLocaleString('id-ID')}
                          {o.rateMultiplier > 1 && <span className="text-[9px] text-amber-700 ml-1">({o.rateMultiplier}x)</span>}
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                          Rp {Number(o.totalPay ?? o.compensationAmount ?? 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 max-w-xs text-[10px] text-slate-600">
                          {o.taskDescription}
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${
                            o.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : o.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {o.status === 'approved' ? 'DISETUJUI' : o.status === 'rejected' ? 'DITOLAK' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* RINGKASAN BIAYA ANGGARAN */}
            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50 space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Catatan</p>
                  <p className="font-bold text-slate-900 text-sm font-mono">{filteredOtList.length} Pengajuan</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Jam Kerja</p>
                  <p className="font-bold text-slate-900 text-sm font-mono">{totalOtHours} Jam</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Biaya Lembur Sah</p>
                  <p className="font-bold text-emerald-800 text-sm font-mono">Rp {Number(approvedOtPay || 0).toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Total Nilai Anggaran</p>
                  <p className="font-bold text-slate-900 text-base font-mono">Rp {Number(totalOtPay || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
            </div>

            {/* BLOK TANDA TANGAN FORMAL 3 PIHAK */}
            <div className="pt-8 grid grid-cols-3 text-center text-xs">
              {/* Kolom Pimpinan */}
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-900">Mengetahui & Menyetujui,</p>
                  <p className="text-slate-600 text-[11px]">Direktur Operasional</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900 text-xs">{leaderSignName}</p>
                  <p className="text-[10px] text-slate-500">NIP: DIR-2024-001</p>
                </div>
              </div>

              {/* Kolom Keuangan */}
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-900">Diverifikasi Oleh,</p>
                  <p className="text-slate-600 text-[11px]">Bagian Keuangan / Payroll</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900 text-xs">{financeSignName}</p>
                  <p className="text-[10px] text-slate-500">NIP: KEU-2024-012</p>
                </div>
              </div>

              {/* Kolom HRD */}
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-900">
                    Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-slate-600 text-[11px]">Dibuat Oleh: HRD & Personalia</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900 text-xs">{hrdSignName}</p>
                  <p className="text-[10px] text-slate-500">NIP: {user?.nip || 'HRD-001'}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                Total {filteredOtList.length} baris rekapan lembur disiapkan untuk cetak.
              </span>
              <Button
                onClick={handlePrintDocument}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 rounded-xl shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Dokumen / Unduh PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Form ABSEN/SPL Modal */}
      <HrmAbsenSplModal
        isOpen={absenSplModalOpen}
        onClose={() => setAbsenSplModalOpen(false)}
        employees={employees}
        attendances={attendances}
        overtimes={overtimes}
      />

      {/* Modal Kalender Presensi Bulanan Karyawan */}
      <HrmEmployeeMonthlyCalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        user={selectedCalendarUser}
        initialMonth={selectedMonth}
        attendances={attendances}
        allShifts={allShifts}
      />
    </div>
  );
};
