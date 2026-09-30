import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

interface TargetProgressCardProps {
  santriId: string;
}

export function TargetProgressCard({ santriId }: TargetProgressCardProps) {
  const { activeAcademicYear, currentSemester } = useAcademicYear();

  const { data: targets, isLoading } = useQuery({
    queryKey: ["target-hafalan", santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return [];

      const { data, error } = await supabase
        .from("target_hafalan")
        .select("*");

      if (error) throw error;
      return data || [];
    },
    enabled: !!santriId,
  });

  const { data: setoranCount = 0 } = useQuery({
    queryKey: ["setoran-count", santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return 0;

      let query = supabase
        .from("setoran_hafalan")
        .select("id", { count: "exact", head: true })
        .eq("santri_id", santriId)
        .eq("status", "lancar");

      if (activeAcademicYear?.id) {
        query = query.eq("tahun_ajaran_id", activeAcademicYear.id);
      }
      if (currentSemester) {
        query = query.eq("semester", currentSemester);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!santriId,
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!targets || targets.length === 0) return null;

  const totalTarget = targets.reduce((sum, t) => sum + (t.target_jumlah || 0), 0);
  const percentage = totalTarget > 0 ? Math.min(100, Math.round((setoranCount / totalTarget) * 100)) : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">Target Hafalan</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{setoranCount}/{totalTarget}</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{percentage}% tercapai</p>
        </div>
      </CardContent>
    </Card>
  );
}
