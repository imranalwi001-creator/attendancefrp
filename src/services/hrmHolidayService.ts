import { api } from '@/services/apiClient';

export interface NationalHoliday {
  id?: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national' | 'cuti_bersama' | 'company';
  description?: string;
  year?: number;
}

/**
 * Daftar Resmi Hari Libur Nasional Republik Indonesia Tahun 2026 (SKB 3 Menteri)
 * Digunakan sebagai sumber data lokal cepat (instant offline-first) & disinkronkan dengan database PostgreSQL VPS.
 */
export const INDONESIA_NATIONAL_HOLIDAYS_2026: NationalHoliday[] = [
  { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi', type: 'national', year: 2026 },
  { date: '2026-01-16', name: "Isra Mi'raj Nabi Muhammad SAW", type: 'national', year: 2026 },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', type: 'national', year: 2026 },
  { date: '2026-03-20', name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', type: 'national', year: 2026 },
  { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 Hijriah (Hari 1)', type: 'national', year: 2026 },
  { date: '2026-03-22', name: 'Hari Raya Idul Fitri 1447 Hijriah (Hari 2)', type: 'national', year: 2026 },
  { date: '2026-04-03', name: 'Wafat Yesus Kristus (Jumat Agung)', type: 'national', year: 2026 },
  { date: '2026-04-05', name: 'Hari Kebangkitan Yesus Kristus (Paskah)', type: 'national', year: 2026 },
  { date: '2026-05-01', name: 'Hari Buruh Internasional', type: 'national', year: 2026 },
  { date: '2026-05-14', name: 'Kenaikan Yesus Kristus', type: 'national', year: 2026 },
  { date: '2026-05-28', name: 'Hari Raya Idul Adha 1447 Hijriah', type: 'national', year: 2026 },
  { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE', type: 'national', year: 2026 },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila', type: 'national', year: 2026 },
  { date: '2026-06-17', name: 'Tahun Baru Islam 1448 Hijriah', type: 'national', year: 2026 },
  { date: '2026-08-17', name: 'Hari Proklamasi Kemerdekaan RI ke-81', type: 'national', year: 2026 },
  { date: '2026-08-26', name: 'Maulid Nabi Muhammad SAW', type: 'national', year: 2026 },
  { date: '2026-12-25', name: 'Hari Raya Natal', type: 'national', year: 2026 },
];

// In-memory cache for dynamic holidays fetched from server
let cachedServerHolidays: Map<string, NationalHoliday> = new Map();
let isInitialized = false;

// Pre-fill cache with 2026 defaults
INDONESIA_NATIONAL_HOLIDAYS_2026.forEach((h) => {
  cachedServerHolidays.set(h.date, h);
});

export const hrmHolidayService = {
  /**
   * Mengambil daftar hari libur dari backend PostgreSQL
   */
  async fetchHolidays(year?: number): Promise<NationalHoliday[]> {
    try {
      const res = await api.get<{ success: boolean; data: any[] }>(`/holidays${year ? `?year=${year}` : ''}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        res.data.data.forEach((row: any) => {
          const dateStr = typeof row.date === 'string' ? row.date.substring(0, 10) : '';
          if (dateStr) {
            cachedServerHolidays.set(dateStr, {
              id: row.id,
              date: dateStr,
              name: row.name,
              type: row.type || 'national',
              description: row.description,
              year: row.year,
            });
          }
        });
        isInitialized = true;
        return Array.from(cachedServerHolidays.values());
      }
    } catch {
      // Fallback ke built-in list
    }
    return Array.from(cachedServerHolidays.values());
  },

  /**
   * Mengecek secara sinkron (instant) apakah suatu tanggal adalah Libur Nasional
   */
  isNationalHoliday(dateStr: string): { isHoliday: boolean; holiday?: NationalHoliday } {
    if (!dateStr) return { isHoliday: false };
    const cleanDate = dateStr.substring(0, 10);
    const holiday = cachedServerHolidays.get(cleanDate);
    if (holiday) {
      return { isHoliday: true, holiday };
    }
    return { isHoliday: false };
  },

  /**
   * Mengecek apakah suatu tanggal adalah Weekend (Sabtu/Minggu) ATAU Tanggal Merah Libur Nasional
   */
  isWeekendOrHoliday(dateStr: string): {
    isWeekendOrHoliday: boolean;
    isWeekend: boolean;
    isNationalHoliday: boolean;
    holidayName?: string;
    description: string;
  } {
    if (!dateStr) {
      return {
        isWeekendOrHoliday: false,
        isWeekend: false,
        isNationalHoliday: false,
        description: 'Hari Kerja Normal',
      };
    }

    const cleanDate = dateStr.substring(0, 10);
    const [y, m, d] = cleanDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const holCheck = this.isNationalHoliday(cleanDate);

    if (holCheck.isHoliday && holCheck.holiday) {
      return {
        isWeekendOrHoliday: true,
        isWeekend,
        isNationalHoliday: true,
        holidayName: holCheck.holiday.name,
        description: `Libur Nasional: ${holCheck.holiday.name}${isWeekend ? ' (Akhir Pekan)' : ''}`,
      };
    }

    if (isWeekend) {
      return {
        isWeekendOrHoliday: true,
        isWeekend: true,
        isNationalHoliday: false,
        description: dayOfWeek === 0 ? 'Akhir Pekan (Minggu)' : 'Akhir Pekan (Sabtu)',
      };
    }

    return {
      isWeekendOrHoliday: false,
      isWeekend: false,
      isNationalHoliday: false,
      description: 'Hari Kerja Normal',
    };
  },
};
