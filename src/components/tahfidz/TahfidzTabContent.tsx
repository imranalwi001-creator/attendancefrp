import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, ScrollText, TrendingUp, Trash2, Eye, Search, RefreshCw, GraduationCap, BarChart3, Lock, Unlock, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PredikatBadge } from "@/components/ui/predikat-badge";
import { StatCard } from "@/components/ui/stat-card";
import { DetailPerkembanganDrawer } from "@/components/tahfidz/DetailPerkembanganDrawer";
import { JuzProgressDetail } from "@/components/tahfidz/JuzProgressDetail";
import { getAllJuzProgress, JuzProgress } from "@/lib/hafalanProgressUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TahfidzTahsinRecord {
  id: string;
  tipe: "tahfidz" | "tahsin";
  mode: string | null;
  surah: string | null;
  juz: number | null;
  ayat_awal: number | null;
  ayat_akhir: number | null;
  materi_tahsin: string | null;
  nilai: number | null;
  status: string;
  tanggal: string;
  created_at?: string | null;
  catatan?: string | null;
  penguji_id?: string;
  penguji_name?: string | null;
  pembina_external?: string | null;
}

interface TahfidzTabContentProps {
  santriId: string;
  santriName?: string;
  santriNis?: string | null;
  santriKelas?: string;
  tahfidzRecords: TahfidzTahsinRecord[];
  tahfidzLoading: boolean;
  isTahfidzFinalized: boolean;
  onRefetch: () => void;
  readOnly?: boolean;
}

