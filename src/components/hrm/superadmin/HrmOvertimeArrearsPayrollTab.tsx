import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  CheckCircle2,
  ArrowRight,
  Clock,
  Wallet,
  Send,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ArrearsEmployeeRow {
  userId: string;
  nip: string;
  fullName: string;
  divisionName: string;
  group: 'RUMAH TANGGA' | 'SHIPMENT' | 'KARYAWAN TETAP';
  isDayShift: boolean;
  baseSalary: number;
  hourlyRate: number;
  spklApprovedCount: number;
  spklPendingCount: number;
  rawApprovedHours: number;
  cappedRealHours: number;
  paidHours: number;
  flexytimeHours: number;
  rawCalculatedPay?: number;
  calculatedPay: number;
  recordedCompensationSum: number;
  syncState: 'no_overtime' | 'ready_for_payroll' | 'included_in_payroll' | 'paid';
  overtimeIds: string[];
}

export interface GroupSummary {
  employeeCount: number;
  withOvertimeCount: number;
  totalRawHours: number;
  totalPaidHours: number;
  totalFlexytimeHours: number;
  rawTotalPay?: number;
  totalPay: number;
  budgetCap: number;
  budgetRemaining: number;
  isProratedToCap?: boolean;
  readyCount: number;
  includedCount: number;
  paidCount: number;
}

export interface BudgetMeta {
  shipmentCap: number;
  wismaCap: number;
  totalCap: number;
  skShipmentCap: number;
  skWismaCap: number;
  skTotalCap: number;
  isEffectiveOverride: boolean;
  perWismaPersonCap: number;
  shipmentScaleFactor: number;
  isShipmentProrated: boolean;
}

export interface ArrearsRecapResponse {
  payrollMonth: string;
  sourceOvertimeMonth: string;
  linkedPeriod: { id: string; period_label: string; status: string; total_net?: number } | null;
  budgetMeta?: BudgetMeta;
  totals: {
    rumahTangga: GroupSummary;
    shipment: GroupSummary;
    karyawanTetap: GroupSummary;
    grandTotalPay: number;
    grandTotalHours: number;
  };
  employees: ArrearsEmployeeRow[];
}

const MONTH_NAMES_ID: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

const formatYmLabel = (ym: string) => {
  const [y, m] = (ym || '').split('-');
  return `${MONTH_NAMES_ID[m] || m} ${y || ''}`.trim();
};

const getCurrentAndNextMonths = () => {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextYm = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  return { curYm, nextYm };
};

interface Props {
  onSynced?: () => void;
}

