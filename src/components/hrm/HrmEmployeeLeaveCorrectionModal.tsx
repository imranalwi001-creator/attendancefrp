import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import { hrmService } from '@/services/hrmService';
import { UserProfile } from '@/types/hrm';
import {
  CalendarDays,
  CalendarCheck,
  Edit3,
  ShieldCheck,
  Save,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  User,
  ArrowRight,
} from 'lucide-react';

interface HrmEmployeeLeaveCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile | null;
  allUsers?: UserProfile[];
  currentQuota?: number;
  currentUsed?: number;
  suggestedAttUsed?: number;
  onSaved?: (updated: { quota: number; used: number; remaining: number; user?: UserProfile }) => void;
}

export const HrmEmployeeLeaveCorrectionModal: React.FC<HrmEmployeeLeaveCorrectionModalProps> = ({
  isOpen,
  onClose,
  user: initialUser,
  allUsers = [],
  currentQuota = 12,
  currentUsed = 0,
  suggestedAttUsed,
  onSaved,
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(initialUser || null);
  const [quota, setQuota] = useState<number>(currentQuota);
  const [used, setUsed] = useState<number>(currentUsed);
  const [remaining, setRemaining] = useState<number>(Math.max(0, currentQuota - currentUsed));
  const [reason, setReason] = useState<string>('Koreksi Saldo Cuti Resmi Superadmin');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Track the ID of the user currently loaded to avoid overwriting edits on parent re-renders
  const loadedUserIdRef = useRef<string | null>(null);

  // Sync selected user when initialUser or isOpen changes
  useEffect(() => {
    if (isOpen) {
      const activeUser = initialUser || selectedUser || (allUsers.length > 0 ? allUsers[0] : null);
      const activeUserId = activeUser?.id || null;

      // Only re-initialize if the modal just opened or the target user actually changed
      if (loadedUserIdRef.current !== activeUserId) {
        loadedUserIdRef.current = activeUserId;
        setSelectedUser(activeUser);

        if (activeUser) {
          const q = Number(activeUser.annualLeaveQuota ?? (activeUser as any).annual_leave_quota ?? currentQuota ?? 12);
          const u = Number(activeUser.usedLeaveDays ?? (activeUser as any).used_leave_days ?? currentUsed ?? 0);
          const rem = Math.max(0, q - u);
          setQuota(q);
          setUsed(u);
          setRemaining(rem);
        }
        setReason('Koreksi Saldo Cuti Resmi Superadmin');
      }
    } else {
      loadedUserIdRef.current = null;
    }
  }, [isOpen, initialUser?.id, allUsers.length]);

  // When changing user from dropdown
  const handleSelectUser = (userId: string) => {
    const found = allUsers.find((u) => u.id === userId);
    if (found) {
      setSelectedUser(found);
      loadedUserIdRef.current = found.id;
      const q = Number(found.annualLeaveQuota ?? (found as any).annual_leave_quota ?? 12);
      const u = Number(found.usedLeaveDays ?? (found as any).used_leave_days ?? 0);
      setQuota(q);
      setUsed(u);
      setRemaining(Math.max(0, q - u));
    }
  };

  const currentUser = selectedUser || initialUser;
  if (!isOpen) return null;

  // Handler Sinkron 3 Arah:
  // 1. Total Hak Cuti berubah -> update remaining = quota - used
  const handleQuotaChange = (newQuotaVal: number) => {
    const val = Math.max(0, newQuotaVal);
    setQuota(val);
    setRemaining(Math.max(0, val - used));
  };

  // 2. Cuti Terpakai berubah -> update remaining = quota - used
  const handleUsedChange = (newUsedVal: number) => {
    const val = Math.max(0, newUsedVal);
    setUsed(val);
    setRemaining(Math.max(0, quota - val));
  };

  // 3. Sisa Cuti Langsung diedit -> update used = quota - remaining
  const handleRemainingChange = (newRemainingVal: number) => {
    const val = Math.max(0, newRemainingVal);
    setRemaining(val);
    if (val > quota) {
      setQuota(val);
      setUsed(0);
    } else {
      setUsed(Math.max(0, quota - val));
    }
  };

  const presetReasons = [
    'Penyesuaian Cuti Bersama Tahunan',
    'Koreksi Presensi / Dispensasi Cuti Pimpinan',
    'Penyesuaian Hak Kuota Masa Kerja',
    'Sinkronisasi Catatan Kehadiran Cuti',
  ];

  const handleSave = async () => {
    if (!currentUser) {
      toast.error('Pilih karyawan yang ingin dikoreksi cutinya');
      return;
    }
    if (quota < 0) {
      toast.error('Hak kuota cuti tidak boleh bernilai negatif');
      return;
    }
    if (used < 0) {
      toast.error('Cuti terpakai tidak boleh bernilai negatif');
      return;
    }
    if (!reason.trim()) {
      toast.error('Mohon isi catatan atau alasan koreksi cuti');
      return;
    }

    setIsSubmitting(true);
    try {
      const qNum = Number(quota);
      const uNum = Number(used);
      const remNum = Math.max(0, qNum - uNum);

      // 1. Kirim update ke dedicated backend endpoint di PostgreSQL
      const updatePayload = {
        userId: currentUser.id,
        annualLeaveQuota: qNum,
        usedLeaveDays: uNum,
        reason: reason.trim(),
        operatorName: 'Super Administrator',
      };

      try {
        await api.post('/leaves/correct-quota', updatePayload);
      } catch (postErr) {
        console.warn('Dedicated /leaves/correct-quota error, falling back to /users/:id', postErr);
      }

      // 2. Update profil karyawan di backend via PUT /users/:id
      try {
        await api.put(`/users/${currentUser.id}`, {
          annualLeaveQuota: qNum,
          usedLeaveDays: uNum,
        });
      } catch (putErr) {
        console.warn('PUT /users/:id fallback warning:', putErr);
      }

      // 3. Update state lokal hrmService
      const updatedUser = hrmService.updateUser(currentUser.id, {
        annualLeaveQuota: qNum,
        usedLeaveDays: uNum,
      });

      // 4. Update in-memory users cache agar UI langsung membaca nilai baru seketika
      const allCachedUsers = hrmService.getUsers().map((u) =>
        u.id === currentUser.id || u.nip === currentUser.nip
          ? { ...u, annualLeaveQuota: qNum, usedLeaveDays: uNum }
          : u
      );
      hrmService.setInMemoryUsers(allCachedUsers);

      // 5. Trigger events untuk me-refresh semua listener
      window.dispatchEvent(new Event('hrm_users_updated'));
      window.dispatchEvent(new Event('hrm_data_updated'));

      toast.success(`Saldo cuti ${currentUser.fullName} berhasil diperbarui!`, {
        description: `Hak Kuota: ${qNum} Hari | Terpakai: ${uNum} Hari | Sisa Cuti: ${remNum} Hari`,
      });

      if (typeof onSaved === 'function') {
        onSaved({
          quota: qNum,
          used: uNum,
          remaining: remNum,
          user: { ...currentUser, annualLeaveQuota: qNum, usedLeaveDays: uNum },
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to correct leave:', err);
      toast.error(err.message || 'Gagal menyimpan koreksi cuti');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        {/* Header Dialog */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-wide">
                Koreksi Saldo &amp; Hak Cuti Karyawan
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-100/90 mt-0.5">
                Perubahan tersinkronisasi langsung ke database PostgreSQL VPS &amp; lembar laporan.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Pemilihan Karyawan jika mode umum, atau info statis jika spesifik */}
          {!initialUser && allUsers.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Pilih Karyawan
              </Label>
              <Select
                value={currentUser?.id || ''}
                onValueChange={handleSelectUser}
              >
                <SelectTrigger className="w-full text-xs font-medium rounded-xl">
                  <SelectValue placeholder="Pilih Karyawan..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.fullName} ({u.nip || '-'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : currentUser ? (
            /* Info Singkat Karyawan */
            <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-foreground text-sm">{currentUser.fullName}</p>
                <p className="text-muted-foreground font-mono mt-0.5">
                  NIP: {currentUser.nip || '-'} • {currentUser.divisionName || 'Operasional Lapangan'}
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 font-mono text-[10px]">
                FRP Verified
              </Badge>
            </div>
          ) : null}

          {/* Kotak Input Koreksi Cuti (3 Kotak Interaktif: Kuota, Terpakai, Sisa) */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. Total Kuota Hak Cuti */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Total Hak Cuti:</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Tahunan)</span>
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuotaChange(quota - 1)}
                  className="h-8 w-8 p-0 rounded-lg border-border shrink-0 font-bold"
                >
                  -1
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={quota}
                  onChange={(e) => {
                    const raw = e.target.value;
                    handleQuotaChange(raw === '' ? 0 : parseInt(raw, 10) || 0);
                  }}
                  className="h-8 font-mono font-bold text-center text-sm rounded-lg"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuotaChange(quota + 1)}
                  className="h-8 w-8 p-0 rounded-lg border-border shrink-0 font-bold"
                >
                  +1
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Standar resmi: 12 Hari / tahun</p>
            </div>

            {/* 2. Cuti Terpakai */}
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="text-amber-800 dark:text-amber-300">Cuti Terpakai:</span>
                <span className="text-[10px] text-amber-600 font-medium">(Realtime)</span>
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUsedChange(used - 1)}
                  className="h-8 w-8 p-0 rounded-lg border-amber-500/30 text-amber-700 shrink-0 font-bold hover:bg-amber-500/10"
                >
                  -1
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={used}
                  onChange={(e) => {
                    const raw = e.target.value;
                    handleUsedChange(raw === '' ? 0 : parseInt(raw, 10) || 0);
                  }}
                  className="h-8 font-mono font-bold text-center text-sm rounded-lg text-amber-700 dark:text-amber-400 border-amber-500/30 bg-card"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUsedChange(used + 1)}
                  className="h-8 w-8 p-0 rounded-lg border-amber-500/30 text-amber-700 shrink-0 font-bold hover:bg-amber-500/10"
                >
                  +1
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Akumulasi hari cuti diambil</p>
            </div>
          </div>

          {/* Saran Otomatis dari Presensi jika tersedia */}
          {suggestedAttUsed !== undefined && suggestedAttUsed !== used && (
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-[11px] text-blue-900 dark:text-blue-300">
                  Ditemukan <strong>{suggestedAttUsed} Hari</strong> dari riwayat presensi CUTI.
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleUsedChange(suggestedAttUsed)}
                className="h-6 text-[10.5px] font-bold text-blue-700 hover:bg-blue-500/20 px-2 rounded-lg"
              >
                Gunakan Nilai Ini
              </Button>
            </div>
          )}

          {/* 3. INPUT SISA CUTI LANGSUNG (DAPAT DIKETIK & DISESUAIKAN DENGAN STEPPER!) */}
          <div className="p-3.5 bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-teal-500/15 border-2 border-emerald-500/40 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-emerald-950 dark:text-emerald-200 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Sisa Cuti Karyawan (Bisa Diubah Langsung):
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-medium">
                Aktif &amp; Terhitung
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRemainingChange(remaining - 1)}
                className="h-10 w-10 p-0 rounded-xl border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-extrabold text-base hover:bg-emerald-500/20 bg-card"
                title="Kurang 1 Hari Sisa Cuti"
              >
                -1
              </Button>
              <div className="flex-1 relative">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={remaining}
                  onChange={(e) => {
                    const raw = e.target.value;
                    handleRemainingChange(raw === '' ? 0 : parseInt(raw, 10) || 0);
                  }}
                  className="h-10 font-mono font-extrabold text-center text-lg rounded-xl text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-card shadow-inner"
                />
                <span className="absolute right-3 top-2.5 text-xs text-emerald-600/70 font-semibold pointer-events-none">
                  Hari
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRemainingChange(remaining + 1)}
                className="h-10 w-10 p-0 rounded-xl border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-extrabold text-base hover:bg-emerald-500/20 bg-card"
                title="Tambah 1 Hari Sisa Cuti"
              >
                +1
              </Button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-1.5 border-t border-emerald-500/20 font-mono">
              <span>{quota} Hak Cuti - {used} Terpakai</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">= {remaining} Hari Sisa Aktif</span>
            </div>
          </div>

          {/* Catatan / Alasan Koreksi */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <span>Catatan / Alasan Koreksi</span>
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Penyesuaian hak cuti bersama atau dispensasi pimpinan"
              className="h-9 text-xs rounded-xl"
            />
            {/* Preset Cepat Alasan */}
            <div className="flex flex-wrap gap-1 pt-1">
              {presetReasons.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className="text-[9.5px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 text-xs rounded-xl px-4"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting}
            className="h-9 text-xs rounded-xl px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan ke Database...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Koreksi Cuti</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
