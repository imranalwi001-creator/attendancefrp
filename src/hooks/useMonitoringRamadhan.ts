import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAcademicYear } from "@/hooks/useActiveAcademicYear";
import { format, addDays, isBefore, isAfter, startOfDay } from "date-fns";
import { toast } from "sonner";

export interface SantriRekap {
  id: string;
  name: string;
  filledToday: boolean;
  totalAmalanToday: number;
  mood: string | null;
  fardhuCount: number;
  fardhuTotal: number;
  sunnahCount: number;
  sunnahTotal: number;
  akhlakCount: number;
  akhlakTotal: number;
  missedActivities: string[];
  excusedActivities: { title: string; reason: string }[];
  isHaid: boolean;
}

export interface DayDetail {
  date: string;
  hijriDay: number;
  percentage: number;
  fardhuCount: number;
  fardhuTotal: number;
  sunnahCount: number;
  sunnahTotal: number;
  akhlakCount: number;
  akhlakTotal: number;
  mood: string | null;
  isFuture: boolean;
  completedActivityIds: string[];
  excusedActivityMap: Record<string, string>; // activity_id -> excuse_reason
  tilawahSurahAwal: string | null;
  tilawahSurahAkhir: string | null;
}

export function useRamadhanConfig() {
  return useQuery({
    queryKey: ["ramadhan-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ramadhan_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRamadhanActivities() {
  return useQuery({
    queryKey: ["ramadhan-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ramadhan_activities")
        .select("*")
        .order("category");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Determine the "current Ramadhan day" date string.
 * - If today is within Ramadhan (start to start+29), use today
 * - If today is before Ramadhan, use the start date
 * - If today is after Ramadhan, use the last day
 */
function getCurrentRamadhanDate(config: { tanggal_mulai: string } | null): string {
  if (!config) return format(new Date(), "yyyy-MM-dd");

  const today = startOfDay(new Date());
  const start = startOfDay(new Date(config.tanggal_mulai));
  const end = startOfDay(addDays(start, 29));

  if (isBefore(today, start)) {
    return format(start, "yyyy-MM-dd");
  }
  if (isAfter(today, end)) {
    return format(end, "yyyy-MM-dd");
  }
  return format(today, "yyyy-MM-dd");
}

export function useMonitoringRamadhan(selectedDate?: string) {
  const { data: activities } = useRamadhanActivities();
  const { data: config } = useRamadhanConfig();
  const { academicYear } = useActiveAcademicYear();
  const totalActivities = activities?.length ?? 0;
  const currentDate = selectedDate || getCurrentRamadhanDate(config ?? null);

  return useQuery({
    queryKey: ["monitoring-ramadhan", academicYear?.tahunAjaranName, currentDate, totalActivities],
    queryFn: async (): Promise<SantriRekap[]> => {
      if (!config || !academicYear) return [];

      // 1. Get all kelas from active academic year
      const { data: kelasData, error: kelasError } = await supabase
        .from("kelas")
        .select("id")
        .eq("tahun_ajaran", academicYear.tahunAjaranName);
      if (kelasError) throw kelasError;
      if (!kelasData?.length) return [];

      const kelasIds = kelasData.map((k) => k.id);

      // 2. Get all santri from those kelas
      const { data: santriList, error: santriError } = await supabase
        .from("santri")
        .select("id, profiles!inner(name)")
        .in("kelas_id", kelasIds);
      if (santriError) throw santriError;
      if (!santriList?.length) return [];

      const santriIds = santriList.map((s: any) => s.id);

      // 3. Get logs for the current Ramadhan date (all logs, not just completed)
      const { data: todayLogs, error: logsError } = await supabase
        .from("ramadhan_daily_logs")
        .select("santri_id, activity_id, is_completed, excuse_reason")
        .eq("date", currentDate)
        .in("santri_id", santriIds);
      if (logsError) throw logsError;

      // Group activities by category
      const fardhuActs = activities?.filter((a) => a.category === "fardhu") ?? [];
      const sunnahActs = activities?.filter((a) => a.category === "sunnah") ?? [];
      const akhlakActs = activities?.filter((a) => a.category === "akhlak") ?? [];

      // 4. Get mood for the current Ramadhan date
      const { data: todayMood, error: moodError } = await supabase
        .from("ramadhan_mood")
        .select("santri_id, mood")
        .eq("date", currentDate)
        .in("santri_id", santriIds);
      if (moodError) throw moodError;

      // Group today's logs by santri
      const todayLogsBySantri: Record<string, number> = {};
      const todayActivityBySantri: Record<string, Set<string>> = {};
      const todayExcusedBySantri: Record<string, Map<string, string>> = {};
      todayLogs?.forEach((log: any) => {
        if (log.is_completed) {
          todayLogsBySantri[log.santri_id] = (todayLogsBySantri[log.santri_id] || 0) + 1;
          if (!todayActivityBySantri[log.santri_id]) todayActivityBySantri[log.santri_id] = new Set();
          todayActivityBySantri[log.santri_id].add(log.activity_id);
        } else if (log.excuse_reason) {
          if (!todayExcusedBySantri[log.santri_id]) todayExcusedBySantri[log.santri_id] = new Map();
          todayExcusedBySantri[log.santri_id].set(log.activity_id, log.excuse_reason);
        }
      });

      // Group mood by santri
      const moodBySantri: Record<string, string> = {};
      todayMood?.forEach((m: any) => {
        moodBySantri[m.santri_id] = m.mood;
      });

      return santriList.map((s: any) => {
        const name = (s.profiles as any)?.name ?? "Unknown";
        const amalanToday = todayLogsBySantri[s.id] ?? 0;
        const filledToday = amalanToday > 0 || (todayExcusedBySantri[s.id]?.size ?? 0) > 0;
        const completedIds = todayActivityBySantri[s.id] ?? new Set<string>();
        const excusedMap = todayExcusedBySantri[s.id] ?? new Map<string, string>();

        const allActivities = activities ?? [];
        const missedActivities = allActivities
          .filter((a) => !completedIds.has(a.id) && !excusedMap.has(a.id))
          .map((a) => a.title);
        const excusedActivities = allActivities
          .filter((a) => excusedMap.has(a.id))
          .map((a) => ({ title: a.title, reason: excusedMap.get(a.id)! }));

        // Detect Haid: all fardhu+sunnah excused with "Haid"
        const fardhuSunnahIds = [...fardhuActs, ...sunnahActs].map((a) => a.id);
        const isHaid = fardhuSunnahIds.length > 0 && fardhuSunnahIds.every((id) => excusedMap.get(id) === 'Haid');

        return {
          id: s.id,
          name,
          filledToday,
          totalAmalanToday: amalanToday,
          mood: moodBySantri[s.id] ?? null,
          fardhuCount: fardhuActs.filter((a) => completedIds.has(a.id)).length,
          fardhuTotal: fardhuActs.length,
          sunnahCount: sunnahActs.filter((a) => completedIds.has(a.id)).length,
          sunnahTotal: sunnahActs.length,
          akhlakCount: akhlakActs.filter((a) => completedIds.has(a.id)).length,
          akhlakTotal: akhlakActs.length,
          missedActivities,
          excusedActivities,
          isHaid,
        };
      });
    },
    enabled: totalActivities > 0 && !!config && !!academicYear,
  });
}

export function useSantriDetail(santriId: string | null, config: any) {
  const { data: activities } = useRamadhanActivities();

  return useQuery({
    queryKey: ["ramadhan-santri-detail", santriId, config?.tanggal_mulai],
    queryFn: async (): Promise<DayDetail[]> => {
      if (!santriId || !config) return [];

      const startDate = new Date(config.tanggal_mulai);
      const today = new Date();
      const totalAct = activities?.length ?? 0;

      const fardhuActs = activities?.filter((a) => a.category === "fardhu") ?? [];
      const sunnahActs = activities?.filter((a) => a.category === "sunnah") ?? [];
      const akhlakActs = activities?.filter((a) => a.category === "akhlak") ?? [];

      const endDate = format(addDays(startDate, 29), "yyyy-MM-dd");
      const { data: logs, error: logsError } = await supabase
        .from("ramadhan_daily_logs")
        .select("date, activity_id, is_completed, excuse_reason")
        .eq("santri_id", santriId)
        .gte("date", config.tanggal_mulai)
        .lte("date", endDate);
      if (logsError) throw logsError;

      const { data: moods, error: moodError } = await supabase
        .from("ramadhan_mood")
        .select("date, mood, tilawah_surah_awal, tilawah_surah_akhir")
        .eq("santri_id", santriId)
        .gte("date", config.tanggal_mulai)
        .lte("date", endDate);
      if (moodError) throw moodError;

      const moodByDate: Record<string, { mood: string; tilawahAwal: string | null; tilawahAkhir: string | null }> = {};
      moods?.forEach((m: any) => {
        moodByDate[m.date] = {
          mood: m.mood,
          tilawahAwal: m.tilawah_surah_awal ?? null,
          tilawahAkhir: m.tilawah_surah_akhir ?? null,
        };
      });

      const logsByDate: Record<string, Set<string>> = {};
      const excusedByDate: Record<string, Record<string, string>> = {};
      logs?.forEach((l: any) => {
        if (l.is_completed) {
          if (!logsByDate[l.date]) logsByDate[l.date] = new Set();
          logsByDate[l.date].add(l.activity_id);
        } else if (l.excuse_reason) {
          if (!excusedByDate[l.date]) excusedByDate[l.date] = {};
          excusedByDate[l.date][l.activity_id] = l.excuse_reason;
        }
      });

      const days: DayDetail[] = [];
      for (let i = 0; i < 30; i++) {
        const date = addDays(startDate, i);
        const dateStr = format(date, "yyyy-MM-dd");
        const isFuture = isAfter(startOfDay(date), startOfDay(today));
        const completedIds = logsByDate[dateStr] ?? new Set();

        const fardhuCount = fardhuActs.filter((a) => completedIds.has(a.id)).length;
        const sunnahCount = sunnahActs.filter((a) => completedIds.has(a.id)).length;
        const akhlakCount = akhlakActs.filter((a) => completedIds.has(a.id)).length;
        const totalCompleted = fardhuCount + sunnahCount + akhlakCount;
        const percentage = totalAct > 0 ? (totalCompleted / totalAct) * 100 : 0;

        days.push({
          date: dateStr,
          hijriDay: i + 1,
          percentage,
          fardhuCount,
          fardhuTotal: fardhuActs.length,
          sunnahCount,
          sunnahTotal: sunnahActs.length,
          akhlakCount,
          akhlakTotal: akhlakActs.length,
          mood: moodByDate[dateStr]?.mood ?? null,
          isFuture,
          completedActivityIds: Array.from(completedIds),
          excusedActivityMap: excusedByDate[dateStr] ?? {},
          tilawahSurahAwal: moodByDate[dateStr]?.tilawahAwal ?? null,
          tilawahSurahAkhir: moodByDate[dateStr]?.tilawahAkhir ?? null,
        });
      }
      return days;
    },
    enabled: !!santriId && !!config && !!activities?.length,
  });
}

export function useSendReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (santriIds: string[]) => {
      const notifications = santriIds.map((id) => ({
        user_id: id,
        title: "Pengingat Mutaba'ah",
        message: "Jangan lupa mengisi Mutaba'ah Ramadhan hari ini! 🌙",
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengingat berhasil dikirim!");
    },
    onError: () => {
      toast.error("Gagal mengirim pengingat");
    },
  });
}
