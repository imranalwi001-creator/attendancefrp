import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Sparkles, TrendingUp, Trash2, Eye, Search, Lock, Unlock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PredikatBadge } from "@/components/ui/predikat-badge";
import { HafalanStatusBadge } from "@/components/ui/hafalan-status-badge";
import { TargetProgressCard } from "@/components/santri/TargetProgressCard";
import { EditSetoranDrawer } from "@/components/hafalan/EditSetoranDrawer";

interface SetoranItem {
  id: string;
  kategori: "quran" | "hadist" | "doa";
  judul: string;
  tanggal: string;
  nilai: number;
  status: "lancar" | "belum_lancar" | "lanjut_besok";
  catatan?: string | null;
  audioUrl?: string | null;
  audioType?: "recording" | "drive";
}

interface HafalanTabContentProps {
  santriId: string;
  setoranList: SetoranItem[];
  setoranLoading: boolean;
  isHafalanFinalized: boolean;
  onRefetch: () => void;
}

const kategoriConfig = {
  quran: {
    icon: ScrollText,
    label: "Al-Quran",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "border-emerald-500",
    chartColor: "#10b981",
    bgOuter: "hsl(142 76% 93%)"
  },
  hadist: {
    icon: ScrollText,
    label: "Hadist",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-500",
    chartColor: "#3b82f6",
    bgOuter: "hsl(217 91% 95%)"
  },
  doa: {
    icon: Sparkles,
    label: "Doa",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-500",
    chartColor: "#a855f7",
    bgOuter: "hsl(280 60% 93%)"
  }
};

