import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRightLeft,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  Info,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

interface HrmDirectShiftSwapModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentUser?: UserProfile | null;
}

interface SchedulePreview {
  userId: string;
  fullName: string;
  nip: string;
  date: string;
  shiftId: string | null;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  isNightShift: boolean;
  isOff: boolean;
  notes: string;
  source: string;
}

export const HrmDirectShiftSwapModal: React.FC<HrmDirectShiftSwapModalProps> = ({
  open,
  onClose,
  onSuccess,
  currentUser,
}) => {
  const getTodayDateStr = () => {
    return new Date().toLocaleDateString('en-CA');
  };

  const [swapDate, setSwapDate] = useState<string>(getTodayDateStr());
  const [employeeAId, setEmployeeAId] = useState<string>('');
  const [employeeBId, setEmployeeBId] = useState<string>('');
  const [swapType, setSwapType] = useState<'MUTUAL_SWAP' | 'DAY_OFF_SWAP' | 'RELIEF_OVERTIME'>('MUTUAL_SWAP');
  const [reason, setReason] = useState<string>('Penyesuaian rotasi dinas lapangan arahan Korlap');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [forceOverrideFatigue, setForceOverrideFatigue] = useState<boolean>(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schedA, setSchedA] = useState<SchedulePreview | null>(null);
  const [schedB, setSchedB] = useState<SchedulePreview | null>(null);
  const [isLoadingSchedA, setIsLoadingSchedA] = useState<boolean>(false);
  const [isLoadingSchedB, setIsLoadingSchedB] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fatigueWarning, setFatigueWarning] = useState<string | null>(null);

  // Load active employees list
  useEffect(() => {
    if (open) {
      const allUsers = hrmService.getUsers().filter((u) => u.isActive !== false);
      setUsers(allUsers);
      setSwapDate(getTodayDateStr());
      setFatigueWarning(null);
      setForceOverrideFatigue(false);
    }
  }, [open]);

  // Load Schedule Preview for Employee A
  useEffect(() => {
    if (!open || !employeeAId || !swapDate) {
      setSchedA(null);
      return;
    }
    setIsLoadingSchedA(true);
    hrmService
      .getEmployeeSchedulePreview(employeeAId, swapDate)
      .then((res) => {
        if (res.success && res.data) {
          setSchedA(res.data);
        } else {
          setSchedA(null);
        }
      })
      .catch(() => setSchedA(null))
      .finally(() => setIsLoadingSchedA(false));
  }, [open, employeeAId, swapDate]);

  // Load Schedule Preview for Employee B
  useEffect(() => {
    if (!open || !employeeBId || !swapDate) {
      setSchedB(null);
      return;
    }
    setIsLoadingSchedB(true);
    hrmService
      .getEmployeeSchedulePreview(employeeBId, swapDate)
      .then((res) => {
        if (res.success && res.data) {
          setSchedB(res.data);
        } else {
          setSchedB(null);
        }
      })
      .catch(() => setSchedB(null))
      .finally(() => setIsLoadingSchedB(false));
  }, [open, employeeBId, swapDate]);

  const handleSubmit = async () => {
    if (!employeeAId || !employeeBId) {
      toast.error('Harap pilih Karyawan 1 dan Karyawan 2 terlebih dahulu.');
      return;
    }
    if (employeeAId === employeeBId) {
      toast.error('Karyawan 1 dan Karyawan 2 tidak boleh orang yang sama.');
      return;
    }
    if (!swapDate) {
      toast.error('Tanggal penugasan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const operatorRole = currentUser?.roleName || 'superadmin';
      const operatorName = currentUser?.fullName || 'Super Administrator';
      const operatorId = currentUser?.id || undefined;

      const res = await hrmService.directExecuteShiftSwap({
        employeeAId,
        employeeBId,
        swapDate,
        swapType,
        operatorId,
        operatorRole,
        operatorName,
        reason: reason.trim() || 'Penyesuaian rotasi dinas lapangan arahan Korlap',
        customNotes: customNotes.trim(),
        forceOverrideFatigue,
      });

      if (res.success) {
        toast.success(res.message || 'Tukar shift berhasil dieksekusi dan notifikasi WA terkirim.');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        if (res.code === 'FATIGUE_WARNING_CONFIRMATION_REQUIRED' && res.warning) {
          setFatigueWarning(res.warning);
          toast.warning(res.warning);
        } else {
          toast.error(res.error || 'Gagal mengeksekusi tukar shift.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan sistem saat memproses tukar shift.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedA = users.find((u) => u.id === employeeAId);
  const selectedB = users.find((u) => u.id === employeeBId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl p-6 border border-border shadow-2xl bg-card max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Otoritas Korlap &amp; Superadmin</span>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider border-border">
              PT. FAWWAZ RESKI PERWIRA
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2 pt-1">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            Tukar Shift Lapangan Cepat
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Penyesuaian dan pertukaran jadwal shift dinas antar-personil secara terotorisasi. Jadwal database dan PWA karyawan langsung ter-update seketika beserta notifikasi WhatsApp instan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* ── 1. TANGGAL & TIPE PENYESUAIAN ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Tanggal Dinas Ditukar
              </Label>
              <Input
                type="date"
                value={swapDate}
                onChange={(e) => setSwapDate(e.target.value)}
                className="text-xs rounded-xl h-9 font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Model Pertukaran Shift
              </Label>
              <Select
                value={swapType}
                onValueChange={(val) => setSwapType(val as any)}
              >
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="Pilih Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MUTUAL_SWAP" className="text-xs">
                    🔄 Saling Tukar Shift Normal (Rp 0 / Zero Lembur)
                  </SelectItem>
                  <SelectItem value="DAY_OFF_SWAP" className="text-xs">
                    🏖️ Tukar Hari Libur (Day-Off Swap)
                  </SelectItem>
                  <SelectItem value="RELIEF_OVERTIME" className="text-xs">
                    ⏱️ Lembur Pengganti Mandat (Terbitkan SPKL)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── 2. SELEKSI PERSONIL A & PERSONIL B ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            {/* Karyawan A */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">1</span>
                  Karyawan 1 (Asal)
                </span>
                {schedA && (
                  <Badge variant={schedA.isOff ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0.2">
                    {schedA.isOff ? 'LIBUR (OFF)' : schedA.shiftCode}
                  </Badge>
                )}
              </div>

              <Select value={employeeAId} onValueChange={setEmployeeAId}>
                <SelectTrigger className="text-xs rounded-xl h-9 bg-card">
                  <SelectValue placeholder="Pilih Karyawan 1..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} disabled={u.id === employeeBId} className="text-xs">
                      {u.fullName} ({u.nip}) • {u.divisionName || 'Operasional'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Live Preview Sched A */}
              {isLoadingSchedA ? (
                <div className="p-2.5 rounded-lg bg-card border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat jadwal saat ini...
                </div>
              ) : schedA ? (
                <div className="p-2.5 rounded-lg bg-card border border-border/80 space-y-1">
                  <div className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>{schedA.shiftName}</span>
                    <span className="font-mono text-muted-foreground">{schedA.startTime} – {schedA.endTime}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{schedA.notes || 'Jadwal Roster Normal'}</p>
                </div>
              ) : employeeAId ? (
                <div className="p-2 rounded-lg bg-card border border-border text-[11px] text-muted-foreground italic">
                  Belum ada rekaman jadwal khusus (mengikuti default shift)
                </div>
              ) : null}
            </div>

            {/* Karyawan B */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-[11px] font-bold">2</span>
                  Karyawan 2 (Pengganti / Lawan Tukar)
                </span>
                {schedB && (
                  <Badge variant={schedB.isOff ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0.2">
                    {schedB.isOff ? 'LIBUR (OFF)' : schedB.shiftCode}
                  </Badge>
                )}
              </div>

              <Select value={employeeBId} onValueChange={setEmployeeBId}>
                <SelectTrigger className="text-xs rounded-xl h-9 bg-card">
                  <SelectValue placeholder="Pilih Karyawan 2..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} disabled={u.id === employeeAId} className="text-xs">
                      {u.fullName} ({u.nip}) • {u.divisionName || 'Operasional'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Live Preview Sched B */}
              {isLoadingSchedB ? (
                <div className="p-2.5 rounded-lg bg-card border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat jadwal saat ini...
                </div>
              ) : schedB ? (
                <div className="p-2.5 rounded-lg bg-card border border-border/80 space-y-1">
                  <div className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>{schedB.shiftName}</span>
                    <span className="font-mono text-muted-foreground">{schedB.startTime} – {schedB.endTime}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{schedB.notes || 'Jadwal Roster Normal'}</p>
                </div>
              ) : employeeBId ? (
                <div className="p-2 rounded-lg bg-card border border-border text-[11px] text-muted-foreground italic">
                  Belum ada rekaman jadwal khusus (mengikuti default shift)
                </div>
              ) : null}
            </div>
          </div>

          {/* ── 3. VISUAL SUMMARY SWAP PERTUKARAN JADWAL ── */}
          {schedA && schedB && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Hasil Pertukaran Roster</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-card/80 border border-emerald-500/20 space-y-0.5">
                  <span className="text-muted-foreground">Jadwal Baru <strong>{selectedA?.fullName}</strong>:</span>
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">
                    ➔ {schedB.shiftName} ({schedB.startTime} – {schedB.endTime})
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-card/80 border border-emerald-500/20 space-y-0.5">
                  <span className="text-muted-foreground">Jadwal Baru <strong>{selectedB?.fullName}</strong>:</span>
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">
                    ➔ {schedA.shiftName} ({schedA.startTime} – {schedA.endTime})
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-emerald-500/10">
                <span>Konsekuensi Biaya Lembur:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {swapType === 'RELIEF_OVERTIME' ? 'Penerbitan SPKL Resmi Pengganti Pos' : 'Rp 0 (Tanpa Beban Uang Lembur)'}
                </span>
              </div>
            </div>
          )}

          {/* ── FATIGUE WARNING / FORCE OVERRIDE ── */}
          {fatigueWarning && (
            <div className="p-3 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{fatigueWarning}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    Sesuai PP 35/2021, karyawan berhak atas istirahat antar-shift minimal 11 jam.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 font-semibold text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceOverrideFatigue}
                  onChange={(e) => setForceOverrideFatigue(e.target.checked)}
                  className="rounded border-amber-500 text-amber-600 focus:ring-amber-500"
                />
                <span>Saya mengonfirmasi pemaksaan penugasan ini demi kelancaran operasional (Force Override).</span>
              </label>
            </div>
          )}

          {/* ── 4. ALASAN OPERASIONAL & CATATAN ── */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Alasan Operasional Pertukaran</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Misal: Penyesuaian rotasi dinas pos timbangan arahan Korlap"
                className="text-xs rounded-xl h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Catatan Tambahan (Opsional)</Label>
              <Textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Catatan khusus terkait pos atau instruksi serah terima tugas..."
                className="text-xs rounded-xl min-h-[50px] resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-9 rounded-xl font-medium"
          >
            Batal
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !employeeAId || !employeeBId}
            className="text-xs h-9 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Mengeksekusi Jadwal...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Eksekusi &amp; Kirim Notifikasi WA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
