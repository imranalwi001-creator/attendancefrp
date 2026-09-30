/**
 * Date utility functions that consistently use local timezone
 * to avoid UTC/local timezone mismatches
 */

/**
 * Get current date string in YYYY-MM-DD format using local timezone
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current time string in HH:MM format using local timezone
 */
export function getLocalTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get current day name in Indonesian (Senin, Selasa, etc.)
 */
export function getTodayHari(date: Date = new Date()): string {
  const dayIndex = date.getDay();
  const mapping = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return mapping[dayIndex];
}

/**
 * Get date string for a specific day of the current week
 * Returns the date in YYYY-MM-DD format
 */
export function getDateForDay(targetHari: string, referenceDate: Date = new Date()): string {
  const hariOrder = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDayIndex = referenceDate.getDay();
  const targetDayIndex = hariOrder.indexOf(targetHari);
  
  if (targetDayIndex === -1) return getLocalDateString(referenceDate);
  
  // Calculate difference in days
  const diff = targetDayIndex - todayDayIndex;
  
  // Create target date
  const targetDate = new Date(referenceDate);
  targetDate.setDate(referenceDate.getDate() + diff);
  
  return getLocalDateString(targetDate);
}

/**
 * Get full ISO timestamp with local timezone info
 * Useful for database insertions where we need full timestamp
 */
export function getLocalISOString(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Parse a date/time coming from Supabase/Postgres in a Jakarta-friendly way.
 *
 * Why: some columns are stored without timezone (e.g. "2026-01-07 12:00:00" or
 * "2026-01-07T12:00:00"). JS will interpret these as *browser local* time,
 * which can incorrectly mark deadlines as "passed" for users in different TZ.
 */
export function parseJakartaDateTime(value?: string | null): Date | null {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  // Normalize "YYYY-MM-DD HH:mm:ss" -> ISO-ish
  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;

  // If only a date is provided, treat it as end-of-day Jakarta time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T23:59:59+07:00`);
  }

  // If timezone is already provided (Z or +hh:mm), keep it.
  if (/[zZ]$/.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }

  // Otherwise assume the stored time is Jakarta time.
  return new Date(`${normalized}+07:00`);
}
