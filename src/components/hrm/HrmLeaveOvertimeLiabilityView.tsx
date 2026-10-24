import React, { useState, useMemo, useRef } from 'react';
import { hrmService } from '@/services/hrmService';
import { UserProfile, Division, AppSettings, OvertimeRecord } from '@/types/hrm';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  leaveUsed: number;        // Cuti terpakai
  leaveRemaining: number;   // Sisa cuti belum diambil
  leaveValuationRp: number; // Nilai kompensasi sisa cuti (leaveRemaining * dailyRate)

  // ─── LEMBUR DATA ───
  totalOtHours: number;     // Total jam lembur disetujui
  totalOtPayRp: number;     // Total uang lembur disetujui
  paidOtHours: number;      // Jam lembur sudah dicairkan/dibayar
  paidOtPayRp: number;      // Uang lembur sudah dicairkan/dibayar
  unpaidOtHours: number;    // Jam lembur BELUM diambil/belum dibayar
  unpaidOtPayRp: number;    // Uang lembur BELUM diambil/belum dibayar (Accrued Liability)

  // ─── TOTAL KEWAJIBAN ───
  totalLiabilityRp: number; // leaveValuationRp + unpaidOtPayRp
}

export interface DivisionLiabilitySummary {
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
}

export const HrmLeaveOvertimeLiabilityView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [filterLiabilityStatus, setFilterLiabilityStatus] = useState<'all' | 'unpaid_ot' | 'remaining_leave'>('all');
  const [viewLevel, setViewLevel] = useState<'employee' | 'division'>('employee');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const appSettings: AppSettings = hrmService.getAppSettings();
  const divisions: Division[] = hrmService.getDivisions();
  const rawUsers: UserProfile[] = hrmService.getUsers().filter((u) => u.role !== 'superadmin');
  const allOvertimes: OvertimeRecord[] = hrmService.getOvertimeRecords();
  const salaryProfiles = hrmService.getSalaryProfiles();

  // ─── Process Employee Data ──────────────────────────────────────────────────
  const employeeLiabilityData: EmployeeLiabilityRow[] = useMemo(() => {
    return rawUsers.map((user) => {
      const sp = salaryProfiles.find((p) => p.userId === user.id);
      const baseSalary = sp?.baseSalary || 4100000;
      const dailyRate = Math.round(baseSalary / 25);
      const hourlyOtRate = Math.round(baseSalary / 173);

      // Cuti calculations
      const leaveQuota = user.annual_leave_quota ?? 12;
      const leaveUsed = user.used_leave_days ?? 0;
      const leaveRemaining = Math.max(0, leaveQuota - leaveUsed);
      const leaveValuationRp = leaveRemaining * dailyRate;

      // Lembur calculations
      const userOts = allOvertimes.filter((o) => (o.userId === user.id || o.userNip === user.nip) && o.status === 'approved');
      const totalOtHours = Number(userOts.reduce((acc, o) => acc + (o.durationHours || 0), 0).toFixed(1));
      const totalOtPayRp = userOts.reduce((acc, o) => acc + (o.totalPay || 0), 0);

      const paidOts = userOts.filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'included_in_payroll');
      const paidOtHours = Number(paidOts.reduce((acc, o) => acc + (o.durationHours || 0), 0).toFixed(1));
      const paidOtPayRp = paidOts.reduce((acc, o) => acc + (o.totalPay || 0), 0);

      const unpaidOts = userOts.filter((o) => o.paymentStatus === 'unpaid' || !o.paymentStatus);
      const unpaidOtHours = Number(unpaidOts.reduce((acc, o) => acc + (o.durationHours || 0), 0).toFixed(1));
      const unpaidOtPayRp = unpaidOts.reduce((acc, o) => acc + (o.totalPay || 0), 0);

      const totalLiabilityRp = leaveValuationRp + unpaidOtPayRp;

      return {
        userId: user.id,
        name: user.fullName || 'Tanpa Nama',
        nip: user.nip || '-',
        divisionId: user.divisionId,
        divisionName: user.divisionName || user.division || 'Umum',
        jobTitle: user.position || user.jobTitle || 'Staff',
        baseSalary,
        dailyRate,
        hourlyOtRate,
        leaveQuota,
        leaveUsed,
        leaveRemaining,
        leaveValuationRp,
        totalOtHours,
        totalOtPayRp,
        paidOtHours,
        paidOtPayRp,
        unpaidOtHours,
        unpaidOtPayRp,
        totalLiabilityRp,
      };
    });
  }, [rawUsers, allOvertimes, salaryProfiles]);

  // ─── Process Division Aggregation ───────────────────────────────────────────
  const divisionLiabilityData: DivisionLiabilitySummary[] = useMemo(() => {
    const map = new Map<string, DivisionLiabilitySummary>();

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

    return Array.from(map.values()).sort((a, b) => b.totalLiabilityRp - a.totalLiabilityRp);
  }, [employeeLiabilityData]);

  // ─── Company-wide Grand Totals ──────────────────────────────────────────────
  const grandTotal = useMemo(() => {
    return employeeLiabilityData.reduce(
      (acc, curr) => {
        acc.employees += 1;
        acc.totalLeaveQuota += curr.leaveQuota;
        acc.totalLeaveUsed += curr.leaveUsed;
        acc.totalLeaveRemaining += curr.leaveRemaining;
        acc.totalLeaveValuationRp += curr.leaveValuationRp;
        acc.totalOtHours = Number((acc.totalOtHours + curr.totalOtHours).toFixed(1));
        acc.paidOtHours = Number((acc.paidOtHours + curr.paidOtHours).toFixed(1));
        acc.unpaidOtHours = Number((acc.unpaidOtHours + curr.unpaidOtHours).toFixed(1));
        acc.paidOtPayRp += curr.paidOtPayRp;
        acc.unpaidOtPayRp += curr.unpaidOtPayRp;
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
        paidOtPayRp: 0,
        unpaidOtPayRp: 0,
        totalLiabilityRp: 0,
      }
    );
  }, [employeeLiabilityData]);

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

      return matchSearch && matchDiv && matchStatus;
    });
  }, [employeeLiabilityData, searchQuery, selectedDivision, filterLiabilityStatus]);

  // ─── Export to Excel (.xlsx) ────────────────────────────────────────────────
  const handleExportToExcel = () => {
    try {
      // Sheet 1: Detail Karyawan
      const empDataExport = filteredEmployees.map((e, idx) => ({
        'No': idx + 1,
        'NIP': e.nip,
        'Nama Karyawan': e.name,
        'Divisi': e.divisionName,
        'Jabatan': e.jobTitle || '-',
        'Gaji Pokok (Rp)': e.baseSalary,
        'Upah Harian (Rp)': e.dailyRate,
        'Kuota Cuti (Hari)': e.leaveQuota,
        'Cuti Terpakai (Hari)': e.leaveUsed,
        'Sisa Cuti Belum Diambil (Hari)': e.leaveRemaining,
        'Valuasi Saldo Cuti (Rp)': e.leaveValuationRp,
        'Total Lembur Disetujui (Jam)': e.totalOtHours,
        'Lembur Sudah Terbayar (Jam)': e.paidOtHours,
        'Uang Lembur Terbayar (Rp)': e.paidOtPayRp,
        'Lembur BELUM Dibayar (Jam)': e.unpaidOtHours,
        'Uang Lembur BELUM Dibayar (Rp)': e.unpaidOtPayRp,
        'Total Kewajiban Finansial (Rp)': e.totalLiabilityRp,
      }));

      // Sheet 2: Rekap Per Divisi
      const divDataExport = divisionLiabilityData.map((d, idx) => ({
        'No': idx + 1,
        'Nama Divisi': d.divisionName,
        'Jumlah Karyawan': d.employeeCount,
        'Total Kuota Cuti (Hari)': d.totalLeaveQuota,
        'Total Cuti Terpakai (Hari)': d.totalLeaveUsed,
        'Total Sisa Cuti (Hari)': d.totalLeaveRemaining,
        'Valuasi Sisa Cuti (Rp)': d.totalLeaveValuationRp,
        'Total Jam Lembur': d.totalOtHours,
        'Jam Lembur Terbayar': d.paidOtHours,
        'Jam Lembur BELUM Dibayar': d.unpaidOtHours,
        'Uang Lembur Terbayar (Rp)': d.paidOtPayRp,
        'Uang Lembur BELUM Dibayar (Rp)': d.unpaidOtPayRp,
        'Total Kewajiban Divisi (Rp)': d.totalLiabilityRp,
      }));

      const wb = XLSX.utils.book_new();
      const wsEmp = XLSX.utils.json_to_sheet(empDataExport);
      const wsDiv = XLSX.utils.json_to_sheet(divDataExport);

      XLSX.utils.book_append_sheet(wb, wsDiv, 'Rekap_Per_Divisi');
      XLSX.utils.book_append_sheet(wb, wsEmp, 'Detail_Per_Karyawan');

      const fileName = `Rekap_Saldo_Cuti_Lembur_FRP_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Laporan Saldo Cuti & Lembur (${fileName}) berhasil diunduh!`);
    } catch {
      toast.error('Gagal mengekspor laporan ke format Excel');
    }
  };

  // ─── Print View Handler ─────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ═══ 1. EXECUTIVE COMPANY-WIDE KPI CARDS ═══════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Cuti Perusahaan */}
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-teal-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-teal-600" />
                Saldo Hak Cuti Karyawan
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
              <div className="p-2 rounded-xl bg-muted/40 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium">Terpakai</p>
                <p className="text-sm font-bold text-amber-600 mt-0.5">{grandTotal.totalLeaveUsed} Hari</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">Belum Diambil</p>
                <p className="text-sm font-extrabold text-emerald-600 mt-0.5">{grandTotal.totalLeaveRemaining} Hari</p>
              </div>
            </div>
            <div className="pt-1 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Taksiran Valuasi Cuti:</span>
              <span className="font-bold text-foreground font-mono">
                Rp {grandTotal.totalLeaveValuationRp.toLocaleString('id-ID')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Saldo Lembur & Pencairan */}
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-blue-600" />
                Akumulasi Jam Lembur & Pencairan
              </span>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-300 font-bold">
                Total {grandTotal.totalOtHours} Jam
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-xl bg-muted/40 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium">Sudah Dibayar</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{grandTotal.paidOtHours} Jam</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Rp {grandTotal.paidOtPayRp.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <p className="text-[10px] text-rose-800 dark:text-rose-300 font-bold">Belum Diambil/Dibayar</p>
                <p className="text-sm font-extrabold text-rose-600 mt-0.5">{grandTotal.unpaidOtHours} Jam</p>
                <p className="text-[10px] text-rose-700 dark:text-rose-300 font-bold mt-0.5">Rp {grandTotal.unpaidOtPayRp.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="pt-1 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Kewajiban Lembur Tertunda:</span>
              <span className="font-bold text-rose-600 font-mono">
                Rp {grandTotal.unpaidOtPayRp.toLocaleString('id-ID')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Kewajiban Finansial Perusahaan */}
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/50 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-600" />
                Total Kewajiban Finansial Perusahaan
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-300 font-bold">
                Liability Cap
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="p-3 bg-gradient-to-br from-amber-500/10 to-primary/10 border border-amber-500/20 rounded-xl text-center">
              <p className="text-[11px] text-muted-foreground font-semibold">Total Nilai Cuti Sisa + Lembur Tertunda</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1 font-mono">
                Rp {grandTotal.totalLiabilityRp.toLocaleString('id-ID')}
              </p>
            </div>
            <p className="text-[10.5px] text-muted-foreground leading-relaxed text-center">
              *Taksiran kewajiban finansial jika seluruh sisa cuti dan lembur yang belum dicairkan dikonversi sesuai upah resmi.
            </p>
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
                onClick={() => setViewLevel('employee')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewLevel === 'employee'
                    ? 'bg-card text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>Rincian per Karyawan ({filteredEmployees.length})</span>
              </button>

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
                <span>Rekapitulasi per Divisi ({divisionLiabilityData.length})</span>
              </button>
            </div>

            {/* Export and Print Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="text-xs gap-1.5 rounded-xl h-9 font-semibold border-border hover:bg-muted"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak / PDF
              </Button>
              <Button
                onClick={handleExportToExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 rounded-xl h-9 font-bold shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" /> Unduh Rekap (.xlsx)
              </Button>
            </div>
          </div>

          {/* Filters for Employee View */}
          {viewLevel === 'employee' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama karyawan atau NIP..."
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
                  <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue placeholder="Filter Kewajiban" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status Karyawan</SelectItem>
                    <SelectItem value="unpaid_ot">🔴 Ada Lembur Belum Dibayar</SelectItem>
                    <SelectItem value="remaining_leave">🟢 Memiliki Sisa Kuota Cuti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 3. VIEW LEVEL: REKAPITULASI PER DIVISI ════════════════════════════ */}
      {viewLevel === 'division' && (
        <Card className="border-border bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Rekapitulasi Saldo Cuti & Kewajiban Lembur per Divisi
            </CardTitle>
            <CardDescription className="text-xs">
              Ringkasan konsolidasi alokasi hak cuti, sisa hari belum terpakai, dan akumulasi lembur belum terbayar per departemen.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border font-bold">
                  <tr>
                    <th className="p-3">Divisi</th>
                    <th className="p-3 text-center">Staff</th>
                    <th className="p-3 text-center">Total Kuota Cuti</th>
                    <th className="p-3 text-center">Cuti Terpakai</th>
                    <th className="p-3 text-center bg-teal-500/5 text-teal-800 dark:text-teal-300">Sisa Cuti</th>
                    <th className="p-3 text-right bg-teal-500/5 text-teal-800 dark:text-teal-300">Valuasi Cuti</th>
                    <th className="p-3 text-center">Total Lembur</th>
                    <th className="p-3 text-center">Lembur Terbayar</th>
                    <th className="p-3 text-center bg-rose-500/5 text-rose-800 dark:text-rose-300">Lembur Belum Diambil</th>
                    <th className="p-3 text-right bg-rose-500/5 text-rose-800 dark:text-rose-300">Nominal Tertunda</th>
                    <th className="p-3 text-right font-black">Total Kewajiban</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {divisionLiabilityData.map((d) => (
                    <tr key={d.divisionId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-bold text-foreground flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {d.divisionName}
                      </td>
                      <td className="p-3 text-center font-bold">{d.employeeCount}</td>
                      <td className="p-3 text-center">{d.totalLeaveQuota} Hari</td>
                      <td className="p-3 text-center text-amber-600">{d.totalLeaveUsed} Hari</td>
                      <td className="p-3 text-center font-bold text-emerald-600 bg-teal-500/5">{d.totalLeaveRemaining} Hari</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700 bg-teal-500/5">
                        Rp {d.totalLeaveValuationRp.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center">{d.totalOtHours} Jam</td>
                      <td className="p-3 text-center text-muted-foreground">{d.paidOtHours} Jam</td>
                      <td className="p-3 text-center font-bold text-rose-600 bg-rose-500/5">{d.unpaidOtHours} Jam</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600 bg-rose-500/5">
                        Rp {d.unpaidOtPayRp.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-foreground">
                        Rp {d.totalLiabilityRp.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/80 font-bold border-t-2 border-border text-foreground">
                  <tr>
                    <td className="p-3">TOTAL KESELURUHAN</td>
                    <td className="p-3 text-center">{grandTotal.employees}</td>
                    <td className="p-3 text-center">{grandTotal.totalLeaveQuota} Hari</td>
                    <td className="p-3 text-center text-amber-600">{grandTotal.totalLeaveUsed} Hari</td>
                    <td className="p-3 text-center text-emerald-600 bg-teal-500/10 font-extrabold">{grandTotal.totalLeaveRemaining} Hari</td>
                    <td className="p-3 text-right font-mono bg-teal-500/10 text-emerald-700 font-extrabold">
                      Rp {grandTotal.totalLeaveValuationRp.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center">{grandTotal.totalOtHours} Jam</td>
                    <td className="p-3 text-center text-muted-foreground">{grandTotal.paidOtHours} Jam</td>
                    <td className="p-3 text-center text-rose-600 bg-rose-500/10 font-extrabold">{grandTotal.unpaidOtHours} Jam</td>
                    <td className="p-3 text-right font-mono text-rose-600 bg-rose-500/10 font-extrabold">
                      Rp {grandTotal.unpaidOtPayRp.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-amber-700 dark:text-amber-300">
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
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Rincian Saldo Cuti & Kewajiban Lembur per Karyawan ({filteredEmployees.length} Personel)
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
                    <th className="p-3">Karyawan & NIP</th>
                    <th className="p-3">Divisi / Jabatan</th>
                    <th className="p-3 text-right">Gaji Pokok</th>
                    <th className="p-3 text-center">Kuota Cuti</th>
                    <th className="p-3 text-center">Terpakai</th>
                    <th className="p-3 text-center bg-teal-500/5 text-teal-800 dark:text-teal-300">Sisa Cuti</th>
                    <th className="p-3 text-right bg-teal-500/5 text-teal-800 dark:text-teal-300">Valuasi Cuti</th>
                    <th className="p-3 text-center">Total Lembur</th>
                    <th className="p-3 text-center">Terbayar</th>
                    <th className="p-3 text-center bg-rose-500/5 text-rose-800 dark:text-rose-300">Lembur Belum Diambil</th>
                    <th className="p-3 text-right bg-rose-500/5 text-rose-800 dark:text-rose-300">Nominal Belum Dibayar</th>
                    <th className="p-3 text-right font-black">Total Kewajiban</th>
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
                            <p className="font-bold">{emp.name}</p>
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
                        <td className="p-3 text-center text-amber-600 font-medium">{emp.leaveUsed} Hari</td>
                        <td className="p-3 text-center font-bold text-emerald-600 bg-teal-500/5">
                          {emp.leaveRemaining} Hari
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-700 bg-teal-500/5">
                          Rp {emp.leaveValuationRp.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-center">{emp.totalOtHours}j</td>
                        <td className="p-3 text-center text-muted-foreground">{emp.paidOtHours}j</td>
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
                        <td className="p-3 text-right font-mono font-black text-foreground">
                          Rp {emp.totalLiabilityRp.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
