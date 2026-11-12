import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import { hrmService } from '@/services/hrmService';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Minus,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react';
import type {
  ExecutiveLeaveRecapResponse,
  LeaveExecutiveRecapRow,
} from '@/components/hrm/superadmin/HrmLeaveExecutiveRecapTab';

const MONTH_SHORT_ID: Record<string, string> = {
  '01': 'JAN',
  '02': 'FEB',
  '03': 'MAR',
  '04': 'APR',
  '05': 'MEI',
  '06': 'JUN',
  '07': 'JUL',
  '08': 'AGU',
  '09': 'SEP',
  '10': 'OKT',
  '11': 'NOV',
  '12': 'DES',
};

const formatMonthLabel = (mk: string) => {
  const [y, m] = String(mk || '').split('-');
  return `${MONTH_SHORT_ID[m] || m} '${(y || '').slice(2)}`;
};

interface HrmMonthlyLeaveRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: LeaveExecutiveRecapRow | null;
  monthKeys: string[];
  focusedMonthKey?: string | null;
  onSaved?: (recap?: ExecutiveLeaveRecapResponse) => void;
}

const PRESET_REASONS = [
  'Revisi data cuti bulanan sesuai catatan lapangan',
  'Koreksi selisih rekap absensi & buku cuti',
  'Pembatalan / perubahan jadwal cuti karyawan',
];

