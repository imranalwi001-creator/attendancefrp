import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Coins,
  FileSpreadsheet,
  FileText,
  Search,
  ShieldCheck,
  TrendingUp,
  Clock,
  Layers,
  Building2,
  Users,
  CheckCircle2,
  Calendar,
  Briefcase,
  AlertTriangle,
  UserCheck,
  Percent,
  CalendarDays,
  Sparkles,
  Download,
} from 'lucide-react';
import { UserProfile, OvertimeRecord, AttendanceRecord, EmployeeSchedule, LeaveRequest, isOfficialFrEmployee } from '@/types/hrm';
import { getTodayDateStr } from '@/services/hrmService';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  overtimes: OvertimeRecord[];
  attendances?: AttendanceRecord[];
  schedules?: EmployeeSchedule[];
  leaves?: LeaveRequest[];
  initialMonth?: string;
}

export const HrmMonthlyFinancialRecapModal: React.FC<Props> = ({
  isOpen,
  onClose,
  users,
  overtimes: initialOvertimes,
  attendances = [],
  schedules = [],
  leaves = [],
  initialMonth,
}) => {
  const todayStr = getTodayDateStr();
  const currentMonthStr = todayStr.slice(0, 7); // 'YYYY-MM'

  const [activeTab, setActiveTab] = useState<'attendance_matrix' | 'budget_80' | 'employee_overtime' | 'payroll_recap' | 'division_overtime'>('attendance_matrix');
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<'ALL' | 'SHIPMENT' | 'RUMAH TANGGA'>('ALL');
  const [filterOnlyWithOvertime, setFilterOnlyWithOvertime] = useState<boolean>(false);

  // Live overtimes state tersinkron dari PostgreSQL
  const [liveOvertimes, setLiveOvertimes] = useState<any[]>(initialOvertimes || []);

  // Sinkronisasi prop initialOvertimes jika berubah
  useEffect(() => {
    if (initialOvertimes && initialOvertimes.length > 0) {
      setLiveOvertimes(initialOvertimes);
    }
  }, [initialOvertimes]);

  // Fetch data lembur terbaru dari PostgreSQL saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (initialMonth) setSelectedMonth(initialMonth);
      fetch('/api/overtime')
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setLiveOvertimes(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialMonth]);

  // Format label bulan terpilih (contoh: "November 2026")
  const selectedMonthLabel = useMemo(() => {
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      return dt.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Filter 80 Karyawan Resmi Operasional Sah PT FRP
  const officialEmps = useMemo(() => {
    return users.filter((u) => u.isActive && isOfficialFrEmployee(u));
  }, [users]);

  // Helper normalisasi record lembur (PostgreSQL snake_case & camelCase)
  const normalizedOvertimes = useMemo(() => {
    return (liveOvertimes || []).map((o: any) => ({
      ...o,
      id: o.id,
      userId: o.userId || o.user_id,
      userNip: o.userNip || o.user_nip || o.employeeNip,
      userName: o.userName || o.user_name,
      divisionName: o.divisionName || o.division_name,
      date: String(o.date || o.overtimeDate || o.overtime_date || o.createdAt || o.created_at || '').slice(0, 10),
      startTime: o.startTime || o.start_time,
      endTime: o.endTime || o.end_time,
      durationHours: Number(o.durationHours || o.duration_hours || 0),
      approvedHours: Number(o.approvedHours ?? o.approved_hours ?? o.durationHours ?? o.duration_hours ?? 0),
      compensationAmount: Number(o.compensationAmount ?? o.compensation_amount ?? o.totalPay ?? o.total_pay ?? 0),
      taskDescription: o.taskDescription || o.task_description || '',
      status: o.status || 'pending',
      source: o.source || '',
    }));
  }, [liveOvertimes]);

  // ─── 1. PERHITUNGAN LENGKAP DETAIL BULANAN PER KARYAWAN ───
  const employeeFinancialList = useMemo(() => {
    return officialEmps.map((u, idx) => {
      const isWisma =
        (u.operationalGroup || '').toUpperCase().includes('RUMAH TANGGA') ||
        (u.divisionName && u.divisionName.toLowerCase().includes('wisma')) ||
        (u.divisionName && u.divisionName.toLowerCase().includes('rumah tangga')) ||
        (u.nip && parseInt(u.nip.replace(/\D/g, ''), 10) <= 33);

      const opGroup: 'RUMAH TANGGA' | 'SHIPMENT' = isWisma ? 'RUMAH TANGGA' : 'SHIPMENT';

      const isFaceEnrolled = Boolean(
        u.isFaceEnrolled ||
        u.faceEnrolledPhoto ||
        (u.faceDescriptor && (u.faceDescriptor as any).length > 0) ||
        (u as any).is_face_enrolled
      );

      // Normalisasi NIP untuk pencocokan presensi
      const uNipNorm = (u.nip || '').replace(/[\s.]/g, '').toUpperCase();

      // Filter presensi karyawan di bulan terpilih
      const userMonthAtts = attendances.filter((a) => {
        const aNipNorm = (a.userNip || '').replace(/[\s.]/g, '').toUpperCase();
        const isUserMatch =
          (a.userId && u.id && a.userId === u.id) ||
          (uNipNorm && aNipNorm && uNipNorm === aNipNorm) ||
          a.userId === u.nip ||
          (a.userNip && a.userNip === u.nip);
        const aDate = a.attendanceDate || (a as any).date;
        return isUserMatch && aDate && aDate.startsWith(selectedMonth);
      });

      // Filter Cuti & Sakit dari data Leaves yang telah disetujui untuk bulan terpilih
      const userMonthLeaves = leaves.filter((l) => {
        const lNipNorm = ((l as any).userNip || '').replace(/[\s.]/g, '').toUpperCase();
        const isUserMatch =
          (l.userId && u.id && l.userId === u.id) ||
          (uNipNorm && lNipNorm && uNipNorm === lNipNorm) ||
          l.userId === u.nip ||
          ((l as any).userNip && (l as any).userNip === u.nip);
        const inMonth = (l.startDate && l.startDate.startsWith(selectedMonth)) || (l.endDate && l.endDate.startsWith(selectedMonth));
        return isUserMatch && inMonth && l.status === 'approved';
      });

      // Hitung Hari Cuti, Sakit, Izin bebas duplikasi tanggal
      const cutiDates = new Set<string>();
      const sakitDates = new Set<string>();
      const izinDates = new Set<string>();
      const hadirDates = new Set<string>();
      const telatDates = new Set<string>();
      let totalLateMinutes = 0;

      userMonthAtts.forEach((a) => {
        const dt = a.attendanceDate || (a as any).date;
        if (!dt) return;
        if (a.clockIn || a.status === 'hadir' || a.status === 'terlambat') {
          hadirDates.add(dt);
        }
        if (a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0)) {
          telatDates.add(dt);
          totalLateMinutes += Number(a.lateMinutes || 0);
        }
        if (a.status === 'cuti') cutiDates.add(dt);
        if (a.status === 'sakit') sakitDates.add(dt);
        if (a.status === 'izin') izinDates.add(dt);
      });

      userMonthLeaves.forEach((l) => {
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

      const hadirCount = hadirDates.size;
      const telatCount = telatDates.size;
      const tepatWaktuCount = Math.max(0, hadirCount - telatCount);
      const cutiCount = cutiDates.size;
      const sakitCount = sakitDates.size;
      const izinCount = izinDates.size;

      // Alpa dihitung dari presensi status alpa/mangkir
      const alpaCount = userMonthAtts.filter(
        (a) => a.status === 'alpa' || a.status === 'alfa' || (a as any).absentSubtype === 'mangkir'
      ).length;

      // Libur / OFF
      const offCount = userMonthAtts.filter(
        (a) => a.status === 'off' || (a as any).absentSubtype === 'off'
      ).length;

      // Persentase Kehadiran & Rasio Disiplin
      const totalEvaluatedDays = hadirCount + alpaCount + izinCount + sakitCount;
      const attendanceRate = totalEvaluatedDays > 0 ? Math.round((hadirCount / totalEvaluatedDays) * 100) : (isFaceEnrolled ? 100 : 0);
      const punctualityRate = hadirCount > 0 ? Math.round((tepatWaktuCount / hadirCount) * 100) : 100;

      // Kuota Cuti (Baku 12 Hari - Use-It-Or-Lose-It)
      const annualLeaveQuota = 12;
      const remainingLeave = Math.max(0, annualLeaveQuota - cutiCount);

      // ── Lembur Bulan Terpilih ──
      const userMonthOts = normalizedOvertimes.filter(
        (o) => (o.userId === u.id || o.userNip === u.nip) && o.date.startsWith(selectedMonth) && (o.status === 'approved' || o.status === 'completed')
      );
      const monthOtHours = userMonthOts.reduce((sum, o) => sum + o.approvedHours, 0);
      const monthOtPay = userMonthOts.reduce(
        (sum, o) => sum + (o.compensationAmount || (o.approvedHours * 23381.79)),
        0
      );
      const spklCount = userMonthOts.length;

      // Rincian string per tanggal lembur
      const otDateDetails = userMonthOts
        .map((o) => `${o.date.slice(8, 10)} ${selectedMonthLabel.slice(0, 3)}: ${o.approvedHours}J (Rp ${Math.round(o.compensationAmount || (o.approvedHours * 23381.79)).toLocaleString('id-ID')})`)
        .join(', ');

      // ── Lembur Hari Ini (Live Overtime jika selectedMonth adalah bulan berjalan) ──
      const todayApprovedOts = normalizedOvertimes.filter(
        (o) => (o.userId === u.id || o.userNip === u.nip) && o.date === todayStr && (o.status === 'approved' || o.status === 'completed')
      );
      const todayOtHours = todayApprovedOts.reduce((sum, o) => sum + o.approvedHours, 0);
      const todayOtPay = todayApprovedOts.reduce(
        (sum, o) => sum + (o.compensationAmount || (o.approvedHours * 23381.79)),
        0
      );
      const isTodayRelief = todayApprovedOts.some(
        (o) => o.source === 'shift_relief' || o.source === 'relief_duty'
      );

      // ── Jadwal Shift Hari Ini ──
      const userSched = schedules.find((s) => s.userId === u.id && s.scheduleDate === todayStr);
      const shiftName = userSched?.shiftName || u.shiftName || 'Day Shift (07:30 - 16:30)';
      const isShiftOff = userSched?.isOff === true || userSched?.shiftCode === 'OFF';

      // ── Standar Remunerasi Resmi PT FRP (Rule 7 & 8 AGENTS.md) ──
      // - Upah Pokok Tunggal: Standar Rp 4.045.050 (Tanpa Tunjangan)
      // - Potongan Baku BPJS: TK 3% (Rp 121.351) + Kes 1% (Rp 40.450) = Rp 161.802
      // - PPh 21 = Rp 0
      const baseSalary = u.baseSalary || 4045050;
      const bpjsTk = Math.round(baseSalary * 0.03); // Rp 121.351
      const bpjsKes = Math.round(baseSalary * 0.01); // Rp 40.450
      const totalBpjs = bpjsTk + bpjsKes; // Rp 161.802

      // Potongan Mangkir / Alpa di Bulan Terpilih
      const alpaDeduction = alpaCount * Math.round(baseSalary / 22);

      // Gaji Bersih Realtime (Take Home Pay)
      const netSalary = Math.round(baseSalary - totalBpjs - alpaDeduction + monthOtPay);

      return {
        sequenceNo: idx + 1,
        userId: u.id,
        name: u.fullName,
        nip: u.nip,
        divisionName: u.divisionName || (isWisma ? 'Wisma Biring Ere' : 'Shiftman Lapangan'),
        opGroup,
        isFaceEnrolled,
        shiftName: isShiftOff ? 'Libur / OFF' : shiftName,
        isShiftOff,
        hadirCount,
        tepatWaktuCount,
        telatCount,
        totalLateMinutes,
        cutiCount,
        remainingLeave,
        sakitCount,
        izinCount,
        alpaCount,
        offCount,
        attendanceRate,
        punctualityRate,
        todayOtHours,
        todayOtPay: Math.round(todayOtPay),
        isTodayRelief,
        monthOtHours,
        monthOtPay: Math.round(monthOtPay),
        spklCount,
        otDateDetails: otDateDetails || '-',
        rawOts: userMonthOts,
        baseSalary,
        bpjsTk,
        bpjsKes,
        totalBpjs,
        alpaDeduction,
        netSalary,
      };
    });
  }, [officialEmps, normalizedOvertimes, schedules, attendances, leaves, todayStr, selectedMonth, selectedMonthLabel]);

  // ─── 2. REKAPAN LEMBUR & KINERJA PER DIVISI ───
  const divisionRecap = useMemo(() => {
    const map = new Map<string, {
      divisionName: string;
      opGroup: string;
      totalEmployees: number;
      hadirSum: number;
      telatSum: number;
      overtimeEmployeeCount: number;
      totalSpklCount: number;
      totalHours: number;
      totalPay: number;
    }>();

    employeeFinancialList.forEach((emp) => {
      const div = emp.divisionName || 'Operasional Lapangan';
      if (!map.has(div)) {
        map.set(div, {
          divisionName: div,
          opGroup: emp.opGroup,
          totalEmployees: 0,
          hadirSum: 0,
          telatSum: 0,
          overtimeEmployeeCount: 0,
          totalSpklCount: 0,
          totalHours: 0,
          totalPay: 0,
        });
      }
      const entry = map.get(div)!;
      entry.totalEmployees += 1;
      entry.hadirSum += emp.hadirCount;
      entry.telatSum += emp.telatCount;
      if (emp.monthOtHours > 0) {
        entry.overtimeEmployeeCount += 1;
        entry.totalSpklCount += emp.spklCount;
        entry.totalHours += emp.monthOtHours;
        entry.totalPay += emp.monthOtPay;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPay - a.totalPay);
  }, [employeeFinancialList]);

  // Filter list karyawan sesuai pencarian dan grup
  const filteredList = useMemo(() => {
    return employeeFinancialList.filter((item) => {
      const matchGroup = selectedGroup === 'ALL' || item.opGroup === selectedGroup;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.nip.toLowerCase().includes(q) ||
        item.divisionName.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [employeeFinancialList, selectedGroup, search]);

  // Filter list karyawan untuk Tab Lembur
  const filteredEmployees = useMemo(() => {
    return employeeFinancialList.filter((item) => {
      const matchGroup = selectedGroup === 'ALL' || item.opGroup === selectedGroup;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.nip.toLowerCase().includes(q) ||
        item.divisionName.toLowerCase().includes(q);
      const matchOtOnly = !filterOnlyWithOvertime || item.monthOtHours > 0;
      return matchGroup && matchSearch && matchOtOnly;
    });
  }, [employeeFinancialList, selectedGroup, search, filterOnlyWithOvertime]);

  // Filter divisi
  const filteredDivisions = useMemo(() => {
    const q = search.toLowerCase();
    return divisionRecap.filter((d) => {
      const matchGroup = selectedGroup === 'ALL' || d.opGroup === selectedGroup;
      const matchSearch = !q || d.divisionName.toLowerCase().includes(q) || d.opGroup.toLowerCase().includes(q);
      return matchGroup && matchSearch;
    });
  }, [divisionRecap, selectedGroup, search]);

  // Agregasi Finansial Seluruh Karyawan & Budget Monitoring PT FRP
  const summary = useMemo(() => {
    const TOTAL_BUDGET_CAP = 76000000;
    const SHIPMENT_BUDGET_CAP = 72000000;
    const WISMA_BUDGET_CAP = 4000000;

    let totalBaseSal = 0;
    let totalBpjs = 0;
    let totalAlpaDed = 0;
    let totalOtPay = 0;
    let totalOtHours = 0;
    let totalNetSal = 0;
    let totalSpklCount = 0;
    let employeesWithOtCount = 0;

    let shipmentOtPay = 0;
    let shipmentOtHours = 0;
    let wismaOtPay = 0;
    let wismaOtHours = 0;

    let totalHadirDays = 0;
    let totalTelatDays = 0;
    let totalTelatMinutes = 0;
    let totalCutiDays = 0;
    let totalSakitDays = 0;
    let totalIzinDays = 0;
    let totalAlpaDays = 0;

    employeeFinancialList.forEach((row) => {
      totalBaseSal += row.baseSalary;
      totalBpjs += row.totalBpjs;
      totalAlpaDed += row.alpaDeduction;
      totalOtPay += row.monthOtPay;
      totalOtHours += row.monthOtHours;
      totalNetSal += row.netSalary;
      totalSpklCount += row.spklCount;

      totalHadirDays += row.hadirCount;
      totalTelatDays += row.telatCount;
      totalTelatMinutes += row.totalLateMinutes;
      totalCutiDays += row.cutiCount;
      totalSakitDays += row.sakitCount;
      totalIzinDays += row.izinCount;
      totalAlpaDays += row.alpaCount;

      if (row.monthOtHours > 0) {
        employeesWithOtCount += 1;
      }

      if (row.opGroup === 'RUMAH TANGGA') {
        wismaOtPay += row.monthOtPay;
        wismaOtHours += row.monthOtHours;
      } else {
        shipmentOtPay += row.monthOtPay;
        shipmentOtHours += row.monthOtHours;
      }
    });

    const totalBurnPct = Math.min(100, (totalOtPay / TOTAL_BUDGET_CAP) * 100);
    const shipmentBurnPct = Math.min(100, (shipmentOtPay / SHIPMENT_BUDGET_CAP) * 100);
    const wismaBurnPct = Math.min(100, (wismaOtPay / WISMA_BUDGET_CAP) * 100);

    const totalRemBudget = Math.max(0, TOTAL_BUDGET_CAP - totalOtPay);
    const shipmentRemBudget = Math.max(0, SHIPMENT_BUDGET_CAP - shipmentOtPay);
    const wismaRemBudget = Math.max(0, WISMA_BUDGET_CAP - wismaOtPay);

    const avgAttendanceRate = employeeFinancialList.length > 0
      ? Math.round(employeeFinancialList.reduce((s, i) => s + i.attendanceRate, 0) / employeeFinancialList.length)
      : 100;

    const avgPunctualityRate = employeeFinancialList.length > 0
      ? Math.round(employeeFinancialList.reduce((s, i) => s + i.punctualityRate, 0) / employeeFinancialList.length)
      : 100;

    return {
      TOTAL_BUDGET_CAP,
      SHIPMENT_BUDGET_CAP,
      WISMA_BUDGET_CAP,
      totalBaseSal,
      totalBpjs,
      totalAlpaDed,
      totalOtPay,
      totalOtHours,
      totalNetSal,
      totalSpklCount,
      employeesWithOtCount,
      shipmentOtPay,
      shipmentOtHours,
      wismaOtPay,
      wismaOtHours,
      totalBurnPct,
      shipmentBurnPct,
      wismaBurnPct,
      totalRemBudget,
      shipmentRemBudget,
      wismaRemBudget,
      isTotalOverBudget: totalOtPay >= TOTAL_BUDGET_CAP,
      isShipmentOverBudget: shipmentOtPay >= SHIPMENT_BUDGET_CAP,
      isWismaOverBudget: wismaOtPay >= WISMA_BUDGET_CAP,
      totalHadirDays,
      totalTelatDays,
      totalTelatMinutes,
      totalCutiDays,
      totalSakitDays,
      totalIzinDays,
      totalAlpaDays,
      avgAttendanceRate,
      avgPunctualityRate,
    };
  }, [employeeFinancialList]);

  // ─── 3. MULTI-SHEET EXCEL EXPORT (5 LAPORAN LENGKAP DALAM 1 WORKBOOK) ───
  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Rekap Presensi & Kedisiplinan Bulanan
      const sheet1Rows = employeeFinancialList.map((item, idx) => ({
        No: idx + 1,
        NIP: item.nip,
        'Nama Karyawan': item.name,
        Divisi: item.divisionName,
        Grup: item.opGroup === 'SHIPMENT' ? 'Shiftman Lapangan' : 'Wisma Biring Ere',
        'Status Wajah': item.isFaceEnrolled ? 'Terdaftar (Aktif)' : 'Belum Registrasi',
        'Hadir Tepat Waktu': item.tepatWaktuCount,
        'Terlambat (Kali)': item.telatCount,
        'Total Menit Telat': item.totalLateMinutes,
        'Cuti (Hari)': item.cutiCount,
        'Sisa Cuti Thn (Hari)': item.remainingLeave,
        'Sakit (Hari)': item.sakitCount,
        'Izin (Hari)': item.izinCount,
        'Alpa / Mangkir': item.alpaCount,
        'Libur / OFF': item.offCount,
        'Tingkat Kehadiran (%)': `${item.attendanceRate}%`,
        'Rasio Disiplin (%)': `${item.punctualityRate}%`,
      }));
      sheet1Rows.push({
        No: '' as any,
        NIP: 'TOTAL',
        'Nama Karyawan': `${employeeFinancialList.length} Personil Sah`,
        Divisi: '',
        Grup: '',
        'Status Wajah': '',
        'Hadir Tepat Waktu': employeeFinancialList.reduce((s, i) => s + i.tepatWaktuCount, 0),
        'Terlambat (Kali)': summary.totalTelatDays,
        'Total Menit Telat': summary.totalTelatMinutes,
        'Cuti (Hari)': summary.totalCutiDays,
        'Sisa Cuti Thn (Hari)': '' as any,
        'Sakit (Hari)': summary.totalSakitDays,
        'Izin (Hari)': summary.totalIzinDays,
        'Alpa / Mangkir': summary.totalAlpaDays,
        'Libur / OFF': employeeFinancialList.reduce((s, i) => s + i.offCount, 0),
        'Tingkat Kehadiran (%)': `${summary.avgAttendanceRate}%`,
        'Rasio Disiplin (%)': `${summary.avgPunctualityRate}%`,
      });
      const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
      XLSX.utils.book_append_sheet(workbook, ws1, 'Rekap_Presensi_Bulanan');

      // Sheet 2: Rekap 80 Karyawan & Budget Sah Rp 76 Jt
      const sheet2Rows = employeeFinancialList.map((item, idx) => ({
        No: idx + 1,
        NIP: item.nip,
        'Nama Karyawan': item.name,
        Divisi: item.divisionName,
        'Grup Operasional': item.opGroup === 'SHIPMENT' ? '47 Shiftman Lapangan' : '33 Wisma Biring Ere',
        'Total Jam Lembur Sebulan': item.monthOtHours,
        'Total Nominal Lembur Sebulan (Rp)': item.monthOtPay,
        'Gaji Pokok Tunggal (Rp)': item.baseSalary,
        'BPJS Ketenagakerjaan 3% (Rp)': item.bpjsTk,
        'BPJS Kesehatan 1% (Rp)': item.bpjsKes,
        'Total Potongan BPJS (Rp)': item.totalBpjs,
        'Potongan Alpa (Rp)': item.alpaDeduction,
        'Estimasi Gaji Bersih Realtime (Rp)': item.netSalary,
      }));
      sheet2Rows.push({
        No: '' as any,
        NIP: 'GRAND TOTAL',
        'Nama Karyawan': `Total ${employeeFinancialList.length} Karyawan Sah`,
        Divisi: '',
        'Grup Operasional': '',
        'Total Jam Lembur Sebulan': summary.totalOtHours,
        'Total Nominal Lembur Sebulan (Rp)': summary.totalOtPay,
        'Gaji Pokok Tunggal (Rp)': summary.totalBaseSal,
        'BPJS Ketenagakerjaan 3% (Rp)': Math.round(summary.totalBaseSal * 0.03),
        'BPJS Kesehatan 1% (Rp)': Math.round(summary.totalBaseSal * 0.01),
        'Total Potongan BPJS (Rp)': summary.totalBpjs,
        'Potongan Alpa (Rp)': summary.totalAlpaDed,
        'Estimasi Gaji Bersih Realtime (Rp)': summary.totalNetSal,
      });
      const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
      XLSX.utils.book_append_sheet(workbook, ws2, 'Plafon_Lembur_76Jt');

      // Sheet 3: Laporan Nominal Lembur Per Karyawan
      const sheet3Rows = employeeFinancialList
        .filter((i) => i.monthOtHours > 0)
        .map((item, idx) => ({
          No: idx + 1,
          NIP: item.nip,
          'Nama Karyawan': item.name,
          Divisi: item.divisionName,
          Grup: item.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma',
          'Frekuensi SPKL': `${item.spklCount}x Penugasan`,
          'Total Jam Lembur': item.monthOtHours,
          'Rincian Tanggal Lembur': item.otDateDetails,
          'Total Nominal Kompensasi Lembur (Rp)': item.monthOtPay,
          Status: 'Disetujui',
        }));
      sheet3Rows.push({
        No: '' as any,
        NIP: 'TOTAL',
        'Nama Karyawan': `${summary.employeesWithOtCount} Karyawan Memiliki Lembur`,
        Divisi: '',
        Grup: '',
        'Frekuensi SPKL': `${summary.totalSpklCount}x Total`,
        'Total Jam Lembur': summary.totalOtHours,
        'Rincian Tanggal Lembur': `Akumulasi Bulan ${selectedMonthLabel}`,
        'Total Nominal Kompensasi Lembur (Rp)': summary.totalOtPay,
        Status: 'Disetujui & Sah',
      });
      const ws3 = XLSX.utils.json_to_sheet(sheet3Rows);
      XLSX.utils.book_append_sheet(workbook, ws3, 'Rincian_SPKL_Lembur');

      // Sheet 4: Rekap Remunerasi & Gaji Bersih
      const sheet4Rows = employeeFinancialList.map((item, idx) => ({
        No: idx + 1,
        NIP: item.nip,
        'Nama Karyawan': item.name,
        Divisi: item.divisionName,
        'Gaji Pokok Tunggal (Rp)': item.baseSalary,
        'Uang Lembur (Rp)': item.monthOtPay,
        'BPJS TK 3% (Rp)': item.bpjsTk,
        'BPJS Kes 1% (Rp)': item.bpjsKes,
        'Total Potongan BPJS 4% (Rp)': item.totalBpjs,
        'Potongan Alpa (Rp)': item.alpaDeduction,
        'PPh 21 (Rp)': 0,
        'Gaji Bersih / THP (Rp)': item.netSalary,
      }));
      const ws4 = XLSX.utils.json_to_sheet(sheet4Rows);
      XLSX.utils.book_append_sheet(workbook, ws4, 'Remunerasi_Gaji_Bersih');

      // Sheet 5: Rekapan Nominal Lembur Per Divisi
      const sheet5Rows = divisionRecap.map((d, idx) => ({
        No: idx + 1,
        'Nama Divisi / Pos': d.divisionName,
        'Grup Operasional': d.opGroup === 'SHIPMENT' ? '47 Shiftman Lapangan' : '33 Wisma Biring Ere',
        'Total Personil': d.totalEmployees,
        'Karyawan Lembur': d.overtimeEmployeeCount,
        'Frekuensi SPKL': `${d.totalSpklCount}x`,
        'Total Jam Lembur': d.totalHours,
        'Total Nominal Lembur (Rp)': d.totalPay,
        'Rata-rata Per Personil (Rp)': d.totalEmployees > 0 ? Math.round(d.totalPay / d.totalEmployees) : 0,
      }));
      sheet5Rows.push({
        No: '' as any,
        'Nama Divisi / Pos': 'TOTAL PERUSAHAAN',
        'Grup Operasional': '80 Personil Sah',
        'Total Personil': employeeFinancialList.length,
        'Karyawan Lembur': summary.employeesWithOtCount,
        'Frekuensi SPKL': `${summary.totalSpklCount}x`,
        'Total Jam Lembur': summary.totalOtHours,
        'Total Nominal Lembur (Rp)': summary.totalOtPay,
        'Rata-rata Per Personil (Rp)': Math.round(summary.totalOtPay / employeeFinancialList.length),
      });
      const ws5 = XLSX.utils.json_to_sheet(sheet5Rows);
      XLSX.utils.book_append_sheet(workbook, ws5, 'Rekapan_Per_Divisi');

      const filename = `Rekapitulasi_Bulanan_Lengkap_PT_FRP_${selectedMonth}.xlsx`;
      XLSX.writeFile(workbook, filename);
      toast.success(`Workbook Excel Rekapan Bulanan (${selectedMonthLabel}) berhasil diunduh!`);
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      toast.error('Gagal mengekspor Excel: ' + (err?.message || 'Kesalahan sistem'));
    }
  };

  // ─── 4. PDF EXPORTER RESMI PT FRP ───
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const runAutoTable = (typeof autoTable === 'function' ? autoTable : (autoTable as any)?.default) || (doc as any).autoTable;

      // Kop Resmi Perusahaan
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PT. FAWWAZ RESKI PERWIRA', 14, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      if (activeTab === 'attendance_matrix') {
        doc.text(`LAPORAN REKAPITULASI PRESENSI & KEDISIPLINAN BULANAN - ${selectedMonthLabel.toUpperCase()}`, 14, 18);
        doc.setFontSize(7.5);
        doc.text(`Total Personil: ${employeeFinancialList.length} Orang | Rata-rata Hadir: ${summary.avgAttendanceRate}% | Rata-rata Disiplin: ${summary.avgPunctualityRate}% | Dicetak: ${todayStr}`, 14, 22);

        const headers = [['No', 'NIP', 'Nama Karyawan', 'Divisi', 'Grup', 'Tepat Waktu', 'Telat (x)', 'Telat (m)', 'Cuti', 'Sakit', 'Izin', 'Alpa', '% Hadir']];
        const body = filteredList.map((i, idx) => [
          idx + 1,
          i.nip,
          i.name,
          i.divisionName,
          i.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma',
          i.tepatWaktuCount,
          i.telatCount > 0 ? `${i.telatCount}x` : '-',
          i.totalLateMinutes > 0 ? `${i.totalLateMinutes}m` : '-',
          i.cutiCount > 0 ? `${i.cutiCount}h` : '-',
          i.sakitCount > 0 ? `${i.sakitCount}h` : '-',
          i.izinCount > 0 ? `${i.izinCount}h` : '-',
          i.alpaCount > 0 ? `${i.alpaCount}h` : '-',
          `${i.attendanceRate}%`,
        ]);

        runAutoTable(doc, {
          startY: 25,
          head: headers,
          body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: {
            2: { halign: 'left', fontStyle: 'bold' },
            3: { halign: 'left' },
          },
          didDrawPage: (data: any) => {
            const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any)?.getNumberOfPages?.() || 1;
            doc.setFontSize(7);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
          }
        });

        doc.save(`Rekap_Presensi_Bulanan_FRP_${selectedMonth}.pdf`);
      } else if (activeTab === 'employee_overtime') {
        doc.text(`LAPORAN DETAIL NOMINAL LEMBUR PER KARYAWAN (SPKL DIGITAL) - ${selectedMonthLabel.toUpperCase()}`, 14, 18);
        doc.setFontSize(7.5);
        doc.text(`Total Realisasi: Rp ${summary.totalOtPay.toLocaleString('id-ID')} (${summary.totalOtHours} Jam • ${summary.totalSpklCount}x SPKL) • Tanggal Cetak: ${todayStr}`, 14, 22);

        const headers = [['No', 'NIP', 'Nama Karyawan', 'Divisi', 'Grup', 'SPKL', 'Jam', 'Rincian Tanggal Lembur', 'Nominal Lembur (Rp)']];
        const body = filteredEmployees
          .filter((i) => i.monthOtHours > 0)
          .map((i, idx) => [
            idx + 1,
            i.nip,
            i.name,
            i.divisionName,
            i.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma',
            `${i.spklCount}x`,
            `${i.monthOtHours} Jam`,
            i.otDateDetails,
            `Rp ${i.monthOtPay.toLocaleString('id-ID')}`,
          ]);
        body.push([
          '',
          'TOTAL',
          `${summary.employeesWithOtCount} Karyawan Lembur`,
          '',
          '',
          `${summary.totalSpklCount}x`,
          `${summary.totalOtHours} Jam`,
          'Akumulasi Bulan Berjalan',
          `Rp ${summary.totalOtPay.toLocaleString('id-ID')}`,
        ]);

        runAutoTable(doc, {
          startY: 25,
          head: headers,
          body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: {
            2: { fontStyle: 'bold' },
            7: { fontSize: 6.5 },
          },
          didDrawPage: (data: any) => {
            const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any)?.getNumberOfPages?.() || 1;
            doc.setFontSize(7);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
          }
        });

        doc.save(`Laporan_Nominal_Lembur_Karyawan_${selectedMonth}.pdf`);
      } else if (activeTab === 'payroll_recap') {
        doc.text(`REKAPITULASI PENGGAJIAN & REMUNERASI BAKU PT FRP - ${selectedMonthLabel.toUpperCase()}`, 14, 18);
        doc.setFontSize(7.5);
        doc.text(`Aturan Resmi: Upah Pokok Tunggal Rp 4.045.050, Tanpa Tunjangan, PPh 21 Rp 0 • Total THP: Rp ${summary.totalNetSal.toLocaleString('id-ID')}`, 14, 22);

        const headers = [['No', 'NIP', 'Nama Karyawan', 'Divisi', 'Grup', 'Gaji Pokok', 'Lembur (Rp)', 'BPJS TK 3%', 'BPJS Kes 1%', 'Pot. Alpa', 'Gaji Bersih (THP)']];
        const body = filteredList.map((i, idx) => [
          idx + 1,
          i.nip,
          i.name,
          i.divisionName,
          i.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma',
          `Rp ${i.baseSalary.toLocaleString('id-ID')}`,
          `Rp ${i.monthOtPay.toLocaleString('id-ID')}`,
          `-Rp ${i.bpjsTk.toLocaleString('id-ID')}`,
          `-Rp ${i.bpjsKes.toLocaleString('id-ID')}`,
          i.alpaDeduction > 0 ? `-Rp ${i.alpaDeduction.toLocaleString('id-ID')}` : '-',
          `Rp ${i.netSalary.toLocaleString('id-ID')}`,
        ]);
        body.push([
          '',
          'TOTAL',
          `${filteredList.length} Karyawan`,
          '',
          '',
          `Rp ${summary.totalBaseSal.toLocaleString('id-ID')}`,
          `Rp ${summary.totalOtPay.toLocaleString('id-ID')}`,
          `-Rp ${Math.round(summary.totalBaseSal * 0.03).toLocaleString('id-ID')}`,
          `-Rp ${Math.round(summary.totalBaseSal * 0.01).toLocaleString('id-ID')}`,
          summary.totalAlpaDed > 0 ? `-Rp ${summary.totalAlpaDed.toLocaleString('id-ID')}` : '-',
          `Rp ${summary.totalNetSal.toLocaleString('id-ID')}`,
        ]);

        runAutoTable(doc, {
          startY: 25,
          head: headers,
          body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: {
            2: { halign: 'left', fontStyle: 'bold' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            10: { halign: 'right', fontStyle: 'bold' },
          },
          didDrawPage: (data: any) => {
            const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any)?.getNumberOfPages?.() || 1;
            doc.setFontSize(7);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
          }
        });

        doc.save(`Rekapitulasi_Gaji_Bersih_FRP_${selectedMonth}.pdf`);
      } else if (activeTab === 'division_overtime') {
        doc.text(`REKAPAN REALISASI LEMBUR & PERSONIL PER DIVISI - ${selectedMonthLabel.toUpperCase()}`, 14, 18);
        doc.setFontSize(7.5);
        doc.text(`Total Realisasi: Rp ${summary.totalOtPay.toLocaleString('id-ID')} • Plafon Sah: Rp 76.000.000 • Tanggal Cetak: ${todayStr}`, 14, 22);

        const headers = [['No', 'Nama Divisi / Pos', 'Grup', 'Total Personil', 'Personil Lembur', 'Frekuensi SPKL', 'Total Jam', 'Total Nominal Lembur (Rp)', 'Rata-rata/Org']];
        const body = filteredDivisions.map((d, idx) => [
          idx + 1,
          d.divisionName,
          d.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma',
          d.totalEmployees,
          d.overtimeEmployeeCount,
          `${d.totalSpklCount}x`,
          `${d.totalHours} Jam`,
          `Rp ${d.totalPay.toLocaleString('id-ID')}`,
          `Rp ${(d.totalEmployees > 0 ? Math.round(d.totalPay / d.totalEmployees) : 0).toLocaleString('id-ID')}`,
        ]);
        body.push([
          '',
          'TOTAL',
          '80 Personil Sah',
          employeeFinancialList.length,
          summary.employeesWithOtCount,
          `${summary.totalSpklCount}x`,
          `${summary.totalOtHours} Jam`,
          `Rp ${summary.totalOtPay.toLocaleString('id-ID')}`,
          `Rp ${Math.round(summary.totalOtPay / employeeFinancialList.length).toLocaleString('id-ID')}`,
        ]);

        runAutoTable(doc, {
          startY: 25,
          head: headers,
          body,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: {
            1: { halign: 'left', fontStyle: 'bold' },
            7: { halign: 'right', fontStyle: 'bold' },
            8: { halign: 'right' },
          },
          didDrawPage: (data: any) => {
            const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any)?.getNumberOfPages?.() || 1;
            doc.setFontSize(7);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
          }
        });

        doc.save(`Rekapan_Lembur_Per_Divisi_${selectedMonth}.pdf`);
      } else {
        // Tab budget_80
        doc.text(`REKAPITULASI 80 KARYAWAN SAH & PLAFON LEMBUR RP 76 JT - ${selectedMonthLabel.toUpperCase()}`, 14, 18);
        doc.setFontSize(7.5);
        doc.text(`Plafon Sah: Rp 76.000.000 (Shipment: Rp 72 Jt | Wisma: Rp 4 Jt) • Tanggal Cetak: ${todayStr}`, 14, 22);

        const headers = [['No', 'NIP', 'Nama Karyawan', 'Divisi', 'Grup', 'Jam Lembur', 'Lembur (Rp)', 'Gaji Pokok', 'BPJS 4%', 'Gaji Bersih (THP)']];
        const body = filteredEmployees.map((i, idx) => [
          idx + 1,
          i.nip,
          i.name,
          i.divisionName,
          i.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma',
          `${i.monthOtHours}h`,
          `Rp ${i.monthOtPay.toLocaleString('id-ID')}`,
          `Rp ${i.baseSalary.toLocaleString('id-ID')}`,
          `Rp ${i.totalBpjs.toLocaleString('id-ID')}`,
          `Rp ${i.netSalary.toLocaleString('id-ID')}`,
        ]);
        body.push([
          '',
          'TOTAL',
          `Total ${filteredEmployees.length} Karyawan`,
          '',
          '',
          `${summary.totalOtHours}h`,
          `Rp ${summary.totalOtPay.toLocaleString('id-ID')}`,
          `Rp ${summary.totalBaseSal.toLocaleString('id-ID')}`,
          `Rp ${summary.totalBpjs.toLocaleString('id-ID')}`,
          `Rp ${summary.totalNetSal.toLocaleString('id-ID')}`,
        ]);

        runAutoTable(doc, {
          startY: 25,
          head: headers,
          body,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: {
            2: { halign: 'left', fontStyle: 'bold' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            9: { halign: 'right', fontStyle: 'bold' },
          },
          didDrawPage: (data: any) => {
            const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any)?.getNumberOfPages?.() || 1;
            doc.setFontSize(7);
            doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 5);
          }
        });

        doc.save(`Rekap_Finansial_80_Karyawan_${selectedMonth}.pdf`);
      }

      toast.success(`Laporan PDF (${selectedMonthLabel}) berhasil diunduh!`);
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast.error('Gagal mengekspor PDF: ' + (err?.message || 'Kesalahan sistem'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto p-0 rounded-2xl shadow-2xl">
        <DialogHeader className="p-5 pb-3 bg-muted/30 border-b border-border">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                Rekapitulasi Bulanan Lengkap (Presensi, Lembur &amp; Remunerasi)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Pantauan 360° performa kehadiran, kepatuhan plafon lembur Rp 76 Jt, dan gaji bersih 80 personil operasional PT. FRP.
              </DialogDescription>
            </div>

            {/* Kontrol Bulan & Tombol Export */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-background border border-border px-2.5 py-1 rounded-xl shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground">Bulan:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) setSelectedMonth(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-foreground border-none outline-none cursor-pointer"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
                className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-2xs"
                title="Unduh 5 Lembar Kerja Excel Lengkap"
              >
                <FileSpreadsheet size={13} /> Excel (5 Sheet)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPdf}
                className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 shadow-2xs"
                title="Unduh Dokumen PDF Berkop Resmi PT FRP"
              >
                <FileText size={13} /> Cetak PDF
              </Button>
            </div>
          </div>

          {/* ── 5-TAB NAVIGATION BAR ── */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/60 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('attendance_matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'attendance_matrix'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              1. Presensi &amp; Kedisiplinan
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('budget_80')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'budget_80'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              2. Plafon Lembur 80 Org (Rp 76 Jt)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('employee_overtime')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'employee_overtime'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              3. Rincian SPKL Lembur
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payroll_recap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'payroll_recap'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              4. Gaji Bersih (THP)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('division_overtime')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'division_overtime'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              5. Rekap Divisi
            </button>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* ── 1. KPI SUMMARY CARDS (DYNAMIC PER TAB) ── */}
          {activeTab === 'attendance_matrix' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Rata-rata Kehadiran */}
              <Card className="border-border bg-gradient-to-br from-teal-500/10 via-card to-card rounded-xl shadow-2xs">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-teal-600" /> Rata-rata Kehadiran
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-700 border-teal-500/20 font-bold">
                      {selectedMonthLabel}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-300">
                    {summary.avgAttendanceRate}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total Hadir Terakumulasi: <strong className="text-foreground">{summary.totalHadirDays} Kali</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Kedisiplinan & Telat */}
              <Card className="border-border bg-gradient-to-br from-amber-500/10 via-card to-card rounded-xl shadow-2xs">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Rasio Ketepatan Waktu
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20 font-bold">
                      {summary.avgPunctualityRate}% Disiplin
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
                    {summary.totalTelatDays} <span className="text-xs font-normal text-muted-foreground">Insiden Telat</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total Keterlambatan: <strong className="text-foreground font-mono">{summary.totalTelatMinutes} Menit</strong>
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Cuti, Sakit, Izin */}
              <Card className="border-border bg-gradient-to-br from-blue-500/10 via-card to-card rounded-xl shadow-2xs">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-600" /> Cuti, Sakit &amp; Izin
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/20 font-bold">
                      Sah Disetujui
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300">
                    {summary.totalCutiDays + summary.totalSakitDays + summary.totalIzinDays} <span className="text-xs font-normal text-muted-foreground">Hari</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                    <span>Cuti: <strong>{summary.totalCutiDays}h</strong></span> • 
                    <span>Sakit: <strong>{summary.totalSakitDays}h</strong></span> • 
                    <span>Izin: <strong>{summary.totalIzinDays}h</strong></span>
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Mangkir / Alpa */}
              <Card className="border-border bg-gradient-to-br from-rose-500/10 via-card to-card rounded-xl shadow-2xs">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Mangkir / Alpa
                    </span>
                    <Badge variant="outline" className={`text-[10px] font-bold ${summary.totalAlpaDays > 0 ? 'bg-rose-500/15 text-rose-700 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'}`}>
                      {summary.totalAlpaDays > 0 ? '⚠️ Terkena Denda' : '✅ Nihil Alpa'}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300">
                    {summary.totalAlpaDays} <span className="text-xs font-normal text-muted-foreground">Hari Alpa</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Potongan Gaji Alpa: <strong className="text-rose-600 font-mono">-Rp {summary.totalAlpaDed.toLocaleString('id-ID')}</strong>
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Plafon Lembur Card */}
              <Card className="border-border bg-gradient-to-br from-emerald-500/10 via-card to-card rounded-xl shadow-2xs">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      Plafon Lembur Sah Perusahaan
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        summary.isTotalOverBudget
                          ? 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                          : summary.totalBurnPct > 85
                          ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                      }`}
                    >
                      {summary.isTotalOverBudget ? '🔒 KUOTA TERCAPAI' : `Serapan ${summary.totalBurnPct.toFixed(1)}%`}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-xl font-bold font-mono text-foreground">
                        Rp {summary.totalOtPay.toLocaleString('id-ID')}
                      </p>
                      <span className="text-xs font-mono text-muted-foreground">
                        / Rp {summary.TOTAL_BUDGET_CAP.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          summary.isTotalOverBudget
                            ? 'bg-rose-500'
                            : summary.totalBurnPct > 85
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${summary.totalBurnPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                      <span>Sisa Pagu Bersih ({selectedMonthLabel}):</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                        Rp {summary.totalRemBudget.toLocaleString('id-ID')}
                      </strong>
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Total Realisasi Jam:</span>
                      <strong className="font-mono">{summary.totalOtHours} Jam ({summary.totalSpklCount}x SPKL)</strong>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Rincian 2 Grup Sah (Shipment vs Wisma) */}
              <Card className="border-border bg-card rounded-xl shadow-2xs">
                <CardContent className="p-4 space-y-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    Alokasi Kuota 2 Grup Sah (SK Direksi)
                  </span>
                  <div className="space-y-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">Grup SHIPMENT (47 Orang)</span>
                        <span className="font-mono text-muted-foreground">Plafon Rp 72 Jt</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          Rp {summary.shipmentOtPay.toLocaleString('id-ID')} ({summary.shipmentOtHours} Jam)
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Sisa: Rp {summary.shipmentRemBudget.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">Grup WISMA (33 Orang)</span>
                        <span className="font-mono text-muted-foreground">Plafon Rp 4 Jt</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          Rp {summary.wismaOtPay.toLocaleString('id-ID')} ({summary.wismaOtHours} Jam)
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Sisa: Rp {summary.wismaRemBudget.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Beban Gaji Bersih Realtime */}
              <Card className="border-border bg-gradient-to-br from-primary/10 via-card to-card rounded-xl shadow-2xs">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Total Gaji Bersih (Take Home Pay)
                    </span>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                      {selectedMonthLabel}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xl font-bold font-mono text-primary">
                      Rp {summary.totalNetSal.toLocaleString('id-ID')}
                    </p>
                    <div className="mt-2 text-[10.5px] text-muted-foreground space-y-0.5 font-mono">
                      <div className="flex justify-between">
                        <span>Gaji Pokok Tunggal:</span>
                        <span>Rp {summary.totalBaseSal.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>(+) Realisasi Lembur:</span>
                        <span>+Rp {summary.totalOtPay.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span>(-) Potongan BPJS (4%):</span>
                        <span>-Rp {summary.totalBpjs.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── 2. FILTER & SEARCH CONTROLS ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border text-xs flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedGroup('ALL')}
                className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                  selectedGroup === 'ALL'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua ({employeeFinancialList.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('SHIPMENT')}
                className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                  selectedGroup === 'SHIPMENT'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                47 Shiftman Lapangan
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('RUMAH TANGGA')}
                className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                  selectedGroup === 'RUMAH TANGGA'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                33 Wisma Biring Ere
              </button>
              {activeTab === 'employee_overtime' && (
                <button
                  type="button"
                  onClick={() => setFilterOnlyWithOvertime(!filterOnlyWithOvertime)}
                  className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                    filterOnlyWithOvertime
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                  }`}
                >
                  ⚡ Hanya Yang Lembur ({summary.employeesWithOtCount})
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Cari nama karyawan / NIP / divisi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs rounded-xl h-8"
              />
            </div>
          </div>

          {/* ── 3. DATA TABLES SESUAI TAB AKTIF ── */}

          {/* TAB 1: MATRIKS PRESENSI & KEDISIPLINAN BULANAN */}
          {activeTab === 'attendance_matrix' && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[48vh]">
                <Table>
                  <TableHeader className="bg-teal-700/10 sticky top-0 z-10">
                    <TableRow className="text-[11px] font-semibold text-muted-foreground border-b border-border">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="min-w-[170px]">Karyawan &amp; NIP</TableHead>
                      <TableHead className="min-w-[130px]">Divisi &amp; Pos</TableHead>
                      <TableHead className="min-w-[90px] text-center">Hadir</TableHead>
                      <TableHead className="min-w-[100px] text-center">Tepat Waktu</TableHead>
                      <TableHead className="min-w-[100px] text-center">Terlambat</TableHead>
                      <TableHead className="min-w-[90px] text-center">Cuti (Hari)</TableHead>
                      <TableHead className="min-w-[80px] text-center">Sakit</TableHead>
                      <TableHead className="min-w-[80px] text-center">Izin</TableHead>
                      <TableHead className="min-w-[90px] text-center">Alpa</TableHead>
                      <TableHead className="min-w-[100px] text-center">% Kehadiran</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-muted-foreground text-xs">
                          Tidak ada data karyawan yang cocok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredList.map((item, idx) => (
                        <TableRow key={item.userId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-foreground text-xs truncate max-w-[170px]">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.nip}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-foreground font-medium">{item.divisionName}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 rounded block w-fit mt-0.5 ${
                                item.opGroup === 'SHIPMENT'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              }`}
                            >
                              {item.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs text-teal-700 dark:text-teal-300">
                            {item.hadirCount}h
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-emerald-600">
                            {item.tepatWaktuCount}h
                          </TableCell>
                          <TableCell className="text-center">
                            {item.telatCount > 0 ? (
                              <div className="flex flex-col items-center">
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9.5px]">
                                  {item.telatCount}x
                                </Badge>
                                <span className="font-mono text-[9px] text-amber-600">{item.totalLateMinutes}m</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 font-mono text-xs">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {item.cutiCount > 0 ? (
                              <span className="font-bold text-blue-600">{item.cutiCount}h</span>
                            ) : (
                              <span className="text-muted-foreground/40">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {item.sakitCount > 0 ? `${item.sakitCount}h` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {item.izinCount > 0 ? `${item.izinCount}h` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {item.alpaCount > 0 ? (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 font-bold text-[9.5px]">
                                {item.alpaCount}h
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/40 font-mono">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono font-bold ${
                                item.attendanceRate >= 95
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : item.attendanceRate >= 80
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-300'
                              }`}
                            >
                              {item.attendanceRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Summary Bar */}
              <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium">
                  Periode: <strong className="text-foreground">{selectedMonthLabel}</strong> • Ditampilkan: <strong className="text-foreground">{filteredList.length} Orang</strong>
                </span>
                <div className="flex items-center gap-4 font-mono font-bold text-xs">
                  <span>Total Kehadiran: <span className="text-teal-600">{filteredList.reduce((s, i) => s + i.hadirCount, 0)} Hari</span></span>
                  <span>Total Telat: <span className="text-amber-600">{filteredList.reduce((s, i) => s + i.telatCount, 0)}x ({filteredList.reduce((s, i) => s + i.totalLateMinutes, 0)}m)</span></span>
                  <span>Total Cuti/Izin/Sakit: <span className="text-blue-600">{filteredList.reduce((s, i) => s + i.cutiCount + i.sakitCount + i.izinCount, 0)}h</span></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REKAPAN 80 KARYAWAN & PLAFON RP 76 JT */}
          {activeTab === 'budget_80' && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[48vh]">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow className="text-[11px] font-semibold text-muted-foreground border-b border-border">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="min-w-[170px]">Karyawan &amp; NIP</TableHead>
                      <TableHead className="min-w-[130px]">Grup &amp; Shift</TableHead>
                      <TableHead className="min-w-[120px] text-center">Lembur Hari Live</TableHead>
                      <TableHead className="min-w-[130px] text-center">Lembur Bln Ini (Jam / Rp)</TableHead>
                      <TableHead className="min-w-[110px] text-right">Gaji Pokok</TableHead>
                      <TableHead className="min-w-[100px] text-right">Pot. BPJS 4%</TableHead>
                      <TableHead className="min-w-[130px] text-right">Gaji Bersih (THP)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                          Tidak ada data karyawan yang cocok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredList.map((item, idx) => (
                        <TableRow key={item.userId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-foreground text-xs truncate max-w-[170px]">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.nip}</p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[9.5px] px-1.5 py-0.2 rounded-md ${
                                item.opGroup === 'SHIPMENT'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              }`}
                            >
                              {item.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma'}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[120px]">
                              {item.shiftName}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.todayOtHours > 0 ? (
                              <div className="flex flex-col items-center">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                                  ⚡ {item.todayOtHours} Jam {item.isTodayRelief ? '(Relief)' : ''}
                                </Badge>
                                <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Rp {item.todayOtPay.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 font-mono text-[11px]">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-mono font-bold text-xs text-foreground">
                                {item.monthOtHours} Jam
                              </span>
                              <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Rp {item.monthOtPay.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            Rp {item.baseSalary.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                            -Rp {item.totalBpjs.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-primary">
                            Rp {item.netSalary.toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Summary Bar */}
              <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium">
                  Total Karyawan Ditampilkan: <strong className="text-foreground">{filteredList.length} Orang</strong>
                </span>
                <div className="flex items-center gap-4 font-mono font-bold text-xs">
                  <span>Total Lembur: <span className="text-emerald-600">Rp {filteredList.reduce((s, i) => s + i.monthOtPay, 0).toLocaleString('id-ID')}</span></span>
                  <span>Total Gaji Bersih: <span className="text-primary">Rp {filteredList.reduce((s, i) => s + i.netSalary, 0).toLocaleString('id-ID')}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAPORAN LEMBUR PER KARYAWAN */}
          {activeTab === 'employee_overtime' && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[48vh]">
                <Table>
                  <TableHeader className="bg-amber-500/10 sticky top-0 z-10">
                    <TableRow className="text-[11px] font-semibold text-muted-foreground border-b border-border">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="min-w-[160px]">Karyawan &amp; NIP</TableHead>
                      <TableHead className="min-w-[130px]">Divisi &amp; Pos</TableHead>
                      <TableHead className="min-w-[90px] text-center">Grup</TableHead>
                      <TableHead className="min-w-[90px] text-center">SPKL</TableHead>
                      <TableHead className="min-w-[90px] text-center">Total Jam</TableHead>
                      <TableHead className="min-w-[200px]">Rincian Tanggal Lembur ({selectedMonthLabel})</TableHead>
                      <TableHead className="min-w-[130px] text-right">Nominal Lembur (Rp)</TableHead>
                      <TableHead className="min-w-[100px] text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                          Tidak ada data karyawan yang cocok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((item, idx) => (
                        <TableRow key={item.userId} className={`hover:bg-muted/30 transition-colors ${item.monthOtHours > 0 ? 'bg-amber-500/5' : ''}`}>
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-foreground text-xs truncate max-w-[160px]">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.nip}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-foreground font-medium">{item.divisionName}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                                item.opGroup === 'SHIPMENT'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              }`}
                            >
                              {item.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs">
                            {item.spklCount > 0 ? `${item.spklCount}x` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs text-amber-700 dark:text-amber-400">
                            {item.monthOtHours > 0 ? `${item.monthOtHours} Jam` : '0 Jam'}
                          </TableCell>
                          <TableCell>
                            <p className="text-[10.5px] font-mono text-muted-foreground max-w-[280px] truncate" title={item.otDateDetails}>
                              {item.otDateDetails}
                            </p>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            Rp {item.monthOtPay.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.monthOtHours > 0 ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[9.5px]">
                                Disetujui
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/40 text-[10px]">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Summary Bar */}
              <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium">
                  Karyawan Lembur: <strong className="text-amber-600">{filteredEmployees.filter(i => i.monthOtHours > 0).length} Orang</strong> • Total Penugasan: <strong className="text-foreground">{filteredEmployees.reduce((s, i) => s + i.spklCount, 0)}x SPKL</strong>
                </span>
                <div className="flex items-center gap-4 font-mono font-bold text-xs">
                  <span>Total Jam Lembur: <span className="text-foreground">{filteredEmployees.reduce((s, i) => s + i.monthOtHours, 0)} Jam</span></span>
                  <span>Total Nominal: <span className="text-amber-600">Rp {filteredEmployees.reduce((s, i) => s + i.monthOtPay, 0).toLocaleString('id-ID')}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REKAPITULASI PENGGAJIAN & REMUNERASI BAKU */}
          {activeTab === 'payroll_recap' && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[48vh]">
                <Table>
                  <TableHeader className="bg-emerald-700/10 sticky top-0 z-10">
                    <TableRow className="text-[11px] font-semibold text-muted-foreground border-b border-border">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="min-w-[160px]">Karyawan &amp; NIP</TableHead>
                      <TableHead className="min-w-[130px]">Divisi &amp; Grup</TableHead>
                      <TableHead className="min-w-[110px] text-right">Gaji Pokok Tunggal</TableHead>
                      <TableHead className="min-w-[110px] text-right">Lembur Sah (Rp)</TableHead>
                      <TableHead className="min-w-[95px] text-right">BPJS TK 3%</TableHead>
                      <TableHead className="min-w-[95px] text-right">BPJS Kes 1%</TableHead>
                      <TableHead className="min-w-[95px] text-right">Pot. Alpa</TableHead>
                      <TableHead className="min-w-[80px] text-center">PPh 21</TableHead>
                      <TableHead className="min-w-[130px] text-right">Gaji Bersih (THP)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground text-xs">
                          Tidak ada data karyawan yang cocok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredList.map((item, idx) => (
                        <TableRow key={item.userId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-foreground text-xs truncate max-w-[160px]">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.nip}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-foreground font-medium">{item.divisionName}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 rounded block w-fit mt-0.5 ${
                                item.opGroup === 'SHIPMENT'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              }`}
                            >
                              {item.opGroup === 'SHIPMENT' ? 'Shipment' : 'Wisma'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            Rp {item.baseSalary.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            +Rp {item.monthOtPay.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                            -Rp {item.bpjsTk.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                            -Rp {item.bpjsKes.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                            {item.alpaDeduction > 0 ? `-Rp ${item.alpaDeduction.toLocaleString('id-ID')}` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            Rp 0
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-primary">
                            Rp {item.netSalary.toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Summary Bar */}
              <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium">
                  Aturan Baku: <strong className="text-foreground">Upah Pokok Tunggal</strong> (Tanpa Tunjangan, PPh 21 Rp 0, BPJS 4% Baku)
                </span>
                <div className="flex items-center gap-4 font-mono font-bold text-xs">
                  <span>Total Pokok: <span className="text-foreground">Rp {filteredList.reduce((s, i) => s + i.baseSalary, 0).toLocaleString('id-ID')}</span></span>
                  <span>Total Lembur: <span className="text-emerald-600">Rp {filteredList.reduce((s, i) => s + i.monthOtPay, 0).toLocaleString('id-ID')}</span></span>
                  <span>Total Netto (THP): <span className="text-primary">Rp {filteredList.reduce((s, i) => s + i.netSalary, 0).toLocaleString('id-ID')}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REKAPAN LEMBUR & PERSONIL PER DIVISI */}
          {activeTab === 'division_overtime' && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[48vh]">
                <Table>
                  <TableHeader className="bg-indigo-500/10 sticky top-0 z-10">
                    <TableRow className="text-[11px] font-semibold text-muted-foreground border-b border-border">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="min-w-[180px]">Nama Divisi / Pos Penugasan</TableHead>
                      <TableHead className="min-w-[120px]">Grup Operasional</TableHead>
                      <TableHead className="min-w-[100px] text-center">Total Personil</TableHead>
                      <TableHead className="min-w-[110px] text-center">Personil Lembur</TableHead>
                      <TableHead className="min-w-[100px] text-center">Frekuensi SPKL</TableHead>
                      <TableHead className="min-w-[100px] text-center">Total Jam Lembur</TableHead>
                      <TableHead className="min-w-[140px] text-right">Total Nominal Lembur (Rp)</TableHead>
                      <TableHead className="min-w-[130px] text-right">Rata-rata / Org</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60 text-xs">
                    {filteredDivisions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                          Tidak ada data divisi yang cocok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDivisions.map((d, idx) => (
                        <TableRow key={d.divisionName} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground text-xs">
                            {d.divisionName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[9.5px] px-1.5 py-0.2 rounded-md ${
                                d.opGroup === 'SHIPMENT'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              }`}
                            >
                              {d.opGroup === 'SHIPMENT' ? '47 Shiftman Lapangan' : '33 Wisma Biring Ere'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono font-medium text-xs">
                            {d.totalEmployees} Orang
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                            {d.overtimeEmployeeCount} Orang
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {d.totalSpklCount}x SPKL
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs text-foreground">
                            {d.totalHours} Jam
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            Rp {d.totalPay.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            Rp {(d.totalEmployees > 0 ? Math.round(d.totalPay / d.totalEmployees) : 0).toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Summary Bar */}
              <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium">
                  Total Divisi: <strong className="text-foreground">{filteredDivisions.length} Divisi</strong> • Total Personil: <strong className="text-foreground">{filteredDivisions.reduce((s, d) => s + d.totalEmployees, 0)} Orang</strong>
                </span>
                <div className="flex items-center gap-4 font-mono font-bold text-xs">
                  <span>Total Jam Lembur: <span className="text-foreground">{filteredDivisions.reduce((s, d) => s + d.totalHours, 0)} Jam</span></span>
                  <span>Total Kompensasi: <span className="text-emerald-600">Rp {filteredDivisions.reduce((s, d) => s + d.totalPay, 0).toLocaleString('id-ID')}</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
