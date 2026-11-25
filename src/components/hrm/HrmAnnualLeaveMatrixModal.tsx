import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Users,
  CalendarDays,
  DatabaseZap,
  Zap,
  Printer,
  X,
  Sparkles,
  ShieldCheck,
  Check,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface LeaveMonthBreakdown {
  baseline: number;
  approvedReq: number;
  pendingReq: number;
  manualAdj: number;
  total: number;
}

export interface LeaveExecutiveRecapRow {
  no: number;
  userId: string;
  nip: string;
  fullName: string;
  divisionName: string;
  roleName: string;
  group: 'RUMAH TANGGA' | 'SHIPMENT' | 'KARYAWAN TETAP';
  quota: number;
  months: Record<string, number>;
  pendingMonths: Record<string, number>;
  monthBreakdown?: Record<string, LeaveMonthBreakdown>;
  manualAdjustment: number;
  otherManualAdjustment?: number;
  approvedUsedDays: number;
  pendingDays: number;
  usedLeaveDays: number;
  remainingLeaveDays: number;
  novemberOvertimeHours?: number;
  novemberOvertimeCount?: number;
  hasNovemberOvertime?: boolean;
}

export interface LeaveGroupSection {
  title: string;
  periodLabel: string;
  defaultQuota: number;
  monthKeys: string[];
  rows: LeaveExecutiveRecapRow[];
  summary: {
    totalEmployees: number;
    totalQuota: number;
    totalUsed: number;
    totalPending: number;
    totalRemaining: number;
    exhaustedCount: number;
    totalNovemberOvertimeHours?: number;
    totalEmployeesWithNovemberOvertime?: number;
    monthlyTotals: Record<string, number>;
  };
}

export interface ExecutiveLeaveRecapResponse {
  generatedAt: string;
  rumahTangga: LeaveGroupSection;
  shipment: LeaveGroupSection;
  karyawanTetap: LeaveGroupSection;
}

const MONTH_SHORT_ID: Record<string, string> = {
  '01': 'JAN',
  '02': 'FEB',
  '03': 'MAR',
  '04': 'APR',
  '05': 'MEI',
  '06': 'JUN',
  '07': 'JUL',
  '08': 'AGU',
  '09': 'SEP',
  '10': 'OKT',
  '11': 'NOV',
  '12': 'DES',
};

const formatMonthCol = (mk: string) => {
  const [, m] = mk.split('-');
  return MONTH_SHORT_ID[m] || m;
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialGroup?: 'rumahTangga' | 'shipment' | 'karyawanTetap';
  onDataChanged?: () => void;
}