export const HrmOvertimeArrearsPayrollTab: React.FC<Props> = ({ onSynced }) => {
  const { curYm, nextYm } = useMemo(() => getCurrentAndNextMonths(), []);
  const [payrollMonth, setPayrollMonth] = useState<string>(curYm);
  const [recap, setRecap] = useState<ArrearsRecapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingPayroll, setSyncingPayroll] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'ALL' | 'RUMAH TANGGA' | 'SHIPMENT' | 'KARYAWAN TETAP'>('ALL');
  const [onlyWithOvertime, setOnlyWithOvertime] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editShipmentBudget, setEditShipmentBudget] = useState<string>('65000000');
  const [editWismaBudget, setEditWismaBudget] = useState<string>('4000000');
  const [savingBudget, setSavingBudget] = useState(false);

  const fetchArrearsRecap = async (targetMonth = payrollMonth) => {
    setLoading(true);
    try {
      const res: any = await api.get(`/overtime/payroll-arrears-recap?payrollMonth=${encodeURIComponent(targetMonth)}`);
      if (res?.success && res.data) {
        setRecap(res.data);
        if (res.data.budgetMeta) {
          setEditShipmentBudget(String(res.data.budgetMeta.shipmentCap));
          setEditWismaBudget(String(res.data.budgetMeta.wismaCap));
        }
      } else {
        toast.error(res?.error || 'Gagal memuat rekap lembur bulan mundur (N-1)');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghubungi server payroll arrears');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArrearsRecap(payrollMonth);
  }, [payrollMonth]);

  const handleSaveEffectiveBudget = async () => {
    const shipVal = Number(String(editShipmentBudget).replace(/[^\d]/g, ''));
    const wismaVal = Number(String(editWismaBudget).replace(/[^\d]/g, ''));
    if (!Number.isFinite(shipVal) || shipVal < 0 || !Number.isFinite(wismaVal) || wismaVal < 0) {
      toast.error('Nominal budget harus angka valid >= 0');
      return;
    }
    setSavingBudget(true);
    try {
      const res: any = await api.put('/payroll/periods/effective-budget', {
        payrollMonth,
        effectiveShipmentBudget: shipVal,
        effectiveWismaBudget: wismaVal,
      });
      if (res?.success && res.data) {
        setRecap(res.data);
        toast.success(res.message || 'Budget efektif bulanan berhasil disimpan ke PostgreSQL.');
      } else {
        toast.error(res?.error || 'Gagal menyimpan budget efektif');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyimpan konfigurasi budget');
    } finally {
      setSavingBudget(false);
    }
  };

  const handleSyncToPayroll = async () => {
    const [yStr, mStr] = payrollMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    if (!year || !month) return;

    setSyncingPayroll(true);
    try {
      const periodRes: any = await api.post('/payroll/periods', { month, year });
      if (!periodRes?.success || !periodRes.data?.id) {
        throw new Error(periodRes?.error || 'Gagal menyiapkan periode payroll di database');
      }
      const periodId = periodRes.data.id;
      const genRes: any = await api.post(`/payroll/periods/${periodId}/generate`, { month, year });
      if (!genRes?.success) {
        throw new Error(genRes?.error || 'Gagal menyinkronkan lembur ke slip payroll');
      }
      toast.success(
        genRes.message ||
          `Lembur ${formatYmLabel(recap?.sourceOvertimeMonth || '')} berhasil masuk ke Payroll ${formatYmLabel(payrollMonth)}`
      );
      await fetchArrearsRecap(payrollMonth);
      if (typeof onSynced === 'function') onSynced();
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyinkronkan ke Payroll');
    } finally {
      setSyncingPayroll(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!recap) return [];
    const q = searchQuery.trim().toLowerCase();
    return recap.employees.filter((e) => {
      if (groupFilter !== 'ALL' && e.group !== groupFilter) return false;
      if (onlyWithOvertime && e.spklApprovedCount === 0 && e.spklPendingCount === 0) return false;
      if (q) {
        const hit =
          e.fullName.toLowerCase().includes(q) ||
          e.nip.toLowerCase().includes(q) ||
          e.divisionName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [recap, groupFilter, onlyWithOvertime, searchQuery]);

  const getSyncBadge = (state: ArrearsEmployeeRow['syncState']) => {
    switch (state) {
      case 'paid':
        return <Badge className="bg-emerald-600 text-white text-[10px]">Dibayar (Paid)</Badge>;
      case 'included_in_payroll':
        return <Badge className="bg-blue-600 text-white text-[10px]">Masuk Slip Payroll</Badge>;
      case 'ready_for_payroll':
        return <Badge className="bg-amber-500 text-white text-[10px]">Siap Masuk Payroll</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] text-muted-foreground">Nihil Lembur</Badge>;
    }
  };

  const handleExportExcel = () => {
    if (!recap) return;
    try {
      const wb = XLSX.utils.book_new();
      const periodText = `${formatYmLabel(recap.sourceOvertimeMonth)} -> Payroll ${formatYmLabel(recap.payrollMonth)}`;

      const sumSheet = XLSX.utils.aoa_to_sheet([
        ['LAPORAN REKAPITULASI LEMBUR & SINKRONISASI PAYROLL BULAN MUNDUR (N-1)'],
        ['Perusahaan', 'PT. FAWWAZ RESKI PERWIRA'],
        ['Bulan Kerja Lembur (N-1)', formatYmLabel(recap.sourceOvertimeMonth)],
        ['Bulan Pembayaran Payroll (N)', formatYmLabel(recap.payrollMonth)],
        ['Status Periode Payroll', recap.linkedPeriod?.status?.toUpperCase() || 'BELUM DIGENERATE'],
        [],
        ['KELOMPOK', 'PERSONIL', 'ADA LEMBUR', 'JAM REAL', 'JAM BAYAR (x2)', 'FLEXYTIME (JAM)', 'TOTAL BAYAR (RP)', 'PLAFON (RP)', 'SISA PLAFON (RP)'],
        [
          'Rumah Tangga (FR07001-033)',
          recap.totals.rumahTangga.employeeCount,
          recap.totals.rumahTangga.withOvertimeCount,
          recap.totals.rumahTangga.totalRawHours,
          recap.totals.rumahTangga.totalPaidHours,
          recap.totals.rumahTangga.totalFlexytimeHours,
          recap.totals.rumahTangga.totalPay,
          recap.totals.rumahTangga.budgetCap,
          recap.totals.rumahTangga.budgetRemaining,
        ],
        [
          'Shipment (FR07034-080)',
          recap.totals.shipment.employeeCount,
          recap.totals.shipment.withOvertimeCount,
          recap.totals.shipment.totalRawHours,
          recap.totals.shipment.totalPaidHours,
          recap.totals.shipment.totalFlexytimeHours,
          recap.totals.shipment.totalPay,
          recap.totals.shipment.budgetCap,
          recap.totals.shipment.budgetRemaining,
        ],
        [
          'Karyawan Tetap (Aslam, Samsi, Takdir)',
          recap.totals.karyawanTetap.employeeCount,
          recap.totals.karyawanTetap.withOvertimeCount,
          recap.totals.karyawanTetap.totalRawHours,
          recap.totals.karyawanTetap.totalPaidHours,
          recap.totals.karyawanTetap.totalFlexytimeHours,
          recap.totals.karyawanTetap.totalPay,
          0,
          0,
        ],
        [],
        [
          'GRAND TOTAL UPAH LEMBUR',
          '',
          '',
          recap.totals.grandTotalHours,
          '',
          '',
          recap.totals.grandTotalPay,
          recap.budgetMeta?.totalCap ?? 76000000,
          Math.max(0, (recap.budgetMeta?.totalCap ?? 76000000) - recap.totals.grandTotalPay),
        ],
      ]);
      XLSX.utils.book_append_sheet(wb, sumSheet, 'Ringkasan N-1 Pimpinan');

      const buildDetailSheet = (grp: 'RUMAH TANGGA' | 'SHIPMENT' | 'KARYAWAN TETAP', tabName: string) => {
        const list = recap.employees.filter((e) => e.group === grp);
        const aoa: any[][] = [
          [`RINCIAN LEMBUR ${grp} — ${periodText}`],
          [],
          ['NO', 'NIP', 'NAMA', 'DIVISI', 'POLA SHIFT', 'GAJI POKOK', 'TARIF/JAM', 'SPKL SAH', 'JAM REAL', 'JAM CAPPED', 'JAM BAYAR (x2)', 'FLEXYTIME (JAM)', 'UPAH LEMBUR (RP)', 'STATUS PAYROLL'],
        ];
        list.forEach((e, i) => {
          aoa.push([
            i + 1,
            e.nip,
            e.fullName,
            e.divisionName,
            e.isDayShift ? 'Day Shift (Cap 56j)' : 'Shift Normal (Cap 30j)',
            e.baseSalary,
            e.hourlyRate,
            e.spklApprovedCount,
            e.rawApprovedHours,
            e.cappedRealHours,
            e.paidHours,
            e.flexytimeHours,
            e.calculatedPay,
            e.syncState,
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 5 }, { wch: 13 }, { wch: 26 }, { wch: 22 }, { wch: 20 }, { wch: 13 }, { wch: 12 }, { wch: 9 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, tabName);
      };

      buildDetailSheet('RUMAH TANGGA', 'Rumah Tangga (33)');
      buildDetailSheet('SHIPMENT', 'Shipment (47)');
      buildDetailSheet('KARYAWAN TETAP', 'Karyawan Tetap (3)');

      XLSX.writeFile(wb, `REKAP_LEMBUR_PAYROLL_${recap.sourceOvertimeMonth}_KE_${recap.payrollMonth}.xlsx`);
      toast.success('Laporan Excel Lembur & Payroll N-1 berhasil diunduh.');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor Excel');
    }
  };

  const handleExportPDF = () => {
    if (!recap) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const runAutoTable =
        (typeof autoTable === 'function' ? autoTable : (autoTable as any)?.default) || (doc as any).autoTable;

      doc.setFontSize(13);
      doc.text('PT. FAWWAZ RESKI PERWIRA — REKAP LEMBUR BULAN MUNDUR (N-1) KE PAYROLL', 14, 14);
      doc.setFontSize(9.5);
      doc.text(
        `Kerja Lembur: ${formatYmLabel(recap.sourceOvertimeMonth)}  -->  Dibayarkan di Payroll: ${formatYmLabel(recap.payrollMonth)}`,
        14,
        20
      );
      const shipCapLabel = Math.round((recap.budgetMeta?.shipmentCap ?? 72000000) / 1000000);
      const wismaCapLabel = Math.round((recap.budgetMeta?.wismaCap ?? 4000000) / 1000000);
      doc.text(
        `Total Pengeluaran Lembur: Rp ${recap.totals.grandTotalPay.toLocaleString('id-ID')} | Shipment: Rp ${recap.totals.shipment.totalPay.toLocaleString('id-ID')} / Rp ${shipCapLabel}jt | Wisma RT: Rp ${recap.totals.rumahTangga.totalPay.toLocaleString('id-ID')} / Rp ${wismaCapLabel}jt`,
        14,
        25
      );

      const activeList = filteredEmployees.length > 0 ? filteredEmployees : recap.employees;
      const body = activeList
        .filter((e) => e.spklApprovedCount > 0 || e.group === 'KARYAWAN TETAP' || !onlyWithOvertime)
        .map((e, idx) => [
          String(idx + 1),
          e.nip,
          e.fullName,
          e.group,
          `${e.spklApprovedCount} SPKL`,
          `${e.rawApprovedHours} j`,
          `${e.paidHours} j`,
          e.flexytimeHours > 0 ? `${e.flexytimeHours} j` : '-',
          `Rp ${e.calculatedPay.toLocaleString('id-ID')}`,
          e.syncState.replace(/_/g, ' ').toUpperCase(),
        ]);

      runAutoTable(doc, {
        startY: 29,
        head: [['NO', 'NIP', 'NAMA', 'KELOMPOK', 'SPKL', 'JAM REAL', 'JAM BAYAR (x2)', 'FLEXYTIME', 'NOMINAL PAYROLL', 'STATUS SYNC']],
        body,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      });

      doc.save(`LAPORAN_LEMBUR_N1_${recap.sourceOvertimeMonth}_PAYROLL_${recap.payrollMonth}.pdf`);
      toast.success('Laporan PDF Pimpinan berhasil diunduh.');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor PDF');
    }
  };

  return (
    <div className="space-y-5">
      {/* Control & Arrears Period Selector Banner */}
      <Card className="border-blue-500/30 bg-gradient-to-br from-card via-card to-blue-500/5 rounded-2xl shadow-xs">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Wallet className="w-4 h-4 text-blue-600" />
                Sinkronisasi Lembur &amp; Payroll Sistem Bulan Mundur (Arrears N-1)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Lembur bulan kerja sebelumnya (<strong>N-1</strong>) otomatis dihitung, diawasi plafonnya (Rp 72jt + Rp 4jt), lalu disinkronkan ke slip gaji bulan berjalan (<strong>N</strong>).
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchArrearsRecap(payrollMonth)}
                disabled={loading}
                className="h-8 text-xs rounded-xl gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Muat Ulang
              </Button>
              <Button
                size="sm"
                onClick={handleExportExcel}
                disabled={!recap}
                className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel Pimpinan (4 Sheet)
              </Button>
              <Button
                size="sm"
                onClick={handleExportPDF}
                disabled={!recap}
                className="h-8 text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF Pimpinan
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Flow Visual N-1 -> N + Quick Month Switch */}
          <div className="p-4 rounded-xl bg-slate-950 text-white border border-blue-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30">
                <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Sumber Kerja Lembur (N-1)</p>
                <p className="text-sm font-bold flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {formatYmLabel(recap?.sourceOvertimeMonth || '') || '...'}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-400 hidden sm:block" />
              <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/40">
                <p className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold">Masuk Payroll Bulan (N)</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-300" />
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => e.target.value && setPayrollMonth(e.target.value)}
                    className="bg-transparent text-sm font-bold text-white border-b border-blue-400/50 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 ml-1">
                <Button
                  type="button"
                  size="sm"
                  variant={payrollMonth === curYm ? 'default' : 'secondary'}
                  onClick={() => setPayrollMonth(curYm)}
                  className="h-7 text-[11px] rounded-lg"
                >
                  Payroll {formatYmLabel(curYm)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={payrollMonth === nextYm ? 'default' : 'secondary'}
                  onClick={() => setPayrollMonth(nextYm)}
                  className="h-7 text-[11px] rounded-lg"
                >
                  Payroll {formatYmLabel(nextYm)} (Lembur {formatYmLabel(curYm)})
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-left sm:text-right">
                <p className="text-[11px] text-slate-300">Total Lembur Siap Payroll:</p>
                <p className="text-xl font-extrabold font-mono text-emerald-400">
                  Rp {(recap?.totals.grandTotalPay || 0).toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] text-slate-400">
                  Status DB: <strong className="text-white uppercase">{recap?.linkedPeriod?.status || 'BELUM DIGENERATE'}</strong>
                </p>
              </div>

              <Button
                type="button"
                onClick={handleSyncToPayroll}
                disabled={syncingPayroll || loading}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 shadow-md"
              >
                <Send className="w-4 h-4" />
                {syncingPayroll ? 'Menyinkronkan ke PostgreSQL...' : `Sinkronkan ke Payroll ${formatYmLabel(payrollMonth)}`}
              </Button>
            </div>
          </div>

          {/* Dynamic Effective Monthly Budget Strip */}
          {recap?.budgetMeta && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Budget Efektif Lembur ({formatYmLabel(recap.sourceOvertimeMonth)} &rarr; Payroll {formatYmLabel(recap.payrollMonth)})
                  </span>
                  {recap.budgetMeta.isEffectiveOverride ? (
                    <Badge className="bg-amber-600 text-white text-[10px]">
                      Override Efektif Aktif: Total Rp {recap.budgetMeta.totalCap.toLocaleString('id-ID')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Plafon SK Baku: Total Rp {recap.budgetMeta.totalCap.toLocaleString('id-ID')}
                    </Badge>
                  )}
                  {recap.budgetMeta.isShipmentProrated && (
                    <Badge variant="destructive" className="text-[10px]">
                      Pro-Rata Otomatis ke Budget Efektif ({Math.round(recap.budgetMeta.shipmentScaleFactor * 100)}%)
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Shipment Efektif: <strong>Rp {recap.budgetMeta.shipmentCap.toLocaleString('id-ID')}</strong> + Rumah Tangga/Wisma: <strong>Rp {recap.budgetMeta.wismaCap.toLocaleString('id-ID')}</strong> = <strong>Rp {recap.budgetMeta.totalCap.toLocaleString('id-ID')}</strong> (Plafon SK penuh: Rp 72jt + Rp 4jt = Rp 76jt).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Shipment (Rp):</span>
                  <Input
                    type="number"
                    min={0}
                    step={500000}
                    value={editShipmentBudget}
                    onChange={(e) => setEditShipmentBudget(e.target.value)}
                    className="h-8 w-32 text-xs font-mono rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Wisma (Rp):</span>
                  <Input
                    type="number"
                    min={0}
                    step={500000}
                    value={editWismaBudget}
                    onChange={(e) => setEditWismaBudget(e.target.value)}
                    className="h-8 w-28 text-xs font-mono rounded-lg"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveEffectiveBudget}
                  disabled={savingBudget}
                  className="h-8 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  {savingBudget ? 'Menyimpan...' : 'Simpan Budget'}
                </Button>
              </div>
            </div>
          )}

          {/* 3-Group Summary Cards */}
          {recap && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  key: 'RUMAH TANGGA' as const,
                  title: '🏠 Rumah Tangga (FR07001–033)',
                  sub: `Budget Efektif Rp ${(recap.budgetMeta?.wismaCap ?? 4000000).toLocaleString('id-ID')} dibagi rata (maks Rp ${(recap.budgetMeta?.perWismaPersonCap ?? 121212).toLocaleString('id-ID')}/org) + Flexytime`,
                  data: recap.totals.rumahTangga,
                  badge: 'bg-teal-600 text-white',
                },
                {
                  key: 'SHIPMENT' as const,
                  title: '🚢 Shipment (FR07034–080)',
                  sub: `Budget Efektif Rp ${(recap.budgetMeta?.shipmentCap ?? 72000000).toLocaleString('id-ID')} (44 Shift Normal 30j x2 + 3 Day Shift 56j x2)`,
                  data: recap.totals.shipment,
                  badge: 'bg-blue-600 text-white',
                },
                {
                  key: 'KARYAWAN TETAP' as const,
                  title: '⭐ Karyawan Tetap (Aslam, Samsi, Takdir)',
                  sub: 'Pengawasan langsung Pimpinan & Direktur Utama',
                  data: recap.totals.karyawanTetap,
                  badge: 'bg-purple-600 text-white',
                },
              ].map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setGroupFilter(groupFilter === card.key ? 'ALL' : card.key)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    groupFilter === card.key
                      ? 'border-blue-600 bg-blue-500/10 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{card.title}</span>
                    <Badge className={`text-[10px] ${card.badge}`}>
                      {card.data.withOvertimeCount}/{card.data.employeeCount} Org Lembur
                    </Badge>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-1">{card.sub}</p>
                  <div className="mt-2.5 flex items-baseline justify-between font-mono">
                    <span className="text-base font-extrabold text-foreground">
                      Rp {card.data.totalPay.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {card.data.totalRawHours}j real • {card.data.totalPaidHours}j bayar
                    </span>
                  </div>
                  {card.data.budgetCap > 0 && (
                    <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      Sisa Plafon: Rp {card.data.budgetRemaining.toLocaleString('id-ID')}
                      {card.data.totalFlexytimeHours > 0 ? ` • Flexytime: ${card.data.totalFlexytimeHours}j` : ''}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Cari NIP, nama, atau divisi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant={onlyWithOvertime ? 'default' : 'outline'}
                onClick={() => setOnlyWithOvertime((v) => !v)}
                className="h-9 text-xs rounded-xl gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {onlyWithOvertime ? 'Hanya Yang Lembur' : 'Semua Personil'}
              </Button>
              {groupFilter !== 'ALL' && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setGroupFilter('ALL')}
                  className="h-9 text-xs rounded-xl"
                >
                  Reset Kelompok
                </Button>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Menampilkan <strong>{filteredEmployees.length}</strong> personil untuk sumber bulan <strong>{recap?.sourceOvertimeMonth}</strong>
            </span>
          </div>

          {/* Employee Payroll Arrears Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-[10.5px] uppercase text-muted-foreground font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Karyawan</th>
                    <th className="py-2.5 px-3">Kelompok &amp; Pola</th>
                    <th className="py-2.5 px-3 text-center">SPKL ({recap?.sourceOvertimeMonth})</th>
                    <th className="py-2.5 px-3 text-center">Jam Real</th>
                    <th className="py-2.5 px-3 text-center">Jam Bayar (x2)</th>
                    <th className="py-2.5 px-3 text-center">Flexytime</th>
                    <th className="py-2.5 px-3 text-right">Masuk Payroll {formatYmLabel(payrollMonth)}</th>
                    <th className="py-2.5 px-3 text-center">Status Sinkron</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && !recap ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-muted-foreground">
                        Menghitung kalkulasi lembur bulan mundur (N-1) dari PostgreSQL...
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-muted-foreground">
                        Tidak ada data karyawan sesuai filter pada periode kerja ini.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.userId} className="hover:bg-muted/25 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground">{emp.fullName}</div>
                          <div className="text-[10.5px] font-mono text-muted-foreground">
                            {emp.nip} • {emp.divisionName}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {emp.group}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {emp.group === 'RUMAH TANGGA'
                              ? 'Cap Rp 121.212 + Flexytime'
                              : emp.isDayShift
                              ? 'Day Shift (Maks 56j)'
                              : 'Shift Normal (Maks 30j)'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="font-bold text-foreground">{emp.spklApprovedCount} Sah</span>
                          {emp.spklPendingCount > 0 && (
                            <span className="block text-[10px] text-amber-600">{emp.spklPendingCount} pending</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {emp.rawApprovedHours > 0 ? `${emp.rawApprovedHours} j` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-blue-600">
                          {emp.paidHours > 0 ? `${emp.paidHours} j` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {emp.flexytimeHours > 0 ? (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px]">
                              {emp.flexytimeHours} Jam Libur
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {emp.calculatedPay > 0 ? `Rp ${emp.calculatedPay.toLocaleString('id-ID')}` : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-center">{getSyncBadge(emp.syncState)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

