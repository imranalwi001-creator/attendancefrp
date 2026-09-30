import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { AICpTpStudioDrawer } from "@/components/mapel/AICpTpStudioDrawer";

export function PerangkatCpTpStudioDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapelId: string;
  academicYearId?: string | null;
  semester?: "ganjil" | "genap" | null;
  onSaved?: () => void;
}) {
  const { open, onOpenChange, mapelId, academicYearId, semester, onSaved } = props;
  const { getCurrentSemester } = useAcademicYear();
  const [loading, setLoading] = useState(false);
  const [mapel, setMapel] = useState<any>(null);
  const [mapelInfo, setMapelInfo] = useState<any>(null);

  const selectedSemester = useMemo(() => {
    if (semester === "ganjil" || semester === "genap") return semester;
    const s = getCurrentSemester?.() as any;
    return s === "ganjil" ? "ganjil" : "genap";
  }, [getCurrentSemester, semester]);

  useEffect(() => {
    if (!open) return;
    if (!mapelId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data: m, error: mErr } = await supabase
          .from("mapel")
          .select("id, nama, kelas_id, kelas:kelas_id(id, nama, tingkat)")
          .eq("id", mapelId)
          .maybeSingle();
        if (mErr) throw mErr;

        const { data: mi, error: miErr } = await supabase
          .from("mapel_info")
          .select("id, mapel_id, capaian_pembelajaran, tujuan_pembelajaran")
          .eq("mapel_id", mapelId)
          .maybeSingle();
        if (miErr) throw miErr;

        if (cancelled) return;
        setMapel(m);
        setMapelInfo(mi || null);
      } catch (e: any) {
        console.error("[PerangkatCpTpStudioDrawer] load error:", e);
        toast.error(e?.message || "Gagal memuat konteks mapel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, mapelId]);

  const refetchMapelInfo = async () => {
    try {
      const { data: mi, error: miErr } = await supabase
        .from("mapel_info")
        .select("id, mapel_id, capaian_pembelajaran, tujuan_pembelajaran")
        .eq("mapel_id", mapelId)
        .maybeSingle();
      if (miErr) throw miErr;
      setMapelInfo(mi || null);
    } catch (e: any) {
      console.warn("[PerangkatCpTpStudioDrawer] refetch mapel_info failed:", e);
    }
  };

  const syncMapelInfoToPerangkat = async () => {
    try {
      const { data: mi, error: miErr } = await supabase
        .from("mapel_info")
        .select("id, mapel_id, capaian_pembelajaran, tujuan_pembelajaran")
        .eq("mapel_id", mapelId)
        .maybeSingle();
      if (miErr) throw miErr;
      if (!mi) return;

      const cp = Array.isArray((mi as any).capaian_pembelajaran)
        ? (mi as any).capaian_pembelajaran.map((x: any) => (typeof x === "string" ? x : x?.text || "")).filter(Boolean)
        : [];
      const tp = Array.isArray((mi as any).tujuan_pembelajaran)
        ? (mi as any).tujuan_pembelajaran.map((x: any) => (typeof x === "string" ? x : x?.text || "")).filter(Boolean)
        : [];

      const title = `CP & TP - ${mapel?.nama || "Mapel"} (${selectedSemester})`;
      const payload: any = {
        mapel_id: mapelId,
        academic_year_id: academicYearId || null,
        semester: selectedSemester,
        tipe: "CP",
        title,
        content: { cp, tp },
        status: "ready",
        updated_at: new Date().toISOString(),
      };

      // Manual "upsert" (no unique constraint needed)
      const { data: existing } = await supabase
        .from("perangkat_pembelajaran")
        .select("id")
        .eq("mapel_id", mapelId)
        .eq("tipe", "CP")
        .eq("semester", selectedSemester)
        .eq("academic_year_id", academicYearId || null)
        .maybeSingle();

      if (existing?.id) {
        const { error: upErr } = await supabase
          .from("perangkat_pembelajaran")
          .update(payload)
          .eq("id", existing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from("perangkat_pembelajaran").insert(payload);
        if (insErr) throw insErr;
      }
    } catch (e: any) {
      console.warn("[PerangkatCpTpStudioDrawer] sync perangkat failed:", e);
    }
  };

  // If still loading, we still render the drawer but with safe fallbacks.
  return (
    <AICpTpStudioDrawer
      open={open}
      onOpenChange={onOpenChange}
      mapel={mapel || { id: mapelId, nama: "Mapel" }}
      mapelInfo={mapelInfo || { mapel_id: mapelId, capaian_pembelajaran: [], tujuan_pembelajaran: [] }}
      selectedSemester={selectedSemester}
      tpStatusList={[]}
      hasActiveSession={false}
      keepOpenOnSave
      onSaved={() => {
        void refetchMapelInfo();
        void syncMapelInfoToPerangkat();
        if (onSaved) onSaved();
      }}
    />
  );
}
