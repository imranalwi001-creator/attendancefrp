import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { LeaveRequest, LeaveType, OvertimeRecord } from '@/types/hrm';
import {
  CalendarCheck2,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Eye,
  FileText,
  X,
  Coins,
  Calculator,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';

export const HrmLeavePage: React.FC = () => {
  const { user } = useHrmAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'leaves' | 'overtime'>('leaves');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'overtime' || tab === 'lembur') {
      setActiveTab('overtime');
    } else if (tab === 'leaves' || tab === 'cuti' || tab === 'izin') {
      setActiveTab('leaves');
    }
  }, [searchParams]);

  // Leave Form State
  const [leaveType, setLeaveType] = useState<LeaveType>('cuti_tahunan');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [substituteName, setSubstituteName] = useState('');
  const [substituteNip, setSubstituteNip] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Overtime Form State
  const [otModalOpen, setOtModalOpen] = useState(false);
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otStartTime, setOtStartTime] = useState('17:00');
  const [otEndTime, setOtEndTime] = useState('20:00');
  const [otTask, setOtTask] = useState('');
  const [otIsWeekend, setOtIsWeekend] = useState(false);
  const [isEmergencyOt, setIsEmergencyOt] = useState(false);
  const [otFormError, setOtFormError] = useState<string | null>(null);

  // Users for Substitute Recommendations
  const [allUsers, setAllUsers] = useState<import('@/types/hrm').UserProfile[]>([]);

  // Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    if (!user) return;
    setLeaves(hrmService.getUserLeaves(user.id));
    setOvertimes(hrmService.getUserOvertimeRecords(user.id));
    setAllUsers(hrmService.getUsers());
  };

  useEffect(() => {
    loadData();
    hrmService.syncWithBackend().then(loadData);
    window.addEventListener('hrm_leaves_updated', loadData);
    window.addEventListener('hrm_overtime_updated', loadData);
    window.addEventListener('hrm_data_updated', loadData);
    return () => {
      window.removeEventListener('hrm_leaves_updated', loadData);
      window.removeEventListener('hrm_overtime_updated', loadData);
      window.removeEventListener('hrm_data_updated', loadData);
    };
  }, [user]);

  const handleOpenModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setLeaveType('cuti_tahunan');
    setStartDate(today);
    setEndDate(today);
    setReason('');
    setAttachmentUrl('');
    setSubstituteId('');
    setSubstituteName('');
    setSubstituteNip('');
    setFormError(null);
    setModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setFormError('Ukuran file maksimal 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachmentUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!startDate || !endDate) {
      setFormError('Tanggal mulai dan selesai wajib dipilih');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setFormError('Tanggal mulai tidak boleh melebihi tanggal selesai');
      return;
    }
    if (!reason.trim()) {
      setFormError('Alasan pengajuan wajib diisi');
      return;
    }
    if (!substituteId) {
      setFormError('Sesuai prosedur anti-kekosongan pos pengawasan, Karyawan Pengganti wajib dipilih.');
      return;
    }

    try {
      hrmService.createLeaveRequest({
        userId: user!.id,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl: attachmentUrl.trim() || undefined,
        substituteId,
        substituteName,
        substituteNip,
      });

      setModalOpen(false);
      setSuccessMessage('Pengajuan izin/cuti berhasil dikirim! Karyawan pengganti tercatat dan notifikasi telah dikirimkan ke Korlap, Pimpinan, dan Dirut.');
      setTimeout(() => setSuccessMessage(null), 6000);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal mengirim pengajuan.');
    }
  };

  const handleOpenOtModal = () => {
    setOtDate(new Date().toISOString().split('T')[0]);
    setOtStartTime('17:00');
    setOtEndTime('20:00');
    setOtTask('');
    setOtIsWeekend(false);
    setIsEmergencyOt(false);
    setOtFormError(null);
    setOtModalOpen(true);
  };

  // Gunakan tarif lembur resmi per karyawan dari profil (dari database), bukan tarif global
  const userOvertimeRate = (user as any)?.hourlyOvertimeRate || 23381.79;
  const otCalc = hrmService.calculateOvertime(otStartTime, otEndTime, otIsWeekend, userOvertimeRate);

  const handleOtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOtFormError(null);
    if (!otDate) {
      setOtFormError('Tanggal lembur wajib diisi.');
      return;
    }
    if (!otStartTime || !otEndTime) {
      setOtFormError('Jam mulai dan selesai lembur wajib diisi.');
      return;
    }
    if (otCalc.durationHours <= 0) {
      setOtFormError('Durasi lembur tidak mencukupi batas minimum atau jam tidak valid.');
      return;
    }
    if (!otTask.trim()) {
      setOtFormError('Uraian tugas/pekerjaan lembur wajib diisi.');
      return;
    }

    try {
      hrmService.createOvertimeRequest({
        userId: user!.id,
        userName: user!.fullName,
        userNip: user!.nip,
        divisionId: user!.divisionId,
        divisionName: user!.divisionName,
        date: otDate,
        startTime: otStartTime,
        endTime: otEndTime,
        durationMinutes: otCalc.durationMinutes,
        durationHours: otCalc.durationHours,
        isWeekendHoliday: otIsWeekend,
        hourlyRate: userOvertimeRate,
        rateMultiplier: otCalc.rateMultiplier,
        totalPay: otCalc.totalPay,
        taskDescription: otTask.trim(),
        isEmergency: isEmergencyOt,
      });

      setOtModalOpen(false);
      if (isEmergencyOt) {
        setSuccessMessage(`⚡ Lembur Darurat berhasil dimulai seketika! Notifikasi siaga telah diteruskan ke Korlap, Admin, K3, Pimpinan, Dirut, dan Superadmin. Hak uang lembur akan direkap di bulan berjalan dan dibayarkan bulan depan.`);
      } else {
        setSuccessMessage(`Pengajuan lembur (SPL) berhasil dikirim! Menunggu verifikasi atasan.`);
      }
      setTimeout(() => setSuccessMessage(null), 8000);
      loadData();
    } catch (err: any) {
      setOtFormError(err.message || 'Gagal mengirim pengajuan lembur.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] rounded-md gap-1">
            <CheckCircle2 className="w-3 h-3" /> Disetujui
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[11px] rounded-md gap-1">
            <XCircle className="w-3 h-3" /> Ditolak
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[11px] rounded-md gap-1">
            <Clock className="w-3 h-3" /> Menunggu Review
          </Badge>
        );
    }
  };

  const getLeaveTypeLabel = (type: LeaveType) => {
    switch (type) {
      case 'cuti_tahunan':
        return 'Cuti Tahunan';
      case 'sakit':
        return 'Sakit (Surat Dokter)';
      case 'izin':
        return 'Izin Keperluan Pribadi';
      case 'dinas':
        return 'Tugas / Dinas Luar';
      default:
        return type;
    }
  };

  // Kuota cuti tahunan: 12 hari reguler + 2 hari bonus = 14 hari total (sinkron dari database)
  const annualQuota = user?.annualLeaveQuota || 14;
  const remainingLeave = annualQuota - (user?.usedLeaveDays || 0);

  // User personal overtime stats
  const totalUserOtHours = overtimes.reduce((sum, o) => sum + (o.durationHours || 0), 0);
  const approvedUserOtPay = overtimes
    .filter((o) => o.status === 'approved')
    .reduce((sum, o) => sum + Number(o.totalPay ?? o.compensationAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarCheck2 className="w-6 h-6 text-primary" />
            Portal Pengajuan Karyawan
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeTab === 'leaves' ? (
              <>
                Sisa Kuota Cuti Tahunan:{' '}
                <strong className="text-primary font-semibold">{remainingLeave} Hari</strong>
                {' '}(dari total {annualQuota} hari · {user?.usedLeaveDays || 0} terpakai)
              </>
            ) : (
              <>
                Tarif Lembur Resmi Anda:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                  Rp {userOvertimeRate.toLocaleString('id-ID')}/jam
                </strong>
                {' '}· Disetujui:{' '}
                <strong className="text-primary font-semibold font-mono">
                  Rp {Number(approvedUserOtPay || 0).toLocaleString('id-ID')}
                </strong>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('leaves')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'leaves'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5 text-primary" />
              <span>Cuti & Izin</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overtime')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'overtime'
                  ? 'bg-card text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span>Surat Lembur (SPL)</span>
            </button>
          </div>

          {activeTab === 'leaves' ? (
            <Button
              onClick={handleOpenModal}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Ajukan Izin / Cuti
            </Button>
          ) : (
            <Button
              onClick={handleOpenOtModal}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Ajukan Lembur (SPL)
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <Alert className="border-border bg-card text-foreground py-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <AlertDescription className="text-xs font-medium">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* History Table: Leaves or Overtime */}
      {activeTab === 'leaves' ? (
        <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Riwayat Permohonan Izin & Cuti Anda
            </CardTitle>
            <CardDescription className="text-xs">
              Daftar seluruh pengajuan izin, sakit, dinas luar, dan cuti beserta status persetujuan dari HRD/Atasan.
            </CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 border-y border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                <tr>
                  <th className="py-3 px-4">Jenis Permohonan</th>
                  <th className="py-3 px-4">Rentang Tanggal</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4">Bukti / Foto</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Catatan Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Belum ada riwayat permohonan izin atau cuti.
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {getLeaveTypeLabel(l.leaveType)}
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
                        {getStatusBadge(l.status)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground italic text-[11px]">
                        {l.approvalNotes ? `${l.approvalNotes} (oleh ${l.approvedByName || 'HRD'})` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  Riwayat Surat Perintah Lembur (SPL) Anda
                </CardTitle>
                <CardDescription className="text-xs">
                  Catatan jam kerja lembur dan rincian uang lembur yang akan diterima pada periode penggajian.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-mono font-bold">
                  Total Disetujui: Rp {Number(approvedUserOtPay || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 border-y border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Kategori Hari</th>
                  <th className="py-3 px-4">Durasi Jam</th>
                  <th className="py-3 px-4">Uang Lembur (Rp)</th>
                  <th className="py-3 px-4">Uraian Tugas Pekerjaan</th>
                  <th className="py-3 px-4">Status Approval</th>
                  <th className="py-3 px-4">Status Pencairan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overtimes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Belum ada catatan lembur yang diajukan.
                    </td>
                  </tr>
                ) : (
                  overtimes.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <p className="font-semibold text-foreground">{o.date}</p>
                        <p className="text-muted-foreground">{o.startTime} - {o.endTime} WIB</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {o.isWeekendHoliday ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600">
                            Libur ({o.rateMultiplier}x)
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-normal">
                            Hari Kerja (1.0x)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground font-mono">
                        {o.durationHours} Jam
                        <span className="text-[10px] text-muted-foreground block font-normal">({o.durationMinutes} mnt)</span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="text-xs font-bold text-primary">
                          Rp {Number(o.totalPay ?? o.compensationAmount ?? 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          @Rp {Number(o.hourlyRate ?? o.rateApplied ?? 30000).toLocaleString('id-ID')}/jam
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={o.taskDescription}>
                        {o.taskDescription}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(o.status)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {o.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
                            Ditransfer
                          </span>
                        ) : o.paymentStatus === 'included_in_payroll' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                            Masuk Slip Gaji
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                            Belum Cair
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Dialog Form */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck2 className="w-5 h-5 text-primary" />
              Formulir Permohonan Izin / Cuti
            </DialogTitle>
            <DialogDescription>
              Isi formulir dengan lengkap untuk diteruskan ke HRD dan atasan Anda.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 my-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Jenis Pengajuan</Label>
              <Select value={leaveType} onValueChange={(val: any) => setLeaveType(val)}>
                <SelectTrigger className="text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cuti_tahunan">Cuti Tahunan (Potong Kuota)</SelectItem>
                  <SelectItem value="sakit">Sakit (Lampirkan Surat Dokter)</SelectItem>
                  <SelectItem value="izin">Izin Keperluan Pribadi</SelectItem>
                  <SelectItem value="dinas">Tugas Luar / Perjalanan Dinas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tanggal Mulai</Label>
                <DatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  placeholder="Pilih Tanggal Mulai"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tanggal Selesai</Label>
                <DatePicker
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                  placeholder="Pilih Tanggal Selesai"
                />
              </div>
            </div>

            {/* ─── KARYAWAN PENGGANTI (ZERO VACANCY RULE) ─── */}
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  🛡️ Karyawan Pengganti Pos (Wajib Prosedur)
                </Label>
                <span className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                  Zero Vacancy
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pekerjaan tidak boleh terbengkalai. Pilih rekan kerja yang direkomendasikan sistem untuk bertugas sementara. Jika rekan yang dipilih sedang libur, otomatis dihitung <strong>lembur</strong> saat disetujui.
              </p>
              <Select
                value={substituteId}
                onValueChange={(val) => {
                  setSubstituteId(val);
                  const found = allUsers.find((u) => u.id === val);
                  if (found) {
                    setSubstituteName(found.fullName);
                    setSubstituteNip(found.nip);
                  }
                }}
              >
                <SelectTrigger className="text-xs rounded-xl bg-card border-border mt-1">
                  <SelectValue placeholder="-- Pilih Karyawan Pengganti --" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {allUsers
                    .filter((u) => u.id !== user?.id)
                    .sort((a, b) => {
                      const aSameDiv = a.divisionId === user?.divisionId ? -1 : 1;
                      const bSameDiv = b.divisionId === user?.divisionId ? -1 : 1;
                      return aSameDiv - bSameDiv;
                    })
                    .map((emp) => {
                      const isSameDiv = emp.divisionId === user?.divisionId;
                      return (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.fullName} ({emp.nip}) • {emp.divisionName || 'Operasional'}
                          {isSameDiv ? ' ★ Rekomendasi 1 Divisi' : ''}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Alasan / Keterangan Lengkap</Label>
              <Textarea
                rows={3}
                placeholder="Jelaskan alasan pengajuan secara rinci..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-xs rounded-xl"
                required
              />
            </div>

            {/* Foto Bukti / Surat Dokter Upload */}
            <div className="space-y-1.5 p-3 bg-muted/40 border border-border rounded-xl">
              <Label className="text-xs font-semibold text-foreground">
                Lampiran Foto / Bukti Dokumen (Surat Dokter, Surat Tugas, dll.)
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs gap-1.5 border-border rounded-lg"
                >
                  <Upload className="w-3.5 h-3.5 text-primary" />
                  Unggah Foto Berkas
                </Button>
                {attachmentUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachmentUrl('')}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                  >
                    Hapus Berkas
                  </Button>
                )}
              </div>

              {attachmentUrl && (
                <div className="mt-2 p-2 bg-card border border-border rounded-lg flex items-center gap-2">
                  {attachmentUrl.startsWith('data:image') ? (
                    <img
                      src={attachmentUrl}
                      alt="Preview Bukti"
                      className="w-12 h-12 object-cover rounded border border-border shrink-0"
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-primary shrink-0" />
                  )}
                  <span className="text-[11px] text-muted-foreground truncate flex-1">
                    Berkas foto bukti siap dikirim
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">
                Batal
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
                Kirim Pengajuan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overtime Modal Dialog Form */}
      <Dialog open={otModalOpen} onOpenChange={setOtModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Surat Perintah Lembur (SPL)
            </DialogTitle>
            <DialogDescription>
              Isi rencana jam kerja lembur Anda. Sistem menghitung estimasi uang lembur secara otomatis.
            </DialogDescription>
          </DialogHeader>

          {otFormError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{otFormError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleOtSubmit} className="space-y-4 my-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tanggal Lembur</Label>
              <DatePicker
                value={otDate}
                onChange={(v) => setOtDate(v)}
                placeholder="Pilih tanggal lembur"
              />
            </div>

            {/* Kategori Hari */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kategori Hari</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOtIsWeekend(false)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    !otIsWeekend
                      ? 'bg-card border-primary text-primary shadow-xs ring-1 ring-primary/20'
                      : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="block font-bold">Hari Kerja Normal</span>
                  <span className="text-[10px] opacity-80">Tarif Biasa (1.0x)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOtIsWeekend(true)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    otIsWeekend
                      ? 'bg-card border-primary text-primary shadow-xs ring-1 ring-primary/20'
                      : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="block font-bold">Hari Libur / Weekend</span>
                  <span className="text-[10px] opacity-80">Tarif Khusus ({otCalc.rateMultiplier}x)</span>
                </button>
              </div>
            </div>

            {/* Jam Mulai & Selesai */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Jam Mulai</Label>
                <Input
                  type="time"
                  value={otStartTime}
                  onChange={(e) => setOtStartTime(e.target.value)}
                  className="text-xs rounded-xl font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Jam Selesai</Label>
                <Input
                  type="time"
                  value={otEndTime}
                  onChange={(e) => setOtEndTime(e.target.value)}
                  className="text-xs rounded-xl font-mono"
                  required
                />
              </div>
            </div>

            {/* Live Calculation Preview Box */}
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Durasi Dihitung:</span>
                <span className="font-mono font-bold text-foreground">
                  {otCalc.durationHours} Jam ({otCalc.durationMinutes} Menit)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tarif Resmi Anda:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  Rp {userOvertimeRate.toLocaleString('id-ID')} / Jam
                </span>
              </div>
              {otIsWeekend && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Multiplier Hari Libur:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    ×{otCalc.rateMultiplier}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-primary/20 flex items-baseline justify-between">
                <span className="font-bold text-foreground">Estimasi Uang Lembur:</span>
                <span className="text-base font-bold font-mono text-primary">
                  Rp {Number(otCalc?.totalPay || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Uraian Tugas / Rencana Kerja Lembur</Label>
              <Textarea
                rows={3}
                placeholder="Jelaskan pekerjaan atau target yang diselesaikan saat lembur..."
                value={otTask}
                onChange={(e) => setOtTask(e.target.value)}
                className="text-xs rounded-xl"
                required
              />
            </div>

            {/* Opsi Lembur Darurat (On-Call Tanpa Menunggu Approval Tertulis) */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEmergencyOt}
                  onChange={(e) => setIsEmergencyOt(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <span className="font-bold text-xs text-blue-950 dark:text-blue-200 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Pekerjaan Lembur Darurat (On-Call Langsung)
                </span>
              </label>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed pl-6">
                Aktifkan jika pekerjaan darurat/mendesak. Lembur langsung aktif tanpa menunggu approval tertulis sebelumnya. Notifikasi darurat seketika dikirim ke <strong>Korlap, Admin, K3, Pimpinan, Dirut, dan Superadmin</strong>, dan tercatat di database untuk perekapan gaji lembur bulan depan.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOtModalOpen(false)} className="rounded-xl">
                Batal
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
                Kirim Pengajuan Lembur
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4 text-primary" />
              Bukti Lampiran Dokumen
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
    </div>
  );
};
