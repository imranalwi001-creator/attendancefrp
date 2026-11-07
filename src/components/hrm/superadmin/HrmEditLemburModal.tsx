import React, { useState, useEffect, useMemo } from 'react';
import { OvertimeRecord, OvertimeStatus } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';
import { hrmHolidayService } from '@/services/hrmHolidayService';
import { resolveEffectiveShift } from '@/lib/hrmShiftResolver';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Clock,
  Calendar,
  AlertTriangle,
  User,
  Briefcase,
  Trash2,
  Save,
  CheckCircle2,
  Zap,
} from 'lucide-react';

interface HrmEditLemburModalProps {
  open: boolean;
  onClose: () => void;
  record: OvertimeRecord | null;
  onSuccess: () => void;
}

export const HrmEditLemburModal: React.FC<HrmEditLemburModalProps> = ({
  open,
  onClose,
  record,
  onSuccess,
}) => {
  const [date, setDate] = useState<string>('');
  const [shiftPreset, setShiftPreset] = useState<'shift1' | 'shift2' | 'shift3' | 'dayshift' | 'darurat' | 'custom'>('custom');
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('15:30');
  const [durationHours, setDurationHours] = useState<number>(8.0);
  const [isWeekendHoliday, setIsWeekendHoliday] = useState<boolean>(false);
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [status, setStatus] = useState<OvertimeStatus>('approved');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (open && record) {
      const recDate = record.date ? record.date.substring(0, 10) : new Date().toISOString().split('T')[0];
      setDate(recDate);
      const sStart = record.startTime ? record.startTime.substring(0, 5) : '07:30';
      const sEnd = record.endTime ? record.endTime.substring(0, 5) : '15:30';
      setStartTime(sStart);
      setEndTime(sEnd);
      setDurationHours(Number(record.approvedHours || record.durationHours || 8.0));
      setTaskDescription(record.taskDescription || '');
      setStatus(record.status || 'approved');
      setApprovalNotes(record.approvalNotes || '');

      // Deteksi hari libur
      const holCheck = hrmHolidayService.isWeekendOrHoliday(recDate);
      setIsWeekendHoliday(record.isWeekendHoliday !== undefined ? record.isWeekendHoliday : holCheck.isWeekendOrHoliday);

      // Cek apakah cocok dengan preset shift baku FRP
      if (sStart === '07:30' && sEnd === '15:30') {
        setShiftPreset('shift1');
      } else if (sStart === '15:30' && sEnd === '22:30') {
        setShiftPreset('shift2');
      } else if (sStart === '22:30' && sEnd === '07:30') {
        setShiftPreset('shift3');
      } else if (sStart === '07:30' && sEnd === '16:30') {
        setShiftPreset('dayshift');
      } else if (sStart === '16:30' && sEnd === '19:30') {
        setShiftPreset('darurat');
      } else {
        setShiftPreset('custom');
      }
    }
  }, [open, record]);

  const applyPreset = (preset: 'shift1' | 'shift2' | 'shift3' | 'dayshift' | 'darurat' | 'custom') => {
    setShiftPreset(preset);
    switch (preset) {
      case 'shift1':
        setStartTime('07:30');
        setEndTime('15:30');
        setDurationHours(8.0);
        break;
      case 'shift2':
        setStartTime('15:30');
        setEndTime('22:30');
        setDurationHours(7.0);
        break;
      case 'shift3':
        setStartTime('22:30');
        setEndTime('07:30');
        setDurationHours(9.0);
        break;
      case 'dayshift':
        setStartTime('07:30');
        setEndTime('16:30');
        setDurationHours(8.0);
        break;
      case 'darurat':
        setStartTime('16:30');
        setEndTime('19:30');
        setDurationHours(3.0);
        break;
      case 'custom':
        calculateCustomDuration(startTime, endTime);
        break;
    }
  };

  const calculateCustomDuration = (start: string, end: string) => {
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // Cross-midnight
      const hrs = Math.max(0.5, Math.round((diff / 60) * 10) / 10);
      setDurationHours(hrs);
    } catch {
      setDurationHours(2.0);
    }
  };

  const handleDateChange = (val: string) => {
    setDate(val);
    const holCheck = hrmHolidayService.isWeekendOrHoliday(val);
    setIsWeekendHoliday(holCheck.isWeekendOrHoliday);
  };

  const [serverSchedule, setServerSchedule] = useState<any | null>(null);

  // Live fetch schedule for target user and date directly from server API
  useEffect(() => {
    if (!open || !record?.userId || !date) return;
    let isMounted = true;
    fetch(`/api/employee-schedules/today/${encodeURIComponent(record.userId)}?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setServerSchedule(res.data);
          const isOff = Boolean(res.data.isOff || res.data.shiftCode === 'OFF');
          const holCheck = hrmHolidayService.isWeekendOrHoliday(date);
          if (isOff || holCheck.isNationalHoliday) {
            setIsWeekendHoliday(true);
          } else {
            setIsWeekendHoliday(false);
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [open, record?.userId, date]);

  const targetUser = useMemo(() => {
    if (!record?.userId) return null;
    return hrmService.getUsers().find((u) => u.id === record.userId);
  }, [record?.userId]);

  const userCurrentShift = useMemo(() => {
    if (!targetUser) return null;
    if (serverSchedule) {
      return {
        id: serverSchedule.shiftId || `sched-${serverSchedule.shiftCode}`,
        code: serverSchedule.shiftCode || 'REG',
        name: serverSchedule.shiftName || 'Shift Reguler',
        startTime: (serverSchedule.startTime || '07:30').substring(0, 5),
        endTime: (serverSchedule.endTime || '15:30').substring(0, 5),
        isCrossDay: Boolean(serverSchedule.isNightShift),
        isOff: Boolean(serverSchedule.isOff),
        lateToleranceMinutes: 15,
      };
    }
    const allShifts = hrmService.getShifts();
    const dailySched = hrmService.getEmployeeTodaySchedule(targetUser.id, date);
    return resolveEffectiveShift(targetUser, allShifts, dailySched);
  }, [targetUser, date, serverSchedule]);

  const applySambungShift = (direction: 'maju' | 'mundur') => {
    const sStart = (userCurrentShift?.startTime || '07:30').substring(0, 5);
    const sEnd = (userCurrentShift?.endTime || '15:30').substring(0, 5);
    const shiftNameUpper = (userCurrentShift?.name || '').toUpperCase();
    const shiftCodeUpper = (userCurrentShift?.code || '').toUpperCase();

    const isShift1 = shiftCodeUpper.includes('SHF-I') || shiftCodeUpper === 'P' || shiftNameUpper.includes('SHIFT 1') || shiftNameUpper.includes('SHIFT I ') || (sStart === '07:30' && sEnd === '15:30');
    const isShift2 = shiftCodeUpper.includes('SHF-II') || shiftCodeUpper === 'S' || shiftNameUpper.includes('SHIFT 2') || shiftNameUpper.includes('SHIFT II') || (sStart === '15:30' && sEnd === '22:30');
    const isShift3 = shiftCodeUpper.includes('SHF-III') || shiftCodeUpper === 'M' || shiftNameUpper.includes('SHIFT 3') || shiftNameUpper.includes('SHIFT III') || (sStart === '22:30' && sEnd === '07:30');
    const isOff = userCurrentShift?.isOff || shiftCodeUpper === 'OFF';

    if (isOff) {
      toast.info(`Karyawan terjadwal LIBUR/OFF pada ${date}. Silakan pilih shift penugasan lembur pengganti pos.`);
      return;
    }

    if (direction === 'maju') {
      if (isShift1) {
        setStartTime('15:30');
        setEndTime('22:30');
        setDurationHours(7.0);
        setShiftPreset('shift2');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Sambung Shift Maju ke Shift 2 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Maju Aktif: Shift 2 (15:30 - 22:30 WITA, 7 Jam)`);
      } else if (isShift2) {
        setStartTime('22:30');
        setEndTime('07:30');
        setDurationHours(9.0);
        setShiftPreset('shift3');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Sambung Shift Maju ke Shift 3 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Maju Aktif: Shift 3 (22:30 - 07:30 WITA, 9 Jam)`);
      } else if (isShift3) {
        setStartTime('07:30');
        setEndTime('15:30');
        setDurationHours(8.0);
        setShiftPreset('shift1');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Sambung Shift Maju ke Shift 1 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Maju Aktif: Shift 1 (07:30 - 15:30 WITA, 8 Jam)`);
      } else {
        setStartTime('16:30');
        setEndTime('22:30');
        setDurationHours(6.0);
        setShiftPreset('custom');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Lembur Sambung Pasca Day Shift (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Maju Aktif: 16:30 - 22:30 WITA (6 Jam)`);
      }
    } else {
      if (isShift3) {
        setStartTime('15:30');
        setEndTime('22:30');
        setDurationHours(7.0);
        setShiftPreset('shift2');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Sambung Shift Mundur mengisi Shift 2 sebelum Shift 3 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Mundur Aktif: Mengisi Shift 2 (15:30 - 22:30 WITA, 7 Jam)`);
      } else if (isShift2) {
        setStartTime('07:30');
        setEndTime('15:30');
        setDurationHours(8.0);
        setShiftPreset('shift1');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Sambung Shift Mundur mengisi Shift 1 sebelum Shift 2 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Mundur Aktif: Mengisi Shift 1 (07:30 - 15:30 WITA, 8 Jam)`);
      } else if (isShift1) {
        setStartTime('22:30');
        setEndTime('07:30');
        setDurationHours(9.0);
        setShiftPreset('shift3');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Sambung Shift Mundur mengisi Shift 3 Malam (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Sambung Mundur Aktif: Mengisi Shift 3 (22:30 - 07:30 WITA, 9 Jam)`);
      } else {
        setStartTime('05:30');
        setEndTime('07:30');
        setDurationHours(2.0);
        setShiftPreset('custom');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan')) {
          setTaskDescription('Lembur Sambung Datang Lebih Awal Pre-Day Shift');
        }
        toast.success(`Preset Sambung Mundur Aktif: 05:30 - 07:30 WITA (2 Jam)`);
      }
    }
  };

  // Estimasi Kompensasi Realtime Sesuai Formula Depnaker PP 35/2021
  const hourlyRate = record?.hourlyRate || 23381.79;
  let estimatedPay = 0;
  if (!isWeekendHoliday) {
    if (durationHours <= 1) {
      estimatedPay = Math.round(durationHours * 1.5 * hourlyRate);
    } else {
      estimatedPay = Math.round((1 * 1.5 * hourlyRate) + ((durationHours - 1) * 2.0 * hourlyRate));
    }
  } else {
    if (durationHours <= 7) {
      estimatedPay = Math.round(durationHours * 2.0 * hourlyRate);
    } else if (durationHours <= 8) {
      estimatedPay = Math.round((7 * 2.0 * hourlyRate) + ((durationHours - 7) * 3.0 * hourlyRate));
    } else {
      estimatedPay = Math.round((7 * 2.0 * hourlyRate) + (1 * 3.0 * hourlyRate) + ((durationHours - 8) * 4.0 * hourlyRate));
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (!taskDescription.trim()) {
      toast.error('Uraian tugas lembur wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await hrmService.updateManualOvertimeRequest(record.id, {
        date,
        startTime,
        endTime,
        durationHours,
        taskDescription: taskDescription.trim(),
        status,
        approvalNotes: approvalNotes.trim() || undefined,
        isWeekendHoliday,
      });

      if (res.success) {
        toast.success(`Data SPKL Lembur ${record.userName || 'Karyawan'} berhasil diperbarui ke jam ${startTime} - ${endTime} WITA.`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan perubahan lembur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin MENGHAPUS / MEMBATALKAN SPKL lembur atas nama ${record.userName || 'karyawan'} pada tanggal ${record.date}? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await hrmService.deleteOvertimeRequest(record.id);
      toast.success(`SPKL Lembur ${record.userName || ''} berhasil dihapus.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus catatan lembur');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>Koreksi / Edit Surat Perintah Kerja Lembur (SPKL)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ubah jam dinas, durasi, tanggal penugasan, atau batalkan SPKL yang salah diinput.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Card Info Karyawan */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {(record.userName || 'K')[0]}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{record.userName || 'Karyawan'}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{record.userNip || '-'} • {record.divisionName || 'Operasional'}</p>
              </div>
            </div>
            <Badge className={status === 'approved' ? 'bg-emerald-600 text-white text-[10px]' : 'bg-amber-500 text-white text-[10px]'}>
              {status === 'approved' ? 'Disetujui' : status === 'rejected' ? 'Ditolak' : 'Menunggu'}
            </Badge>
          </div>

          {/* Tanggal & Hari Kerja / Libur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Tanggal Lembur</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-9 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipe Hari</Label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsWeekendHoliday(false)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    !isWeekendHoliday ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  Hari Kerja Normal
                </button>
                <button
                  type="button"
                  onClick={() => setIsWeekendHoliday(true)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    isWeekendHoliday ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  Hari Libur / Weekend (2x)
                </button>
              </div>
            </div>
          </div>

          {/* Preset Pilihan Durasi Lembur Sesuai Jam Dinas Baku FRP */}
          <div className="space-y-2">
            {/* Quick Actions: Sambung Shift Maju & Mundur */}
            <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span>Fitur Pintar: Sambung Shift Pengganti Pos (Anti-Kekosongan)</span>
                </span>
                {targetUser && (
                  <Badge variant="outline" className="text-[10px] font-mono border-indigo-400 text-indigo-700 dark:text-indigo-300">
                    Jadwal Reguler: {userCurrentShift?.name || 'Shift 1'}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySambungShift('maju')}
                  className="h-9 text-xs font-bold border-indigo-400 dark:border-indigo-600 hover:bg-indigo-600 hover:text-white text-indigo-800 dark:text-indigo-200 flex items-center justify-center gap-1.5 rounded-lg shadow-2xs"
                >
                  <span>⏩ Sambung Shift Maju</span>
                  <span className="text-[10px] font-normal opacity-80">(Lanjut Pasca Shift)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySambungShift('mundur')}
                  className="h-9 text-xs font-bold border-indigo-400 dark:border-indigo-600 hover:bg-indigo-600 hover:text-white text-indigo-800 dark:text-indigo-200 flex items-center justify-center gap-1.5 rounded-lg shadow-2xs"
                >
                  <span>⏪ Sambung Shift Mundur</span>
                  <span className="text-[10px] font-normal opacity-80">(Datang Lebih Awal)</span>
                </Button>
              </div>
            </div>

            <Label className="text-xs font-semibold flex items-center justify-between pt-1">
              <span>Preset Standar Durasi Lembur FRP</span>
              <span className="text-primary font-bold">{durationHours} Jam Lembur</span>
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { id: 'shift1', label: 'Shift 1 (8 Jam)', hours: 8, time: '07:30 - 15:30' },
                { id: 'shift2', label: 'Shift 2 (7 Jam)', hours: 7, time: '15:30 - 22:30' },
                { id: 'shift3', label: 'Shift 3 (9 Jam)', hours: 9, time: '22:30 - 07:30' },
                { id: 'dayshift', label: 'Day Shift (8 Jam)', hours: 8, time: '07:30 - 16:30' },
                { id: 'darurat', label: 'Darurat (3 Jam)', hours: 3, time: '16:30 - 19:30' },
                { id: 'custom', label: 'Kustom Jam', hours: 0, time: 'Manual' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as any)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    shiftPreset === p.id
                      ? 'border-blue-600 bg-blue-600 text-white shadow-xs font-bold'
                      : 'border-border bg-card hover:bg-muted/50 text-foreground font-medium'
                  }`}
                >
                  <div className="text-[11px] leading-tight font-semibold">{p.label}</div>
                  <div className="text-[9px] opacity-80 mt-0.5">{p.time}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Jam Mulai, Jam Selesai & Total Jam */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Jam Mulai</Label>
              <TimePicker
                value={startTime}
                onChange={(val) => {
                  setStartTime(val);
                  setShiftPreset('custom');
                  calculateCustomDuration(val, endTime);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Jam Selesai</Label>
              <TimePicker
                value={endTime}
                onChange={(val) => {
                  setEndTime(val);
                  setShiftPreset('custom');
                  calculateCustomDuration(startTime, val);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Total Jam Diakui</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max={shiftPreset === 'darurat' ? 3 : 16}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="h-9 text-xs rounded-xl font-mono font-bold text-primary"
                required
              />
            </div>
          </div>

          {/* Estimasi Kompensasi Finansial */}
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">Estimasi Kompensasi Lembur</p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Kalkulasi Depnaker PP 35/2021</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                Rp {estimatedPay.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Uraian Tugas Lembur */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Uraian Tugas / Instruksi Kerja Lembur <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Contoh: Mengisi kekosongan shift 1..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="text-xs rounded-xl min-h-[65px] resize-none"
              required
            />
          </div>

          {/* Status & Catatan Persetujuan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status Persetujuan SPKL</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OvertimeStatus)}
                className="w-full h-9 text-xs rounded-xl border border-border bg-background px-3 font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="approved">Disetujui (Approved)</option>
                <option value="pending">Menunggu (Pending)</option>
                <option value="rejected">Ditolak (Rejected)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan Admin / Pengesahan</Label>
              <Input
                type="text"
                placeholder="Catatan pengesahan lembur..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="w-full sm:w-auto h-9 text-xs rounded-xl border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Menghapus...' : 'Hapus SPKL'}</span>
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="flex-1 sm:flex-none h-9 text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="flex-1 sm:flex-none h-9 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