export const HrmAnnualLeaveMatrixModal: React.FC<Props> = ({
  open,
  onClose,
  initialGroup = 'rumahTangga',
  onDataChanged,
}) => {
  const [recap, setRecap] = useState<ExecutiveLeaveRecapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeGroup, setActiveGroup] = useState<'rumahTangga' | 'shipment' | 'karyawanTetap'>(initialGroup);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline Cell Editing State
  const [editingCell, setEditingCell] = useState<{
    userId: string;
    monthKey: string;
    originalValue: number;
    currentValue: string;
  } | null>(null);
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [lastSavedCellKey, setLastSavedCellKey] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchRecap();
    }
  }, [open]);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const fetchRecap = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/leaves/executive-recap');
      if (res?.success && res.data) {
        setRecap(res.data);
      } else {
        toast.error(res?.error || 'Gagal memuat rekap cuti pimpinan');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghubungi server untuk rekap cuti');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBaseline = async () => {
    setSyncing(true);
    try {
      const res: any = await api.post('/leaves/sync-baselines', {});
      if (res?.success) {
        toast.success(res.message || 'Baseline rekap cuti resmi berhasil disinkronkan ke database');
        await fetchRecap();
        if (typeof onDataChanged === 'function') onDataChanged();
      } else {
        toast.error(res?.error || 'Gagal menyinkronkan baseline cuti');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Terjadi kesalahan saat sinkronisasi baseline');
    } finally {
      setSyncing(false);
    }
  };

  const handleStartEditCell = (userId: string, monthKey: string, currentValue: number) => {
    setEditingCell({
      userId,
      monthKey,
      originalValue: currentValue,
      currentValue: String(currentValue),
    });
  };

  const handleCommitCellEdit = async () => {
    if (!editingCell) return;
    const { userId, monthKey, originalValue, currentValue } = editingCell;
    const num = parseInt(currentValue.trim(), 10);
    const cleanNum = isNaN(num) || num < 0 ? 0 : Math.min(31, num);

    setEditingCell(null);

    if (cleanNum === originalValue) {
      return;
    }

    const cellKey = `${userId}-${monthKey}`;
    setSavingCellKey(cellKey);

    // Optimistic UI update
    if (recap) {
      const updatedRecap = { ...recap };
      const groupData = updatedRecap[activeGroup];
      const targetRow = groupData.rows.find((r) => r.userId === userId);
      if (targetRow) {
        const delta = cleanNum - originalValue;
        targetRow.months[monthKey] = cleanNum;
        targetRow.usedLeaveDays = Math.max(0, targetRow.usedLeaveDays + delta);
        targetRow.remainingLeaveDays = Math.max(0, targetRow.quota - targetRow.usedLeaveDays);
        setRecap(updatedRecap);
      }
    }

    try {
      const res: any = await api.post('/leaves/monthly-cell-save', {
        userId,
        monthKey,
        days: cleanNum,
        reason: `Input manual Form Rekap Cuti (${formatMonthCol(monthKey)})`,
        operatorName: 'Super Administrator',
      });

      if (res?.success) {
        setLastSavedCellKey(cellKey);
        setTimeout(() => setLastSavedCellKey(null), 2500);
        toast.success(`Cuti ${monthKey} berhasil disimpan (${cleanNum} Hari) & sinkron ke PWA!`);
        if (typeof onDataChanged === 'function') onDataChanged();
      } else {
        toast.error(res?.error || 'Gagal menyimpan perubahan cuti');
        await fetchRecap();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Koneksi gagal saat menyimpan cuti');
      await fetchRecap();
    } finally {
      setSavingCellKey(null);
    }
  };

  const currentSection = recap ? recap[activeGroup] : null;

  const filteredRows = useMemo(() => {
    if (!currentSection) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentSection.rows;
    return currentSection.rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.nip.toLowerCase().includes(q) ||
        r.divisionName.toLowerCase().includes(q)
    );
  }, [currentSection, searchQuery]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!recap) return;
    try {
      const wb = XLSX.utils.book_new();

      const buildGroupSheet = (sec: LeaveGroupSection, sheetName: string) => {
        const headers = [
          'NO',
          'NO ID',
          'NAMA KARYAWAN',
          'HAK CUTI',
          ...sec.monthKeys.map(formatMonthCol),
          'SISA HAK CUTI',
          'LEMBUR NOV (JAM)',
          'SESI LEMBUR NOV',
        ];

        const aoa: any[][] = [
          [sec.title],
          [`Periode: ${sec.periodLabel} | Kebijakan: Use-It-Or-Lose-It (Sisa Cuti Hangus & Tidak Diuangkan)`],
          [],
          headers,
        ];

        sec.rows.forEach((r) => {
          aoa.push([
            r.no,
            r.nip,
            r.fullName,
            r.quota,
            ...sec.monthKeys.map((mk) => r.months[mk] || 0),
            r.remainingLeaveDays,
            r.novemberOvertimeHours || 0,
            r.novemberOvertimeCount || 0,
          ]);
        });

        // Baris Total
        aoa.push([
          '',
          'TOTAL',
          `${sec.summary.totalEmployees} Personil`,
          sec.summary.totalQuota,
          ...sec.monthKeys.map((mk) => sec.summary.monthlyTotals[mk] || 0),
          sec.summary.totalRemaining,
          sec.summary.totalNovemberOvertimeHours || 0,
          sec.summary.totalEmployeesWithNovemberOvertime || 0,
        ]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [
          { wch: 5 },
          { wch: 14 },
          { wch: 28 },
          { wch: 10 },
          ...sec.monthKeys.map(() => ({ wch: 8 })),
          { wch: 14 },
          { wch: 18 },
          { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      };

      buildGroupSheet(recap.rumahTangga, 'Rumah Tangga & Wisma (33)');
      buildGroupSheet(recap.shipment, 'Shipment (47)');
      buildGroupSheet(recap.karyawanTetap, 'Karyawan Tetap (3)');

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `REKAP_CUTI_DAN_LEMBUR_PT_FRP_${stamp}.xlsx`);
      toast.success('File Excel Form Rekap Cuti & Lembur berhasil diunduh.');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor file Excel');
    }
  };

  // Export to PDF Landscape
  const handleExportPDF = () => {
    if (!recap) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const runAutoTable =
        (typeof autoTable === 'function' ? autoTable : (autoTable as any)?.default) || (doc as any).autoTable;

      const renderGroupPDF = (sec: LeaveGroupSection, isFirstPage: boolean) => {
        if (!isFirstPage) doc.addPage();
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(`PT. FAWWAZ RESKI PERWIRA — ${sec.title}`, 14, 13);
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `Periode: ${sec.periodLabel} • Dicetak: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA • Kebijakan: Use-It-Or-Lose-It (Tanpa Kompensasi Kas)`,
          14,
          18
        );

        const head = [
          'NO',
          'NO ID',
          'NAMA',
          'HAK',
          ...sec.monthKeys.map((mk) => formatMonthCol(mk)),
          'SISA',
          'LMBR NOV',
        ];

        const body = sec.rows.map((r) => [
          String(r.no),
          r.nip,
          r.fullName,
          String(r.quota),
          ...sec.monthKeys.map((mk) => (r.months[mk] ? String(r.months[mk]) : '0')),
          r.remainingLeaveDays === 0 ? '0 (HBS)' : String(r.remainingLeaveDays),
          r.novemberOvertimeHours ? `${r.novemberOvertimeHours} Jam` : '-',
        ]);

        runAutoTable(doc, {
          startY: 22,
          head: [head],
          body,
          theme: 'grid',
          styles: { fontSize: 7.2, cellPadding: 1.2 },
          headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { cellWidth: 22 },
            2: { cellWidth: 44 },
            3: { halign: 'center', cellWidth: 10 },
          },
        });
      };

      renderGroupPDF(recap.rumahTangga, true);
      renderGroupPDF(recap.shipment, false);
      renderGroupPDF(recap.karyawanTetap, false);

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`FORM_REKAP_CUTI_LEMBUR_PT_FRP_${stamp}.pdf`);
      toast.success('File PDF Resmi Form Rekap Cuti berhasil diunduh.');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor file PDF');
    }
  };

  // Month year subheader calculations for 2026 and 2027
  const yearGroups = useMemo(() => {
    if (!currentSection) return [];
    const g2026 = currentSection.monthKeys.filter((m) => m.startsWith('2026'));
    const g2027 = currentSection.monthKeys.filter((m) => m.startsWith('2027'));
    return [
      { year: '2026', count: g2026.length, months: g2026 },
      { year: '2027', count: g2027.length, months: g2027 },
    ].filter((g) => g.count > 0);
  }, [currentSection]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[97vw] w-[97vw] max-h-[94vh] h-[94vh] flex flex-col p-0 gap-0 border-emerald-500/30 bg-card rounded-2xl overflow-hidden shadow-2xl">
        {/* ─── MODAL HEADER ─── */}
        <DialogHeader className="p-4 sm:px-6 sm:py-3.5 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex-shrink-0 border-b border-emerald-600/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-200" />
                <DialogTitle className="text-base sm:text-lg font-extrabold tracking-wide text-white uppercase">
                  {currentSection?.title || 'REKAP CUTI RUMAH TANGGA DAN WISMA TAHUN KE 2'}
                </DialogTitle>
                <Badge className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 text-[10px] font-semibold">
                  Tahun Ke-2 (2026–2027)
                </Badge>
              </div>
              <DialogDescription className="text-xs text-emerald-100/90 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Form Input Resmi PT. FAWWAZ RESKI PERWIRA</span>
                <span>•</span>
                <span className="font-semibold text-emerald-100">Klik angka sel untuk edit langsung &amp; auto-hitung sisa</span>
                <span>•</span>
                <span className="text-amber-200 font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Update Lembur Nov 2026 Real-Time &amp; Sinkron PWA Karyawan
                </span>
              </DialogDescription>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncBaseline}
                disabled={syncing || loading}
                className="h-8 text-xs rounded-xl gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold"
                title="Sinkronkan ulang baseline resmi dari dokumen Excel Pimpinan"
              >
                <DatabaseZap className={`w-3.5 h-3.5 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Menyinkronkan...' : 'Baseline Resmi'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchRecap}
                disabled={loading}
                className="h-8 text-xs rounded-xl gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                title="Muat ulang data terkini dari PostgreSQL"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Sinkron Realtime
              </Button>

              <Button
                size="sm"
                onClick={handleExportExcel}
                disabled={!recap}
                className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Unduh Excel (.xlsx)
              </Button>

              <Button
                size="sm"
                onClick={handleExportPDF}
                disabled={!recap}
                className="h-8 text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Cetak / PDF
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-xl text-white hover:bg-white/20 ml-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ─── GROUP SELECTOR & SEARCH BAR ─── */}
        <div className="p-3 sm:px-6 bg-muted/40 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
          {/* Tabs Kelompok */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                key: 'rumahTangga' as const,
                label: '🏠 Rumah Tangga & Wisma (33 Org)',
                badge: 'Tahun Ke-2 (12 Bulan)',
                count: recap?.rumahTangga.summary.totalEmployees ?? 33,
                activeClass: 'bg-emerald-600 text-white font-bold shadow-xs',
              },
              {
                key: 'shipment' as const,
                label: '🚢 Shipment (47 Org) - Segera Hadir',
                badge: 'Addendum (9 Bulan)',
                count: recap?.shipment.summary.totalEmployees ?? 47,
                activeClass: 'bg-blue-600 text-white font-bold shadow-xs',
              },
              {
                key: 'karyawanTetap' as const,
                label: '⭐ Karyawan Tetap (3 Org)',
                badge: 'Khusus Pimpinan',
                count: recap?.karyawanTetap.summary.totalEmployees ?? 3,
                activeClass: 'bg-purple-600 text-white font-bold shadow-xs',
              },
            ].map((t) => {
              const isActive = activeGroup === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveGroup(t.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 transition-all border ${
                    isActive
                      ? t.activeClass
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/70'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {t.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input & Info Pill */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari NIP atau Nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl bg-card border-border"
              />
            </div>
            {currentSection && (
              <Badge variant="outline" className="text-[11px] font-mono h-8 px-2.5 rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">
                {filteredRows.length} Personil
              </Badge>
            )}
          </div>
        </div>

        {/* ─── SUMMARY KPI STRIP ─── */}
        {currentSection && (
          <div className="px-4 sm:px-6 py-2 bg-card border-b border-border/70 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs flex-shrink-0">
            <div className="p-2 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-muted-foreground">Hak Kuota:</span>
              <span className="font-bold font-mono text-foreground">{currentSection.summary.totalQuota} Hari</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <span className="text-amber-700 dark:text-amber-300 font-semibold">Total Cuti Terpakai:</span>
              <span className="font-bold font-mono text-amber-700 dark:text-amber-300">{currentSection.summary.totalUsed} Hari</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Sisa Hak Cuti:</span>
              <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">{currentSection.summary.totalRemaining} Hari</span>
            </div>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <span className="text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Lembur Nov Realtime:
              </span>
              <span className="font-bold font-mono text-blue-700 dark:text-blue-300">
                {currentSection.summary.totalNovemberOvertimeHours || 0} Jam
              </span>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
              <span className="text-purple-700 dark:text-purple-300 font-semibold">Karyawan Lembur Nov:</span>
              <span className="font-bold font-mono text-purple-700 dark:text-purple-300">
                {currentSection.summary.totalEmployeesWithNovemberOvertime || 0} Orang
              </span>
            </div>
          </div>
        )}

        {/* ─── INTERACTIVE MATRIX TABLE ─── */}
        <div className="flex-1 overflow-auto bg-card">
          <table className="w-full text-left text-xs border-collapse">
            {/* Top Multi-Level Header */}
            <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur text-[11px] text-foreground font-bold shadow-xs select-none">
              {/* Row 1: Grouped Headers */}
              <tr className="border-b border-border bg-muted">
                <th rowSpan={2} className="py-2 px-2 text-center border-r border-border w-10">NO</th>
                <th rowSpan={2} className="py-2 px-3 border-r border-border w-28 whitespace-nowrap">NO ID</th>
                <th rowSpan={2} className="py-2 px-3 border-r border-border min-w-[180px]">NAMA</th>
                <th rowSpan={2} className="py-2 px-2 text-center border-r border-border w-16">HAK CUTI</th>
                {yearGroups.map((yg) => (
                  <th
                    key={yg.year}
                    colSpan={yg.count}
                    className="py-1 px-2 text-center border-r border-border bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 font-black tracking-wider uppercase text-xs"
                  >
                    {yg.year}
                  </th>
                ))}
                <th rowSpan={2} className="py-2 px-3 text-center border-r border-border w-24 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                  SISA HAK CUTI
                </th>
                <th rowSpan={2} className="py-2 px-3 text-center w-36 bg-blue-500/10 text-blue-800 dark:text-blue-300">
                  UPDATE LEMBUR NOV (REALTIME)
                </th>
              </tr>

              {/* Row 2: Monthly Sub-headers */}
              <tr className="border-b-2 border-border bg-muted/80 text-[10.5px]">
                {(currentSection?.monthKeys || []).map((mk) => {
                  const isCurrentNov = mk === '2026-11';
                  return (
                    <th
                      key={mk}
                      className={`py-1.5 px-2 text-center border-r border-border w-11 font-mono ${
                        isCurrentNov
                          ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 font-extrabold ring-1 ring-amber-500/50'
                          : 'text-muted-foreground'
                      }`}
                      title={isCurrentNov ? 'Bulan Berjalan (November 2026)' : mk}
                    >
                      {formatMonthCol(mk)}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border font-mono text-xs">
              {loading && !recap ? (
                <tr>
                  <td colSpan={25} className="py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <p>Memuat Form Rekap Cuti &amp; Update Lembur Realtime...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={25} className="py-16 text-center text-muted-foreground">
                    Tidak ada personil yang sesuai dengan pencarian "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isExemptLeader = row.group === 'KARYAWAN TETAP';
                  return (
                    <tr
                      key={row.userId}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      {/* NO */}
                      <td className="py-1.5 px-2 text-center border-r border-border text-muted-foreground text-[11px]">
                        {row.no}
                      </td>

                      {/* NO ID / NIP */}
                      <td className="py-1.5 px-3 border-r border-border font-semibold text-foreground whitespace-nowrap">
                        {row.nip}
                      </td>

                      {/* NAMA KARYAWAN */}
                      <td className="py-1.5 px-3 border-r border-border font-sans font-semibold text-foreground whitespace-nowrap">
                        <div className="leading-tight">{row.fullName}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{row.divisionName}</div>
                      </td>

                      {/* HAK CUTI */}
                      <td className="py-1.5 px-2 text-center border-r border-border font-bold text-foreground bg-muted/10">
                        {row.quota}
                      </td>

                      {/* 12 MONTH COLUMNS (DIRECT INLINE EDITABLE CELLS) */}
                      {(currentSection?.monthKeys || []).map((mk) => {
                        const val = row.months[mk] || 0;
                        const isCurrentNov = mk === '2026-11';
                        const isEditingThisCell =
                          editingCell?.userId === row.userId && editingCell?.monthKey === mk;
                        const cellKey = `${row.userId}-${mk}`;
                        const isSavingThisCell = savingCellKey === cellKey;
                        const isJustSaved = lastSavedCellKey === cellKey;

                        return (
                          <td
                            key={mk}
                            onClick={() => !isEditingThisCell && handleStartEditCell(row.userId, mk, val)}
                            title={`Klik untuk edit cuti ${row.fullName} bulan ${formatMonthCol(mk)} (saat ini: ${val} hari)`}
                            className={`py-1 px-1.5 text-center border-r border-border cursor-pointer transition-all relative ${
                              isCurrentNov ? 'bg-amber-500/5' : ''
                            } ${
                              isJustSaved
                                ? 'bg-emerald-500/30 text-emerald-900 font-extrabold'
                                : isEditingThisCell
                                ? 'bg-emerald-500/20 ring-2 ring-emerald-500'
                                : 'hover:bg-emerald-500/15'
                            }`}
                          >
                            {isEditingThisCell ? (
                              <input
                                ref={editInputRef}
                                type="number"
                                min={0}
                                max={31}
                                value={editingCell.currentValue}
                                onChange={(e) =>
                                  setEditingCell({
                                    ...editingCell,
                                    currentValue: e.target.value,
                                  })
                                }
                                onBlur={handleCommitCellEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitCellEdit();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                className="w-9 h-6 text-center text-xs font-bold rounded bg-white text-slate-900 border border-emerald-600 focus:outline-hidden p-0 m-0 shadow-xs"
                              />
                            ) : isSavingThisCell ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto text-emerald-600" />
                            ) : (
                              <span
                                className={`inline-block min-w-[18px] text-center font-bold ${
                                  val > 0
                                    ? 'text-foreground'
                                    : 'text-muted-foreground/35 group-hover:text-foreground/70'
                                }`}
                              >
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* SISA HAK CUTI */}
                      <td className="py-1.5 px-3 text-center border-r border-border font-bold bg-emerald-500/10">
                        {row.remainingLeaveDays === 0 ? (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 font-bold">
                            0 (HABIS)
                          </Badge>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
                            {row.remainingLeaveDays}
                          </span>
                        )}
                      </td>

                      {/* UPDATE LEMBUR NOV 2026 (REALTIME) */}
                      <td className="py-1.5 px-3 text-center bg-blue-500/5">
                        {isExemptLeader ? (
                          <span className="text-muted-foreground/60 text-[10px] italic">Non-Lembur</span>
                        ) : row.hasNovemberOvertime && (row.novemberOvertimeHours ?? 0) > 0 ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-bold text-[11px]" title={`Tercatat ${row.novemberOvertimeCount || 0} SPKL disetujui di November 2026`}>
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{row.novemberOvertimeHours} Jam</span>
                            <span className="text-[9.5px] opacity-75">({row.novemberOvertimeCount}x)</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Totals */}
            {currentSection && filteredRows.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-muted/95 border-t-2 border-border font-mono font-bold text-xs text-foreground shadow-lg">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-muted-foreground border-r border-border">
                    Total ({currentSection.summary.totalEmployees} Personil)
                  </td>
                  <td className="py-2.5 px-2 text-center border-r border-border font-extrabold text-foreground">
                    {currentSection.summary.totalQuota}
                  </td>
                  {currentSection.monthKeys.map((mk) => (
                    <td key={mk} className="py-2.5 px-1.5 text-center border-r border-border text-foreground">
                      {currentSection.summary.monthlyTotals[mk] || 0}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center border-r border-border text-emerald-700 dark:text-emerald-300 font-extrabold text-sm bg-emerald-500/15">
                    {currentSection.summary.totalRemaining}
                  </td>
                  <td className="py-2.5 px-3 text-center text-blue-700 dark:text-blue-300 font-extrabold bg-blue-500/10">
                    {currentSection.summary.totalNovemberOvertimeHours || 0} Jam
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ─── MODAL FOOTER NOTE ─── */}
        <div className="p-3 sm:px-6 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Perubahan angka pada sel otomatis tersimpan ke PostgreSQL &amp; langsung menyinkronkan sisa kuota cuti di aplikasi mobile (PWA) karyawan secara seketika.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span>Sifat Cuti: <strong className="text-foreground">Use-It-Or-Lose-It (Tidak Diuangkan)</strong></span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
