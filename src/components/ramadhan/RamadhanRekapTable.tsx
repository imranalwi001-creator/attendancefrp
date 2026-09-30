import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, User, ChevronLeft, ChevronRight, Search, CheckCircle, XCircle, CalendarDays, SlidersHorizontal, AlertTriangle, Ban, Droplets } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { CardListPri } from "@/components/ui/card-list-pri";
import type { SantriRekap } from "@/hooks/useMonitoringRamadhan";

const moodEmoji: Record<string, string> = {
  sangat_bahagia: "😄",
  bahagia: "😊",
  happy: "😊",
  biasa: "😐",
  neutral: "😐",
  sedih: "😢",
  sangat_sedih: "😭",
  semangat: "🔥",
  lelah: "😴",
  bersyukur: "🤲",
  calm: "😌",
  excited: "🤩",
};

const PAGE_SIZE = 10;

type StatusFilter = "semua" | "sudah" | "belum";

interface RamadhanRekapTableProps {
  data: SantriRekap[];
  totalActivities: number;
  onSelectSantri: (id: string) => void;
  onSendReminder: (ids: string[]) => void;
  isSending: boolean;
  config?: { tanggal_mulai: string; tahun_hijriah: string } | null;
  selectedDate?: string;
  onDayChange?: (day: number) => void;
}

export function RamadhanRekapTable({ data, totalActivities, onSelectSantri, onSendReminder, isSending, config, selectedDate, onDayChange }: RamadhanRekapTableProps) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");

  const filtered = useMemo(() => {
    let result = [...data];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (statusFilter === "sudah") result = result.filter((s) => s.filledToday);
    if (statusFilter === "belum") result = result.filter((s) => !s.filledToday);
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, statusFilter]);

  // Reset page when filters change
  const filterKey = `${search}-${statusFilter}`;
  useMemo(() => setPage(0), [filterKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const sudahCount = data.filter((s) => s.filledToday).length;
  const belumCount = data.filter((s) => !s.filledToday).length;

  const hijriDay = useMemo(() => {
    if (!config?.tanggal_mulai || !selectedDate) return null;
    const start = new Date(config.tanggal_mulai);
    const current = new Date(selectedDate);
    const diffTime = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays >= 1 && diffDays <= 30 ? diffDays : null;
  }, [config, selectedDate]);

  const formattedDate = selectedDate
    ? new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="space-y-3">
      {/* Stat Cards */}
      <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-2">
        <StatCard
          icon={CalendarDays}
          title={formattedDate}
          value={hijriDay ? `Ramadhan ke-${hijriDay}` : "Hari ini"}
        />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <StatCard
            icon={CheckCircle}
            title="Sudah Mengisi"
            value={sudahCount.toString()}
            variant="success"
          />
          <StatCard
            icon={XCircle}
            title="Belum Mengisi"
            value={belumCount.toString()}
            variant="destructive"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          {/* Search & Filters */}
          <div className="flex gap-2 sm:flex-row sm:items-center">
            <div className="relative w-4/5 lg:flex-1 lg:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama santri..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm sm:text-base h-9 sm:h-10"
              />
            </div>

            {/* Mobile: filter popover */}
            <div className="flex w-1/5 lg:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full gap-1.5 text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4">
                    <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Filter</span>
                    {statusFilter !== "semua" && (
                      <Badge variant="secondary" className="ml-0.5 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">1</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-3" align="end">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Hari Ramadhan</p>
                    <Select
                      value={hijriDay?.toString() ?? "1"}
                      onValueChange={(v) => onDayChange?.(parseInt(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48 overflow-y-auto z-50">
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={d.toString()}>
                            Ramadhan ke-{d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semua">Semua</SelectItem>
                        <SelectItem value="belum">Belum Mengisi</SelectItem>
                        <SelectItem value="sudah">Sudah Mengisi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Desktop: inline filters */}
            <div className="hidden lg:flex items-center gap-2">
              <Select
                value={hijriDay?.toString() ?? "1"}
                onValueChange={(v) => onDayChange?.(parseInt(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto z-50">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      Ramadhan ke-{d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua</SelectItem>
                  <SelectItem value="belum">Belum Mengisi</SelectItem>
                  <SelectItem value="sudah">Sudah Mengisi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
          {paginated.map((s) => (
              <CardListPri
                key={s.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onSelectSantri(s.id)}
                icon={
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                }
                title={s.name}
                columns={[
                  { label: "Fardhu", value: `${s.fardhuCount}/${s.fardhuTotal}` },
                  { label: "Sunnah", value: `${s.sunnahCount}/${s.sunnahTotal}` },
                  { label: "Akhlak", value: `${s.akhlakCount}/${s.akhlakTotal}` },
                  { label: "Mood", value: s.mood ? (moodEmoji[s.mood] ?? "—") : "—" },
                ]}
                badge={
                  <Badge
                    variant={s.filledToday ? "default" : "outline"}
                    className={s.filledToday
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400"
                    }
                  >
                    {s.filledToday ? "Sudah Mengisi" : "Belum Mengisi"}
                  </Badge>
                }
                actions={
                  <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex" onClick={(e) => { e.stopPropagation(); onSelectSantri(s.id); }}>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Button>
                }
                footer={
                  s.isHaid ? (
                    <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-none">
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-medium gap-1 shrink-0 whitespace-nowrap">
                        <Droplets className="h-3 w-3" />
                        Hari ini Ananda sedang haid
                      </Badge>
                    </div>
                  ) : (s.excusedActivities.length > 0 || (s.filledToday && s.missedActivities.length > 0)) ? (
                    <div className="space-y-1.5">
                      {s.excusedActivities.length > 0 && (
                        <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-none">
                          {s.excusedActivities.map((e, i) => (
                            <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 text-[10px] font-normal gap-1 shrink-0 whitespace-nowrap">
                              <AlertTriangle className="h-3 w-3" />
                              {e.title} — {e.reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {s.filledToday && s.missedActivities.length > 0 && (
                        <div className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-none">
                          {s.missedActivities.map((name, i) => (
                            <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-normal gap-1 shrink-0 whitespace-nowrap">
                              <Ban className="h-3 w-3" />
                              {name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : undefined
                }
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Tidak ada data</p>
            )}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" className="gap-1" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => {
                  const showPage = totalPages <= 5 || Math.abs(i - page) <= 1 || i === 0 || i === totalPages - 1;
                  const showEllipsis = !showPage && (i === 1 || i === totalPages - 2);
                  if (showEllipsis) return <span key={i} className="text-xs text-muted-foreground px-1">…</span>;
                  if (!showPage) return null;
                  return (
                    <Button
                      key={i}
                      variant={i === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(i)}
                    >
                      {i + 1}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="gap-1" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