export function HafalanTabContent({
  santriId,
  setoranList,
  setoranLoading,
  isHafalanFinalized,
  onRefetch,
}: HafalanTabContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState<"semua" | "quran" | "hadist" | "doa">("semua");
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedSetoran, setSelectedSetoran] = useState<SetoranItem | null>(null);

  // Calculate summary
  const summary = useMemo(() => ({
    hadist: setoranList.filter(s => s.kategori === "hadist").length,
    doa: setoranList.filter(s => s.kategori === "doa").length,
    total: setoranList.length
  }), [setoranList]);

  // Calculate weekly hafalan progress data
  const progressData = useMemo(() => {
    const weeks: { [key: string]: { hadist: number; doa: number } } = {};
    const now = new Date();
    
    // Initialize last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekKey = `Minggu ${4 - i}`;
      weeks[weekKey] = { hadist: 0, doa: 0 };
    }

    // Count records per week by kategori
    setoranList.forEach(record => {
      const recordDate = new Date(record.tanggal);
      const diffTime = now.getTime() - recordDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      
      if (weekIndex >= 0 && weekIndex < 4) {
        const weekKey = `Minggu ${4 - weekIndex}`;
        if (weeks[weekKey] && (record.kategori === "hadist" || record.kategori === "doa")) {
          weeks[weekKey][record.kategori as "hadist" | "doa"]++;
        }
      }
    });

    return Object.entries(weeks).map(([minggu, data]) => ({ minggu, ...data }));
  }, [setoranList]);

  const filteredSetoran = useMemo(() => setoranList.filter(s => {
    const matchesKategori = filterKategori === "semua" || s.kategori === filterKategori;
    const matchesSearch = s.judul.toLowerCase().includes(searchQuery.toLowerCase());
    // When finalized, only show 'lancar' status
    const matchesFinalizationFilter = isHafalanFinalized ? s.status === "lancar" : true;
    return matchesKategori && matchesSearch && matchesFinalizationFilter;
  }), [setoranList, filterKategori, searchQuery, isHafalanFinalized]);

  const getPredikatLabel = (nilai: number) => {
    if (nilai >= 86) return {
      label: "Mumtaz",
      variant: "default" as const,
      className: "bg-[hsl(var(--mumtaz)/0.15)] text-[hsl(var(--mumtaz))] border-0"
    };
    if (nilai >= 76) return {
      label: "Jayyid Jiddan",
      variant: "default" as const,
      className: "bg-[hsl(var(--jayyid-jiddan)/0.15)] text-[hsl(var(--jayyid-jiddan))] border-0"
    };
    if (nilai >= 51) return {
      label: "Jayyid",
      variant: "default" as const,
      className: "bg-[hsl(var(--jayyid)/0.15)] text-[hsl(var(--jayyid))] border-0"
    };
    return {
      label: "Maqbul",
      variant: "default" as const,
      className: "bg-[hsl(var(--maqbul)/0.15)] text-[hsl(var(--maqbul))] border-0"
    };
  };

  const handleEditSetoran = (setoran: SetoranItem) => {
    setSelectedSetoran(setoran);
    setEditDrawerOpen(true);
  };

  const handleEditSuccess = () => {
    onRefetch();
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats Card with Progress Chart */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-6">
          {/* Progress Chart Title */}
          <div className="flex items-center justify-between">
            <div className="title-card">
              <div className="title-card-icon bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="title-card-title text-primary">Ringkasan Nilai Hafalan</h3>
            </div>
            <div className="flex items-center gap-2">
              {isHafalanFinalized ? (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                  <Lock className="h-3 w-3" />
                  Sudah Difinalisasi
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                  <Unlock className="h-3 w-3" />
                  Belum Difinalisasi
                </Badge>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            {(["hadist", "doa"] as const).map((kategori, index) => {
              const config = kategoriConfig[kategori];
              const Icon = config.icon;
              return (
                <div
                  key={kategori}
                  className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-xl p-3 sm:p-4"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Double-circle icon badge */}
                    <div className="rounded-full p-2 sm:p-2.5 shrink-0" style={{ backgroundColor: config.bgOuter }}>
                      <div className="rounded-full p-1 sm:p-1.5" style={{ backgroundColor: config.chartColor }}>
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" strokeWidth={2} />
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">{config.label}</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground">{summary[kategori]}</h3>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Chart */}
          <div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} barGap={2} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="minggu" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={30} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px -4px rgba(0,0,0,0.15)',
                      padding: '12px 16px'
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Bar dataKey="hadist" name="Hadist" fill={kategoriConfig.hadist.chartColor} radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="doa" name="Doa" fill={kategoriConfig.doa.chartColor} radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              {(["hadist", "doa"] as const).map(key => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: kategoriConfig[key].chartColor }} />
                  <span className="text-muted-foreground">{kategoriConfig[key].label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Progress Card */}
      <TargetProgressCard santriId={santriId} />

      {/* Setoran History */}
      <Card>
        <CardContent className="pt-4 px-0 pb-0">
          {/* Search and Filter */}
          <div className="px-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari hafalan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterKategori} onValueChange={(value: "semua" | "quran" | "hadist" | "doa") => setFilterKategori(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="quran">Al-Quran</SelectItem>
                <SelectItem value="hadist">Hadist</SelectItem>
                <SelectItem value="doa">Doa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Setoran List */}
          <div className="p-4 space-y-3">
            {setoranLoading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-santri flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))
            ) : filteredSetoran.length === 0 ? (
              <div className="p-8 text-center">
                <ScrollText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground">Belum ada riwayat setoran</p>
              </div>
            ) : (
              filteredSetoran.map((setoran) => {
                const config = kategoriConfig[setoran.kategori];
                const Icon = config.icon;
                const predikat = getPredikatLabel(setoran.nilai);

                return (
                  <div
                    key={setoran.id}
                    className="card-santri font-card flex items-center justify-between px-5 py-4"
                  >
                    {/* Icon & Title */}
                    <div className="flex items-center gap-3 flex-[0.4] min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} shrink-0`}>
                        <Icon className={`h-5 w-5 ${config.textColor}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-card-title">{setoran.judul}</h4>
                        <p className="font-card-subtitle">{config.label}</p>
                      </div>
                    </div>

                    {/* Tanggal */}
                    <div className="hidden sm:block text-left w-[100px]">
                      <p className="font-card-label">Tanggal</p>
                      <p className="font-card-value">
                        {new Date(setoran.tanggal).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    {/* Nilai */}
                    <div className="hidden sm:block text-left w-[60px]">
                      <p className="font-card-label">Nilai</p>
                      <p className="font-card-value">{setoran.nilai}</p>
                    </div>

                    {/* Badge Status */}
                    <div className="w-[110px]">
                      <HafalanStatusBadge status={setoran.status} className="w-full justify-center" />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button variant="icon-outline" size="icon-sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="icon-outline" size="icon-sm" onClick={() => handleEditSetoran(setoran)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Drawer */}
      <EditSetoranDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        setoran={selectedSetoran}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
