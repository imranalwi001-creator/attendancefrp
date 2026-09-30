import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, startOfDay } from "date-fns";
import { useCallback, useMemo } from "react";
import { useActiveAcademicYear } from "./useActiveAcademicYear";

export interface TahfidzTahsinRecord {
  id: string;
  santri_id: string;
  penguji_id: string;
  penguji_name?: string | null;
  tipe: "tahfidz" | "tahsin";
  mode: "ziyadah" | "murojaah" | "tasmi" | null;
  juz: number | null;
  surah: string | null;
  ayat_awal: number | null;
  ayat_akhir: number | null;
  materi_tahsin: string | null;
  tajwid: number | null;
  makhraj: number | null;
  kelancaran: number | null;
  nilai: number | null;
  status: string;
  catatan: string | null;
  audio_url: string | null;
  audio_type: string | null;
  tanggal: string;
  created_at: string;
  updated_at: string;
  pembina_external: string | null;
}

export interface SantriWithProgress {
  id: string;
  santriId: string;
  recordId: string;
  nama: string;
  nis: string | null;
  kelas: string | null;
  avatar: string | null;
  lastRecord: TahfidzTahsinRecord | null;
  materi: string;
  tanggalSetor: string;
  detailHari: string;
  hariSejak: number;
  jenis: "ziyadah" | "murojaah" | "tahsin";
}

export interface TahfidzStats {
  totalSantri: number;
  setoranHariIni: number;
  totalZiyadah: number;
  totalMurojaah: number;
  totalTahsin: number;
  perluPerhatian: number;
}

export interface ChartData {
  name: string;
  value: number;
  color: string;
  description: string;
  trend: "up" | "down" | "stable";
  change: number;
  details: { label: string; value: string }[];
}

export interface SantriSummary {
  id: string;
  nama: string;
  kelas: string | null;
  avatar: string | null;
  jumlahHafalan: number;
  lastTahfidz: {
    materi: string;
    tanggal: string;
    nilai: number | null;
  } | null;
  lastTahsin: {
    materi: string;
    tanggal: string;
    nilai: number | null;
  } | null;
}

export interface SantriPerluBimbingan {
  id: string;
  nama: string;
  kelas: string | null;
  avatar: string | null;
  jumlahUlang: number;
  lastStatus: string;
  lastMateri: string;
  lastTanggal: string;
}

export interface SantriTidakHadir {
  id: string;
  nama: string;
  kelas: string | null;
  avatar: string | null;
  hariSejak: number;
  lastMateri: string | null;
}

export interface SantriSurahSelesai {
  id: string;
  nama: string;
  kelas: string | null;
  avatar: string | null;
  surah: string;
  surahNumber: number;
  juz: number;
  totalAyat: number;
  tanggalSelesai: string;
}

interface TahfidzData {
  santriList: SantriWithProgress[];
  santriSummaryList: SantriSummary[];
  santriPerluBimbingan: SantriPerluBimbingan[];
  santriTidakHadir: SantriTidakHadir[];
  santriSurahSelesai: SantriSurahSelesai[];
  stats: TahfidzStats;
  chartData: ChartData[];
}

const formatMateri = (record: TahfidzTahsinRecord | null): string => {
  if (!record) return "Belum ada setoran";
  
  if (record.tipe === "tahsin") {
    return record.materi_tahsin || "Tahsin";
  }
  
  if (record.mode === "tasmi") {
    return record.catatan || "Tasmi";
  }
  
  let materi = "";
  if (record.juz) materi += `Juz ${record.juz}`;
  if (record.surah) {
    materi += materi ? ` - ${record.surah}` : record.surah;
  }
  if (record.ayat_akhir) {
    materi += `: ${record.ayat_akhir}`;
  }
  return materi || "Tahfidz";
};

