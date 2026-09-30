import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, FileQuestion, Save, X, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Card/CardContent might be used later for styling changes
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  UjianPelaksanaanTab,
  UjianSoalTab,
  UjianPesertaTab,
  UjianNilaiTab,
  UjianDetailHeader,
  // UjianInfoCard removed - might be used later
  UjianMonitorTab,
} from '@/components/ujian';
import type { PelaksanaanFormData } from '@/components/ujian/UjianPelaksanaanTab';
import {
  useUjianDetail,
  useUjianSoal,
  useUjianPeserta,
  useUjianNilai,
  useCreateUjian,
  useUpdateUjian,
  useCreateSoal,
  useUpdateSoal,
  useDeleteSoal,
  useSavePeserta,
  useAutoEndExpiredExams,
} from '@/hooks/useUjian';

interface AdminUjianDetailProps {
  basePath?: string;
}

// Component for admin ujian detail management
export default function AdminUjianDetail({ basePath = '/admin/ujian' }: AdminUjianDetailProps) {
  const { ujianId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !ujianId || ujianId === 'baru';
  const initialTab = searchParams.get('tab') || 'pelaksanaan';

  // Tab state (controlled)
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Time up dialog state
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);

  // Queries
  const { data: ujian, isLoading: ujianLoading } = useUjianDetail(isNew ? undefined : ujianId);
  const { data: soalList = [] } = useUjianSoal(isNew ? undefined : ujianId);
  const { data: pesertaList = [] } = useUjianPeserta(isNew ? undefined : ujianId);
  const { data: nilaiData } = useUjianNilai(isNew ? undefined : ujianId);

  // Mutations
  const createUjian = useCreateUjian();
  const updateUjian = useUpdateUjian();
  const createSoal = useCreateSoal();
  const updateSoal = useUpdateSoal();
  const deleteSoal = useDeleteSoal();
  const savePeserta = useSavePeserta();
  const autoEndExpiredExams = useAutoEndExpiredExams();

  const extractKelasNumber = (tingkat?: string | null) => {
    if (!tingkat) return undefined;
    const match = tingkat.match(/\d+/);
    return match ? parseInt(match[0], 10) : undefined;
  };

  // Lifted state for Pelaksanaan form
  const [pelaksanaanData, setPelaksanaanData] = useState<PelaksanaanFormData>({
    jenis: '',
    mapelId: '',
    tanggal: undefined,
    durasiMenit: '0',
    ruangan: '',
    pengawasId: '',
    aiGradingEnabled: true,
  });

  // Lifted state for Peserta selection
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<string>>(new Set());

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Track if initial load is done
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPesertaInitialized, setIsPesertaInitialized] = useState(false);

  // Stats for info card
  const stats = useMemo(() => ({
    totalSoal: soalList.length,
    totalPeserta: pesertaList.length,
    sudahMengerjakan: 0, // TODO: implement when jawaban tracking is added
  }), [soalList.length, pesertaList.length]);

  // Original data for comparison (memoized to prevent re-computation)
  const originalPelaksanaanData = useMemo(() => {
    if (!ujian) return null;
    return {
      jenis: ujian.jenis,
      mapelId: ujian.mapel_id,
      tanggal: ujian.tanggal_pelaksanaan,
      durasiMenit: ujian.durasi_menit != null ? String(ujian.durasi_menit) : '0',
      ruangan: ujian.ruangan || '',
      pengawasId: ujian.pengawas_id || '',
      aiGradingEnabled: ujian.ai_grading_enabled ?? true,
    };
  }, [ujian]);

  const originalPesertaIds = useMemo(() => {
    return new Set(pesertaList.map(p => p.santri_id));
  }, [pesertaList]);

  // Initialize form data from ujian
  useEffect(() => {
    if (ujian && !isInitialized) {
      setPelaksanaanData({
        jenis: ujian.jenis,
        mapelId: ujian.mapel_id,
        tanggal: ujian.tanggal_pelaksanaan ? new Date(ujian.tanggal_pelaksanaan) : undefined,
        durasiMenit: ujian.durasi_menit != null ? String(ujian.durasi_menit) : '0',
        ruangan: ujian.ruangan || '',
        pengawasId: ujian.pengawas_id || '',
        aiGradingEnabled: ujian.ai_grading_enabled ?? true,
      });
      setIsInitialized(true);
    }
  }, [ujian, isInitialized]);

  // Initialize peserta ids
  useEffect(() => {
    if (pesertaList.length > 0 && !isPesertaInitialized) {
      const ids = new Set(pesertaList.map(p => p.santri_id));
      setSelectedSantriIds(ids);
      setIsPesertaInitialized(true);
    }
  }, [pesertaList, isPesertaInitialized]);

  // Auto-end expired exams on page load when exam is 'berlangsung'
  useEffect(() => {
    if (ujian?.status === 'berlangsung') {
      autoEndExpiredExams.mutate();
      setActiveTab('monitor');
    } else if (ujian?.status === 'selesai') {
      setActiveTab('nilai');
    }
  }, [ujian?.status]);

  // Handle time up callback from monitor tab
  const handleTimeUp = useCallback(() => {
    setShowTimeUpDialog(true);
  }, []);

  // Handle time up dialog confirmation
  const handleTimeUpConfirm = useCallback(() => {
    setShowTimeUpDialog(false);
    setActiveTab('nilai');
  }, []);

  // Handle pelaksanaan data change
  const handlePelaksanaanChange = (data: PelaksanaanFormData) => {
    setPelaksanaanData(data);
  };

  // Handle peserta selection change
  const handlePesertaChange = (ids: Set<string>) => {
    setSelectedSantriIds(ids);
  };

  // Computed: Check if pelaksanaan data has changed
  const hasFormChanged = useMemo(() => {
    if (!originalPelaksanaanData || !isInitialized) return false;
    
    const currentTanggal = pelaksanaanData.tanggal 
      ? format(pelaksanaanData.tanggal, 'yyyy-MM-dd')
      : null;
    
    return (
      pelaksanaanData.jenis !== originalPelaksanaanData.jenis ||
      pelaksanaanData.mapelId !== originalPelaksanaanData.mapelId ||
      currentTanggal !== originalPelaksanaanData.tanggal ||
      pelaksanaanData.durasiMenit !== originalPelaksanaanData.durasiMenit ||
      pelaksanaanData.ruangan !== originalPelaksanaanData.ruangan ||
      pelaksanaanData.pengawasId !== originalPelaksanaanData.pengawasId
    );
  }, [pelaksanaanData, originalPelaksanaanData, isInitialized]);

  // Computed: Check if peserta selection has changed
  const hasPesertaChanged = useMemo(() => {
    if (!isPesertaInitialized) return false;
    if (selectedSantriIds.size !== originalPesertaIds.size) return true;
    for (const id of selectedSantriIds) {
      if (!originalPesertaIds.has(id)) return true;
    }
    return false;
  }, [selectedSantriIds, originalPesertaIds, isPesertaInitialized]);

  // Combined hasChanges
  const hasChanges = !isNew && (hasFormChanged || hasPesertaChanged);

  const handleDiscardChanges = () => {
    // Reset pelaksanaan form to original ujian data
    if (ujian) {
      setPelaksanaanData({
        jenis: ujian.jenis,
        mapelId: ujian.mapel_id,
        tanggal: ujian.tanggal_pelaksanaan ? new Date(ujian.tanggal_pelaksanaan) : undefined,
        durasiMenit: ujian.durasi_menit != null ? String(ujian.durasi_menit) : '0',
        ruangan: ujian.ruangan || '',
        pengawasId: ujian.pengawas_id || '',
        aiGradingEnabled: ujian.ai_grading_enabled ?? true,
      });
    }
    // Reset peserta to original list
    setSelectedSantriIds(new Set(originalPesertaIds));
  };

  const handleSaveAll = async () => {
    if (!ujianId || isNew) return;

    if (!pelaksanaanData.mapelId || !pelaksanaanData.jenis || !pelaksanaanData.tanggal) {
      toast.error('Lengkapi data pelaksanaan ujian (Jenis, Mapel, Tanggal)');
      return;
    }

    setIsSaving(true);
    try {
      await updateUjian.mutateAsync({
        id: ujianId,
        mapel_id: pelaksanaanData.mapelId,
        jenis: pelaksanaanData.jenis,
        tanggal_pelaksanaan: format(pelaksanaanData.tanggal, 'yyyy-MM-dd'),
        durasi_menit: pelaksanaanData.durasiMenit === '0' ? null : parseInt(pelaksanaanData.durasiMenit, 10),
        ruangan: pelaksanaanData.ruangan || undefined,
        pengawas_id: pelaksanaanData.pengawasId || undefined,
        ai_grading_enabled: pelaksanaanData.aiGradingEnabled,
      });

      await savePeserta.mutateAsync({
        ujianId,
        santriIds: Array.from(selectedSantriIds),
      });

      // After save, React Query will refetch and hasChanges will compute to false automatically
      toast.success('Semua perubahan berhasil disimpan');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateUjian = async () => {
    if (!pelaksanaanData.mapelId || !pelaksanaanData.jenis || !pelaksanaanData.tanggal) {
      toast.error('Lengkapi data pelaksanaan ujian (Jenis, Mapel, Tanggal)');
      return;
    }

    if (selectedSantriIds.size === 0) {
      toast.error('Pilih minimal 1 peserta ujian');
      return;
    }

    try {
      // Create ujian first
      const result = await createUjian.mutateAsync({
        mapel_id: pelaksanaanData.mapelId,
        jenis: pelaksanaanData.jenis,
        tanggal_pelaksanaan: format(pelaksanaanData.tanggal, 'yyyy-MM-dd'),
        durasi_menit: pelaksanaanData.durasiMenit === '0' ? null : parseInt(pelaksanaanData.durasiMenit, 10),
        ruangan: pelaksanaanData.ruangan || undefined,
        pengawas_id: pelaksanaanData.pengawasId || undefined,
        ai_grading_enabled: pelaksanaanData.aiGradingEnabled,
      });

      // Then save peserta
      await savePeserta.mutateAsync({
        ujianId: result.id,
        santriIds: Array.from(selectedSantriIds),
      });

      toast.success('Ujian berhasil dibuat! Silakan tambahkan soal.');
      // Navigate to soal tab
      navigate(`${basePath}/${result.id}?tab=soal`, { replace: true });
    } catch (error) {
      console.error('Error creating ujian:', error);
      toast.error('Gagal membuat ujian');
    }
  };

  const handleCreateSoal = (data: any) => {
    if (ujianId && !isNew) {
      createSoal.mutate(data);
    }
  };

  const handleUpdateSoal = (data: any) => {
    updateSoal.mutate(data);
  };

  const handleDeleteSoal = (id: string) => {
    if (ujianId) {
      deleteSoal.mutate({ id, ujianId });
    }
  };

  if (!isNew && ujianLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // New Ujian Form - Step based
  if (isNew) {
    return (
      <div className="space-y-6 animate-fade-in pb-32">
        {/* Simple Header for New */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/10 border border-primary/20 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(basePath)} className="shrink-0 bg-background/50 hover:bg-background/80">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground">
              <FileQuestion className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tambah Ujian Baru</h1>
              <p className="text-sm text-foreground/70">Isi data pelaksanaan dan pilih peserta ujian</p>
            </div>
          </div>
        </div>

        {/* Pelaksanaan Section */}
        <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-muted/30">
            <h3 className="font-semibold text-foreground">Atur Ujian</h3>
          </div>
          <div className="p-6">
            <UjianPelaksanaanTab
              ujian={null}
              value={pelaksanaanData}
              onChange={setPelaksanaanData}
            />
          </div>
        </div>

        {/* Peserta Section */}
        <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-muted/30">
            <h3 className="font-semibold text-foreground">Pilih Peserta</h3>
          </div>
          <div className="p-6">
            <UjianPesertaTab
              ujianId=""
              kelasId={undefined}
              pesertaList={[]}
              selectedIds={selectedSantriIds}
              onSelectedIdsChange={setSelectedSantriIds}
            />
          </div>
        </div>

        {/* Fixed Bottom Bar */}
        <div className="fixed left-0 right-0 bg-background border-t shadow-lg z-[60] bottom-[calc(4rem+env(safe-area-inset-bottom))]">
          <div className="container mx-auto p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedSantriIds.size > 0 
                ? `${selectedSantriIds.size} peserta terpilih` 
                : 'Lengkapi data ujian dan pilih peserta'}
            </p>
            <Button 
              onClick={handleCreateUjian} 
              disabled={createUjian.isPending || savePeserta.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {createUjian.isPending || savePeserta.isPending ? 'Menyimpan...' : 'Buat Ujian & Lanjut ke Soal'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle start exam
  const handleStartExam = async () => {
    if (!ujianId) return;
    try {
      // Set status to 'berlangsung' and record the actual start time
      await updateUjian.mutateAsync({ 
        id: ujianId, 
        status: 'berlangsung',
        waktu_mulai: new Date().toISOString(),
      });
      toast.success('Ujian berhasil dimulai');
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Handle end exam
  const handleEndExam = async () => {
    if (!ujianId) return;
    try {
      await updateUjian.mutateAsync({ id: ujianId, status: 'selesai' });
      toast.success('Ujian berhasil diakhiri');
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Check if editing is disabled (exam in progress or completed)
  const isEditDisabled = ujian?.status === 'berlangsung' || ujian?.status === 'selesai';

  // Existing Ujian Detail
  return (
    <div className={`space-y-6 animate-fade-in ${!isEditDisabled ? 'pb-32' : ''}`}>
      {/* Header */}
      {ujian && (
        <UjianDetailHeader
          ujian={ujian}
          onBack={() => navigate(basePath)}
          onStartExam={handleStartExam}
          onEndExam={handleEndExam}
          totalSoal={stats.totalSoal}
          totalPeserta={stats.totalPeserta}
        />
      )}

      {/* Read-only notice */}
      {isEditDisabled && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <FileQuestion className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {ujian?.status === 'berlangsung' ? 'Ujian Sedang Berlangsung' : 'Ujian Telah Selesai'}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Data ujian tidak dapat diubah saat ujian {ujian?.status === 'berlangsung' ? 'berlangsung' : 'sudah selesai'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs Content */}
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="p-4 border-b border-border/50 bg-muted/30">
            <TabsList variant="admin" className={`grid ${ujian?.status === 'berlangsung' || ujian?.status === 'selesai' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="pelaksanaan" variant="admin">
                Atur Ujian
              </TabsTrigger>
              <TabsTrigger value="soal" variant="admin">
                Atur Soal
              </TabsTrigger>
              {ujian?.status === 'berlangsung' && (
                <TabsTrigger value="monitor" variant="admin">
                  Monitor Ujian
                </TabsTrigger>
              )}
              {ujian?.status === 'selesai' && (
                <TabsTrigger value="nilai" variant="admin">
                  Nilai
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="pelaksanaan" className="p-6 m-0 space-y-8">
            {/* Pelaksanaan Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Data Pelaksanaan</h3>
              <UjianPelaksanaanTab
                ujian={ujian}
                value={pelaksanaanData}
                onChange={handlePelaksanaanChange}
                disabled={isEditDisabled}
              />
            </div>
            
            {/* Peserta Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Peserta Ujian</h3>
              <UjianPesertaTab
                ujianId={ujianId!}
                kelasId={ujian?.mapel?.kelas?.id}
                pesertaList={pesertaList}
                selectedIds={selectedSantriIds}
                onSelectedIdsChange={handlePesertaChange}
                disabled={isEditDisabled}
              />
            </div>
          </TabsContent>

          <TabsContent value="soal" className="p-6 m-0">
            <UjianSoalTab
              soalList={soalList}
              ujianId={ujianId!}
              onCreateSoal={handleCreateSoal}
              onUpdateSoal={handleUpdateSoal}
              onDeleteSoal={handleDeleteSoal}
              loading={createSoal.isPending || updateSoal.isPending}
              disabled={isEditDisabled}
              aiGradingEnabled={pelaksanaanData.aiGradingEnabled}
              onAiGradingChange={(enabled) => setPelaksanaanData(prev => ({ ...prev, aiGradingEnabled: enabled }))}
              aiGeneratorDefaults={{
                mata_pelajaran: ujian?.mapel?.nama || '',
                kelas: extractKelasNumber(ujian?.mapel?.kelas?.tingkat),
                bentuk_asesmen:
                  ujian?.jenis === 'harian'
                    ? 'UH'
                    : ujian?.jenis === 'uts'
                      ? 'PTS'
                      : ujian?.jenis === 'uas'
                        ? 'PAS'
                        : 'ASAT',
              }}
              aiGeneratorContext={{
                title: `AI Generator Soal ${ujian?.mapel?.nama || ''}`.trim(),
                description: `Draft soal akan disiapkan untuk ${ujian?.mapel?.nama || 'mapel ini'}${ujian?.mapel?.kelas?.nama ? ` di ${ujian.mapel.kelas.nama}` : ''}.`,
              }}
            />
          </TabsContent>

          {ujian?.status === 'berlangsung' && (
            <TabsContent value="monitor" className="p-6 m-0">
              <UjianMonitorTab
                ujianId={ujianId!}
                totalSoal={stats.totalSoal}
                waktuMulaiUjian={ujian?.waktu_mulai}
                durasiMenit={ujian?.durasi_menit}
                onTimeUp={handleTimeUp}
              />
            </TabsContent>
          )}

          {ujian?.status === 'selesai' && (
            <TabsContent value="nilai" className="p-6 m-0">
              <UjianNilaiTab
                ujianId={ujianId!}
                status={ujian.status}
                peserta={nilaiData?.peserta || []}
                jawaban={nilaiData?.jawaban || []}
                soal={nilaiData?.soal || []}
                mapelNama={ujian.mapel?.nama}
                kelasNama={ujian.mapel?.kelas?.nama}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Fixed Bottom Bar - Only show when there are changes */}
      {!isEditDisabled && hasChanges && (
        <div className="fixed left-0 right-0 bg-background border-t shadow-lg z-[60] bottom-[calc(4rem+env(safe-area-inset-bottom))]">
          <div className="container mx-auto p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Anda memiliki perubahan yang belum disimpan
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDiscardChanges}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Batalkan
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Time Up Dialog */}
      <AlertDialog open={showTimeUpDialog} onOpenChange={setShowTimeUpDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-7 w-7 text-primary" />
            </div>
            <AlertDialogTitle className="text-center">Waktu Ujian Habis!</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Waktu pengerjaan ujian telah berakhir. Semua jawaban santri telah otomatis disimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={handleTimeUpConfirm} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Lihat Hasil Nilai
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
