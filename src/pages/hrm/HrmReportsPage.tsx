import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import {
  AttendanceRecord,
  AttendanceStatus,
  Division,
  AppSettings,
  OfficeLocation,
  OvertimeRecord,
  UserProfile,
  Shift,
  isOfficialFrEmployee,
  LeaveRequest,
  EmployeeCategoryGroup,
  getEmployeeCategoryGroup,
  getEmployeeCategoryLabel,
  PayrollSlip,
} from '@/types/hrm';
import { HrmAbsenSplModal } from '@/components/hrm/HrmAbsenSplModal';
import { HrmEmployeeMonthlyCalendarModal } from '@/components/hrm/HrmEmployeeMonthlyCalendarModal';
import { HrmLeaveOvertimeLiabilityView } from '@/components/hrm/HrmLeaveOvertimeLiabilityView';
import { HrmSalarySlipModal } from '@/components/hrm/HrmSalarySlipModal';
import { HrmManualLemburModal } from '@/components/hrm/superadmin/HrmManualLemburModal';
import { HrmEditLemburModal } from '@/components/hrm/superadmin/HrmEditLemburModal';
import { HrmManualLeaveModal } from '@/components/hrm/superadmin/HrmManualLeaveModal';
import { HrmEmployeeLeaveCorrectionModal } from '@/components/hrm/HrmEmployeeLeaveCorrectionModal';
import { HrmTimeSheetPdfModal } from '@/components/hrm/HrmTimeSheetPdfModal';
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
  XCircle,
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
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Info,
  CalendarCheck,
  Paperclip,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export type ReportTab = 'overtime' | 'payroll' | 'leaves' | 'attendance' | 'liability';

