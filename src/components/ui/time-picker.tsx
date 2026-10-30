import * as React from "react";
import { Clock, Check, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TimePickerProps {
  value?: string; // HH:mm format, e.g. "07:30" or "08:17"
  onChange?: (timeStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value = "07:30",
  onChange,
  placeholder = "Pilih jam...",
  className,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);

  // Parse current hour and minute
  const [selectedHour, setSelectedHour] = React.useState<string>("07");
  const [selectedMinute, setSelectedMinute] = React.useState<string>("30");
  const [minuteFilter, setMinuteFilter] = React.useState<"all" | "step5">("all");

  const hourListRef = React.useRef<HTMLDivElement>(null);
  const minuteListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (value && value.includes(":")) {
      const [h, m] = value.split(":");
      setSelectedHour((h || "07").padStart(2, "0"));
      setSelectedMinute((m || "00").padStart(2, "0"));
    }
  }, [value]);

  // Auto-scroll to selected hour and minute when opened
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hourEl = document.getElementById(`tp-hour-${selectedHour}`);
        if (hourEl) {
          hourEl.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const minEl = document.getElementById(`tp-min-${selectedMinute}`);
        if (minEl) {
          minEl.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 100);
    }
  }, [open, selectedHour, selectedMinute]);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const allMinutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const step5Minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const displayedMinutes = minuteFilter === "all" ? allMinutes : step5Minutes;

  const handleSelectHour = (h: string) => {
    setSelectedHour(h);
    const newTime = `${h}:${selectedMinute}`;
    onChange?.(newTime);
  };

  const handleSelectMinute = (m: string) => {
    setSelectedMinute(m);
    const newTime = `${selectedHour}:${m}`;
    onChange?.(newTime);
  };

  const adjustMinute = (delta: number) => {
    const curH = parseInt(selectedHour || "0", 10);
    const curM = parseInt(selectedMinute || "0", 10);
    let totalM = curH * 60 + curM + delta;
    if (totalM < 0) totalM = 24 * 60 + totalM;
    totalM = totalM % (24 * 60);

    const newH = String(Math.floor(totalM / 60)).padStart(2, "0");
    const newM = String(totalM % 60).padStart(2, "0");
    setSelectedHour(newH);
    setSelectedMinute(newM);
    onChange?.(`${newH}:${newM}`);
  };

  const handleHourInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setSelectedHour(raw);
    if (raw.length === 2) {
      const hNum = Math.min(23, Math.max(0, parseInt(raw, 10)));
      const hStr = String(hNum).padStart(2, "0");
      setSelectedHour(hStr);
      onChange?.(`${hStr}:${selectedMinute}`);
    }
  };

  const handleHourBlur = () => {
    const hNum = Math.min(23, Math.max(0, parseInt(selectedHour || "0", 10)));
    const hStr = String(hNum).padStart(2, "0");
    setSelectedHour(hStr);
    onChange?.(`${hStr}:${selectedMinute}`);
  };

  const handleMinuteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setSelectedMinute(raw);
    if (raw.length === 2) {
      const mNum = Math.min(59, Math.max(0, parseInt(raw, 10)));
      const mStr = String(mNum).padStart(2, "0");
      setSelectedMinute(mStr);
      onChange?.(`${selectedHour}:${mStr}`);
    }
  };

  const handleMinuteBlur = () => {
    const mNum = Math.min(59, Math.max(0, parseInt(selectedMinute || "0", 10)));
    const mStr = String(mNum).padStart(2, "0");
    setSelectedMinute(mStr);
    onChange?.(`${selectedHour}:${mStr}`);
  };

  const quickPresets = [
    { label: "Pagi (07:30)", value: "07:30" },
    { label: "Siang (12:00)", value: "12:00" },
    { label: "Pulang (16:30)", value: "16:30" },
    { label: "Lembur 1 (17:00)", value: "17:00" },
    { label: "Malam (20:00)", value: "20:00" },
    { label: "Dini Hari (00:30)", value: "00:30" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-mono font-medium h-9 px-3 text-xs rounded-xl border-border bg-card text-foreground hover:bg-muted/40 transition-all shadow-none",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{value ? `${value} WITA` : placeholder}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 rounded-2xl shadow-xl border-border bg-card" align="start">
        <div className="space-y-2.5">
          {/* Header with Direct Time Input */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Pilih Waktu (WITA)
            </span>
            <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={selectedHour}
                onChange={handleHourInput}
                onBlur={handleHourBlur}
                className="w-6 text-center font-mono font-extrabold text-sm text-primary bg-transparent outline-hidden focus:bg-background/80 rounded"
                title="Ketik Jam (00 - 23)"
              />
              <span className="font-mono font-bold text-primary animate-pulse">:</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={selectedMinute}
                onChange={handleMinuteInput}
                onBlur={handleMinuteBlur}
                className="w-6 text-center font-mono font-extrabold text-sm text-primary bg-transparent outline-hidden focus:bg-background/80 rounded"
                title="Ketik Menit Langsung (00 - 59, contoh: 17)"
              />
            </div>
          </div>

          {/* Stepper Fine-Tuning */}
          <div className="flex items-center justify-between gap-1 bg-muted/20 px-2 py-1 rounded-xl border border-border/60">
            <span className="text-[10px] font-semibold text-muted-foreground">Presisi Menit:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustMinute(-5)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                title="Kurang 5 Menit"
              >
                -5m
              </button>
              <button
                type="button"
                onClick={() => adjustMinute(-1)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                title="Kurang 1 Menit"
              >
                -1m
              </button>
              <button
                type="button"
                onClick={() => adjustMinute(1)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary font-bold transition-all"
                title="Tambah 1 Menit"
              >
                +1m
              </button>
              <button
                type="button"
                onClick={() => adjustMinute(5)}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary font-bold transition-all"
                title="Tambah 5 Menit"
              >
                +5m
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1">
            {quickPresets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  const [h, m] = p.value.split(":");
                  setSelectedHour(h);
                  setSelectedMinute(m);
                  onChange?.(p.value);
                }}
                className={cn(
                  "px-2 py-1 text-[10px] rounded-lg border transition-all",
                  value === p.value
                    ? "bg-primary text-primary-foreground border-primary font-bold"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Hour & Minute Pickers */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
            {/* Hour Picker */}
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground block mb-1 text-center">
                Jam (00 - 23)
              </span>
              <ScrollArea className="h-44 rounded-xl border border-border p-1 bg-muted/20" ref={hourListRef}>
                <div className="grid grid-cols-2 gap-1">
                  {hours.map((h) => (
                    <button
                      key={h}
                      id={`tp-hour-${h}`}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      className={cn(
                        "py-1 text-xs rounded-lg font-mono text-center transition-all",
                        selectedHour === h
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Minute Picker */}
            <div>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  Menit
                </span>
                <div className="flex items-center gap-0.5 text-[9px]">
                  <button
                    type="button"
                    onClick={() => setMinuteFilter("all")}
                    className={cn(
                      "px-1 py-0.2 rounded transition-colors",
                      minuteFilter === "all"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Tampilkan semua menit (00 - 59)"
                  >
                    00-59
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    type="button"
                    onClick={() => setMinuteFilter("step5")}
                    className={cn(
                      "px-1 py-0.2 rounded transition-colors",
                      minuteFilter === "step5"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Kelipatan 5 menit"
                  >
                    :05
                  </button>
                </div>
              </div>

              <ScrollArea className="h-44 rounded-xl border border-border p-1 bg-muted/20" ref={minuteListRef}>
                <div className={cn(
                  "grid gap-1",
                  minuteFilter === "all" ? "grid-cols-3" : "grid-cols-2"
                )}>
                  {displayedMinutes.map((m) => (
                    <button
                      key={m}
                      id={`tp-min-${m}`}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        "py-1 text-xs rounded-lg font-mono text-center transition-all",
                        selectedMinute === m
                          ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      :{m}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-[10px] text-muted-foreground font-mono">
              Terpilih: <strong className="text-primary font-bold">{selectedHour}:{selectedMinute} WITA</strong>
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 text-xs rounded-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground px-3"
            >
              Pilih Waktu
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
