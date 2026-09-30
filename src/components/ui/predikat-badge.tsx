import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Predikat = "mumtaz" | "jayyid-jiddan" | "jayyid" | "maqbul";

export function getPredikatFromScore(score: number): Predikat {
  if (score >= 90) return "mumtaz";
  if (score >= 80) return "jayyid-jiddan";
  if (score >= 70) return "jayyid";
  return "maqbul";
}

interface PredikatBadgeProps {
  predikat: Predikat;
  className?: string;
}

const predikatConfig: Record<Predikat, { label: string; className: string }> = {
  mumtaz: {
    label: "Mumtaz",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  "jayyid-jiddan": {
    label: "Jayyid Jiddan",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  jayyid: {
    label: "Jayyid",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  maqbul: {
    label: "Maqbul",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  },
};

export function PredikatBadge({ predikat, className }: PredikatBadgeProps) {
  const config = predikatConfig[predikat];

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
