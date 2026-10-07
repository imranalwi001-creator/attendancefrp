import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MonthPickerProps {
  value?: string; // Formatted YYYY-MM (e.g. "2026-10")
  onChange?: (monthStr: string) => void;
  className?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function MonthPicker({
  value,
  onChange,
  className,
  disabled = false,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  const initialDate = React.useMemo(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return { year: y, monthIndex: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = React.useState<number>(initialDate.year);

  React.useEffect(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      const [y] = value.split("-").map(Number);
      setViewYear(y);
    }
  }, [value]);

  const selectedYear = initialDate.year;
  const selectedMonthIndex = initialDate.monthIndex;

  const handleSelectMonth = (monthIndex: number) => {
    const formatted = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    onChange?.(formatted);
    setOpen(false);
  };

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((prev) => prev + 1);
  };

  const displayLabel = React.useMemo(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return `${MONTH_NAMES[m - 1]} ${y}`;
    }
    return "Pilih Bulan & Tahun";
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-9 px-3 text-xs rounded-xl border-border bg-card text-foreground hover:bg-muted/40 hover:text-foreground transition-all shadow-none",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate font-medium">{displayLabel}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-muted">
            {viewYear}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 rounded-2xl border-border bg-card shadow-xl"
        align="start"
      >
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevYear}
            className="h-7 w-7 p-0 rounded-lg hover:bg-muted text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold text-foreground">
            Tahun {viewYear}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextYear}
            className="h-7 w-7 p-0 rounded-lg hover:bg-muted text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((name, idx) => {
            const isSelected =
              value &&
              viewYear === selectedYear &&
              idx === selectedMonthIndex;
            const isCurrentMonth =
              new Date().getFullYear() === viewYear &&
              new Date().getMonth() === idx;

            return (
              <button
                key={name}
                type="button"
                onClick={() => handleSelectMonth(idx)}
                className={cn(
                  "relative flex items-center justify-center py-2 px-1 text-xs rounded-xl transition-all font-medium",
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : isCurrentMonth
                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>{name.substring(0, 3)}</span>
                {isSelected && (
                  <Check className="w-3 h-3 ml-1 text-primary-foreground absolute top-1 right-1" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              const formatted = `${now.getFullYear()}-${String(
                now.getMonth() + 1
              ).padStart(2, "0")}`;
              onChange?.(formatted);
              setViewYear(now.getFullYear());
              setOpen(false);
            }}
            className="h-7 text-[11px] text-primary font-medium hover:bg-primary/10 rounded-lg px-2"
          >
            Bulan Ini
          </Button>
          <span className="text-[10px] text-muted-foreground">
            HRM FRP Period
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
