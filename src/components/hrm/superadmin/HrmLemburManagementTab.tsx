import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { OvertimeRecord, OvertimeStatus, UserProfile } from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck2,
  DollarSign,
  Search,
  Filter,
  Camera,
  RefreshCw,
  AlertCircle,
  Briefcase,
  Plus,
  Pencil,
  FileSpreadsheet,
  TrendingUp,
  Coins,
  BarChart3,
  Layers,
} from 'lucide-react';
import { HrmManualLemburModal } from '@/components/hrm/superadmin/HrmManualLemburModal';
import { HrmEditLemburModal } from '@/components/hrm/superadmin/HrmEditLemburModal';
import { HrmMonthlyFinancialRecapModal } from '@/components/hrm/HrmMonthlyFinancialRecapModal';
import { api } from '@/services/apiClient';

export const HrmLemburManagementTab: React.FC = () => {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Financial & Quota Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);

  // Approval Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedOt, setSelectedOt] = useState<OvertimeRecord | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Overtime Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOt, setEditingOt] = useState<OvertimeRecord | null>(null);

  // Photo Preview Modal
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Manual Overtime Modal
  const [manualModalOpen, setManualModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setUsers(hrmService.getUsers());
    setDivisions(hrmService.getDivisions());
    const otList = hrmService.getOvertimeRecords();
    setRecords(otList);

    try {
      const res = await api.get<{ success: boolean; data: any[] }>('/overtime');
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const usersList = hrmService.getUsers();
        const remoteOts: OvertimeRecord[] = res.data.map((r: any) => {
          const u = usersList.find((usr) => usr.id === r.user_id || usr.nip === r.user_nip);
          const compensation = Number(r.compensation_amount || 0);
          return {
            id: r.id,
            userId: r.user_id,
            userName: r.user_name || u?.fullName || 'Karyawan',
            userNip: r.user_nip || u?.nip || '',
            divisionId: r.user_division_id || u?.divisionId,
            divisionName: r.division_name || u?.divisionName || '-',
            date: r.date ? (typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0]) : '',
            startTime: r.start_time ? String(r.start_time).substring(0, 5) : '07:30',
            endTime: r.end_time ? String(r.end_time).substring(0, 5) : '15:30',
            durationHours: Number(r.duration_hours || 8),
            approvedHours: Number(r.approved_hours || r.duration_hours || 8),
            hourlyRate: Number(r.rate_applied || 23381.79),
            compensationAmount: compensation,
            totalPay: compensation,
            taskDescription: r.task_description || '',
            status: r.status || 'approved',
            paymentStatus: r.payment_status || 'unpaid',
            approvedBy: r.approved_by,
            approvedByName: r.approver_name || 'Super Administrator',
            approvalNotes: r.approval_notes,
            taskPhotoUrl: r.task_photo_url,
            isWeekendHoliday: Boolean(r.is_weekend_holiday),
            createdAt: r.created_at,
          };
        });
        setRecords(remoteOts);
        localStorage.setItem('hrm_overtime_records', JSON.stringify(remoteOts));
      }
    } catch (e) {
      console.warn('[HrmLemburManagementTab] Sync remote overtime note:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('hrm_overtime_updated', handleSync);
    window.addEventListener('hrm_data_updated', handleSync);
    return () => {
      window.removeEventListener('hrm_overtime_updated', handleSync);
      window.removeEventListener('hrm_data_updated', handleSync);
    };
  }, []);

  const filteredRecords = records.filter((r) => {
    const user = users.find((u) => u.id === r.userId);
    const uName = r.userName || user?.fullName || '';
    const uNip = r.userNip || user?.nip || '';
    const uDiv = r.divisionName || user?.divisionName || user?.division || '';

    const matchesSearch =
      uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.taskDescription || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDivision =
      selectedDivision === 'all' || uDiv.toLowerCase() === selectedDivision.toLowerCase();

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesDivision && matchesStatus;
  });

  // Calculate Metrics
  const totalSPKL = records.length;
  const pendingCount = records.filter((r) => r.status === 'pending').length;
  const approvedCount = records.filter((r) => r.status === 'approved' || r.status === 'completed').length;
  const totalHours = records
    .filter((r) => r.status === 'approved' || r.status === 'completed')
    .reduce((acc, curr) => acc + (Number(curr.approvedHours ?? curr.durationHours) || 0), 0);
  const totalPayEstimate = records
    .filter((r) => r.status === 'approved' || r.status === 'completed')
    .reduce((acc, curr) => acc + (Number(curr.compensationAmount ?? curr.totalPay) || 0), 0);

  // ─── PERHITUNGAN REALTIME KUOTA & PLAFON ANGGARAN LEMBUR PIMPINAN (RP 76 JT) ───
  const TOTAL_BUDGET_CAP = 76000000;
  const SHIPMENT_BUDGET_CAP = 72000000;
  const WISMA_BUDGET_CAP = 4000000;

  const budgetMetrics = React.useMemo(() => {
    let shipmentSpent = 0;
    let shipmentHours = 0;
    let shipmentSpklCount = 0;
    let wismaSpent = 0;
    let wismaHours = 0;
    let wismaSpklCount = 0;

    const approvedOts = records.filter(
      (r) => r.status === 'approved' || r.status === 'completed'
    );

    approvedOts.forEach((r) => {
      const user = users.find((u) => u.id === r.userId || u.nip === r.userNip);
      const isWisma =
        (user?.operationalGroup || '').toUpperCase().includes('RUMAH TANGGA') ||
        (r.divisionName && r.divisionName.toLowerCase().includes('wisma')) ||
        (r.divisionName && r.divisionName.toLowerCase().includes('rumah tangga')) ||
        (r.userNip && parseInt(r.userNip.replace(/\D/g, ''), 10) <= 33);

      const pay = Number(r.compensationAmount ?? r.totalPay ?? 0) || (Number(r.approvedHours || r.durationHours || 0) * 23381.79);
      const hours = Number(r.approvedHours || r.durationHours || 0);

      if (isWisma) {
        wismaSpent += pay;
        wismaHours += hours;
        wismaSpklCount += 1;
      } else {
        shipmentSpent += pay;
        shipmentHours += hours;
        shipmentSpklCount += 1;
      }
    });

    const totalSpent = shipmentSpent + wismaSpent;
    const totalRemaining = Math.max(0, TOTAL_BUDGET_CAP - totalSpent);
    const shipmentRemaining = Math.max(0, SHIPMENT_BUDGET_CAP - shipmentSpent);
    const wismaRemaining = Math.max(0, WISMA_BUDGET_CAP - wismaSpent);

    const totalBurnPct = Math.min(100, (totalSpent / TOTAL_BUDGET_CAP) * 100);
    const shipmentBurnPct = Math.min(100, (shipmentSpent / SHIPMENT_BUDGET_CAP) * 100);
    const wismaBurnPct = Math.min(100, (wismaSpent / WISMA_BUDGET_CAP) * 100);

    return {
      TOTAL_BUDGET_CAP,
      SHIPMENT_BUDGET_CAP,
      WISMA_BUDGET_CAP,
      totalSpent: Math.round(totalSpent),
      totalRemaining: Math.round(totalRemaining),
      totalBurnPct,
      shipmentSpent: Math.round(shipmentSpent),
      shipmentRemaining: Math.round(shipmentRemaining),
      shipmentBurnPct,
      shipmentHours,
      shipmentSpklCount,
      wismaSpent: Math.round(wismaSpent),
      wismaRemaining: Math.round(wismaRemaining),
      wismaBurnPct,
      wismaHours,
      wismaSpklCount,
    };
  }, [records, users]);

  const handleOpenEdit = (rec: OvertimeRecord) => {
    setEditingOt(rec);
    setEditModalOpen(true);
  };

  const handleOpenAction = (rec: OvertimeRecord, type: 'approve' | 'reject') => {
    setSelectedOt(rec);
    setActionType(type);
    setActionNotes(type === 'approve' ? 'Disetujui oleh Super Administrator' : 'Tidak memenuhi kualifikasi lembur');
    setActionModalOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedOt) return;
    setIsSubmitting(true);
    try {
      const res = await hrmService.updateOvertimeStatus(
        selectedOt.id,
        actionType === 'approve' ? 'approved' : 'rejected',
        'Super Administrator',
        actionNotes
      );

      if (res.success) {
        toast.success(
          `Pengajuan SPKL lembur berhasil ${actionType === 'approve' ? 'disetujui' : 'ditolak'} dan tersinkron ke database.`
        );
        setActionModalOpen(false);
        loadData();
      } else {
        toast.error(res.error || 'Gagal memperbarui status lembur');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan saat memproses status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: OvertimeStatus) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px]">Disetujui</Badge>;
      case 'completed':
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[11px]">Selesai Bertugas</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[11px] animate-pulse">Menunggu</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-[11px]">Ditolak</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ═══ RADAR PLAFON & ANGGARAN LEMBUR PIMPINAN (STRICT BUDGET CAPS) ═══ */}
      <Card className="border-border bg-gradient-to-br from-card via-card to-blue-500/5 rounded-2xl shadow-xs overflow-hidden border-blue-500/30">
        <CardHeader className="pb-3 border-b border-border/80 bg-blue-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  Plafon &amp; Batasan Anggaran Lembur Pimpinan (Strict Overtime Cap)
                  <Badge variant="outline" className="border-blue-500/40 text-blue-700 dark:text-blue-300 text-[10px]">
                    Aturan Baku FRP
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Sistem pengawasan ketat plafon lembur agar realisasi pembayaran tidak melampaui nominal yang telah ditetapkan Pimpinan.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setReportModalOpen(true)}
                className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Laporan Rekap &amp; Kuota Realtime
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3.5">
          {/* Live Overall Quota Meter (Plafon Rp 76 Jt Gabungan 80 Personil) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white border border-blue-500/30 shadow-md space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider">
                    Plafon Lembur Sah Perusahaan (Total Rp 76 Jt)
                  </span>
                  <Badge
                    className={
                      budgetMetrics.totalBurnPct > 90
                        ? 'bg-rose-500 text-white text-[10px]'
                        : budgetMetrics.totalBurnPct > 70
                        ? 'bg-amber-500 text-white text-[10px]'
                        : 'bg-emerald-600 text-white text-[10px]'
                    }
                  >
                    {budgetMetrics.totalBurnPct > 90
                      ? '⚠️ Mendekati Plafon'
                      : budgetMetrics.totalBurnPct > 70
                      ? '⚡ Serapan Aktif'
                      : '✅ Kuota Aman'}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-extrabold font-mono text-white">
                    Rp {budgetMetrics.totalSpent.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs text-blue-200/80 font-mono">
                    / Rp {TOTAL_BUDGET_CAP.toLocaleString('id-ID')} ({budgetMetrics.totalBurnPct.toFixed(1)}% Terpakai)
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right sm:border-l sm:border-white/10 sm:pl-4">
                <span className="text-[11px] text-blue-200">Sisa Kuota Anggaran Tersedia:</span>
                <p className="text-lg font-bold font-mono text-emerald-400">
                  Rp {budgetMetrics.totalRemaining.toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] text-blue-300 font-mono">
                  {totalHours.toFixed(1)} Jam Realisasi ({approvedCount} SPKL Disetujui)
                </p>
              </div>
            </div>

            {/* Dynamic Multi-color Progress Bar */}
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-500 ${
                  budgetMetrics.totalBurnPct > 90
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : budgetMetrics.totalBurnPct > 70
                    ? 'bg-gradient-to-r from-blue-500 to-amber-500'
                    : 'bg-gradient-to-r from-teal-400 to-emerald-500'
                }`}
                style={{ width: `${Math.max(2, budgetMetrics.totalBurnPct)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Box 1: Shiftman Total */}
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-300">Total Shiftman FRP</span>
                <Badge className="bg-blue-600 text-white text-[10px]">47 Karyawan</Badge>
              </div>
              <div>
                <p className="text-lg font-extrabold text-foreground font-mono">Rp 72.000.000</p>
                <div className="space-y-1 mt-1 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terpakai:</span>
                    <strong className="text-blue-600 dark:text-blue-400">
                      Rp {budgetMetrics.shipmentSpent.toLocaleString('id-ID')} ({budgetMetrics.shipmentHours.toFixed(1)}J)
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tersisa:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      Rp {budgetMetrics.shipmentRemaining.toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-blue-600" style={{ width: `${budgetMetrics.shipmentBurnPct}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight pt-1 border-t border-border/60">
                Plafon gabungan 47 orang (44 Shift Normal + 3 Day Shift). Realisasi tidak boleh melebihi 72jt.
              </p>
            </div>

            {/* Box 2: Shift Normal */}
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-card/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-300">A. Shift Normal (213 Jam)</span>
                <Badge className="bg-emerald-600 text-white text-[10px]">44 Karyawan</Badge>
              </div>
              <p className="text-lg font-extrabold text-emerald-600 font-mono">30 Jam Real (x2)</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Bagian dari 47 shiftman. Dibayar <strong>2x nominal tarif area kerja</strong> (total 60 jam bayar).
              </p>
            </div>

            {/* Box 3: Day Shift */}
            <div className="p-3.5 rounded-xl border border-purple-500/20 bg-card/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900 dark:text-purple-300">B. Day Shift Normal</span>
                <Badge className="bg-purple-600 text-white text-[10px]">3 Karyawan</Badge>
              </div>
              <p className="text-lg font-extrabold text-purple-600 font-mono">56 Jam Real (x2)</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Bagian dari 47 shiftman. Dibayar dikali 2 menjadi <strong>112 jam bayar x nominal upah per jam</strong>.
              </p>
            </div>

            {/* Box 4: Wisma Biring Ere */}
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-card/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-300">Petugas Wisma Biring Ere</span>
                <Badge className="bg-amber-600 text-white text-[10px]">33 Karyawan</Badge>
              </div>
              <div>
                <p className="text-lg font-extrabold text-amber-600 font-mono">Rp 4.000.000</p>
                <div className="space-y-1 mt-1 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terpakai:</span>
                    <strong className="text-amber-600 dark:text-amber-400">
                      Rp {budgetMetrics.wismaSpent.toLocaleString('id-ID')} ({budgetMetrics.wismaHours.toFixed(1)}J)
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tersisa:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      Rp {budgetMetrics.wismaRemaining.toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-amber-500" style={{ width: `${budgetMetrics.wismaBurnPct}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight pt-1 border-t border-border/60">
                Budget 4jt <strong>dibagi rata 33 orang</strong>. Kelebihan jam jadi <strong>Flexytime (Libur)</strong> bulan berjalan, tidak diambil = <strong>HANGUS</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total SPKL</p>
              <p className="text-xl font-bold text-foreground">{totalSPKL}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Perlu Approval</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">SPKL Disetujui</p>
              <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Jam Lembur</p>
              <p className="text-xl font-bold text-sky-600">{totalHours.toFixed(1)} Jam</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Estimasi Upah PP35</p>
              <p className="text-base font-bold font-mono text-purple-600">
                Rp {totalPayEstimate > 0 ? (totalPayEstimate / 1000).toFixed(0) + 'k' : '0'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Daftar Surat Perintah Kerja Lembur (SPKL Digital)
              </CardTitle>
              <CardDescription className="text-xs">
                Verifikasi penugasan lembur sebelum/sesudah jam kerja dengan kalkulasi pengali PP No. 35/2021.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setReportModalOpen(true)}
                className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Laporan Rekap &amp; Kuota Lembur
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={isLoading}
                className="h-8 text-xs rounded-xl gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Muat Ulang
              </Button>
              <Button
                size="sm"
                onClick={() => setManualModalOpen(true)}
                className="h-8 text-xs rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Input Lembur Manual
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIP, atau tugas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            <div>
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

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Status Persetujuan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu Persetujuan</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Divisi</th>
                    <th className="py-3 px-4 text-center">Tanggal</th>
                    <th className="py-3 px-4 text-center">Jam & Durasi</th>
                    <th className="py-3 px-4">Uraian Tugas Lembur</th>
                    <th className="py-3 px-4 text-center">Bukti Foto</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Kompensasi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        Belum ada pengajuan lembur yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const user = users.find((u) => u.id === r.userId);
                      const photo =
                        r.taskPhotoUrl ||
                        (r.completionPhotos && r.completionPhotos.length > 0 ? r.completionPhotos[0] : null);
                      const dur = Number(r.approvedHours ?? r.durationHours) || 0;
                      const comp = Number(r.compensationAmount ?? r.totalPay) || 0;

                      return (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-foreground">{r.userName || user?.fullName || 'Karyawan'}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{r.userNip || user?.nip || '-'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                            {r.divisionName || user?.divisionName || '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap font-medium text-foreground">
                            {r.date}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono">{r.startTime} - {r.endTime}</span>
                            <p className="text-[10px] text-muted-foreground font-semibold">({dur} Jam)</p>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-muted-foreground">
                            {r.taskDescription || 'Pekerjaan operasional'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {photo ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPhotoPreview(photo)}
                                className="h-6 w-6 p-0 rounded-lg text-primary hover:bg-primary/10"
                                title="Lihat Foto Bukti"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(r.status)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-foreground whitespace-nowrap">
                            {comp > 0 ? `Rp ${comp.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenAction(r, 'approve')}
                                    className="h-7 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2"
                                  >
                                    Setujui
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenAction(r, 'reject')}
                                    className="h-7 text-[11px] rounded-lg border-rose-300 text-rose-600 hover:bg-rose-50 px-2"
                                  >
                                    Tolak
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(r)}
                                className="h-7 text-[11px] rounded-lg border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-semibold px-2 flex items-center gap-1 shadow-2xs"
                                title="Edit / Koreksi Jam & SPKL Lembur"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
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
          </div>
        </CardContent>
      </Card>

      {/* Modal Action Approval/Rejection */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Konfirmasi Persetujuan SPKL Lembur
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Tolak Pengajuan Lembur
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {actionType === 'approve'
                ? 'Lembur yang disetujui akan diakumulasikan ke rekapan jam kerja dan slip penggajian periode berjalan.'
                : 'Berikan alasan penolakan agar karyawan menerima pemberitahuan resmi di aplikasi.'}
            </DialogDescription>
          </DialogHeader>

          {selectedOt && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
                <p className="font-semibold text-foreground">{selectedOt.userName}</p>
                <p className="text-muted-foreground">
                  Tanggal: {selectedOt.date} • Durasi: {selectedOt.durationHours} Jam ({selectedOt.startTime} - {selectedOt.endTime})
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-1">"{selectedOt.taskDescription}"</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Catatan Verifikasi</label>
                <Input
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  placeholder="Catatan..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteAction}
              disabled={isSubmitting}
              className={`rounded-xl text-white font-semibold ${
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? 'Memproses...' : actionType === 'approve' ? 'Ya, Setujui Lembur' : 'Tolak Lembur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Bukti Foto */}
      {photoPreview && (
        <Dialog open={Boolean(photoPreview)} onOpenChange={() => setPhotoPreview(null)}>
          <DialogContent className="max-w-md p-4 text-center">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center justify-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                Bukti Foto Pelaksanaan Tugas Lembur
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex justify-center">
              <img
                src={photoPreview}
                alt="Bukti Lembur"
                className="max-h-80 w-auto rounded-xl object-contain border border-border shadow-md"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPhotoPreview(null)} className="rounded-xl">
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Input Lembur Manual Superadmin */}
      <HrmManualLemburModal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Modal Koreksi / Edit SPKL Lembur */}
      <HrmEditLemburModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingOt(null);
        }}
        record={editingOt}
        onSuccess={() => loadData()}
      />

      {/* Modal Laporan Rekapitulasi Realtime & Kuota Anggaran Lembur Sah PT FRP */}
      <HrmMonthlyFinancialRecapModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        users={users}
        overtimes={records}
      />
    </div>
  );
};
