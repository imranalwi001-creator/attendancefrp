import { supabase } from "@/integrations/supabase/client";
import { getTotalAyatBySurahNumber } from "@/data/quranJuzSurahMapping";

export interface OverlapResult {
  hasOverlap: boolean;
  overlappingRanges: { ayat_awal: number; ayat_akhir: number }[];
}

export interface SurahCompletionResult {
  isComplete: boolean;
  percentage: number;
  coveredAyat: number[];
  totalAyat: number;
}

/**
 * Check if the given ayat range overlaps with existing records for a santri + surah
 */
export async function checkAyatOverlap(
  santriId: string,
  surahName: string,
  ayatAwal: number,
  ayatAkhir: number
): Promise<OverlapResult> {
  const { data: existing } = await supabase
    .from("tahfidz_tahsin")
    .select("ayat_awal, ayat_akhir")
    .eq("santri_id", santriId)
    .eq("surah", surahName)
    .eq("mode", "ziyadah")
    .not("ayat_awal", "is", null)
    .not("ayat_akhir", "is", null);

  if (!existing || existing.length === 0) {
    return { hasOverlap: false, overlappingRanges: [] };
  }

  const overlapping = existing.filter((rec) => {
    const recStart = rec.ayat_awal!;
    const recEnd = rec.ayat_akhir!;
    return ayatAwal <= recEnd && ayatAkhir >= recStart;
  });

  return {
    hasOverlap: overlapping.length > 0,
    overlappingRanges: overlapping.map((r) => ({
      ayat_awal: r.ayat_awal!,
      ayat_akhir: r.ayat_akhir!,
    })),
  };
}

/**
 * Check if all ayat of a surah are covered by existing records
 */
export async function checkSurahCompletion(
  santriId: string,
  surahName: string,
  surahNumber: number
): Promise<SurahCompletionResult> {
  const totalAyat = getTotalAyatBySurahNumber(surahNumber) || 0;
  if (totalAyat === 0) {
    return { isComplete: false, percentage: 0, coveredAyat: [], totalAyat: 0 };
  }

  const { data: records } = await supabase
    .from("tahfidz_tahsin")
    .select("ayat_awal, ayat_akhir")
    .eq("santri_id", santriId)
    .eq("surah", surahName)
    .eq("mode", "ziyadah")
    .not("ayat_awal", "is", null)
    .not("ayat_akhir", "is", null);

  const coveredSet = new Set<number>();
  (records || []).forEach((rec) => {
    for (let i = rec.ayat_awal!; i <= rec.ayat_akhir!; i++) {
      coveredSet.add(i);
    }
  });

  const coveredAyat = Array.from(coveredSet).sort((a, b) => a - b);
  const percentage = Math.round((coveredAyat.length / totalAyat) * 100);

  return {
    isComplete: coveredAyat.length >= totalAyat,
    percentage,
    coveredAyat,
    totalAyat,
  };
}

/**
 * Check if a surah can be finalized (all ayat covered)
 */
export async function canFinalizeSurah(
  santriId: string,
  surahName: string,
  surahNumber: number
): Promise<{ allowed: boolean; message: string }> {
  const completion = await checkSurahCompletion(santriId, surahName, surahNumber);

  if (!completion.isComplete) {
    return {
      allowed: false,
      message: `Surah belum lengkap (${completion.percentage}%). Lengkapi semua ayat terlebih dahulu sebelum finalisasi.`,
    };
  }

  return { allowed: true, message: "" };
}

/**
 * Format overlap error message
 */
export function formatOverlapError(
  ranges: { ayat_awal: number; ayat_akhir: number }[]
): string {
  const rangeStrs = ranges.map((r) => `ayat ${r.ayat_awal}-${r.ayat_akhir}`);
  return `Ayat bertumpang tindih dengan data yang sudah ada: ${rangeStrs.join(", ")}`;
}
