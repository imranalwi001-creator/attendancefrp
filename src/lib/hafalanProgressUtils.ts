import { QURAN_JUZ_SURAH_MAPPING, JuzSurahMapping } from "@/data/quranJuzSurahMapping";

// ============= INTERFACES =============

export interface VerseRange {
  start: number;
  end: number;
}

export interface Gap {
  start: number;
  end: number;
  count: number;
}

export interface SurahProgress {
  surahNumber: number;
  surahName: string;
  surahNameArabic: string;
  totalVersesInJuz: number; // Total verses of this surah in this specific Juz
  totalVersesInSurah: number; // Total verses in the entire surah
  versesInJuzRange: VerseRange; // Range of verses for this surah in this juz
  memorizedVerses: number[]; // Array of memorized verse numbers
  memorizedCount: number;
  gaps: Gap[]; // Gaps in memorization
  percentage: number;
  isComplete: boolean;
}

export interface JuzProgress {
  juzNumber: number;
  surahs: SurahProgress[];
  totalVersesInJuz: number;
  memorizedVersesInJuz: number;
  percentage: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface ZiyadahRecord {
  surah: string | null;
  juz: number | null;
  ayat_awal: number | null;
  ayat_akhir: number | null;
  status: string;
  mode?: string | null;
  tipe?: string;
}

// ============= HELPER FUNCTIONS =============

/**
 * Normalize surah name for comparison
 * Handles variations like "Al-Qamar" vs "Al Qamar" vs "al qamar"
 */
function normalizeSurahName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\-'`]/g, "") // Remove apostrophes and hyphens
    .replace(/\s+/g, "") // Remove spaces
    .trim();
}

/**
 * Find surah mapping by name
 */
export function findSurahByName(surahName: string): JuzSurahMapping | null {
  const normalizedInput = normalizeSurahName(surahName);
  return QURAN_JUZ_SURAH_MAPPING.find(
    item => normalizeSurahName(item.surah_name_latin) === normalizedInput
  ) || null;
}

/**
 * Get all unique surah mappings (for looking up total verses)
 */
export function getSurahInfo(surahName: string): { totalVerses: number; surahNumber: number } | null {
  const mapping = findSurahByName(surahName);
  if (!mapping) return null;
  return {
    totalVerses: mapping.total_verses_in_surah,
    surahNumber: mapping.surah_number
  };
}

/**
 * Merge overlapping or adjacent verse ranges
 * Input: [[1,5], [3,8], [10,15]] 
 * Output: [[1,8], [10,15]]
 */
