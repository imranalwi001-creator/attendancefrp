import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AffectiveScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showPredikat?: boolean;
}

export function getPredikat(score: number): string {
  if (score >= 90) return "Sangat Baik";
  if (score >= 75) return "Baik";
  if (score >= 60) return "Cukup";
  if (score >= 40) return "Kurang";
  return "Perlu Bimbingan";
}

export function getScoreColor(score: number): string {
  if (score >= 90) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 75) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (score >= 60) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (score >= 40) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

export function AffectiveScoreBadge({ score, size = "md", showPredikat = false }: AffectiveScoreBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-lg px-4 py-2 font-bold",
  };

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        getScoreColor(score),
        sizeClasses[size]
      )}
    >
      {score.toFixed(0)}
      {showPredikat && ` - ${getPredikat(score)}`}
    </Badge>
  );
}
