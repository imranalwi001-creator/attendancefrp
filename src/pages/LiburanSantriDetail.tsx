import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, ChevronDown, User, Moon, Star, GraduationCap } from "lucide-react";
import { useLiburanSantriDetail, useLiburanActivitiesMonitoring, useLiburanConfigMonitoring } from "@/hooks/useMonitoringLiburan";
import { CardListPri } from "@/components/ui/card-list-pri";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const moodEmoji: Record<string, string> = {
  happy: "😊", neutral: "😐", sad: "😢", excited: "🤩", calm: "😌",
};

export default function LiburanSantriDetailPage() {
  const { santriId } = useParams<{ santriId: string }>();
  const navigate = useNavigate();

  const { data: config } = useLiburanConfigMonitoring();
  const { data: activities = [] } = useLiburanActivitiesMonitoring();

  const { data: santriProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["santri-profile-liburan", santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase.from("profiles").select("name, avatar_url").eq("id", santriId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!santriId,
  });

  const { data: santriKelas } = useQuery({
    queryKey: ["santri-kelas-liburan", santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase.from("santri").select("kelas:kelas_id(nama)").eq("id", santriId).maybeSingle();
      if (error) throw error;
      return (data?.kelas as any)?.nama ?? null;
    },
    enabled: !!santriId,
  });

  const { data: days = [], isLoading } = useLiburanSantriDetail(santriId ?? null, config);

  const filledDays = days.filter((d) => d.completedActivityIds.length > 0 || d.mood || Object.keys(d.excusedActivityMap ?? {}).length > 0).reverse();
  const santriName = santriProfile?.name ?? "...";

  if (isProfileLoading || isLoading) {
    return (
      <div className="animate-fade-in min-h-screen pb-24">
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
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
              <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Kembali</button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-screen pb-24">
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/app/monitoring-liburan")} className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200">
            <ArrowLeft className="h-4 w-4 text-white" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-white truncate">{santriName}</h2>
            <p className="text-sm text-white/70 truncate flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-white" />
              {santriKelas || "-"} • {config ? config.nama : "Kontroling Liburan"}
            </p>
          </div>
        </div>
      </div>

      <div className="py-4 space-y-3">
        {activities.length > 0 && days.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Rekap Aktivitas</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-3 gap-3 pt-2">
                {["fardhu", "sunnah", "belajar"].map((category) => {
                  const catActivities = activities.filter((a: any) => a.category === category);
                  if (catActivities.length === 0) return null;
                  const categoryLabels: Record<string, string> = { fardhu: "Fardhu", sunnah: "Sunnah", belajar: "Belajar" };
                  const categoryIcons: Record<string, React.ReactNode> = {
                    fardhu: <Moon className="h-3.5 w-3.5 text-primary" />,
                    sunnah: <Star className="h-3.5 w-3.5 text-amber-500" />,
                    belajar: <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />,
                  };
                  const totalDays = days.length;
                  const totalDone = catActivities.reduce((sum: number, act: any) => sum + days.filter((d) => d.completedActivityIds.includes(act.id)).length, 0);
                  const totalPossible = catActivities.length * totalDays;
                  const overallPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

                  return (
                    <div key={category} className="rounded-xl bg-card shadow-sm overflow-hidden border border-border/40">
                      <div className="relative px-3 py-2.5">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">{categoryIcons[category]}</div>
                            <h3 className="text-xs font-bold tracking-wide uppercase text-foreground/80">{categoryLabels[category]}</h3>
                          </div>
                          <span className="text-lg font-bold text-primary">{overallPct}%</span>
                        </div>
                        <div className="relative mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${overallPct}%` }} />
                        </div>
                      </div>
                      <div className="px-3 py-1.5 space-y-0">
                        {catActivities.map((act: any) => {
                          const doneCount = days.filter((d) => d.completedActivityIds.includes(act.id)).length;
                          return (
                            <div key={act.id} className="flex items-center justify-between py-1 border-b border-border/20 last:border-b-0">
                              <span className={`text-xs leading-snug ${doneCount === totalDays ? "text-foreground font-medium" : "text-muted-foreground"}`}>{act.title}</span>
                              <Badge className="text-[11px] shrink-0 ml-1 bg-primary/15 text-primary border-transparent hover:bg-primary/20">{doneCount}/{totalDays}</Badge>
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

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Riwayat Aktivitas</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            {filledDays.length === 0 ? (
              <div className="p-8"><p className="text-center text-sm text-muted-foreground">Belum ada data aktivitas liburan</p></div>
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
                        <CardListPri className="w-full"
                          icon={<div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center"><Calendar className="h-4 w-4 text-primary" /></div>}
                          title={`Liburan Hari ke-${day.dayNumber}`}
                          subtitle={`${dayName}, ${dateStr}`}
                          columns={[
                            { label: "Fardhu", value: `${day.fardhuCount}/${day.fardhuTotal}` },
                            { label: "Sunnah", value: `${day.sunnahCount}/${day.sunnahTotal}` },
                            { label: "Belajar", value: `${day.belajarCount}/${day.belajarTotal}` },
                            { label: "Mood", value: mood },
                          ]}
                          badge={<Badge variant={day.percentage > 80 ? "success" : day.percentage > 0 ? "warning" : "destructive"} className="text-[10px]">{Math.round(day.percentage)}%</Badge>}
                          actions={<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />}
                        />
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pb-4 pt-0">
                        <div className="border-t border-border pt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {["fardhu", "sunnah", "belajar"].map((category) => {
                              const catActivities = activities.filter((a: any) => a.category === category);
                              if (catActivities.length === 0) return null;
                              const doneCount = catActivities.filter((a: any) => completedSet.has(a.id)).length;
                              const categoryLabels: Record<string, string> = { fardhu: "Fardhu", sunnah: "Sunnah", belajar: "Belajar" };
                              return (
                                <div key={category} className="rounded-lg border bg-muted/40 p-3">
                                  <div className="flex items-center justify-between mb-2.5">
                                    <p className="text-xs font-semibold text-foreground">{categoryLabels[category]}</p>
                                    <Badge variant={doneCount === catActivities.length ? "success" : doneCount > 0 ? "warning" : "pending"} className="text-[10px]">{doneCount}/{catActivities.length}</Badge>
                                  </div>
                                  <div className="space-y-0.5">
                                    {catActivities.map((act: any) => {
                                      const done = completedSet.has(act.id);
                                      const excuseReason = day.excusedActivityMap?.[act.id];
                                      return (
                                        <div key={act.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
                                          <span className="text-xs text-foreground">{act.title}</span>
                                          <Badge variant={done ? "success" : excuseReason ? "warning" : "pending"} className="text-[10px] shrink-0 ml-2">{done ? "Sudah" : excuseReason ? "Berhalangan" : "Belum"}</Badge>
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
  );
}