export function mergeVerseRanges(ranges: VerseRange[]): VerseRange[] {
  if (ranges.length === 0) return [];
  
  // Sort by start verse
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: VerseRange[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    // Check if current overlaps or is adjacent to last
    if (current.start <= last.end + 1) {
      // Merge: extend the end if needed
      last.end = Math.max(last.end, current.end);
    } else {
      // No overlap, add new range
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Convert merged ranges to array of individual verses
 */
export function rangesToVerseArray(ranges: VerseRange[]): number[] {
  const verses: number[] = [];
  for (const range of ranges) {
    for (let v = range.start; v <= range.end; v++) {
      verses.push(v);
    }
  }
  return [...new Set(verses)].sort((a, b) => a - b);
}

/**
 * Find gaps between memorized verses within a given range
 */
export function findGaps(memorizedRanges: VerseRange[], totalRange: VerseRange): Gap[] {
  if (memorizedRanges.length === 0) {
    return [{
      start: totalRange.start,
      end: totalRange.end,
      count: totalRange.end - totalRange.start + 1
    }];
  }
  
  const merged = mergeVerseRanges(memorizedRanges);
  const gaps: Gap[] = [];
  
  // Check gap before first memorized range
  if (merged[0].start > totalRange.start) {
    gaps.push({
      start: totalRange.start,
      end: merged[0].start - 1,
      count: merged[0].start - totalRange.start
    });
  }
  
  // Check gaps between memorized ranges
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i].end + 1;
    const gapEnd = merged[i + 1].start - 1;
    if (gapEnd >= gapStart) {
      gaps.push({
        start: gapStart,
        end: gapEnd,
        count: gapEnd - gapStart + 1
      });
    }
  }
  
  // Check gap after last memorized range
  const lastMerged = merged[merged.length - 1];
  if (lastMerged.end < totalRange.end) {
    gaps.push({
      start: lastMerged.end + 1,
      end: totalRange.end,
      count: totalRange.end - lastMerged.end
    });
  }
  
  return gaps;
}

// ============= MAIN CALCULATION FUNCTIONS =============

/**
 * Calculate progress for a specific surah within a specific Juz
 */
export function calculateSurahProgressInJuz(
  juzNumber: number,
  surahMapping: JuzSurahMapping,
  records: ZiyadahRecord[]
): SurahProgress {
  const versesInJuzRange: VerseRange = {
    start: surahMapping.start_verse_in_juz,
    end: surahMapping.end_verse_in_juz
  };
  const totalVersesInJuz = versesInJuzRange.end - versesInJuzRange.start + 1;
  
  // Filter records for this surah that are valid ziyadah
  const surahRecords = records.filter(r => {
    if (!r.surah) return false;
    if (r.tipe === "tahsin") return false;
    if (r.mode !== "ziyadah") return false;
    if (r.status !== "lanjut" && r.status !== "selesai") return false;
    
    const normalizedRecordSurah = normalizeSurahName(r.surah);
    const normalizedMappingSurah = normalizeSurahName(surahMapping.surah_name_latin);
    return normalizedRecordSurah === normalizedMappingSurah;
  });
  
  // Collect all memorized verse ranges for this surah within this juz
  const memorizedRanges: VerseRange[] = [];
  
  for (const record of surahRecords) {
    if (record.ayat_awal && record.ayat_akhir) {
      // Clamp to juz boundaries
      const clampedStart = Math.max(record.ayat_awal, versesInJuzRange.start);
      const clampedEnd = Math.min(record.ayat_akhir, versesInJuzRange.end);
      
      if (clampedStart <= clampedEnd) {
        memorizedRanges.push({ start: clampedStart, end: clampedEnd });
      }
    }
  }
  
  // Merge overlapping ranges
  const mergedRanges = mergeVerseRanges(memorizedRanges);
  const memorizedVerses = rangesToVerseArray(mergedRanges);
  
  // Only count verses within the juz range
  const memorizedInJuz = memorizedVerses.filter(
    v => v >= versesInJuzRange.start && v <= versesInJuzRange.end
  );
  const memorizedCount = memorizedInJuz.length;
  
  // Calculate gaps
  const gaps = memorizedCount > 0 
    ? findGaps(mergedRanges, versesInJuzRange)
    : [{
        start: versesInJuzRange.start,
        end: versesInJuzRange.end,
        count: totalVersesInJuz
      }];
  
  // Calculate percentage
  const percentage = totalVersesInJuz > 0 
    ? Math.round((memorizedCount / totalVersesInJuz) * 100) 
    : 0;
  
  return {
    surahNumber: surahMapping.surah_number,
    surahName: surahMapping.surah_name_latin,
    surahNameArabic: surahMapping.surah_name_arabic,
    totalVersesInJuz,
    totalVersesInSurah: surahMapping.total_verses_in_surah,
    versesInJuzRange,
    memorizedVerses: memorizedInJuz,
    memorizedCount,
    gaps: gaps.filter(g => g.count > 0),
    percentage,
    isComplete: percentage === 100
  };
}

/**
 * Calculate progress for an entire Juz
 */
export function calculateJuzProgress(
  juzNumber: number,
  records: ZiyadahRecord[]
): JuzProgress {
  // Get all surahs in this juz
  const surahsInJuz = QURAN_JUZ_SURAH_MAPPING.filter(
    item => item.juz_number === juzNumber
  );
  
  // Calculate progress for each surah
  const surahProgresses: SurahProgress[] = surahsInJuz.map(surahMapping => 
    calculateSurahProgressInJuz(juzNumber, surahMapping, records)
  );
  
  // Aggregate totals
  const totalVersesInJuz = surahProgresses.reduce(
    (sum, sp) => sum + sp.totalVersesInJuz, 
    0
  );
  const memorizedVersesInJuz = surahProgresses.reduce(
    (sum, sp) => sum + sp.memorizedCount, 
    0
  );
  
  // Calculate overall percentage
  const percentage = totalVersesInJuz > 0 
    ? Math.round((memorizedVersesInJuz / totalVersesInJuz) * 100) 
    : 0;
  
  // Determine status
  let status: 'not_started' | 'in_progress' | 'completed';
  if (percentage === 0) {
    status = 'not_started';
  } else if (percentage === 100) {
    status = 'completed';
  } else {
    status = 'in_progress';
  }
  
  return {
    juzNumber,
    surahs: surahProgresses,
    totalVersesInJuz,
    memorizedVersesInJuz,
    percentage,
    status
  };
}

/**
 * Calculate progress for all 30 Juz
 */
export function getAllJuzProgress(records: ZiyadahRecord[]): JuzProgress[] {
  const allProgress: JuzProgress[] = [];
  
  for (let juz = 1; juz <= 30; juz++) {
    allProgress.push(calculateJuzProgress(juz, records));
  }
  
  return allProgress;
}

/**
 * Get summary statistics from all juz progress
 */
export function getProgressSummary(allJuzProgress: JuzProgress[]): {
  totalCompleted: number;
  totalInProgress: number;
  totalNotStarted: number;
  overallPercentage: number;
  totalMemorizedVerses: number;
  totalVerses: number;
} {
  let totalCompleted = 0;
  let totalInProgress = 0;
  let totalNotStarted = 0;
  let totalMemorizedVerses = 0;
  let totalVerses = 0;
  
  for (const juzProgress of allJuzProgress) {
    if (juzProgress.status === 'completed') totalCompleted++;
    else if (juzProgress.status === 'in_progress') totalInProgress++;
    else totalNotStarted++;
    
    totalMemorizedVerses += juzProgress.memorizedVersesInJuz;
    totalVerses += juzProgress.totalVersesInJuz;
  }
  
  const overallPercentage = totalVerses > 0 
    ? Math.round((totalMemorizedVerses / totalVerses) * 100) 
    : 0;
  
  return {
    totalCompleted,
    totalInProgress,
    totalNotStarted,
    overallPercentage,
    totalMemorizedVerses,
    totalVerses
  };
}

/**
 * Get in-progress surahs across all Juz for display
 */
export function getInProgressSurahs(allJuzProgress: JuzProgress[]): Array<{
  juzNumber: number;
  surah: SurahProgress;
}> {
  const inProgressSurahs: Array<{ juzNumber: number; surah: SurahProgress }> = [];
  
  for (const juzProgress of allJuzProgress) {
    for (const surah of juzProgress.surahs) {
      if (surah.percentage > 0 && surah.percentage < 100) {
        inProgressSurahs.push({
          juzNumber: juzProgress.juzNumber,
          surah
        });
      }
    }
  }
  
  // Sort by percentage descending (closest to completion first)
  return inProgressSurahs.sort((a, b) => b.surah.percentage - a.surah.percentage);
}
