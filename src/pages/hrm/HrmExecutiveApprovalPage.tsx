import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Award,
  Layers,
  FileText,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/apiClient';
import { toast } from 'sonner';

interface ExecutiveApprovalInfo {
  type: 'leave' | 'overtime';
  id: string;
  applicant: {
    id: string;
    name: string;
    nip: string;
    phone: string;
    division: string;
  };
  details: {
    submissionType: string;
    startDate?: string;
    endDate?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    durationHours?: number;
    totalDays?: number;
    totalPay?: number;
    reason: string;
    attachmentUrl?: string;
    isSpecialOfficer: boolean;
    noSubstituteNeeded: boolean;
  };
  quota?: {
    annualQuota: number;
    usedDays: number;
    requestedDays: number;
    currentRemaining: number;
    estRemaining: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  alreadyProcessed: boolean;
  processedBy?: string;
  actionAt?: string;
}

export const HrmExecutiveApprovalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const initialDecision = searchParams.get('decision'); // 'approved' | 'rejected'

  const [data, setData] = useState<ExecutiveApprovalInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [approverRole, setApproverRole] = useState<'dirut' | 'pimpinan'>('dirut');
  const [notes, setNotes] = useState('');
  const [decisionDone, setDecisionDone] = useState<'approved' | 'rejected' | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(initialDecision === 'rejected');

  useEffect(() => {
    if (!token) {
      setErrorMsg('Tautan persetujuan tidak valid atau tidak memiliki token akses.');
      setIsLoading(false);
      return;
    }
    fetchInfo();
  }, [token]);

