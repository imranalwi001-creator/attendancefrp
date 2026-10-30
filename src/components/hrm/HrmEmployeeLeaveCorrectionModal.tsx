import React, { useState, useEffect } from 'react';
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
  const [reason, setReason] = useState<string>('Koreksi Saldo Cuti Resmi Superadmin');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync selected user when initialUser or isOpen changes
  useEffect(() => {
    if (isOpen) {
      const activeUser = initialUser || selectedUser || (allUsers.length > 0 ? allUsers[0] : null);
      setSelectedUser(activeUser);
      if (activeUser) {
        const q = Number(activeUser.annualLeaveQuota ?? (activeUser as any).annual_leave_quota ?? currentQuota ?? 12);
        const u = Number(currentUsed || activeUser.usedLeaveDays || (activeUser as any).used_leave_days || 0);
        setQuota(q);
        setUsed(u);
      }
      setReason('Koreksi Saldo Cuti Resmi Superadmin');
    }
  }, [isOpen, initialUser, allUsers, currentQuota, currentUsed]);

  // When changing user from dropdown
  const handleSelectUser = (userId: string) => {
    const found = allUsers.find((u) => u.id === userId);
    if (found) {
      setSelectedUser(found);
      const q = Number(found.annualLeaveQuota ?? (found as any).annual_leave_quota ?? 12);
      const u = Number(found.usedLeaveDays ?? (found as any).used_leave_days ?? 0);
      setQuota(q);
      setUsed(u);
    }
  };

  const currentUser = selectedUser || initialUser;
  if (!isOpen) return null;

  const remaining = Math.max(0, quota - used);

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
      // 1. Kirim update ke endpoint dedicated di backend
      const res = await api.post<{ success: boolean; data?: any; message?: string }>('/leaves/correct-quota', {
        userId: currentUser.id,
        annualLeaveQuota: Number(quota),
        usedLeaveDays: Number(used),
        reason: reason.trim(),
        operatorName: 'Super Administrator',
      });

      // Backup update via PUT /users/:id jika endpoint baru belum tersedia
      if (!res || !res.success) {
        await api.put(`/users/${currentUser.id}`, {
          annualLeaveQuota: Number(quota),
          usedLeaveDays: Number(used),
        });
      }

      // 2. Update state lokal hrmService
      const updatedUser: UserProfile = {
        ...currentUser,
        annualLeaveQuota: Number(quota),
        usedLeaveDays: Number(used),
      };
      hrmService.updateUser(updatedUser);

      toast.success(`Saldo cuti untuk ${currentUser.fullName} berhasil diperbarui!`, {
        description: `Hak Kuota: ${quota} Hari | Terpakai: ${used} Hari | Sisa: ${remaining} Hari`,
      });

      if (typeof onSaved === 'function') {
        onSaved({ quota: Number(quota), used: Number(used), remaining, user: updatedUser });
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
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-border bg-card">
        {/* Header Dialog */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-wide">
                Koreksi Saldo &amp; Hak Cuti Karyawan
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-100/90 mt-0.5">
                Perubahan tersinkronisasi langsung ke PostgreSQL VPS dan data lembar laporan.
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
            <div className="p-3 bg-muted/30 rounded-xl border border-border flex items-center justify-between text-xs">
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

          {/* Form Input Kuota & Terpakai */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. Total Kuota Hak Cuti */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Total Hak Cuti:</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Tahunan)</span>
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuota((prev) => Math.max(0, prev - 1))}
                  className="h-9 w-9 p-0 rounded-xl border-border shrink-0"
                >
                  -1
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={quota}
                  onChange={(e) => setQuota(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-9 font-mono font-bold text-center text-sm rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuota((prev) => prev + 1)}
                  className="h-9 w-9 p-0 rounded-xl border-border shrink-0"
                >
                  +1
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Standar resmi: 12 Hari / tahun</p>
            </div>

            {/* 2. Cuti Terpakai */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Cuti Terpakai:</span>
                <span className="text-[10px] text-amber-600 font-medium">(Realtime)</span>
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUsed((prev) => Math.max(0, prev - 1))}
                  className="h-9 w-9 p-0 rounded-xl border-border shrink-0"
                >
                  -1
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={used}
                  onChange={(e) => setUsed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-9 font-mono font-bold text-center text-sm rounded-xl text-amber-700 dark:text-amber-400"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUsed((prev) => prev + 1)}
                  className="h-9 w-9 p-0 rounded-xl border-border shrink-0"
                >
                  +1
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Akumulasi yang telah diambil</p>
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
                onClick={() => setUsed(suggestedAttUsed)}
                className="h-6 text-[10.5px] font-bold text-blue-700 hover:bg-blue-500/20 px-2 rounded-lg"
              >
                Gunakan Nilai Ini
              </Button>
            </div>
          )}

          {/* Pratinjau Sisa Cuti Baru (Realtime Live Result) */}
          <div className="p-3 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Pratinjau Hasil Sisa Cuti Baru:
              </span>
              <span className="text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                {remaining} Hari
              </span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground mt-1 pt-1 border-t border-emerald-500/20 font-mono">
              <span>{quota} Hak Cuti - {used} Terpakai</span>
              <span className="text-emerald-700 font-medium">= {remaining} Hari Sisa Aktif</span>
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
                  className="text-[9.5px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
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
            className="h-9 text-xs rounded-xl px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
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
