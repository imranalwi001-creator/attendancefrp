import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, ChevronDown, FileText, BookOpen, User, Moon, Star, Heart, Printer, AlertTriangle } from "lucide-react";
import { useSantriDetail, useRamadhanActivities, useRamadhanConfig } from "@/hooks/useMonitoringRamadhan";
import { CardListPri } from "@/components/ui/card-list-pri";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useReactToPrint } from "react-to-print";
import { RamadhanPrintReport } from "@/components/ramadhan/RamadhanPrintReport";

const moodEmoji: Record<string, string> = {
  happy: "😊",
  neutral: "😐",
  sad: "😢",
  excited: "🤩",
  calm: "😌",
  sangat_bahagia: "😄",
  bahagia: "😊",
  biasa: "😐",
  sedih: "😢",
  sangat_sedih: "😭",
  semangat: "🔥",
  lelah: "😴",
  bersyukur: "🤲",
};

export default function RamadhanSantriDetailPage() {
  const { santriId } = useParams<{santriId: string;}>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Laporan Monitoring Ramadhan",
  });

  const { data: config } = useRamadhanConfig();
  const { data: activities = [] } = useRamadhanActivities();

  // Fetch santri name
  const { data: santriProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["santri-profile-ramadhan", santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", santriId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!santriId
  });

  // Fetch santri kelas
  const { data: santriKelas } = useQuery({
    queryKey: ["santri-kelas-ramadhan", santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase
        .from("santri")
        .select("kelas:kelas_id(nama)")
        .eq("id", santriId)
        .maybeSingle();
      if (error) throw error;
      return (data?.kelas as any)?.nama ?? null;
    },
    enabled: !!santriId
  });

  const { data: days = [], isLoading } = useSantriDetail(santriId ?? null, config);

  const filledDays = days
    .filter((d) => d.completedActivityIds.length > 0 || d.mood || Object.keys(d.excusedActivityMap ?? {}).length > 0)
    .reverse();

  const santriName = santriProfile?.name ?? "...";

  if (isProfileLoading || isLoading) {
    return (
      <div className="animate-fade-in min-h-screen pb-24">
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!santriProfile) {
    return (
      <div className="animate-fade-in min-h-screen pb-24">
        <div className="px-4 py-4">
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <User className="h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-foreground">Santri tidak ditemukan</p>
              <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="animate-fade-in min-h-screen pb-24">
        {/* Header */}
        <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/app/monitoring-ramadhan")}
              className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-white truncate">{santriName}</h2>
              <p className="text-sm text-white/70 truncate flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-white" />
                {santriKelas || "-"} • {config ? `Ramadhan ${config.tahun_hijriah}` : "Monitoring Ramadhan"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-1.5 text-white text-xs border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
              onClick={() => setShowPreview(true)}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Unduh Laporan</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3">
          {/* Ringkasan Aktivitas */}
          {activities.length > 0 && days.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Rekap Aktivitas</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {["fardhu", "sunnah", "akhlak"].map((category) => {
                    const catActivities = activities.filter((a) => a.category === category);
                    if (catActivities.length === 0) return null;
                    const categoryLabels: Record<string, string> = { fardhu: "Fardhu", sunnah: "Sunnah", akhlak: "Akhlak" };
                    const categoryIconComponents: Record<string, React.ReactNode> = {
                      fardhu: <Moon className="h-3.5 w-3.5 text-primary" />,
                      sunnah: <Star className="h-3.5 w-3.5 text-amber-500" />,
                      akhlak: <Heart className="h-3.5 w-3.5 text-rose-500" />,
                    };
                    const totalDays = days.length;
                    const totalDone = catActivities.reduce(
                      (sum, act) => sum + days.filter((d) => d.completedActivityIds.includes(act.id)).length,
                      0
                    );
                    const totalPossible = catActivities.length * totalDays;
                    const overallPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

                    return (
                      <div key={category} className="rounded-xl bg-card shadow-sm overflow-hidden border border-border/40">
                        <div className="relative px-3 py-2.5">
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                                {categoryIconComponents[category]}
                              </div>
                              <h3 className="text-xs font-bold tracking-wide uppercase text-foreground/80">
                                {categoryLabels[category]}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-bold text-primary">{overallPct}%</span>
                            </div>
                          </div>
                          <div className="relative mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${overallPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="px-3 py-1.5 space-y-0">
                          {catActivities.map((act) => {
                            const doneCount = days.filter((d) => d.completedActivityIds.includes(act.id)).length;
                            const isComplete = doneCount === totalDays;
                            return (
                              <div key={act.id} className="flex items-center justify-between py-1 border-b border-border/20 last:border-b-0">
                                <span className={`text-xs leading-snug ${isComplete ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                  {act.title}
                                </span>
                                <Badge className="text-[11px] shrink-0 ml-1 bg-primary/15 text-primary border-transparent hover:bg-primary/20">
                                  {doneCount}/{totalDays}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rekap Tilawah Al-Quran */}
          {days.length > 0 &&
            (() => {
              const tilawahDays = days.filter((d) => d.tilawahSurahAwal || d.tilawahSurahAkhir);
              if (tilawahDays.length === 0) return null;
              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Rekap Tilawah Al-Quran</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-1.5 pt-2">
                      {[...tilawahDays].reverse().map((day) => (
                        <div key={day.date} className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {day.hijriDay}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(day.date), "d MMM", { locale: id })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-medium text-foreground">{day.tilawahSurahAwal || "-"}</span>
                            <span className="text-muted-foreground">s/d</span>
                            <span className="font-medium text-foreground">{day.tilawahSurahAkhir || "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-center">
                      <span className="text-xs text-muted-foreground">Total hari tilawah: </span>
                      <span className="text-sm font-bold text-primary">{tilawahDays.length}</span>
                      <span className="text-xs text-muted-foreground"> / {days.length} hari</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

          {/* Riwayat Harian */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Riwayat Aktivitas</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {filledDays.length === 0 ? (
                <div className="p-8">
                  <p className="text-center text-sm text-muted-foreground">Belum ada data aktivitas Ramadhan</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="space-y-3">
                  {filledDays.map((day) => {
                    const dateObj = new Date(day.date);
                    const dayName = format(dateObj, "EEEE", { locale: id });
                    const dateStr = format(dateObj, "d MMM", { locale: id });
                    const mood = day.mood ? moodEmoji[day.mood] ?? "—" : "—";
                    const completedSet = new Set(day.completedActivityIds);

                    return (
                      <AccordionItem key={day.date} value={day.date} className="border-0 overflow-hidden">
                        <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                          <CardListPri
                            className="w-full"
                            icon={
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-primary" />
                              </div>
                            }
                            title={`Ramadhan Hari ke-${day.hijriDay}`}
                            subtitle={`${dayName}, ${dateStr}`}
                            columns={[
                              { label: "Fardhu", value: `${day.fardhuCount}/${day.fardhuTotal}` },
                              { label: "Sunnah", value: `${day.sunnahCount}/${day.sunnahTotal}` },
                              { label: "Akhlak", value: `${day.akhlakCount}/${day.akhlakTotal}` },
                              { label: "Mood", value: mood },
                            ]}
                            badge={
                              <Badge
                                variant={day.percentage > 80 ? "success" : day.percentage > 0 ? "warning" : "destructive"}
                                className="text-[10px]"
                              >
                                {Math.round(day.percentage)}%
                              </Badge>
                            }
                            actions={
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
                            }
                          />
                        </AccordionTrigger>
                        <AccordionContent className="px-0 pb-4 pt-0">
                          <div className="border-t border-border pt-3 space-y-3">
                            {/* Tilawah Al-Quran */}
                            {(day.tilawahSurahAwal || day.tilawahSurahAkhir) && (
                              <div className="rounded-lg border bg-primary/5 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <BookOpen className="h-4 w-4 text-primary" />
                                  <p className="text-xs font-semibold text-foreground">Tilawah Al-Quran</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-foreground">
                                  <span className="font-medium">{day.tilawahSurahAwal || "-"}</span>
                                  <span className="text-muted-foreground">s/d</span>
                                  <span className="font-medium">{day.tilawahSurahAkhir || "-"}</span>
                                </div>
                              </div>
                            )}

                            {/* Activities Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {["fardhu", "sunnah", "akhlak"].map((category) => {
                                const catActivities = activities.filter((a) => a.category === category);
                                if (catActivities.length === 0) return null;
                                const doneCount = catActivities.filter((a) => completedSet.has(a.id)).length;
                                const categoryLabels: Record<string, string> = { fardhu: "Fardhu", sunnah: "Sunnah", akhlak: "Akhlak" };
                                return (
                                  <div key={category} className="rounded-lg border bg-muted/40 p-3">
                                    <div className="flex items-center justify-between mb-2.5">
                                      <p className="text-xs font-semibold text-foreground">{categoryLabels[category]}</p>
                                      <Badge
                                        variant={doneCount === catActivities.length ? "success" : doneCount > 0 ? "warning" : "pending"}
                                        className="text-[10px]"
                                      >
                                        {doneCount}/{catActivities.length}
                                      </Badge>
                                    </div>
                                    <div className="space-y-0.5">
                                      {catActivities.map((act) => {
                                        const done = completedSet.has(act.id);
                                        const excuseReason = day.excusedActivityMap?.[act.id];
                                        return (
                                          <div key={act.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
                                            <div className="min-w-0 flex-1">
                                              <span className="text-xs text-foreground">{act.title}</span>
                                              {excuseReason && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                                  <span className="text-[10px] text-amber-600 dark:text-amber-400">{excuseReason}</span>
                                                </div>
                                              )}
                                            </div>
                                            <Badge
                                              variant={done ? "success" : excuseReason ? "warning" : "pending"}
                                              className="text-[10px] shrink-0 ml-2"
                                            >
                                              {done ? "Sudah" : excuseReason ? "Berhalangan" : "Belum"}
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-2xl flex flex-col max-h-[95vh] w-full max-w-4xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Preview Laporan</h2>
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => handlePrint()}>
                  <Printer className="h-4 w-4" />
                  Cetak
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>
                  Tutup
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
              <div className="mx-auto shadow-lg">
                <RamadhanPrintReport
                  ref={printRef}
                  santriName={santriName}
                  santriKelas={santriKelas}
                  tahunHijriah={config?.tahun_hijriah}
                  days={days}
                  activities={activities}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
