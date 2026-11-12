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
  AlertTriangle,
  Users,
  CalendarDays,
  DatabaseZap,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HrmMonthlyLeaveRevisionModal } from '@/components/hrm/superadmin/HrmMonthlyLeaveRevisionModal';

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
  const [y, m] = mk.split('-');
  return `${MONTH_SHORT_ID[m] || m} '${(y || '').slice(2)}`;
};

interface Props {
  initialGroup?: 'rumahTangga' | 'shipment' | 'karyawanTetap';
  onSynced?: () => void;
}

export const HrmLeaveExecutiveRecapTab: React.FC<Props> = ({ initialGroup, onSynced }) => {
  const [recap, setRecap] = useState<ExecutiveLeaveRecapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeGroup, setActiveGroup] = useState<'rumahTangga' | 'shipment' | 'karyawanTetap'>(initialGroup || 'rumahTangga');
  const [searchQuery, setSearchQuery] = useState('');
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<LeaveExecutiveRecapRow | null>(null);
  const [editingMonthKey, setEditingMonthKey] = useState<string | null>(null);

  const openRevisionModal = (row: LeaveExecutiveRecapRow, monthKey?: string) => {
    setEditingRow(row);
    setEditingMonthKey(monthKey || null);
    setRevisionModalOpen(true);
  };

  useEffect(() => {
    if (initialGroup) {
      setActiveGroup(initialGroup);
    }
  }, [initialGroup]);

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

  useEffect(() => {
    fetchRecap();
    const handleLiveRefresh = () => {
      fetchRecap();
    };
    window.addEventListener('hrm_leaves_updated', handleLiveRefresh);
    window.addEventListener('hrm_users_updated', handleLiveRefresh);
    window.addEventListener('hrm_data_updated', handleLiveRefresh);
    return () => {
      window.removeEventListener('hrm_leaves_updated', handleLiveRefresh);
      window.removeEventListener('hrm_users_updated', handleLiveRefresh);
      window.removeEventListener('hrm_data_updated', handleLiveRefresh);
    };
  }, []);

  const handleSyncBaseline = async () => {
    setSyncing(true);
    try {
      const res: any = await api.post('/leaves/sync-baselines', {});
      if (res?.success) {
        toast.success(res.message || 'Baseline rekap cuti resmi berhasil disinkronkan ke database');
        await fetchRecap();
        if (typeof onSynced === 'function') onSynced();
      } else {
        toast.error(res?.error || 'Gagal menyinkronkan baseline cuti');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Terjadi kesalahan saat sinkronisasi');
    } finally {
      setSyncing(false);
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

  const handleExportExcel = () => {
    if (!recap) return;
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Ringkasan Eksekutif Pimpinan
      const summaryRows = [
        ['LAPORAN REKAPITULASI HAK & SISA CUTI KARYAWAN PT. FAWWAZ RESKI PERWIRA'],
        ['Dicetak pada', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) + ' WITA'],
        ['Kebijakan Perusahaan', 'Use-It-Or-Lose-It (Sisa cuti hangus akhir periode & tidak diuangkan; saldo langsung terpotong saat pengajuan)'],
        [],
        ['KELOMPOK PERSONIL', 'RENTANG PERIODE', 'PERSONIL', 'TOTAL HAK (HARI)', 'TERPAKAI + PENDING', 'PENDING', 'SISA KUOTA', 'KUOTA HABIS (0 HARI)'],
        [
          'Rumah Tangga & Wisma (FR07001-FR07033)',
          recap.rumahTangga.periodLabel,
          recap.rumahTangga.summary.totalEmployees,
          recap.rumahTangga.summary.totalQuota,
          recap.rumahTangga.summary.totalUsed,
          recap.rumahTangga.summary.totalPending,
          recap.rumahTangga.summary.totalRemaining,
          recap.rumahTangga.summary.exhaustedCount,
        ],
        [
          'Shipment (FR07034-FR07080)',
          recap.shipment.periodLabel,
          recap.shipment.summary.totalEmployees,
          recap.shipment.summary.totalQuota,
          recap.shipment.summary.totalUsed,
          recap.shipment.summary.totalPending,
          recap.shipment.summary.totalRemaining,
          recap.shipment.summary.exhaustedCount,
        ],
        [
          'Karyawan Tetap (Aslam, Samsi, Takdir)',
          recap.karyawanTetap.periodLabel,
          recap.karyawanTetap.summary.totalEmployees,
          recap.karyawanTetap.summary.totalQuota,
          recap.karyawanTetap.summary.totalUsed,
          recap.karyawanTetap.summary.totalPending,
          recap.karyawanTetap.summary.totalRemaining,
          recap.karyawanTetap.summary.exhaustedCount,
        ],
      ];
      const wsSum = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSum, 'Ringkasan Pimpinan');

      const buildGroupSheet = (sec: LeaveGroupSection, sheetName: string) => {
        const headers = [
          'NO',
          'NO ID / NIP',
          'NAMA KARYAWAN',
          'DIVISI',
          'HAK CUTI',
          ...sec.monthKeys.map(formatMonthCol),
          'TERPAKAI',
          'PENDING',
          'SISA HAK CUTI',
        ];
        const aoa: any[][] = [[sec.title], [`Periode: ${sec.periodLabel} | Default Hak Cuti: ${sec.defaultQuota} Hari`], [], headers];
        sec.rows.forEach((r) => {
          aoa.push([
            r.no,
            r.nip,
            r.fullName,
            r.divisionName,
            r.quota,
            ...sec.monthKeys.map((mk) => r.months[mk] || 0),
            r.usedLeaveDays,
            r.pendingDays,
            r.remainingLeaveDays,
          ]);
        });
        aoa.push([
          '',
          'TOTAL',
          `${sec.summary.totalEmployees} Personil`,
          '',
          sec.summary.totalQuota,
          ...sec.monthKeys.map((mk) => sec.summary.monthlyTotals[mk] || 0),
          sec.summary.totalUsed,
          sec.summary.totalPending,
          sec.summary.totalRemaining,
        ]);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 10 }, ...sec.monthKeys.map(() => ({ wch: 9 })), { wch: 10 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      };

      buildGroupSheet(recap.rumahTangga, 'Rumah Tangga (33)');
      buildGroupSheet(recap.shipment, 'Shipment (47)');
      buildGroupSheet(recap.karyawanTetap, 'Karyawan Tetap (3)');

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `REKAP_CUTI_PIMPINAN_PT_FRP_${stamp}.xlsx`);
      toast.success('Laporan Excel Multi-Sheet Pimpinan berhasil diunduh.');
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

      const renderGroupPDF = (sec: LeaveGroupSection, isFirstPage: boolean) => {
        if (!isFirstPage) doc.addPage();
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text('PT. FAWWAZ RESKI PERWIRA — LAPORAN REKAPITULASI CUTI PIMPINAN', 14, 14);
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`${sec.title} | Periode: ${sec.periodLabel}`, 14, 20);
        doc.text(
          `Personil: ${sec.summary.totalEmployees} | Total Hak: ${sec.summary.totalQuota} Hari | Terpakai/Reserved: ${sec.summary.totalUsed} Hari (Pending: ${sec.summary.totalPending}) | Sisa: ${sec.summary.totalRemaining} Hari | Habis: ${sec.summary.exhaustedCount} Org`,
          14,
          25
        );

        const head = [
          'NO',
          'NIP',
          'NAMA',
          'HAK',
          ...sec.monthKeys.map((mk) => MONTH_SHORT_ID[mk.split('-')[1]] || mk),
          'PAKAI',
          'SISA',
        ];
        const body = sec.rows.map((r) => [
          String(r.no),
          r.nip,
          r.fullName,
          String(r.quota),
          ...sec.monthKeys.map((mk) => (r.months[mk] ? String(r.months[mk]) : '-')),
          r.pendingDays > 0 ? `${r.usedLeaveDays} (${r.pendingDays}p)` : String(r.usedLeaveDays),
          r.remainingLeaveDays === 0 ? 'HABIS (0)' : String(r.remainingLeaveDays),
        ]);

        runAutoTable(doc, {
          startY: 29,
          head: [head],
          body,
          theme: 'grid',
          styles: { fontSize: 7.2, cellPadding: 1.4 },
          headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { cellWidth: 22 },
            2: { cellWidth: 42 },
            3: { halign: 'center', cellWidth: 10 },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === head.length - 1 && String(data.cell.raw).includes('HABIS')) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
      };

      renderGroupPDF(recap.rumahTangga, true);
      renderGroupPDF(recap.shipment, false);
      renderGroupPDF(recap.karyawanTetap, false);

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`LAPORAN_CUTI_PIMPINAN_PT_FRP_${stamp}.pdf`);
      toast.success('Laporan PDF Landscape Pimpinan berhasil diunduh.');
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengekspor PDF');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Control Bar */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5 shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                Rekapitulasi Kuota &amp; Laporan Cuti Pimpinan PT. FRP (3 Kelompok Resmi)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Auto-potong seketika saat karyawan mengajukan cuti (Web &amp; PWA), auto-refund jika ditolak, dan tersinkron dengan baseline historis Mar–Sep 2026.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncBaseline}
                disabled={syncing || loading}
                className="h-8 text-xs rounded-xl gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                <DatabaseZap className={`w-3.5 h-3.5 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Menyinkronkan...' : 'Sinkronkan Baseline Resmi'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRecap}
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
          {/* 3-Group Selector Pills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'rumahTangga' as const,
                label: '🏠 Rumah Tangga (FR07001–033)',
                sub: recap?.rumahTangga.periodLabel || 'Mar 2026 – Feb 2027 • Kuota 12 Hari',
                count: recap?.rumahTangga.summary.totalEmployees ?? 33,
                used: recap?.rumahTangga.summary.totalUsed ?? 0,
                rem: recap?.rumahTangga.summary.totalRemaining ?? 0,
                badgeCls: 'bg-teal-600 text-white',
                activeBorder: 'border-teal-600 bg-teal-500/10',
              },
              {
                key: 'shipment' as const,
                label: '🚢 Shipment (FR07034–080)',
                sub: recap?.shipment.periodLabel || 'Apr – Des 2026 • Kuota 9 Hari',
                count: recap?.shipment.summary.totalEmployees ?? 47,
                used: recap?.shipment.summary.totalUsed ?? 0,
                rem: recap?.shipment.summary.totalRemaining ?? 0,
                badgeCls: 'bg-blue-600 text-white',
                activeBorder: 'border-blue-600 bg-blue-500/10',
              },
              {
                key: 'karyawanTetap' as const,
                label: '⭐ Karyawan Tetap (Aslam, Samsi, Takdir)',
                sub: recap?.karyawanTetap.periodLabel || 'Pengawasan Khusus Pimpinan • Kuota 12 Hari',
                count: recap?.karyawanTetap.summary.totalEmployees ?? 3,
                used: recap?.karyawanTetap.summary.totalUsed ?? 0,
                rem: recap?.karyawanTetap.summary.totalRemaining ?? 0,
                badgeCls: 'bg-purple-600 text-white',
                activeBorder: 'border-purple-600 bg-purple-500/10',
              },
            ].map((g) => {
              const isActive = activeGroup === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveGroup(g.key)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isActive ? `${g.activeBorder} shadow-xs` : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{g.label}</span>
                    <Badge className={`text-[10px] ${g.badgeCls}`}>{g.count} Org</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{g.sub}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Terpakai: {g.used}h</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Sisa: {g.rem}h</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Group KPI Strip */}
          {currentSection && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> Personil Kelompok
                </p>
                <p className="text-lg font-bold text-foreground">{currentSection.summary.totalEmployees} Orang</p>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Total Hak Kuota</p>
                <p className="text-lg font-bold font-mono text-foreground">{currentSection.summary.totalQuota} Hari</p>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground">Sudah Diambil + Reserved</p>
                <p className="text-lg font-bold font-mono text-amber-600">
                  {currentSection.summary.totalUsed} Hari
                  {currentSection.summary.totalPending > 0 && (
                    <span className="text-[11px] ml-1 text-amber-500">({currentSection.summary.totalPending} pending)</span>
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sisa Kuota Aktif
                </p>
                <p className="text-lg font-bold font-mono text-emerald-600">{currentSection.summary.totalRemaining} Hari</p>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" /> Kuota Habis (0 Hari)
                </p>
                <p className="text-lg font-bold font-mono text-rose-600">{currentSection.summary.exhaustedCount} Personil</p>
              </div>
            </div>
          )}

          {/* Filter Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari NIP, nama karyawan, atau divisi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
            {currentSection && (
              <p className="text-[11px] text-muted-foreground">
                Menampilkan <strong>{filteredRows.length}</strong> dari {currentSection.rows.length} personil • Klik angka bulan atau tombol <strong>Edit</strong> untuk revisi cuti bulanan
              </p>
            )}
          </div>

          {/* Monthly Matrix Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-[10.5px] uppercase text-muted-foreground font-bold">
                  <tr>
                    <th className="py-2.5 px-3 text-center">No</th>
                    <th className="py-2.5 px-3">NIP</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Nama Karyawan</th>
                    <th className="py-2.5 px-2.5 text-center">Hak</th>
                    {(currentSection?.monthKeys || []).map((mk) => (
                      <th key={mk} className="py-2.5 px-2 text-center whitespace-nowrap">
                        {formatMonthCol(mk)}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center bg-amber-500/10 text-amber-700 dark:text-amber-300">Terpakai</th>
                    <th className="py-2.5 px-3 text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Sisa Hak</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && !recap ? (
                    <tr>
                      <td colSpan={19} className="py-10 text-center text-muted-foreground">
                        Memuat matriks cuti real-time dari database PostgreSQL...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="py-10 text-center text-muted-foreground">
                        Tidak ada data karyawan yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.userId} className="hover:bg-muted/25 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{row.no}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-foreground whitespace-nowrap">{row.nip}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-foreground leading-tight">{row.fullName}</div>
                          <div className="text-[10px] text-muted-foreground">{row.divisionName}</div>
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono font-semibold">{row.quota}</td>
                        {(currentSection?.monthKeys || []).map((mk) => {
                          const val = row.months[mk] || 0;
                          const pend = row.pendingMonths[mk] || 0;
                          const manualAdj = row.monthBreakdown?.[mk]?.manualAdj || 0;
                          const hasManualRev = manualAdj !== 0;
                          return (
                            <td
                              key={mk}
                              onClick={() => openRevisionModal(row, mk)}
                              title={`Klik untuk revisi cuti ${row.fullName} (${formatMonthCol(mk)})${hasManualRev ? ` • Revisi Admin: ${manualAdj > 0 ? `+${manualAdj}` : manualAdj}h` : ''}`}
                              className="py-2 px-2 text-center font-mono cursor-pointer hover:bg-emerald-500/15 transition-colors group"
                            >
                              {val > 0 ? (
                                <span
                                  className={`inline-flex items-center justify-center gap-0.5 min-w-[22px] px-1 rounded ${
                                    pend > 0
                                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold'
                                      : hasManualRev
                                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold ring-1 ring-blue-500/30'
                                      : 'text-foreground font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-300'
                                  }`}
                                >
                                  {val}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center justify-center min-w-[20px] rounded ${
                                    hasManualRev
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold px-1'
                                      : 'text-muted-foreground/40 group-hover:text-emerald-600'
                                  }`}
                                >
                                  {hasManualRev ? '0' : '-'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-center font-mono font-bold bg-amber-500/5">
                          <span className="text-amber-700 dark:text-amber-300">{row.usedLeaveDays}</span>
                          {row.pendingDays > 0 && (
                            <span className="block text-[9.5px] font-normal text-amber-600">+{row.pendingDays} pending</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold bg-emerald-500/5">
                          {row.remainingLeaveDays === 0 ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              HABIS (0)
                            </Badge>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-300">{row.remainingLeaveDays} Hari</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openRevisionModal(row)}
                            className="h-7 px-2 text-[11px] rounded-lg gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                            title={`Edit / revisi cuti bulanan ${row.fullName}`}
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {currentSection && filteredRows.length > 0 && (
                  <tfoot className="bg-muted/60 border-t-2 border-border font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-muted-foreground">
                        Total Kelompok ({currentSection.summary.totalEmployees} Org)
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono">{currentSection.summary.totalQuota}</td>
                      {currentSection.monthKeys.map((mk) => (
                        <td key={mk} className="py-2.5 px-2 text-center font-mono text-foreground">
                          {currentSection.summary.monthlyTotals[mk] || 0}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-center font-mono text-amber-700 dark:text-amber-300">
                        {currentSection.summary.totalUsed}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-300">
                        {currentSection.summary.totalRemaining}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <HrmMonthlyLeaveRevisionModal
        isOpen={revisionModalOpen}
        onClose={() => setRevisionModalOpen(false)}
        row={editingRow}
        monthKeys={currentSection?.monthKeys || []}
        focusedMonthKey={editingMonthKey}
        onSaved={(updatedRecap) => {
          if (updatedRecap) {
            setRecap(updatedRecap);
          } else {
            fetchRecap();
          }
          if (typeof onSynced === 'function') onSynced();
        }}
      />
    </div>
  );
};

