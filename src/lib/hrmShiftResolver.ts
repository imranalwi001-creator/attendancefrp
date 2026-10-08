import { Shift, UserProfile, EmployeeSchedule } from '@/types/hrm';

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
  // 1. Jadwal Roster Harian (Jika Ada dan Bukan Libur)
  if (dailySchedule && !dailySchedule.isOff && dailySchedule.startTime && dailySchedule.endTime) {
    const isNight = Boolean(dailySchedule.isNightShift || (dailySchedule.endTime < dailySchedule.startTime));
    return {
      id: dailySchedule.shiftId || `sched-${dailySchedule.shiftCode || 'REG'}`,
      code: dailySchedule.shiftCode || 'SHF',
      name: dailySchedule.shiftName || 'Shift Terjadwal',
      startTime: dailySchedule.startTime,
      endTime: dailySchedule.endTime,
      lateToleranceMinutes: 15,
      earliestClockInMinutes: 120, // 2 Jam (120 menit) Datang Lebih Cepat Boleh Absen Masuk!
      isCrossDay: isNight,
      colorTag: dailySchedule.shiftCode === 'P' ? '#3b82f6' : dailySchedule.shiftCode === 'S' ? '#f59e0b' : '#8b5cf6',
    };
  }

  // 2. Coba cocokkan user.shiftId dengan ID di master shifts
  const shiftById = user?.shiftId ? allShifts.find((s) => s.id === user.shiftId) : null;
  if (shiftById) {
    const isCross = Boolean(shiftById.isCrossDay || (shiftById.startTime && shiftById.endTime && shiftById.endTime < shiftById.startTime));
    const res: Shift = {
      ...shiftById,
      earliestClockInMinutes: shiftById.earliestClockInMinutes || 120,
      isCrossDay: isCross,
    };
    if (user?.shiftStartTime) res.startTime = user.shiftStartTime;
    if (user?.shiftEndTime) res.endTime = user.shiftEndTime;
    if (user?.customStartTime) res.startTime = user.customStartTime;
    if (user?.customEndTime) res.endTime = user.customEndTime;
    if (user?.lateToleranceMinutes != null) res.lateToleranceMinutes = user.lateToleranceMinutes;
    return res;
  }

  // 3. Ekstraksi langsung dari user.shiftName jika mengandung jam (misal: "Shift III (22:30 - 07:30 WITA)")
  const userShiftName = user?.shiftName || '';
  const parsedFromName = extractTimesFromShiftName(userShiftName);
  if (parsedFromName) {
    const sStart = user?.customStartTime || user?.shiftStartTime || parsedFromName.startTime!;
    const sEnd = user?.customEndTime || user?.shiftEndTime || parsedFromName.endTime!;
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
      startTime: user?.customStartTime || user?.shiftStartTime || nightMaster?.startTime || '22:30',
      endTime: user?.customEndTime || user?.shiftEndTime || nightMaster?.endTime || '07:30',
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
      startTime: user?.customStartTime || user?.shiftStartTime || afternoonMaster?.startTime || '15:30',
      endTime: user?.customEndTime || user?.shiftEndTime || afternoonMaster?.endTime || '22:30',
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
      startTime: user?.customStartTime || user?.shiftStartTime || morningMaster?.startTime || '07:30',
      endTime: user?.customEndTime || user?.shiftEndTime || morningMaster?.endTime || '15:30',
      breakStartTime: morningMaster?.breakStartTime || '11:30',
      breakEndTime: morningMaster?.breakEndTime || '12:30',
      lateToleranceMinutes: user?.lateToleranceMinutes ?? (morningMaster?.lateToleranceMinutes || 15),
      earliestClockInMinutes: 120,
      isCrossDay: false,
      colorTag: '#3b82f6',
    };
  }

  // 5. Default Fallback ke Shift pertama atau Day Shift
  const base = allShifts[0] || {
    id: 'shift-regular',
    code: 'DAY',
    name: 'Day Shift (07:30 - 16:30 WITA)',
    startTime: '07:30',
    endTime: '16:30',
    lateToleranceMinutes: 15,
    earliestClockInMinutes: 120,
    isCrossDay: false,
    colorTag: '#0d9488',
  };

  const finalShift = { ...base };
  if (user?.shiftStartTime) finalShift.startTime = user.shiftStartTime;
  if (user?.shiftEndTime) finalShift.endTime = user.shiftEndTime;
  if (user?.customStartTime) finalShift.startTime = user.customStartTime;
  if (user?.customEndTime) finalShift.endTime = user.customEndTime;
  if (user?.lateToleranceMinutes != null) finalShift.lateToleranceMinutes = user.lateToleranceMinutes;
  finalShift.earliestClockInMinutes = finalShift.earliestClockInMinutes || 120;
  finalShift.isCrossDay = finalShift.endTime < finalShift.startTime;

  return finalShift;
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
  if (!shift || !shift.startTime || !shift.endTime) {
    // Menolak akses jika data shift belum termuat dari sistem/database
    return {
      isOpen: false,
      reason: 'Sedang memuat data jadwal shift karyawan...',
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
