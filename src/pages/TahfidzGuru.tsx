import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { BadgeTahunAjaran } from "@/components/ui/badge-tahun-ajaran";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CheckCircle, AlertTriangle, Eye, Trash2, Search, Plus, BookOpen, Mic2, BarChart3, X, TrendingUp, TrendingDown, Minus, Loader2, ChevronRight, ChevronDown, SlidersHorizontal, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SantriListCard } from "@/components/ui/santri-list-card";
import { TambahPerkembanganDrawer } from "@/components/tahfidz/TambahPerkembanganDrawer";
import { DetailPerkembanganDrawer } from "@/components/tahfidz/DetailPerkembanganDrawer";
import { TahfidzFinalizationSection } from "@/components/tahfidz/TahfidzFinalizationSection";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { useTahfidzData, SantriWithProgress, ChartData } from "@/hooks/useTahfidzData";
import { useTahfidzFinalization } from "@/hooks/useTahfidzFinalization";
import { SemesterFilter } from "@/components/ui/semester-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Type untuk detail drawer
interface PerkembanganData {
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
  halaman?: number | null;
  nilai?: number | null;
  status: string;
  audio_url?: string | null;
  audio_type?: string | null;
  catatan?: string | null;
  tanggal_setor: string;
  penguji_id: string;
  penguji_name?: string;
  tajwid?: number | null;
  makhraj?: number | null;
  kelancaran?: number | null;
  materi_tahsin?: string | null;
  mode?: string | null;
  pembina_external?: string | null;
}

type RiwayatFilterType = "semua" | "sudah_setor" | "belum_setor" | "ziyadah" | "murojaah" | "tasmi" | "tahsin";

const riwayatFilterOptions: { value: RiwayatFilterType; label: string; }[] = [
  { value: "semua", label: "Semua" },
  { value: "sudah_setor", label: "Sudah Setor Hari Ini" },
  { value: "belum_setor", label: "Belum Setor Hari Ini" },
  { value: "ziyadah", label: "Ziyadah" },
  { value: "murojaah", label: "Murojaah" },
  { value: "tasmi", label: "Tasmi" },
  { value: "tahsin", label: "Tahsin" },
];

const getJenisBadge = (jenis: string, isSetoranHarian?: boolean) => {
  const badgeBase = "px-2.5 py-0.5 text-xs font-medium rounded-md border-0";
  
  if (jenis === "tahsin") {
    return <Badge className={cn(badgeBase, "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400")}>Tahsin</Badge>;
  }
  if (jenis === "ziyadah") {
    if (isSetoranHarian) {
      return <Badge className={cn(badgeBase, "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400")}>Blok</Badge>;
    }
    return <Badge className={cn(badgeBase, "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400")}>Ziyadah</Badge>;
  }
  if (jenis === "murojaah") {
    return <Badge className={cn(badgeBase, "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400")}>Murojaah</Badge>;
  }
  if (jenis === "tasmi") {
    return <Badge className={cn(badgeBase, "bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400")}>Tasmi</Badge>;
  }
  return null;
};

