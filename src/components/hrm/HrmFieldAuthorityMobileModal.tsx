import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Coins,
  CalendarCheck2,
  Users,
  Search,
  ExternalLink,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  UserCheck,
  PhoneCall,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { hrmService } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { LeaveRequest, OvertimeRecord, UserProfile, isOfficialFrEmployee } from '@/types/hrm';
import { toast } from 'sonner';

interface HrmFieldAuthorityMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'leaves' | 'overtime' | 'recap';
  currentUser?: UserProfile | null;
}

export const HrmFieldAuthorityMobileModal: React.FC<HrmFieldAuthorityMobileModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'leaves',
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'leaves' | 'overtime' | 'recap'>(initialTab);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [teamRoster, setTeamRoster] = useState<any[]>([]);
  const [loadingRecap, setLoadingRecap] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Smart Relief Candidates per Leave Request
  const [candidatesMap, setCandidatesMap] = useState<Record<string, any[]>>({});
  const [selectedSubMap, setSelectedSubMap] = useState<Record<string, any>>({});
  const [loadingCandidates, setLoadingCandidates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }
  }, [isOpen, initialTab]);

  // Load Realtime Data directly from PostgreSQL API
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Realtime Leaves from Backend API
      const resLeaves = await api.get<{ success: boolean; data: any[] }>('/leaves');
      if (resLeaves && resLeaves.success && Array.isArray(resLeaves.data)) {
        const mappedLeaves: LeaveRequest[] = resLeaves.data
          .filter((l: any) => isOfficialFrEmployee(l.user_nip || l.userNip || ''))
          .map((l: any) => ({
            id: l.id,
            userId: l.user_id || l.userId,
            userName: l.user_name || l.userName || 'Karyawan',
            userNip: l.user_nip || l.userNip || '-',
            divisionName: l.division_name || l.divisionName || 'Operasional Lapangan',
            divisionId: l.user_division_id || l.division_id || l.divisionId,
            leaveType: l.leave_type || l.leaveType || 'annual_leave',
            startDate: typeof l.start_date === 'string' ? l.start_date.substring(0, 10) : l.startDate,
            endDate: typeof l.end_date === 'string' ? l.end_date.substring(0, 10) : l.endDate,
            totalDays: Number(l.total_days || l.totalDays || 1),
            reason: l.reason,
            status: l.status,
            substituteId: l.substitute_id || l.substituteId,
            substituteName: l.substitute_name || l.substituteName,
            substituteNip: l.substitute_nip || l.substituteNip,
            attachmentUrl: l.attachment_url || l.attachmentUrl,
            approvalNotes: l.approval_notes || l.approvalNotes,
            approvedBy: l.approved_by || l.approvedBy,
            createdAt: l.created_at || l.createdAt,
          }));
        setLeaves(mappedLeaves);

        // Auto-fetch substitute recommendations for all pending leave requests
        mappedLeaves
          .filter((l) => l.status === 'pending')
          .forEach((l) => {
            fetchCandidatesForLeave(l);
          });
      } else {
        // Fallback to local storage if offline
        const localLeaves = hrmService.getLeaves();
        setLeaves(localLeaves);
      }

      // 2. Fetch Realtime Overtimes from Backend API
      const resOvertimes = await api.get<{ success: boolean; data: any[] }>('/overtime');
      if (resOvertimes && resOvertimes.success && Array.isArray(resOvertimes.data)) {
        const mappedOvertimes: OvertimeRecord[] = resOvertimes.data
          .filter((o: any) => isOfficialFrEmployee(o.user_nip || o.userNip || ''))
          .map((o: any) => ({
            id: o.id,
            userId: o.user_id || o.userId,
            userName: o.user_name || o.userName || 'Karyawan',
            userNip: o.user_nip || o.userNip || '-',
            divisionName: o.division_name || o.divisionName || 'Operasional Lapangan',
            date: typeof o.date === 'string' ? o.date.substring(0, 10) : o.date,
            startTime: o.start_time || o.startTime,
            endTime: o.end_time || o.endTime,
            durationHours: Number(o.duration_hours || o.durationHours || 0),
            taskDescription: o.task_description || o.taskDescription,
            status: o.status,
            approvalNotes: o.approval_notes || o.approvalNotes,
            createdAt: o.created_at || o.createdAt,
          }));
        setOvertimes(mappedOvertimes);
      } else {
        const localOvertimes = hrmService.getOvertimeRecords();
        setOvertimes(localOvertimes);
      }

      // 3. Fetch Team Recap
      setLoadingRecap(true);
      const recapRes = await hrmService.getFieldRecap({ period: 'current_month' });
      if (recapRes && recapRes.success && recapRes.data?.roster) {
        setTeamRoster(recapRes.data.roster);
      }
    } catch (err) {
      console.warn('[FieldAuthorityModal Load]', err);
    } finally {
      setIsLoading(false);
      setLoadingRecap(false);
    }
  };

  // Fetch Smart Relief Recommendation for a specific leave
  const fetchCandidatesForLeave = async (leave: LeaveRequest) => {
    if (candidatesMap[leave.id] || loadingCandidates[leave.id]) return;
    setLoadingCandidates((prev) => ({ ...prev, [leave.id]: true }));
    try {
      const qs = new URLSearchParams({
        applicantId: leave.userId,
        startDate: leave.startDate,
        endDate: leave.endDate,
      });
      if (leave.divisionId) qs.set('divisionId', leave.divisionId);

      const res = await api.get<any>(`/leaves/substitute-candidates?${qs.toString()}`);
      if (res && res.success && res.data) {
        const list = res.data.allRanked || res.data.sameDivOff || [];
        setCandidatesMap((prev) => ({ ...prev, [leave.id]: list }));

        // Default: pilih kandidat prioritas 1 (Sedang Libur/OFF) secara otomatis jika belum ada pengganti
        if (!selectedSubMap[leave.id] && list.length > 0) {
          const defaultCand = list.find((c: any) => c.isOff) || list[0];
          setSelectedSubMap((prev) => ({ ...prev, [leave.id]: defaultCand }));
        }
      }
    } catch (err) {
      console.warn('[FieldAuthorityModal] Fetch candidates error:', err);
    } finally {
      setLoadingCandidates((prev) => ({ ...prev, [leave.id]: false }));
    }
  };

  // Filter leaves
  const pendingLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'pending');
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return leaves.filter((l) => {
      if (!q) return true;
      return (
        (l.userName || '').toLowerCase().includes(q) ||
        (l.userNip || '').toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q)
      );
    });
  }, [leaves, searchQuery]);

  // Filter overtimes
  const pendingOvertimes = useMemo(() => {
    return overtimes.filter((o) => o.status === 'pending');
  }, [overtimes]);

  const filteredOvertimes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return overtimes.filter((o) => {
      if (!q) return true;
      return (
        (o.userName || '').toLowerCase().includes(q) ||
        (o.userNip || '').toLowerCase().includes(q) ||
        (o.taskDescription || '').toLowerCase().includes(q)
      );
    });
  }, [overtimes, searchQuery]);

  // Handle Approve / Reject Leave with Zero Vacancy Relief Duty Enforcement
  const handleLeaveDecision = async (leave: LeaveRequest, status: 'approved' | 'rejected') => {
    const chosenSubstitute = selectedSubMap[leave.id];

    // Aturan Zero Vacancy: jika menyetujui, wajib ada personil pengganti!
    if (status === 'approved' && !chosenSubstitute && !leave.substituteName) {
      toast.error('Aturan Zero Vacancy: Pos tidak boleh kosong! Harap pilih Rekan Pengganti Pos sebelum menyetujui.', {
        duration: 4000,
      });
      return;
    }

    setProcessingId(leave.id);
    try {
      const approverName = currentUser?.fullName || 'Muh Aslam Faisal (Korlap)';
      const approverId = currentUser?.id || 'ebf10b16-ab2f-4b53-ab22-b3ffc00694db'; // Default Aslam UUID if context missing

      const subId = chosenSubstitute?.id || leave.substituteId;
      const subName = chosenSubstitute?.name || chosenSubstitute?.fullName || leave.substituteName;
      const subNip = chosenSubstitute?.nip || leave.substituteNip;

      const res = await api.put<{ success: boolean; error?: string }>(`/leaves/${leave.id}/status`, {
        status,
        approverId,
        approverName,
        notes: status === 'approved'
          ? `Disetujui sah oleh Otoritas Lapangan (${approverName}). Petugas pengganti: ${subName || '-'}`
          : `Ditolak oleh Otoritas Lapangan (${approverName})`,
        substituteId: subId,
        substituteName: subName,
        substituteNip: subNip,
      });

      if (res && res.success) {
        toast.success(
          status === 'approved'
            ? `✅ Permohonan cuti ${leave.userName} DISETUJUI! Pengganti resmi: ${subName}. Pos dinas aman & notifikasi WA terkirim.`
            : `Permohonan cuti ${leave.userName} berhasil DITOLAK.`
        );
        loadData();
      } else {
        toast.error(res?.error || 'Gagal memproses status permohonan.');
      }
    } catch (e: any) {
      toast.error('Terjadi kesalahan: ' + (e.message || 'Gagal menghubungi server'));
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Approve / Reject Overtime
  const handleOvertimeDecision = async (otId: string, status: 'approved' | 'rejected') => {
    setProcessingId(otId);
    try {
      const ot = overtimes.find((o) => o.id === otId);
      const hours = ot?.durationHours || 2;
      const approverName = currentUser?.fullName || 'Muh Aslam Faisal (Korlap)';
      const approverId = currentUser?.id || 'ebf10b16-ab2f-4b53-ab22-b3ffc00694db';

      const res = await api.put<{ success: boolean; error?: string }>(`/overtime/${otId}/status`, {
        status,
        approverId,
        approverName,
        approvedHours: hours,
        notes: status === 'approved' ? `Disetujui sah oleh Otoritas Lapangan (${approverName})` : 'Ditolak',
      });

      if (res && res.success) {
        toast.success(`Pengajuan lembur (SPL) berhasil ${status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}!`);
        loadData();
      } else {
        toast.error(res?.error || 'Gagal memproses status lembur.');
      }
    } catch (e: any) {
      toast.error('Terjadi kesalahan: ' + (e.message || 'Gagal menghubungi server'));
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full sm:max-w-xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-2xl text-slate-100 shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-white flex items-center gap-2 truncate">
                <span>Pusat Otoritas Lapangan</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PT FRP
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Persetujuan Cuti/SPL Tim & Rekapitulasi Pos Kerja
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all active:scale-95 shrink-0"
              title="Segarkan Data Realtime"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all active:scale-95 shrink-0"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="p-2 sm:px-4 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'leaves'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <CalendarCheck2 className="w-3.5 h-3.5" />
            <span>Cuti / Izin</span>
            {pendingLeaves.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {pendingLeaves.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overtime')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'overtime'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Lembur SPL</span>
            {pendingOvertimes.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                {pendingOvertimes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'recap'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Rekap Tim</span>
          </button>
        </div>

        {/* Search Bar for Cuti / Lembur / Rekap */}
        <div className="p-3 bg-slate-900 border-b border-slate-800/60 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan, NIP, atau alasan..."
              className="pl-8 h-8 text-xs bg-slate-950/80 border-slate-800 text-slate-100 rounded-xl"
            />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          
          {/* TAB 1: CUTI & IZIN */}
          {activeTab === 'leaves' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Daftar Permohonan ({filteredLeaves.length})</span>
                <span className="text-emerald-400 font-bold">{pendingLeaves.length} Menunggu Persetujuan</span>
              </div>

              {filteredLeaves.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60 space-y-2">
                  <CalendarCheck2 className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">Tidak ada permohonan cuti atau izin aktif.</p>
                </div>
              ) : (
                filteredLeaves.map((leave) => {
                  const isPending = leave.status === 'pending';
                  const isApproved = leave.status === 'approved';
                  const candidates = candidatesMap[leave.id] || [];
                  const selectedCandidate = selectedSubMap[leave.id];
                  const isLoadingCands = loadingCandidates[leave.id];

                  return (
                    <div
                      key={leave.id}
                      className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3 shadow-md transition-all hover:border-slate-700"
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                            <span>{leave.userName || 'Karyawan'}</span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              {leave.userNip || '-'}
                            </span>
                          </p>
                          <p className="text-[10.5px] text-slate-400 mt-0.5">
                            <span className="font-semibold text-slate-300">{leave.divisionName || 'Operasional Lapangan'}</span> • {leave.startDate} s/d {leave.endDate} ({leave.totalDays || 1} Hari)
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9.5px] font-extrabold uppercase tracking-wider ${
                            isPending
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              : isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {leave.status}
                        </Badge>
                      </div>

                      {/* Alasan Cuti */}
                      <div className="p-2.5 bg-slate-900/90 rounded-xl text-[11px] text-slate-300 border border-slate-800/80">
                        <span className="text-slate-400 font-semibold block text-[10px] mb-0.5">Alasan Permohonan:</span>
                        <p className="font-medium text-slate-200">{leave.reason || 'Tidak ada keterangan tambahan.'}</p>
                      </div>

                      {/* Jika sudah disetujui dan ada pengganti */}
                      {isApproved && (leave.substituteName || selectedCandidate?.name) && (
                        <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[10.5px] text-emerald-300 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Petugas Pengganti Pos Resmi: <strong>{leave.substituteName || selectedCandidate?.name}</strong></span>
                        </div>
                      )}

                      {/* ─── FITUR CERDAS: REKOMENDASI PENGGANTI POS (ZERO VACANCY ENFORCEMENT) ─── */}
                      {isPending && (
                        <div className="p-2.5 bg-slate-900/95 rounded-xl border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>REKOMENDASI PENGGANTI POS (HUKUM ZERO VACANCY)</span>
                            </span>
                            {isLoadingCands && (
                              <span className="text-[9.5px] text-slate-400 animate-pulse flex items-center gap-1">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-400" /> Mencari...
                              </span>
                            )}
                          </div>

                          {candidates.length > 0 ? (
                            <div className="space-y-1.5">
                              <label className="text-[9.5px] text-slate-400 block font-medium">
                                Pilih rekan kerja untuk mengisi pos tugas agar tidak kosong:
                              </label>
                              <select
                                value={selectedCandidate?.id || ''}
                                onChange={(e) => {
                                  const found = candidates.find((c) => c.id === e.target.value);
                                  if (found) {
                                    setSelectedSubMap((prev) => ({ ...prev, [leave.id]: found }));
                                  }
                                }}
                                className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              >
                                {candidates.map((cand) => (
                                  <option key={cand.id} value={cand.id}>
                                    ⭐ {cand.name} ({cand.nip}) — {cand.categoryTitle || (cand.isOff ? 'Sedang Libur/OFF' : cand.shiftName)} (Skor: {cand.score}%)
                                  </option>
                                ))}
                              </select>

                              {/* Selected Candidate Info & WhatsApp Action */}
                              {selectedCandidate && (
                                <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-2 mt-1">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-white truncate">
                                      {selectedCandidate.name} ({selectedCandidate.nip})
                                    </p>
                                    <p className="text-[9.5px] text-emerald-300 truncate">
                                      {selectedCandidate.categoryTitle || 'Kandidat Terbaik (OFF)'} • Pos dinas aman terisi
                                    </p>
                                  </div>
                                  {selectedCandidate.phone && (
                                    <a
                                      href={
                                        selectedCandidate.waConfirmUrl ||
                                        `https://wa.me/${selectedCandidate.phone.replace(/^0/, '62')}?text=${encodeURIComponent(
                                          `Halo Rekan *${selectedCandidate.name}*, kami dari Tim Korlap PT FRP.\n\n` +
                                            `Rekan kerja Anda *${leave.userName}* mengajukan cuti tgl *${leave.startDate}* s/d *${leave.endDate}*.\n` +
                                            `Sesuai aturan *Zero Vacancy*, pos dinas tidak boleh kosong.\n\n` +
                                            `Apakah Anda bersedia bertugas sebagai *Petugas Pengganti Pos Resmi* pada tanggal tersebut? Tugas ini resmi dihitung lembur penuh (SPKL).\n` +
                                            `Mohon konfirmasinya. Terima kasih.`
                                        )}`
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                                      title="Tanya kesiapan via WhatsApp"
                                    >
                                      <PhoneCall className="w-2.5 h-2.5" />
                                      <span>Tanya WA</span>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : isLoadingCands ? (
                            <p className="text-[10px] text-slate-400 py-1">
                              Sedang mencocokkan jadwal rekan kerja yang sedang libur/OFF...
                            </p>
                          ) : (
                            <div className="text-[10px] text-amber-300/90 py-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Belum terdeteksi rekan 1 divisi yang OFF. Menampilkan opsi rotasi tugas.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={processingId === leave.id}
                            onClick={() => handleLeaveDecision(leave, 'approved')}
                            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Setujui &amp; Tetapkan Pengganti</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === leave.id}
                            onClick={() => handleLeaveDecision(leave, 'rejected')}
                            className="h-9 px-3 border-rose-500/40 hover:bg-rose-500/20 text-rose-300 font-bold text-xs rounded-xl"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-400" />
                            <span>Tolak</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: LEMBUR (SPL) */}
          {activeTab === 'overtime' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Daftar Pengajuan Lembur ({filteredOvertimes.length})</span>
                <span className="text-amber-400 font-bold">{pendingOvertimes.length} Menunggu Persetujuan</span>
              </div>

              {filteredOvertimes.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60 space-y-2">
                  <Coins className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">Tidak ada pengajuan lembur yang diajukan.</p>
                </div>
              ) : (
                filteredOvertimes.map((ot) => {
                  const isPending = ot.status === 'pending';
                  const isApproved = ot.status === 'approved';
                  return (
                    <div
                      key={ot.id}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-xs text-white flex items-center gap-1.5">
                            <span>{ot.userName || 'Karyawan'}</span>
                            <span className="text-[10px] font-mono text-slate-400">({ot.userNip || '-'})</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Tanggal: {ot.date} • Durasi: <span className="text-amber-300 font-bold">{ot.durationHours} Jam</span>
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9.5px] font-bold uppercase tracking-wider ${
                            isPending
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {ot.status}
                        </Badge>
                      </div>

                      <div className="p-2 bg-slate-900/80 rounded-xl text-[11px] text-slate-300 border border-slate-800/70">
                        <span className="text-slate-400 font-semibold block text-[10px] mb-0.5">Uraian Tugas Lembur:</span>
                        {ot.taskDescription || 'Tugas operasional lapangan.'}
                      </div>

                      {/* Action Buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={processingId === ot.id}
                            onClick={() => handleOvertimeDecision(ot.id, 'approved')}
                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            <span>Setujui Sah</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === ot.id}
                            onClick={() => handleOvertimeDecision(ot.id, 'rejected')}
                            className="flex-1 h-8 border-rose-500/40 hover:bg-rose-500/20 text-rose-300 font-bold text-xs rounded-xl"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-400" />
                            <span>Tolak</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: REKAP TIM LAPANGAN */}
          {activeTab === 'recap' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Rekapitulasi Tim Bulan Berjalan</span>
                <button
                  type="button"
                  onClick={loadData}
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Segarkan</span>
                </button>
              </div>

              {loadingRecap ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Memuat data rekapan kinerja tim...
                </div>
              ) : teamRoster.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60 space-y-2">
                  <Users className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">Belum ada data rekapan kinerja tim bulan ini.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teamRoster
                    .filter((r) => {
                      const q = searchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (r.full_name || '').toLowerCase().includes(q) ||
                        (r.nip || '').toLowerCase().includes(q) ||
                        (r.division_name || '').toLowerCase().includes(q)
                      );
                    })
                    .map((member) => (
                      <div
                        key={member.id || member.nip}
                        className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-white truncate">{member.full_name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {member.nip} • {member.division_name || 'Lapangan'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-right">
                          <div className="p-1.5 px-2 bg-slate-900 rounded-xl border border-slate-800 text-[10px]">
                            <span className="text-emerald-400 font-bold">{member.total_hadir || 0}</span>
                            <span className="text-slate-500 block text-[9px]">Hadir</span>
                          </div>
                          <div className="p-1.5 px-2 bg-slate-900 rounded-xl border border-slate-800 text-[10px]">
                            <span className="text-amber-400 font-bold">{member.total_terlambat || 0}</span>
                            <span className="text-slate-500 block text-[9px]">Telat</span>
                          </div>
                          <div className="p-1.5 px-2 bg-slate-900 rounded-xl border border-slate-800 text-[10px]">
                            <span className="text-rose-400 font-bold">{member.total_mangkir || 0}</span>
                            <span className="text-slate-500 block text-[9px]">Alpa</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer with Desktop Link */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <Link
            to="/admin/approval"
            onClick={onClose}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-900"
          >
            <span>Buka Halaman Admin Lengkap</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-7 text-xs text-slate-400 hover:text-white"
          >
            Tutup
          </Button>
        </div>

      </div>
    </div>
  );
};
