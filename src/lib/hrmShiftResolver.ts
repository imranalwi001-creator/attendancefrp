import { Shift, UserProfile, EmployeeSchedule, isSpecialDutyOfficer } from '@/types/hrm';

/**
 * Helper untuk mengekstrak jam dari string seperti "Shift III (22:30 - 07:30 WITA)" atau "22:30 - 07:30"
 */
export function extractTimesFromShiftName(name?: string): { startTime?: string; endTime?: string; isCrossDay?: boolean } | null {
  if (!name) return null;
  // Match format: 22:30 - 07:30 atau 22.30 - 07.30 atau 22:30-07:30
  const match = name.match(/(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/);
  if (!match) return null;

  const startTime = match[1].replace('.', ':').padStart(5, '0');
  const endTime = match[2].replace('.', ':').padStart(5, '0');

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;

  return {
    startTime,
    endTime,
    isCrossDay: endMins < startMins,
  };
}

/**
 * Smart Bulletproof Shift Resolver:
 * Menentukan shift aktif karyawan secara global dan mencegah fallback salah ke Day Shift (07:30 - 16:30)
 */
export function resolveEffectiveShift(
  user: UserProfile | null | undefined,
  allShifts: Shift[],
  dailySchedule?: EmployeeSchedule | null
): Shift {
  const isSpecialDuty = isSpecialDutyOfficer(user);

  // 0. KHUSUS 3 PETUGAS LAPANGAN KHUSUS PIMPINAN (Samsi, Takdir, Aslam):
  // Sesuai Instruksi Mutlak Pimpinan: Jam Masuk Baku 08:00 WITA dengan Toleransi 15 Menit (Batas Akhir Toleransi: 08:15 WITA)!
  if (isSpecialDuty) {
    const sStart = (user?.customStartTime || (user as any)?.custom_start_time || '08:00').substring(0, 5);
    const sEnd = (user?.customEndTime || (user as any)?.custom_end_time || '16:00').substring(0, 5);
    const tol = Number(user?.lateToleranceMinutes ?? (user as any)?.late_tolerance_minutes ?? 15);
    return {
      id: 'shift-field-special',
      code: 'FIELD',
      name: 'Petugas Lapangan Khusus Pimpinan (08:00 - 16:00)',
      startTime: sStart,
      endTime: sEnd,
      lateToleranceMinutes: tol > 0 ? tol : 15,
      earliestClockInMinutes: 120,
      isCrossDay: false,
      colorTag: '#10b981',
    };
  }

  // 1. Jadwal Roster Harian (Jika Ada dan Bukan Libur)
  if (dailySchedule && !dailySchedule.isOff && dailySchedule.startTime && dailySchedule.endTime) {
    const isNight = Boolean(dailySchedule.isNightShift || (dailySchedule.endTime < dailySchedule.startTime));
    return {
      id: dailySchedule.shiftId || `sched-${dailySchedule.shiftCode || 'REG'}`,
      code: dailySchedule.shiftCode || 'SHF',
      name: dailySchedule.shiftName || 'Shift Terjadwal',
      startTime: dailySchedule.startTime.substring(0, 5),
      endTime: dailySchedule.endTime.substring(0, 5),
      lateToleranceMinutes: 15,
      earliestClockInMinutes: 120, // 2 Jam (120 menit) Datang Lebih Cepat Boleh Absen Masuk!
      isCrossDay: isNight,
      colorTag: dailySchedule.shiftCode === 'DAY' ? '#10b981' : dailySchedule.shiftCode === 'P' ? '#3b82f6' : dailySchedule.shiftCode === 'S' ? '#f59e0b' : '#8b5cf6',
    };
  }

  // 2. Cek langsung shiftStartTime & shiftEndTime yang terpasang pada userProfile (dari PostgreSQL p.shift_start_time / p.shift_end_time)
  if (user?.shiftStartTime && user?.shiftEndTime) {
    const sStart = isSpecialDuty && user?.customStartTime ? user.customStartTime.substring(0, 5) : user.shiftStartTime.substring(0, 5);
    const sEnd = isSpecialDuty && user?.customEndTime ? user.customEndTime.substring(0, 5) : user.shiftEndTime.substring(0, 5);
    const [sH, sM] = sStart.split(':').map(Number);
    const [eH, eM] = sEnd.split(':').map(Number);
    const isCross = (eH * 60 + eM) < (sH * 60 + sM);

    return {
      id: user?.shiftId || 'shift-direct-profile',
      code: user?.shiftName?.toUpperCase().includes('III') ? 'SHF-III' : user?.shiftName?.toUpperCase().includes('II') ? 'SHF-II' : 'SHF-I',
      name: user?.shiftName || 'Shift Operasional',
      startTime: sStart,
      endTime: sEnd,
      lateToleranceMinutes: user?.lateToleranceMinutes ?? 15,
      earliestClockInMinutes: 120,
      isCrossDay: isCross,
      colorTag: isCross ? '#8b5cf6' : '#0d9488',
    };
  }

  // 3. Coba cocokkan user.shiftId dengan ID di master shifts
  const shiftById = user?.shiftId ? allShifts.find((s) => s.id === user.shiftId) : null;
  if (shiftById) {
    const isCross = Boolean(shiftById.isCrossDay || (shiftById.startTime && shiftById.endTime && shiftById.endTime < shiftById.startTime));
    const res: Shift = {
      ...shiftById,
      startTime: (shiftById.startTime || '07:30').substring(0, 5),
      endTime: (shiftById.endTime || '16:30').substring(0, 5),
      earliestClockInMinutes: shiftById.earliestClockInMinutes || 120,
      isCrossDay: isCross,
    };
    // HANYA petugas khusus yang diizinkan menimpa shift resmi dengan jam custom pimpinan
    if (isSpecialDuty) {
      if (user?.customStartTime) res.startTime = user.customStartTime.substring(0, 5);
      if (user?.customEndTime) res.endTime = user.customEndTime.substring(0, 5);
    }
    if (user?.lateToleranceMinutes != null) res.lateToleranceMinutes = user.lateToleranceMinutes;
    return res;
  }

  // 3. Ekstraksi langsung dari user.shiftName jika mengandung jam (misal: "Shift III (22:30 - 07:30 WITA)")
  const userShiftName = user?.shiftName || '';
  const parsedFromName = extractTimesFromShiftName(userShiftName);
  if (parsedFromName) {
    const sStart = isSpecialDuty && user?.customStartTime ? user.customStartTime.substring(0, 5) : parsedFromName.startTime!;
    const sEnd = isSpecialDuty && user?.customEndTime ? user.customEndTime.substring(0, 5) : parsedFromName.endTime!;
    const [sH, sM] = sStart.split(':').map(Number);
    const [eH, eM] = sEnd.split(':').map(Number);
    const isCross = (eH * 60 + eM) < (sH * 60 + sM);

    return {
      id: user?.shiftId || 'shift-extracted',
      code: userShiftName.toUpperCase().includes('III') ? 'SHF-III' : userShiftName.toUpperCase().includes('II') ? 'SHF-II' : 'SHF-I',
      name: userShiftName,
      startTime: sStart,
      endTime: sEnd,
      lateToleranceMinutes: user?.lateToleranceMinutes ?? 15,
      earliestClockInMinutes: 120, // 120 Menit Toleransi Datang Lebih Cepat
      isCrossDay: isCross,
      colorTag: isCross ? '#8b5cf6' : '#0d9488',
    };
  }

  // 4. Fuzzy Match berdasarkan nama atau nomor shift (Shift III, Shift 3, Shift Malam, dsb)
  const normName = userShiftName.toLowerCase();
  if (normName.includes('iii') || normName.includes('3') || normName.includes('malam') || normName.includes('night')) {
    const nightMaster = allShifts.find((s) => s.name.toLowerCase().includes('iii') || s.name.toLowerCase().includes('malam') || s.code === 'MALAM' || s.code === 'SHF-III');
    return {
      id: nightMaster?.id || 'shift-night',
      code: nightMaster?.code || 'MALAM',
      name: userShiftName || nightMaster?.name || 'Shift III (22:30 - 07:30 WITA)',
      startTime: (nightMaster?.startTime || '22:30').substring(0, 5),
      endTime: (nightMaster?.endTime || '07:30').substring(0, 5),
      breakStartTime: nightMaster?.breakStartTime || '02:00',
      breakEndTime: nightMaster?.breakEndTime || '03:00',
      lateToleranceMinutes: user?.lateToleranceMinutes ?? (nightMaster?.lateToleranceMinutes || 15),
      earliestClockInMinutes: 120,
      isCrossDay: true,
      colorTag: '#8b5cf6',
    };
  }

  if (normName.includes('ii') || normName.includes('2') || normName.includes('siang') || normName.includes('sore') || normName.includes('afternoon')) {
    const afternoonMaster = allShifts.find((s) => s.name.toLowerCase().includes('ii') || s.name.toLowerCase().includes('siang') || s.code === 'SIANG' || s.code === 'SHF-II');
    return {
      id: afternoonMaster?.id || 'shift-afternoon',
      code: afternoonMaster?.code || 'SIANG',
      name: userShiftName || afternoonMaster?.name || 'Shift II (15:30 - 22:30 WITA)',
      startTime: (afternoonMaster?.startTime || '15:30').substring(0, 5),
      endTime: (afternoonMaster?.endTime || '22:30').substring(0, 5),
      breakStartTime: afternoonMaster?.breakStartTime || '18:00',
      breakEndTime: afternoonMaster?.breakEndTime || '19:00',
      lateToleranceMinutes: user?.lateToleranceMinutes ?? (afternoonMaster?.lateToleranceMinutes || 15),
      earliestClockInMinutes: 120,
      isCrossDay: false,
      colorTag: '#f59e0b',
    };
  }

  if (normName.includes('i') || normName.includes('1') || normName.includes('pagi') || normName.includes('morning')) {
    const morningMaster = allShifts.find((s) => s.name.toLowerCase().includes('shift i ') || s.name.toLowerCase().includes('shift i(') || s.code === 'PAGI' || s.code === 'SHF-I');
    return {
      id: morningMaster?.id || 'shift-morning',
      code: morningMaster?.code || 'PAGI',
      name: userShiftName || morningMaster?.name || 'Shift I (07:30 - 15:30 WITA)',
      startTime: (morningMaster?.startTime || '07:30').substring(0, 5),
      endTime: (morningMaster?.endTime || '15:30').substring(0, 5),
      breakStartTime: morningMaster?.breakStartTime || '11:30',
      breakEndTime: morningMaster?.breakEndTime || '12:30',
      lateToleranceMinutes: user?.lateToleranceMinutes ?? (morningMaster?.lateToleranceMinutes || 15),
      earliestClockInMinutes: 120,
      isCrossDay: false,
      colorTag: '#3b82f6',
    };
  }

  // 5. Khusus Petugas Lapangan Khusus Pimpinan (Bpk Reski Faisal): Default Jam Tugas 08:00 - 16:00 WITA
  if (isSpecialDuty) {
    return {
      id: 'shift-field-special',
      code: 'FIELD',
      name: 'Petugas Lapangan Khusus Pimpinan',
      startTime: (user?.customStartTime || '08:00').substring(0, 5),
      endTime: (user?.customEndTime || '16:00').substring(0, 5),
      lateToleranceMinutes: user?.lateToleranceMinutes ?? 15,
      earliestClockInMinutes: 120,
      isCrossDay: false,
      colorTag: '#10b981',
    };
  }

  // 6. Jika Karyawan Reguler Belum Ditentukan Shift oleh HRD/Admin di Dashboard:
  // JANGAN fallback ke Day Shift! Kembalikan status Belum Memiliki Shift (Unassigned)
  return {
    id: 'unassigned',
    code: 'NO-SHIFT',
    name: 'Belum Memiliki Shift',
    startTime: '',
    endTime: '',
    lateToleranceMinutes: 0,
    earliestClockInMinutes: 0,
    isCrossDay: false,
    colorTag: '#64748b',
  };
}

/**
 * Memeriksa apakah waktu saat ini (currentTime) berada dalam jendela waktu shift yang diizinkan untuk Clock-In.
 * Mendukung shift lintas hari (Cross-day) dan early clock-in window (default 120 menit / 2 jam sebelum jam masuk).
 */
export function checkShiftClockInWindow(shift: Shift | null, currentTime: Date = new Date()): {
  isOpen: boolean;
  reason?: string;
  openTimeStr?: string;
} {
  if (!shift || !shift.startTime || !shift.endTime || shift.id === 'unassigned') {
    // Menolak akses jika data shift belum termuat atau belum diatur oleh admin
    return {
      isOpen: false,
      reason: shift?.id === 'unassigned' 
        ? 'Akun Anda belum memiliki penugasan shift kerja. Silakan hubungi HRD atau Admin.' 
        : 'Sedang memuat data jadwal shift karyawan...',
    };
  }

  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const [sH, sM] = shift.startTime.split(':').map(Number);
  const startMins = (sH || 0) * 60 + (sM || 0);
  const [eH, eM] = shift.endTime.split(':').map(Number);
  const endMins = (eH || 0) * 60 + (eM || 0);

  const isCrossDay = Boolean(shift.isCrossDay || endMins < startMins);
  const earliestMinutes = shift.earliestClockInMinutes || 120; // 2 Jam (120 Menit) Sebelum Shift
  const openMins = (startMins - earliestMinutes + 1440) % 1440;

  const openHour = Math.floor(openMins / 60).toString().padStart(2, '0');
  const openMinute = (openMins % 60).toString().padStart(2, '0');
  const openTimeStr = `${openHour}:${openMinute} WITA`;

  if (isCrossDay) {
    // Shift malam lintas hari: misal open 20:30 (1230), start 22:30 (1350), end 07:30 (450)
    // Sekarang 22:38 (1358) -> nowMins >= openMins (1358 >= 1230) -> TRUE!
    // Sekarang 03:00 (180) -> nowMins < endMins (180 < 450) -> TRUE!
    if (nowMins >= openMins || nowMins < endMins) {
      return { isOpen: true, openTimeStr };
    }
  } else {
    // Shift biasa: misal open 05:30 (330), start 07:30 (450), end 16:30 (990)
    if (openMins > startMins) {
      if (nowMins >= openMins || nowMins <= endMins) {
        return { isOpen: true, openTimeStr };
      }
    } else {
      if (nowMins >= openMins && nowMins <= endMins) {
        return { isOpen: true, openTimeStr };
      }
    }
  }

  // Jika waktu saat ini sudah lewat jam berakhir shift
  const isPastEnd = isCrossDay
    ? (nowMins >= endMins && nowMins < openMins)
    : (nowMins > endMins || nowMins < openMins);

  if (isPastEnd) {
    return {
      isOpen: false,
      openTimeStr,
      reason: `Jadwal shift ${shift.name || shift.startTime + ' - ' + shift.endTime} telah berakhir. Presensi masuk berikutnya dibuka pk ${openTimeStr}.`,
    };
  }

  return {
    isOpen: false,
    openTimeStr,
    reason: `Presensi masuk dibuka mulai pk ${openTimeStr} (2 jam sebelum shift ${shift.startTime})`,
  };
}

/**
 * Memeriksa apakah waktu saat ini diizinkan untuk Absen Pulang (Clock-Out).
 * Memvalidasi apakah jam kepulangan shift telah tiba dan minimum durasi kerja 30 menit telah terpenuhi.
 */
export function checkShiftClockOutWindow(
  shift: Shift | null,
  clockInTimeStr?: string | null,
  currentTime: Date = new Date()
): {
  isAllowed: boolean;
  reason?: string;
  isBeforeEndTime: boolean;
} {
  if (!shift || !shift.endTime) {
    return { isAllowed: true, isBeforeEndTime: false };
  }

  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const [eH, eM] = shift.endTime.split(':').map(Number);
  const endMins = (eH || 0) * 60 + (eM || 0);

  const [sH, sM] = (shift.startTime || '07:30').split(':').map(Number);
  const startMins = (sH || 0) * 60 + (sM || 0);
  const isCrossDay = Boolean(shift.isCrossDay || endMins < startMins);

  let isBeforeEndTime = false;

  if (isCrossDay) {
    // Cross day (e.g. 22:30 - 07:30):
    // Jam 22:30 s/d 23:59 -> belum boleh pulang (isBeforeEndTime = true)
    // Jam 00:00 s/d 07:29 -> belum boleh pulang (isBeforeEndTime = true)
    // Jam 07:30 ke atas -> boleh pulang!
    if (nowMins >= startMins || nowMins < endMins) {
      isBeforeEndTime = true;
    }
  } else {
    // Regular shift (e.g. 07:30 - 16:30):
    // Jam 00:00 s/d 16:29 -> belum jam pulang
    if (nowMins < endMins) {
      isBeforeEndTime = true;
    }
  }

  // Minimum working time guard: setidaknya 30 menit setelah clock-in
  if (clockInTimeStr) {
    const [ciH, ciM] = clockInTimeStr.split(':').map(Number);
    if (!isNaN(ciH) && !isNaN(ciM)) {
      const ciTotal = ciH * 60 + ciM;
      const elapsed = nowMins >= ciTotal ? nowMins - ciTotal : (nowMins + 1440) - ciTotal;
      if (elapsed < 30) {
        return {
          isAllowed: false,
          isBeforeEndTime: true,
          reason: `Tombol pulang terkunci! Minimal durasi kerja 30 menit setelah ceklok masuk (${clockInTimeStr.substring(0, 5)} WITA).`,
        };
      }
    }
  }

  if (isBeforeEndTime) {
    return {
      isAllowed: false,
      isBeforeEndTime: true,
      reason: `Absen Pulang belum aktif! Jadwal pulang shift Anda pk ${shift.endTime.substring(0, 5)} WITA.`,
    };
  }

  return {
    isAllowed: true,
    isBeforeEndTime: false,
  };
}

export interface NextContinuousShiftInfo {
  isNextShiftAvailable: boolean;
  nextShiftCode: 'SHF-I' | 'SHF-II' | 'SHF-III' | 'DAY';
  nextShiftName: string;
  nextShiftStart: string;
  nextShiftEnd: string;
  isNextShiftCrossDay: boolean;
  isNextShiftWindowOpen: boolean;
  nextShiftOpenTimeStr?: string;
  nextShiftDisabledReason?: string;
}

/**
 * Aturan Siklus Kontinu Shift Perusahaan:
 * 1. Day Shift (07:30 - 16:30): Berakhir hari ini, berlanjut esok lagi untuk ceklok masuk.
 * 2. Shift I (07:30 - 15:30): Berakhir Shift I -> Tombol ceklok masuk Shift II (15:30 - 22:30) otomatis aktif.
 * 3. Shift II (15:30 - 22:30): Berakhir Shift II -> Tombol ceklok masuk Shift III (22:30 - 07:30) otomatis aktif.
 * 4. Shift III (22:30 - 07:30): Berakhir Shift III -> Tombol ceklok masuk Shift I (07:30 - 15:30) otomatis aktif.
 * Pengecualian: Karyawan yang bersangkutan sedang Libur (Off Duty), Cuti, atau Izin.
 */
export function determineNextContinuousShift(
  currentShift: Shift | null,
  completedAttendance?: any | null,
  currentTime: Date = new Date(),
  allShifts: Shift[] = []
): NextContinuousShiftInfo {
  const completedShiftName = (completedAttendance?.shiftName || completedAttendance?.shift_name || currentShift?.name || '').toUpperCase();
  const completedShiftCode = (completedAttendance?.shiftCode || completedAttendance?.shift_code || currentShift?.code || '').toUpperCase();

  // 1. Day Shift: Berakhir hari ini, berlanjut esok hari
  if (completedShiftCode.includes('DAY') || completedShiftName.includes('DAY')) {
    const dayShift = allShifts.find(s => s.name?.toUpperCase().includes('DAY')) || currentShift;
    return {
      isNextShiftAvailable: false, // Day shift selesai hari ini, berlanjut esok hari
      nextShiftCode: 'DAY',
      nextShiftName: dayShift?.name || 'Day Shift (07:30 - 16:30 WITA)',
      nextShiftStart: '07:30',
      nextShiftEnd: '16:30',
      isNextShiftCrossDay: false,
      isNextShiftWindowOpen: false,
      nextShiftOpenTimeStr: '05:30 WITA',
      nextShiftDisabledReason: 'Presensi Day Shift hari ini telah selesai. Jadwal shift berikutnya dimulai esok hari pk 07:30 WITA (Buka pk 05:30 WITA).',
    };
  }

  // 2. Shift I (07:30 - 15:30) -> Berlanjut ke Shift II (15:30 - 22:30)
  if (
    completedShiftCode.includes('SHF-I') ||
    completedShiftCode.includes('PAGI') ||
    completedShiftName.includes('SHIFT I ') ||
    completedShiftName.includes('SHIFT I(') ||
    completedShiftName.includes('SHIFT 1')
  ) {
    const shift2 = allShifts.find(s => s.name?.toUpperCase().includes('SHIFT II') || s.name?.toUpperCase().includes('SHIFT 2') || s.code === 'SIANG');
    const start = (shift2?.startTime || '15:30').substring(0, 5);
    const end = (shift2?.endTime || '22:30').substring(0, 5);
    return {
      isNextShiftAvailable: true,
      nextShiftCode: 'SHF-II',
      nextShiftName: shift2?.name || 'Shift II (15:30 - 22:30 WITA)',
      nextShiftStart: start,
      nextShiftEnd: end,
      isNextShiftCrossDay: false,
      isNextShiftWindowOpen: true, // Otomatis aktif begitu Shift I berakhir
      nextShiftOpenTimeStr: '13:30 WITA',
    };
  }

  // 3. Shift II (15:30 - 22:30) -> Berlanjut ke Shift III (22:30 - 07:30)
  if (
    completedShiftCode.includes('SHF-II') ||
    completedShiftCode.includes('SIANG') ||
    completedShiftName.includes('SHIFT II') ||
    completedShiftName.includes('SHIFT 2')
  ) {
    const shift3 = allShifts.find(s => s.name?.toUpperCase().includes('SHIFT III') || s.name?.toUpperCase().includes('SHIFT 3') || s.code === 'MALAM');
    const start = (shift3?.startTime || '22:30').substring(0, 5);
    const end = (shift3?.endTime || '07:30').substring(0, 5);
    return {
      isNextShiftAvailable: true,
      nextShiftCode: 'SHF-III',
      nextShiftName: shift3?.name || 'Shift III (22:30 - 07:30 WITA)',
      nextShiftStart: start,
      nextShiftEnd: end,
      isNextShiftCrossDay: true,
      isNextShiftWindowOpen: true, // Otomatis aktif begitu Shift II berakhir
      nextShiftOpenTimeStr: '20:30 WITA',
    };
  }

  // 4. Shift III (22:30 - 07:30) -> Berlanjut ke Shift I (07:30 - 15:30)
  if (
    completedShiftCode.includes('SHF-III') ||
    completedShiftCode.includes('MALAM') ||
    completedShiftName.includes('SHIFT III') ||
    completedShiftName.includes('SHIFT 3')
  ) {
    const shift1 = allShifts.find(s => s.name?.toUpperCase().includes('SHIFT I ') || s.name?.toUpperCase().includes('SHIFT I(') || s.name?.toUpperCase().includes('SHIFT 1') || s.code === 'PAGI');
    const start = (shift1?.startTime || '07:30').substring(0, 5);
    const end = (shift1?.endTime || '15:30').substring(0, 5);
    return {
      isNextShiftAvailable: true,
      nextShiftCode: 'SHF-I',
      nextShiftName: shift1?.name || 'Shift I (07:30 - 15:30 WITA)',
      nextShiftStart: start,
      nextShiftEnd: end,
      isNextShiftCrossDay: false,
      isNextShiftWindowOpen: true, // Otomatis aktif begitu Shift III berakhir
      nextShiftOpenTimeStr: '05:30 WITA',
    };
  }

  // Default fallback
  return {
    isNextShiftAvailable: false,
    nextShiftCode: 'DAY',
    nextShiftName: 'Day Shift (07:30 - 16:30 WITA)',
    nextShiftStart: '07:30',
    nextShiftEnd: '16:30',
    isNextShiftCrossDay: false,
    isNextShiftWindowOpen: false,
    nextShiftOpenTimeStr: '05:30 WITA',
  };
}

export interface LatenessCalculationResult {
  status: 'hadir' | 'terlambat';
  lateMinutes: number;
  totalLateFromStart: number;
  toleranceMinutes: number;
  shiftStartMinutes: number;
  clockInMinutes: number;
}

/**
 * Standar Authoritative Evaluasi Keterlambatan Realtime untuk Seluruh Shift FRP:
 * - Menangani seluruh pola shift: Day Shift, Shift I, Shift II, Shift III (lintas hari / cross-day), Shift Khusus Lapangan, Roster Harian.
 * - Kebijakan PP 35 / Perusahaan: Keterlambatan murni dihitung setelah batas toleransi (diff - tolerance).
 * - Menangani format menit :00, :15, :30, :45 tanpa bug falsy.
 */
export function calculateAttendanceLateness(params: {
  clockInTime?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  lateToleranceMinutes?: number | null;
  isCrossDay?: boolean | null;
  isOffDay?: boolean | null;
}): LatenessCalculationResult {
  if (params.isOffDay) {
    return {
      status: 'hadir',
      lateMinutes: 0,
      totalLateFromStart: 0,
      toleranceMinutes: 0,
      shiftStartMinutes: 0,
      clockInMinutes: 0,
    };
  }

  const [sH, sM] = (params.shiftStartTime || '07:30').split(':').map(Number);
  const startMins = (Number.isFinite(sH) ? sH : 7) * 60 + (Number.isFinite(sM) ? sM : 0);

  const [cH, cM] = (params.clockInTime || '00:00').split(':').map(Number);
  const clockInMins = (Number.isFinite(cH) ? cH : 0) * 60 + (Number.isFinite(cM) ? cM : 0);

  let isCross = Boolean(params.isCrossDay);
  if (params.shiftEndTime) {
    const [eH, eM] = params.shiftEndTime.split(':').map(Number);
    const endMins = (Number.isFinite(eH) ? eH : 16) * 60 + (Number.isFinite(eM) ? eM : 0);
    if (endMins < startMins) isCross = true;
  }

  let diff = clockInMins - startMins;
  if (isCross && clockInMins < 720 && startMins >= 720) {
    diff = (clockInMins + 1440) - startMins;
  }

  const tolerance = (params.lateToleranceMinutes != null && Number.isFinite(Number(params.lateToleranceMinutes)))
    ? Number(params.lateToleranceMinutes)
    : 15;

  if (diff > tolerance) {
    return {
      status: 'terlambat',
      lateMinutes: Math.max(0, diff - tolerance),
      totalLateFromStart: Math.max(0, diff),
      toleranceMinutes: tolerance,
      shiftStartMinutes: startMins,
      clockInMinutes: clockInMins,
    };
  }

  return {
    status: 'hadir',
    lateMinutes: 0,
    totalLateFromStart: Math.max(0, diff),
    toleranceMinutes: tolerance,
    shiftStartMinutes: startMins,
    clockInMinutes: clockInMins,
  };
}


