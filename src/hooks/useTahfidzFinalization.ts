import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveAcademicYear } from "@/hooks/useActiveAcademicYear";
import { toast } from "sonner";

interface TahfidzFinalizationData {
  id: string;
  academic_year_id: string;
  semester: string;
  is_finalized: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  ziyadah_total_pages: number;
  ziyadah_total_records: number;
  murojaah_total_records: number;
  murojaah_avg_score: number;
  tahsin_total_pages: number;
  tahsin_total_records: number;
}

export interface FinalizationPreview {
  ziyadah: {
    totalRecords: number;
    totalPages: number;
    ignoredRecords: number;
  };
  murojaah: {
    totalRecords: number;
    avgScore: number;
    ignoredRecords: number;
  };
  tahsin: {
    totalRecords: number;
    totalPages: number;
    ignoredRecords: number;
  };
  hasData: boolean;
}

/**
 * Optimized hook for tahfidz finalization status
 * Uses React Query for caching - preview is lazy loaded only when needed
 */
export function useTahfidzFinalization(
  overrideAcademicYearId?: string | null,
  overrideSemester?: string | null
) {
  const { user } = useAuth();
  const { academicYear } = useActiveAcademicYear();

  const academicYearId = overrideAcademicYearId || academicYear?.id;
  const semester = overrideSemester || academicYear?.semester;

  const [preview, setPreview] = useState<FinalizationPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use React Query with proper caching for finalization status
  const { data: finalizationData, isLoading, refetch } = useQuery({
    queryKey: ["tahfidz-finalization", academicYearId, semester],
    queryFn: async () => {
      if (!academicYearId || !semester) return null;

      const { data, error } = await supabase
        .from("tahfidz_finalization" as any)
        .select(`
          id, academic_year_id, semester, is_finalized, finalized_at, finalized_by,
          ziyadah_total_pages, ziyadah_total_records, murojaah_total_records,
          murojaah_avg_score, tahsin_total_pages, tahsin_total_records
        `)
        .eq("academic_year_id", academicYearId)
        .eq("semester", semester)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown) as TahfidzFinalizationData | null;
    },
    enabled: !!academicYearId && !!semester,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Calculate preview data based on filter rules
  const fetchPreview = useCallback(async () => {
    if (!academicYearId || !semester) return;

    setIsPreviewLoading(true);
    try {
      const { data: records, error } = await supabase
        .from("tahfidz_tahsin")
        .select("id, tipe, mode, status, nilai, ayat_awal, ayat_akhir, materi_tahsin")
        .eq("tahun_ajaran_id", academicYearId)
        .eq("semester", semester)
        .limit(1000);

      if (error) throw error;

      const allRecords = records || [];

      // === ZIYADAH (status = 'lanjut' only) ===
      const ziyadahRecords = allRecords.filter(
        (r) => r.tipe === "tahfidz" && r.mode === "ziyadah"
      );
      const ziyadahValid = ziyadahRecords.filter((r) => r.status === "lanjut");
      const ziyadahIgnored = ziyadahRecords.filter((r) => r.status === "ulang");
      
      const ziyadahTotalPages = ziyadahValid.reduce((sum, r) => {
        const ayatCount = (r.ayat_akhir || 0) - (r.ayat_awal || 0) + 1;
        return sum + ayatCount / 15;
      }, 0);

      // === MUROJAAH (status = 'lancar' only) ===
      const murojaahRecords = allRecords.filter(
        (r) => r.tipe === "tahfidz" && r.mode === "murojaah"
      );
      const murojaahValid = murojaahRecords.filter((r) => r.status === "lancar");
      const murojaahIgnored = murojaahRecords.filter((r) => r.status === "belum_lancar");
      
      const murojaahAvgScore = murojaahValid.length > 0
        ? murojaahValid.reduce((sum, r) => sum + (r.nilai || 0), 0) / murojaahValid.length
        : 0;

      // === TAHSIN (status = 'lulus_halaman' OR 'lulus' only) ===
      const tahsinRecords = allRecords.filter((r) => r.tipe === "tahsin");
      const tahsinValid = tahsinRecords.filter(
        (r) => r.status === "lulus_halaman" || r.status === "lulus"
      );
      const tahsinIgnored = tahsinRecords.filter(
        (r) => r.status === "ulang_halaman" || r.status === "naik_jilid"
      );
      
      const tahsinTotalPages = tahsinValid.length;

      setPreview({
        ziyadah: {
          totalRecords: ziyadahValid.length,
          totalPages: Math.round(ziyadahTotalPages * 10) / 10,
          ignoredRecords: ziyadahIgnored.length,
        },
        murojaah: {
          totalRecords: murojaahValid.length,
          avgScore: Math.round(murojaahAvgScore * 10) / 10,
          ignoredRecords: murojaahIgnored.length,
        },
        tahsin: {
          totalRecords: tahsinValid.length,
          totalPages: tahsinTotalPages,
          ignoredRecords: tahsinIgnored.length,
        },
        hasData:
          ziyadahValid.length > 0 ||
          murojaahValid.length > 0 ||
          tahsinValid.length > 0,
      });
    } catch (error) {
      console.error("Error calculating preview:", error);
      toast.error("Gagal menghitung preview data");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [academicYearId, semester]);

  // Only fetch preview when not finalized
  useEffect(() => {
    if (academicYearId && semester && finalizationData?.is_finalized === false) {
      fetchPreview();
    }
  }, [academicYearId, semester, finalizationData?.is_finalized, fetchPreview]);

  // Finalize the semester
  const finalize = async () => {
    if (!academicYearId || !semester || !user?.id || !preview) {
      toast.error("Data tidak lengkap untuk finalisasi");
      return false;
    }

    setIsSubmitting(true);
    try {
      const finalizationPayload = {
        academic_year_id: academicYearId,
        semester: semester,
        is_finalized: true,
        finalized_at: new Date().toISOString(),
        finalized_by: user.id,
        ziyadah_total_pages: preview.ziyadah.totalPages,
        ziyadah_total_records: preview.ziyadah.totalRecords,
        murojaah_total_records: preview.murojaah.totalRecords,
        murojaah_avg_score: preview.murojaah.avgScore,
        tahsin_total_pages: preview.tahsin.totalPages,
        tahsin_total_records: preview.tahsin.totalRecords,
      };

      if (finalizationData?.id) {
        const { error } = await supabase
          .from("tahfidz_finalization" as any)
          .update(finalizationPayload)
          .eq("id", finalizationData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tahfidz_finalization" as any)
          .insert(finalizationPayload);

        if (error) throw error;
      }

      toast.success("Nilai semester berhasil difinalisasi");
      await refetch();
      return true;
    } catch (error) {
      console.error("Error finalizing:", error);
      toast.error("Gagal memfinalisasi nilai semester");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unfinalize (for admins)
  const unfinalize = async () => {
    if (!finalizationData?.id) {
      toast.error("Tidak ada data finalisasi");
      return false;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("tahfidz_finalization" as any)
        .update({
          is_finalized: false,
          finalized_at: null,
          finalized_by: null,
        })
        .eq("id", finalizationData.id);

      if (error) throw error;

      toast.success("Finalisasi dibatalkan");
      await refetch();
      return true;
    } catch (error) {
      console.error("Error unfinalizing:", error);
      toast.error("Gagal membatalkan finalisasi");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    finalizationData,
    isFinalized: finalizationData?.is_finalized || false,
    preview,
    isLoading: isLoading || isPreviewLoading,
    isSubmitting,
    finalize,
    unfinalize,
    refetch: () => {
      refetch();
      fetchPreview();
    },
  };
}
