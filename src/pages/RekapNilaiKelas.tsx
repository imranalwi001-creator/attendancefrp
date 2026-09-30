import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
// ScrollArea is used inside RekapNilaiMapelSidebar
import { ArrowLeft, FileText, BookOpen, ChevronDown, Send, EyeOff, CheckCircle, XCircle, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { RekapNilaiMapelSidebar } from '@/components/penilaian/RekapNilaiMapelSidebar';

interface MapelNilai {
  mapel_id: string;
  mapel_nama: string;
  kode_mapel: string;
  pengampu_nama: string;
  is_finalized: boolean;
  finalized_count: number;
  total_santri: number;
  santri_data: Array<{
    santri_id: string;
    santri_nama: string;
    nilai_rapor: number | null;
    capaian_kompetensi: string;
  }>;
}

export default function RekapNilaiKelas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getCurrentSemester, activeAcademicYear } = useAcademicYear();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentSemester = getCurrentSemester();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Fetch kelas data
  const { data: kelas, isLoading: kelasLoading } = useQuery({
    queryKey: ['rekap-kelas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, walikelas_id')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch finalization status
  const { data: finalizationData } = useQuery({
    queryKey: ['raport-finalization', id, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!id || !activeAcademicYear?.id || !currentSemester) return null;
      
      const { data, error } = await supabase
        .from('raport_finalization')
        .select('id, is_finalized, finalized_at')
        .eq('kelas_id', id)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!activeAcademicYear?.id && !!currentSemester
  });

  const isPublished = finalizationData?.is_finalized ?? false;

  // Mutation for publish/unpublish
  const publishMutation = useMutation({
    mutationFn: async (shouldPublish: boolean) => {
      const { error } = await supabase
        .from('raport_finalization')
        .upsert({
          kelas_id: id,
          academic_year_id: activeAcademicYear?.id,
          semester: currentSemester,
          is_finalized: shouldPublish,
          finalized_at: shouldPublish ? new Date().toISOString() : null,
          finalized_by: shouldPublish ? user?.id : null
        }, { onConflict: 'kelas_id,academic_year_id,semester' });
      
      if (error) throw error;
    },
    onSuccess: (_, shouldPublish) => {
      queryClient.invalidateQueries({ queryKey: ['raport-finalization', id] });
      toast({
        title: shouldPublish ? 'Raport Dipublish' : 'Raport Di-unpublish',
        description: shouldPublish 
          ? 'Raport nilai akademik sekarang dapat dilihat oleh santri dan orang tua.'
          : 'Raport nilai akademik tidak lagi ditampilkan di dashboard.',
      });
      setShowPublishModal(false);
    },
    onError: () => {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan. Silakan coba lagi.',
        variant: 'destructive',
      });
    }
  });

  const { data: mapelNilaiList = [], isLoading: mapelLoading } = useQuery({
    queryKey: ['rekap-mapel-nilai', id],
    queryFn: async () => {
      // Fetch all mapel for this kelas - filter akademik (exclude asrama/Asrama categories)
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select(`id, nama, kode_mapel, kategori, pengampu:profiles!mapel_pengampu_id_fkey(id, name)`)
        .eq('kelas_id', id)
        .eq('status', 'aktif')
        .neq('kategori', 'asrama')
        .order('nama');

      if (mapelError) throw mapelError;

      // For each mapel, get finalized assessments
      const mapelWithNilai = await Promise.all(
        (mapelData || []).map(async (mapel) => {
          const { data: asesmenData } = await supabase
            .from('asesmen_sumatif')
            .select('santri_id, nilai_rapor, is_finalized')
            .eq('mapel_id', mapel.id);

          const totalAssessments = asesmenData?.length || 0;
          const finalizedCount = asesmenData?.filter((a) => a.is_finalized).length || 0;
          const isFullyFinalized = totalAssessments > 0 && finalizedCount === totalAssessments;

          let santriWithNilai: Array<{
            santri_id: string;
            santri_nama: string;
            nilai_rapor: number | null;
            capaian_kompetensi: string;
          }> = [];

          if (finalizedCount > 0 && asesmenData) {
            const finalizedAsesmenData = asesmenData.filter((a) => a.is_finalized);
            const { data: formatifData } = await supabase
              .from('asesmen_formatif')
              .select('santri_id, deskripsi_tertinggi, deskripsi_terendah, tp_assessments')
              .eq('mapel_id', mapel.id);

            const santriIds = finalizedAsesmenData.map((a) => a.santri_id);
            
            // Only fetch if we have valid IDs
            const { data: santriData } = santriIds.length > 0 
              ? await supabase.from('profiles').select('id, name').in('id', santriIds)
              : { data: [] };

            santriWithNilai = finalizedAsesmenData.map((asesmen) => {
              const santri = santriData?.find((s) => s.id === asesmen.santri_id);
              const formatif = formatifData?.find((f) => f.santri_id === asesmen.santri_id);

              let capaianKompetensi = '';
              if (formatif) {
                const tpAssessments = formatif.tp_assessments as Array<{
                  kktp: boolean;
                  tampil_rapor: boolean;
                }>;
                const hasInactiveKKTP = tpAssessments?.some((tp) => !tp.kktp && tp.tampil_rapor);
                const hasActiveKKTP = tpAssessments?.some((tp) => tp.kktp && tp.tampil_rapor);

                if (hasInactiveKKTP && formatif.deskripsi_terendah) {
                  capaianKompetensi = formatif.deskripsi_terendah;
                } else if (hasActiveKKTP && formatif.deskripsi_tertinggi) {
                  capaianKompetensi = formatif.deskripsi_tertinggi;
                }
              }

              return {
                santri_id: asesmen.santri_id,
                santri_nama: santri?.name || 'Unknown',
                nilai_rapor: asesmen.nilai_rapor,
                capaian_kompetensi: capaianKompetensi || '-',
              };
            });
          }

          return {
            mapel_id: mapel.id,
            mapel_nama: mapel.nama,
            kode_mapel: mapel.kode_mapel || '-',
            pengampu_nama: (mapel.pengampu as any)?.profiles?.name || '-',
            is_finalized: isFullyFinalized,
            finalized_count: finalizedCount,
            total_santri: totalAssessments,
            santri_data: santriWithNilai,
          };
        })
      );

      return mapelWithNilai as MapelNilai[];
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const loading = kelasLoading || mapelLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        {/* Content Skeleton */}
        <Card className="rounded-2xl">
          <CardHeader className="border-b">
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kelas) {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground mb-4">Kelas tidak ditemukan</p>
            <Button
              variant="outline"
              className="rounded-xl bg-background border-primary/30 shadow-sm hover:bg-primary/10 hover:border-primary/50"
              onClick={() => navigate('/admin/penilaian')}
            >
              <ArrowLeft className="h-4 w-4 mr-2 text-primary" />
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Primary Background - matching MapelDetail */}
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(`/admin/penilaian/kelas/${id}`)}
              className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-white truncate">Rekap Nilai Akademik</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-white/80">
                  {kelas.nama}
                </span>
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  {kelas.tahun_ajaran}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowPublishModal(true)}
            disabled={publishMutation.isPending}
            className={isPublished 
              ? "bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5 text-xs h-8 px-3 shadow-lg shrink-0" 
              : "bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1.5 text-xs h-8 px-3 shadow-lg shrink-0"
            }
          >
            {isPublished ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Unpublish
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Publish/Unpublish Confirmation Modal */}
      <AlertDialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {isPublished ? (
                <div className="p-2 rounded-xl bg-amber-100">
                  <XCircle className="h-6 w-6 text-amber-600" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
              )}
              <AlertDialogTitle className="text-lg">
                {isPublished ? 'Konfirmasi Unpublish Raport' : 'Konfirmasi Publish Raport'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground">
              {isPublished 
                ? 'Apakah Anda yakin ingin unpublish raport ini? Raport tidak akan ditampilkan di dashboard santri dan orang tua.'
                : 'Apakah Anda yakin ingin mempublish raport nilai akademik kelas ini? Raport akan ditampilkan di dashboard santri dan orang tua.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishMutation.mutate(!isPublished)}
              disabled={publishMutation.isPending}
              className={isPublished 
                ? "bg-amber-500 hover:bg-amber-600 rounded-xl" 
                : "bg-emerald-500 hover:bg-emerald-600 rounded-xl"
              }
            >
              {publishMutation.isPending ? 'Memproses...' : (isPublished ? 'Ya, Unpublish' : 'Ya, Publish')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mapelNilaiList.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-muted/50 mb-4">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <p className="text-base font-medium text-muted-foreground mb-2">Belum ada mata pelajaran</p>
            <p className="text-sm text-muted-foreground/70">Tambahkan mata pelajaran untuk kelas ini terlebih dahulu</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab || mapelNilaiList[0]?.mapel_id} onValueChange={setActiveTab} className="w-full">
          {/* Mobile Dropdown - shown only on mobile */}
          <div className="lg:hidden mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between rounded-xl h-12 px-4 gap-2 border-border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium truncate">
                      {mapelNilaiList.find((m) => m.mapel_id === activeTab)?.mapel_nama || 'Pilih Mata Pelajaran'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-w-md rounded-xl p-2">
                {mapelNilaiList.map((mapel) => (
                  <DropdownMenuItem 
                    key={mapel.mapel_id} 
                    onClick={() => setActiveTab(mapel.mapel_id)}
                    className={`rounded-lg px-3 py-3 ${activeTab === mapel.mapel_id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4" />
                      <span>{mapel.mapel_nama}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: Sidebar + Content side by side */}
          <div className="flex gap-6 items-start">
            {/* Sidebar with TabsList inside */}
            <RekapNilaiMapelSidebar items={mapelNilaiList} />

            {/* Content Area - Tabel Penilaian */}
            <div className="flex-1 min-w-0 w-full lg:w-auto">
              {mapelNilaiList.map((mapel) => (
                <TabsContent key={mapel.mapel_id} value={mapel.mapel_id} className="mt-0 lg:mt-0">
                  <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
                    {/* Enhanced Header with Gradient */}
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent" />
                      <CardHeader className="relative py-3 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10">
                              <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold">{mapel.mapel_nama}</CardTitle>
                              <CardDescription className="flex items-center gap-1.5 text-xs">
                                <Users className="h-3 w-3" />
                                Pengampu: {mapel.pengampu_nama}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {mapel.is_finalized ? (
                              <Badge variant="success" className="px-3 py-1 text-xs font-medium">
                                ✓ Finalisasi Lengkap
                              </Badge>
                            ) : mapel.finalized_count > 0 ? (
                              <Badge variant="warning" className="px-3 py-1 text-xs font-medium">
                                {mapel.finalized_count}/{mapel.total_santri} Santri Dinilai
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                                Menunggu Penilaian
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </div>

                    <CardContent className="p-5 sm:p-6">
                      {/* Table Content */}
                      {mapel.finalized_count > 0 ? (
                        <div className="rounded-xl border overflow-hidden shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="w-[60px] text-center font-semibold">No</TableHead>
                                <TableHead className="min-w-[180px] font-semibold">Nama Santri</TableHead>
                                <TableHead className="text-center w-[120px] font-semibold">Nilai Rapor</TableHead>
                                <TableHead className="font-semibold">Capaian Kompetensi</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mapel.santri_data.map((santri, index) => (
                                <TableRow key={santri.santri_id} className="hover:bg-muted/30 transition-colors">
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold">
                                      {index + 1}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-medium">{santri.santri_nama}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge 
                                      variant="outline" 
                                      className={`font-bold text-base px-3 py-1 ${
                                        (santri.nilai_rapor || 0) >= 80 
                                          ? 'border-emerald-500/50 text-emerald-600 bg-emerald-50' 
                                          : (santri.nilai_rapor || 0) >= 70 
                                            ? 'border-primary/50 text-primary bg-primary/5' 
                                            : 'border-amber-500/50 text-amber-600 bg-amber-50'
                                      }`}
                                    >
                                      {santri.nilai_rapor?.toFixed(0) || '-'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                      {santri.capaian_kompetensi || '-'}
                                    </p>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        /* Enhanced Empty State */
                        <div className="relative overflow-hidden rounded-2xl bg-card">
                          <div className="relative flex flex-col items-center justify-center py-16 px-6 text-center">
                            {/* Illustrated Icon */}
                            <div className="relative mb-6">
                              <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl scale-150" />
                              <div className="relative p-5 rounded-2xl bg-gradient-to-br from-muted to-muted/50 shadow-inner">
                                <FileText className="h-12 w-12 text-muted-foreground/40" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-100 border-2 border-background">
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                              </div>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              Belum Ada Nilai yang Difinalisasi
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-sm mb-6">
                              Nilai untuk mata pelajaran <span className="font-medium text-foreground">{mapel.mapel_nama}</span> belum tersedia. 
                              Guru pengampu perlu melakukan finalisasi nilai terlebih dahulu.
                            </p>
                            
                            {/* Info Cards */}
                            <div className="flex flex-wrap justify-center gap-3">
                              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/80 text-sm">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">{mapel.total_santri} Santri</span>
                              </div>
                              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/80 text-sm">
                                <FileText className="h-4 w-4 text-amber-600" />
                                <span className="text-amber-700 font-medium">0 Nilai Terfinalisasi</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      )}
    </div>
  );
}