export function TahfidzTabContent({
  santriId,
  santriName,
  santriNis,
  santriKelas,
  tahfidzRecords,
  tahfidzLoading,
  isTahfidzFinalized,
  onRefetch,
  readOnly = false,
}: TahfidzTabContentProps) {
  const [tahfidzSearch, setTahfidzSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [tahfidzDetailOpen, setTahfidzDetailOpen] = useState(false);
  const [selectedJuzForDetail, setSelectedJuzForDetail] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TahfidzTahsinRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTahfidzRecord, setSelectedTahfidzRecord] = useState<{
    id: string;
    santri_id: string;
    santri_name?: string;
    santri_nis?: string;
    santri_kelas?: string;
    jenis_hafalan: string;
    nama_materi: string;
    juz?: number | null;
    surah?: string | null;
    ayat_mulai?: number | null;
    ayat_akhir?: number | null;
    nilai?: number | null;
    status: string;
    audio_url?: string | null;
    audio_type?: string | null;
    catatan?: string | null;
    tanggal_setor: string;
    penguji_id: string;
    penguji_name?: string;
    pembina_external?: string | null;
  } | null>(null);

  // Calculate Tahfidz/Tahsin statistics
  const tahfidzStats = useMemo(() => {
    const total = tahfidzRecords.length;
    const ziyadah = tahfidzRecords.filter(r => r.tipe === "tahfidz" && r.mode === "ziyadah").length;
    const murojaah = tahfidzRecords.filter(r => r.tipe === "tahfidz" && r.mode === "murojaah").length;
    const tahsin = tahfidzRecords.filter(r => r.tipe === "tahsin").length;
    return { total, ziyadah, murojaah, tahsin };
  }, [tahfidzRecords]);

  // Calculate weekly setoran data for bar chart
  const weeklySetoranData = useMemo(() => {
    const weeks: { [key: string]: number } = {};
    const now = new Date();
    
    // Initialize last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekKey = `Minggu ${8 - i}`;
      weeks[weekKey] = 0;
    }

    // Count records per week
    tahfidzRecords.forEach(record => {
      const recordDate = new Date(record.tanggal);
      const diffTime = now.getTime() - recordDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      
      if (weekIndex >= 0 && weekIndex < 8) {
        const weekKey = `Minggu ${8 - weekIndex}`;
        if (weeks[weekKey] !== undefined) {
          weeks[weekKey]++;
        }
      }
    });

    return Object.entries(weeks).map(([name, total]) => ({ name, total }));
  }, [tahfidzRecords]);

  // Calculate dynamic Juz progress using the new utility
  const allJuzProgress: JuzProgress[] = useMemo(() => {
    // Convert tahfidzRecords to the format expected by the utility
    const ziyadahRecords = tahfidzRecords
      .filter(r => r.tipe === "tahfidz" && r.mode === "ziyadah")
      .map(r => ({
        surah: r.surah,
        juz: r.juz,
        ayat_awal: r.ayat_awal,
        ayat_akhir: r.ayat_akhir,
        status: r.status,
        mode: r.mode,
        tipe: r.tipe
      }));
    
    return getAllJuzProgress(ziyadahRecords);
  }, [tahfidzRecords]);

  // Calculate memorized Juz count (for display)
  const juzStats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    
    for (const juzProgress of allJuzProgress) {
      if (juzProgress.status === 'completed') completed++;
      else if (juzProgress.status === 'in_progress') inProgress++;
      else notStarted++;
    }
    
    return { completed, inProgress, notStarted };
  }, [allJuzProgress]);

  // Auto-select first Juz with progress
  useEffect(() => {
    if (selectedJuzForDetail === null && allJuzProgress.length > 0) {
      const firstInProgressJuz = allJuzProgress.find(j => j.status === 'in_progress');
      if (firstInProgressJuz) {
        setSelectedJuzForDetail(firstInProgressJuz.juzNumber);
      }
    }
  }, [allJuzProgress, selectedJuzForDetail]);

  // Get predikat from nilai
  const getPredikatFromNilai = (nilai: number | null) => {
    if (!nilai) return "maqbul";
    if (nilai >= 86) return "mumtaz";
    if (nilai >= 76) return "jayyid-jiddan";
    if (nilai >= 51) return "jayyid";
    return "maqbul";
  };

  // Format materi for display
  const formatTahfidzMateri = (record: TahfidzTahsinRecord) => {
    if (record.tipe === "tahsin") {
      return record.materi_tahsin || "Tahsin";
    }
    if (record.surah) {
      const ayatRange = record.ayat_awal && record.ayat_akhir 
        ? ` (${record.ayat_awal}-${record.ayat_akhir})`
        : "";
      return `${record.surah}${ayatRange}`;
    }
    if (record.juz) {
      return `Juz ${record.juz}`;
    }
    return "Tahfidz";
  };

  // Filter tahfidz records and sort by newest first
  const filteredTahfidzRecords = useMemo(() => {
    const filtered = tahfidzRecords.filter(record => {
      const materi = formatTahfidzMateri(record).toLowerCase();
      const catatan = record.catatan?.toLowerCase() || "";
      const matchesSearch = materi.includes(tahfidzSearch.toLowerCase()) || 
                           catatan.includes(tahfidzSearch.toLowerCase());
      
      // If finalized, apply filter rules
      if (isTahfidzFinalized) {
        if (record.tipe === "tahfidz" && record.mode === "ziyadah") {
          return matchesSearch && record.status === "lanjut";
        }
        if (record.tipe === "tahfidz" && record.mode === "murojaah") {
          return matchesSearch && record.status === "lancar";
        }
        if (record.tipe === "tahsin") {
          return matchesSearch && (record.status === "lulus_halaman" || record.status === "lulus");
        }
      }
      
      return matchesSearch;
    });
    
    // Sort by newest first using created_at (most reliable), fallback to tanggal, then id
    return filtered.sort((a, b) => {
      const tsA = a.created_at ? Date.parse(a.created_at) : Date.parse(a.tanggal);
      const tsB = b.created_at ? Date.parse(b.created_at) : Date.parse(b.tanggal);
      if (tsB !== tsA) return tsB - tsA;
      // Final tie-breaker
      return b.id.localeCompare(a.id);
    });
  }, [tahfidzRecords, tahfidzSearch, isTahfidzFinalized]);

  // Reset page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [tahfidzSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredTahfidzRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTahfidzRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTahfidzRecords, currentPage, ITEMS_PER_PAGE]);

  // Handler for Tahfidz/Tahsin Detail
  const handleTahfidzDetail = (record: TahfidzTahsinRecord) => {
    const jenisHafalan = record.tipe === "tahsin" ? "tahsin" : record.mode || "ziyadah";
    
    // Format nama_materi based on type and mode
    let namaMateri = "-";
    if (record.tipe === "tahsin") {
      namaMateri = record.materi_tahsin || "-";
    } else if (record.mode === "murojaah") {
      // For murojaah, use the same format as displayed in the list
      namaMateri = formatTahfidzMateri(record);
    } else if (record.surah) {
      namaMateri = `${record.surah} (Ayat ${record.ayat_awal}-${record.ayat_akhir})`;
    } else if (record.juz) {
      namaMateri = `Juz ${record.juz}`;
    }

    setSelectedTahfidzRecord({
      id: record.id,
      santri_id: santriId,
      santri_name: santriName,
      santri_nis: santriNis || undefined,
      santri_kelas: santriKelas,
      jenis_hafalan: jenisHafalan,
      nama_materi: namaMateri,
      juz: record.juz,
      surah: record.surah,
      ayat_mulai: record.ayat_awal,
      ayat_akhir: record.ayat_akhir,
      nilai: record.nilai,
      status: record.status,
      catatan: record.catatan,
      tanggal_setor: record.tanggal,
      penguji_id: record.penguji_id || "",
      penguji_name: record.penguji_name || undefined,
      pembina_external: record.pembina_external || undefined,
    });
    setTahfidzDetailOpen(true);
  };

  // Handler for delete confirmation
  const handleDeleteClick = (record: TahfidzTahsinRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  // Delete record
  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("tahfidz_tahsin")
        .delete()
        .eq("id", recordToDelete.id);
      
      if (error) throw error;
      
      toast.success("Data berhasil dihapus");
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      onRefetch();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Gagal menghapus data");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler for delete from drawer
  const handleDeleteFromDrawer = () => {
    if (selectedTahfidzRecord) {
      const recordToDeleteFromDrawer = tahfidzRecords.find(r => r.id === selectedTahfidzRecord.id);
      if (recordToDeleteFromDrawer) {
        setRecordToDelete(recordToDeleteFromDrawer);
        setDeleteDialogOpen(true);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="title-card">
              <div className="title-card-icon bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="title-card-title text-primary">Ringkasan Tahfidz & Tahsin</h3>
            </div>
            <div className="flex items-center gap-2">
              {isTahfidzFinalized ? (
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
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Total Setoran" value={tahfidzStats.total} icon={BarChart3} animationDelay={0} />
            <StatCard title="Total Ziyadah" value={tahfidzStats.ziyadah} icon={TrendingUp} animationDelay={50} />
            <StatCard title="Total Murojaah" value={tahfidzStats.murojaah} icon={RefreshCw} animationDelay={100} />
            <StatCard title="Total Tahsin" value={tahfidzStats.tahsin} icon={GraduationCap} animationDelay={150} />
          </div>

          {/* Bar Chart */}
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySetoranData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar 
                  dataKey="total" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Total Setoran"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Juz Tracker - Dynamic with 3 statuses */}
      <Card>
        <CardHeader className="pb-2">
          <div className="title-card">
            <div className="title-card-icon bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <h3 className="text-primary">Tracker Hafalan Juz</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-xs text-muted-foreground">
                Selesai ({juzStats.completed})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-800 ring-1 ring-emerald-400" />
              <span className="text-xs text-muted-foreground">
                Berjalan ({juzStats.inProgress})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted border border-border" />
              <span className="text-xs text-muted-foreground">
                Belum ({juzStats.notStarted})
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-1.5 sm:gap-2">
            {allJuzProgress.map((juzProgress) => {
              const { juzNumber, status, percentage } = juzProgress;
              const isSelected = selectedJuzForDetail === juzNumber;
              
              return (
                <button
                  key={juzNumber}
                  onClick={() => setSelectedJuzForDetail(isSelected ? null : juzNumber)}
                  className={`
                    relative aspect-square rounded-xl flex flex-col items-center justify-center
                    transition-all duration-300 ease-out cursor-pointer
                    ${isSelected ? 'scale-110 z-10' : 'hover:scale-105'}
                    ${status === 'completed' 
                      ? `bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30
                         ${isSelected ? 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-background' : ''}`
                      : status === 'in_progress'
                      ? `bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-emerald-900/40
                         text-emerald-700 dark:text-emerald-300 border-2 border-emerald-400/50
                         ${isSelected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background shadow-lg shadow-emerald-400/20' : ''}`
                      : `bg-muted/50 text-muted-foreground/70 border border-border/50
                         hover:bg-muted hover:text-muted-foreground
                         ${isSelected ? 'ring-2 ring-border ring-offset-2 ring-offset-background' : ''}`
                    }
                  `}
                >
                  {/* Progress indicator for in_progress */}
                  {status === 'in_progress' && (
                    <div 
                      className="absolute inset-0 rounded-xl bg-gradient-to-t from-emerald-500/20 to-transparent"
                      style={{ 
                        clipPath: `inset(${100 - percentage}% 0 0 0)` 
                      }}
                    />
                  )}
                  
                  {/* Checkmark for completed */}
                  {status === 'completed' && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Juz number */}
                  <span className={`
                    relative z-10 font-bold
                    ${status === 'completed' ? 'text-base' : 'text-sm'}
                  `}>
                    {juzNumber}
                  </span>
                  
                  {/* Percentage for in_progress */}
                  {status === 'in_progress' && (
                    <span className="relative z-10 text-[9px] font-medium opacity-90 -mt-0.5">
                      {percentage}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Juz Progress Detail - Inline below grid */}
          {selectedJuzForDetail && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <JuzProgressDetail
                allJuzProgress={allJuzProgress}
                selectedJuz={selectedJuzForDetail}
                onSelectJuz={setSelectedJuzForDetail}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat Section */}
      <Card>
        <CardContent className="p-4">
          {tahfidzLoading ? (
            <div className="card-log-content">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : filteredTahfidzRecords.length === 0 ? (
            <div className="card-log-empty">
              <ScrollText />
              <p>Belum ada riwayat tahfidz & tahsin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search Filter */}
              <div className="px-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari materi..."
                    value={tahfidzSearch}
                    onChange={(e) => setTahfidzSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {paginatedRecords.map((record) => {
                const materi = formatTahfidzMateri(record);
                const jenis = record.tipe === "tahfidz" 
                  ? `Tahfidz${record.mode ? ` - ${record.mode}` : ""}`
                  : "Tahsin";
                const predikat = getPredikatFromNilai(record.nilai);

                return (
                  <div
                    key={record.id}
                    className="card-santri font-card flex items-center justify-between px-5 py-4"
                  >
                    {/* Materi + Jenis */}
                    <div className="flex items-center gap-3 flex-[0.4] min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 shrink-0">
                        <ScrollText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-card-title">
                          {record.mode === "murojaah" ? (record.catatan || materi) : materi}
                        </h4>
                        <p className="font-card-subtitle">{jenis}</p>
                      </div>
                    </div>

                    {/* Tanggal */}
                    <div className="hidden sm:block text-left w-[100px]">
                      <p className="font-card-label">Tanggal</p>
                      <p className="font-card-value">
                        {new Date(record.tanggal).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    {/* Nilai */}
                    <div className="hidden sm:block text-left w-[60px]">
                      <p className="font-card-label">Nilai</p>
                      <p className="font-card-value">{record.nilai ?? "-"}</p>
                    </div>

                    {/* Badge Predikat/Status */}
                    {record.mode === "murojaah" ? (
                      <div className="w-[110px]" />
                    ) : record.mode === "ziyadah" && !record.nilai ? (
                      // Setoran Harian (no nilai) - show "Blok" badge
                      <div className="w-[110px]">
                        <Badge variant="outline" className="w-full justify-center bg-muted/50 text-muted-foreground border-border">
                          Blok
                        </Badge>
                      </div>
                    ) : (
                      <div className="w-[110px]">
                        <PredikatBadge predikat={predikat} className="w-full justify-center" />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {!readOnly && (
                        <Button 
                          variant="icon-outline" 
                          size="icon-sm" 
                          onClick={() => handleDeleteClick(record)}
                          disabled={isTahfidzFinalized}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="icon-outline" size="icon-sm" onClick={() => handleTahfidzDetail(record)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredTahfidzRecords.length)} dari {filteredTahfidzRecords.length} data
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Sebelumnya</span>
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-1"
                    >
                      <span className="hidden sm:inline">Selanjutnya</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tahfidz/Tahsin Detail Drawer */}
      <DetailPerkembanganDrawer
        open={tahfidzDetailOpen}
        onOpenChange={setTahfidzDetailOpen}
        data={selectedTahfidzRecord}
        onSuccess={onRefetch}
        onDelete={!readOnly && !isTahfidzFinalized ? handleDeleteFromDrawer : undefined}
        readOnly={readOnly}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Tahfidz/Tahsin?</AlertDialogTitle>
            <AlertDialogDescription>
              {recordToDelete && (
                <>
                  Data <strong>{formatTahfidzMateri(recordToDelete)}</strong> akan dihapus secara permanen. 
                  Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