const formatTanggal = (dateStr: string): string => {
  const date = parseISO(dateStr);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getDetailHari = (hariSejak: number): string => {
  if (hariSejak === 0) return "Hari ini";
  if (hariSejak === 1) return "Kemarin";
  return `${hariSejak} hari lalu`;
};

async function fetchTahfidzData(tahunAjaranId: string | null, semester: string | null, tahunAjaranName: string | null): Promise<TahfidzData> {
  const today = startOfDay(new Date());
  const todayStr = new Date().toLocaleDateString('en-CA');

  const kelasPromise = tahunAjaranName 
    ? supabase
        .from("kelas")
        .select("id")
        .eq("status", "aktif")
        .eq("tahun_ajaran", tahunAjaranName)
    : Promise.resolve({ data: null });

  const { data: kelasData } = await kelasPromise;
  const kelasIds: string[] = kelasData?.map(k => k.id) || [];

  let santriQuery = supabase
    .from("santri")
    .select(`
      id,
      nis,
      photo_url,
      profiles!inner(name),
      kelas(nama)
    `)
    .order("profiles(name)");
  
  if (kelasIds.length > 0) {
    santriQuery = santriQuery.in("kelas_id", kelasIds);
  }

  let tahfidzQuery = supabase
    .from("tahfidz_tahsin")
    .select(`
      id, santri_id, penguji_id, tipe, mode, juz, surah, ayat_awal, ayat_akhir,
      materi_tahsin, tajwid, makhraj, kelancaran, nilai, status, catatan,
      audio_url, audio_type, tanggal, created_at, updated_at, pembina_external,
      penguji:penguji_id(name)
    `)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (tahunAjaranId) {
    tahfidzQuery = tahfidzQuery.eq("tahun_ajaran_id", tahunAjaranId);
  }
  if (semester) {
    tahfidzQuery = tahfidzQuery.eq("semester", semester);
  }

  let hafalanCountQuery = supabase
    .from("setoran_hafalan")
    .select("santri_id")
    .not("nilai", "is", null);
  
  if (tahunAjaranId) {
    hafalanCountQuery = hafalanCountQuery.eq("tahun_ajaran_id", tahunAjaranId);
  }
  if (semester) {
    hafalanCountQuery = hafalanCountQuery.eq("semester", semester);
  }

  let surahSelesaiQuery = supabase
    .from("tahfidz_tahsin")
    .select(`id, santri_id, juz, surah, tanggal`)
    .eq("tipe", "tahfidz")
    .eq("mode", "ziyadah")
    .eq("status", "lanjut")
    .not("surah", "is", null)
    .not("juz", "is", null)
    .order("tanggal", { ascending: false });

  if (tahunAjaranId) {
    surahSelesaiQuery = surahSelesaiQuery.eq("tahun_ajaran_id", tahunAjaranId);
  }
  if (semester) {
    surahSelesaiQuery = surahSelesaiQuery.eq("semester", semester);
  }

  let surahFinalizedQuery = supabase
    .from("tahfidz_tahsin")
    .select(`santri_id, juz, surah`)
    .eq("tipe", "tahfidz")
    .eq("mode", "ziyadah")
    .eq("catatan", "Finalisasi Surah")
    .not("surah", "is", null)
    .not("juz", "is", null);

  if (tahunAjaranId) {
    surahFinalizedQuery = surahFinalizedQuery.eq("tahun_ajaran_id", tahunAjaranId);
  }
  if (semester) {
    surahFinalizedQuery = surahFinalizedQuery.eq("semester", semester);
  }

  const [santriResult, tahfidzResult, hafalanResult, surahSelesaiResult, surahFinalizedResult] = await Promise.all([
    santriQuery,
    tahfidzQuery,
    hafalanCountQuery,
    surahSelesaiQuery,
    surahFinalizedQuery
  ]);

  if (santriResult.error) throw santriResult.error;
  if (tahfidzResult.error) throw tahfidzResult.error;
  if (hafalanResult.error) throw hafalanResult.error;
  if (surahSelesaiResult.error) throw surahSelesaiResult.error;
  if (surahFinalizedResult.error) throw surahFinalizedResult.error;

  const santriData = santriResult.data || [];
  const tahfidzDataRaw = tahfidzResult.data || [];
  const hafalanCountData = hafalanResult.data || [];
  const surahSelesaiDataRaw = surahSelesaiResult.data || [];
  const surahFinalizedData = surahFinalizedResult.data || [];

  const finalizedSurahKeys = new Set<string>();
  surahFinalizedData.forEach((record) => {
    if (record.santri_id && record.surah && record.juz) {
      finalizedSurahKeys.add(`${record.santri_id}-${record.surah}-${record.juz}`);
    }
  });

  const santriMap = new Map<string, {
    nama: string;
    nis: string | null;
    kelas: string | null;
    avatar: string | null;
  }>();
  const activeSantriIds = new Set<string>();
  
  santriData.forEach((santri) => {
    activeSantriIds.add(santri.id);
    santriMap.set(santri.id, {
      nama: (santri.profiles as any)?.name || "Unknown",
      nis: santri.nis,
      kelas: (santri.kelas as any)?.nama || null,
      avatar: santri.photo_url,
    });
  });

  const tahfidzData = kelasIds.length > 0 
    ? tahfidzDataRaw.filter(r => activeSantriIds.has(r.santri_id))
    : tahfidzDataRaw;

  const hafalanCountMap = new Map<string, number>();
  hafalanCountData.forEach((h) => {
    if (kelasIds.length === 0 || activeSantriIds.has(h.santri_id)) {
      hafalanCountMap.set(h.santri_id, (hafalanCountMap.get(h.santri_id) || 0) + 1);
    }
  });

  const santriLatestRecords = new Map<string, typeof tahfidzData[0][]>();
  tahfidzData.forEach((record) => {
    const records = santriLatestRecords.get(record.santri_id) || [];
    records.push(record);
    santriLatestRecords.set(record.santri_id, records);
  });

  const combinedData: SantriWithProgress[] = tahfidzData.map((record) => {
    const santriInfo = santriMap.get(record.santri_id);
    const hariSejak = differenceInDays(today, parseISO(record.tanggal));
    const pengujiName = (record.penguji as any)?.name || null;

    const recordWithPenguji: TahfidzTahsinRecord = {
      ...record,
      penguji_name: pengujiName,
    } as TahfidzTahsinRecord;

    return {
      id: record.id,
      santriId: record.santri_id,
      recordId: record.id,
      nama: santriInfo?.nama || "Unknown",
      nis: santriInfo?.nis || null,
      kelas: santriInfo?.kelas || null,
      avatar: santriInfo?.avatar || null,
      lastRecord: recordWithPenguji,
      materi: formatMateri(recordWithPenguji),
      tanggalSetor: formatTanggal(record.tanggal),
      detailHari: getDetailHari(hariSejak),
      hariSejak,
      jenis: record.tipe === "tahsin" 
        ? "tahsin" 
        : (record.mode || "ziyadah") as "ziyadah" | "murojaah" | "tahsin",
    };
  });

  const santriSummaries: SantriSummary[] = santriData.map((santri) => {
    const santriRecords = santriLatestRecords.get(santri.id) || [];
    const latestTahfidz = santriRecords.find((r) => r.tipe === "tahfidz");
    const latestTahsin = santriRecords.find((r) => r.tipe === "tahsin");

    return {
      id: santri.id,
      nama: (santri.profiles as any)?.name || "Unknown",
      kelas: (santri.kelas as any)?.nama || null,
      avatar: santri.photo_url,
      jumlahHafalan: hafalanCountMap.get(santri.id) || 0,
      lastTahfidz: latestTahfidz
        ? {
            materi: formatMateri(latestTahfidz as TahfidzTahsinRecord),
            tanggal: formatTanggal(latestTahfidz.tanggal),
            nilai: latestTahfidz.nilai,
          }
        : null,
      lastTahsin: latestTahsin
        ? {
            materi: latestTahsin.materi_tahsin || "Tahsin",
            tanggal: formatTanggal(latestTahsin.tanggal),
            nilai: latestTahsin.nilai,
          }
        : null,
    };
  });

  const perluBimbinganList: SantriPerluBimbingan[] = [];
  const ulangStatuses = ["Ulang", "Ulang Halaman"];
  
  santriData.forEach((santri) => {
    const santriRecords = santriLatestRecords.get(santri.id) || [];
    
    if (santriRecords.length >= 3) {
      const lastThreeRecords = santriRecords.slice(0, 3);
      const allUlang = lastThreeRecords.every((r) => 
        ulangStatuses.includes(r.status)
      );

      if (allUlang) {
        const latestRecord = lastThreeRecords[0];
        perluBimbinganList.push({
          id: santri.id,
          nama: (santri.profiles as any)?.name || "Unknown",
          kelas: (santri.kelas as any)?.nama || null,
          avatar: santri.photo_url,
          jumlahUlang: 3,
          lastStatus: latestRecord.status,
          lastMateri: formatMateri(latestRecord as TahfidzTahsinRecord),
          lastTanggal: formatTanggal(latestRecord.tanggal),
        });
      }
    }
  });

  const todayRecords = tahfidzData.filter((r) => r.tanggal === todayStr);
  const uniqueSantriToday = new Set(todayRecords.map((r) => r.santri_id));
  
  const tidakHadirList: SantriTidakHadir[] = [];
  santriData.forEach((santri) => {
    if (!uniqueSantriToday.has(santri.id)) {
      const santriRecords = santriLatestRecords.get(santri.id) || [];
      const lastRecord = santriRecords[0];
      const hariSejak = lastRecord 
        ? differenceInDays(today, parseISO(lastRecord.tanggal))
        : 999;
      
      tidakHadirList.push({
        id: santri.id,
        nama: (santri.profiles as any)?.name || "Unknown",
        kelas: (santri.kelas as any)?.nama || null,
        avatar: santri.photo_url,
        hariSejak,
        lastMateri: lastRecord ? formatMateri(lastRecord as TahfidzTahsinRecord) : null,
      });
    }
  });
  
  tidakHadirList.sort((a, b) => b.hariSejak - a.hariSejak);

  const { QURAN_JUZ_SURAH_MAPPING } = await import("@/data/quranJuzSurahMapping");
  
  const surahSelesaiList: SantriSurahSelesai[] = [];
  const processedSurahPerSantri = new Map<string, Set<string>>();
  
  const filteredSurahSelesaiData = kelasIds.length > 0 
    ? surahSelesaiDataRaw.filter(r => activeSantriIds.has(r.santri_id))
    : surahSelesaiDataRaw;
  
  filteredSurahSelesaiData.forEach((record) => {
    const santriInfo = santriMap.get(record.santri_id);
    if (!santriInfo) return;
    
    const existingSurahsForSantri = processedSurahPerSantri.get(record.santri_id) || new Set();
    const surahJuzKey = `${record.surah}-${record.juz}`;
    
    const finalizedKey = `${record.santri_id}-${record.surah}-${record.juz}`;
    if (finalizedSurahKeys.has(finalizedKey)) return;
    
    if (!existingSurahsForSantri.has(surahJuzKey)) {
      const mapping = QURAN_JUZ_SURAH_MAPPING.find(
        (m) => m.surah_name_latin === record.surah && m.juz_number === record.juz
      );
      const totalAyat = mapping 
        ? (mapping.end_verse_in_juz - mapping.start_verse_in_juz + 1) 
        : 0;
      const surahNumber = mapping?.surah_number || 0;
      
      surahSelesaiList.push({
        id: record.santri_id,
        nama: santriInfo.nama,
        kelas: santriInfo.kelas,
        avatar: santriInfo.avatar,
        surah: record.surah!,
        surahNumber,
        juz: record.juz!,
        totalAyat,
        tanggalSelesai: formatTanggal(record.tanggal),
      });
      
      existingSurahsForSantri.add(surahJuzKey);
      processedSurahPerSantri.set(record.santri_id, existingSurahsForSantri);
    }
  });

  const statsData: TahfidzStats = {
    totalSantri: santriData.length,
    setoranHariIni: uniqueSantriToday.size,
    totalZiyadah: todayRecords.filter((r) => r.tipe === "tahfidz" && r.mode === "ziyadah").length,
    totalMurojaah: todayRecords.filter((r) => r.tipe === "tahfidz" && r.mode === "murojaah").length,
    totalTahsin: todayRecords.filter((r) => r.tipe === "tahsin").length,
    perluPerhatian: tidakHadirList.length,
  };

  const recordsWithScores = tahfidzData.filter(r => r.tajwid || r.makhraj || r.kelancaran);
  
  let tajwidSum = 0, tajwidCount = 0;
  let makhrajSum = 0, makhrajCount = 0;
  let kelancaranSum = 0, kelancaranCount = 0;
  
  recordsWithScores.forEach(r => {
    if (r.tajwid && r.tajwid > 0) { tajwidSum += r.tajwid; tajwidCount++; }
    if (r.makhraj && r.makhraj > 0) { makhrajSum += r.makhraj; makhrajCount++; }
    if (r.kelancaran && r.kelancaran > 0) { kelancaranSum += r.kelancaran; kelancaranCount++; }
  });

  const chartDataResult: ChartData[] = [
    {
      name: "Tajwid",
      value: tajwidCount > 0 ? Math.round(tajwidSum / tajwidCount) : 0,
      color: "hsl(var(--chart-1))",
      description: "Ketepatan membaca huruf hijaiyah sesuai makhraj dan sifatnya",
      trend: "stable",
      change: 0,
      details: [],
    },
    {
      name: "Makhraj",
      value: makhrajCount > 0 ? Math.round(makhrajSum / makhrajCount) : 0,
      color: "hsl(var(--chart-2))",
      description: "Tempat keluarnya huruf saat pengucapan",
      trend: "stable",
      change: 0,
      details: [],
    },
    {
      name: "Kelancaran",
      value: kelancaranCount > 0 ? Math.round(kelancaranSum / kelancaranCount) : 0,
      color: "hsl(var(--chart-3))",
      description: "Kemampuan membaca tanpa terbata-bata",
      trend: "stable",
      change: 0,
      details: [],
    },
  ];

  return {
    santriList: combinedData,
    santriSummaryList: santriSummaries,
    santriPerluBimbingan: perluBimbinganList,
    santriTidakHadir: tidakHadirList,
    santriSurahSelesai: surahSelesaiList,
    stats: statsData,
    chartData: chartDataResult,
  };
}

export function useTahfidzData(customTahunAjaranId?: string | null, customSemester?: string | null) {
  const queryClient = useQueryClient();
  const { academicYear } = useActiveAcademicYear();

  const tahunAjaranId = customTahunAjaranId !== undefined ? customTahunAjaranId : academicYear?.id ?? null;
  const semester = customSemester !== undefined ? customSemester : academicYear?.semester ?? null;
  const tahunAjaranName = academicYear?.tahunAjaranName ?? null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tahfidzData', tahunAjaranId, semester, tahunAjaranName] as const,
    queryFn: () => fetchTahfidzData(tahunAjaranId, semester, tahunAjaranName),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const santriList = data?.santriList ?? [];

  const getTahfidzSantri = useCallback(() => {
    return santriList.filter(
      (s) => s.jenis === "ziyadah" || s.jenis === "murojaah"
    );
  }, [santriList]);

  const getTahsinSantri = useCallback(() => {
    return santriList.filter((s) => s.jenis === "tahsin");
  }, [santriList]);

  const getPerluPerhatianSantri = useCallback(() => {
    return santriList.filter((s) => s.hariSejak > 3);
  }, [santriList]);

  const deleteRecord = useCallback(async (recordId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("tahfidz_tahsin")
        .delete()
        .eq("id", recordId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['tahfidzData'] });
      return true;
    } catch (err) {
      console.error("Error deleting record:", err);
      return false;
    }
  }, [queryClient]);

  return {
    santriList,
    santriSummaryList: data?.santriSummaryList ?? [],
    santriPerluBimbingan: data?.santriPerluBimbingan ?? [],
    santriTidakHadir: data?.santriTidakHadir ?? [],
    santriSurahSelesai: data?.santriSurahSelesai ?? [],
    stats: data?.stats ?? {
      totalSantri: 0,
      setoranHariIni: 0,
      totalZiyadah: 0,
      totalMurojaah: 0,
      totalTahsin: 0,
      perluPerhatian: 0,
    },
    chartData: data?.chartData ?? [],
    isLoading,
    error,
    refetch,
    deleteRecord,
    getTahfidzSantri,
    getTahsinSantri,
    getPerluPerhatianSantri,
  };
}