export default function TahfidzGuru() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ringkasan");
  const [riwayatFilter, setRiwayatFilter] = useState<RiwayatFilterType>("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<"tahfidz" | "tahsin">("tahfidz");
  const [drawerPrefillData, setDrawerPrefillData] = useState<{
    santriId?: string;
    juz?: string;
    surah?: string;
    surahNumber?: number;
    ziyadahSubMode?: "setoran_harian" | "finalisasi_surah";
  } | undefined>(undefined);
  const [selectedPerkembangan, setSelectedPerkembangan] = useState<PerkembanganData | null>(null);
  const [selectedChartSegment, setSelectedChartSegment] = useState<ChartData | null>(null);
  const [activeChartIndex, setActiveChartIndex] = useState<number | undefined>(undefined);

  // Semester filter state
  const [semesterFilter, setSemesterFilter] = useState("aktif");
  const [filterTahunAjaranId, setFilterTahunAjaranId] = useState<string | null>(null);
  const [filterSemester, setFilterSemester] = useState<string | null>(null);

  const { 
    santriList, santriPerluBimbingan, santriTidakHadir, santriSurahSelesai,
    stats, chartData, isLoading, error, refetch, deleteRecord, getPerluPerhatianSantri 
  } = useTahfidzData(
    semesterFilter === "aktif" ? null : filterTahunAjaranId,
    semesterFilter === "aktif" ? null : filterSemester
  );

  const { isFinalized } = useTahfidzFinalization(
    semesterFilter === "aktif" ? null : filterTahunAjaranId,
    semesterFilter === "aktif" ? null : filterSemester
  );

  const handleSemesterChange = (value: string, tahunAjaranId: string | null, semester: string | null) => {
    setSemesterFilter(value);
    setFilterTahunAjaranId(tahunAjaranId);
    setFilterSemester(semester);
  };

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SantriWithProgress | null>(null);

  // Show more state
  const [showAllTidakHadir, setShowAllTidakHadir] = useState(false);
  const [showAllPerluBimbingan, setShowAllPerluBimbingan] = useState(false);
  const [showAllSurahSelesai, setShowAllSurahSelesai] = useState(false);
  const INITIAL_DISPLAY_LIMIT = 5;

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const convertToPerkembanganData = (santri: SantriWithProgress): PerkembanganData => {
    const record = santri.lastRecord;
    return {
      id: record?.id || santri.id,
      santri_id: santri.santriId,
      santri_name: santri.nama,
      santri_nis: santri.nis || undefined,
      santri_kelas: santri.kelas || undefined,
      jenis_hafalan: record?.tipe === "tahsin" ? "tahsin" : (record?.mode || "ziyadah"),
      nama_materi: santri.materi,
      juz: record?.juz,
      surah: record?.surah,
      ayat_mulai: record?.ayat_awal,
      ayat_akhir: record?.ayat_akhir,
      nilai: record?.nilai,
      status: record?.status || "",
      audio_url: record?.audio_url,
      audio_type: record?.audio_type,
      catatan: record?.catatan,
      tanggal_setor: record?.tanggal || "",
      penguji_id: record?.penguji_id || "",
      penguji_name: record?.penguji_name || undefined,
      tajwid: record?.tajwid,
      makhraj: record?.makhraj,
      kelancaran: record?.kelancaran,
      materi_tahsin: record?.materi_tahsin,
      mode: record?.mode,
      pembina_external: record?.pembina_external,
    };
  };

  const handleDetailClick = (santri: SantriWithProgress) => {
    setSelectedPerkembangan(convertToPerkembanganData(santri));
    setDetailDrawerOpen(true);
  };

  const handleDeleteClick = (santri: SantriWithProgress) => {
    setRecordToDelete(santri);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    const success = await deleteRecord(recordToDelete.recordId);
    if (success) toast.success("Data berhasil dihapus");
    else toast.error("Gagal menghapus data");
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const filteredRiwayat = useMemo(() => {
    return santriList.filter(santri => {
      const matchesSearch = santri.nama.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      switch (riwayatFilter) {
        case "sudah_setor": return santri.hariSejak === 0;
        case "belum_setor": return santri.hariSejak > 0;
        case "ziyadah": return santri.jenis === "ziyadah";
        case "murojaah": return santri.jenis === "murojaah";
        case "tasmi": return santri.lastRecord?.mode === "tasmi";
        case "tahsin": return santri.jenis === "tahsin" || santri.lastRecord?.tipe === "tahsin";
        default: return true;
      }
    });
  }, [santriList, searchQuery, riwayatFilter]);

  useMemo(() => { setCurrentPage(1); }, [searchQuery, riwayatFilter, semesterFilter]);

  const totalPages = Math.ceil(filteredRiwayat.length / ITEMS_PER_PAGE);
  const paginatedRiwayat = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRiwayat.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRiwayat, currentPage, ITEMS_PER_PAGE]);

  const handleDrawerSuccess = () => { refetch(); };

  const avgNilai = useMemo(() => {
    if (chartData.length === 0) return 0;
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    return Math.round(total / chartData.length);
  }, [chartData]);

  const renderSantriCard = (santri: SantriWithProgress, index: number) => {
    const isSetoranBlok = santri.lastRecord?.mode === "ziyadah" && santri.lastRecord?.nilai === null;
    
    return (
      <SantriListCard
        key={santri.id}
        avatar={santri.avatar || undefined}
        name={santri.nama}
        subtitle={santri.kelas || "-"}
        columns={[
          { label: "Materi", value: santri.materi, colSpan: 3 },
          {
            label: "Terakhir Setor",
            value: (
              <>
                {santri.tanggalSetor}{" "}
                <span className={cn("text-xs font-normal", santri.hariSejak > 3 ? "text-destructive" : "text-muted-foreground")}>
                  ({santri.detailHari})
                </span>
              </>
            ),
            colSpan: 3,
          },
        ]}
        mobileDetail={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="truncate max-w-[120px]">{santri.materi}</span>
            <span>•</span>
            <span className={cn(santri.hariSejak > 3 ? "text-destructive" : "")}>{santri.detailHari}</span>
          </div>
        }
        badge={getJenisBadge(santri.jenis, isSetoranBlok)}
        actions={
          <>
            <Button variant="icon-outline" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleDetailClick(santri); }}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="icon-outline" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDeleteClick(santri); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
        onClick={() => handleDetailClick(santri)}
        animationDelay={`${index * 50}ms`}
      />
    );
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 rounded-xl border border-border/50">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = (message: string) => (
    <div className="p-8 rounded-xl border border-border/50 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 rounded-full bg-muted">
          <BookOpen className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 lg:space-y-6 pb-24">
      <PageHeader 
        title="Tahfidz & Tahsin" 
        subtitle={<BadgeTahunAjaran />}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isFinalized}>
                <Plus className="h-4 w-4" />
                {isFinalized ? "Terkunci" : "Tambah"}
                {!isFinalized && <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            </DropdownMenuTrigger>
            {!isFinalized && (
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setDrawerInitialTab("tahfidz"); setDrawerOpen(true); }}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Tahfidz
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDrawerInitialTab("tahsin"); setDrawerOpen(true); }}>
                  <Mic2 className="h-4 w-4 mr-2" />
                  Tahsin
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        }
      />

      <TambahPerkembanganDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerPrefillData(undefined);
        }}
        initialTab={drawerInitialTab}
        onSuccess={handleDrawerSuccess}
        prefillData={drawerPrefillData}
      />

      <DetailPerkembanganDrawer
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        data={selectedPerkembangan}
        onSuccess={handleDrawerSuccess}
        onDelete={() => {
          if (selectedPerkembangan) {
            const santriToDelete = santriList.find(s => s.recordId === selectedPerkembangan.id || s.id === selectedPerkembangan.id);
            if (santriToDelete) handleDeleteClick(santriToDelete);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data {recordToDelete?.jenis === "tahsin" ? "Tahsin" : "Tahfidz"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data <strong>{recordToDelete?.materi}</strong> milik <strong>{recordToDelete?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="digiss">
          <TabsTrigger variant="digiss" value="ringkasan" className="flex-1">
            <BarChart3 className="h-4 w-4 mr-1.5 hidden lg:block" />
            Ringkasan
          </TabsTrigger>
          <TabsTrigger variant="digiss" value="riwayat" className="flex-1">
            <BookOpen className="h-4 w-4 mr-1.5 hidden lg:block" />
            Riwayat Setoran
          </TabsTrigger>
        </TabsList>

        {/* Tab Riwayat Setoran */}
        <TabsContent value="riwayat" className="space-y-6 mt-6">
          <div className="container-base">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari nama santri..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
              </div>

              {/* Mobile Filter */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="sm:hidden rounded-xl shrink-0">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl">
                  <SheetHeader><SheetTitle>Filter</SheetTitle></SheetHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tahun Ajaran & Semester</label>
                      <SemesterFilter value={semesterFilter} onChange={handleSemesterChange} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jenis Hafalan</label>
                      <Select value={riwayatFilter} onValueChange={value => setRiwayatFilter(value as RiwayatFilterType)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Filter Jenis" /></SelectTrigger>
                        <SelectContent>
                          {riwayatFilterOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Desktop Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="hidden sm:flex gap-2 rounded-xl">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filter
                    {(semesterFilter !== "aktif" || riwayatFilter !== "semua") && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {(semesterFilter !== "aktif" ? 1 : 0) + (riwayatFilter !== "semua" ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tahun Ajaran & Semester</label>
                      <SemesterFilter value={semesterFilter} onChange={handleSemesterChange} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jenis Hafalan</label>
                      <Select value={riwayatFilter} onValueChange={value => setRiwayatFilter(value as RiwayatFilterType)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Filter Jenis" /></SelectTrigger>
                        <SelectContent>
                          {riwayatFilterOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(semesterFilter !== "aktif" || riwayatFilter !== "semua") && (
                      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => {
                        setSemesterFilter("aktif");
                        setFilterTahunAjaranId(null);
                        setFilterSemester(null);
                        setRiwayatFilter("semua");
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Reset Filter
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Santri List */}
            <div className="space-y-3 mt-4">
              {isLoading ? renderLoadingSkeleton() : error ? (
                <div className="p-6 rounded-xl border border-destructive/50 text-center text-destructive">
                  {error?.message || "Terjadi kesalahan"}
                  <Button variant="outline" size="sm" className="ml-2" onClick={() => refetch()}>Coba Lagi</Button>
                </div>
              ) : filteredRiwayat.length === 0 ? renderEmptyState("Tidak ada riwayat setoran dengan filter ini") : (
                <>
                  {paginatedRiwayat.map((santri, index) => renderSantriCard(santri, index))}
                  
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50">
                      <p className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                        Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredRiwayat.length)} dari {filteredRiwayat.length} data
                      </p>
                      <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 sm:w-auto sm:px-3 p-0 sm:gap-1">
                          <ChevronLeft className="h-4 w-4" />
                          <span className="hidden sm:inline">Sebelumnya</span>
                        </Button>
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;
                            const isMobileVisible = Math.abs(pageNum - currentPage) <= 1 || totalPages <= 3;
                            return (
                              <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" className={`w-8 h-8 p-0 text-xs sm:text-sm ${!isMobileVisible ? 'hidden sm:flex' : 'flex'}`} onClick={() => setCurrentPage(pageNum)}>
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 sm:w-auto sm:px-3 p-0 sm:gap-1">
                          <span className="hidden sm:inline">Selanjutnya</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Ringkasan */}
        <TabsContent value="ringkasan" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Pie Chart Kualitas Tahfidz */}
            <div className="container-base bg-card relative">
              <div className="title-card mb-4">
                <div className="title-card-icon bg-primary/10">
                  <BarChart3 className="text-primary" />
                </div>
                <h3>Rata-rata Kualitas Tahfidz Bulan Ini</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6">
                <StatCard title="Setoran Hari Ini" value={isLoading ? "-" : `${stats.setoranHariIni}/${stats.totalSantri}`} icon={Users} animationDelay={0} />
                <StatCard title="Total Ziyadah" value={isLoading ? "-" : stats.totalZiyadah} icon={BookOpen} animationDelay={100} />
                <StatCard title="Total Murojaah" value={isLoading ? "-" : stats.totalMurojaah} icon={CheckCircle} animationDelay={200} />
                <StatCard title="Total Tahsin" value={isLoading ? "-" : stats.totalTahsin} icon={Mic2} animationDelay={300} />
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="relative h-[180px] w-[180px] md:h-[240px] md:w-[240px] lg:h-[280px] lg:w-[280px] flex-shrink-0 select-none" style={{ WebkitTapHighlightColor: "transparent" }}>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : chartData.length > 0 && chartData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="42%"
                          outerRadius="70%"
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                          cornerRadius={6}
                          style={{ outline: "none" }}
                          tabIndex={-1}
                          activeIndex={activeChartIndex}
                          activeShape={(props: any) => (
                            <Sector
                              cx={props.cx}
                              cy={props.cy}
                              innerRadius={props.innerRadius - 2}
                              outerRadius={props.outerRadius + 6}
                              startAngle={props.startAngle}
                              endAngle={props.endAngle}
                              fill={props.fill}
                              stroke="none"
                              style={{ outline: "none" }}
                              cornerRadius={8}
                            />
                          )}
                          onMouseEnter={(_, index) => setActiveChartIndex(index)}
                          onMouseLeave={() => setActiveChartIndex(undefined)}
                          onClick={(_, index) => {
                            setSelectedChartSegment(chartData[index]);
                            setActiveChartIndex(index);
                          }}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer" style={{ outline: "none" }} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Belum ada data
                    </div>
                  )}
                  
                  {!isLoading && chartData.some(d => d.value > 0) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">{avgNilai}</span>
                        <span className="text-[9px] md:text-[10px] lg:text-xs text-muted-foreground font-medium">Rata-rata</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6">
                  {chartData.map((item, index) => (
                    <button
                      key={item.name}
                      onClick={() => { setSelectedChartSegment(item); setActiveChartIndex(index); }}
                      onMouseEnter={() => setActiveChartIndex(index)}
                      onMouseLeave={() => setActiveChartIndex(undefined)}
                      className={cn(
                        "flex items-center gap-1 sm:gap-1.5 transition-all duration-200 px-2 py-1 rounded-lg",
                        activeChartIndex === index ? "scale-105 bg-muted" : "opacity-70 hover:opacity-100"
                      )}
                    >
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{item.name}</span>
                      <span className="text-xs sm:text-sm font-semibold" style={{ color: item.color }}>{item.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Detail Popup */}
              {selectedChartSegment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedChartSegment(null)}>
                  <div className="relative w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 md:p-5" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${selectedChartSegment.color} 15%, transparent), transparent)` }}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: selectedChartSegment.color }}>
                            <span className="text-xl font-bold text-white">{selectedChartSegment.value}</span>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-foreground">{selectedChartSegment.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {selectedChartSegment.trend === "up" && <><TrendingUp className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-green-500 font-medium">+{selectedChartSegment.change}% dari bulan lalu</span></>}
                              {selectedChartSegment.trend === "down" && <><TrendingDown className="w-3.5 h-3.5 text-red-500" /><span className="text-xs text-red-500 font-medium">{selectedChartSegment.change}% dari bulan lalu</span></>}
                              {selectedChartSegment.trend === "stable" && <><Minus className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Stabil dari bulan lalu</span></>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setSelectedChartSegment(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="px-4 md:px-5 pb-3">
                      <p className="text-sm text-muted-foreground">{selectedChartSegment.description}</p>
                    </div>
                    {selectedChartSegment.details.length > 0 && (
                      <div className="px-4 md:px-5 pb-4 md:pb-5 space-y-2">
                        {selectedChartSegment.details.map((detail, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                            <span className="text-sm text-muted-foreground">{detail.label}</span>
                            <span className="text-sm font-semibold text-foreground">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-4 md:px-5 pb-4 md:pb-5">
                      <Button className="w-full" variant="outline" onClick={() => setSelectedChartSegment(null)}>Tutup</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Butuh Perhatian */}
            <div className="container-base overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4 text-destructive" />
                  </div>
                  <h3 className="text-sm md:text-base font-semibold text-foreground">Butuh Perhatian</h3>
                </div>
              </div>
              
              <Tabs defaultValue="tidak-hadir" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-10 md:h-11 rounded-xl bg-muted/50 mb-4">
                  <TabsTrigger value="tidak-hadir" className="text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5 md:gap-2 rounded-lg">
                    <span className="hidden sm:inline">Tidak Hadir</span>
                    <span className="sm:hidden">Absen</span>
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] md:min-w-[22px] md:h-[22px] rounded-full bg-destructive/15 text-destructive text-[10px] md:text-xs font-semibold">
                      {isLoading ? "-" : santriTidakHadir.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="perlu-bimbingan" className="text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5 md:gap-2 rounded-lg">
                    Bimbingan
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] md:min-w-[22px] md:h-[22px] rounded-full bg-orange-100 text-orange-600 text-[10px] md:text-xs font-semibold">
                      {santriPerluBimbingan.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tidak-hadir" className="mt-0 animate-fade-in">
                  <div className="space-y-2 md:space-y-3">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : santriTidakHadir.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <span className="text-sm md:text-base">Semua santri sudah setor hari ini</span>
                      </div>
                    ) : (
                      <>
                        {(showAllTidakHadir ? santriTidakHadir : santriTidakHadir.slice(0, INITIAL_DISPLAY_LIMIT)).map((santri, index) => (
                          <div key={santri.id} className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-xl bg-gradient-to-r from-destructive/5 to-transparent border border-destructive/10 hover:border-destructive/20 transition-all duration-200 cursor-pointer group" style={{ animationDelay: `${index * 50}ms` }}>
                            <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-destructive/10">
                              <AvatarImage src={santri.avatar || undefined} />
                              <AvatarFallback className="bg-destructive/10 text-destructive text-[10px] md:text-xs font-medium">
                                {santri.nama.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-medium text-foreground truncate group-hover:text-destructive transition-colors">{santri.nama}</p>
                              <p className="text-[10px] md:text-xs text-muted-foreground">{santri.kelas || "-"}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm md:text-base font-bold text-destructive">{santri.hariSejak === 999 ? "∞" : santri.hariSejak}</span>
                              <span className="text-[9px] md:text-[10px] text-muted-foreground">hari</span>
                            </div>
                          </div>
                        ))}
                        {santriTidakHadir.length > INITIAL_DISPLAY_LIMIT && (
                          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowAllTidakHadir(!showAllTidakHadir)}>
                            {showAllTidakHadir ? "Tampilkan lebih sedikit" : `Lihat selengkapnya (${santriTidakHadir.length - INITIAL_DISPLAY_LIMIT} lainnya)`}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="perlu-bimbingan" className="mt-0 animate-fade-in">
                  <div className="space-y-2 md:space-y-3">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : santriPerluBimbingan.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center px-4">
                        <span className="text-sm md:text-base mb-1">Tidak ada santri yang perlu bimbingan</span>
                        <span className="text-xs text-muted-foreground/70">Santri akan muncul di sini jika mendapat status "Ulang" 3 kali berturut-turut</span>
                      </div>
                    ) : (
                      <>
                        {(showAllPerluBimbingan ? santriPerluBimbingan : santriPerluBimbingan.slice(0, INITIAL_DISPLAY_LIMIT)).map((santri, index) => (
                          <div key={santri.id} className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-xl bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/10 hover:border-orange-500/20 transition-all duration-200 cursor-pointer group" style={{ animationDelay: `${index * 50}ms` }}>
                            <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-orange-500/10">
                              <AvatarImage src={santri.avatar || undefined} />
                              <AvatarFallback className="bg-orange-500/10 text-orange-600 text-[10px] md:text-xs font-medium">
                                {santri.nama.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-medium text-foreground truncate group-hover:text-orange-600 transition-colors">{santri.nama}</p>
                              <p className="text-[10px] md:text-xs text-muted-foreground">{santri.kelas || "-"} • {santri.lastMateri}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm md:text-base font-bold text-orange-600">{santri.jumlahUlang}x</span>
                              <span className="text-[9px] md:text-[10px] text-muted-foreground">ulang</span>
                            </div>
                          </div>
                        ))}
                        {santriPerluBimbingan.length > INITIAL_DISPLAY_LIMIT && (
                          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowAllPerluBimbingan(!showAllPerluBimbingan)}>
                            {showAllPerluBimbingan ? "Tampilkan lebih sedikit" : `Lihat selengkapnya (${santriPerluBimbingan.length - INITIAL_DISPLAY_LIMIT} lainnya)`}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Finalization Section */}
          <TahfidzFinalizationSection
            overrideAcademicYearId={semesterFilter === "aktif" ? null : filterTahunAjaranId}
            overrideSemester={semesterFilter === "aktif" ? null : filterSemester}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
