import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { cn } from "@/lib/utils";

interface BadgeTahunAjaranProps {
  className?: string;
}

export function BadgeTahunAjaran({ className }: BadgeTahunAjaranProps) {
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();

  return (
    <span className="inline-flex items-center gap-1.5">
      <span 
        id="badge-ta" 
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-xs",
          className
        )}
      >
        Tahun Ajaran {activeAcademicYear?.name || "-"} • Semester {currentSemester === "ganjil" ? "Ganjil" : "Genap"}
      </span>
    </span>
  );
}
