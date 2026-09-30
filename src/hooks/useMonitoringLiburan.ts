import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAcademicYear } from "@/hooks/useActiveAcademicYear";
import { format, addDays, isBefore, isAfter, startOfDay, differenceInDays } from "date-fns";
import { toast } from "sonner";

export interface SantriRekapLiburan {
  id: string;
  name: string;
  filledToday: boolean;
  totalAmalanToday: number;
  mood: string | null;
  fardhuCount: number;
  fardhuTotal: number;
  sunnahCount: number;
  sunnahTotal: number;
  belajarCount: number;
  belajarTotal: number;
  missedActivities: string[];
  excusedActivities: { title: string; reason: string }[];
}

export interface DayDetailLiburan {
  date: string;
  dayNumber: number;
  percentage: number;
  fardhuCount: number;
  fardhuTotal: number;
  sunnahCount: number;
  sunnahTotal: number;
  belajarCount: number;
  belajarTotal: number;
  mood: string | null;
  isFuture: boolean;
  completedActivityIds: string[];
  excusedActivityMap: Record<string, string>;
}

export function useLiburanConfigMonitoring() {
  return useQuery({
    queryKey: ["liburan-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liburan_config" as any)
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useLiburanActivitiesMonitoring() {
  return useQuery({
    queryKey: ["liburan-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liburan_activities" as any)
        .select("*")
        .order("category");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function getCurrentLiburanDate(config: any | null): string {
  if (!config) return format(new Date(), "yyyy-MM-dd");
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(config.tanggal_mulai));
  const end = startOfDay(new Date(config.tanggal_selesai));

  if (isBefore(today, start)) return format(start, "yyyy-MM-dd");
  if (isAfter(today, end)) return format(end, "yyyy-MM-dd");
  return format(today, "yyyy-MM-dd");
}

export function useMonitoringLiburan(selectedDate?: string) {
  const { data: activities } = useLiburanActivitiesMonitoring();
  const { data: config } = useLiburanConfigMonitoring();
  const { academicYear } = useActiveAcademicYear();
  const totalActivities = activities?.length ?? 0;
  const currentDate = selectedDate || getCurrentLiburanDate(config ?? null);

  return useQuery({
    queryKey: ["monitoring-liburan", academicYear?.tahunAjaranName, currentDate, totalActivities],
    queryFn: async (): Promise<SantriRekapLiburan[]> => {
      if (!config || !academicYear) return [];

      const { data: kelasData, error: kelasError } = await supabase
        .from("kelas")
        .select("id")
        .eq("tahun_ajaran", academicYear.tahunAjaranName);
      if (kelasError) throw kelasError;
      if (!kelasData?.length) return [];

      const kelasIds = kelasData.map((k: any) => k.id);

      const { data: santriList, error: santriError } = await supabase
        .from("santri")
        .select("id, profiles!inner(name)")
        .in("kelas_id", kelasIds);
      if (santriError) throw santriError;
      if (!santriList?.length) return [];

      const santriIds = santriList.map((s: any) => s.id);

      const { data: todayLogs, error: logsError } = await supabase
        .from("liburan_daily_logs" as any)
        .select("santri_id, activity_id, is_completed, excuse_reason")
        .eq("date", currentDate)
        .in("santri_id", santriIds);
      if (logsError) throw logsError;

      const fardhuActs = activities?.filter((a: any) => a.category === "fardhu") ?? [];
      const sunnahActs = activities?.filter((a: any) => a.category === "sunnah") ?? [];
      const belajarActs = activities?.filter((a: any) => a.category === "belajar") ?? [];

      const { data: todayMood, error: moodError } = await supabase
        .from("liburan_mood" as any)
        .select("santri_id, mood")
        .eq("date", currentDate)
        .in("santri_id", santriIds);
      if (moodError) throw moodError;

      const todayLogsBySantri: Record<string, number> = {};
      const todayActivityBySantri: Record<string, Set<string>> = {};
      const todayExcusedBySantri: Record<string, Map<string, string>> = {};
      (todayLogs as any[])?.forEach((log: any) => {
        if (log.is_completed) {
          todayLogsBySantri[log.santri_id] = (todayLogsBySantri[log.santri_id] || 0) + 1;
          if (!todayActivityBySantri[log.santri_id]) todayActivityBySantri[log.santri_id] = new Set();
          todayActivityBySantri[log.santri_id].add(log.activity_id);
        } else if (log.excuse_reason) {
          if (!todayExcusedBySantri[log.santri_id]) todayExcusedBySantri[log.santri_id] = new Map();
          todayExcusedBySantri[log.santri_id].set(log.activity_id, log.excuse_reason);
        }
      });

      const moodBySantri: Record<string, string> = {};
      (todayMood as any[])?.forEach((m: any) => {
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
          .filter((a: any) => !completedIds.has(a.id) && !excusedMap.has(a.id))
          .map((a: any) => a.title);
        const excusedActivities = allActivities
          .filter((a: any) => excusedMap.has(a.id))
          .map((a: any) => ({ title: a.title, reason: excusedMap.get(a.id)! }));

        return {
          id: s.id,
          name,
          filledToday,
          totalAmalanToday: amalanToday,
          mood: moodBySantri[s.id] ?? null,
          fardhuCount: fardhuActs.filter((a: any) => completedIds.has(a.id)).length,
          fardhuTotal: fardhuActs.length,
          sunnahCount: sunnahActs.filter((a: any) => completedIds.has(a.id)).length,
          sunnahTotal: sunnahActs.length,
          belajarCount: belajarActs.filter((a: any) => completedIds.has(a.id)).length,
          belajarTotal: belajarActs.length,
          missedActivities,
          excusedActivities,
        };
      });
    },
    enabled: totalActivities > 0 && !!config && !!academicYear,
  });
}

export function useLiburanSantriDetail(santriId: string | null, config: any) {
  const { data: activities } = useLiburanActivitiesMonitoring();

  return useQuery({
    queryKey: ["liburan-santri-detail", santriId, config?.tanggal_mulai],
    queryFn: async (): Promise<DayDetailLiburan[]> => {
      if (!santriId || !config) return [];

      const startDate = new Date(config.tanggal_mulai);
      const endDate = new Date(config.tanggal_selesai);
      const totalDays = differenceInDays(endDate, startDate) + 1;
      const today = new Date();
      const totalAct = activities?.length ?? 0;

      const fardhuActs = activities?.filter((a: any) => a.category === "fardhu") ?? [];
      const sunnahActs = activities?.filter((a: any) => a.category === "sunnah") ?? [];
      const belajarActs = activities?.filter((a: any) => a.category === "belajar") ?? [];

      const endDateStr = format(endDate, "yyyy-MM-dd");
      const { data: logs, error: logsError } = await supabase
        .from("liburan_daily_logs" as any)
        .select("date, activity_id, is_completed, excuse_reason")
        .eq("santri_id", santriId)
        .gte("date", config.tanggal_mulai)
        .lte("date", endDateStr);
      if (logsError) throw logsError;

      const { data: moods, error: moodError } = await supabase
        .from("liburan_mood" as any)
        .select("date, mood")
        .eq("santri_id", santriId)
        .gte("date", config.tanggal_mulai)
        .lte("date", endDateStr);
      if (moodError) throw moodError;

      const moodByDate: Record<string, string> = {};
      (moods as any[])?.forEach((m: any) => {
        moodByDate[m.date] = m.mood;
      });

      const logsByDate: Record<string, Set<string>> = {};
      const excusedByDate: Record<string, Record<string, string>> = {};
      (logs as any[])?.forEach((l: any) => {
        if (l.is_completed) {
          if (!logsByDate[l.date]) logsByDate[l.date] = new Set();
          logsByDate[l.date].add(l.activity_id);
        } else if (l.excuse_reason) {
          if (!excusedByDate[l.date]) excusedByDate[l.date] = {};
          excusedByDate[l.date][l.activity_id] = l.excuse_reason;
        }
      });

      const days: DayDetailLiburan[] = [];
      for (let i = 0; i < totalDays; i++) {
        const date = addDays(startDate, i);
        const dateStr = format(date, "yyyy-MM-dd");
        const isFuture = isAfter(startOfDay(date), startOfDay(today));
        const completedIds = logsByDate[dateStr] ?? new Set();

        const fardhuCount = fardhuActs.filter((a: any) => completedIds.has(a.id)).length;
        const sunnahCount = sunnahActs.filter((a: any) => completedIds.has(a.id)).length;
        const belajarCount = belajarActs.filter((a: any) => completedIds.has(a.id)).length;
        const totalCompleted = fardhuCount + sunnahCount + belajarCount;
        const percentage = totalAct > 0 ? (totalCompleted / totalAct) * 100 : 0;

        days.push({
          date: dateStr,
          dayNumber: i + 1,
          percentage,
          fardhuCount,
          fardhuTotal: fardhuActs.length,
          sunnahCount,
          sunnahTotal: sunnahActs.length,
          belajarCount,
          belajarTotal: belajarActs.length,
          mood: moodByDate[dateStr] ?? null,
          isFuture,
          completedActivityIds: Array.from(completedIds),
          excusedActivityMap: excusedByDate[dateStr] ?? {},
        });
      }
      return days;
    },
    enabled: !!santriId && !!config && !!activities?.length,
  });
}

export function useLiburanSendReminder() {
  return useMutation({
    mutationFn: async (santriIds: string[]) => {
      const notifications = santriIds.map((id) => ({
        user_id: id,
        title: "Pengingat Kontroling Liburan",
        message: "Jangan lupa mengisi laporan aktivitas liburanmu hari ini! 🏖️",
      }));
      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Pengingat berhasil dikirim!"),
    onError: () => toast.error("Gagal mengirim pengingat"),
  });
}
