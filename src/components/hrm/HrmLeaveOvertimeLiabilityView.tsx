import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { hrmService } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { UserProfile, Division, AppSettings, OvertimeRecord, OvertimeSettings } from '@/types/hrm';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Building2,
  CalendarDays,
  Coins,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  Users,
  Wallet,
  FileText,
  BadgeAlert,
  ArrowUpDown,
  Sparkles,
  Settings2,
  TrendingUp,
  ShieldCheck,
  Percent,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface EmployeeLiabilityRow {
  userId: string;
  name: string;
  nip: string;
  divisionId?: string;
  divisionName: string;
  jobTitle?: string;
  baseSalary: number;
  dailyRate: number;      // Upah per hari (baseSalary / 25)
  hourlyOtRate: number;   // Upah per jam (baseSalary / 173)

  // ─── CUTI DATA ───
  leaveQuota: number;       // Kuota cuti tahunan
  leaveUsed: number;        // Cuti telah diambil
  leaveRemaining: number;   // Cuti belum diambil / sisa
  leaveValuationRp: number; // Nilai kompensasi sisa cuti (leaveRemaining * dailyRate)

  // ─── LEMBUR DATA ───
  isOvertimeEligible: boolean; // Sah berhak lembur (Khusus 80 orang: 47 Shiftman + 33 Wisma)
  totalOtHours: number;     // Total jam lembur disetujui
  totalOtPayRp: number;     // Total uang lembur disetujui
  paidOtHours: number;      // Jam lembur telah diambil / dicairkan
  paidOtPayRp: number;      // Uang lembur telah digunakan / dicairkan
  unpaidOtHours: number;    // Jam lembur belum diambil / belum dicairkan
  unpaidOtPayRp: number;    // Uang lembur belum dicairkan (Accrued Liability)

  // ─── TOTAL KEWAJIBAN ───
  totalLiabilityRp: number; // leaveValuationRp + unpaidOtPayRp
}

export interface DivisionLiabilitySummary {
  divisionId: string;
  divisionName: string;
  employeeCount: number;

  // Cuti
  totalLeaveQuota: number;
  totalLeaveUsed: number;       // Telah Diambil
  totalLeaveRemaining: number;  // Belum Diambil / Sisa
  leaveUsagePercent: number;
  totalLeaveValuationRp: number;

  // Lembur (Jam)
  totalOtHours: number;
  paidOtHours: number;          // Telah Diambil / Cair
  unpaidOtHours: number;        // Belum Diambil / Belum Cair
  otRealizationPercent: number;

  // Anggaran Lembur (Finansial Rp)
  allocatedBudgetRp: number;    // Nominal Lembur yang Tersedia (Plafon/Pagu)
  usedBudgetRp: number;         // Nominal Lembur yang Telah Digunakan (Cair)
  pendingBudgetRp: number;      // Nominal Lembur Belum Dicairkan (Tertunda)
  remainingBudgetRp: number;    // Nominal Lembur yang Tersisa (Sisa Pagu Bersih)
  budgetBurnPercent: number;    // % Penyerapan Anggaran

  // Total Finansial
  totalLiabilityRp: number;     // Valuasi Cuti Sisa + Lembur Belum Cair
}