export const HrmReportsPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('overtime');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(hrmService.getAppSettings());
  const [office, setOffice] = useState<OfficeLocation>(hrmService.getOfficeLocation());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA');

  // Universal Navigation & Fiscal Period
  const fiscalPeriod = hrmService.getFiscalPeriod();
  const defaultFiscalMonthStr = `${fiscalPeriod.activeYear}-${String(fiscalPeriod.activeMonth).padStart(2, '0')}`;
  const currentMonthStr = getTodayDateStr().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultFiscalMonthStr || currentMonthStr);
  const [filterCategory, setFilterCategory] = useState<'all' | EmployeeCategoryGroup>('all');
  const [filterDivision, setFilterDivision] = useState<string>('all');

  // Month Math Helpers
  const [selectedYearNum, selectedMonthNum] = useMemo(() => {
    const parts = (selectedMonth || currentMonthStr).split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth, currentMonthStr]);

  const selectedMonthLabel = useMemo(() => {
    const d = new Date(selectedYearNum, selectedMonthNum - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedYearNum, selectedMonthNum]);

  const prevMonthStr = useMemo(() => {
    let y = selectedYearNum;
    let m = selectedMonthNum - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }, [selectedYearNum, selectedMonthNum]);

  const prevMonthLabel = useMemo(() => {
    const [y, m] = prevMonthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [prevMonthStr]);

  const nextMonthStr = useMemo(() => {
    let y = selectedYearNum;
    let m = selectedMonthNum + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }, [selectedYearNum, selectedMonthNum]);

  const nextMonthLabel = useMemo(() => {
    const [y, m] = nextMonthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [nextMonthStr]);

  const goToPrevMonth = () => setSelectedMonth(prevMonthStr);
  const goToCurrentMonth = () => setSelectedMonth(currentMonthStr);
  const goToNextMonth = () => setSelectedMonth(nextMonthStr);

  // ── Overtime Tab State ──────────────────────────────────────────────────────
  const [otSearchQuery, setOtSearchQuery] = useState('');
  const [filterOtStatus, setFilterOtStatus] = useState<string>('all');
  const [filterOtPayment, setFilterOtPayment] = useState<string>('all');
  const [manualOtModalOpen, setManualOtModalOpen] = useState(false);
  const [editOtModalOpen, setEditOtModalOpen] = useState(false);
  const [editingOtRecord, setEditingOtRecord] = useState<OvertimeRecord | null>(null);
  const [otPrintModalOpen, setOtPrintModalOpen] = useState(false);
  const [timeSheetModalOpen, setTimeSheetModalOpen] = useState(false);

  // ── Payroll Tab State ───────────────────────────────────────────────────────
  const [payrollSearchQuery, setPayrollSearchQuery] = useState('');
  const [salarySlipModalOpen, setSalarySlipModalOpen] = useState(false);
  const [selectedPayrollSlip, setSelectedPayrollSlip] = useState<PayrollSlip | null>(null);

  // ── Leaves Tab State ────────────────────────────────────────────────────────
  const [leaveSearchQuery, setLeaveSearchQuery] = useState('');
  const [leaveSubView, setLeaveSubView] = useState<'requests' | 'ledger'>('requests');
  const [manualLeaveModalOpen, setManualLeaveModalOpen] = useState(false);
  const [leaveCorrectionModalOpen, setLeaveCorrectionModalOpen] = useState(false);
  const [selectedCorrectionUser, setSelectedCorrectionUser] = useState<UserProfile | null>(null);

  // ── Attendance Tab State ────────────────────────────────────────────────────
  const [attendanceViewMode, setAttendanceViewMode] = useState<'recap' | 'logs'>('recap');
  const [attSearchQuery, setAttSearchQuery] = useState('');
  const [attDateFilter, setAttDateFilter] = useState('');
  const [absenSplModalOpen, setAbsenSplModalOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [selectedCalendarUser, setSelectedCalendarUser] = useState<UserProfile | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Inline Manual Attendance Modal State
  const [manualAttOpen, setManualAttOpen] = useState(false);
  const [manualAttUserId, setManualAttUserId] = useState('');
  const [manualAttDate, setManualAttDate] = useState(getTodayDateStr());
  const [manualAttStatus, setManualAttStatus] = useState<AttendanceStatus>('hadir');
  const [manualAttClockIn, setManualAttClockIn] = useState('07:30');
  const [manualAttClockOut, setManualAttClockOut] = useState('16:30');
  const [manualAttNotes, setManualAttNotes] = useState('');
  const [isSubmittingAtt, setIsSubmittingAtt] = useState(false);

  // Inline Attendance Correction Modal State
  const [correctAttOpen, setCorrectAttOpen] = useState(false);
  const [selectedAttRecord, setSelectedAttRecord] = useState<AttendanceRecord | null>(null);
  const [corrStatus, setCorrStatus] = useState<AttendanceStatus>('hadir');
  const [corrClockIn, setCorrClockIn] = useState('');
  const [corrClockOut, setCorrClockOut] = useState('');
  const [corrLateMinutes, setCorrLateMinutes] = useState(0);
  const [corrNotes, setCorrNotes] = useState('');

  // Signatures for formal printouts
  const [leaderSignName, setLeaderSignName] = useState('Alam AS simpuang ago, S.Sos');
  const [hrdSignName, setHrdSignName] = useState(user?.fullName || 'Bpk Reski Faisal');
  const [financeSignName, setFinanceSignName] = useState('Bagian Keuangan / Payroll FRP');

  // Load Data from APIs & Store
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setDivisions(hrmService.getDivisions());
      setAppSettings(hrmService.getAppSettings());
      setOffice(hrmService.getOfficeLocation());
      setAllShifts(hrmService.getShifts());

      // 1. Fetch Users
      try {
        const uRes = await fetch('/api/users');
        if (uRes.ok) {
          const uJson = await uRes.json();
          if (uJson.success && Array.isArray(uJson.data)) {
            const frUsers = uJson.data.filter((u: any) => u.isActive && isOfficialFrEmployee(u));
            if (frUsers.length > 0) setEmployees(frUsers);
          }
        }
      } catch (e) {
        setEmployees(hrmService.getUsers().filter((u) => u.isActive && isOfficialFrEmployee(u)));
      }

      // 2. Fetch Attendances for selectedMonth
      try {
        const aRes = await fetch(`/api/attendances?month=${selectedMonth}`);
        if (aRes.ok) {
          const aJson = await aRes.json();
          if (aJson.success && Array.isArray(aJson.data)) {
            const frAtts = aJson.data.filter((a: any) => isOfficialFrEmployee(a.userNip));
            setAttendances(frAtts);
          }
        }
      } catch (e) {
        setAttendances(hrmService.getAttendances().filter((a) => isOfficialFrEmployee(a.userNip)));
      }

      // 3. Fetch Overtimes
      try {
        const oRes = await fetch('/api/overtime');
        if (oRes.ok) {
          const oJson = await oRes.json();
          if (oJson.success && Array.isArray(oJson.data)) {
            const frOts = oJson.data.filter((o: any) => isOfficialFrEmployee(o.userNip));
            setOvertimes(frOts);
          }
        }
      } catch (e) {
        setOvertimes(hrmService.getOvertimeRecords().filter((o) => isOfficialFrEmployee(o.userNip)));
      }

      // 4. Fetch Leaves
      try {
        const lRes = await fetch('/api/leaves');
        if (lRes.ok) {
          const lJson = await lRes.json();
          if (lJson.success && Array.isArray(lJson.data)) {
            const frLeaves = lJson.data.filter((l: any) => isOfficialFrEmployee(l.userNip || l.userId));
            setLeaves(frLeaves);
          }
        }
      } catch (e) {
        setLeaves(hrmService.getLeaves().filter((l) => isOfficialFrEmployee(l.userNip || l.userId)));
      }

      setLastSyncTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling Real-time 30s
  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB 1: OVERTIME (LEMBUR SPKL) & BUDGET CALCULATIONS
  // ══════════════════════════════════════════════════════════════════════════════
  const monthOvertimes = useMemo(() => {
    return overtimes.filter((o) => o.date && o.date.startsWith(selectedMonth));
  }, [overtimes, selectedMonth]);

  const approvedMonthOvertimes = useMemo(() => {
    return monthOvertimes.filter((o) => o.status === 'approved');
  }, [monthOvertimes]);

  const shipmentApprovedOts = useMemo(() => {
    return approvedMonthOvertimes.filter((o) => getEmployeeCategoryGroup(o.userNip || o.userId) === 'SHIPMENT');
  }, [approvedMonthOvertimes]);

  const wismaApprovedOts = useMemo(() => {
    return approvedMonthOvertimes.filter((o) => getEmployeeCategoryGroup(o.userNip || o.userId) === 'RUMAH TANGGA');
  }, [approvedMonthOvertimes]);

  // Nominal Calculations
  const shipmentUsed = useMemo(() => {
    return shipmentApprovedOts.reduce((sum, o) => sum + (Number(o.totalPay || o.compensationAmount) || 0), 0);
  }, [shipmentApprovedOts]);

  const wismaUsed = useMemo(() => {
    return wismaApprovedOts.reduce((sum, o) => sum + (Number(o.totalPay || o.compensationAmount) || 0), 0);
  }, [wismaApprovedOts]);

  const shipmentCap = 65000000; // Plafon Resmi Shipment: Rp 65 Juta
  const wismaCap = 4000000;    // Plafon Resmi Rumah Tangga: Rp 4 Juta
  const totalCap = 69000000;   // Plafon Resmi Total: Rp 69 Juta

  const shipmentRemaining = Math.max(0, shipmentCap - shipmentUsed);
  const wismaRemaining = Math.max(0, wismaCap - wismaUsed);
  const totalUsed = shipmentUsed + wismaUsed;
  const totalRemaining = Math.max(0, totalCap - totalUsed);

  const shipmentPct = Math.min(100, Math.round((shipmentUsed / shipmentCap) * 100));
  const wismaPct = Math.min(100, Math.round((wismaUsed / wismaCap) * 100));
  const totalPct = Math.min(100, Math.round((totalUsed / totalCap) * 100));

  // Filtered Overtime List for Table
  const filteredOtList = useMemo(() => {
    return monthOvertimes.filter((o) => {
      const cat = getEmployeeCategoryGroup(o.userNip || o.userId);
      if (filterCategory !== 'all' && cat !== filterCategory) return false;
      if (filterDivision !== 'all' && o.divisionName !== filterDivision) return false;
      if (filterOtStatus !== 'all' && o.status !== filterOtStatus) return false;
      if (filterOtPayment !== 'all') {
        const pay = o.paymentStatus || 'unpaid';
        if (pay !== filterOtPayment) return false;
      }
      if (otSearchQuery.trim()) {
        const q = otSearchQuery.toLowerCase();
        const mName = (o.userName || '').toLowerCase().includes(q);
        const mNip = (o.userNip || '').toLowerCase().includes(q);
        const mTask = (o.taskDescription || '').toLowerCase().includes(q);
        if (!mName && !mNip && !mTask) return false;
      }
      return true;
    });
  }, [monthOvertimes, filterCategory, filterDivision, filterOtStatus, filterOtPayment, otSearchQuery]);

  // Handlers for Overtime CRUD
  const handleUpdateOtStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const res: any = await api.put(`/overtime/${id}/status`, {
        status: newStatus,
        approvedByName: user?.fullName || 'Super Admin',
      });
      if (res?.success) {
        toast.success(`Pengajuan lembur berhasil ${newStatus === 'approved' ? 'disetujui' : 'ditolak'}`);
        loadData();
      } else {
        toast.error(res?.error || 'Gagal memperbarui status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui status lembur');
    }
  };

  const handleDeleteOt = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus catatan lembur untuk ${name}?`)) return;
    try {
      const res: any = await api.delete(`/overtime/${id}`);
      if (res?.success) {
        toast.success('Catatan lembur berhasil dihapus');
        loadData();
      } else {
        toast.error(res?.error || 'Gagal menghapus lembur');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus lembur');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB 2: PAYROLL (PENGGAJIAN) CALCULATIONS
  // ══════════════════════════════════════════════════════════════════════════════
  // Aturan Resmi: Lembur N-1 (dari bulan sebelumnya) otomatis cair di bulan selectedMonth
  const prevMonthApprovedOts = useMemo(() => {
    return overtimes.filter((o) => o.date && o.date.startsWith(prevMonthStr) && o.status === 'approved');
  }, [overtimes, prevMonthStr]);

  const payrollRows = useMemo(() => {
    return employees
      .filter((emp) => {
        const cat = getEmployeeCategoryGroup(emp.nip || emp.id);
        if (filterCategory !== 'all' && cat !== filterCategory) return false;
        if (filterDivision !== 'all' && emp.divisionName !== filterDivision) return false;
        if (payrollSearchQuery.trim()) {
          const q = payrollSearchQuery.toLowerCase();
          const mName = (emp.fullName || '').toLowerCase().includes(q);
          const mNip = (emp.nip || '').toLowerCase().includes(q);
          if (!mName && !mNip) return false;
        }
        return true;
      })
      .map((emp) => {
        const group = getEmployeeCategoryGroup(emp.nip || emp.id);
        const empNipNorm = (emp.nip || '').replace(/[\s.]/g, '').toUpperCase();

        // Overtime N-1 for this employee
        const empPrevOts = prevMonthApprovedOts.filter((o) => {
          const oNipNorm = (o.userNip || '').replace(/[\s.]/g, '').toUpperCase();
          return (empNipNorm && oNipNorm && empNipNorm === oNipNorm) || o.userId === emp.id || o.userNip === emp.nip;
        });

        const overtimeHours = empPrevOts.reduce((sum, o) => sum + (Number(o.durationHours) || 0), 0);
        const overtimePay = empPrevOts.reduce((sum, o) => sum + (Number(o.totalPay || o.compensationAmount) || 0), 0);

        // Attendance stats in selectedMonth
        const empAtts = attendances.filter((a) => {
          const aNipNorm = (a.userNip || '').replace(/[\s.]/g, '').toUpperCase();
          const inMonth = (a.attendanceDate || '').startsWith(selectedMonth);
          return inMonth && ((empNipNorm && aNipNorm && empNipNorm === aNipNorm) || a.userId === emp.id || a.userNip === emp.nip);
        });

        const hadirDays = empAtts.filter((a) => a.status === 'hadir').length;
        const alpaDays = empAtts.filter((a) => a.status === 'mangkir').length;
        const lateMins = empAtts.reduce((s, a) => s + (Number(a.lateMinutes) || 0), 0);

        // Special handling for Karyawan Tetap (Muh Aslam Faisal, La Unga Samsi, Takdir):
        // Upah Harian Rp 140.000 / hari, Tanpa BPJS & Lembur
        const isKaryawanTetap = group === 'KARYAWAN TETAP';
        const baseSalary = isKaryawanTetap ? (hadirDays > 0 ? hadirDays * 140000 : 25 * 140000) : (Number(emp.salary) || 4045050);

        // Potongan Resmi PT FRP:
        // BPJS TK 3% (121.351), BPJS Kes 1% (40.450), Alpa, PPh 21 = Rp 0
        const bpjsTk = isKaryawanTetap ? 0 : 121351;
        const bpjsKes = isKaryawanTetap ? 0 : 40450;
        const alpaDeduction = isKaryawanTetap ? 0 : alpaDays * (4045050 / 25);
        const lateDeduction = isKaryawanTetap ? lateMins * 1000 : 0;
        const totalDeductions = bpjsTk + bpjsKes + alpaDeduction + lateDeduction;

        const effectiveOvertimePay = isKaryawanTetap ? 0 : overtimePay;
        const netSalary = Math.round(baseSalary + effectiveOvertimePay - totalDeductions);

        return {
          employee: emp,
          group,
          isKaryawanTetap,
          baseSalary,
          overtimeHours,
          overtimePay: effectiveOvertimePay,
          bpjsTk,
          bpjsKes,
          alpaDays,
          alpaDeduction,
          lateMins,
          lateDeduction,
          totalDeductions,
          netSalary,
          hadirDays,
        };
      });
  }, [employees, filterCategory, filterDivision, payrollSearchQuery, prevMonthApprovedOts, attendances, selectedMonth]);

  const totalPayrollGross = useMemo(() => {
    return payrollRows.reduce((sum, r) => sum + r.baseSalary + r.overtimePay, 0);
  }, [payrollRows]);

  const totalPayrollDeductions = useMemo(() => {
    return payrollRows.reduce((sum, r) => sum + r.totalDeductions, 0);
  }, [payrollRows]);

  const totalPayrollNet = useMemo(() => {
    return payrollRows.reduce((sum, r) => sum + r.netSalary, 0);
  }, [payrollRows]);

  const totalOvertimeArrearsPay = useMemo(() => {
    return payrollRows.reduce((sum, r) => sum + r.overtimePay, 0);
  }, [payrollRows]);

  const handleOpenSlip = (row: any) => {
    const slipObj: PayrollSlip = {
      id: `slip-${row.employee.id}-${selectedMonth}`,
      periodId: `period-${selectedMonth}`,
      userId: row.employee.id,
      userNip: row.employee.nip || '-',
      userName: row.employee.fullName,
      divisionName: row.employee.divisionName || '-',
      periodLabel: selectedMonthLabel,
      baseSalary: row.baseSalary,
      overtimeHours: row.overtimeHours,
      overtimePay: row.overtimePay,
      lateDeduction: row.lateDeduction,
      totalLateMinutes: row.lateMins,
      absentCount: row.alpaDays,
      absenceDeduction: row.alpaDeduction,
      allowancesTotal: 0,
      deductionsTotal: row.totalDeductions,
      netSalary: row.netSalary,
      status: 'approved',
      bankName: row.employee.bankName || 'Bank Mandiri',
      bankAccount: row.employee.bankAccount || '-',
      bankAccountHolder: row.employee.fullName,
    };
    setSelectedPayrollSlip(slipObj);
    setSalarySlipModalOpen(true);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB 3: LEAVES (CUTI & IZIN) CALCULATIONS
  // ══════════════════════════════════════════════════════════════════════════════
  const monthLeaves = useMemo(() => {
    return leaves.filter((l) => {
      const inMonth = (l.startDate && l.startDate.startsWith(selectedMonth)) || (l.endDate && l.endDate.startsWith(selectedMonth));
      return inMonth;
    });
  }, [leaves, selectedMonth]);

  const filteredLeaves = useMemo(() => {
    return monthLeaves.filter((l) => {
      const cat = getEmployeeCategoryGroup((l as any).userNip || l.userId);
      if (filterCategory !== 'all' && cat !== filterCategory) return false;
      if (leaveSearchQuery.trim()) {
        const q = leaveSearchQuery.toLowerCase();
        const mName = ((l as any).userName || '').toLowerCase().includes(q);
        const mNip = ((l as any).userNip || '').toLowerCase().includes(q);
        const mReason = (l.reason || '').toLowerCase().includes(q);
        if (!mName && !mNip && !mReason) return false;
      }
      return true;
    });
  }, [monthLeaves, filterCategory, leaveSearchQuery]);

  const handleUpdateLeaveStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res: any = await api.put(`/leaves/${id}/status`, {
        status,
        approvalNotes: `Diproses oleh ${user?.fullName || 'Superadmin'}`,
      });
      if (res?.success) {
        toast.success(`Pengajuan cuti berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}`);
        loadData();
      } else {
        toast.error(res?.error || 'Gagal memperbarui status cuti');
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal memperbarui cuti');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // TAB 4: ATTENDANCE & LATENESS CALCULATIONS
  // ══════════════════════════════════════════════════════════════════════════════
  const monthAttendances = useMemo(() => {
    return attendances.filter((a) => (a.attendanceDate || (a as any).date || '').startsWith(selectedMonth));
  }, [attendances, selectedMonth]);

  // Monthly Employee Recap Matrix
  const monthlyRecap = useMemo(() => {
    return employees
      .filter((emp) => {
        const cat = getEmployeeCategoryGroup(emp.nip || emp.id);
        if (filterCategory !== 'all' && cat !== filterCategory) return false;
        if (filterDivision !== 'all' && emp.divisionName !== filterDivision) return false;
        if (attSearchQuery.trim()) {
          const q = attSearchQuery.toLowerCase();
          const mName = (emp.fullName || '').toLowerCase().includes(q);
          const mNip = (emp.nip || '').toLowerCase().includes(q);
          if (!mName && !mNip) return false;
        }
        return true;
      })
      .map((emp) => {
        const empNipNorm = (emp.nip || '').replace(/[\s.]/g, '').toUpperCase();
        const empAtts = monthAttendances.filter((a) => {
          const aNipNorm = (a.userNip || '').replace(/[\s.]/g, '').toUpperCase();
          return (empNipNorm && aNipNorm && empNipNorm === aNipNorm) || a.userId === emp.id || a.userNip === emp.nip;
        });

        const hadir = empAtts.filter((a) => a.status === 'hadir').length;
        const telat = empAtts.filter((a) => (a.lateMinutes || 0) > 0).length;
        const totalLateMins = empAtts.reduce((s, a) => s + (Number(a.lateMinutes) || 0), 0);
        const alpa = empAtts.filter((a) => a.status === 'mangkir').length;
        const cuti = empAtts.filter((a) => a.status === 'cuti').length;
        const sakit = empAtts.filter((a) => a.status === 'sakit').length;
        const izin = empAtts.filter((a) => a.status === 'izin').length;
        const off = empAtts.filter((a) => a.status === 'off' || a.status === 'libur').length;

        const isFaceEnrolled = Boolean(
          emp.isFaceEnrolled || emp.faceEnrolledPhoto || (emp.faceDescriptor && (emp.faceDescriptor as any).length > 0)
        );

        return {
          employee: emp,
          group: getEmployeeCategoryGroup(emp.nip || emp.id),
          hadir,
          telat,
          totalLateMins,
          alpa,
          cuti,
          sakit,
          izin,
          off,
          isFaceEnrolled,
        };
      });
  }, [employees, filterCategory, filterDivision, attSearchQuery, monthAttendances]);

  // Ranking Keterlambatan
  const latenessRanking = useMemo(() => {
    return monthlyRecap.filter((r) => r.totalLateMins > 0).sort((a, b) => b.totalLateMins - a.totalLateMins);
  }, [monthlyRecap]);

  // Handlers for Manual Attendance
  const handleSaveManualAttendance = async () => {
    if (!manualAttUserId) {
      toast.error('Pilih karyawan terlebih dahulu');
      return;
    }
    try {
      setIsSubmittingAtt(true);
      const res: any = await api.post('/attendances/manual-entry', {
        userId: manualAttUserId,
        attendanceDate: manualAttDate,
        status: manualAttStatus,
        clockIn: manualAttClockIn,
        clockOut: manualAttClockOut,
        notes: manualAttNotes || 'Presensi Manual Superadmin',
      });
      if (res?.success) {
        toast.success('Presensi manual berhasil dicatat');
        setManualAttOpen(false);
        loadData();
      } else {
        toast.error(res?.error || 'Gagal menyimpan presensi');
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal input presensi');
    } finally {
      setIsSubmittingAtt(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!selectedAttRecord) return;
    try {
      setIsSubmittingAtt(true);
      const res: any = await api.put(`/attendances/${selectedAttRecord.id}/manual-correct`, {
        status: corrStatus,
        clockIn: corrClockIn,
        clockOut: corrClockOut,
        lateMinutes: corrLateMinutes,
        notes: corrNotes,
      });
      if (res?.success) {
        toast.success('Koreksi presensi berhasil disimpan');
        setCorrectAttOpen(false);
        loadData();
      } else {
        toast.error(res?.error || 'Gagal menyimpan koreksi');
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal koreksi presensi');
    } finally {
      setIsSubmittingAtt(false);
    }
  };

  // Export to Excel Helpers
  const exportOvertimeExcel = () => {
    const data = filteredOtList.map((o, idx) => ({
      No: idx + 1,
      Tanggal: o.date,
      NIP: o.userNip,
      Nama: o.userName,
      Kelompok: getEmployeeCategoryLabel(getEmployeeCategoryGroup(o.userNip || o.userId)),
      Divisi: o.divisionName || '-',
      'Jam Mulai': o.startTime,
      'Jam Selesai': o.endTime,
      'Durasi (Jam)': o.durationHours,
      'Jam Bayar': o.durationHours,
      'Total Uang Lembur (Rp)': Number(o.totalPay || o.compensationAmount || 0),
      'Uraian Tugas': o.taskDescription,
      Status: o.status.toUpperCase(),
      Pencairan: o.paymentStatus === 'paid' ? 'LUNAS' : o.paymentStatus === 'included_in_payroll' ? 'MASUK SLIP' : 'BELUM CAIR',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Lembur');
    XLSX.writeFile(wb, `Rekap_Lembur_FRP_${selectedMonth}.xlsx`);
  };

  const exportPayrollExcel = () => {
    const data = payrollRows.map((r, idx) => ({
      No: idx + 1,
      NIP: r.employee.nip,
      Nama: r.employee.fullName,
      Kelompok: getEmployeeCategoryLabel(r.group),
      Divisi: r.employee.divisionName || '-',
      'Gaji Pokok (Rp)': r.baseSalary,
      'Uang Lembur N-1 (Rp)': r.overtimePay,
      'BPJS Ketenagakerjaan 3% (Rp)': r.bpjsTk,
      'BPJS Kesehatan 1% (Rp)': r.bpjsKes,
      'Potongan Alpa (Rp)': r.alpaDeduction,
      'Potongan PPh 21 (Rp)': 0,
      'Gaji Bersih / THP (Rp)': r.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Payroll');
    XLSX.writeFile(wb, `Rekap_Payroll_FRP_${selectedMonth}.xlsx`);
  };

  const exportAttendanceExcel = () => {
    const data = monthlyRecap.map((r, idx) => ({
      No: idx + 1,
      NIP: r.employee.nip,
      Nama: r.employee.fullName,
      Kelompok: getEmployeeCategoryLabel(r.group),
      Divisi: r.employee.divisionName || '-',
      Hadir: r.hadir,
      'Terlambat (Kali)': r.telat,
      'Total Menit Telat': r.totalLateMins,
      Alpa: r.alpa,
      Cuti: r.cuti,
      Sakit: r.sakit,
      Izin: r.izin,
      'Off / Libur': r.off,
      'Biometrik Wajah': r.isFaceEnrolled ? 'Terdaftar' : 'Belum Registrasi',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');
    XLSX.writeFile(wb, `Rekap_Presensi_FRP_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TOP UNIVERSAL HEADER & CONTROLLER BAR */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-4 md:p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
              PUSAT REKAP &amp; CRUD TERPADU
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
              <RotateCw size={11} className={isLoading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
              Sync: {lastSyncTime}
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight mt-1 flex items-center gap-2">
            PT. FAWWAZ RESKI PERWIRA
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            Pengawasan, Laporan Resmi, dan Eksekusi CRUD Operasional: Lembur (SPKL), Penggajian (Payroll), Cuti/Izin, dan Presensi.
          </p>
        </div>

        {/* Quick Month Switcher (1-Click: Bulan Lalu, Berjalan, Depan) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={goToPrevMonth}
              title={`Beralih ke Bulan Lalu (${prevMonthLabel})`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Bulan Lalu:</span>
              <span className="font-semibold">{prevMonthLabel.split(' ')[0]}</span>
            </button>

            <button
              type="button"
              onClick={goToCurrentMonth}
              title="Beralih ke Bulan Berjalan"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedMonth === currentMonthStr
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
              }`}
            >
              <span>📍 Bulan Berjalan</span>
            </button>

            <button
              type="button"
              onClick={goToNextMonth}
              title={`Beralih ke Bulan Depan (${nextMonthLabel})`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all flex items-center gap-1"
            >
              <span className="hidden sm:inline">Bulan Depan:</span>
              <span className="font-semibold">{nextMonthLabel.split(' ')[0]}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Month Picker for Custom Months */}
          <div className="flex items-center gap-1">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="h-9 text-xs rounded-xl w-36 font-mono font-medium"
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* GLOBAL GROUP SELECTOR PILLS (Semua, Shipment, Rumah Tangga, Tetap) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-muted/40 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground px-2">Kelompok Resmi:</span>
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            <Users size={13} />
            <span>Semua Personil ({employees.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory('SHIPMENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterCategory === 'SHIPMENT'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10'
            }`}
          >
            <span>🚢</span>
            <span>Shipment (47 Orang • FR07034–80)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory('RUMAH TANGGA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterCategory === 'RUMAH TANGGA'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'
            }`}
          >
            <span>🏡</span>
            <span>Rumah Tangga (33 Orang • FR07001–33)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory('KARYAWAN TETAP')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterCategory === 'KARYAWAN TETAP'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10'
            }`}
          >
            <span>⭐</span>
            <span>Karyawan Tetap (3 Orang Lapangan)</span>
          </button>
        </div>

        {/* Division Dropdown */}
        <div className="w-48">
          <Select value={filterDivision} onValueChange={setFilterDivision}>
            <SelectTrigger className="text-xs rounded-xl h-8">
              <SelectValue placeholder="Semua Divisi / Pos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Divisi / Pos</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5 MAIN TABS SWITCHER */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overtime')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overtime'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Coins size={15} />
          <span>💰 Rekapan &amp; CRUD Lembur (SPKL)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'payroll'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Wallet size={15} />
          <span>💵 Rekapan &amp; CRUD Payroll</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'leaves'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <CalendarDays size={15} />
          <span>🏖️ Rekapan &amp; CRUD Cuti / Izin</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>⏱️ Presensi &amp; Keterlambatan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('liability')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'liability'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <ShieldAlert size={15} />
          <span>⚖️ Audit Kewajiban &amp; Cuti</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: OVERTIME (LEMBUR SPKL) & BUDGET SEPARATION */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overtime' && (
        <div className="space-y-6">
          {/* Official Budget Separation Cards: Shipment 65 Jt vs Wisma 4 Jt */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Shipment: Plafon Rp 65 Jt */}
            <Card className="border-sky-500/30 bg-card rounded-2xl shadow-xs overflow-hidden relative">
              <div className="h-1.5 w-full bg-sky-500" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                    🚢 GRUP SHIPMENT (47 Personil)
                  </span>
                  <Badge variant="outline" className={`text-[10px] font-bold ${
                    shipmentUsed > 60000000
                      ? 'bg-rose-500/10 text-rose-700 border-rose-500/30'
                      : shipmentUsed > 55000000
                      ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                  }`}>
                    {shipmentUsed > 60000000 ? 'Strict Gate' : shipmentUsed > 55000000 ? 'Early Warning' : 'Aman'}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Plafon Anggaran Sah:</span>
                    <span className="text-xl font-black font-mono text-foreground">
                      Rp {shipmentCap.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">Terpakai ({shipmentPct}%):</span>
                    <span className="text-lg font-bold font-mono text-sky-600">
                      Rp {shipmentUsed.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      shipmentUsed > 60000000 ? 'bg-rose-500' : shipmentUsed > 55000000 ? 'bg-amber-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${shipmentPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">Sisa Anggaran:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    Rp {shipmentRemaining.toLocaleString('id-ID')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card Rumah Tangga: Plafon Rp 4 Jt */}
            <Card className="border-emerald-500/30 bg-card rounded-2xl shadow-xs overflow-hidden relative">
              <div className="h-1.5 w-full bg-emerald-500" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    🏡 RUMAH TANGGA (33 Personil)
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    {wismaUsed > 4000000 ? 'Overbudget' : 'Aman'}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Plafon Anggaran Sah:</span>
                    <span className="text-xl font-black font-mono text-foreground">
                      Rp {wismaCap.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">Terpakai ({wismaPct}%):</span>
                    <span className="text-lg font-bold font-mono text-emerald-600">
                      Rp {wismaUsed.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all rounded-full"
                    style={{ width: `${wismaPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">Sisa Anggaran:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    Rp {wismaRemaining.toLocaleString('id-ID')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Total Resmi PT FRP: Plafon Rp 69 Jt */}
            <Card className="border-primary/30 bg-card rounded-2xl shadow-xs overflow-hidden relative">
              <div className="h-1.5 w-full bg-primary" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    💼 TOTAL RESMI PERUSAHAAN
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/30">
                    80 Personil Sah
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Total Plafon:</span>
                    <span className="text-xl font-black font-mono text-foreground">
                      Rp {totalCap.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">Total Terpakai:</span>
                    <span className="text-lg font-bold font-mono text-primary">
                      Rp {totalUsed.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{ width: `${totalPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">Total Sisa Anggaran:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    Rp {totalRemaining.toLocaleString('id-ID')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Arrears Synchronized Banner */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>Aturan Baku Payroll N-1:</strong> Realisasi lembur sah bulan <strong>{selectedMonthLabel}</strong> sebesar <strong>Rp {totalUsed.toLocaleString('id-ID')}</strong> akan otomatis masuk dan dibayarkan pada slip gaji periode <strong>{nextMonthLabel}</strong>.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('payroll')}
              className="h-7 text-[11px] gap-1 font-semibold rounded-lg border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
            >
              Lihat di Tab Payroll <ArrowRight size={12} />
            </Button>
          </div>

          {/* Overtime Toolbar & CRUD Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari NIP, nama karyawan, tugas..."
                  value={otSearchQuery}
                  onChange={(e) => setOtSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>

              <Select value={filterOtStatus} onValueChange={setFilterOtStatus}>
                <SelectTrigger className="w-36 h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Status Approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setManualOtModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-9 rounded-xl font-bold shadow-sm"
              >
                <Plus size={14} /> + Input Lembur Manual
              </Button>
              <Button
                onClick={() => setTimeSheetModalOpen(true)}
                className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs gap-1.5 h-9 rounded-xl font-bold shadow-sm"
              >
                <FileSpreadsheet size={14} /> Cetak Time Sheet Resmi FRP (PDF)
              </Button>
              <Button
                variant="outline"
                onClick={() => setOtPrintModalOpen(true)}
                className="text-xs gap-1.5 h-9 rounded-xl"
              >
                <Printer size={14} /> Cetak Rekap SPL
              </Button>
              <Button
                variant="outline"
                onClick={exportOvertimeExcel}
                className="text-xs gap-1.5 h-9 rounded-xl text-emerald-700 border-emerald-500/40 hover:bg-emerald-50"
              >
                <FileSpreadsheet size={14} /> Ekspor Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* Overtime Table with Full CRUD Action Buttons */}
          <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Daftar Rekapitulasi &amp; CRUD Surat Perintah Kerja Lembur (SPKL)</h3>
                <p className="text-xs text-muted-foreground">
                  Menampilkan {filteredOtList.length} data lembur periode {selectedMonthLabel}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-3 font-semibold text-center w-8">No</th>
                    <th className="py-3 px-3 font-semibold">Tanggal</th>
                    <th className="py-3 px-3 font-semibold">Karyawan</th>
                    <th className="py-3 px-3 font-semibold">Pos / Divisi</th>
                    <th className="py-3 px-3 font-semibold text-center">Waktu &amp; Durasi</th>
                    <th className="py-3 px-3 font-semibold text-center">Pengali</th>
                    <th className="py-3 px-3 font-semibold text-right">Uang Lembur (Rp)</th>
                    <th className="py-3 px-3 font-semibold">Keperluan Tugas</th>
                    <th className="py-3 px-3 font-semibold text-center">Status</th>
                    <th className="py-3 px-3 font-semibold text-center">Aksi CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOtList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground italic">
                        Tidak ada catatan lembur pada filter ini untuk bulan {selectedMonthLabel}.
                      </td>
                    </tr>
                  ) : (
                    filteredOtList.map((o, idx) => {
                      const grp = getEmployeeCategoryGroup(o.userNip || o.userId);
                      return (
                        <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-medium whitespace-nowrap">
                            <div>{o.date}</div>
                            {o.isWeekendHoliday ? (
                              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                                OFF / Libur (2x)
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Hari Kerja</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-foreground block">{o.userName}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{o.userNip}</span>
                            <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              grp === 'SHIPMENT' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {grp === 'SHIPMENT' ? '🚢 Shipment' : '🏡 Rumah Tangga'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground font-medium">{o.divisionName || '-'}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="font-mono text-foreground font-bold">{o.startTime?.slice(0,5)} - {o.endTime?.slice(0,5)}</div>
                            <span className="text-[10px] text-muted-foreground">{o.durationHours} Jam</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                            {o.rateMultiplier || (o.isWeekendHoliday ? 2.0 : 1.5)}x
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-foreground">
                            Rp {Number(o.totalPay || o.compensationAmount || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 max-w-xs text-[11px] text-muted-foreground truncate" title={o.taskDescription}>
                            {o.taskDescription}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                              o.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                                : o.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-700 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                            }`}>
                              {o.status === 'approved' ? 'Disetujui' : o.status === 'rejected' ? 'Ditolak' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {o.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUpdateOtStatus(o.id, 'approved')}
                                    className="h-7 px-2 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    title="Setujui Lembur"
                                  >
                                    <CheckCircle2 size={13} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUpdateOtStatus(o.id, 'rejected')}
                                    className="h-7 px-2 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    title="Tolak Lembur"
                                  >
                                    <XCircle size={13} />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingOtRecord(o);
                                  setEditOtModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                                title="Edit Catatan Lembur"
                              >
                                <Pencil size={13} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteOt(o.id, o.userName)}
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                title="Hapus Lembur"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: PAYROLL (PENGGAJIAN) RECAP & CRUD */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Payroll Financial Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Beban Gaji Pokok</span>
              <span className="text-xl font-black font-mono text-foreground mt-1 block">
                Rp {payrollRows.reduce((s, r) => s + r.baseSalary, 0).toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {payrollRows.length} Karyawan Terdaftar
              </span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Lembur N-1 ({prevMonthLabel.split(' ')[0]})</span>
              <span className="text-xl font-black font-mono text-primary mt-1 block">
                Rp {totalOvertimeArrearsPay.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Sinkron dari realisasi SPKL bulan lalu
              </span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Potongan (BPJS 4% + Alpa)</span>
              <span className="text-xl font-black font-mono text-rose-600 mt-1 block">
                Rp {totalPayrollDeductions.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                PPh 21 = Rp 0 (Bebas Potongan Pajak)
              </span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Gaji Bersih (THP)</span>
              <span className="text-xl font-black font-mono text-emerald-600 mt-1 block">
                Rp {totalPayrollNet.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Siap dicairkan / ditransfer
              </span>
            </Card>
          </div>

          {/* Payroll Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama karyawan, NIP, divisi..."
                value={payrollSearchQuery}
                onChange={(e) => setPayrollSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={loadData}
                className="text-xs gap-1.5 h-9 rounded-xl"
              >
                <RotateCw size={14} /> Sinkronkan Payroll
              </Button>
              <Button
                variant="outline"
                onClick={exportPayrollExcel}
                className="text-xs gap-1.5 h-9 rounded-xl text-emerald-700 border-emerald-500/40 hover:bg-emerald-50"
              >
                <FileSpreadsheet size={14} /> Ekspor Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* Payroll Master Table */}
          <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Rekapitulasi Penggajian Karyawan Periode {selectedMonthLabel}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Perhitungan Upah Pokok Tunggal, Uang Lembur Bulan Mundur N-1 ({prevMonthLabel}), BPJS 3% + 1%, dan Alpa.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-3 font-semibold text-center w-8">No</th>
                    <th className="py-3 px-3 font-semibold">Karyawan</th>
                    <th className="py-3 px-3 font-semibold">Kelompok</th>
                    <th className="py-3 px-3 font-semibold">Pos / Divisi</th>
                    <th className="py-3 px-3 font-semibold text-right">Upah Pokok</th>
                    <th className="py-3 px-3 font-semibold text-right">Lembur N-1</th>
                    <th className="py-3 px-3 font-semibold text-right">BPJS TK (3%)</th>
                    <th className="py-3 px-3 font-semibold text-right">BPJS Kes (1%)</th>
                    <th className="py-3 px-3 font-semibold text-right">Pot. Alpa</th>
                    <th className="py-3 px-3 font-semibold text-right font-bold text-foreground">Gaji Bersih (THP)</th>
                    <th className="py-3 px-3 font-semibold text-center">Aksi Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payrollRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-muted-foreground italic">
                        Tidak ada data penggajian yang sesuai kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    payrollRows.map((r, idx) => (
                      <tr key={r.employee.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-foreground block">{r.employee.fullName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{r.employee.nip}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-semibold ${
                            r.group === 'SHIPMENT'
                              ? 'bg-sky-100 text-sky-800'
                              : r.group === 'RUMAH TANGGA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {r.group === 'SHIPMENT' ? '🚢 Shipment' : r.group === 'RUMAH TANGGA' ? '🏡 Wisma' : '⭐ Tetap'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{r.employee.divisionName || '-'}</td>
                        <td className="py-3 px-3 text-right font-mono font-medium">
                          Rp {r.baseSalary.toLocaleString('id-ID')}
                          {r.isKaryawanTetap && (
                            <span className="block text-[9px] text-muted-foreground font-sans">
                              (@Rp 140rb • {r.hadirDays} hr)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-primary">
                          {r.overtimePay > 0 ? `Rp ${r.overtimePay.toLocaleString('id-ID')}` : '-'}
                          {r.overtimeHours > 0 && (
                            <span className="block text-[9px] text-muted-foreground font-sans">
                              ({r.overtimeHours.toFixed(1)} Jam)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                          {r.bpjsTk > 0 ? `Rp ${r.bpjsTk.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                          {r.bpjsKes > 0 ? `Rp ${r.bpjsKes.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-600">
                          {r.alpaDeduction > 0 ? `Rp ${r.alpaDeduction.toLocaleString('id-ID')}` : '-'}
                          {r.alpaDays > 0 && (
                            <span className="block text-[9px] text-rose-500 font-sans">
                              ({r.alpaDays} Hari Alpa)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                          Rp {r.netSalary.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenSlip(r)}
                            className="h-7 px-2.5 text-xs gap-1 font-semibold rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                          >
                            <Eye size={12} /> Buka Slip Gaji
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: LEAVES (CUTI & IZIN) RECAP & CRUD */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          {/* Leaves KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Hak Cuti Tahunan Baku</span>
              <span className="text-2xl font-black font-mono text-foreground mt-1 block">12 Hari</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Use-It-Or-Lose-It (Tidak Diuangkan)</span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Pengajuan Cuti ({selectedMonthLabel.split(' ')[0]})</span>
              <span className="text-2xl font-black font-mono text-primary mt-1 block">
                {monthLeaves.filter((l) => l.leaveType === 'cuti').length} Berkas
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {monthLeaves.filter((l) => l.leaveType === 'cuti' && l.status === 'approved').length} Disetujui
              </span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Izin / Sakit ({selectedMonthLabel.split(' ')[0]})</span>
              <span className="text-2xl font-black font-mono text-amber-600 mt-1 block">
                {monthLeaves.filter((l) => l.leaveType !== 'cuti').length} Pengajuan
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Disertai surat dokter / tugas</span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Petugas Pengganti Pos (Relief)</span>
              <span className="text-2xl font-black font-mono text-sky-600 mt-1 block">
                {monthLeaves.filter((l) => (l as any).substituteName).length} Petugas
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Larangan berturut-turut dipatuhi</span>
            </Card>
          </div>

          {/* Leaves Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari nama karyawan, alasan cuti..."
                  value={leaveSearchQuery}
                  onChange={(e) => setLeaveSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-muted p-1 rounded-xl text-xs font-semibold mr-2 border border-border">
                <button
                  type="button"
                  onClick={() => setLeaveSubView('requests')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    leaveSubView === 'requests' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📋 Daftar Pengajuan
                </button>
                <button
                  type="button"
                  onClick={() => setLeaveSubView('ledger')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    leaveSubView === 'ledger' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📊 Buku Saldo Cuti (12 Hari)
                </button>
              </div>

              <Button
                onClick={() => setManualLeaveModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-9 rounded-xl font-bold shadow-sm"
              >
                <Plus size={14} /> + Input Cuti / Izin
              </Button>
            </div>
          </div>

          {/* SubView 1: Daftar Pengajuan Cuti/Izin */}
          {leaveSubView === 'requests' && (
            <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Riwayat Pengajuan Cuti, Izin &amp; Sakit Bulan {selectedMonthLabel}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Menampilkan {filteredLeaves.length} berkas pengajuan izin &amp; cuti
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-3 font-semibold text-center w-8">No</th>
                      <th className="py-3 px-3 font-semibold">Karyawan</th>
                      <th className="py-3 px-3 font-semibold">Tipe</th>
                      <th className="py-3 px-3 font-semibold">Rentang Tanggal</th>
                      <th className="py-3 px-3 font-semibold text-center">Durasi</th>
                      <th className="py-3 px-3 font-semibold">Alasan / Keterangan</th>
                      <th className="py-3 px-3 font-semibold">Petugas Pengganti (Relief)</th>
                      <th className="py-3 px-3 font-semibold text-center">Status</th>
                      <th className="py-3 px-3 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground italic">
                          Tidak ada pengajuan cuti/izin pada kriteria filter untuk bulan {selectedMonthLabel}.
                        </td>
                      </tr>
                    ) : (
                      filteredLeaves.map((l, idx) => (
                        <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-foreground block">{(l as any).userName || l.userId}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{(l as any).userNip || '-'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              l.leaveType === 'cuti'
                                ? 'bg-sky-100 text-sky-800'
                                : l.leaveType === 'sakit'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {l.leaveType}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono whitespace-nowrap">
                            {l.startDate} s/d {l.endDate}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {l.durationDays || 1} Hari
                          </td>
                          <td className="py-3 px-3 max-w-xs text-muted-foreground truncate" title={l.reason}>
                            {l.reason}
                          </td>
                          <td className="py-3 px-3">
                            {(l as any).substituteName ? (
                              <div>
                                <span className="font-semibold text-foreground block">{(l as any).substituteName}</span>
                                <span className="text-[9px] text-emerald-600 font-mono">Pengganti Pos Terverifikasi</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Tanpa Pengganti</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                              l.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                                : l.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-700 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                            }`}>
                              {l.status === 'approved' ? 'Disetujui' : l.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {l.status === 'pending' ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateLeaveStatus(l.id, 'approved')}
                                  className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs"
                                  title="Setujui Cuti"
                                >
                                  <CheckCircle2 size={13} /> Setujui
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUpdateLeaveStatus(l.id, 'rejected')}
                                  className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                                  title="Tolak Cuti"
                                >
                                  <XCircle size={13} /> Tolak
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-mono">Selesai</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* SubView 2: Buku Saldo Cuti (Quota Ledger) */}
          {leaveSubView === 'ledger' && (
            <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Buku Saldo Cuti Tahunan Karyawan (12 Hari Baku • Use-It-Or-Lose-It)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sisa cuti yang tidak diambil bersifat hangus pada akhir tahun dan tidak dapat dikonversi menjadi uang tunai.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-3 font-semibold text-center w-8">No</th>
                      <th className="py-3 px-3 font-semibold">Karyawan</th>
                      <th className="py-3 px-3 font-semibold">Kelompok</th>
                      <th className="py-3 px-3 font-semibold text-center">Hak Cuti Awal</th>
                      <th className="py-3 px-3 font-semibold text-center">Cuti Terpakai</th>
                      <th className="py-3 px-3 font-semibold text-center font-bold text-foreground">Sisa Saldo Cuti</th>
                      <th className="py-3 px-3 font-semibold text-center">Status Kebijakan</th>
                      <th className="py-3 px-3 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employees
                      .filter((emp) => {
                        const cat = getEmployeeCategoryGroup(emp.nip || emp.id);
                        if (filterCategory !== 'all' && cat !== filterCategory) return false;
                        return true;
                      })
                      .map((emp, idx) => {
                        const quota = emp.leaveQuota || 12;
                        const used = emp.leaveUsed || 0;
                        const remaining = Math.max(0, quota - used);
                        const grp = getEmployeeCategoryGroup(emp.nip || emp.id);

                        return (
                          <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-foreground block">{emp.fullName}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{emp.nip}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-semibold ${
                                grp === 'SHIPMENT' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {grp === 'SHIPMENT' ? '🚢 Shipment' : '🏡 Rumah Tangga'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-medium">{quota} Hari</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-amber-600">{used} Hari</td>
                            <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                              {remaining} Hari
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                Hangus 31 Des
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCorrectionUser(emp);
                                  setLeaveCorrectionModalOpen(true);
                                }}
                                className="h-7 px-2.5 text-xs gap-1 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                              >
                                <Pencil size={12} /> Koreksi Kuota
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: ATTENDANCE & LATENESS (PRESENSI & KETERLAMBATAN) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Attendance KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Catatan Hadir</span>
              <span className="text-2xl font-black font-mono text-primary mt-1 block">
                {monthAttendances.filter((a) => a.status === 'hadir').length}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Bulan {selectedMonthLabel}</span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Keterlambatan</span>
              <span className="text-2xl font-black font-mono text-amber-600 mt-1 block">
                {latenessRanking.reduce((s, r) => s + r.totalLateMins, 0)} Menit
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {latenessRanking.length} Karyawan Terlambat
              </span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Alpa / Mangkir</span>
              <span className="text-2xl font-black font-mono text-rose-600 mt-1 block">
                {monthAttendances.filter((a) => a.status === 'mangkir').length} Hari
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Dikenakan potongan payroll</span>
            </Card>

            <Card className="border-border bg-card rounded-2xl shadow-xs p-4">
              <span className="text-xs text-muted-foreground font-medium block">Total Cuti &amp; Izin Sah</span>
              <span className="text-2xl font-black font-mono text-sky-600 mt-1 block">
                {monthAttendances.filter((a) => a.status === 'cuti' || a.status === 'izin' || a.status === 'sakit').length} Hari
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Tercatat dalam kalender</span>
            </Card>
          </div>

          {/* Lateness Ranking Card */}
          {latenessRanking.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5 rounded-2xl shadow-xs p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  <h3 className="text-sm font-bold text-foreground">
                    Rekapitulasi Keterlambatan Teratas Bulan {selectedMonthLabel}
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                  @Rp 1.000 / menit potongan
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {latenessRanking.slice(0, 4).map((r) => (
                  <div key={r.employee.id} className="p-2.5 bg-card rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-foreground block">{r.employee.fullName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{r.telat}x kejadian</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-600 text-xs block">{r.totalLateMins} mnt</span>
                      <span className="text-[10px] text-rose-600 font-mono">Rp {(r.totalLateMins * 1000).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Attendance Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cari karyawan di rekap presensi..."
                  value={attSearchQuery}
                  onChange={(e) => setAttSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-muted p-1 rounded-xl text-xs font-semibold mr-2 border border-border">
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('recap')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    attendanceViewMode === 'recap' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📅 Matriks Rekap Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('logs')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    attendanceViewMode === 'logs' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📝 Log Presensi Harian
                </button>
              </div>

              <Button
                onClick={() => setManualAttOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-9 rounded-xl font-bold shadow-sm"
              >
                <Plus size={14} /> + Presensi Manual
              </Button>
              <Button
                onClick={() => setAbsenSplModalOpen(true)}
                className="bg-teal-700 hover:bg-teal-600 text-white text-xs gap-1.5 h-9 rounded-xl font-semibold border border-teal-500/40"
              >
                <FileText size={14} /> Form ABSEN/SPL
              </Button>
              <Button
                onClick={() => setTimeSheetModalOpen(true)}
                className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs gap-1.5 h-9 rounded-xl font-bold shadow-sm"
              >
                <FileSpreadsheet size={14} /> Time Sheet 41-Kolom (PDF)
              </Button>
              <Button
                variant="outline"
                onClick={exportAttendanceExcel}
                className="text-xs gap-1.5 h-9 rounded-xl text-emerald-700 border-emerald-500/40 hover:bg-emerald-50"
              >
                <FileSpreadsheet size={14} /> Ekspor Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* View 1: Matriks Rekapitulasi Bulanan Per Karyawan */}
          {attendanceViewMode === 'recap' && (
            <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Matriks Rekapitulasi Presensi Bulanan Per Karyawan ({selectedMonthLabel})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Akumulasi Hadir, Terlambat, Alpa, Cuti, dan Status Perekaman Biometrik Wajah.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-3 font-semibold text-center w-8">No</th>
                      <th className="py-3 px-3 font-semibold">Karyawan</th>
                      <th className="py-3 px-3 font-semibold">Kelompok</th>
                      <th className="py-3 px-3 font-semibold">Pos / Divisi</th>
                      <th className="py-3 px-3 font-semibold text-center">Hadir</th>
                      <th className="py-3 px-3 font-semibold text-center">Telat (Menit)</th>
                      <th className="py-3 px-3 font-semibold text-center">Alpa</th>
                      <th className="py-3 px-3 font-semibold text-center">Cuti</th>
                      <th className="py-3 px-3 font-semibold text-center">Sakit</th>
                      <th className="py-3 px-3 font-semibold text-center">Izin</th>
                      <th className="py-3 px-3 font-semibold text-center">Off / Libur</th>
                      <th className="py-3 px-3 font-semibold text-center">Biometrik</th>
                      <th className="py-3 px-3 font-semibold text-center">Aksi Kalender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthlyRecap.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-muted-foreground italic">
                          Tidak ada data rekap presensi yang sesuai kriteria filter.
                        </td>
                      </tr>
                    ) : (
                      monthlyRecap.map((r, idx) => (
                        <tr key={r.employee.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-foreground block">{r.employee.fullName}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{r.employee.nip}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-semibold ${
                              r.group === 'SHIPMENT'
                                ? 'bg-sky-100 text-sky-800'
                                : r.group === 'RUMAH TANGGA'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {r.group === 'SHIPMENT' ? '🚢 Shipment' : r.group === 'RUMAH TANGGA' ? '🏡 Wisma' : '⭐ Tetap'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">{r.employee.divisionName || '-'}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-primary">{r.hadir}</td>
                          <td className="py-3 px-3 text-center font-mono font-medium text-amber-600">
                            {r.telat > 0 ? `${r.telat}x (${r.totalLateMins}m)` : '-'}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-rose-600">{r.alpa > 0 ? r.alpa : '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-sky-600">{r.cuti > 0 ? r.cuti : '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-amber-600">{r.sakit > 0 ? r.sakit : '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-muted-foreground">{r.izin > 0 ? r.izin : '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-muted-foreground">{r.off > 0 ? r.off : '-'}</td>
                          <td className="py-3 px-3 text-center">
                            {r.isFaceEnrolled ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[9px]">
                                Terdaftar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[9px]">
                                Belum Registrasi
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCalendarUser(r.employee);
                                setCalendarModalOpen(true);
                              }}
                              className="h-7 px-2.5 text-xs gap-1 font-semibold rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                            >
                              <Calendar size={12} /> Kalender 31 Hari
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* View 2: Log Presensi Harian */}
          {attendanceViewMode === 'logs' && (
            <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Log Presensi Harian (Detail Masuk / Pulang)</h3>
                  <p className="text-xs text-muted-foreground">
                    Menampilkan seluruh transaksi clock-in/out bulan {selectedMonthLabel}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-3 font-semibold text-center w-8">No</th>
                      <th className="py-3 px-3 font-semibold">Tanggal</th>
                      <th className="py-3 px-3 font-semibold">Karyawan</th>
                      <th className="py-3 px-3 font-semibold">Pos / Divisi</th>
                      <th className="py-3 px-3 font-semibold text-center">Jam Masuk</th>
                      <th className="py-3 px-3 font-semibold text-center">Jam Pulang</th>
                      <th className="py-3 px-3 font-semibold text-center">Terlambat</th>
                      <th className="py-3 px-3 font-semibold text-center">Geofence</th>
                      <th className="py-3 px-3 font-semibold text-center">Status</th>
                      <th className="py-3 px-3 font-semibold text-center">Aksi Koreksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthAttendances.slice(0, 100).map((a, idx) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono whitespace-nowrap">{a.attendanceDate}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-foreground block">{a.userName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{a.userNip}</span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{a.divisionName || '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-foreground">{a.clockIn || '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-foreground">{a.clockOut || '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-medium text-amber-600">
                          {a.lateMinutes > 0 ? `${a.lateMinutes} mnt` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {a.isPerimeterBreached ? (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30 text-[9px]">
                              Melanggar
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[9px]">
                              Patuh Pos
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center uppercase font-bold text-[10px]">
                          <span className={`px-2 py-0.5 rounded ${
                            a.status === 'hadir' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAttRecord(a);
                              setCorrStatus(a.status);
                              setCorrClockIn(a.clockIn || '07:30');
                              setCorrClockOut(a.clockOut || '16:30');
                              setCorrLateMinutes(a.lateMinutes || 0);
                              setCorrNotes(a.notes || '');
                              setCorrectAttOpen(true);
                            }}
                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1 font-semibold"
                          >
                            <Pencil size={12} /> Koreksi
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: LIABILITY & LEAVE OVERTIME VALUATION */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'liability' && (
        <HrmLeaveOvertimeLiabilityView />
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODALS SECTION */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* 1. Modal Manual Lembur */}
      <HrmManualLemburModal
        open={manualOtModalOpen}
        onClose={() => setManualOtModalOpen(false)}
        onSuccess={() => {
          setManualOtModalOpen(false);
          loadData();
        }}
      />

      {/* 2. Modal Edit Lembur */}
      <HrmEditLemburModal
        open={editOtModalOpen}
        onClose={() => {
          setEditOtModalOpen(false);
          setEditingOtRecord(null);
        }}
        record={editingOtRecord}
        onSuccess={() => {
          setEditOtModalOpen(false);
          setEditingOtRecord(null);
          loadData();
        }}
      />

      {/* 3. Modal Manual Leave (Cuti/Izin) */}
      <HrmManualLeaveModal
        open={manualLeaveModalOpen}
        onClose={() => setManualLeaveModalOpen(false)}
        onSuccess={() => {
          setManualLeaveModalOpen(false);
          loadData();
        }}
      />

      {/* 4. Modal Leave Quota Correction */}
      <HrmEmployeeLeaveCorrectionModal
        isOpen={leaveCorrectionModalOpen}
        onClose={() => {
          setLeaveCorrectionModalOpen(false);
          setSelectedCorrectionUser(null);
        }}
        user={selectedCorrectionUser}
        allUsers={employees}
        onSaved={() => {
          setLeaveCorrectionModalOpen(false);
          setSelectedCorrectionUser(null);
          loadData();
        }}
      />

      {/* 5. Official Salary Slip Modal */}
      <HrmSalarySlipModal
        slip={selectedPayrollSlip}
        open={salarySlipModalOpen}
        onClose={() => {
          setSalarySlipModalOpen(false);
          setSelectedPayrollSlip(null);
        }}
      />

      {/* 6. Form ABSEN/SPL Modal */}
      <HrmAbsenSplModal
        isOpen={absenSplModalOpen}
        onClose={() => setAbsenSplModalOpen(false)}
        employees={employees}
        attendances={attendances}
        overtimes={overtimes}
      />

      {/* 7. Employee Monthly Calendar Modal */}
      <HrmEmployeeMonthlyCalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        user={selectedCalendarUser}
        initialMonth={selectedMonth}
        attendances={attendances}
        allShifts={allShifts}
      />

      {/* 8. Master 41-Column Time Sheet & Overtime PDF Modal */}
      <HrmTimeSheetPdfModal
        open={timeSheetModalOpen}
        onClose={() => setTimeSheetModalOpen(false)}
        employees={employees}
        attendances={attendances}
        overtimes={overtimes}
        leaves={leaves}
        initialMonth={selectedMonth}
      />

      {/* 8. Inline Modal Input Presensi Manual */}
      <Dialog open={manualAttOpen} onOpenChange={setManualAttOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus size={16} className="text-emerald-600" /> Input Presensi Manual Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Gunakan jika karyawan mengalami kendala perangkat atau lupa melakukan check-in/out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Pilih Karyawan</Label>
              <Select value={manualAttUserId} onValueChange={setManualAttUserId}>
                <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                  <SelectValue placeholder="Pilih Karyawan..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nip} • {emp.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tanggal</Label>
                <Input
                  type="date"
                  value={manualAttDate}
                  onChange={(e) => setManualAttDate(e.target.value)}
                  className="h-9 text-xs rounded-xl mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Status Kehadiran</Label>
                <Select value={manualAttStatus} onValueChange={(v: any) => setManualAttStatus(v)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hadir">Hadir</SelectItem>
                    <SelectItem value="izin">Izin</SelectItem>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="cuti">Cuti</SelectItem>
                    <SelectItem value="mangkir">Alpa</SelectItem>
                    <SelectItem value="off">Off / Libur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Jam Masuk (Clock-In)</Label>
                <Input
                  type="time"
                  value={manualAttClockIn}
                  onChange={(e) => setManualAttClockIn(e.target.value)}
                  className="h-9 text-xs rounded-xl mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Jam Pulang (Clock-Out)</Label>
                <Input
                  type="time"
                  value={manualAttClockOut}
                  onChange={(e) => setManualAttClockOut(e.target.value)}
                  className="h-9 text-xs rounded-xl mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Catatan / Alasan Penambahan Manual</Label>
              <Input
                type="text"
                placeholder="Contoh: Lupa scan wajah saat penugasan darurat..."
                value={manualAttNotes}
                onChange={(e) => setManualAttNotes(e.target.value)}
                className="h-9 text-xs rounded-xl mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setManualAttOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveManualAttendance}
              disabled={isSubmittingAtt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1"
            >
              Simpan Presensi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Inline Modal Koreksi Presensi */}
      <Dialog open={correctAttOpen} onOpenChange={setCorrectAttOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil size={16} className="text-primary" /> Koreksi Catatan Presensi
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedAttRecord?.userName} ({selectedAttRecord?.userNip}) • Tanggal: {selectedAttRecord?.attendanceDate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Status Kehadiran</Label>
              <Select value={corrStatus} onValueChange={(v: any) => setCorrStatus(v)}>
                <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hadir">Hadir</SelectItem>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="cuti">Cuti</SelectItem>
                  <SelectItem value="mangkir">Alpa</SelectItem>
                  <SelectItem value="off">Off / Libur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Jam Masuk (Clock-In)</Label>
                <Input
                  type="time"
                  value={corrClockIn}
                  onChange={(e) => setCorrClockIn(e.target.value)}
                  className="h-9 text-xs rounded-xl mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Jam Pulang (Clock-Out)</Label>
                <Input
                  type="time"
                  value={corrClockOut}
                  onChange={(e) => setCorrClockOut(e.target.value)}
                  className="h-9 text-xs rounded-xl mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Keterlambatan (Menit)</Label>
              <Input
                type="number"
                value={corrLateMinutes}
                onChange={(e) => setCorrLateMinutes(Number(e.target.value))}
                className="h-9 text-xs rounded-xl mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs">Catatan Koreksi</Label>
              <Input
                type="text"
                placeholder="Alasan koreksi data presensi..."
                value={corrNotes}
                onChange={(e) => setCorrNotes(e.target.value)}
                className="h-9 text-xs rounded-xl mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCorrectAttOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCorrection}
              disabled={isSubmittingAtt}
              className="bg-primary text-primary-foreground rounded-xl text-xs"
            >
              Simpan Koreksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
