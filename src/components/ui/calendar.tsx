import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker";
import { setMonth, setYear, getYear, getMonth } from "date-fns";
import { id } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// ── Custom Caption: month + year dropdowns + prev/next buttons ───────────────
function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();

  const safeMonth = displayMonth instanceof Date && !isNaN(displayMonth.getTime()) ? displayMonth : new Date();
  const currentYear = getYear(safeMonth);
  const currentMonthIdx = getMonth(safeMonth);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1940 + 11 }, (_, i) => 1940 + i);

  const MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    goToMonth(setMonth(safeMonth, Number(e.target.value)));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    goToMonth(setYear(safeMonth, Number(e.target.value)));
  };

  const selectCls =
    "appearance-none bg-transparent border border-border rounded-lg px-2 py-1 text-xs font-semibold " +
    "text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary " +
    "cursor-pointer transition-colors pr-5";

  return (
    <div className="flex items-center justify-between px-0.5 pb-1">
      {/* ← Previous month */}
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 border-border bg-card opacity-70 hover:opacity-100 hover:bg-muted rounded-lg transition-all disabled:opacity-20"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Month + Year selectors */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex items-center">
          <select value={currentMonthIdx} onChange={handleMonthChange} className={selectCls}>
            {MONTHS_ID.map((name, idx) => (
              <option key={idx} value={idx}>{name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-muted-foreground" />
        </div>

        <div className="relative flex items-center">
          <select value={currentYear} onChange={handleYearChange} className={cn(selectCls, "w-[70px]")}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* → Next month */}
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 border-border bg-card opacity-70 hover:opacity-100 hover:bg-muted rounded-lg transition-all disabled:opacity-20"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────────
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={id}
      className={cn("p-3 pointer-events-auto bg-card text-foreground", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-2",
        caption: "flex justify-center pt-0 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        nav_button: "hidden",
        nav_button_previous: "hidden",
        nav_button_next: "hidden",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-medium text-[0.75rem] uppercase tracking-wider text-center",
        row: "flex w-full mt-1.5 justify-between",
        cell:
          "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:bg-primary/5 [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-lg text-foreground hover:bg-muted transition-colors aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold shadow-sm",
        day_today: "bg-muted font-bold text-primary border border-primary/30",
        day_outside:
          "day-outside text-muted-foreground/40 opacity-50 aria-selected:bg-primary/5 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground/30 opacity-40 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-primary/10 aria-selected:text-primary",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };


