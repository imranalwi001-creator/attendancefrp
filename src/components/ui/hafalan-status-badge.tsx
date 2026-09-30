import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type HafalanStatus = "lancar" | "belum_lancar" | "lanjut_besok";

interface HafalanStatusBadgeProps {
  status: HafalanStatus;
  className?: string;
}

const statusConfig: Record<HafalanStatus, { label: string; className: string }> = {
  lancar: {
    label: "Lancar",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  belum_lancar: {
    label: "Belum Lancar",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  lanjut_besok: {
    label: "Lanjut Besok",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
};

export function HafalanStatusBadge({ status, className }: HafalanStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.belum_lancar;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-3 py-1",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