  const fetchInfo = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get<{ success: boolean; data?: any; error?: string }>(
        `/hrm/executive-approval/info/${token}`
      );
      if (res && res.success && res.data) {
        setData(res.data);
        if (res.data.alreadyProcessed) {
          setDecisionDone(res.data.status);
        }
      } else {
        setErrorMsg(res?.error || 'Tautan persetujuan tidak ditemukan atau telah kedaluwarsa.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat rincian permohonan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !showRejectInput) {
      setShowRejectInput(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const approverName =
        approverRole === 'dirut'
          ? 'Alam AS simpuang ago, S.Sos (Direktur Utama)'
          : 'Reski Faisal (Pimpinan)';

      const res = await api.post<{ success: boolean; decision: string; message: string; error?: string }>(
        '/hrm/executive-approval/respond',
        {
          token,
          decision,
          approverRole,
          approverName,
          approverPhone: approverRole === 'dirut' ? '082291998026' : '082192755755',
          notes: notes.trim() || undefined,
        }
      );

      if (res && res.success) {
        setDecisionDone(decision);
        toast.success(res.message);
        fetchInfo();
      } else {
        toast.error(res?.error || 'Gagal memproses persetujuan.');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan: ' + (err.message || 'Gagal menghubungi server'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 antialiased">
      <div className="max-w-xl w-full mx-auto my-auto space-y-4">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5 pt-2 pb-1">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2 shadow-inner">
            <Award className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>PT. FAWWAZ RESKI PERWIRA</span>
          </h1>
          <p className="text-xs text-amber-300 font-semibold flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Pusat Otoritas &amp; Keputusan Direksi (One-Click Executive Approval)</span>
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
            <p className="text-sm text-slate-300">Memeriksa token keamanan dan rekapan data...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMsg && (
          <div className="p-6 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-rose-200">Tautan Tidak Dapat Diproses</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{errorMsg}</p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
                className="border-slate-700 text-slate-300 hover:text-white text-xs"
              >
                Ke Halaman Login PWA
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!isLoading && data && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            
            {/* Top Card Header */}
            <div className="pb-3 border-b border-slate-800 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Permohonan Petugas Lapangan Khusus:</p>
                <p className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>{data.applicant.name}</span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {data.applicant.nip}
                  </span>
                </p>
                <p className="text-xs text-slate-300 mt-0.5 font-medium flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{data.applicant.division}</span>
                </p>
              </div>

              <Badge
                variant="outline"
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  data.status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : data.status === 'rejected'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                }`}
              >
                {data.status === 'approved' ? 'Disetujui Sah' : data.status === 'rejected' ? 'Ditolak' : 'Menunggu Direksi'}
              </Badge>
            </div>

            {/* Special Policy Exemption Badge */}
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-[10.5px] text-amber-200 leading-snug">
                <strong>Ketentuan Khusus:</strong> Karyawan ini merupakan personil penugasan khusus Pimpinan yang <strong>tidak membutuhkan rekan pengganti pos</strong>. Persetujuan berada di tangan Direktur Utama atau Pimpinan.
              </p>
            </div>

            {/* Details Box */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold text-[11px]">Jenis Permohonan:</span>
                <span className="font-bold text-white uppercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {data.details.submissionType}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold text-[11px]">Jadwal Pelaksanaan:</span>
                <span className="font-bold text-amber-300">
                  {data.type === 'leave'
                    ? `${data.details.startDate} s/d ${data.details.endDate} (${data.details.totalDays} Hari)`
                    : `${data.details.date} (${data.details.startTime} - ${data.details.endTime}, ${data.details.durationHours} Jam)`}
                </span>
              </div>

              <div className="pt-1 border-t border-slate-800/80">
                <span className="text-slate-400 font-semibold text-[10px] block mb-0.5">Alasan / Uraian Tugas:</span>
                <p className="font-medium text-slate-200 italic bg-slate-900/90 p-2 rounded-lg border border-slate-800/60">
                  "{data.details.reason}"
                </p>
              </div>
            </div>

            {/* REKAPITULASI KUOTA CUTI (JIKA PENGAJUAN CUTI) */}
            {data.type === 'leave' && data.quota && (
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>REKAPITULASI KUOTA CUTI RESMI</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Aturan Use-It-Or-Lose-It</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Hak Kuota</span>
                    <span className="text-sm font-black text-white">{data.quota.annualQuota} Hari</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-amber-400 block font-medium">Telah Dipakai</span>
                    <span className="text-sm font-black text-amber-300">{data.quota.usedDays} Hari</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-sky-400 block font-medium">Akan Dipakai</span>
                    <span className="text-sm font-black text-sky-300">{data.quota.requestedDays} Hari</span>
                  </div>
                  <div className="p-2 bg-emerald-950/40 rounded-xl border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-400 block font-bold">Sisa Kuota Pasca ACC</span>
                    <span className="text-sm font-black text-emerald-300">{data.quota.estRemaining} Hari</span>
                  </div>
                </div>

                <p className="text-[9.5px] text-slate-400 leading-tight italic pt-0.5">
                  * Hak cuti tidak dapat diuangkan &amp; tidak membebani kas perusahaan. Sisa dipantau murni dalam satuan hari kerja.
                </p>
              </div>
            )}

            {/* Already Processed Banner */}
            {data.alreadyProcessed && (
              <div
                className={`p-4 rounded-2xl text-center space-y-2 border ${
                  data.status === 'approved'
                    ? 'bg-emerald-950/60 border-emerald-500/50'
                    : 'bg-rose-950/60 border-rose-500/50'
                }`}
              >
                {data.status === 'approved' ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                ) : (
                  <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
                )}
                <h4 className="text-sm font-bold text-white">
                  Permohonan Telah Diproses ({data.status.toUpperCase()})
                </h4>
                <p className="text-xs text-slate-300">
                  Disahkan oleh: <strong>{data.processedBy || 'Direksi'}</strong>
                </p>
                <div className="pt-2">
                  <Button
                    onClick={() => navigate('/admin/approval')}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl h-9 px-4"
                  >
                    Buka Dashboard Approval
                  </Button>
                </div>
              </div>
            )}

            {/* Action Form if Still Pending */}
            {!data.alreadyProcessed && (
              <div className="space-y-3 pt-2">
                
                {/* Approver Identity Selector */}
                <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <label className="text-[10.5px] font-bold text-slate-300 block">
                    Saya Bertindak Selaku:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setApproverRole('dirut')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        approverRole === 'dirut'
                          ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-xs'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-bold">Direktur Utama</p>
                      <p className="text-[10px] text-slate-400 truncate">Alam AS simpuang ago</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setApproverRole('pimpinan')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        approverRole === 'pimpinan'
                          ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-xs'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-bold">Pimpinan</p>
                      <p className="text-[10px] text-slate-400 truncate">Reski Faisal</p>
                    </button>
                  </div>
                </div>

                {/* Reject Reason input if rejection mode active */}
                {showRejectInput && (
                  <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-rose-500/30">
                    <label className="text-[11px] font-bold text-rose-300 block">
                      Alasan Penolakan:
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Masukkan alasan atau arahan penolakan untuk personil..."
                      className="bg-slate-900 border-slate-700 text-slate-100 text-xs rounded-lg min-h-[60px]"
                    />
                  </div>
                )}

                {/* Main Action Buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('approved')}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>SETUJUI PERMOHONAN SEKARANG</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('rejected')}
                    className="w-full h-10 border-rose-500/40 hover:bg-rose-500/20 text-rose-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{showRejectInput ? 'KIRIM PENOLAKAN PERMOHONAN' : 'TOLAK PERMOHONAN'}</span>
                  </Button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-center text-slate-500">
          PT. FAWWAZ RESKI PERWIRA • Sistem Komando Eksekutif &amp; Audit Trail Sah
        </p>

      </div>
    </div>
  );
};

