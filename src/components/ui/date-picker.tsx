import * as React from "react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: string; // Formatted YYYY-MM-DD
  onChange?: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal...",
  className,
  disabled = false,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse string YYYY-MM-DD or ISO string to Date object safely
  const selectedDate = React.useMemo(() => {
    if (!value || typeof value !== 'string') return undefined;
    try {
      // Handles both "YYYY-MM-DD" and ISO strings with timestamp (e.g. "2024-01-01T00:00:00Z")
      const datePart = value.split('T')[0].trim();
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const dt = new Date(y, m, d);
          return isNaN(dt.getTime()) ? undefined : dt;
        }
      }
      const parsed = parseISO(value);
      return !isNaN(parsed.getTime()) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  const isValidSelected = React.useMemo(() => {
    return selectedDate instanceof Date && !isNaN(selectedDate.getTime());
  }, [selectedDate]);

  const handleSelect = (date: Date | undefined) => {
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      onChange?.(`${year}-${month}-${day}`);
    } else {
      onChange?.("");
    }
    setOpen(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    onChange?.(`${year}-${month}-${day}`);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-9 px-3 text-xs rounded-xl border-border bg-card text-foreground hover:bg-muted/40 hover:text-foreground transition-all shadow-none",
            !isValidSelected && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">
              {isValidSelected && selectedDate ? (
                format(selectedDate, "d MMMM yyyy", { locale: id })
              ) : (
                <span>{placeholder}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {clearable && isValidSelected && !disabled && (
              <span
                role="button"
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Hapus pilihan"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl border-border bg-card shadow-lg" align="start">
        <Calendar
          mode="single"
          selected={isValidSelected ? selectedDate : undefined}
          defaultMonth={isValidSelected && selectedDate ? selectedDate : new Date()}
          onSelect={handleSelect}
          initialFocus
          locale={id}
        />
        <div className="p-2 border-t border-border flex items-center justify-between text-xs bg-muted/20 rounded-b-2xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 text-xs text-muted-foreground hover:text-foreground rounded-lg"
          >
            Hapus
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSetToday}
            className="h-7 text-xs text-primary font-medium hover:bg-primary/10 rounded-lg"
          >
            Hari Ini
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
