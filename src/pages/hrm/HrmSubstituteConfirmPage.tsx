import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  UserCheck,
  Coins,
  AlertTriangle,
  ArrowRight,
  Send,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/apiClient';
import { toast } from 'sonner';

interface DutyInfo {
  leaveId: string;
  applicantName: string;
  applicantNip: string;
  divisionName: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  substituteName: string;
  substituteNip: string;
  substituteId: string;
  status: 'unconfirmed' | 'pending_wa' | 'confirmed' | 'declined';
  confirmedAt?: string;
  declineReason?: string;
}

export const HrmSubstituteConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const initialAction = searchParams.get('action'); // 'accept' | 'decline'

  const [dutyInfo, setDutyInfo] = useState<DutyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineInput, setShowDeclineInput] = useState(initialAction === 'decline');
  const [actionCompleted, setActionCompleted] = useState<'accept' | 'decline' | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg('Tautan konfirmasi tidak valid atau tidak memiliki token.');
      setIsLoading(false);
      return;
    }
    fetchTokenInfo();
  }, [token]);

  const fetchTokenInfo = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get<{ success: boolean; data?: DutyInfo; error?: string }>(
        `/hrm/substitute/token-info/${token}`
      );
      if (res && res.success && res.data) {
        setDutyInfo(res.data);
        if (res.data.status === 'confirmed') {
          setActionCompleted('accept');
        } else if (res.data.status === 'declined') {
          setActionCompleted('decline');
        } else if (initialAction === 'accept') {
          // If candidate clicked the "Saya Bersedia" link, automatically prompt or submit
        }
      } else {
        setErrorMsg(res?.error || 'Tautan konfirmasi tidak ditemukan atau telah kedaluwarsa.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat data penugasan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (action === 'decline' && !showDeclineInput) {
      setShowDeclineInput(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; action: string; message: string; error?: string }>(
        '/hrm/substitute/respond-token',
        {
          token,
          action,
          reason: action === 'decline' ? (declineReason.trim() || 'Karyawan berhalangan hadir') : undefined,
        }
      );

      if (res && res.success) {
        setActionCompleted(action);
        toast.success(res.message);
        // Refresh token info
        fetchTokenInfo();
      } else {
        toast.error(res?.error || 'Gagal memproses konfirmasi.');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan: ' + (err.message || 'Gagal menghubungi server'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 antialiased">
      <div className="max-w-lg w-full mx-auto my-auto space-y-4">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5 pt-2 pb-1">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            PT. FAWWAZ RESKI PERWIRA
          </h1>
          <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Konfirmasi Resmi Petugas Pengganti Pos (Zero Vacancy)</span>
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
            <p className="text-sm text-slate-300">Memeriksa tautan dan jadwal penugasan...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMsg && (
          <div className="p-6 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-rose-200">Tautan Tidak Dapat Diproses</h3>
            <p className="text-xs text-slate-300">{errorMsg}</p>
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

        {/* Content Card */}
        {!isLoading && dutyInfo && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            
            {/* Candidate Greeting */}
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-400">Panggilan Tugas untuk:</p>
                <p className="text-base font-black text-white">
                  {dutyInfo.substituteName}
                  {dutyInfo.substituteNip && (
                    <span className="text-xs font-mono font-bold text-emerald-400 ml-2">
                      ({dutyInfo.substituteNip})
                    </span>
                  )}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  dutyInfo.status === 'confirmed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : dutyInfo.status === 'declined'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                }`}
              >
                {dutyInfo.status === 'confirmed'
                  ? 'Bersedia'
                  : dutyInfo.status === 'declined'
                  ? 'Berhalangan'
                  : 'Menunggu Tanggapan'}
              </Badge>
            </div>

            {/* Assignment Details */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-start gap-2.5">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Menggantikan Rekan:</span>
                    <span className="font-bold text-slate-100 text-sm">{dutyInfo.applicantName}</span>
                    <span className="text-slate-400 ml-1.5 font-mono">({dutyInfo.applicantNip})</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Pos Dinas / Divisi:</span>
                    <span className="font-bold text-sky-300">{dutyInfo.divisionName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold">Jadwal Tugas Pengganti:</span>
                    <span className="font-bold text-amber-300">
                      {dutyInfo.startDate === dutyInfo.endDate
                        ? dutyInfo.startDate
                        : `${dutyInfo.startDate} s/d ${dutyInfo.endDate}`}
                    </span>
                  </div>
                </div>

                {dutyInfo.reason && (
                  <div className="pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400 block text-[10px] font-semibold">Alasan Kekosongan:</span>
                    <p className="text-slate-300 italic">"{dutyInfo.reason}"</p>
                  </div>
                )}
              </div>

              {/* Guarantees Box */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kompensasi &amp; Legalitas Zero Vacancy</span>
                </p>
                <ul className="text-[10.5px] text-slate-300 space-y-1 list-disc list-inside">
                  <li>Tugas ini resmi dihitung <strong>Lembur Penuh (SPKL 8 Jam)</strong>.</li>
                  <li>Radius &amp; titik pos lokasi dinas rekan otomatis aktif di akun presensi Anda tanpa kendala perimeter.</li>
                  <li>Sesuai Peraturan Perusahaan, pos lapangan wajib terisi tanpa kekosongan.</li>
                </ul>
              </div>
            </div>

            {/* Success Accepted Banner */}
            {actionCompleted === 'accept' && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-200">
                  Terima Kasih! Kesediaan Anda Telah Dikonfirmasi
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Koordinator Lapangan (*Muh Aslam Faisal*) dan Pimpinan telah menerima konfirmasi kesiapan Anda. Harap hadir tepat waktu sesuai jadwal tugas.
                </p>
                <div className="pt-2">
                  <Button
                    onClick={() => navigate('/presensi')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-10 shadow-lg"
                  >
                    Buka Halaman Presensi Saya
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Declined Banner */}
            {actionCompleted === 'decline' && (
              <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-center space-y-2">
                <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
                <h4 className="text-sm font-bold text-rose-200">
                  Konfirmasi Berhalangan Telah Dikirim
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Pemberitahuan bahwa Anda berhalangan telah disampaikan ke Koordinator Lapangan. Pos dinas akan dialihkan ke rekan yang lain.
                </p>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/presensi')}
                    className="w-full border-slate-700 text-slate-300 text-xs rounded-xl h-9"
                  >
                    Kembali ke Presensi
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons if Still Unconfirmed */}
            {!actionCompleted && (
              <div className="space-y-3 pt-2">
                {showDeclineInput && (
                  <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-rose-500/30">
                    <label className="text-[11px] font-bold text-rose-300 block">
                      Alasan Berhalangan Hadir:
                    </label>
                    <Input
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Contoh: Sedang kurang sehat / ada acara keluarga mendesak"
                      className="bg-slate-900 border-slate-700 text-slate-100 text-xs rounded-lg h-9"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleRespond('accept')}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>SAYA BERSEDIA &amp; SIAP BERTUGAS</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => handleRespond('decline')}
                    className="w-full h-10 border-rose-500/40 hover:bg-rose-500/20 text-rose-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{showDeclineInput ? 'KIRIM ALASAN BERHALANGAN' : 'SAYA BERHALANGAN HADIR'}</span>
                  </Button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer info */}
        <p className="text-[10px] text-center text-slate-500">
          PT. FAWWAZ RESKI PERWIRA • Sistem Otomasi Penugasan &amp; Zero Vacancy
        </p>

      </div>
    </div>
  );
};