export const HrmLeaveOvertimeLiabilityView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [filterLiabilityStatus, setFilterLiabilityStatus] = useState<'all' | 'unpaid_ot' | 'remaining_leave'>('all');
  const [filterEligibility, setFilterEligibility] = useState<'all' | 'eligible_80' | 'ineligible'>('all');
  const [viewLevel, setViewLevel] = useState<'division' | 'employee'>('division');
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Settings & Data from hrmService
  const appSettings: AppSettings = hrmService.getAppSettings();
  const divisions: Division[] = hrmService.getDivisions();
  const allOvertimes: OvertimeRecord[] = hrmService.getOvertimeRecords();
  const salaryProfiles = hrmService.getSalaryProfiles();

  // Overtime Settings & Budget Caps (Baku SK Direksi FRP: Total Plafon Rp 76.000.000 untuk 80 personil)
  const [otSettings, setOtSettings] = useState<OvertimeSettings>(() => hrmService.getOvertimeSettings());
  const [tempBudgetCap, setTempBudgetCap] = useState<number>(otSettings.monthlyOvertimeBudgetCap || 76000000);
  const [tempDivisionCaps, setTempDivisionCaps] = useState<Record<string, number>>(() => ({
    'Shiftman Lapangan': 72000000,
    'Shiftman': 72000000,
    'Wisma Biring Ere': 4000000,
    'Wisma': 4000000,
    'Operasional': 0,
    'Teknologi Informasi': 0,
    'Sumber Daya Manusia': 0,
    ...(otSettings.divisionBudgetCaps || {}),
  }));

  // ─── Live State from PostgreSQL Database ─────────────────────────────────────
  const [liveUsers, setLiveUsers] = useState<UserProfile[]>(() => {
    return hrmService.getUsers().filter((u) => u.roleName !== 'superadmin' && (u as any).role !== 'superadmin');
  });
  const [liveLeaves, setLiveLeaves] = useState<any[]>([]);
  const [liveOvertimes, setLiveOvertimes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadLiveAuditData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [usersRes, leavesRes, otRes] = await Promise.allSettled([
        api.get<{ success: boolean; data: UserProfile[] }>('/users'),
        api.get<{ success: boolean; data: any[] }>('/leaves'),
        api.get<{ success: boolean; data: any[] }>('/overtime'),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
        const cleanUsers = usersRes.value.data.filter(
          (u) => u.roleName !== 'superadmin' && (u as any).role !== 'superadmin'
        );
        if (cleanUsers.length > 0) {
          setLiveUsers(cleanUsers);
          hrmService.setInMemoryUsers(usersRes.value.data);
        }
      }

      if (leavesRes.status === 'fulfilled' && leavesRes.value?.data) {
        setLiveLeaves(leavesRes.value.data);
      }

      if (otRes.status === 'fulfilled' && otRes.value?.data) {
        setLiveOvertimes(otRes.value.data);
      }
    } catch (err) {
      console.warn('[HrmLeaveOvertimeLiabilityView] Gagal sync live database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveAuditData();
  }, [loadLiveAuditData]);

  // ─── Process Employee Data with Live PostgreSQL Sync ────────────────────────
  const employeeLiabilityData: EmployeeLiabilityRow[] = useMemo(() => {
    return liveUsers.map((user) => {
      const sp = salaryProfiles.find((p) => p.userId === user.id);
      const baseSalary = user.baseSalary || sp?.baseSalary || 4045050;
      const dailyRate = Math.round(baseSalary / 25);
      const hourlyOtRate = user.hourlyOvertimeRate || Math.round(baseSalary / 173);

      // ─── CUTI PER KARYAWAN ───
      // 1. Kuota cuti tahunan (default 12)
      const leaveQuota = Number(user.annualLeaveQuota ?? (user as any).annual_leave_quota ?? 12);

      // 2. Akumulasi dari kolom used_leave_days di profil database
      const profileUsedDays = Number(user.usedLeaveDays ?? (user as any).used_leave_days ?? 0);

      // 3. Akumulasi dari tabel hrm_leave_requests (yang disetujui)
      const userApprovedLeaves = liveLeaves.filter((l: any) => {
        const matchId = l.user_id === user.id || l.userId === user.id;
        const matchNip =
          (l.user_nip && user.nip && l.user_nip.trim().toLowerCase() === user.nip.trim().toLowerCase()) ||
          (l.nip && user.nip && l.nip.trim().toLowerCase() === user.nip.trim().toLowerCase());
        const isApproved = (l.status || '').toLowerCase() === 'approved';
        const lType = (l.leave_type || l.leaveType || '').toLowerCase();
        const isCuti = lType.includes('cuti') || lType === 'annual_leave';
        return (matchId || matchNip) && isApproved && isCuti;
      });

      const daysFromApprovedRequests = userApprovedLeaves.reduce(
        (sum: number, l: any) => sum + Number(l.total_days || l.totalDays || 1),
        0
      );

      // Ambil angka realisasi cuti: terbesar antara used_leave_days profil dan jumlah hari pengajuan cuti yang disetujui
      const leaveUsed = Math.max(profileUsedDays, daysFromApprovedRequests);
      const leaveRemaining = Math.max(0, leaveQuota - leaveUsed);
      // Aturan Intern PT FRP: Hak cuti yang tidak diambil HANGUS dan TIDAK DAPAT DIUANGKAN (Kompensasi Kas: Rp 0)
      const leaveValuationRp = 0;

      // Aturan Direksi PT FRP: Hak lembur (SPKL) HANYA berlaku untuk 80 orang karyawan lapangan/operasional yang sah (Shipment 47 orang & Wisma 33 orang)
      const opGroup = ((user as any).operational_group || (user as any).operationalGroup || '').toUpperCase();
      const divNameLower = (user.divisionName || (user as any).division || '').toLowerCase();
      
      const isOvertimeEligible = (user as any).overtime_eligible === true ||
        opGroup === 'SHIPMENT' ||
        opGroup === 'RUMAH TANGGA' ||
        divNameLower.includes('shiftman') ||
        divNameLower.includes('timbangan') ||
        divNameLower.includes('matching') ||
        divNameLower.includes('segel') ||
        divNameLower.includes('wisma') ||
        divNameLower.includes('biring');

      // ─── LEMBUR PER KARYAWAN ───
      let totalOtHours = 0;
      let totalOtPayRp = 0;
      let paidOtHours = 0;
      let paidOtPayRp = 0;
      let unpaidOtHours = 0;
      let unpaidOtPayRp = 0;

      if (isOvertimeEligible) {
        const dbUserOts = liveOvertimes.filter((o: any) => {
          const matchId = o.user_id === user.id || o.userId === user.id;
          const matchNip =
            (o.user_nip && user.nip && o.user_nip.trim().toLowerCase() === user.nip.trim().toLowerCase()) ||
            (o.nip && user.nip && o.nip.trim().toLowerCase() === user.nip.trim().toLowerCase());
          return (matchId || matchNip) && (o.status || '').toLowerCase() === 'approved';
        });

        const localUserOts = allOvertimes.filter((o) => {
          const matchId = o.userId === user.id;
          const matchNip = o.userNip && user.nip && o.userNip.trim().toLowerCase() === user.nip.trim().toLowerCase();
          return (matchId || matchNip) && o.status === 'approved';
        });

        const targetOts = dbUserOts.length > 0 ? dbUserOts : localUserOts;

        totalOtHours = Number(
          targetOts.reduce((acc: number, o: any) => acc + Number(o.duration_hours || o.durationHours || 0), 0).toFixed(1)
        );
        totalOtPayRp = targetOts.reduce(
          (acc: number, o: any) => acc + Number(o.total_pay || o.totalPay || o.compensation_amount || 0),
          0
        );

        const paidOts = targetOts.filter((o: any) => {
          const pStatus = (o.payment_status || o.paymentStatus || '').toLowerCase();
          return pStatus === 'paid' || pStatus === 'included_in_payroll';
        });
        paidOtHours = Number(
          paidOts.reduce((acc: number, o: any) => acc + Number(o.duration_hours || o.durationHours || 0), 0).toFixed(1)
        );
        paidOtPayRp = paidOts.reduce(
          (acc: number, o: any) => acc + Number(o.total_pay || o.totalPay || o.compensation_amount || 0),
          0
        );

        const unpaidOts = targetOts.filter((o: any) => {
          const pStatus = (o.payment_status || o.paymentStatus || '').toLowerCase();
          return !pStatus || pStatus === 'unpaid';
        });
        unpaidOtHours = Number(
          unpaidOts.reduce((acc: number, o: any) => acc + Number(o.duration_hours || o.durationHours || 0), 0).toFixed(1)
        );
        unpaidOtPayRp = unpaidOts.reduce(
          (acc: number, o: any) => acc + Number(o.total_pay || o.totalPay || o.compensation_amount || 0),
          0
        );
      }

      // Aturan Intern PT FRP: Beban kewajiban kas riil murni dari Uang Lembur yang belum dicairkan
      const totalLiabilityRp = unpaidOtPayRp;

      return {
        userId: user.id,
        name: user.fullName || 'Tanpa Nama',
        nip: user.nip || '-',
        divisionId: user.divisionId,
        divisionName: user.divisionName || (user as any).division || 'Umum',
        jobTitle: (user as any).jobTitle || (user as any).position || 'Staff',
        baseSalary,
        dailyRate,
        hourlyOtRate,
        leaveQuota,
        leaveUsed,
        leaveRemaining,
        leaveValuationRp,
        isOvertimeEligible,
        totalOtHours,
        totalOtPayRp,
        paidOtHours,
        paidOtPayRp,
        unpaidOtHours,
        unpaidOtPayRp,
        totalLiabilityRp,
      };
    });
  }, [liveUsers, liveLeaves, liveOvertimes, allOvertimes, salaryProfiles]);

  // ─── Process Division Aggregation ───────────────────────────────────────────
  const divisionLiabilityData: DivisionLiabilitySummary[] = useMemo(() => {
    const map = new Map<string, {
      divisionId: string;
      divisionName: string;
      employeeCount: number;
      totalLeaveQuota: number;
      totalLeaveUsed: number;
      totalLeaveRemaining: number;
      totalLeaveValuationRp: number;
      totalOtHours: number;
      paidOtHours: number;
      unpaidOtHours: number;
      paidOtPayRp: number;
      unpaidOtPayRp: number;
      totalLiabilityRp: number;
    }>();

    employeeLiabilityData.forEach((emp) => {
      const divName = emp.divisionName || 'Lainnya';
      const existing = map.get(divName) || {
        divisionId: emp.divisionId || divName,
        divisionName: divName,
        employeeCount: 0,
        totalLeaveQuota: 0,
        totalLeaveUsed: 0,
        totalLeaveRemaining: 0,
        totalLeaveValuationRp: 0,
        totalOtHours: 0,
        paidOtHours: 0,
        unpaidOtHours: 0,
        paidOtPayRp: 0,
        unpaidOtPayRp: 0,
        totalLiabilityRp: 0,
      };

      existing.employeeCount += 1;
      existing.totalLeaveQuota += emp.leaveQuota;
      existing.totalLeaveUsed += emp.leaveUsed;
      existing.totalLeaveRemaining += emp.leaveRemaining;
      existing.totalLeaveValuationRp += emp.leaveValuationRp;
      existing.totalOtHours = Number((existing.totalOtHours + emp.totalOtHours).toFixed(1));
      existing.paidOtHours = Number((existing.paidOtHours + emp.paidOtHours).toFixed(1));
      existing.unpaidOtHours = Number((existing.unpaidOtHours + emp.unpaidOtHours).toFixed(1));
      existing.paidOtPayRp += emp.paidOtPayRp;
      existing.unpaidOtPayRp += emp.unpaidOtPayRp;
      existing.totalLiabilityRp += emp.totalLiabilityRp;

      map.set(divName, existing);
    });

    const divisionCaps = otSettings.divisionBudgetCaps || {};
    const globalCap = otSettings.monthlyOvertimeBudgetCap || 76000000;

    return Array.from(map.values()).map((d) => {
      // Tentukan alokasi plafon divisi (HANYA BERLAKU UNTUK 80 ORANG SAH: SHIFTMAN LAPANGAN & WISMA BIRING ERE)
      let allocatedBudgetRp = divisionCaps[d.divisionName];
      if (allocatedBudgetRp === undefined) {
        const dName = d.divisionName.toLowerCase();
        const isShiftmanGroup = dName.includes('shiftman') || dName.includes('lapangan') || dName.includes('timbangan') || dName.includes('matching') || dName.includes('segel');
        const isWismaGroup = dName.includes('wisma') || dName.includes('biring');

        if (isShiftmanGroup) {
          allocatedBudgetRp = 72000000;
        } else if (isWismaGroup) {
          allocatedBudgetRp = 4000000;
        } else {
          // Divisi staf kantor / IT / non-operasional tidak memiliki plafon lembur (Non-Eligible)
          allocatedBudgetRp = 0;
        }
      }

      const usedBudgetRp = d.paidOtPayRp;
      const pendingBudgetRp = d.unpaidOtPayRp;
      const remainingBudgetRp = Math.max(0, allocatedBudgetRp - (usedBudgetRp + pendingBudgetRp));
      const budgetBurnPercent = allocatedBudgetRp > 0 ? Math.round(((usedBudgetRp + pendingBudgetRp) / allocatedBudgetRp) * 100) : 0;
      const leaveUsagePercent = d.totalLeaveQuota > 0 ? Math.round((d.totalLeaveUsed / d.totalLeaveQuota) * 100) : 0;
      const otRealizationPercent = d.totalOtHours > 0 ? Math.round((d.paidOtHours / d.totalOtHours) * 100) : 0;

      return {
        ...d,
        allocatedBudgetRp,
        usedBudgetRp,
        pendingBudgetRp,
        remainingBudgetRp,
        budgetBurnPercent,
        leaveUsagePercent,
        otRealizationPercent,
        totalLiabilityRp: pendingBudgetRp, // Beban kas riil murni uang lembur belum cair
      };
    }).sort((a, b) => b.totalLiabilityRp - a.totalLiabilityRp);
  }, [employeeLiabilityData, otSettings]);

  // ─── Company-wide Grand Totals ──────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    const totalBudgetCap = otSettings.monthlyOvertimeBudgetCap || 76000000;
    const eligibleEmployeesCount = employeeLiabilityData.filter((e) => e.isOvertimeEligible).length;

    const base = divisionLiabilityData.reduce(
      (acc, curr) => {
        acc.employees += curr.employeeCount;
        acc.totalLeaveQuota += curr.totalLeaveQuota;
        acc.totalLeaveUsed += curr.totalLeaveUsed;
        acc.totalLeaveRemaining += curr.totalLeaveRemaining;
        acc.totalLeaveValuationRp += curr.totalLeaveValuationRp;
        acc.totalOtHours = Number((acc.totalOtHours + curr.totalOtHours).toFixed(1));
        acc.paidOtHours = Number((acc.paidOtHours + curr.paidOtHours).toFixed(1));
        acc.unpaidOtHours = Number((acc.unpaidOtHours + curr.unpaidOtHours).toFixed(1));
        acc.usedBudgetRp += curr.usedBudgetRp;
        acc.pendingBudgetRp += curr.pendingBudgetRp;
        acc.totalLiabilityRp += curr.totalLiabilityRp;
        return acc;
      },
      {
        employees: 0,
        totalLeaveQuota: 0,
        totalLeaveUsed: 0,
        totalLeaveRemaining: 0,
        totalLeaveValuationRp: 0,
        totalOtHours: 0,
        paidOtHours: 0,
        unpaidOtHours: 0,
        usedBudgetRp: 0,
        pendingBudgetRp: 0,
        totalLiabilityRp: 0,
      }
    );

    const remainingBudgetRp = Math.max(0, totalBudgetCap - (base.usedBudgetRp + base.pendingBudgetRp));
    const budgetBurnPercent = totalBudgetCap > 0 ? Math.round(((base.usedBudgetRp + base.pendingBudgetRp) / totalBudgetCap) * 100) : 0;
    const leaveUsagePercent = base.totalLeaveQuota > 0 ? Math.round((base.totalLeaveUsed / base.totalLeaveQuota) * 100) : 0;
    const otRealizationPercent = base.totalOtHours > 0 ? Math.round((base.paidOtHours / base.totalOtHours) * 100) : 0;

    return {
      ...base,
      eligibleEmployeesCount,
      totalBudgetCap,
      remainingBudgetRp,
      budgetBurnPercent,
      leaveUsagePercent,
      otRealizationPercent,
    };
  }, [divisionLiabilityData, employeeLiabilityData, otSettings]);

  // ─── Filtered Employees ─────────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return employeeLiabilityData.filter((emp) => {
      const matchSearch =
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.divisionName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDiv = selectedDivision === 'all' || emp.divisionName === selectedDivision || emp.divisionId === selectedDivision;

      let matchStatus = true;
      if (filterLiabilityStatus === 'unpaid_ot') matchStatus = emp.unpaidOtHours > 0;
      if (filterLiabilityStatus === 'remaining_leave') matchStatus = emp.leaveRemaining > 0;

      let matchEligibility = true;
      if (filterEligibility === 'eligible_80') matchEligibility = emp.isOvertimeEligible;
      if (filterEligibility === 'ineligible') matchEligibility = !emp.isOvertimeEligible;

      return matchSearch && matchDiv && matchStatus && matchEligibility;
    });
  }, [employeeLiabilityData, searchQuery, selectedDivision, filterLiabilityStatus, filterEligibility]);

  // ─── Save Budget Settings ───────────────────────────────────────────────────
  const handleSaveBudget = () => {
    try {
      const updated: OvertimeSettings = {
        ...otSettings,
        monthlyOvertimeBudgetCap: Number(tempBudgetCap),
        divisionBudgetCaps: tempDivisionCaps,
      };
      hrmService.updateOvertimeSettings(updated);
      setOtSettings(updated);
      setIsBudgetModalOpen(false);
      toast.success('Pagu Anggaran Lembur Berhasil Diperbarui!', {
        description: `Total Plafon Bulanan: Rp ${Number(tempBudgetCap).toLocaleString('id-ID')}`,
      });
    } catch {
      toast.error('Gagal memperbarui pengaturan pagu anggaran.');
    }
  };

  // ─── Export to Excel (.xlsx) 3 SHEETS ───────────────────────────────────────
  const handleExportToExcel3Sheets = () => {
    try {
      // Sheet 1: Ringkasan Pagu Anggaran
      const summaryDataExport = [
        { Parameter: 'Bulan / Periode Audit', Nilai: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }) },
        { Parameter: 'Nama Perusahaan', Nilai: 'PT. FAWWAZ RESKI PERWIRA' },
        { Parameter: 'Total Personil Karyawan Aktif', Nilai: `${grandTotal.employees} Orang` },
        { Parameter: 'Personil Sah Berhak Lembur (SK Direksi)', Nilai: `${grandTotal.eligibleEmployeesCount || 80} Orang (Shiftman 47 + Wisma 33)` },
        { Parameter: 'Personil Non-Eligible Lembur (Staf Kantor)', Nilai: `${grandTotal.employees - (grandTotal.eligibleEmployeesCount || 80)} Orang (Pagu Rp 0)` },
        { Parameter: '----------------------------------------', Nilai: '----------------------------------------' },
        { Parameter: 'REKAPITULASI HAK CUTI KARYAWAN', Nilai: '' },
        { Parameter: 'Total Kuota Hak Cuti', Nilai: `${grandTotal.totalLeaveQuota} Hari` },
        { Parameter: 'Jumlah Cuti TELAH DIAMBIL', Nilai: `${grandTotal.totalLeaveUsed} Hari (${grandTotal.leaveUsagePercent}%)` },
        { Parameter: 'Jumlah Cuti BELUM DIAMBIL (SISA)', Nilai: `${grandTotal.totalLeaveRemaining} Hari (${100 - grandTotal.leaveUsagePercent}%)` },
        { Parameter: 'Kebijakan Kompensasi Sisa Cuti', Nilai: 'HANGUS (Aturan Intern PT FRP: Tidak Dapat Diuangkan / Beban Kas Rp 0)' },
        { Parameter: '----------------------------------------', Nilai: '----------------------------------------' },
        { Parameter: 'REKAPITULASI JAM LEMBUR OPERASIONAL (80 PERSONIL SAH)', Nilai: '' },
        { Parameter: 'Total Jam Lembur Disetujui', Nilai: `${grandTotal.totalOtHours} Jam` },
        { Parameter: 'Jam Lembur TELAH DICAIRKAN (TERBAYAR)', Nilai: `${grandTotal.paidOtHours} Jam (${grandTotal.otRealizationPercent}%)` },
        { Parameter: 'Jam Lembur BELUM DICAIRKAN (TERTUNDA)', Nilai: `${grandTotal.unpaidOtHours} Jam (${100 - grandTotal.otRealizationPercent}%)` },
        { Parameter: '----------------------------------------', Nilai: '----------------------------------------' },
        { Parameter: 'FINANSIAL & PAGU ANGGARAN LEMBUR SAH', Nilai: '' },
        { Parameter: '1. Nominal Lembur yang TERSEDIA (Pagu Sah 80 Personil)', Nilai: `Rp ${grandTotal.totalBudgetCap.toLocaleString('id-ID')} (Shiftman Rp 72jt + Wisma Rp 4jt)` },
        { Parameter: '2. Nominal Lembur yang TELAH DIGUNAKAN (Cair)', Nilai: `Rp ${grandTotal.usedBudgetRp.toLocaleString('id-ID')}` },
        { Parameter: '3. Nominal Lembur Tertunda (Belum Dicairkan)', Nilai: `Rp ${grandTotal.pendingBudgetRp.toLocaleString('id-ID')}` },
        { Parameter: '4. Nominal Lembur yang TERSISA (Sisa Pagu Bebas)', Nilai: `Rp ${grandTotal.remainingBudgetRp.toLocaleString('id-ID')}` },
        { Parameter: 'Persentase Penyerapan Anggaran Lembur', Nilai: `${grandTotal.budgetBurnPercent}%` },
        { Parameter: 'Status Plafon Anggaran', Nilai: grandTotal.budgetBurnPercent > 90 ? '🔴 KRITIS / OVERBUDGET' : grandTotal.budgetBurnPercent > 75 ? '🟡 WASPADA' : '🟢 AMAN (Di Bawah Plafon)' },
        { Parameter: '----------------------------------------', Nilai: '----------------------------------------' },
        { Parameter: 'TOTAL BEBAN LIABILITAS KAS PERUSAHAAN (LEMBUR BELUM CAIR)', Nilai: `Rp ${grandTotal.pendingBudgetRp.toLocaleString('id-ID')}` },
        { Parameter: 'Catatan Kebijakan PT FRP', Nilai: 'Sisa cuti hangus di akhir periode. Hak lembur hanya berlaku untuk 80 orang personil sah.' },
      ];

      // Sheet 2: Rekap Per Divisi
      const divDataExport = divisionLiabilityData.map((d, idx) => ({
        'No': idx + 1,
        'Nama Divisi': d.divisionName,
        'Jumlah Staf': d.employeeCount,
        'Kuota Cuti (Hari)': d.totalLeaveQuota,
        'Cuti TELAH DIAMBIL (Hari)': d.totalLeaveUsed,
        'Cuti BELUM DIAMBIL / SISA (Hari)': d.totalLeaveRemaining,
        'Kompensasi Sisa Cuti': 'Hangus (Rp 0)',
        'Total Jam Lembur': d.totalOtHours,
        'Lembur TELAH DICAIRKAN (Jam)': d.paidOtHours,
        'Lembur BELUM DICAIRKAN (Jam)': d.unpaidOtHours,
        'Pagu Lembur TERSEDIA (Rp)': d.allocatedBudgetRp,
        'Lembur TELAH DIGUNAKAN (Rp)': d.usedBudgetRp,
        'Lembur BELUM DICAIRKAN (Rp)': d.pendingBudgetRp,
        'Pagu Lembur TERSISA (Rp)': d.remainingBudgetRp,
        'Serapan Anggaran (%)': `${d.budgetBurnPercent}%`,
        'Total Liabilitas Kas Divisi (Rp)': d.pendingBudgetRp,
      }));

      // Sheet 3: Detail Per Karyawan
      const empDataExport = filteredEmployees.map((e, idx) => ({
        'No': idx + 1,
        'NIP': e.nip,
        'Nama Karyawan': e.name,
        'Divisi': e.divisionName,
        'Jabatan': e.jobTitle || '-',
        'Hak Lembur': e.isOvertimeEligible ? '80 Personil Sah' : 'Non-Eligible (Staf Kantor)',
        'Gaji Pokok (Rp)': e.baseSalary,
        'Upah Harian (Rp)': e.dailyRate,
        'Kuota Cuti (Hari)': e.leaveQuota,
        'Cuti TELAH DIAMBIL (Hari)': e.leaveUsed,
        'Cuti BELUM DIAMBIL / SISA (Hari)': e.leaveRemaining,
        'Kompensasi Sisa Cuti': 'Hangus (Rp 0)',
        'Total Jam Lembur (Jam)': e.totalOtHours,
        'Lembur TELAH DICAIRKAN (Jam)': e.paidOtHours,
        'Uang Lembur TELAH DIGUNAKAN (Rp)': e.paidOtPayRp,
        'Lembur BELUM DICAIRKAN (Jam)': e.unpaidOtHours,
        'Uang Lembur BELUM DICAIRKAN (Rp)': e.unpaidOtPayRp,
        'Total Kewajiban Kas (Rp)': e.totalLiabilityRp,
      }));

      const wb = XLSX.utils.book_new();
      const wsSum = XLSX.utils.json_to_sheet(summaryDataExport);
      const wsDiv = XLSX.utils.json_to_sheet(divDataExport);
      const wsEmp = XLSX.utils.json_to_sheet(empDataExport);

      XLSX.utils.book_append_sheet(wb, wsSum, 'Ringkasan_Pagu_Anggaran');
      XLSX.utils.book_append_sheet(wb, wsDiv, 'Rekap_Per_Divisi');
      XLSX.utils.book_append_sheet(wb, wsEmp, 'Detail_Hak_Per_Karyawan');

      const fileName = `Laporan_Rekap_Cuti_Lembur_Anggaran_FRP_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Laporan 3-Sheet Berhasil Diunduh!', {
        description: `File tersimpan: ${fileName}`,
      });
    } catch {
      toast.error('Gagal mengekspor laporan ke format Excel');
    }
  };

  return (
    <div className="space-y-6">
      {/* ═══ 1. EXECUTIVE COMPANY-WIDE 3-PILLAR HERO BAROMETER ══════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PILAR 1: SALDO HAK CUTI KARYAWAN */}
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden border-teal-500/20">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-teal-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-teal-600" />
                Pilar 1: Saldo Hak Cuti Karyawan
              </span>
              <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-700 border-teal-300 font-bold">
                {grandTotal.employees} Karyawan
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-muted/40 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium">Total Kuota</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{grandTotal.totalLeaveQuota} Hari</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">Telah Diambil</p>
                <p className="text-sm font-extrabold text-amber-600 mt-0.5">{grandTotal.totalLeaveUsed} Hari</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">Belum Diambil</p>
                <p className="text-sm font-black text-emerald-600 mt-0.5">{grandTotal.totalLeaveRemaining} Hari</p>
              </div>
            </div>

            {/* Visual Burn Gauge */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Rasio Pengambilan Cuti:</span>
                <span className="font-semibold text-foreground">{grandTotal.leaveUsagePercent}% Terpakai</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${grandTotal.leaveUsagePercent}%` }}
                  title={`Telah Diambil: ${grandTotal.totalLeaveUsed} Hari`}
                />
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${100 - grandTotal.leaveUsagePercent}%` }}
                  title={`Belum Diambil: ${grandTotal.totalLeaveRemaining} Hari`}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Kompensasi Sisa Cuti:</span>
              <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                Hangus (Rp 0 - Aturan Intern FRP)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* PILAR 2: REALISASI JAM LEMBUR */}
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden border-blue-500/20">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Pilar 2: Realisasi Jam Lembur (SPKL)
              </span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-300 font-bold">
                  80 Personil Sah
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-300 font-bold">
                  Total {grandTotal.totalOtHours} Jam
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-[10px] text-blue-800 dark:text-blue-300 font-bold">Telah Diambil / Cair</p>
                <p className="text-sm font-bold text-blue-600 mt-0.5">{grandTotal.paidOtHours} Jam</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  Rp {grandTotal.usedBudgetRp.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <p className="text-[10px] text-rose-800 dark:text-rose-300 font-bold">Belum Diambil / Cair</p>
                <p className="text-sm font-black text-rose-600 mt-0.5">{grandTotal.unpaidOtHours} Jam</p>
                <p className="text-[10px] text-rose-600 font-bold mt-0.5 font-mono">
                  Rp {grandTotal.pendingBudgetRp.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* Visual Realization Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Rasio Pencairan Jam (80 Personil Sah):</span>
                <span className="font-semibold text-foreground">{grandTotal.otRealizationPercent}% Telah Cair</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-600 h-full transition-all"
                  style={{ width: `${grandTotal.otRealizationPercent}%` }}
                  title={`Telah Cair: ${grandTotal.paidOtHours} Jam`}
                />
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{ width: `${100 - grandTotal.otRealizationPercent}%` }}
                  title={`Belum Cair: ${grandTotal.unpaidOtHours} Jam`}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Liabilitas Lembur Tertunda:</span>
              <span className="font-bold text-rose-600 font-mono">
                Rp {grandTotal.pendingBudgetRp.toLocaleString('id-ID')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PILAR 3: ANGGARAN & PAGU LEMBUR PERUSAHAAN (RP) */}
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden border-amber-500/30">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-600" />
                Pilar 3: Anggaran &amp; Pagu Lembur (Rp)
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsBudgetModalOpen(true)}
                className="h-6 px-2 text-[10px] font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-500/10 gap-1 rounded-md"
              >
                <Settings2 className="w-3 h-3" /> Atur Pagu
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="p-2 rounded-xl bg-muted/40 border border-border">
                <p className="text-[10px] text-muted-foreground font-semibold">1. Tersedia</p>
                <p className="text-xs font-bold text-foreground mt-0.5 font-mono">
                  Rp {(grandTotal.totalBudgetCap / 1000000).toFixed(1)}jt
                </p>
                <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">Plafon 80 Org Sah</p>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-[10px] text-blue-800 dark:text-blue-300 font-bold">2. Digunakan</p>
                <p className="text-xs font-extrabold text-blue-600 mt-0.5 font-mono">
                  Rp {(grandTotal.usedBudgetRp / 1000000).toFixed(1)}jt
                </p>
                <p className="text-[9px] text-blue-700 dark:text-blue-300">Telah Cair</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">3. Sisa Pagu</p>
                <p className="text-xs font-black text-emerald-600 mt-0.5 font-mono">
                  Rp {(grandTotal.remainingBudgetRp / 1000000).toFixed(1)}jt
                </p>
                <p className="text-[9px] text-emerald-700 dark:text-emerald-300">Sisa Bebas</p>
              </div>
            </div>

            {/* Budget Utilization Meter */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-muted-foreground">Tingkat Serapan Anggaran:</span>
                <span className="font-bold text-foreground font-mono">{grandTotal.budgetBurnPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    grandTotal.budgetBurnPercent > 90
                      ? 'bg-rose-600'
                      : grandTotal.budgetBurnPercent > 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, grandTotal.budgetBurnPercent)}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <div>
                <span className="text-muted-foreground font-medium">Beban Utang Kas Perusahaan:</span>
                <p className="text-[10px] text-muted-foreground">*Murni lembur 80 personil sah belum cair (sisa cuti hangus)</p>
              </div>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm">
                Rp {grandTotal.totalLiabilityRp.toLocaleString('id-ID')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ 2. CONTROLS, VIEW LEVEL, AND EXPORT BUTTONS ═══════════════════════ */}
      <Card className="border-border bg-card rounded-2xl shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* View Level Switcher */}
            <div className="flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setViewLevel('division')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewLevel === 'division'
                    ? 'bg-card text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>1. Rekapitulasi per Divisi ({divisionLiabilityData.length} Divisi)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewLevel('employee')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewLevel === 'employee'
                    ? 'bg-card text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>2. Rincian per Karyawan ({filteredEmployees.length} Staf)</span>
              </button>
            </div>

            {/* Export and Print Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLiveAuditData}
                disabled={isLoading}
                className="text-xs gap-1.5 rounded-xl h-9 font-semibold border-border hover:bg-muted"
                title="Sinkronisasi data cuti dan lembur langsung dari database server PostgreSQL"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
                <span>{isLoading ? 'Menyinkronkan...' : 'Sinkron Database'}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setPrintModalOpen(true)}
                className="text-xs gap-1.5 rounded-xl h-9 font-semibold border-border hover:bg-muted"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Dokumen Resmi
              </Button>
              <Button
                onClick={handleExportToExcel3Sheets}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 rounded-xl h-9 font-bold shadow-xs"
                title="Unduh file Excel resmi lengkap dengan 3 Sheet terstruktur"
              >
                <FileSpreadsheet className="w-4 h-4" /> Ekspor 3-Sheet (.xlsx)
              </Button>
            </div>
          </div>

          {/* Filters for Employee View */}
          {viewLevel === 'employee' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NIP..."
                  className="text-xs pl-8 rounded-xl h-9"
                />
              </div>

              <div>
                <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                  <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue placeholder="Pilih Divisi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Divisi ({divisions.length})</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filterLiabilityStatus} onValueChange={(v: any) => setFilterLiabilityStatus(v)}>
                  <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue placeholder="Status Cuti/Lembur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status Saldo</SelectItem>
                    <SelectItem value="unpaid_ot">🔴 Ada Lembur Belum Dibayar</SelectItem>
                    <SelectItem value="remaining_leave">🟢 Memiliki Sisa Kuota Cuti</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filterEligibility} onValueChange={(v: any) => setFilterEligibility(v)}>
                  <SelectTrigger className="text-xs rounded-xl h-9 font-medium"><SelectValue placeholder="Hak Lembur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Personil ({employeeLiabilityData.length})</SelectItem>
                    <SelectItem value="eligible_80">⭐ 80 Karyawan Sah Lembur</SelectItem>
                    <SelectItem value="ineligible">⚪ Non-Eligible (Staf Kantor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 3. VIEW LEVEL: REKAPITULASI PER DIVISI (MAIN TABLE) ═══════════════ */}
      {viewLevel === 'division' && (
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Matriks Rekapitulasi Cuti, Lembur &amp; Anggaran per Divisi
              </span>
              <Badge variant="outline" className="text-xs font-semibold">
                Periode: {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Konsolidasi komprehensif alokasi hak cuti (telah vs belum diambil), jam lembur (cair vs belum cair), serta kontrol pagu anggaran lembur (tersedia, digunakan, tersisa).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 text-muted-foreground border-b border-border font-bold">
                  <tr>
                    <th colSpan={2} className="p-2.5 border-r border-border text-center bg-muted/90">DIVISI &amp; STAF</th>
                    <th colSpan={4} className="p-2.5 border-r border-border text-center bg-teal-500/10 text-teal-900 dark:text-teal-300">
                      REKAPITULASI HAK CUTI
                    </th>
                    <th colSpan={3} className="p-2.5 border-r border-border text-center bg-blue-500/10 text-blue-900 dark:text-blue-300">
                      REKAPITULASI LEMBUR (JAM)
                    </th>
                    <th colSpan={4} className="p-2.5 border-r border-border text-center bg-amber-500/10 text-amber-900 dark:text-amber-300">
                      ANGGARAN &amp; PLAFON LEMBUR (RP)
                    </th>
                    <th className="p-2.5 text-center bg-muted/90">TOTAL</th>
                  </tr>
                  <tr className="border-t border-border/60 text-[11px]">
                    <th className="p-2.5">Nama Divisi</th>
                    <th className="p-2.5 text-center border-r border-border">Staf</th>

                    {/* Cuti Columns */}
                    <th className="p-2.5 text-center">Total Kuota</th>
                    <th className="p-2.5 text-center text-amber-600">Telah Diambil</th>
                    <th className="p-2.5 text-center bg-teal-500/5 text-teal-800 dark:text-teal-300 font-extrabold">Belum Diambil (Sisa)</th>
                    <th className="p-2.5 text-center border-r border-border bg-teal-500/5 text-teal-800 dark:text-teal-300">Kompensasi Sisa</th>

                    {/* Lembur Columns */}
                    <th className="p-2.5 text-center">Total Jam</th>
                    <th className="p-2.5 text-center text-blue-600">Telah Cair</th>
                    <th className="p-2.5 text-center border-r border-border bg-rose-500/5 text-rose-800 dark:text-rose-300 font-extrabold">Belum Cair</th>

                    {/* Finansial Columns */}
                    <th className="p-2.5 text-right font-bold text-foreground">1. Tersedia (Pagu)</th>
                    <th className="p-2.5 text-right text-blue-600 font-bold">2. Digunakan</th>
                    <th className="p-2.5 text-right text-rose-600 font-bold">Tertunda</th>
                    <th className="p-2.5 text-right border-r border-border bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-black">3. Sisa Pagu</th>

                    {/* Total Kewajiban Kas */}
                    <th className="p-2.5 text-right font-black">Lembur Belum Cair (Beban Kas)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {divisionLiabilityData.map((d) => (
                    <tr key={d.divisionId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{d.divisionName}</span>
                      </td>
                      <td className="p-2.5 text-center font-bold border-r border-border">{d.employeeCount}</td>

                      {/* Cuti */}
                      <td className="p-2.5 text-center">{d.totalLeaveQuota}h</td>
                      <td className="p-2.5 text-center font-bold text-amber-600">{d.totalLeaveUsed}h</td>
                      <td className="p-2.5 text-center font-black text-emerald-600 bg-teal-500/5">{d.totalLeaveRemaining}h</td>
                      <td className="p-2.5 text-center text-muted-foreground border-r border-border bg-teal-500/5">
                        <Badge variant="outline" className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                          Hangus (Rp 0)
                        </Badge>
                      </td>

                      {/* Lembur & Finansial */}
                      {d.allocatedBudgetRp > 0 ? (
                        <>
                          <td className="p-2.5 text-center">{d.totalOtHours}j</td>
                          <td className="p-2.5 text-center font-bold text-blue-600">{d.paidOtHours}j</td>
                          <td className="p-2.5 text-center font-black text-rose-600 border-r border-border bg-rose-500/5">{d.unpaidOtHours}j</td>

                          <td className="p-2.5 text-right font-mono font-bold text-foreground">
                            Rp {d.allocatedBudgetRp.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-blue-600">
                            Rp {d.usedBudgetRp.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-rose-600 font-semibold">
                            Rp {d.pendingBudgetRp.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 border-r border-border bg-emerald-500/5">
                            Rp {d.remainingBudgetRp.toLocaleString('id-ID')}
                          </td>

                          <td className="p-2.5 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                            Rp {d.totalLiabilityRp.toLocaleString('id-ID')}
                          </td>
                        </>
                      ) : (
                        <>
                          <td colSpan={3} className="p-2.5 text-center border-r border-border bg-muted/20">
                            <span className="text-[10.5px] text-muted-foreground italic">Non-Eligible Lembur</span>
                          </td>
                          <td colSpan={4} className="p-2.5 text-center border-r border-border bg-muted/20">
                            <span className="text-[10.5px] text-muted-foreground font-medium">Staf Kantor (Pagu Rp 0)</span>
                          </td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">
                            Rp 0
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/90 font-bold border-t-2 border-border text-foreground">
                  <tr className="text-xs">
                    <td className="p-3 font-black">TOTAL KESELURUHAN</td>
                    <td className="p-3 text-center border-r border-border">{grandTotal.employees}</td>

                    {/* Cuti Footer */}
                    <td className="p-3 text-center">{grandTotal.totalLeaveQuota} Hari</td>
                    <td className="p-3 text-center text-amber-600 font-extrabold">{grandTotal.totalLeaveUsed} Hari</td>
                    <td className="p-3 text-center text-emerald-600 bg-teal-500/10 font-black">{grandTotal.totalLeaveRemaining} Hari</td>
                    <td className="p-3 text-center bg-teal-500/10 border-r border-border">
                      <span className="text-[11px] font-bold text-muted-foreground">Hangus (Rp 0)</span>
                    </td>

                    {/* Lembur Footer */}
                    <td className="p-3 text-center">{grandTotal.totalOtHours} Jam</td>
                    <td className="p-3 text-center text-blue-600 font-extrabold">{grandTotal.paidOtHours} Jam</td>
                    <td className="p-3 text-center text-rose-600 bg-rose-500/10 font-black border-r border-border">{grandTotal.unpaidOtHours} Jam</td>

                    {/* Finansial Footer */}
                    <td className="p-3 text-right font-mono font-black text-foreground">
                      Rp {grandTotal.totalBudgetCap.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-blue-600">
                      Rp {grandTotal.usedBudgetRp.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">
                      Rp {grandTotal.pendingBudgetRp.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-r border-border">
                      Rp {grandTotal.remainingBudgetRp.toLocaleString('id-ID')}
                    </td>

                    {/* Total Beban */}
                    <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                      Rp {grandTotal.totalLiabilityRp.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 4. VIEW LEVEL: DETAIL PER KARYAWAN ════════════════════════════════ */}
      {viewLevel === 'employee' && (
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Rincian Saldo Cuti &amp; Kewajiban Lembur per Karyawan ({filteredEmployees.length} Personil)
              </span>
              <Badge variant="outline" className="text-xs">
                Audit Individual
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Audit granular saldo cuti terpakai vs belum diambil serta jam lembur belum dicairkan per individu karyawan.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border font-bold">
                  <tr>
                    <th className="p-3">Karyawan &amp; NIP</th>
                    <th className="p-3">Divisi / Jabatan</th>
                    <th className="p-3 text-right">Gaji Pokok</th>
                    <th className="p-3 text-center">Hak Cuti</th>
                    <th className="p-3 text-center text-amber-600">Telah Diambil</th>
                    <th className="p-3 text-center bg-teal-500/5 text-teal-800 dark:text-teal-300 font-extrabold">Belum Diambil</th>
                    <th className="p-3 text-center bg-teal-500/5 text-teal-800 dark:text-teal-300">Kompensasi Sisa</th>
                    <th className="p-3 text-center">Total Lembur</th>
                    <th className="p-3 text-center text-blue-600">Telah Cair</th>
                    <th className="p-3 text-center bg-rose-500/5 text-rose-800 dark:text-rose-300 font-extrabold">Belum Cair</th>
                    <th className="p-3 text-right bg-rose-500/5 text-rose-800 dark:text-rose-300">Nominal Belum Cair</th>
                    <th className="p-3 text-right font-black">Utang Kas Perusahaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-muted-foreground">
                        Tidak ada data karyawan yang cocok dengan kriteria filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.userId} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-semibold text-foreground">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold">{emp.name}</p>
                              {emp.isOvertimeEligible ? (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 font-bold">
                                  80 Personil Sah
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-slate-100 text-slate-500 border-slate-200 font-medium">
                                  Non-Eligible
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10.5px] text-muted-foreground font-mono">{emp.nip}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{emp.divisionName}</p>
                          <p className="text-[10px] text-muted-foreground">{emp.jobTitle}</p>
                        </td>
                        <td className="p-3 text-right font-mono text-[11px]">
                          Rp {emp.baseSalary.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-center font-medium">{emp.leaveQuota} Hari</td>
                        <td className="p-3 text-center text-amber-600 font-bold">{emp.leaveUsed} Hari</td>
                        <td className="p-3 text-center font-black text-emerald-600 bg-teal-500/5">
                          {emp.leaveRemaining} Hari
                        </td>
                        <td className="p-3 text-center bg-teal-500/5">
                          <Badge variant="outline" className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                            Hangus (Rp 0)
                          </Badge>
                        </td>
                        {emp.isOvertimeEligible ? (
                          <>
                            <td className="p-3 text-center">{emp.totalOtHours}j</td>
                            <td className="p-3 text-center font-bold text-blue-600">{emp.paidOtHours}j</td>
                            <td className="p-3 text-center font-bold text-rose-600 bg-rose-500/5">
                              {emp.unpaidOtHours > 0 ? (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-300 text-[10px]">
                                  {emp.unpaidOtHours} Jam
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">0 Jam</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-rose-600 bg-rose-500/5">
                              Rp {emp.unpaidOtPayRp.toLocaleString('id-ID')}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                              Rp {emp.totalLiabilityRp.toLocaleString('id-ID')}
                            </td>
                          </>
                        ) : (
                          <>
                            <td colSpan={4} className="p-3 text-center bg-muted/20">
                              <span className="text-[10.5px] text-muted-foreground italic">Non-Eligible Lembur (Staf Kantor)</span>
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-muted-foreground">
                              Rp 0
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 5. MODAL PENYESUAIAN PAGU ANGGARAN LEMBUR ═════════════════════════ */}
      <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-amber-600" />
              Penyesuaian Plafon Anggaran Lembur
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur plafon batas maksimal anggaran lembur bulanan yang diizinkan oleh Direksi &amp; Pimpinan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Plafon Global */}
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <label className="font-bold text-foreground">Plafon Anggaran Lembur Total Perusahaan (Rp/Bulan)</label>
              <Input
                type="number"
                value={tempBudgetCap}
                onChange={(e) => setTempBudgetCap(Number(e.target.value))}
                className="text-sm font-mono font-bold rounded-xl h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Setara: <span className="font-bold text-amber-700 dark:text-amber-300">Rp {tempBudgetCap.toLocaleString('id-ID')}</span>
              </p>
            </div>

            {/* Plafon Khusus Per Divisi */}
            <div className="space-y-2">
              <p className="font-bold text-foreground">Alokasi Plafon Baku per Divisi:</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <span className="font-medium text-foreground">Shiftman Lapangan (47 Orang):</span>
                  <Input
                    type="number"
                    value={tempDivisionCaps['Shiftman Lapangan'] ?? 72000000}
                    onChange={(e) => setTempDivisionCaps({ ...tempDivisionCaps, 'Shiftman Lapangan': Number(e.target.value), 'Shiftman': Number(e.target.value) })}
                    className="w-36 text-xs font-mono font-bold text-right h-8"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <span className="font-medium text-foreground">Wisma Biring Ere (33 Orang):</span>
                  <Input
                    type="number"
                    value={tempDivisionCaps['Wisma Biring Ere'] ?? 4000000}
                    onChange={(e) => setTempDivisionCaps({ ...tempDivisionCaps, 'Wisma Biring Ere': Number(e.target.value) })}
                    className="w-36 text-xs font-mono font-bold text-right h-8"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <span className="font-medium text-foreground">Staf Kantor &amp; Non-Operasional:</span>
                    <p className="text-[10px] text-muted-foreground">Tidak berhak lembur (SK Direksi)</p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 font-mono font-bold">
                    Rp 0 (Non-Eligible)
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsBudgetModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveBudget} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Simpan Pengaturan Plafon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 6. MODAL CETAK RESMI FORMAT A4 ═══════════════════════════════════ */}
      <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
        <DialogContent className="max-w-4xl rounded-2xl max-h-[92vh] overflow-y-auto p-0">
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pratinjau Dokumen Resmi Rekap Cuti &amp; Anggaran Lembur</h3>
                <p className="text-[11px] text-muted-foreground">Format siap cetak A4 atau ekspor ke PDF</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPrintModalOpen(false)} className="text-xs rounded-xl">
                Tutup
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 rounded-xl shadow-xs">
                <Printer className="w-3.5 h-3.5" /> Cetak Sekarang (Print / PDF)
              </Button>
            </div>
          </div>

          {/* Printable Sheet */}
          <div className="p-8 sm:p-12 bg-white text-slate-900 font-sans space-y-6">
            <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
              <h2 className="text-lg font-black tracking-wide uppercase">PT. FAWWAZ RESKI PERWIRA</h2>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                LAPORAN KONSOLIDASI SALDO CUTI &amp; KONTROL ANGGARAN LEMBUR
              </h3>
              <p className="text-xs text-slate-500">
                Periode: {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })} | Status: Resmi / Validated
              </p>
            </div>

            {/* Ringkasan 3 Angka Utama */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Sisa Hak Cuti Karyawan</p>
                <p className="text-sm font-black text-slate-800">{grandTotal.totalLeaveRemaining} Hari</p>
                <p className="text-[10px] text-slate-500 font-medium">Kompensasi: Hangus (Rp 0 - Kebijakan FRP)</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Pagu Anggaran Lembur Sah (80 Org)</p>
                <p className="text-sm font-black text-slate-800">Rp {grandTotal.totalBudgetCap.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-slate-500">Telah Digunakan: Rp {grandTotal.usedBudgetRp.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Sisa Pagu Anggaran Lembur</p>
                <p className="text-sm font-black text-emerald-700">Rp {grandTotal.remainingBudgetRp.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-rose-600 font-bold">Utang Kas Lembur: Rp {grandTotal.pendingBudgetRp.toLocaleString('id-ID')}</p>
              </div>
            </div>

            {/* Tabel Cetak Per Divisi */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-800">Rekapitulasi per Departemen / Divisi (Khusus 80 Personil Sah):</h4>
              <table className="w-full text-[11px] border-collapse border border-slate-300">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-1.5 text-left">Divisi</th>
                    <th className="border border-slate-300 p-1.5 text-center">Staf</th>
                    <th className="border border-slate-300 p-1.5 text-center">Cuti Diambil</th>
                    <th className="border border-slate-300 p-1.5 text-center">Sisa Cuti</th>
                    <th className="border border-slate-300 p-1.5 text-center">Kompensasi</th>
                    <th className="border border-slate-300 p-1.5 text-center">Lembur Cair</th>
                    <th className="border border-slate-300 p-1.5 text-center">Lembur Belum Cair</th>
                    <th className="border border-slate-300 p-1.5 text-right">Pagu Tersedia</th>
                    <th className="border border-slate-300 p-1.5 text-right">Telah Digunakan</th>
                    <th className="border border-slate-300 p-1.5 text-right">Sisa Pagu</th>
                    <th className="border border-slate-300 p-1.5 text-right">Utang Kas Lembur</th>
                  </tr>
                </thead>
                <tbody>
                  {divisionLiabilityData.map((d) => (
                    <tr key={d.divisionId}>
                      <td className="border border-slate-300 p-1.5 font-bold">{d.divisionName}</td>
                      <td className="border border-slate-300 p-1.5 text-center">{d.employeeCount}</td>
                      <td className="border border-slate-300 p-1.5 text-center">{d.totalLeaveUsed}h</td>
                      <td className="border border-slate-300 p-1.5 text-center font-bold">{d.totalLeaveRemaining}h</td>
                      <td className="border border-slate-300 p-1.5 text-center text-slate-500 font-medium">Hangus (Rp 0)</td>
                      {d.allocatedBudgetRp > 0 ? (
                        <>
                          <td className="border border-slate-300 p-1.5 text-center">{d.paidOtHours}j</td>
                          <td className="border border-slate-300 p-1.5 text-center font-bold text-red-600">{d.unpaidOtHours}j</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">Rp {d.allocatedBudgetRp.toLocaleString('id-ID')}</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">Rp {d.usedBudgetRp.toLocaleString('id-ID')}</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-bold text-emerald-700">Rp {d.remainingBudgetRp.toLocaleString('id-ID')}</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-black text-rose-600">Rp {d.totalLiabilityRp.toLocaleString('id-ID')}</td>
                        </>
                      ) : (
                        <>
                          <td colSpan={2} className="border border-slate-300 p-1.5 text-center text-slate-400 italic">Non-Eligible</td>
                          <td colSpan={3} className="border border-slate-300 p-1.5 text-center text-slate-400 italic">Staf Kantor / Pagu Rp 0</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono text-slate-400">Rp 0</td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td className="border border-slate-300 p-1.5 font-black">TOTAL KESELURUHAN</td>
                    <td className="border border-slate-300 p-1.5 text-center">{grandTotal.employees}</td>
                    <td className="border border-slate-300 p-1.5 text-center">{grandTotal.totalLeaveUsed}h</td>
                    <td className="border border-slate-300 p-1.5 text-center font-black">{grandTotal.totalLeaveRemaining}h</td>
                    <td className="border border-slate-300 p-1.5 text-center text-slate-500 font-medium">Hangus (Rp 0)</td>
                    <td className="border border-slate-300 p-1.5 text-center">{grandTotal.paidOtHours}j</td>
                    <td className="border border-slate-300 p-1.5 text-center font-black text-red-600">{grandTotal.unpaidOtHours}j</td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono font-black">Rp {grandTotal.totalBudgetCap.toLocaleString('id-ID')}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono font-black">Rp {grandTotal.usedBudgetRp.toLocaleString('id-ID')}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono font-black text-emerald-700">Rp {grandTotal.remainingBudgetRp.toLocaleString('id-ID')}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono font-black text-rose-600">Rp {grandTotal.totalLiabilityRp.toLocaleString('id-ID')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Kolom Tanda Tangan Formal */}
            <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs">
              <div className="space-y-12">
                <p className="font-semibold text-slate-600">Dibuat Oleh,</p>
                <div>
                  <p className="font-bold underline text-slate-800">SUPERADMIN / HRD</p>
                  <p className="text-[10px] text-slate-500">PT. FAWWAZ RESKI PERWIRA</p>
                </div>
              </div>
              <div className="space-y-12">
                <p className="font-semibold text-slate-600">Diperiksa Oleh,</p>
                <div>
                  <p className="font-bold underline text-slate-800">KEPALA KEUANGAN</p>
                  <p className="text-[10px] text-slate-500">Finance &amp; Budgeting</p>
                </div>
              </div>
              <div className="space-y-12">
                <p className="font-semibold text-slate-600">Disetujui Oleh,</p>
                <div>
                  <p className="font-bold underline text-slate-800">DIREKTUR UTAMA / PIMPINAN</p>
                  <p className="text-[10px] text-slate-500">Management PT. Fawwaz Reski Perwira</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
