import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types/hrm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Sliders, ShieldCheck, CheckCircle2, User, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { hrmService } from '@/services/hrmService';
import { api } from '@/services/apiClient';

interface HrmEmployeePolicyModalProps {
  open: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSaved?: (updatedUser?: UserProfile) => void;
}

export const HrmEmployeePolicyModal: React.FC<HrmEmployeePolicyModalProps> = ({
  open,
  user,
  onClose,
  onSaved,
}) => {
  // Cuti States
  const [annualLeaveQuota, setAnnualLeaveQuota] = useState<number>(12);
  const [usedLeaveDays, setUsedLeaveDays] = useState<number>(0);
  const [emergencyQuota, setEmergencyQuota] = useState<number>(2);

  // Izin States
  const [permissionQuota, setPermissionQuota] = useState<number>(5);
  const [usedPermissionDays, setUsedPermissionDays] = useState<number>(0);

  // Lembur States
  const [overtimeEligible, setOvertimeEligible] = useState<boolean>(true);
  const [maxDailyOtHours, setMaxDailyOtHours] = useState<number>(4);
  const [otRateOverride, setOtRateOverride] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setAnnualLeaveQuota(user.annualLeaveQuota ?? 12);
      setUsedLeaveDays(user.usedLeaveDays ?? 0);
      setEmergencyQuota((user as any).emergencyDiscretionaryQuota ?? 2);

      setPermissionQuota((user as any).permissionQuota ?? 5);
      setUsedPermissionDays((user as any).usedPermissionDays ?? 0);

      setOvertimeEligible((user as any).overtimeEligible !== false);
      setMaxDailyOtHours((user as any).maxDailyOvertimeHours ?? 4);
      setOtRateOverride(
        (user as any).overtimeRateOverride ? String((user as any).overtimeRateOverride) : ''
      );
    }
  }, [user, open]);

  if (!user) return null;

  const remainingLeave = Math.max(0, annualLeaveQuota - usedLeaveDays);
  const remainingPermission = Math.max(0, permissionQuota - usedPermissionDays);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        annualLeaveQuota: Number(annualLeaveQuota),
        usedLeaveDays: Number(usedLeaveDays),
        emergencyDiscretionaryQuota: Number(emergencyQuota),
        permissionQuota: Number(permissionQuota),
        usedPermissionDays: Number(usedPermissionDays),
        overtimeEligible: Boolean(overtimeEligible),
        maxDailyOvertimeHours: Number(maxDailyOtHours),
        overtimeRateOverride: otRateOverride ? Number(otRateOverride) : null,
      };

      // 1. Update backend PostgreSQL
      const res = await api.put<any>(`/users/${user.id}`, payload);

      // 2. Update local state hrmService
      const updatedUser: UserProfile = {
        ...user,
        ...payload,
      };
      hrmService.updateUser(updatedUser);

      toast.success(`Kebijakan cuti, izin, & lembur untuk ${user.fullName} berhasil diperbarui!`);
      if (typeof onSaved === 'function') onSaved(updatedUser);
      onClose();
    } catch (err: any) {
      console.error('Save policy error:', err);
      toast.error('Gagal menyimpan kebijakan karyawan: ' + (err.message || 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Konfigurasi Kebijakan Karyawan
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Atur hak &amp; kuota cuti, izin, serta kebijakan lembur khusus per individu.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* User Card Mini */}
        <div className="p-3 bg-muted/40 rounded-xl border border-border/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
              {user.fullName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-foreground">{user.fullName}</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {user.nip || '-'} • {user.divisionName || 'Operasional'}
              </p>
            </div>
          </div>
          {(user as any).operationalGroup && (
            <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-700 bg-blue-50/50">
              {(user as any).operationalGroup}
            </Badge>
          )}
        </div>

        <div className="space-y-4 py-2 text-xs">
          {/* ═══ SECTION 1: CUTI TAHUNAN & DARURAT ═══ */}
          <div className="space-y-2 p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                1. Pengaturan Cuti Tahunan
              </span>
              <span className="text-[11px] text-emerald-600 font-bold">
                Sisa: {remainingLeave} Hari
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-[11px] text-muted-foreground">Plafon Cuti Tahunan (Hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={annualLeaveQuota}
                  onChange={(e) => setAnnualLeaveQuota(Number(e.target.value))}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Cuti Telah Terpakai (Hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={usedLeaveDays}
                  onChange={(e) => setUsedLeaveDays(Number(e.target.value))}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
            </div>
          </div>

          {/* ═══ SECTION 2: IZIN OPERASIONAL ═══ */}
          <div className="space-y-2 p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                2. Pengaturan Kuota Izin
              </span>
              <span className="text-[11px] text-indigo-600 font-bold">
                Sisa: {remainingPermission} Hari
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-[11px] text-muted-foreground">Plafon Kuota Izin (Hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={permissionQuota}
                  onChange={(e) => setPermissionQuota(Number(e.target.value))}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Izin Telah Terpakai (Hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={usedPermissionDays}
                  onChange={(e) => setUsedPermissionDays(Number(e.target.value))}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
            </div>
          </div>

          {/* ═══ SECTION 3: KEBIJAKAN LEMBUR (SPKL) ═══ */}
          <div className="space-y-2.5 p-3 bg-card rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                3. Kebijakan &amp; Batasan Lembur
              </span>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="ot-switch" className="text-[10px] text-muted-foreground cursor-pointer">
                  {overtimeEligible ? 'Lembur Aktif' : 'Nonaktif'}
                </Label>
                <Switch
                  id="ot-switch"
                  checked={overtimeEligible}
                  onCheckedChange={setOvertimeEligible}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div>
                <Label className="text-[11px] text-muted-foreground">Batas Maks. Lembur/Hari (Jam)</Label>
                <Input
                  type="number"
                  step={0.5}
                  min={1}
                  max={12}
                  disabled={!overtimeEligible}
                  value={maxDailyOtHours}
                  onChange={(e) => setMaxDailyOtHours(Number(e.target.value))}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Tarif Override / Jam (Rp)</Label>
                <Input
                  type="number"
                  placeholder="Standar UMR/Pokok"
                  disabled={!overtimeEligible}
                  value={otRateOverride}
                  onChange={(e) => setOtRateOverride(e.target.value)}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
            </div>
            <p className="text-[10.5px] text-muted-foreground italic">
              * Jika tarif override dikosongkan, sistem otomatis menerapkan tarif dasar resmi FRP (Rp 23.381 - 24.173 / jam).
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs rounded-xl">
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting}
            className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                Simpan Kebijakan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