export const HrmMonthlyLeaveRevisionModal: React.FC<HrmMonthlyLeaveRevisionModalProps> = ({
  isOpen,
  onClose,
  row,
  monthKeys,
  focusedMonthKey,
  onSaved,
}) => {
  const [monthlyValues, setMonthlyValues] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>('Revisi data cuti bulanan oleh Admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const focusedInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && row) {
      const initial: Record<string, number> = {};
      monthKeys.forEach((mk) => {
        initial[mk] = Math.max(0, Number(row.months?.[mk] || 0));
      });
      setMonthlyValues(initial);
      setReason('Revisi data cuti bulanan oleh Admin');

      if (focusedMonthKey) {
        setTimeout(() => {
          focusedInputRef.current?.focus();
          focusedInputRef.current?.select();
        }, 60);
      }
    }
  }, [isOpen, row?.userId, focusedMonthKey, monthKeys.join(',')]);

  const summary = useMemo(() => {
    if (!row) {
      return {
        newTotalInMonths: 0,
        newTotalUsed: 0,
        newRemaining: 0,
        changedMonths: [] as Array<{ mk: string; prev: number; next: number }>,
      };
    }
    const changedMonths: Array<{ mk: string; prev: number; next: number }> = [];
    let newTotalInMonths = 0;
    monthKeys.forEach((mk) => {
      const prev = Math.max(0, Number(row.months?.[mk] || 0));
      const next = Math.max(0, Number(monthlyValues[mk] || 0));
      newTotalInMonths += next;
      if (prev !== next) {
        changedMonths.push({ mk, prev, next });
      }
    });

    const otherAdj = Number(row.otherManualAdjustment || 0);
    const newTotalUsed = Math.max(0, newTotalInMonths + otherAdj);
    const newRemaining = Math.max(0, Number(row.quota || 0) - newTotalUsed);

    return {
      newTotalInMonths,
      newTotalUsed,
      newRemaining,
      changedMonths,
    };
  }, [row, monthKeys, monthlyValues]);

  if (!isOpen || !row) return null;

  const updateMonthValue = (mk: string, nextVal: number) => {
    const clean = Number.isNaN(nextVal) ? 0 : Math.max(0, Math.min(31, Math.trunc(nextVal)));
    setMonthlyValues((prev) => ({ ...prev, [mk]: clean }));
  };

  const handleReset = () => {
    const resetMap: Record<string, number> = {};
    monthKeys.forEach((mk) => {
      resetMap[mk] = Math.max(0, Number(row.months?.[mk] || 0));
    });
    setMonthlyValues(resetMap);
  };

  const handleSave = async () => {
    if (summary.changedMonths.length === 0) {
      toast.info('Tidak ada perubahan angka cuti bulanan untuk disimpan.');
      onClose();
      return;
    }
    if (!reason.trim()) {
      toast.error('Mohon isi catatan atau alasan revisi cuti bulanan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentAdmin = hrmService.getCurrentUser();
      const res: any = await api.put('/leaves/monthly-revision', {
        userId: row.userId,
        monthlyValues,
        reason: reason.trim(),
        operatorName: currentAdmin?.fullName || 'Super Administrator',
      });

      if (!res?.success) {
        throw new Error(res?.error || 'Gagal menyimpan revisi cuti bulanan');
      }

      const updatedUsed = Number(res?.data?.usedLeaveDays ?? summary.newTotalUsed);
      const updatedQuota = Number(res?.data?.annualLeaveQuota ?? row.quota);
      const updatedRemaining = Number(res?.data?.remainingLeaveDays ?? Math.max(0, updatedQuota - updatedUsed));

      // Sinkronkan cache lokal hrmService & localStorage agar seluruh halaman Admin & PWA langsung sinkron
      const cachedUsers = hrmService.getUsers();
      if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
        const nextUsers = cachedUsers.map((u) =>
          u.id === row.userId || (row.nip && u.nip === row.nip)
            ? { ...u, usedLeaveDays: updatedUsed, annualLeaveQuota: updatedQuota }
            : u
        );
        hrmService.setInMemoryUsers(nextUsers);
      }

      try {
        const rawCur = localStorage.getItem('hrm_current_user');
        if (rawCur) {
          const cur = JSON.parse(rawCur);
          if (cur && (cur.id === row.userId || (row.nip && cur.nip === row.nip))) {
            cur.usedLeaveDays = updatedUsed;
            cur.annualLeaveQuota = updatedQuota;
            localStorage.setItem('hrm_current_user', JSON.stringify(cur));
          }
        }
      } catch (_) {}

      window.dispatchEvent(new Event('hrm_users_updated'));
      window.dispatchEvent(new Event('hrm_leaves_updated'));
      window.dispatchEvent(new Event('hrm_data_updated'));

      toast.success(`Revisi cuti bulanan ${row.fullName} tersimpan!`, {
        description: `${summary.changedMonths.length} bulan direvisi • Terpakai: ${updatedUsed} Hari • Sisa Hak: ${updatedRemaining} Hari`,
      });

      if (typeof onSaved === 'function') {
        onSaved(res?.recap);
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || 'Gagal menyimpan revisi cuti bulanan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const overQuota = summary.newTotalUsed > row.quota;
  const usedDelta = summary.newTotalUsed - row.usedLeaveDays;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl max-h-[92vh] flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-5 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">
                  Revisi Cuti Bulanan Karyawan
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-100/90 mt-0.5">
                  Perubahan otomatis tersimpan ke PostgreSQL Ledger &amp; tersinkron ke Web Admin serta PWA Karyawan.
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-mono shrink-0">
              {row.group}
            </Badge>
          </div>

          <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-white">{row.fullName}</span>
              <span className="ml-2 font-mono text-emerald-100/90">({row.nip})</span>
              <span className="ml-2 text-emerald-100/80">• {row.divisionName}</span>
            </div>
            <div className="font-mono text-[11px] bg-white/15 px-2.5 py-1 rounded-lg">
              Hak Tahunan: <strong>{row.quota} Hari</strong>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-bold text-foreground">
              Rincian Hari Cuti Terpakai Per Bulan ({monthKeys.length} Bulan)
            </Label>
            {summary.changedMonths.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset ke Nilai Awal
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {monthKeys.map((mk) => {
              const initialVal = Math.max(0, Number(row.months?.[mk] || 0));
              const currentVal = Math.max(0, Number(monthlyValues[mk] || 0));
              const isModified = currentVal !== initialVal;
              const isFocused = focusedMonthKey === mk;
              const bd = row.monthBreakdown?.[mk];
              const hasReq = (bd?.approvedReq || 0) + (bd?.pendingReq || 0) > 0;
              const hasManual = (bd?.manualAdj || 0) !== 0;

              return (
                <div
                  key={mk}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isModified
                      ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30'
                      : isFocused
                      ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/40'
                      : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[11px] font-bold text-foreground font-mono">
                      {formatMonthLabel(mk)}
                    </span>
                    {isModified ? (
                      <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 h-4 font-mono">
                        {initialVal}→{currentVal}
                      </Badge>
                    ) : hasManual ? (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-500/40 text-blue-600 dark:text-blue-400">
                        Revisi
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateMonthValue(mk, currentVal - 1)}
                      disabled={currentVal <= 0 || isSubmitting}
                      className="h-8 w-8 rounded-lg shrink-0"
                      aria-label={`Kurangi cuti ${formatMonthLabel(mk)}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Input
                      ref={isFocused ? focusedInputRef : undefined}
                      type="number"
                      min={0}
                      max={31}
                      value={currentVal}
                      onChange={(e) => updateMonthValue(mk, parseInt(e.target.value || '0', 10))}
                      disabled={isSubmitting}
                      className="h-8 text-center font-mono font-bold text-sm rounded-lg px-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => updateMonthValue(mk, currentVal + 1)}
                      disabled={currentVal >= 31 || isSubmitting}
                      className="h-8 w-8 rounded-lg shrink-0"
                      aria-label={`Tambah cuti ${formatMonthLabel(mk)}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {(hasReq || (bd?.baseline || 0) > 0 || hasManual) && (
                    <p className="text-[9.5px] text-muted-foreground mt-1 truncate font-mono">
                      {[
                        bd?.baseline ? `Base:${bd.baseline}` : '',
                        bd?.approvedReq ? `Req:${bd.approvedReq}` : '',
                        bd?.pendingReq ? `Pend:${bd.pendingReq}` : '',
                        bd?.manualAdj ? `Adj:${bd.manualAdj > 0 ? `+${bd.manualAdj}` : bd.manualAdj}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live Summary Box */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border text-center">
            <div>
              <span className="block text-[10px] text-muted-foreground">Hak Cuti</span>
              <span className="text-sm font-bold font-mono text-foreground">{row.quota} Hari</span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground">Total Terpakai</span>
              <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                {summary.newTotalUsed} Hari
                {usedDelta !== 0 && (
                  <span className="ml-1 text-[10px]">
                    ({usedDelta > 0 ? `+${usedDelta}` : usedDelta})
                  </span>
                )}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-muted-foreground">Sisa Hak</span>
              <span
                className={`text-sm font-bold font-mono ${
                  summary.newRemaining === 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {summary.newRemaining} Hari
              </span>
            </div>
          </div>

          {overQuota && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Total terpakai ({summary.newTotalUsed} hari) melebihi hak tahunan ({row.quota} hari). Sisa kuota di PWA karyawan akan menjadi <strong>0 Hari (Habis)</strong>.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Catatan / Alasan Revisi
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Revisi cuti Nov 2026 sesuai jadwal koreksi"
              className="h-9 text-xs rounded-xl"
              disabled={isSubmitting}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="text-[10px] px-2 py-0.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              {summary.changedMonths.length > 0
                ? `${summary.changedMonths.length} bulan siap direvisi`
                : 'Belum ada perubahan'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting || summary.changedMonths.length === 0}
              className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Revisi & Sinkronkan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

