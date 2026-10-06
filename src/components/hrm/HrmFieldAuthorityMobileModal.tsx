import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileCheck2,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { hrmService } from '@/services/hrmService';
import { LeaveRequest, OvertimeRecord, UserProfile } from '@/types/hrm';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadData();
    }
  }, [isOpen, initialTab]);

  const loadData = async () => {
    try {
      const allLeaves = hrmService.getLeaves();
      const allOvertimes = hrmService.getOvertimeRecords();
      setLeaves(allLeaves);
      setOvertimes(allOvertimes);

      // Muat rekap jika tab rekap aktif
      setLoadingRecap(true);
      const recapRes = await hrmService.getFieldRecap({ period: 'current_month' });
      if (recapRes && recapRes.success && recapRes.data?.roster) {
        setTeamRoster(recapRes.data.roster);
      }
    } catch (err) {
      console.warn('[FieldAuthorityModal Load]', err);
    } finally {
      setLoadingRecap(false);
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

  // Handle Approve / Reject Leave
  const handleLeaveDecision = async (leaveId: string, status: 'approved' | 'rejected') => {
    setProcessingId(leaveId);
    try {
      const res = await hrmService.updateLeaveStatus(
        leaveId,
        status,
        currentUser?.fullName || 'Petugas Pengawas',
        status === 'approved' ? 'Disetujui oleh Otoritas Lapangan' : 'Ditolak oleh Otoritas Lapangan'
      );
      if (res && res.success) {
        toast.success(`Permohonan cuti/izin berhasil ${status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}!`);
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
      const res = await hrmService.updateOvertimeStatus(
        otId,
        status,
        currentUser?.fullName || 'Petugas Pengawas',
        hours,
        status === 'approved' ? 'Disetujui sah oleh Otoritas Lapangan' : 'Ditolak'
      );
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
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all active:scale-95 shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
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
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
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
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Daftar Permohonan ({filteredLeaves.length})</span>
                <span className="text-emerald-400">{pendingLeaves.length} Menunggu Persetujuan</span>
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
                  return (
                    <div
                      key={leave.id}
                      className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-xs text-white flex items-center gap-1.5">
                            <span>{leave.userName || 'Karyawan'}</span>
                            <span className="text-[10px] font-mono text-slate-400">({leave.userNip || '-'})</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {leave.divisionName || 'Operasional Lapangan'} • {leave.startDate} s/d {leave.endDate} ({leave.totalDays || 1} Hari)
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
                          {leave.status}
                        </Badge>
                      </div>

                      <div className="p-2 bg-slate-900/80 rounded-xl text-[11px] text-slate-300 border border-slate-800/70">
                        <span className="text-slate-400 font-semibold block text-[10px] mb-0.5">Alasan Permohonan:</span>
                        {leave.reason || 'Tidak ada keterangan tambahan.'}
                      </div>

                      {/* Action Buttons */}
                      {isPending && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={processingId === leave.id}
                            onClick={() => handleLeaveDecision(leave.id, 'approved')}
                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            <span>Setujui</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === leave.id}
                            onClick={() => handleLeaveDecision(leave.id, 'rejected')}
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

          {/* TAB 2: LEMBUR (SPL) */}
          {activeTab === 'overtime' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-1">
                <span>Daftar Pengajuan Lembur ({filteredOvertimes.length})</span>
                <span className="text-amber-400">{pendingOvertimes.length} Menunggu Persetujuan</span>
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
