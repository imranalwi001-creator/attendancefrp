import * as React from "react";
import { Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TimePickerProps {
  value?: string; // HH:mm format, e.g. "07:30" or "16:30"
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

  React.useEffect(() => {
    if (value && value.includes(":")) {
      const [h, m] = value.split(":");
      setSelectedHour(h.padStart(2, "0"));
      setSelectedMinute(m.padStart(2, "0"));
    }
  }, [value]);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

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
      <PopoverContent className="w-72 p-3 rounded-2xl shadow-xl border-border bg-card" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Pilih Waktu (WITA)
            </span>
            <span className="text-sm font-mono font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
              {selectedHour}:{selectedMinute}
            </span>
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
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground block mb-1 text-center">
                Jam (00 - 23)
              </span>
              <ScrollArea className="h-44 rounded-xl border border-border p-1 bg-muted/20">
                <div className="grid grid-cols-2 gap-1">
                  {hours.map((h) => (
                    <button
                      key={h}
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

            <div>
              <span className="text-[10px] font-semibold text-muted-foreground block mb-1 text-center">
                Menit (:00 - :55)
              </span>
              <ScrollArea className="h-44 rounded-xl border border-border p-1 bg-muted/20">
                <div className="grid grid-cols-2 gap-1">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        "py-1 text-xs rounded-lg font-mono text-center transition-all",
                        selectedMinute === m
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
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

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 text-xs rounded-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Pilih Waktu
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
