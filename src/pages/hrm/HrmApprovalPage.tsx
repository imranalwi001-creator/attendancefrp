import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { LeaveRequest, OvertimeRecord, OvertimeStatus, OvertimePaymentStatus, UserProfile, ShiftSwapRecord, SmartSubstituteCandidate } from '@/types/hrm';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Coins,
  CalendarCheck2,
  CreditCard,
  CheckCheck,
  Zap,
  Plus,
  UserCheck,
  Briefcase,
  Repeat,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Info,
  FileSpreadsheet,
  Layers,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';

export const HrmApprovalPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'leaves' | 'overtime' | 'swaps' | 'recap'>('leaves');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [overtimeList, setOvertimeList] = useState<OvertimeRecord[]>([]);
  const [shiftSwaps, setShiftSwaps] = useState<ShiftSwapRecord[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);

  // User role checking (Korlap, Admin, K3, Danru, Superadmin, Dirut, Pimpinan)
  const userRoleName = (user?.roleName || user?.role || '').toLowerCase();
  const isSuperAdmin = userRoleName.includes('superadmin');
  const isDirut = userRoleName.includes('dirut');
  const isPimpinan = isSuperAdmin || isDirut || userRoleName.includes('pimpinan');
  const isKorlap = isSuperAdmin || userRoleName.includes('korlap') || userRoleName.includes('koordinator');
  const isDanru = isSuperAdmin || userRoleName.includes('danru') || userRoleName.includes('regu') || userRoleName.includes('pengawas');
  const isK3 = isSuperAdmin || userRoleName.includes('k3') || userRoleName.includes('hse') || userRoleName.includes('keselamatan');
  const isAdmin = isSuperAdmin || userRoleName.includes('admin') || userRoleName.includes('hrd');
  const canApprove = isSuperAdmin || isPimpinan || isKorlap || isDanru || isK3 || isAdmin;

  // Cek apakah pemohon adalah Pejabat Pengawas (Korlap / Admin / K3)
  const isSupervisorApplicant = (userId: string, userNip?: string, forwardedToPimpinan?: boolean) => {
    if (forwardedToPimpinan) return true;
    const applicant = users.find((u) => u.id === userId || (userNip && u.nip === userNip));
    const roleCode = (applicant?.role || applicant?.roleName || '').toLowerCase();
    if (['korlap', 'admin', 'k3', 'koordinator'].includes(roleCode) || roleCode.includes('korlap') || roleCode.includes('k3')) {
      return true;
    }
    const knownSupervisorNips = ['frp 07065', 'fr.07.066', 'fr07065', 'fr07066', 'adm001', 'emp008'];
    if (userNip && knownSupervisorNips.includes(userNip.toLowerCase().trim())) return true;
    return false;
  };

  // Recap Filter States (Log Transaksi Berkas)
  const [recapTypeFilter, setRecapTypeFilter] = useState<string>('all');
  const [recapStatusFilter, setRecapStatusFilter] = useState<string>('all');
  const [recapMonthFilter, setRecapMonthFilter] = useState<'current' | 'all'>('current');
  const [recapSearch, setRecapSearch] = useState('');

  // Field Team Performance Recap (Kehadiran, Terlambat, Mangkir, Cuti, Sakit, Lembur dari API)
  const [fieldRecapPeriod, setFieldRecapPeriod] = useState<'current_month' | 'last_month' | 'year'>('current_month');
  const [fieldRecapDivision, setFieldRecapDivision] = useState<string>('all');
  const [fieldRecapSearch, setFieldRecapSearch] = useState<string>('');
  const [fieldRecapData, setFieldRecapData] = useState<{ summary: any; roster: any[] } | null>(null);
  const [loadingFieldRecap, setLoadingFieldRecap] = useState(false);
  const [divisions, setDivisions] = useState(hrmService.getDivisions());

  const loadFieldRecap = async () => {
    setLoadingFieldRecap(true);
    try {
      const res = await hrmService.getFieldRecap({
        period: fieldRecapPeriod,
        divisionId: fieldRecapDivision !== 'all' ? fieldRecapDivision : undefined,
      });
      if (res && res.success && res.data) {
        setFieldRecapData(res.data);
      }
    } catch (e) {
      console.warn('Failed to load field recap:', e);
    } finally {
      setLoadingFieldRecap(false);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'overtime' || tab === 'lembur') {
      setActiveTab('overtime');
    } else if (tab === 'swaps' || tab === 'shift' || tab === 'tukar') {
      setActiveTab('swaps');
    } else if (tab === 'leaves' || tab === 'cuti' || tab === 'izin') {
      setActiveTab('leaves');
    } else if (tab === 'recap' || tab === 'rekap') {
      setActiveTab('recap');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'recap') {
      loadFieldRecap();
    }
  }, [activeTab, fieldRecapPeriod, fieldRecapDivision]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Leave Approval Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  // Substitute & 1-Year History State for Leave Approval
  const [applicantHistoryLeaves, setApplicantHistoryLeaves] = useState<LeaveRequest[]>([]);
  const [applicantQuotaInfo, setApplicantQuotaInfo] = useState<{ totalQuota: number; usedDays: number; remaining: number }>({ totalQuota: 14, usedDays: 0, remaining: 14 });
  const [substituteCandidates, setSubstituteCandidates] = useState<UserProfile[]>([]);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState<string>('');

  // Overtime Approval Modal State (with Admin Approved Hours authority)
  const [otModalOpen, setOtModalOpen] = useState(false);
  const [selectedOvertime, setSelectedOvertime] = useState<OvertimeRecord | null>(null);
  const [otDecision, setOtDecision] = useState<'approved' | 'rejected'>('approved');
  const [otNotes, setOtNotes] = useState('');
  const [otApprovedHours, setOtApprovedHours] = useState<number>(2);

  // Direct Overtime Mandate Modal State (Admin Mandat)
  const [directOtModalOpen, setDirectOtModalOpen] = useState(false);
  const [directUserId, setDirectUserId] = useState('');
  const [directHours, setDirectHours] = useState<number>(2);
  const [directReason, setDirectReason] = useState('');
  const [directDate, setDirectDate] = useState(getTodayDateStr());
  const [submittingDirectOt, setSubmittingDirectOt] = useState(false);

  // Danru Recommendation Modal State
  const [danruModalOpen, setDanruModalOpen] = useState(false);
  const [selectedSwapForDanru, setSelectedSwapForDanru] = useState<ShiftSwapRecord | null>(null);
  const [danruRecommendedSubstituteId, setDanruRecommendedSubstituteId] = useState('');
  const [danruNotes, setDanruNotes] = useState('');
  const [submittingDanru, setSubmittingDanru] = useState(false);

  // Korlap Decision Modal State
  const [korlapModalOpen, setKorlapModalOpen] = useState(false);
  const [selectedSwapForKorlap, setSelectedSwapForKorlap] = useState<ShiftSwapRecord | null>(null);
  const [korlapDecision, setKorlapDecision] = useState<'approved' | 'rejected'>('approved');
  const [korlapSubstituteId, setKorlapSubstituteId] = useState('');
  const [korlapNotes, setKorlapNotes] = useState('');
  const [submittingKorlap, setSubmittingKorlap] = useState(false);

  // Dynamic Smart Candidates State
  const [smartCandidates, setSmartCandidates] = useState<SmartSubstituteCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const loadData = () => {
    setLeaves(hrmService.getLeaves());
    setOvertimeList(hrmService.getOvertimeRecords());
    setUsers(hrmService.getUsers().filter((u) => u.isActive));
    loadShiftSwaps();
  };

  const loadShiftSwaps = async () => {
    setLoadingSwaps(true);
    try {
      const data = await hrmService.getShiftSwaps(undefined, user?.roleName || user?.role || 'admin');
      setShiftSwaps(data);
    } catch (e) {
      console.warn('Failed to load shift swaps:', e);
    } finally {
      setLoadingSwaps(false);
    }
  };

  useEffect(() => {
    loadData();
    hrmService.syncWithBackend().then(loadData);
    window.addEventListener('hrm_leaves_updated', loadData);
    window.addEventListener('hrm_overtime_updated', loadData);
    window.addEventListener('hrm_swaps_updated', loadData);
    window.addEventListener('hrm_data_updated', loadData);
    return () => {
      window.removeEventListener('hrm_leaves_updated', loadData);
      window.removeEventListener('hrm_overtime_updated', loadData);
      window.removeEventListener('hrm_swaps_updated', loadData);
      window.removeEventListener('hrm_data_updated', loadData);
    };
  }, []);

  const handleOpenDanruModal = async (swap: ShiftSwapRecord) => {
    setSelectedSwapForDanru(swap);
    setDanruNotes(swap.danru_notes || '');
    setDanruRecommendedSubstituteId(swap.danru_substitute_id || '');
    setDanruModalOpen(true);
    setLoadingCandidates(true);
    try {
      const candidates = await hrmService.getSmartSubstituteCandidates(
        swap.requester_id,
        swap.swap_date.split('T')[0],
        swap.original_shift
      );
      setSmartCandidates(candidates);
      if (!swap.danru_substitute_id && candidates.length > 0) {
        setDanruRecommendedSubstituteId(candidates[0].id);
      }
    } catch (e) {
      console.warn('Failed to fetch smart candidates for danru:', e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleConfirmDanruRecommendation = async () => {
    if (!selectedSwapForDanru || !user) return;
    if (!danruRecommendedSubstituteId) {
      alert('Pilih kandidat pengganti yang direkomendasikan.');
      return;
    }
    setSubmittingDanru(true);
    try {
      const res = await hrmService.danruRecommendSwap(selectedSwapForDanru.id, {
        danru_id: user.id,
        recommended_substitute_id: danruRecommendedSubstituteId,
        notes: danruNotes.trim(),
      });
      if (res.success) {
        setDanruModalOpen(false);
        setActionSuccess('Rekomendasi pengganti berhasil dikirimkan ke Koordinator Lapangan (Korlap)!');
        setTimeout(() => setActionSuccess(null), 4000);
        loadShiftSwaps();
      } else {
        alert(res.error || 'Gagal mengirim rekomendasi');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim rekomendasi');
    } finally {
      setSubmittingDanru(false);
    }
  };

  const handleOpenKorlapModal = async (swap: ShiftSwapRecord, initialDecision: 'approved' | 'rejected' = 'approved') => {
    setSelectedSwapForKorlap(swap);
    setKorlapDecision(initialDecision);
    setKorlapNotes(
      swap.korlap_notes ||
        (initialDecision === 'approved'
          ? 'Disetujui untuk pengisian kekosongan pos tugas dinas.'
          : 'Mohon maaf pengajuan tukar shift belum dapat disetujui.')
    );
    setKorlapSubstituteId(swap.substitute_id || swap.danru_substitute_id || '');
    setKorlapModalOpen(true);
    setLoadingCandidates(true);
    try {
      const candidates = await hrmService.getSmartSubstituteCandidates(
        swap.requester_id,
        swap.swap_date.split('T')[0],
        swap.original_shift
      );
      setSmartCandidates(candidates);
      if (!swap.substitute_id && !swap.danru_substitute_id && candidates.length > 0) {
        setKorlapSubstituteId(candidates[0].id);
      } else if (swap.danru_substitute_id && !swap.substitute_id) {
        setKorlapSubstituteId(swap.danru_substitute_id);
      }
    } catch (e) {
      console.warn('Failed to fetch smart candidates for korlap:', e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleConfirmKorlapDecision = async () => {
    if (!selectedSwapForKorlap || !user) return;
    if (korlapDecision === 'approved' && !korlapSubstituteId) {
      alert('Pilih karyawan pengganti resmi yang ditetapkan untuk mengisi kekosongan pos.');
      return;
    }
    setSubmittingKorlap(true);
    try {
      const res = await hrmService.korlapApproveSwap(selectedSwapForKorlap.id, {
        korlap_id: user.id,
        status: korlapDecision,
        substitute_id: korlapSubstituteId || undefined,
        notes: korlapNotes.trim(),
      });
      if (res.success) {
        setKorlapModalOpen(false);
        setActionSuccess(
          korlapDecision === 'approved'
            ? 'Pengajuan resmi disetujui Korlap! Notifikasi penugasan pos telah otomatis terkirim ke karyawan pemohon dan karyawan pengganti.'
            : 'Pengajuan tukar shift ditolak oleh Korlap.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        loadShiftSwaps();
      } else {
        alert(res.error || 'Gagal memproses persetujuan Korlap');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses persetujuan Korlap');
    } finally {
      setSubmittingKorlap(false);
    }
  };

  const handleOpenProcess = (leave: LeaveRequest, type: 'approved' | 'rejected') => {
    setSelectedLeave(leave);
    setDecision(type);
    setNotes(type === 'approved' ? 'Pengajuan cuti/izin disetujui sesuai ketentuan.' : 'Mohon maaf, pengajuan cuti/izin belum dapat disetujui.');

    // 1. Calculate 1-Year Leave History of Applicant
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const applicantAll = leaves.filter(
      (l) => l.userId === leave.userId && new Date(l.startDate || l.createdAt) >= oneYearAgo
    );
    setApplicantHistoryLeaves(applicantAll);

    // Get applicant user profile for accurate quota (12 + 2 = 14)
    const applicantUser = users.find((u) => u.id === leave.userId);
    const annualQuota = applicantUser?.annualLeaveQuota || 14;
    const usedDays = applicantUser?.usedLeaveDays || 0;
    setApplicantQuotaInfo({
      totalQuota: annualQuota,
      usedDays,
      remaining: Math.max(0, annualQuota - usedDays),
    });

    // 2. Recommend smart substitute from the same division
    const sameDiv = users.filter(
      (u) =>
        u.id !== leave.userId &&
        u.isActive &&
        (u.divisionId === leave.divisionId || (u.divisionName && u.divisionName === leave.divisionName))
    );
    const candidates = sameDiv.length > 0 ? sameDiv : users.filter((u) => u.id !== leave.userId && u.isActive);
    setSubstituteCandidates(candidates);
    if (candidates.length > 0) {
      setSelectedSubstituteId(candidates[0].id);
    } else {
      setSelectedSubstituteId('');
    }

    setModalOpen(true);
  };

  const handleConfirmDecision = () => {
    if (!selectedLeave || !user) return;
    try {
      const selectedSub = substituteCandidates.find((c) => c.id === selectedSubstituteId);
      hrmService.updateLeaveStatus(
        selectedLeave.id,
        decision,
        user.id,
        notes.trim(),
        decision === 'approved' ? selectedSubstituteId : undefined,
        decision === 'approved' ? selectedSub?.fullName : undefined,
        decision === 'approved' ? selectedSub?.nip : undefined
      );
      setModalOpen(false);
      setActionSuccess(
        `Pengajuan ${selectedLeave.userName} berhasil di-${decision === 'approved' ? 'setujui' : 'tolak'}. ${
          decision === 'approved' && selectedSub
            ? `Karyawan Pengganti Resmi: ${selectedSub.fullName} (${selectedSub.nip}). Notifikasi telah terkirim.`
            : ''
        }`
      );
      setTimeout(() => setActionSuccess(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses permohonan');
    }
  };

  const handleOpenOtProcess = (ot: OvertimeRecord, type: 'approved' | 'rejected') => {
    setSelectedOvertime(ot);
    setOtDecision(type);
    setOtApprovedHours(ot.requestedHours || ot.durationHours || 2);
    setOtNotes(type === 'approved' ? `Lembur disetujui ${ot.requestedHours || ot.durationHours || 2} Jam untuk diproses ke slip gaji.` : 'Permohonan lembur belum disetujui.');
    setOtModalOpen(true);
  };

  const handleConfirmOtDecision = () => {
    if (!selectedOvertime || !user) return;
    try {
      if (otDecision === 'approved') {
        hrmService.approveOvertimeWithHours(
          selectedOvertime.id,
          Number(otApprovedHours),
          user.id,
          user.fullName,
          otNotes.trim()
        );
        setActionSuccess(`Lembur ${selectedOvertime.userName} disetujui resmi ${otApprovedHours} Jam. Notifikasi telah dikirim ke karyawan.`);
      } else {
        hrmService.rejectOvertime(
          selectedOvertime.id,
          user.id,
          user.fullName,
          otNotes.trim()
        );
        setActionSuccess(`Lembur ${selectedOvertime.userName} ditolak.`);
      }
      setOtModalOpen(false);
      setTimeout(() => setActionSuccess(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses permohonan lembur');
    }
  };

  const handleConfirmDirectOvertime = () => {
    if (!directUserId) {
      alert('Pilih karyawan yang ditugaskan lembur.');
      return;
    }
    if (!directReason.trim()) {
      alert('Tuliskan alasan / rincian pekerjaan lembur.');
      return;
    }
    setSubmittingDirectOt(true);
    try {
      const assigned = hrmService.assignOvertimeDirectly({
        userId: directUserId,
        date: directDate,
        approvedHours: Number(directHours),
        taskDescription: directReason.trim(),
        adminId: user?.id,
        adminName: user?.fullName || 'Superadmin',
      });
      setDirectOtModalOpen(false);
      setDirectReason('');
      setActionSuccess(`Mandat lembur resmi ${directHours} Jam untuk ${assigned.userName} berhasil diaktifkan. Notifikasi dikirimkan.`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengaktifkan mandat lembur.');
    } finally {
      setSubmittingDirectOt(false);
    }
  };

  const handleUpdatePayment = (id: string, paymentStatus: OvertimePaymentStatus) => {
    try {
      hrmService.updateOvertimePaymentStatus(id, paymentStatus);
      setActionSuccess('Status pencairan uang lembur berhasil diperbarui!');
      setTimeout(() => setActionSuccess(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status pembayaran');
    }
  };

  const pendingLeavesCount = leaves.filter((l) => l.status === 'pending').length;
  const pendingOvertimeCount = overtimeList.filter((o) => o.status === 'pending').length;
  const pendingSwapsCount = shiftSwaps.filter(
    (s) => s.status === 'pending_danru' || s.status === 'pending_korlap' || s.status === 'pending'
  ).length;

  const filteredLeaves = leaves.filter((l) => {
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchSearch =
      l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.userNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.reason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredOvertime = overtimeList.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch =
      o.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.userNip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.taskDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredSwaps = shiftSwaps.filter((s) => {
    const matchStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'pending'
        ? s.status === 'pending_danru' || s.status === 'pending_korlap' || s.status === 'pending'
        : s.status === filterStatus;
    const matchSearch =
      !searchQuery ||
      (s.requester_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.requester_nip || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.substitute_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.reason || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Consolidated Recap Calculation for Korlap, Admin, and K3
  const consolidatedRecapList = useMemo(() => {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);

    const leaveItems = leaves.map((l) => ({
      id: l.id,
      kind: 'leave' as const,
      userId: l.userId,
      userName: l.userName,
      userNip: l.userNip,
      divisionName: l.divisionName,
      type: l.leaveType,
      typeLabel:
        l.leaveType === 'annual_leave'
          ? 'Cuti Tahunan'
          : l.leaveType === 'sick_leave'
          ? 'Izin Sakit'
          : l.leaveType === 'emergency_leave' || l.leaveType === 'izin_darurat'
          ? 'Izin Darurat'
          : 'Dispensasi / Dinas',
      dateLabel: `${l.startDate} s/d ${l.endDate} (${l.totalDays || 1} Hari)`,
      rawDate: l.startDate || l.createdAt,
      reason: l.reason,
      attachmentUrl: l.attachmentUrl,
      status: l.status,
      approvedByName: l.approvedByName,
      rawItem: l,
    }));

    const overtimeItems = overtimeList.map((ot) => ({
      id: ot.id,
      kind: 'overtime' as const,
      userId: ot.userId,
      userName: ot.userName,
      userNip: ot.userNip,
      divisionName: ot.divisionName,
      type: 'overtime',
      typeLabel: `Lembur SPL (${ot.durationHours} Jam)`,
      dateLabel: `${ot.date} • ${ot.startTime} - ${ot.endTime} WITA`,
      rawDate: ot.date || ot.createdAt,
      reason: ot.taskDescription,
      attachmentUrl: ot.taskPhotoUrl || (ot as any).attachmentUrl,
      status: ot.status,
      approvedByName: (ot as any).approvedByName,
      rawItem: ot,
    }));

    let combined = [...leaveItems, ...overtimeItems];

    if (recapMonthFilter === 'current') {
      combined = combined.filter((item) => (item.rawDate || '').startsWith(currentMonthPrefix));
    }

    if (recapTypeFilter !== 'all') {
      if (recapTypeFilter === 'overtime') {
        combined = combined.filter((i) => i.kind === 'overtime');
      } else {
        combined = combined.filter((i) => i.type === recapTypeFilter);
      }
    }

    if (recapStatusFilter !== 'all') {
      combined = combined.filter((i) => i.status === recapStatusFilter);
    }

    if (recapSearch.trim()) {
      const q = recapSearch.toLowerCase();
      combined = combined.filter(
        (i) =>
          i.userName?.toLowerCase().includes(q) ||
          i.userNip?.toLowerCase().includes(q) ||
          i.reason?.toLowerCase().includes(q) ||
          i.divisionName?.toLowerCase().includes(q)
      );
    }

    return combined.sort((a, b) => (b.rawDate || '').localeCompare(a.rawDate || ''));
  }, [leaves, overtimeList, recapMonthFilter, recapTypeFilter, recapStatusFilter, recapSearch]);

  const recapSummary = useMemo(() => {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const thisMonthLeaves = leaves.filter((l) => (l.startDate || l.createdAt || '').startsWith(currentMonthPrefix));
    const thisMonthOts = overtimeList.filter((o) => (o.date || o.createdAt || '').startsWith(currentMonthPrefix));

    return {
      totalThisMonth: thisMonthLeaves.length + thisMonthOts.length,
      approvedLeaves: thisMonthLeaves.filter((l) => l.status === 'approved').length,
      emergencyLeaves: thisMonthLeaves.filter((l) => l.leaveType === 'emergency_leave' || l.leaveType === 'izin_darurat').length,
      approvedOvertimes: thisMonthOts.filter((o) => o.status === 'approved').length,
      totalOtHours: thisMonthOts
        .filter((o) => o.status === 'approved')
        .reduce((sum, o) => sum + (o.approvedHours || o.durationHours || 0), 0),
      pendingTotal:
        thisMonthLeaves.filter((l) => l.status === 'pending').length +
        thisMonthOts.filter((o) => o.status === 'pending').length,
    };
  }, [leaves, overtimeList]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-primary" />
            Pusat Persetujuan (Approval Center)
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Tinjau pengajuan cuti, izin sakit, uang lembur, serta alur pengisian kekosongan pos (Danru ➔ Korlap).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border rounded-xl self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'leaves'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarCheck2 className="w-4 h-4 text-primary" />
            <span>Cuti & Izin</span>
            {pendingLeavesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold">
                {pendingLeavesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overtime')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'overtime'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Coins className="w-4 h-4 text-primary" />
            <span>Pengajuan Lembur</span>
            {pendingOvertimeCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold">
                {pendingOvertimeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('swaps')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'swaps'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Repeat className="w-4 h-4 text-primary" />
            <span>Tukar Shift / Pengganti Pos</span>
            {pendingSwapsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold">
                {pendingSwapsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'recap'
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Rekap Realtime</span>
            {recapSummary.pendingTotal > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 text-[10px] font-bold">
                {recapSummary.pendingTotal}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'overtime' && (
          <Button
            onClick={() => {
              setDirectUserId(users[0]?.id || '');
              setDirectHours(2);
              setDirectReason('');
              setDirectDate(getTodayDateStr());
              setDirectOtModalOpen(true);
            }}
            className="rounded-xl text-xs h-9 gap-1.5 font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Tugaskan Lembur (SPL Mandat)
          </Button>
        )}
      </div>

      {actionSuccess && (
        <Alert className="border-border bg-card text-foreground py-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <AlertDescription className="text-xs font-medium">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Filter Toolbar */}
      <Card className="border-border bg-card rounded-xl shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Cari Nama Karyawan / NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs rounded-xl"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="text-xs rounded-xl">
                <SelectValue placeholder="Status Persetujuan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu Persetujuan (Pending)</SelectItem>
                <SelectItem value="approved">Sudah Disetujui</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table Container: Leaves or Overtime */}
      {activeTab === 'leaves' ? (
        /* Leaves List Table */
        <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                <tr>
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4">Jenis Permohonan</th>
                  <th className="py-3 px-4">Periode Tanggal</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4">Lampiran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      Tidak ada permohonan yang perlu diproses pada kriteria ini.
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map((l) => {
                    const isSup = isSupervisorApplicant(l.userId, l.userNip, (l as any).forwardedToPimpinan || (l as any).forwarded_to_pimpinan);
                    const canCurrentApproveThis = isSup ? (isPimpinan || isDirut || isSuperAdmin) : canApprove;

                    return (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-foreground">{l.userName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{l.userNip} • {l.divisionName}</p>
                        {isSup ? (
                          <Badge variant="outline" className="mt-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9.5px] rounded-md font-semibold flex items-center gap-1 w-fit">
                            👑 Pejabat Pengawas (Tier 2 Direksi)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[9px] rounded-md flex items-center gap-1 w-fit">
                            ⚡ First-Responder: Korlap / Admin / K3
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground uppercase text-[11px]">
                        {l.leaveType.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                        {l.startDate} s/d {l.endDate}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {l.totalDays} Hari
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={l.reason}>
                        {l.reason}
                      </td>
                      <td className="py-3 px-4">
                        {l.attachmentUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewAttachment(l.attachmentUrl!)}
                            className="h-7 text-[11px] gap-1 px-2 rounded-lg border-border text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-3 h-3" />
                            Lihat Bukti
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {l.status === 'approved' ? (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">Disetujui</Badge>
                            {l.substituteName && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Pengganti: {l.substituteName}
                              </div>
                            )}
                          </div>
                        ) : l.status === 'rejected' ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] rounded-md">Ditolak</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-md">Pending</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {l.status === 'pending' ? (
                          canCurrentApproveThis ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleOpenProcess(l, 'approved')}
                                className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                                title={isSup ? "Setujui Tingkat Direksi" : "Setujui Pengajuan (First-Responder)"}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenProcess(l, 'rejected')}
                                className="h-8 w-8 p-0 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-lg transition-colors"
                                title="Tolak Pengajuan"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Wewenang Direksi
                              </Badge>
                              <span className="text-[9px] text-muted-foreground text-right">
                                Menunggu Dirut / Pimpinan
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Selesai oleh {l.approvedByName || 'Approver'}
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : activeTab === 'overtime' ? (
        /* Overtime List Table */
        <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                <tr>
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4">Tanggal & Waktu</th>
                  <th className="py-3 px-4">Kategori Hari</th>
                  <th className="py-3 px-4">Durasi Jam</th>
                  <th className="py-3 px-4">Uang Lembur (Rp)</th>
                  <th className="py-3 px-4">Uraian Tugas Lembur</th>
                  <th className="py-3 px-4">Persetujuan</th>
                  <th className="py-3 px-4">Pencairan</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOvertime.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Tidak ada permohonan lembur yang perlu diproses pada kriteria ini.
                    </td>
                  </tr>
                ) : (
                  filteredOvertime.map((o) => {
                    const isSup = isSupervisorApplicant(o.userId, o.userNip, (o as any).forwardedToPimpinan || (o as any).forwarded_to_pimpinan);
                    const canCurrentApproveThis = isSup ? (isPimpinan || isDirut || isSuperAdmin) : canApprove;

                    return (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-foreground">{o.userName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{o.userNip} • {o.divisionName}</p>
                        {isSup ? (
                          <Badge variant="outline" className="mt-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9.5px] rounded-md font-semibold flex items-center gap-1 w-fit">
                            👑 Pejabat Pengawas (Tier 2 Direksi)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[9px] rounded-md flex items-center gap-1 w-fit">
                            ⚡ First-Responder: Korlap / Admin / K3
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <p className="text-foreground font-medium">{o.date}</p>
                        <p className="text-muted-foreground">{o.startTime} - {o.endTime} WIB</p>
                      </td>
                      <td className="py-3 px-4">
                        {o.isWeekendHoliday ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] rounded-md">
                            Libur ({o.rateMultiplier}x)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-md">
                            Hari Kerja (1.0x)
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground font-mono">{o.durationHours} Jam</span>
                        <span className="text-[10px] text-muted-foreground block">({o.durationMinutes} mnt)</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold font-mono text-primary text-xs">
                          Rp {Number(o.totalPay ?? o.compensationAmount ?? 0).toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          @Rp {Number(o.hourlyRate ?? o.rateApplied ?? 30000).toLocaleString('id-ID')}/jam
                        </p>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={o.taskDescription}>
                        {o.taskDescription}
                      </td>
                      <td className="py-3 px-4">
                        {o.status === 'approved' ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">Disetujui</Badge>
                        ) : o.status === 'rejected' ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] rounded-md">Ditolak</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-md">Pending</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {o.paymentStatus === 'paid' ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] rounded-md">
                            Ditransfer
                          </Badge>
                        ) : o.paymentStatus === 'included_in_payroll' ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">
                            Masuk Payroll
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-md">
                            Belum Cair
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {o.status === 'pending' ? (
                          canCurrentApproveThis ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleOpenOtProcess(o, 'approved')}
                                className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                                title={isSup ? "Setujui Lembur (Wewenang Direksi)" : "Setujui Lembur (First-Responder)"}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenOtProcess(o, 'rejected')}
                                className="h-8 w-8 p-0 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-lg transition-colors"
                                title="Tolak Lembur"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Wewenang Direksi
                              </Badge>
                              <span className="text-[9px] text-muted-foreground text-right">
                                Menunggu Dirut / Pimpinan
                              </span>
                            </div>
                          )
                        ) : o.status === 'approved' ? (
                          <div className="flex items-center justify-end gap-1">
                            {o.paymentStatus !== 'included_in_payroll' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdatePayment(o.id, 'included_in_payroll')}
                                className="h-7 text-[10px] px-2 rounded-lg border-border text-primary hover:bg-primary/10"
                                title="Masukkan ke slip gaji bulan ini"
                              >
                                Masuk Payroll
                              </Button>
                            )}
                            {o.paymentStatus !== 'paid' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdatePayment(o.id, 'paid')}
                                className="h-7 text-[10px] px-2 rounded-lg border-border text-emerald-600 hover:bg-emerald-500/10"
                                title="Tandai sudah dibayar langsung"
                              >
                                Tandai Cair
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Ditolak oleh {o.approvedByName || 'Approver'}
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : activeTab === 'swaps' ? (
        /* Shift Swaps / Pengganti Pos Jaga Table */
        <div className="space-y-4">
          {/* Information & Authority Architecture Guide */}
          <div className="p-3.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20 rounded-xl flex items-start gap-3 text-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-foreground text-xs">
                Sistem Otoritas Pengisian Pos Jaga & Kekosongan Dinas (Danru ➔ Korlap)
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed mt-0.5">
                Karyawan tidak dapat memilih pengganti sendiri demi objektivitas pos. Sistem cerdas (AI) menganalisis kesiapan jadwal dan merekomendasikan kandidat bebas tugas kepada <strong>Kepala Regu (Danru)</strong>. Danru memberi telaah/rekomendasi, dan hanya <strong>Koordinator Lapangan (Korlap)</strong> yang memegang hak sah mutlak untuk menetapkan pengganti pos.
              </p>
            </div>
          </div>

          <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Karyawan Pemohon</th>
                    <th className="py-3 px-4">Jadwal & Shift Pos</th>
                    <th className="py-3 px-4">Alasan Pengajuan</th>
                    <th className="py-3 px-4">Rekomendasi Cerdas AI</th>
                    <th className="py-3 px-4">Pengganti Resmi (Korlap)</th>
                    <th className="py-3 px-4">Status & Alur</th>
                    <th className="py-3 px-4 text-right">Tindakan Otoritas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSwaps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        <Repeat className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Tidak ada pengajuan tukar shift / pengisian pos ditemukan pada kriteria ini.
                      </td>
                    </tr>
                  ) : (
                    filteredSwaps.map((s) => {
                      const isPendingDanru = s.status === 'pending_danru' || s.status === 'pending';
                      const isPendingKorlap = s.status === 'pending_korlap';
                      const isApproved = s.status === 'approved';
                      const isRejected = s.status.includes('rejected');
                      const recs = Array.isArray(s.system_recommendations) ? s.system_recommendations : [];

                      return (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{s.requester_name || 'Karyawan'}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              NIP: {s.requester_nip || '-'} • {s.requester_division || '-'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">
                              {s.swap_date ? s.swap_date.split('T')[0] : '-'}
                            </div>
                            <Badge variant="outline" className="text-[10px] mt-0.5 border-border">
                              Shift Asal: {s.original_shift || 'Reguler'}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 max-w-[180px]">
                            <p className="text-foreground text-[11px] line-clamp-2" title={s.reason}>
                              {s.reason || '-'}
                            </p>
                          </td>

                          <td className="py-3 px-4 max-w-[200px]">
                            {recs.length > 0 ? (
                              <div className="space-y-1">
                                {recs.slice(0, 2).map((cand, idx) => (
                                  <div
                                    key={cand.id || idx}
                                    className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] flex items-center justify-between"
                                  >
                                    <div className="truncate mr-1 font-medium text-emerald-950 dark:text-emerald-200">
                                      #{idx + 1} {cand.name}
                                    </div>
                                    <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 shrink-0">
                                      {cand.score}% Cocok
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                Smart Engine siap memetakan
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {s.substitute_name ? (
                              <div className="p-1.5 bg-primary/10 border border-primary/20 rounded-lg">
                                <div className="font-semibold text-primary text-[11px]">
                                  {s.substitute_name}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  NIP: {s.substitute_nip || '-'} • {s.substitute_division || '-'}
                                </div>
                              </div>
                            ) : s.danru_recommended_name ? (
                              <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px]">
                                <div className="text-muted-foreground font-medium">Usulan Danru:</div>
                                <div className="font-semibold text-blue-900 dark:text-blue-300">
                                  {s.danru_recommended_name}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Belum ditetapkan
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isApproved ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Disetujui Resmi Korlap
                              </Badge>
                            ) : isPendingKorlap ? (
                              <Badge className="bg-sky-600 text-white text-[10px]">
                                Usulan Danru ➔ Menunggu Korlap
                              </Badge>
                            ) : isRejected ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Ditolak
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500 text-white text-[10px]">
                                Menunggu Rekomendasi Danru
                              </Badge>
                            )}

                            {s.danru_notes && (
                              <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[140px]" title={s.danru_notes}>
                                💬 Danru: "{s.danru_notes}"
                              </div>
                            )}
                            {s.korlap_notes && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]" title={s.korlap_notes}>
                                📝 Korlap: "{s.korlap_notes}"
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {isKorlap ? (
                              /* KORLAP / SUPERADMIN: Exclusive Decision Authority */
                              !isApproved && !isRejected ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenKorlapModal(s, 'approved')}
                                  className="h-8 text-xs font-semibold px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5"
                                  title="Tetapkan Pengganti & Putuskan Pengajuan"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Tetapkan Pengganti</span>
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Selesai (Korlap)
                                </Badge>
                              )
                            ) : isDanru ? (
                              /* DANRU: Recommendation Authority */
                              isPendingDanru ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenDanruModal(s)}
                                  className="h-8 text-xs font-semibold px-2.5 border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 rounded-lg gap-1.5"
                                  title="Rekomendasikan Kandidat ke Korlap"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Beri Rekomendasi</span>
                                </Button>
                              ) : isPendingKorlap ? (
                                <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30 bg-blue-500/10">
                                  Terkirim ke Korlap
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Selesai
                                </Badge>
                              )
                            ) : (
                              /* ADMIN / KEUANGAN / PIMPINAN: Audit & Monitoring Only */
                              <div className="flex flex-col items-end">
                                <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground border-border">
                                  Kewenangan: Korlap
                                </Badge>
                                <span className="text-[9px] text-muted-foreground mt-0.5">
                                  Monitoring & Rekap
                                </span>
                              </div>
                            )}
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
      ) : (
        /* ─── REKAP KINERJA TIM LAPANGAN & BERKAS REALTIME (KORLAP, ADMIN, K3) ─── */
        <div className="space-y-6">
          {/* Header Penjelasan Pengawasan Lapangan */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Portal Pengawas: Korlap, Admin & K3</span>
              </div>
              <h2 className="text-base font-bold text-foreground">
                Rekapan Kinerja, Kehadiran, Mangkir & Lembur Tim Lapangan
              </h2>
              <p className="text-xs text-muted-foreground">
                Monitoring menyeluruh progres kedisiplinan dan kepatuhan jam kerja per individu karyawan ({fieldRecapPeriod === 'last_month' ? 'Bulan Lalu' : fieldRecapPeriod === 'year' ? 'Akumulasi Tahunan' : 'Bulan Berjalan Live'}).
              </p>
            </div>

            {/* Filter Toolbar untuk Rekap Lapangan */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-muted/60 p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setFieldRecapPeriod('current_month')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    fieldRecapPeriod === 'current_month'
                      ? 'bg-card text-foreground shadow-xs font-bold border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bulan Berjalan
                </button>
                <button
                  type="button"
                  onClick={() => setFieldRecapPeriod('last_month')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    fieldRecapPeriod === 'last_month'
                      ? 'bg-card text-foreground shadow-xs font-bold border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bulan Lalu
                </button>
                <button
                  type="button"
                  onClick={() => setFieldRecapPeriod('year')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    fieldRecapPeriod === 'year'
                      ? 'bg-card text-foreground shadow-xs font-bold border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Tahunan (YTD)
                </button>
              </div>

              <Select value={fieldRecapDivision} onValueChange={setFieldRecapDivision}>
                <SelectTrigger className="h-9 text-xs rounded-xl w-[150px]">
                  <SelectValue placeholder="Semua Divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI Summary Cards Lapangan */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3 bg-card border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Personil</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {fieldRecapData?.summary?.totalEmployees ?? users.length} <span className="text-xs font-normal text-muted-foreground">Staf</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Aktif di sistem</p>
            </Card>

            <Card className="p-3 bg-card border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tepat Waktu</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">
                {fieldRecapData?.summary?.totalTepatWaktu ?? 0} <span className="text-xs font-normal text-muted-foreground">Sesi</span>
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                dari {fieldRecapData?.summary?.totalHadir ?? 0} Hadir
              </p>
            </Card>

            <Card className="p-3 bg-card border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Terlambat</p>
              <p className="text-xl font-bold text-amber-600 mt-1">
                {fieldRecapData?.summary?.totalTerlambat ?? 0} <span className="text-xs font-normal text-muted-foreground">Kali</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Pelanggaran jam</p>
            </Card>

            <Card className="p-3 bg-card border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Mangkir / Alpa</p>
              <p className="text-xl font-bold text-rose-600 mt-1">
                {fieldRecapData?.summary?.totalMangkir ?? 0} <span className="text-xs font-normal text-muted-foreground">Hari</span>
              </p>
              <p className="text-[10px] text-rose-500 font-semibold mt-0.5">Tanpa izin sah</p>
            </Card>

            <Card className="p-3 bg-card border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Cuti & Sakit</p>
              <p className="text-xl font-bold text-sky-600 mt-1">
                {(fieldRecapData?.summary?.totalCuti ?? 0) + (fieldRecapData?.summary?.totalSakit ?? 0)} <span className="text-xs font-normal text-muted-foreground">Hari</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {fieldRecapData?.summary?.totalCuti ?? 0} Cuti / {fieldRecapData?.summary?.totalSakit ?? 0} Sakit
              </p>
            </Card>

            <Card className="p-3 bg-card border-border rounded-xl">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Lembur (SPL)</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {fieldRecapData?.summary?.totalLemburHours ?? 0} <span className="text-xs font-normal text-muted-foreground">Jam</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Disetujui sah</p>
            </Card>
          </div>

          {/* Search Toolbar Roster Lapangan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari personil lapangan berdasarkan Nama, NIP, atau Divisi..."
                value={fieldRecapSearch}
                onChange={(e) => setFieldRecapSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Menampilkan {fieldRecapData?.roster?.filter((r) => !fieldRecapSearch || r.full_name?.toLowerCase().includes(fieldRecapSearch.toLowerCase()) || r.nip?.toLowerCase().includes(fieldRecapSearch.toLowerCase())).length ?? 0} personil
            </div>
          </div>

          {/* TABEL ROSTER KINERJA PERSONIL LAPANGAN */}
          <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="p-3.5 bg-muted/30 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Roster Rekapan Kinerja Individu Lapangan ({fieldRecapPeriod === 'last_month' ? 'Bulan Lalu' : fieldRecapPeriod === 'year' ? 'Tahunan' : 'Bulan Berjalan'})
              </span>
              {loadingFieldRecap && (
                <span className="text-[11px] text-muted-foreground animate-pulse">
                  Sinkronisasi database live...
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Personil</th>
                    <th className="py-3 px-4">Divisi & Peran</th>
                    <th className="py-3 px-4">Kehadiran</th>
                    <th className="py-3 px-4">Keterlambatan</th>
                    <th className="py-3 px-4">Mangkir (Alpa)</th>
                    <th className="py-3 px-4">Cuti / Sakit</th>
                    <th className="py-3 px-4">Lembur (SPL)</th>
                    <th className="py-3 px-4 text-right">Indeks Disiplin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingFieldRecap && !fieldRecapData ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Memuat data rekapan kinerja lapangan...
                      </td>
                    </tr>
                  ) : (fieldRecapData?.roster || []).filter((r) =>
                      !fieldRecapSearch ||
                      r.full_name?.toLowerCase().includes(fieldRecapSearch.toLowerCase()) ||
                      r.nip?.toLowerCase().includes(fieldRecapSearch.toLowerCase()) ||
                      r.division_name?.toLowerCase().includes(fieldRecapSearch.toLowerCase())
                    ).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Tidak ada data kinerja personil yang cocok dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    (fieldRecapData?.roster || [])
                      .filter((r) =>
                        !fieldRecapSearch ||
                        r.full_name?.toLowerCase().includes(fieldRecapSearch.toLowerCase()) ||
                        r.nip?.toLowerCase().includes(fieldRecapSearch.toLowerCase()) ||
                        r.division_name?.toLowerCase().includes(fieldRecapSearch.toLowerCase())
                      )
                      .map((row) => {
                        const totalHadir = Number(row.total_hadir || 0);
                        const tepatWaktu = Number(row.tepat_waktu || 0);
                        const terlambat = Number(row.total_terlambat || 0);
                        const mangkir = Number(row.total_mangkir || 0);
                        const cuti = Number(row.total_cuti || 0);
                        const sakit = Number(row.total_sakit || 0);
                        const lemburJam = Number(row.total_lembur_hours || 0);
                        const lemburComp = Number(row.total_lembur_comp || 0);

                        const punctualityRate = totalHadir > 0 ? Math.round((tepatWaktu / totalHadir) * 100) : 100;

                        return (
                          <tr key={row.user_id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-foreground">{row.full_name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{row.nip}</p>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-medium text-foreground">{row.division_name || 'Umum'}</span>
                              <span className="text-[10px] text-muted-foreground block capitalize">{row.role_name || 'Karyawan'}</span>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px]">
                              <span className="font-semibold text-emerald-600">{tepatWaktu} Tepat</span>
                              <span className="text-muted-foreground block text-[10px]">dari {totalHadir} hadir</span>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px]">
                              {terlambat > 0 ? (
                                <div>
                                  <span className="font-semibold text-amber-600">{terlambat} Kali</span>
                                  <span className="text-[10px] text-muted-foreground block">({row.total_late_minutes || 0} mnt)</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">0 Kali</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {mangkir > 0 ? (
                                <Badge variant="destructive" className="text-[10px] font-bold">
                                  {mangkir} Hari Alpa
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">Nihil</span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px]">
                              <span className="text-foreground">{cuti} Cuti</span>
                              <span className="text-muted-foreground block text-[10px]">{sakit} Sakit</span>
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px]">
                              {lemburJam > 0 ? (
                                <div>
                                  <span className="font-semibold text-blue-600">{lemburJam} Jam</span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    Rp {lemburComp.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">0 Jam</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {mangkir > 2 ? (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                                  Perlu Pembinaan
                                </Badge>
                              ) : punctualityRate >= 90 ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                  {punctualityRate}% Prima
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                                  {punctualityRate}% Waspada
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Sub-section: Audit Trail Log Pengajuan Berkas Cuti & SPL */}
          <div className="pt-4 border-t border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Audit Trail Berkas Pengajuan Cuti, Izin & SPL Lembur
                </h3>
                <p className="text-xs text-muted-foreground">
                  Riwayat rinci verifikasi dokumen permohonan individual yang diajukan staf.
                </p>
              </div>

              {/* Filter Log Berkas */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={recapTypeFilter} onValueChange={setRecapTypeFilter}>
                  <SelectTrigger className="h-8 text-xs rounded-xl w-[140px]">
                    <SelectValue placeholder="Jenis Pengajuan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Jenis</SelectItem>
                    <SelectItem value="annual_leave">🏖️ Cuti Tahunan</SelectItem>
                    <SelectItem value="sick_leave">🏥 Izin Sakit</SelectItem>
                    <SelectItem value="emergency_leave">🚨 Izin Darurat</SelectItem>
                    <SelectItem value="unpaid_leave">📋 Izin Khusus/Dinas</SelectItem>
                    <SelectItem value="overtime">⏱️ Lembur (SPL)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={recapStatusFilter} onValueChange={setRecapStatusFilter}>
                  <SelectTrigger className="h-8 text-xs rounded-xl w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="pending">⏳ Menunggu</SelectItem>
                    <SelectItem value="approved">✅ Disetujui</SelectItem>
                    <SelectItem value="rejected">❌ Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          {/* Table Data Rekap Realtime */}
          <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Karyawan & Pos</th>
                    <th className="py-3 px-4">Jenis Pengajuan</th>
                    <th className="py-3 px-4">Tanggal & Durasi</th>
                    <th className="py-3 px-4">Uraian / Alasan</th>
                    <th className="py-3 px-4">Bukti Lampiran</th>
                    <th className="py-3 px-4">Status & Approval</th>
                    <th className="py-3 px-4 text-right">Tindakan Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {consolidatedRecapList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Tidak ada data rekap pengajuan yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    consolidatedRecapList.map((item) => (
                      <tr key={`${item.kind}-${item.id}`} className="hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-foreground">{item.userName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {item.userNip} • {item.divisionName || 'Operasional'}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`text-[10.5px] font-bold ${
                              item.kind === 'overtime'
                                ? 'border-blue-500/30 text-blue-700 bg-blue-50 dark:bg-blue-950/40'
                                : item.type === 'emergency_leave' || item.type === 'izin_darurat'
                                ? 'border-rose-500/30 text-rose-700 bg-rose-50 dark:bg-rose-950/40'
                                : item.type === 'sick_leave'
                                ? 'border-amber-500/30 text-amber-700 bg-amber-50 dark:bg-amber-950/40'
                                : 'border-emerald-500/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
                            }`}
                          >
                            {item.typeLabel}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px]">
                          <p className="text-foreground font-medium">{item.dateLabel}</p>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <p className="line-clamp-2 italic text-muted-foreground text-[11px]">
                            "{item.reason}"
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          {item.attachmentUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(item.attachmentUrl!)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold transition-colors"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Lihat Foto</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Tidak ada foto</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            <Badge
                              variant="outline"
                              className={
                                item.status === 'approved'
                                  ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold'
                                  : item.status === 'rejected'
                                  ? 'border-rose-500/30 text-rose-600 bg-rose-50 dark:bg-rose-950/40 text-[10px] font-bold'
                                  : 'border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold'
                              }
                            >
                              {item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu Approval'}
                            </Badge>
                            {item.approvedByName && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Oleh: {item.approvedByName}</p>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {item.status === 'pending' && canApprove ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {item.kind === 'leave' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenLeaveDecision(item.rawItem as LeaveRequest, 'approved')}
                                    className="h-7 px-2 text-[10.5px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                  >
                                    Setujui
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenLeaveDecision(item.rawItem as LeaveRequest, 'rejected')}
                                    className="h-7 px-2 text-[10.5px] rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
                                  >
                                    Tolak
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenOtProcess(item.rawItem as OvertimeRecord, 'approved')}
                                    className="h-7 px-2 text-[10.5px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                  >
                                    Setujui
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenOtProcess(item.rawItem as OvertimeRecord, 'rejected')}
                                    className="h-7 px-2 text-[10.5px] rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
                                  >
                                    Tolak
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
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
      </div>
      )}

      {/* Leave Decision Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decision === 'approved' ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              {decision === 'approved' ? 'Persetujuan Permohonan Cuti' : 'Penolakan Permohonan Cuti'}
            </DialogTitle>
            <DialogDescription>
              {selectedLeave?.userName} ({selectedLeave?.userNip}) — {selectedLeave?.leaveType.replace('_', ' ')} ({selectedLeave?.totalDays} Hari)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-2">
            {/* Reason */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border text-xs space-y-1">
              <p className="text-muted-foreground">Alasan Karyawan:</p>
              <p className="font-medium text-foreground italic">"{selectedLeave?.reason}"</p>
            </div>

            {/* 1-Year Leave History Summary & Quota Status */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarCheck2 className="w-4 h-4 text-primary" />
                  Rekap Hak & Riwayat Cuti 1 Tahun
                </span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  Kuota: {applicantQuotaInfo.totalQuota} Hari (12+2)
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded-lg bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">Total Hak</span>
                  <span className="font-bold text-xs text-foreground font-mono">{applicantQuotaInfo.totalQuota} Hari</span>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">Terpakai</span>
                  <span className="font-bold text-xs text-amber-600 font-mono">{applicantQuotaInfo.usedDays} Hari</span>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">Sisa Hak Cuti</span>
                  <span className="font-bold text-xs text-emerald-600 font-mono">{applicantQuotaInfo.remaining} Hari</span>
                </div>
              </div>

              {applicantHistoryLeaves.length > 0 ? (
                <div className="pt-2 border-t border-border">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">
                    {applicantHistoryLeaves.length} Catatan pengajuan dalam setahun terakhir:
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {applicantHistoryLeaves.map((hist) => (
                      <div key={hist.id} className="flex items-center justify-between text-[10px] bg-background/80 p-1.5 rounded-lg border border-border">
                        <span className="font-mono text-muted-foreground">{hist.startDate} - {hist.endDate} ({hist.totalDays}h)</span>
                        <span className="capitalize font-medium text-foreground">{hist.leaveType.replace('_', ' ')}</span>
                        <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${
                          hist.status === 'approved' ? 'text-primary border-primary/30' : hist.status === 'rejected' ? 'text-destructive border-destructive/30' : 'text-muted-foreground'
                        }`}>
                          {hist.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic pt-1">
                  Belum ada riwayat pengajuan cuti lain dalam 1 tahun terakhir.
                </p>
              )}
            </div>

            {/* Smart Division-based Substitute Recommendation (Mandatory Anti-Kekosongan Pos) */}
            {decision === 'approved' && (
              <div className="space-y-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Pilih Karyawan Pengganti Pos (Divisi {selectedLeave?.divisionName})</span>
                  </Label>
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px]">
                    Wajib Ada Pengganti
                  </Badge>
                </div>
                <p className="text-[11px] text-blue-900/80 dark:text-blue-300">
                  Untuk menjaga operasional pos tetap berjalan tanpa kekosongan, tentukan rekan kerja dari divisi <strong>{selectedLeave?.divisionName}</strong> untuk menggantikan tugas selama periode cuti:
                </p>

                <Select value={selectedSubstituteId} onValueChange={setSelectedSubstituteId}>
                  <SelectTrigger className="text-xs rounded-xl h-9 bg-background">
                    <SelectValue placeholder="Pilih Rekan Pengganti..." />
                  </SelectTrigger>
                  <SelectContent>
                    {substituteCandidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} ({c.nip}) — Divisi {c.divisionName || 'Operasional'} (Cuti terpakai: {c.usedLeaveDays || 0} hari)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSubstituteId && (
                  <div className="text-[10px] text-blue-950 dark:text-blue-200 bg-blue-500/15 p-2 rounded-lg">
                    ✨ Karyawan terpilih akan otomatis menerima <strong>notifikasi surat penugasan dinas pengganti</strong> dan nama karyawan pengganti tercantum pada bukti persetujuan pemohon.
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan dari Approver</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan catatan konfirmasi atau alasan penolakan..."
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              onClick={handleConfirmDecision}
              className={decision === 'approved' ? 'bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl'}
            >
              Konfirmasi {decision === 'approved' ? 'Setujui Pengajuan' : 'Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overtime Decision Dialog */}
      <Dialog open={otModalOpen} onOpenChange={setOtModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {otDecision === 'approved' ? (
                <Coins className="w-5 h-5 text-primary" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
              {otDecision === 'approved' ? 'Persetujuan Surat Perintah Lembur' : 'Penolakan Pengajuan Lembur'}
            </DialogTitle>
            <DialogDescription>
              {selectedOvertime?.userName} ({selectedOvertime?.userNip}) • {selectedOvertime?.divisionName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tanggal & Jam:</span>
                <span className="font-mono font-medium text-foreground">{selectedOvertime?.date} ({selectedOvertime?.startTime} - {selectedOvertime?.endTime})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Durasi Lembur:</span>
                <span className="font-mono font-bold text-foreground">{selectedOvertime?.durationHours} Jam ({selectedOvertime?.durationMinutes} Menit)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimasi Uang Lembur:</span>
                <span className="font-mono font-bold text-primary text-sm">Rp {Number(selectedOvertime?.totalPay ?? selectedOvertime?.compensationAmount ?? 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="pt-2 border-t border-border space-y-1">
                <span className="text-muted-foreground">Uraian Tugas:</span>
                <p className="font-medium text-foreground italic">"{selectedOvertime?.taskDescription}"</p>
              </div>
            </div>

            {otDecision === 'approved' && (
              <div className="space-y-1.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Jumlah Jam Lembur yang Disetujui (Approved Hours)</span>
                  <span className="text-primary font-mono font-bold">{otApprovedHours} Jam</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={otApprovedHours}
                    onChange={(e) => setOtApprovedHours(Number(e.target.value))}
                    className="font-mono text-xs rounded-xl h-9"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Jam</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Diajukan oleh karyawan: {selectedOvertime?.requestedHours || selectedOvertime?.durationHours} Jam. Admin berhak menentukan batas jam lembur resmi yang disetujui.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan dari Approver</Label>
              <Textarea
                rows={3}
                value={otNotes}
                onChange={(e) => setOtNotes(e.target.value)}
                placeholder="Tuliskan catatan arahan persetujuan atau alasan penolakan..."
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOtModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              onClick={handleConfirmOtDecision}
              className={otDecision === 'approved' ? 'bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl'}
            >
              Konfirmasi {otDecision === 'approved' ? `Setujui (${otApprovedHours} Jam)` : 'Tolak Lembur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIRECT OVERTIME MANDATE MODAL (SPL MANDAT ADMIN) ─── */}
      <Dialog open={directOtModalOpen} onOpenChange={setDirectOtModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Briefcase className="w-5 h-5 text-primary" />
                Mandat Lembur Langsung (SPL)
              </DialogTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                Surat Perintah Lembur
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Tugaskan karyawan untuk lembur secara langsung dengan menetapkan jumlah jam dan uraian tugas resmi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Select Employee */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Pilih Karyawan Ditugaskan <span className="text-rose-500">*</span>
              </Label>
              <Select value={directUserId} onValueChange={setDirectUserId}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="Pilih Karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName} ({u.nip}) — Divisi {u.divisionName || 'Umum'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Approved Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Tanggal Lembur
                </Label>
                <DatePicker
                  value={directDate}
                  onChange={(v) => setDirectDate(v)}
                  placeholder="Tanggal lembur"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Jumlah Jam Lembur <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="8"
                    value={directHours}
                    onChange={(e) => setDirectHours(Number(e.target.value))}
                    className="text-xs rounded-xl h-9 font-mono"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">Jam</span>
                </div>
              </div>
            </div>

            {/* Task Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Uraian Tugas / Instruksi Lembur <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                placeholder="Contoh: Menyelesaikan rekapitulasi audit keuangan atau perbaikan jaringan server malam hari..."
                value={directReason}
                onChange={(e) => setDirectReason(e.target.value)}
                className="text-xs rounded-xl min-h-[75px]"
              />
            </div>

            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-950 dark:text-blue-200">
              💡 Karyawan akan menerima notifikasi penugasan lembur langsung di dasbor mereka, dan hak kepulangan lembur mereka akan dibuka otomatis.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDirectOtModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmDirectOvertime}
              disabled={submittingDirectOt || !directUserId || !directReason.trim()}
              className="rounded-xl text-xs font-semibold h-9 gap-1.5"
            >
              {submittingDirectOt ? 'Memproses...' : 'Keluarkan Mandat Lembur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4 text-primary" />
              Bukti Lampiran Dokumen Permohonan
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 max-h-[70vh] overflow-auto">
            {previewAttachment && (
              <img
                src={previewAttachment}
                alt="Bukti Lampiran"
                className="max-h-[60vh] max-w-full rounded-xl object-contain border border-border shadow-sm"
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewAttachment(null)} className="rounded-xl">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Danru Recommendation Dialog */}
      <Dialog open={danruModalOpen} onOpenChange={setDanruModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Rekomendasi Kandidat Pengganti ke Korlap
            </DialogTitle>
            <DialogDescription className="text-xs">
              Kepala Regu (Danru) meninjau dan memilih kandidat terbaik dari rekomendasi cerdas sistem untuk diajukan ke Koordinator Lapangan (Korlap).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Applicant Summary */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Karyawan Pemohon:</span>
                <span className="font-semibold text-foreground">
                  {selectedSwapForDanru?.requester_name} ({selectedSwapForDanru?.requester_nip})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jadwal & Shift Pos:</span>
                <span className="font-mono font-medium text-foreground">
                  {selectedSwapForDanru?.swap_date ? selectedSwapForDanru.swap_date.split('T')[0] : ''} • Shift {selectedSwapForDanru?.original_shift}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alasan:</span>
                <span className="text-foreground italic">{selectedSwapForDanru?.reason}</span>
              </div>
            </div>

            {/* Smart Candidates Engine Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Rekomendasi Cerdas Sistem (AI Smart Matching)
                </Label>
                {loadingCandidates && (
                  <span className="text-[10px] text-muted-foreground animate-pulse">
                    Menganalisis jadwal karyawan...
                  </span>
                )}
              </div>

              {smartCandidates.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {smartCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      onClick={() => setDanruRecommendedSubstituteId(cand.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        danruRecommendedSubstituteId === cand.id
                          ? 'bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/40 shadow-sm'
                          : 'bg-card border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                            <span>{cand.name}</span>
                            <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 font-bold">
                              {cand.score}% Cocok
                            </Badge>
                            {cand.placement_location && cand.placement_location !== '-' && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary font-semibold">
                                📍 {cand.placement_location}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            NIP: {cand.nip} • {cand.job_title || cand.division_name}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {danruRecommendedSubstituteId === cand.id ? (
                            <CheckCircle2 className="w-5 h-5 text-amber-600" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-muted-foreground/30" />
                          )}
                        </div>
                      </div>

                      {/* Real-time 5-box History Metrics */}
                      <div className="grid grid-cols-5 gap-1 bg-muted/40 p-1.5 rounded-lg text-center border border-border/50 text-[10px]">
                        <div className="p-1 bg-card rounded border border-border/40">
                          <span className="text-[9px] text-muted-foreground block">🌴 Cuti</span>
                          <span className="font-bold text-foreground">{cand.metrics?.cuti_days ?? 0} Hr</span>
                        </div>
                        <div className={`p-1 bg-card rounded border ${((cand.metrics?.annual_leave_quota ?? 14) - (cand.metrics?.cuti_days ?? 0)) <= 3 ? 'border-rose-400/60' : 'border-border/40'}`}>
                          <span className="text-[9px] text-muted-foreground block">📅 Sisa</span>
                          <span className={`font-bold ${((cand.metrics?.annual_leave_quota ?? 14) - (cand.metrics?.cuti_days ?? 0)) <= 3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {(cand.metrics?.annual_leave_quota ?? 14) - (cand.metrics?.cuti_days ?? 0)} Hr
                          </span>
                          <span className="text-[7px] text-muted-foreground block">/{cand.metrics?.annual_leave_quota ?? 14}</span>
                        </div>
                        <div className="p-1 bg-card rounded border border-border/40">
                          <span className="text-[9px] text-muted-foreground block">📋 Izin/Skt</span>
                          <span className="font-bold text-foreground">
                            {(cand.metrics?.izin_count ?? 0) + (cand.metrics?.sakit_count ?? 0)}x
                          </span>
                          <span className="text-[8px] text-muted-foreground block">({cand.metrics?.izin_count ?? 0}I/{cand.metrics?.sakit_count ?? 0}S)</span>
                        </div>
                        <div className="p-1 bg-card rounded border border-border/40">
                          <span className="text-[9px] text-muted-foreground block">⏱️ Lembur</span>
                          <span className="font-bold text-foreground">{cand.metrics?.ot_hours_total ?? 0}j</span>
                          <span className="text-[8px] text-muted-foreground block">(bln: {cand.metrics?.ot_hours_month ?? 0}j)</span>
                        </div>
                        <div className="p-1 bg-card rounded border border-border/40">
                          <span className="text-[9px] text-muted-foreground block">🔄 Ganti</span>
                          <span className="font-bold text-foreground">{cand.metrics?.swap_substitute_count ?? 0}x</span>
                          <span className="text-[8px] text-muted-foreground block">Pos</span>
                        </div>
                      </div>

                      {/* Reasons & Fairness Badge */}
                      <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium line-clamp-1">
                          ✓ {cand.reasons ? cand.reasons.join(' • ') : cand.reasonSummary}
                        </div>
                        {cand.fairness_badge && (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            ⚖️ {cand.fairness_badge}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !loadingCandidates ? (
                <div className="p-3 bg-muted/40 rounded-xl text-center text-muted-foreground text-xs">
                  Tidak ada rekomendasi khusus. Anda dapat memilih kandidat dari daftar karyawan di bawah.
                </div>
              ) : null}
            </div>

            {/* Candidate Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Pilih Pengganti yang Direkomendasikan <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={danruRecommendedSubstituteId}
                onValueChange={setDanruRecommendedSubstituteId}
              >
                <SelectTrigger className="text-xs rounded-xl">
                  <SelectValue placeholder="Pilih kandidat pengganti..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {users
                    .filter((u) => u.id !== selectedSwapForDanru?.requester_id)
                    .map((u) => {
                      const smartMatch = smartCandidates.find((c) => c.id === u.id);
                      return (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          {u.fullName || u.name} ({u.nip}) • {u.division || u.divisionName}
                          {smartMatch ? ` [${smartMatch.score}% Cocok]` : ''}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* Danru Review Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Catatan Kepala Regu (Danru) untuk Korlap
              </Label>
              <Textarea
                placeholder="Contoh: Karyawan telah dihubungi dan bersedia standby mengisi pos dinas pada tanggal tersebut..."
                value={danruNotes}
                onChange={(e) => setDanruNotes(e.target.value)}
                className="text-xs rounded-xl min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDanruModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmDanruRecommendation}
              disabled={submittingDanru || !danruRecommendedSubstituteId}
              className="rounded-xl text-xs font-semibold h-9 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submittingDanru ? 'Mengirim...' : 'Kirim Rekomendasi ke Korlap'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Korlap Final Approval Dialog */}
      <Dialog open={korlapModalOpen} onOpenChange={setKorlapModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Penetapan Pengganti Pos & Persetujuan Korlap
            </DialogTitle>
            <DialogDescription className="text-xs">
              Koordinator Lapangan (Korlap) adalah penentu mutlak karyawan pengganti yang mengisi kekosongan pos dinas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Applicant Summary */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Karyawan Pemohon:</span>
                <span className="font-semibold text-foreground">
                  {selectedSwapForKorlap?.requester_name} ({selectedSwapForKorlap?.requester_nip})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jadwal & Shift Pos:</span>
                <span className="font-mono font-medium text-foreground">
                  {selectedSwapForKorlap?.swap_date ? selectedSwapForKorlap.swap_date.split('T')[0] : ''} • Shift {selectedSwapForKorlap?.original_shift}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alasan:</span>
                <span className="text-foreground italic">{selectedSwapForKorlap?.reason}</span>
              </div>
            </div>

            {/* Danru Recommendation Banner (if available) */}
            {selectedSwapForKorlap?.danru_recommended_name && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1">
                <div className="text-[11px] font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Rekomendasi dari Kepala Regu ({selectedSwapForKorlap.danru_name || 'Danru'}):
                </div>
                <div className="font-bold text-foreground text-xs">
                  👉 {selectedSwapForKorlap.danru_recommended_name}
                </div>
                {selectedSwapForKorlap.danru_notes && (
                  <div className="text-[11px] text-muted-foreground italic">
                    "{selectedSwapForKorlap.danru_notes}"
                  </div>
                )}
              </div>
            )}

            {/* Decision Radio/Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Keputusan Korlap <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKorlapDecision('approved')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    korlapDecision === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Setujui & Tugaskan Pengganti
                </button>
                <button
                  type="button"
                  onClick={() => setKorlapDecision('rejected')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    korlapDecision === 'rejected'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  Tolak Pengajuan
                </button>
              </div>
            </div>

            {/* If Approved: Final Substitute Selector */}
            {korlapDecision === 'approved' && (
              <div className="space-y-2 p-3 bg-muted/20 border border-border rounded-xl">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Tetapkan Karyawan Pengganti Resmi <span className="text-rose-500">*</span>
                  </Label>
                  {smartCandidates.length > 0 && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {smartCandidates.length} Rekomendasi AI Tersedia
                    </span>
                  )}
                </div>

                <Select
                  value={korlapSubstituteId}
                  onValueChange={setKorlapSubstituteId}
                >
                  <SelectTrigger className="text-xs rounded-xl bg-card">
                    <SelectValue placeholder="Pilih pengganti resmi..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {users
                      .filter((u) => u.id !== selectedSwapForKorlap?.requester_id)
                      .map((u) => {
                        const smartMatch = smartCandidates.find((c) => c.id === u.id);
                        const isDanruChoice = u.id === selectedSwapForKorlap?.danru_substitute_id;
                        return (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.fullName || u.name} ({u.nip})
                            {isDanruChoice ? ' ★ Usulan Danru' : ''}
                            {smartMatch ? ` [${smartMatch.score}% Cocok]` : ''}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>

                {/* Quick Smart Badges for 1-click select */}
                {smartCandidates.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-muted-foreground">Kandidat Teratas:</span>
                    {smartCandidates.slice(0, 3).map((cand) => (
                      <button
                        type="button"
                        key={cand.id}
                        onClick={() => setKorlapSubstituteId(cand.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          korlapSubstituteId === cand.id
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                            : 'bg-muted/60 text-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {cand.name} ({cand.score}%)
                      </button>
                    ))}
                  </div>
                )}

                {/* Candidate History & Metrics Card Preview */}
                {(() => {
                  const activeCandidate = smartCandidates.find((c) => c.id === korlapSubstituteId);
                  if (!activeCandidate) return null;
                  const remainingCuti = (activeCandidate.metrics?.annual_leave_quota ?? 14) - (activeCandidate.metrics?.cuti_days ?? 0);
                  return (
                    <div className="mt-2 p-2.5 bg-card border border-emerald-500/40 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <span>{activeCandidate.name}</span>
                          <Badge className="bg-emerald-600 text-white text-[9px] px-1 py-0 font-bold">
                            {activeCandidate.score}% Cocok
                          </Badge>
                          {activeCandidate.placement_location && activeCandidate.placement_location !== '-' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">
                              📍 {activeCandidate.placement_location}
                            </Badge>
                          )}
                        </div>
                        {activeCandidate.fairness_badge && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            ⚖️ {activeCandidate.fairness_badge}
                          </span>
                        )}
                      </div>

                      {/* 5-Box Metrics Grid */}
                      <div className="grid grid-cols-5 gap-1 text-center text-[10px] bg-muted/40 p-1.5 rounded-lg border border-border/40">
                        <div className="bg-card p-1 rounded border border-border/30">
                          <span className="text-[8px] text-muted-foreground block">🌴 Cuti Dipakai</span>
                          <span className="font-bold text-foreground">{activeCandidate.metrics?.cuti_days ?? 0} Hari</span>
                        </div>
                        <div className={`bg-card p-1 rounded border ${remainingCuti <= 3 ? 'border-rose-400/60' : 'border-border/30'}`}>
                          <span className="text-[8px] text-muted-foreground block">📅 Sisa Kuota</span>
                          <span className={`font-bold ${remainingCuti <= 3 ? 'text-rose-600' : 'text-emerald-600'}`}>{remainingCuti} Hari</span>
                          <span className="text-[7px] text-muted-foreground block">dari {activeCandidate.metrics?.annual_leave_quota ?? 14}</span>
                        </div>
                        <div className="bg-card p-1 rounded border border-border/30">
                          <span className="text-[8px] text-muted-foreground block">📋 Izin/Sakit</span>
                          <span className="font-bold text-foreground">
                            {(activeCandidate.metrics?.izin_count ?? 0) + (activeCandidate.metrics?.sakit_count ?? 0)}x
                          </span>
                        </div>
                        <div className="bg-card p-1 rounded border border-border/30">
                          <span className="text-[8px] text-muted-foreground block">⏱️ Lembur</span>
                          <span className="font-bold text-foreground">{activeCandidate.metrics?.ot_hours_total ?? 0}j</span>
                          <span className="text-[7px] text-muted-foreground block">({activeCandidate.metrics?.ot_hours_month ?? 0}j bln ini)</span>
                        </div>
                        <div className="bg-card p-1 rounded border border-border/30">
                          <span className="text-[8px] text-muted-foreground block">🔄 Pengganti</span>
                          <span className="font-bold text-foreground">{activeCandidate.metrics?.swap_substitute_count ?? 0}x</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground flex justify-between items-center">
                        <span>Jabatan: {activeCandidate.job_title || activeCandidate.division_name}</span>
                        <span className="font-mono text-emerald-600 font-semibold">
                          Tarif Lembur: Rp {activeCandidate.hourly_overtime_rate?.toLocaleString('id-ID')}/jam
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Korlap Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Catatan / Instruksi Korlap
              </Label>
              <Textarea
                placeholder="Contoh: Pengganti wajib hadir 15 menit sebelum serah terima buku mutasi pos..."
                value={korlapNotes}
                onChange={(e) => setKorlapNotes(e.target.value)}
                className="text-xs rounded-xl min-h-[65px]"
              />
            </div>

            {/* Notification Automation Notice */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 text-[11px] text-emerald-950 dark:text-emerald-200">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-600" />
                Notifikasi Otomatis Terdistribusi:
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
                <li>Karyawan pemohon menerima kabar persetujuan beserta rincian nama karyawan pengganti.</li>
                <li>Karyawan pengganti otomatis menerima penugasan resmi untuk mengisi kekosongan pos dinas.</li>
                <li>Danru, Admin, Keuangan, dan Pimpinan otomatis menerima laporan rekapitulasi status dinas.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setKorlapModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmKorlapDecision}
              disabled={submittingKorlap || (korlapDecision === 'approved' && !korlapSubstituteId)}
              className={`rounded-xl text-xs font-semibold h-9 gap-1.5 ${
                korlapDecision === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {submittingKorlap
                ? 'Memproses...'
                : korlapDecision === 'approved'
                ? 'Tetapkan Pengganti & Setujui'
                : 'Konfirmasi Tolak Pengajuan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
