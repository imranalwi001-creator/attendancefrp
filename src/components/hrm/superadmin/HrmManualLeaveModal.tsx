import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { UserProfile, LeaveType, LeaveStatus } from '@/types/hrm';
import {
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  UserCheck,
  Shield,
  FileText,
  X,
  HeartPulse,
  Flame,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

interface HrmManualLeaveModalProps {
  open: boolean;
  onClose: () => void;
  preselectedUser?: UserProfile | null;
  onSuccess?: () => void;
}

export const HrmManualLeaveModal: React.FC<HrmManualLeaveModalProps> = ({
  open,
  onClose,
  preselectedUser,
  onSuccess,
}) => {
  const { user: currentAdmin } = useHrmAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState<string>('');

  // Form Fields
  const [leaveType, setLeaveType] = useState<LeaveType>('cuti_tahunan');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [totalDays, setTotalDays] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [substituteId, setSubstituteId] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [status, setStatus] = useState<LeaveStatus>('approved');
  const [approvalNotes, setApprovalNotes] = useState<string>('Disetujui langsung oleh Super Administrator');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const allUsers = hrmService.getUsers().filter((u) => u.isActive);
      setUsers(allUsers);

      if (preselectedUser) {
        setSelectedUserId(preselectedUser.id);
      } else if (!selectedUserId && allUsers.length > 0) {
        setSelectedUserId(allUsers[0].id);
      }
    }
  }, [open, preselectedUser]);

  // Recalculate total days when date range changes
  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e >= s) {
        const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setTotalDays(diff);
      } else {
        setTotalDays(1);
      }
    }
  }, [startDate, endDate]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedSubstitute = users.find((u) => u.id === substituteId);

  // Quota Metrics
  const annualQuota = selectedUser?.annualLeaveQuota ?? 12;
  const usedAnnual = selectedUser?.usedLeaveDays ?? 0;
  const remainingAnnual = Math.max(0, annualQuota - usedAnnual);

  const permissionQuota = selectedUser?.permissionQuota ?? 5;
  const usedPermission = selectedUser?.usedPermissionDays ?? 0;
  const remainingPermission = Math.max(0, permissionQuota - usedPermission);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Pilih karyawan terlebih dahulu');
      return;
    }
    if (!reason.trim()) {
      toast.error('Keterangan / alasan permohonan wajib diisi');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Tanggal mulai tidak boleh melebihi tanggal selesai');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await hrmService.createManualLeaveRequest({
        userId: selectedUserId,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl: attachmentUrl || undefined,
        substituteId: substituteId || undefined,
        substituteName: selectedSubstitute?.fullName || undefined,
        substituteNip: selectedSubstitute?.nip || undefined,
        status,
        approvalNotes,
        adminId: currentAdmin?.id,
        adminName: currentAdmin?.fullName || 'Super Administrator',
      });

      if (res.success) {
        toast.success(`Pengajuan ${leaveType.replace('_', ' ').toUpperCase()} untuk ${selectedUser?.fullName} (${totalDays} Hari) berhasil disahkan & dicatat ke database!`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error('Gagal mencatat cuti/izin karyawan');
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat memproses data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.nip.toLowerCase().includes(q) ||
      (u.divisionName || '').toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            Input Cuti &amp; Izin Manual Karyawan (Superadmin)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Formulir otoritas Super Administrator untuk mencatat cuti tahunan, izin sakit, atau izin dinas langsung atas nama karyawan PT FRP.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1 text-xs">
          {/* 1. Pilih Karyawan */}
          <div className="space-y-1.5 p-3 rounded-xl border border-border bg-muted/30">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Pilih Karyawan <span className="text-destructive">*</span></span>
              {selectedUser && (
                <span className="text-[11px] font-mono font-normal text-muted-foreground">
                  NIP: {selectedUser.nip}
                </span>
              )}
            </Label>

            {preselectedUser ? (
              <div className="p-2.5 bg-background rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">{preselectedUser.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">{preselectedUser.divisionName || 'Operasional'} • NIP: {preselectedUser.nip}</p>
                </div>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-600">
                  Dipilih
                </Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Cari nama karyawan atau NIP..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="Pilih karyawan..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nip} - {u.fullName} ({u.divisionName || 'Operasional'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status Kuota Karyawan */}
            {selectedUser && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Cuti Tahunan</span>
                  <span className="font-bold text-primary font-mono text-xs">{remainingAnnual} Hari</span>
                  <span className="text-[9px] text-muted-foreground block">({usedAnnual} terpakai)</span>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Kuota Izin</span>
                  <span className="font-bold text-emerald-600 font-mono text-xs">{remainingPermission} Hari</span>
                  <span className="text-[9px] text-muted-foreground block">({usedPermission} terpakai)</span>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Izin Darurat</span>
                  <span className="font-bold text-purple-600 font-mono text-xs">2 Hari</span>
                  <span className="text-[9px] text-muted-foreground block">Cadangan</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Jenis Permohonan */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Jenis Cuti / Izin <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'cuti_tahunan', label: 'Cuti Tahunan', desc: 'Memotong kuota cuti tahunan', icon: CalendarDays },
                { id: 'izin', label: 'Izin Tidak Masuk', desc: 'Keperluan pribadi / keluarga', icon: FileText },
                { id: 'sakit', label: 'Izin Sakit', desc: 'Disertai surat keterangan dokter', icon: HeartPulse },
                { id: 'izin_darurat', label: 'Izin Darurat / Kemalangan', desc: 'Buka kunci pulang awal', icon: Flame },
                { id: 'cuti_khusus', label: 'Cuti Khusus', desc: 'Melahirkan / duka / nikah', icon: Shield },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = leaveType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLeaveType(item.id as LeaveType)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-500/10 text-foreground font-bold shadow-xs'
                        : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-bold text-foreground">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Periode Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tanggal Mulai <span className="text-destructive">*</span></Label>
              <DatePicker
                value={startDate}
                onChange={(val) => setStartDate(val || '')}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tanggal Selesai <span className="text-destructive">*</span></Label>
              <DatePicker
                value={endDate}
                onChange={(val) => setEndDate(val || '')}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Durasi Kerja</Label>
              <div className="h-9 rounded-xl border border-border bg-muted/30 flex items-center px-3 font-mono font-bold text-primary">
                {totalDays} Hari Kerja
              </div>
            </div>
          </div>

          {/* 4. Karyawan Pengganti Pos (Zero Vacancy Rule) */}
          <div className="space-y-1.5 p-3 rounded-xl border border-border bg-card">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Petugas Pengganti Pos (Zero Vacancy FRP)</span>
              </span>
              <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-600">
                Opsional / Rekomendasi
              </Badge>
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Tetapkan rekan kerja pengganti agar pos dinas tidak kosong selama periode izin/cuti.
            </p>
            <Select value={substituteId} onValueChange={setSubstituteId}>
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue placeholder="Pilih rekan kerja pengganti (opsional)..." />
              </SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="none">-- Tanpa Karyawan Pengganti --</SelectItem>
                {users
                  .filter((u) => u.id !== selectedUserId)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nip} - {u.fullName} ({u.divisionName || 'Operasional'})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5. Alasan / Keterangan Dispensasi */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Keterangan / Alasan Dispensasi <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Contoh: Menghadiri acara keluarga di luar kota, kontrol medis berkala, atau dispensasi khusus pimpinan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs rounded-xl min-h-[70px] resize-none"
              required
            />
          </div>

          {/* 6. Lampiran Foto / Surat Dokter (Opsional untuk Superadmin) */}
          <div className="space-y-1.5 p-3 rounded-xl border border-dashed border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Foto Surat Dokter / Bukti Keperluan (Opsional untuk Superadmin)</span>
              </Label>
              {attachmentUrl && (
                <button
                  type="button"
                  onClick={() => setAttachmentUrl('')}
                  className="text-destructive hover:underline text-[10px] flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" /> Hapus
                </button>
              )}
            </div>

            {attachmentUrl ? (
              <div className="flex items-center gap-3 p-2 bg-background rounded-lg border border-border">
                <img src={attachmentUrl} alt="Preview" className="w-12 h-12 object-cover rounded-md border" />
                <span className="text-[11px] text-emerald-600 font-medium">Foto bukti terlampir</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs rounded-lg gap-1.5"
                >
                  <Upload className="w-3 h-3" /> Unggah Berkas Bukti
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Jika dikosongkan, otomatis dicatat sebagai Dispensasi Manual Superadmin.
                </span>
              </div>
            )}
          </div>

          {/* 7. Status Pengesahan & Catatan Superadmin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status Persetujuan</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeaveStatus)}>
                <SelectTrigger className="h-9 text-xs rounded-xl font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Langsung Disetujui (Approved)
                    </span>
                  </SelectItem>
                  <SelectItem value="pending">
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Menunggu Verifikasi (Pending)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan Otorisasi Superadmin</Label>
              <Input
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Catatan persetujuan..."
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs rounded-xl h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? 'Menyimpan...' : 'Sah & Catat Cuti / Izin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
