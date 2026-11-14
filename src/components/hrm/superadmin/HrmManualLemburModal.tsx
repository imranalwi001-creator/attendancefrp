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
import { hrmHolidayService } from '@/services/hrmHolidayService';
import { UserProfile, OvertimeStatus, getEmployeeCategoryGroup } from '@/types/hrm';
import { resolveEffectiveShift } from '@/lib/hrmShiftResolver';
import {
  Clock,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  DollarSign,
  Shield,
  Zap,
  Info,
  X,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';

interface HrmManualLemburModalProps {
  open: boolean;
  onClose: () => void;
  preselectedUser?: UserProfile | null;
  onSuccess?: () => void;
}

export const HrmManualLemburModal: React.FC<HrmManualLemburModalProps> = ({
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
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shiftPreset, setShiftPreset] = useState<'shift77_pagi' | 'shift77_malam' | 'shift1' | 'shift2' | 'shift3' | 'dayshift' | 'darurat' | 'custom'>('shift1');
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('15:30');
  const [durationHours, setDurationHours] = useState<number>(8.0);
  const [isWeekendHoliday, setIsWeekendHoliday] = useState<boolean>(false);
  const [holidayDetail, setHolidayDetail] = useState<{ isHoliday: boolean; holidayName?: string }>({ isHoliday: false });
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [status, setStatus] = useState<OvertimeStatus>('approved');
  const [approvalNotes, setApprovalNotes] = useState<string>('Ditugaskan dan disahkan langsung oleh Super Administrator');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverSchedule, setServerSchedule] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const eligibleUsers = hrmService
        .getUsers()
        .filter((u) => u.isActive && ['RUMAH TANGGA', 'SHIPMENT'].includes(getEmployeeCategoryGroup(u)) && u.overtimeEligible !== false);
      setUsers(eligibleUsers);

      if (preselectedUser) {
        if (getEmployeeCategoryGroup(preselectedUser) === 'KARYAWAN TETAP' || preselectedUser.overtimeEligible === false) {
          toast.error('Karyawan Tetap (Aslam, Samsi, Takdir) berstatus Non-Lembur dan tidak dapat diberikan SPKL.');
          if (eligibleUsers.length > 0) setSelectedUserId(eligibleUsers[0].id);
        } else {
          setSelectedUserId(preselectedUser.id);
        }
      } else if (!selectedUserId && eligibleUsers.length > 0) {
        setSelectedUserId(eligibleUsers[0].id);
      }

      // Check if current date is weekend or national holiday
      const holCheck = hrmHolidayService.isWeekendOrHoliday(date);
      setIsWeekendHoliday(holCheck.isWeekendOrHoliday);
      setHolidayDetail({ isHoliday: holCheck.isNationalHoliday, holidayName: holCheck.holidayName });
    }
  }, [open, preselectedUser]);

  // Live fetch schedule for selected user and date directly from server API
  useEffect(() => {
    if (!open || !selectedUserId || !date) return;
    let isMounted = true;
    fetch(`/api/employee-schedules/today/${encodeURIComponent(selectedUserId)}?date=${encodeURIComponent(date)}`)
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
  }, [open, selectedUserId, date]);

  // Handle Preset Change Sesuai Jam Dinas Baku PT FRP
  const applyPreset = (preset: 'shift77_pagi' | 'shift77_malam' | 'shift1' | 'shift2' | 'shift3' | 'dayshift' | 'darurat' | 'custom') => {
    setShiftPreset(preset);
    switch (preset) {
      case 'shift77_pagi':
        setStartTime('07:30');
        setEndTime('19:30');
        setDurationHours(12.0);
        break;
      case 'shift77_malam':
        setStartTime('19:30');
        setEndTime('07:30');
        setDurationHours(12.0);
        break;
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
        setDurationHours(3.0); // Strict limit max 3 jam
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
      if (diff < 0) diff += 24 * 60; // Next day crossing
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
    setHolidayDetail({ isHoliday: holCheck.isNationalHoliday, holidayName: holCheck.holidayName });
  };

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

  // Determine Operational Group
  const nipUpper = (selectedUser?.nip || '').toUpperCase();
  const isShipment = nipUpper >= 'FR07034' && nipUpper <= 'FR07080';
  const isRumahTangga = nipUpper >= 'FR07001' && nipUpper <= 'FR07033';

  // Deteksi Shift Karyawan Terpilih Pada Tanggal Terpilih
  const userCurrentShift = React.useMemo(() => {
    if (!selectedUser) return null;
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
    const dailySched = hrmService.getEmployeeTodaySchedule(selectedUser.id, date);
    return resolveEffectiveShift(selectedUser, allShifts, dailySched);
  }, [selectedUser, date, serverSchedule]);

  const applySambungShift = (direction: 'maju' | 'mundur') => {
    if (!selectedUser) {
      toast.error('Pilih karyawan terlebih dahulu.');
      return;
    }
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
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Setelah Shift ke Shift 2 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Setelah Shift Aktif: Shift 2 (15:30 - 22:30 WITA, 7 Jam) untuk ${selectedUser.fullName}`);
      } else if (isShift2) {
        setStartTime('22:30');
        setEndTime('07:30');
        setDurationHours(9.0);
        setShiftPreset('shift3');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Setelah Shift ke Shift 3 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Setelah Shift Aktif: Shift 3 (22:30 - 07:30 WITA, 9 Jam) untuk ${selectedUser.fullName}`);
      } else if (isShift3) {
        setStartTime('07:30');
        setEndTime('15:30');
        setDurationHours(8.0);
        setShiftPreset('shift1');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Setelah Shift ke Shift 1 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Setelah Shift Aktif: Shift 1 (07:30 - 15:30 WITA, 8 Jam) untuk ${selectedUser.fullName}`);
      } else {
        setStartTime('16:30');
        setEndTime('22:30');
        setDurationHours(6.0);
        setShiftPreset('custom');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Setelah Shift Pasca Day Shift (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Setelah Shift Aktif: 16:30 - 22:30 WITA (6 Jam) untuk ${selectedUser.fullName}`);
      }
    } else {
      if (isShift3) {
        setStartTime('15:30');
        setEndTime('22:30');
        setDurationHours(7.0);
        setShiftPreset('shift2');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Sebelum Shift mengisi Shift 2 sebelum Shift 3 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Sebelum Shift Aktif: Mengisi Shift 2 (15:30 - 22:30 WITA, 7 Jam) untuk ${selectedUser.fullName}`);
      } else if (isShift2) {
        setStartTime('07:30');
        setEndTime('15:30');
        setDurationHours(8.0);
        setShiftPreset('shift1');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Sebelum Shift mengisi Shift 1 sebelum Shift 2 (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Sebelum Shift Aktif: Mengisi Shift 1 (07:30 - 15:30 WITA, 8 Jam) untuk ${selectedUser.fullName}`);
      } else if (isShift1) {
        setStartTime('22:30');
        setEndTime('07:30');
        setDurationHours(9.0);
        setShiftPreset('shift3');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Sebelum Shift mengisi Shift 3 Malam (Tugas Pengganti Pos)');
        }
        toast.success(`Preset Lembur Sebelum Shift Aktif: Mengisi Shift 3 (22:30 - 07:30 WITA, 9 Jam) untuk ${selectedUser.fullName}`);
      } else {
        setStartTime('05:30');
        setEndTime('07:30');
        setDurationHours(2.0);
        setShiftPreset('custom');
        if (!taskDescription || taskDescription.includes('Sambung') || taskDescription.includes('kekosongan') || taskDescription.includes('Lembur')) {
          setTaskDescription('Lembur Sebelum Shift Datang Lebih Awal Pre-Day Shift');
        }
        toast.success(`Preset Lembur Sebelum Shift Aktif: 05:30 - 07:30 WITA (2 Jam) untuk ${selectedUser.fullName}`);
      }
    }
  };

  // Deteksi Divisi & Sifat Lembur Sesuai Kebijakan Direksi PT FRP
  const divUpper = (selectedUser?.divisionName || '').toUpperCase();
  const isTimbanganOrSegel = divUpper.includes('TIMBANGAN') || divUpper.includes('SEGEL');
  const isMatching = divUpper.includes('MATCHING');

  // Apakah tugas pengganti pos / sambung shift / di hari OFF / tanggal merah
  const isReliefDuty = React.useMemo(() => {
    const desc = (taskDescription || '').toLowerCase();
    const isOffSchedule = Boolean(userCurrentShift?.isOff);
    return (
      isOffSchedule ||
      isWeekendHoliday ||
      desc.includes('pengganti') ||
      desc.includes('mengganti') ||
      desc.includes('menggantikan') ||
      desc.includes('ganti') ||
      desc.includes('sambung') ||
      desc.includes('relief') ||
      desc.includes('cuti') ||
      desc.includes('off') ||
      desc.includes('libur')
    );
  }, [taskDescription, userCurrentShift, isWeekendHoliday]);

  // Perhitungan Presisi Sesuai Aturan Baku PT FRP:
  // 1. Timbangan & Segel: Lembur pengganti shift di hari kerja atau di hari off/tgl merah:
  //    -> TANPA POTONGAN ISTIRAHAT (0 jam) dan LANGSUNG PENGALI 2.0x.
  // 2. Matching: Lembur pengganti shift / hari OFF:
  //    -> POTONGAN ISTIRAHAT 1 JAM dan LANGSUNG PENGALI 2.0x pada sisa jam efektif.
  // 3. Kelebihan jam kerja reguler harian (seperti Shift 7-7 kelebihan 3 jam di hari kerja biasa):
  //    -> 1 jam pertama @ 1.5x, jam berikutnya @ 2.0x.
  const overtimeCalculation = React.useMemo(() => {
    const rate = selectedUser?.overtimeRateOverride || 23381.79;
    let breakDeduction = 0;
    let effectiveHours = durationHours;
    let payHours = 0;
    let ruleAppliedLabel = '';

    if (isReliefDuty) {
      if (isTimbanganOrSegel) {
        breakDeduction = 0; // Tanpa potongan istirahat (0 jam)
        effectiveHours = durationHours;
        payHours = effectiveHours * 2.0; // Langsung pengali 2.0x (tanpa 1.5x)
        ruleAppliedLabel = 'Timbangan & Segel (Pengganti): 0 Jam Potongan Istirahat, Langsung Pengali 2.0x';
      } else if (isMatching) {
        breakDeduction = durationHours > 1 ? 1 : 0; // Potongan 1 jam istirahat
        effectiveHours = Math.max(0, durationHours - breakDeduction);
        payHours = effectiveHours * 2.0; // Langsung pengali 2.0x pada sisa jam efektif
        ruleAppliedLabel = 'Matching (Pengganti / OFF): Potongan Istirahat 1 Jam, Langsung Pengali 2.0x';
      } else {
        breakDeduction = 0;
        effectiveHours = durationHours;
        payHours = effectiveHours * 2.0;
        ruleAppliedLabel = 'Pengganti Shift / Hari Libur: Pengali 2.0x';
      }
    } else {
      breakDeduction = 0;
      effectiveHours = durationHours;
      const h1 = Math.min(1, durationHours);
      const h2 = Math.max(0, durationHours - 1);
      payHours = (h1 * 1.5) + (h2 * 2.0);
      ruleAppliedLabel = 'Hari Kerja Reguler: Jam Ke-1 (1.5x) + Jam Ke-2 & Seterusnya (2.0x)';
    }

    const estimatedPay = Math.round(payHours * rate);

    return {
      hourlyRate: rate,
      breakDeduction,
      effectiveHours,
      payHours: Number(payHours.toFixed(1)),
      estimatedPay,
      ruleAppliedLabel,
    };
  }, [selectedUser, isReliefDuty, isTimbanganOrSegel, isMatching, durationHours]);

  const estimatedPay = overtimeCalculation.estimatedPay;
  const hourlyRate = overtimeCalculation.hourlyRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Pilih karyawan yang akan ditugaskan lembur');
      return;
    }
    if (!taskDescription.trim()) {
      toast.error('Uraian tugas dan instruksi kerja lembur wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await hrmService.createManualOvertimeRequest({
        userId: selectedUserId,
        date,
        startTime,
        endTime,
        durationHours,
        taskDescription: taskDescription.trim(),
        attachmentUrl: attachmentUrl || undefined,
        status,
        approvalNotes,
        adminId: currentAdmin?.id,
        adminName: currentAdmin?.fullName || 'Super Administrator',
        isWeekendHoliday,
        supervisorName: currentAdmin?.fullName || 'Super Administrator',
      });

      if (res.success) {
        toast.success(`SPKL Lembur manual untuk ${selectedUser?.fullName} (${durationHours} Jam) berhasil diterbitkan & disahkan!`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hrm_overtime_updated'));
          window.dispatchEvent(new CustomEvent('hrm_data_updated'));
        }
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error('Gagal menerbitkan surat lembur');
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat memproses lembur');
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
            <Clock className="w-5 h-5 text-blue-600" />
            Input &amp; Terbitkan SPKL Lembur Manual (Superadmin)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Formulir otoritas Super Administrator untuk menerbitkan Surat Perintah Kerja Lembur (SPKL) langsung kepada karyawan PT FRP.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1 text-xs">
          {/* 1. Pilih Karyawan */}
          <div className="space-y-1.5 p-3 rounded-xl border border-border bg-muted/30">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Pilih Karyawan Ditugaskan <span className="text-destructive">*</span></span>
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
                <Badge variant="outline" className="border-blue-500/40 text-blue-600">
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
                    {filteredUsers.map((u) => {
                      const uNip = (u.nip || '').toUpperCase();
                      const groupLabel = uNip >= 'FR07034' && uNip <= 'FR07080' ? 'Shipment' : (uNip >= 'FR07001' && uNip <= 'FR07033' ? 'Wisma/RT' : 'Staff');
                      return (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nip} - {u.fullName} ({u.divisionName || 'Operasional'}) [{groupLabel}]
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Banner Aturan Operasional Karyawan */}
            {selectedUser && (
              <div className="mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed bg-blue-500/5 border-blue-500/20 text-foreground">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span>Kategori Operasional: {isShipment ? 'SHIPMENT (47 Personel)' : (isRumahTangga ? 'RUMAH TANGGA / WISMA (33 Personel)' : 'Staf / Operasional Umum')}</span>
                </div>
                {isShipment && (
                  <p className="text-muted-foreground text-[10px]">
                    Karyawan Shipment (47 Personil Sah): diawasi <strong>Budget Efektif Rp 65 Jt / Plafon SK Rp 72 Jt</strong> dengan Target Efisiensi <strong>Rp 55–60 Jt</strong> (Shift 1 = 8j, Shift 2 = 7j, Shift 3 = 9j, Day Shift = 8j).
                  </p>
                )}
                {isRumahTangga && (
                  <p className="text-amber-700 dark:text-amber-300 text-[10px]">
                    Karyawan Wisma Biring Ere: Budget lembur dibatasi <strong>Rp 4.000.000 / 33 org</strong> (Rp 121.212/orang). Kelebihan jam dialihkan ke <strong>Flexytime (Libur)</strong> bulan berjalan.
                  </p>
                )}

                {/* Indikator Khusus Divisi */}
                {isTimbanganOrSegel && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[10px] flex items-start gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Aturan Baku Divisi Timbangan & Segel:</strong> Lembur pengganti shift di hari kerja atau di hari off/tanggal merah <strong>TANPA POTONGAN ISTIRAHAT (0 jam)</strong> dan <strong>LANGSUNG PENGALI 2,0x</strong>.
                    </span>
                  </div>
                )}
                {isMatching && (
                  <div className="mt-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-[10px] flex items-start gap-1.5 font-medium">
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Aturan Baku Divisi Matching:</strong> Lembur pengganti shift atau saat hari off/tanggal merah dikenakan <strong>POTONGAN ISTIRAHAT 1 JAM</strong> dan seluruh sisa jam efektif <strong>LANGSUNG PENGALI 2,0x</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Tanggal & Hari Libur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tanggal Lembur <span className="text-destructive">*</span></Label>
              <DatePicker
                value={date}
                onChange={(val) => handleDateChange(val || new Date().toISOString().split('T')[0])}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Kategori Hari Kerja</Label>
                {holidayDetail.isHoliday && (
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-300 font-medium">
                    🇮🇩 {holidayDetail.holidayName}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setIsWeekendHoliday(false)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    !isWeekendHoliday ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  Hari Kerja Normal
                </button>
                <button
                  type="button"
                  onClick={() => setIsWeekendHoliday(true)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    isWeekendHoliday ? 'bg-purple-600 text-white border-purple-600' : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  Hari Libur / Weekend (2x)
                </button>
              </div>
            </div>
          </div>

          {/* 3. Preset Pilihan Durasi Lembur Sesuai Aturan Pimpinan */}
          <div className="space-y-2">
            {/* Quick Actions: Lembur Setelah Shift & Sebelum Shift */}
            <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span>Fitur Pintar: Lembur Pengganti Pos (Anti-Kekosongan)</span>
                </span>
                {selectedUser && (
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
                  <span>⏩ Lembur Setelah Shift</span>
                  <span className="text-[10px] font-normal opacity-80">(Lanjut Pasca Shift)</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySambungShift('mundur')}
                  className="h-9 text-xs font-bold border-indigo-400 dark:border-indigo-600 hover:bg-indigo-600 hover:text-white text-indigo-800 dark:text-indigo-200 flex items-center justify-center gap-1.5 rounded-lg shadow-2xs"
                >
                  <span>⏪ Lembur Sebelum Shift</span>
                  <span className="text-[10px] font-normal opacity-80">(Datang Lebih Awal)</span>
                </Button>
              </div>
            </div>

            <Label className="text-xs font-semibold flex items-center justify-between pt-1">
              <span>Preset Standar Durasi Lembur FRP</span>
              <span className="text-primary font-bold">{durationHours} Jam Lembur</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'shift77_pagi', label: 'Shift 7-7 Pagi (12J)', hours: 12 },
                { id: 'shift77_malam', label: 'Shift 7-7 Malam (12J)', hours: 12 },
                { id: 'shift1', label: 'Shift 1 (8 Jam)', hours: 8 },
                { id: 'shift2', label: 'Shift 2 (7 Jam)', hours: 7 },
                { id: 'shift3', label: 'Shift 3 (9 Jam)', hours: 9 },
                { id: 'dayshift', label: 'Day Shift (8 Jam)', hours: 8 },
                { id: 'darurat', label: 'Darurat (Max 3 Jam)', hours: 3 },
                { id: 'custom', label: 'Kustom Jam', hours: 0 },
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
                  <div className="text-[11px] leading-tight">{p.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Jam Mulai, Jam Selesai & Durasi */}
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

          {/* 5. Uraian Tugas & Instruksi */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Uraian Tugas / Instruksi Kerja Lembur <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Contoh: Mengisi kekosongan pos pengawasan dermaga FRP, pembersihan area dermaga, atau instruksi pimpinan..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="text-xs rounded-xl min-h-[70px] resize-none"
              required
            />
          </div>

          {/* 6. Lampiran Foto / Dokumen Tugas (Opsional untuk Superadmin) */}
          <div className="space-y-1.5 p-3 rounded-xl border border-dashed border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Foto Bukti / Surat Mandat (Opsional untuk Superadmin)</span>
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
                  <Upload className="w-3 h-3" /> Unggah Foto / Berkas
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Bila dikosongkan, sistem menandai sebagai Surat Mandat Langsung Superadmin.
                </span>
              </div>
            )}
          </div>

          {/* 7. Status Pengesahan & Catatan Superadmin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status Persetujuan SPKL</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OvertimeStatus)}>
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
                      <Clock className="w-3.5 h-3.5" /> Menunggu Konfirmasi (Pending)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan Pengesahan</Label>
              <Input
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Catatan persetujuan..."
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* 8. Estimasi Finansial Superadmin (Hanya tampil di Dashboard Superadmin) */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kalkulasi Upah Lembur Real-Time (Dashboard Superadmin)</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Tarif Pokok FRP: Rp {Math.round(hourlyRate).toLocaleString('id-ID')}/jam • Basis 1/173
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  Rp {estimatedPay.toLocaleString('id-ID')}
                </p>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-mono">
                  {overtimeCalculation.payHours} Jam Bayar
                </Badge>
              </div>
            </div>

            {/* Rincian Parameter Perhitungan */}
            <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-border/60 text-center font-mono">
              <div className="p-1.5 rounded-lg bg-background/80 border border-border/60">
                <p className="text-[9px] text-muted-foreground font-sans">Jam Riil</p>
                <p className="text-xs font-bold text-foreground">{durationHours} J</p>
              </div>
              <div className="p-1.5 rounded-lg bg-background/80 border border-border/60">
                <p className="text-[9px] text-muted-foreground font-sans">Pot. Istirahat</p>
                <p className="text-xs font-bold text-amber-600">
                  {overtimeCalculation.breakDeduction > 0 ? `-${overtimeCalculation.breakDeduction} J` : '0 J (Utuh)'}
                </p>
              </div>
              <div className="p-1.5 rounded-lg bg-background/80 border border-border/60">
                <p className="text-[9px] text-muted-foreground font-sans">Jam Efektif</p>
                <p className="text-xs font-bold text-blue-600">{overtimeCalculation.effectiveHours} J</p>
              </div>
              <div className="p-1.5 rounded-lg bg-background/80 border border-border/60">
                <p className="text-[9px] text-muted-foreground font-sans">Jam Dikalikan</p>
                <p className="text-xs font-bold text-emerald-600">{overtimeCalculation.payHours} J</p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground leading-tight italic pt-0.5">
              📌 {overtimeCalculation.ruleAppliedLabel}
            </p>
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
              className="text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-9"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? 'Menerbitkan SPKL...' : 'Terbitkan SPKL Lembur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
