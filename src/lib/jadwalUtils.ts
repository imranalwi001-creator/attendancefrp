import { getLocalDateString, getLocalTimeString } from '@/lib/dateUtils';

export const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export interface SubstituteValidation {
  allowed: boolean;
  message: string;
}

export function canAssignSubstitute(
  status: JadwalStatus
): SubstituteValidation {
  // Guru pengganti hanya bisa ditentukan jika status masih 'belum_dimulai'
  const blockedStatuses: JadwalStatus[] = ['sedang_berlangsung', 'selesai', 'tidak_ada_pembelajaran'];
  
  if (blockedStatuses.includes(status)) {
    const statusLabels: Record<JadwalStatus, string> = {
      sedang_berlangsung: 'Sedang Berlangsung',
      selesai: 'Selesai',
      tidak_ada_pembelajaran: 'Tidak Ada Pembelajaran',
      belum_dimulai: 'Belum Dimulai'
    };
    
    return {
      allowed: false,
      message: `Tidak dapat menentukan guru pengganti. Status pembelajaran saat ini: "${statusLabels[status]}".`
    };
  }
  
  return {
    allowed: true,
    message: ''
  };
}

export type JadwalStatus = 'belum_dimulai' | 'sedang_berlangsung' | 'selesai' | 'tidak_ada_pembelajaran';

export const STATUS_CONFIG: Record<JadwalStatus, {
  label: string;
  className: string;
}> = {
  sedang_berlangsung: {
    label: 'Sedang Berlangsung',
    className: 'bg-primary/10 text-primary border-transparent'
  },
  selesai: {
    label: 'Selesai',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent'
  },
  belum_dimulai: {
    label: 'Belum dimulai',
    className: 'bg-muted/60 text-muted-foreground border-transparent'
  },
  tidak_ada_pembelajaran: {
    label: 'Tidak ada pembelajaran',
    className: 'bg-destructive/10 text-destructive border-transparent'
  }
};

export function getJadwalStatus(
  jadwal: any, 
  sesiHariIni: any, 
  currentTime: string, 
  selectedDate: string, 
  todayDate: string
): JadwalStatus {
  // A session is only considered started/finished when it has waktu_mulai.
  // Some rows may exist without start data; those must stay "Belum dimulai".
  if (sesiHariIni && !sesiHariIni.waktu_mulai) {
    return 'belum_dimulai';
  }

  // If selected date is in the FUTURE
  if (selectedDate > todayDate) {
    return 'belum_dimulai';
  }

  // If selected date is in the PAST
  if (selectedDate < todayDate) {
    if (sesiHariIni?.waktu_mulai && sesiHariIni?.waktu_selesai) {
      return 'selesai';
    }
    return 'belum_dimulai';
  }

  // Selected date = TODAY - use real-time logic
  if (sesiHariIni) {
    if (sesiHariIni.waktu_mulai && sesiHariIni.waktu_selesai) {
      return 'selesai';
    }
    if (sesiHariIni.waktu_mulai) {
      return 'sedang_berlangsung';
    }
  }

  // No session exists for today
  return 'belum_dimulai';
}

export interface AttendanceValidation {
  allowed: boolean;
  message: string;
}

const EARLY_START_MINUTES = 10; // Guru bisa mulai 10 menit sebelum jadwal

export function isWithinAttendanceWindow(
  jamMulai: string, 
  jamSelesai: string, 
  currentTime: string
): AttendanceValidation {
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const currentMinutes = parseTime(currentTime);
  const startMinutes = parseTime(jamMulai);
  const endMinutes = parseTime(jamSelesai);
  const earliestStartMinutes = startMinutes - EARLY_START_MINUTES;

  if (currentMinutes < earliestStartMinutes) {
    const diffMinutes = earliestStartMinutes - currentMinutes;
    return {
      allowed: false,
      message: `Absensi belum dapat dimulai. Anda dapat memulai absensi ${diffMinutes} menit lagi (${EARLY_START_MINUTES} menit sebelum jam ${jamMulai}).`
    };
  }
  
  if (currentMinutes > endMinutes) {
    return {
      allowed: false,
      message: `Waktu untuk memulai absensi telah berakhir. Jadwal pembelajaran sudah selesai pada jam ${jamSelesai}.`
    };
  }
  
  return {
    allowed: true,
    message: ''
  };
}

export function validateStartLearning(
  selectedDate: string,
  jadwal: any,
  blockSelectedDates?: string[] | null
): AttendanceValidation {
  const now = new Date();
  const realTimeTodayDate = getLocalDateString(now);
  const realTimeCurrentTime = getLocalTimeString(now);

  // Validasi 1: Cek apakah hari ini termasuk dalam blok pembelajaran (jika ada)
  if (blockSelectedDates && blockSelectedDates.length > 0) {
    if (!blockSelectedDates.includes(realTimeTodayDate)) {
      const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
      return {
        allowed: false,
        message: `Hari ini bukan jadwal pembelajaran dalam blok ini. Pembelajaran hanya dapat dimulai pada tanggal yang sudah ditentukan dalam blok.`
      };
    }
  }

  // Validasi 2: Cek apakah tanggal yang dipilih sesuai dengan hari ini
  if (selectedDate > realTimeTodayDate) {
    return {
      allowed: false,
      message: `Absensi belum dapat dimulai. Jadwal ini untuk tanggal ${selectedDate}, silakan kembali pada hari tersebut.`
    };
  }
  
  if (selectedDate < realTimeTodayDate) {
    return {
      allowed: false,
      message: `Waktu untuk memulai absensi telah berakhir. Jadwal ini untuk tanggal ${selectedDate} yang sudah lewat.`
    };
  }

  // Validasi 3: Cek jendela waktu absensi
  return isWithinAttendanceWindow(jadwal.jam_mulai, jadwal.jam_selesai, realTimeCurrentTime);
}
