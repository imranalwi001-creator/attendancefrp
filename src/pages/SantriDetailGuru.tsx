import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, ScrollText, Heart } from "lucide-react";
import { TahfidzTabContent } from "@/components/tahfidz/TahfidzTabContent";
import { HafalanTabContent } from "@/components/hafalan/HafalanTabContent";
import { AfektifTabContent } from "@/components/hafalan/AfektifTabContent";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

export default function SantriDetailGuru() {
  const { id: santriId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("tahfidz");
  const { activeAcademicYear, currentSemester } = useAcademicYear();

  const fromPath = (location.state as any)?.from;

  // Fetch santri profile
  const { data: santriProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["santri-detail-guru", santriId],
    queryFn: async () => {
      if (!santriId) return null;
      
      const { data, error } = await supabase
        .from("santri")
        .select(`
          id, nis,
          kelas:kelas_id (id, nama, tingkat)
        `)
        .eq("id", santriId)
        .single();

      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", santriId)
        .single();

      return { ...data, profile };
    },
    enabled: !!santriId,
  });

  const santriName = santriProfile?.profile?.name || "Santri";
  const santriNis = santriProfile?.nis;
  const santriKelas = (santriProfile?.kelas as any)?.nama;
  const avatarUrl = santriProfile?.profile?.avatar_url;

  // Fetch tahfidz records
  const { data: tahfidzRecords = [], isLoading: tahfidzLoading, refetch: refetchTahfidz } = useQuery({
    queryKey: ["santri-tahfidz-records", santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return [];
      let query = supabase
        .from("tahfidz_tahsin")
        .select("*")
        .eq("santri_id", santriId)
        .order("created_at", { ascending: false });

      if (activeAcademicYear?.id) {
        query = query.eq("tahun_ajaran_id", activeAcademicYear.id);
      }
      if (currentSemester) {
        query = query.eq("semester", currentSemester);
      }

      const { data, error } = await query;
      if (error) throw error;

      const pengujiIds = [...new Set((data || []).map(r => r.penguji_id).filter(Boolean))];
      let pengujiMap: Record<string, string> = {};
      if (pengujiIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", pengujiIds);
        pengujiMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      }

      return (data || []).map((r) => ({
        id: r.id,
        tipe: r.tipe as "tahfidz" | "tahsin",
        mode: r.mode,
        surah: r.surah,
        juz: r.juz,
        ayat_awal: r.ayat_awal,
        ayat_akhir: r.ayat_akhir,
        materi_tahsin: r.materi_tahsin,
        nilai: r.nilai,
        status: r.status,
        tanggal: r.tanggal,
        created_at: r.created_at,
        catatan: r.catatan,
        penguji_id: r.penguji_id,
        penguji_name: pengujiMap[r.penguji_id] || null,
        pembina_external: r.pembina_external,
      }));
    },
    enabled: !!santriId,
  });

  // Fetch hafalan records
  const { data: hafalanRecords = [], isLoading: hafalanLoading, refetch: refetchHafalan } = useQuery({
    queryKey: ["santri-hafalan-records", santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return [];
      let query = supabase
        .from("setoran_hafalan")
        .select("*")
        .eq("santri_id", santriId)
        .order("created_at", { ascending: false });

      if (activeAcademicYear?.id) {
        query = query.eq("tahun_ajaran_id", activeAcademicYear.id);
      }
      if (currentSemester) {
        query = query.eq("semester", currentSemester);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r) => ({
        id: r.id,
        kategori: r.kategori as "quran" | "hadist" | "doa",
        judul: r.judul,
        tanggal: r.tanggal,
        nilai: r.nilai || 0,
        status: r.status as "lancar" | "belum_lancar" | "lanjut_besok",
        catatan: r.catatan,
        audioUrl: r.audio_url,
        audioType: r.audio_type as "recording" | "drive" | undefined,
      }));
    },
    enabled: !!santriId,
  });

  // Fetch affective data
  const { data: affectiveCategories } = useQuery({
    queryKey: ["affective-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affective_categories")
        .select("*")
        .order("order_index");
      return data || [];
    },
  });

  const { data: affectiveIndicators } = useQuery({
    queryKey: ["affective-indicators"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affective_indicators")
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      return data || [];
    },
  });

  const { data: affectiveScores } = useQuery({
    queryKey: ["affective-scores", santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id || !currentSemester) return [];
      const { data } = await supabase
        .from("affective_scores")
        .select("*")
        .eq("santri_id", santriId)
        .eq("academic_year_id", activeAcademicYear.id)
        .eq("semester", currentSemester);
      return data || [];
    },
    enabled: !!santriId && !!activeAcademicYear?.id && !!currentSemester,
  });

  const { data: isAffectiveFinalized = false } = useQuery({
    queryKey: ["affective-finalization", santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester) return false;
      // Get kelas_id from santri
      const kelasId = (santriProfile?.kelas as any)?.id;
      if (!kelasId) return false;
      const { data } = await supabase
        .from("affective_finalization")
        .select("is_finalized")
        .eq("academic_year_id", activeAcademicYear.id)
        .eq("semester", currentSemester)
        .eq("kelas_id", kelasId)
        .maybeSingle();
      return data?.is_finalized || false;
    },
    enabled: !!activeAcademicYear?.id && !!currentSemester && !!santriProfile,
  });

  // Calculate affective scores per category
  const indicatorScoreMap = new Map<string, number>();
  affectiveScores?.forEach(s => {
    indicatorScoreMap.set(s.indicator_id, s.score);
  });

  const affectiveCategoryScores = (affectiveCategories || []).map(cat => {
    const catIndicators = (affectiveIndicators || []).filter(i => i.category_id === cat.id);
    const scores = catIndicators.map(i => indicatorScoreMap.get(i.id) || 0).filter(s => s > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      averageScore: Math.round(avg * 10) / 10,
      color: cat.color || "#6b7280",
    };
  });

  const overallAffectiveScore = affectiveCategoryScores.length > 0
    ? Math.round(affectiveCategoryScores.reduce((s, c) => s + c.averageScore, 0) / affectiveCategoryScores.length * 10) / 10
    : 0;

  // Check finalization status
  const { data: tahfidzFinalized = false } = useQuery({
    queryKey: ["tahfidz-finalization-status", activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester) return false;
      const { data } = await supabase
        .from("tahfidz_finalization")
        .select("is_finalized")
        .eq("academic_year_id", activeAcademicYear.id)
        .eq("semester", currentSemester)
        .maybeSingle();
      return data?.is_finalized || false;
    },
    enabled: !!activeAcademicYear?.id && !!currentSemester,
  });

  const { data: hafalanFinalized = false } = useQuery({
    queryKey: ["hafalan-finalization-status", activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester) return false;
      const { data } = await supabase
        .from("hafalan_finalization")
        .select("is_finalized")
        .eq("academic_year_id", activeAcademicYear.id)
        .eq("semester", currentSemester)
        .maybeSingle();
      return data?.is_finalized || false;
    },
    enabled: !!activeAcademicYear?.id && !!currentSemester,
  });

  const handleBack = () => {
    if (fromPath) {
      navigate(fromPath);
    } else {
      navigate(-1);
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleBack}
            className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </Button>

          <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-white/20 shadow-lg">
            <AvatarImage src={avatarUrl || undefined} alt={santriName} />
            <AvatarFallback className="bg-white/20 text-white text-lg md:text-xl font-bold">
              {santriName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-white truncate">{santriName}</h2>
            <div className="flex items-center gap-2 mt-1">
              {santriNis && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                  NIS: {santriNis}
                </Badge>
              )}
              {santriKelas && (
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                  {santriKelas}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="admin" className="grid-cols-3">
          <TabsTrigger value="tahfidz" variant="admin" className="gap-1.5">
            <ScrollText className="h-4 w-4" />
            <span>Tahfidz & Tahsin</span>
          </TabsTrigger>
          <TabsTrigger value="hafalan" variant="admin" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span>Hafalan</span>
          </TabsTrigger>
          <TabsTrigger value="afektif" variant="admin" className="gap-1.5">
            <Heart className="h-4 w-4" />
            <span>Afektif</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tahfidz" className="mt-4">
          <TahfidzTabContent
            santriId={santriId || ""}
            santriName={santriName}
            santriNis={santriNis}
            santriKelas={santriKelas}
            tahfidzRecords={tahfidzRecords}
            tahfidzLoading={tahfidzLoading}
            isTahfidzFinalized={tahfidzFinalized}
            onRefetch={() => refetchTahfidz()}
          />
        </TabsContent>

        <TabsContent value="hafalan" className="mt-4">
          <HafalanTabContent
            santriId={santriId || ""}
            setoranList={hafalanRecords}
            setoranLoading={hafalanLoading}
            isHafalanFinalized={hafalanFinalized}
            onRefetch={() => refetchHafalan()}
          />
        </TabsContent>

        <TabsContent value="afektif" className="mt-4">
          <AfektifTabContent
            isAffectiveFinalized={isAffectiveFinalized}
            overallAffectiveScore={overallAffectiveScore}
            affectiveCategories={affectiveCategories}
            affectiveIndicators={affectiveIndicators}
            affectiveCategoryScores={affectiveCategoryScores}
            indicatorScoreMap={indicatorScoreMap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
