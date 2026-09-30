import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, FileText, BookOpen, ChevronDown, GraduationCap, CalendarDays, Users, Send, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { MainPageHeader } from '@/components/layout/MainPageHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import DataExportPanel from '@/components/ui/data-export-panel';
import { exportToPdf, exportToXlsx, type DataExportColumn } from '@/lib/dataExport';
import { useMemo } from 'react';

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

export default function RekapNilaiAkademikWalikelas() {
  const navigate = useNavigate();
  const { kelasId } = useParams<{ kelasId: string }>();
  const { getCurrentSemester, activeAcademicYear } = useAcademicYear();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentSemester = getCurrentSemester();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Fetch kelas data
  const { data: kelasData, isLoading: kelasLoading } = useQuery({
    queryKey: ['kelas-detail', kelasId],
    queryFn: async () => {
      if (!kelasId) return null;
      
      // Use explicit columns instead of select('*')
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, status, walikelas_id')
        .eq('id', kelasId)
        .single();
      
      if (error) throw error;
      
      const { count } = await supabase
        .from('santri')
        .select('id', { count: 'exact', head: true })
        .eq('kelas_id', kelasId);
      
      return { ...data, jumlah_santri: count || 0 };
    },
    enabled: !!kelasId,
  });

  const {
    data: mapelNilaiList = [],
    isLoading: mapelLoading
  } = useQuery({
    queryKey: ['rekap-mapel-nilai-walikelas', kelasData?.id],
    queryFn: async () => {
      if (!kelasData?.id) return [];
      
      // Fetch all mapel for this kelas - filter akademik (exclude asrama/Asrama categories)
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select(`id, nama, kode_mapel, kategori, pengampu:profiles!mapel_pengampu_id_fkey(id, name)`)
        .eq('kelas_id', kelasData.id)
        .eq('status', 'aktif')
        .neq('kategori', 'asrama')
        .order('nama');

      if (mapelError) throw mapelError;

      // For each mapel, get finalized assessments
      const mapelWithNilai = await Promise.all((mapelData || []).map(async mapel => {
        const { data: asesmenData } = await supabase
          .from('asesmen_sumatif')
          .select('santri_id, nilai_rapor, is_finalized')
          .eq('mapel_id', mapel.id);

        const totalAssessments = asesmenData?.length || 0;
        const finalizedCount = asesmenData?.filter(a => a.is_finalized).length || 0;
        const isFullyFinalized = totalAssessments > 0 && finalizedCount === totalAssessments;

        let santriWithNilai: Array<{
          santri_id: string;
          santri_nama: string;
          nilai_rapor: number | null;
          capaian_kompetensi: string;
        }> = [];

        if (finalizedCount > 0 && asesmenData) {
          const finalizedAsesmenData = asesmenData.filter(a => a.is_finalized);
          const { data: formatifData } = await supabase
            .from('asesmen_formatif')
            .select('santri_id, deskripsi_tertinggi, deskripsi_terendah, tp_assessments')
            .eq('mapel_id', mapel.id);

          const santriIds = finalizedAsesmenData.map(a => a.santri_id);
          const { data: santriData } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', santriIds);

          santriWithNilai = finalizedAsesmenData.map(asesmen => {
            const santri = santriData?.find(s => s.id === asesmen.santri_id);
            const formatif = formatifData?.find(f => f.santri_id === asesmen.santri_id);

            let capaianKompetensi = '';
            if (formatif) {
              const tpAssessments = formatif.tp_assessments as Array<{
                kktp: boolean;
                tampil_rapor: boolean;
              }>;
              const hasInactiveKKTP = tpAssessments?.some(tp => !tp.kktp && tp.tampil_rapor);
              const hasActiveKKTP = tpAssessments?.some(tp => tp.kktp && tp.tampil_rapor);
              
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
              capaian_kompetensi: capaianKompetensi || '-'
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
          santri_data: santriWithNilai
        };
      }));

      return mapelWithNilai as MapelNilai[];
    },
    enabled: !!kelasData?.id,
    staleTime: 2 * 60 * 1000
  });

  // Fetch finalization status
  const { data: finalizationData } = useQuery({
    queryKey: ['raport-finalization', kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!kelasId || !activeAcademicYear?.id || !currentSemester) return null;
      
      const { data, error } = await supabase
        .from('raport_finalization')
        .select('id, is_finalized, finalized_at')
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id && !!currentSemester
  });

  const isPublished = finalizationData?.is_finalized ?? false;

  // Mutation for publish/unpublish
  const publishMutation = useMutation({
    mutationFn: async (shouldPublish: boolean) => {
      const { error } = await supabase
        .from('raport_finalization')
        .upsert({
          kelas_id: kelasId,
          academic_year_id: activeAcademicYear?.id,
          semester: currentSemester,
          is_finalized: shouldPublish,
          finalized_at: shouldPublish ? new Date().toISOString() : null,
          finalized_by: shouldPublish ? user?.id : null
        }, { onConflict: 'kelas_id,academic_year_id,semester' });
      
      if (error) throw error;
    },
    onSuccess: (_, shouldPublish) => {
      queryClient.invalidateQueries({ queryKey: ['raport-finalization', kelasId] });
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

  const exportColumns = useMemo(() => {
    const cols: DataExportColumn[] = [
      { key: 'no', label: 'No.', width: 40 },
      { key: 'nama_santri', label: 'Nama Santri', width: 200 }
    ];
    mapelNilaiList.forEach(m => {
      cols.push({ key: `mapel_${m.mapel_id}`, label: m.mapel_nama, width: 100 });
    });
    return cols;
  }, [mapelNilaiList]);

  const exportData = useMemo(() => {
    // Collect all unique santri
    const santriMap = new Map<string, any>();
    mapelNilaiList.forEach(m => {
      m.santri_data.forEach(s => {
        if (!santriMap.has(s.santri_id)) {
          santriMap.set(s.santri_id, {
            id: s.santri_id,
            nama_santri: s.santri_nama
          });
        }
      });
    });

    // Build rows
    const rows = Array.from(santriMap.values()).sort((a, b) => a.nama_santri.localeCompare(b.nama_santri));
    
    return rows.map((r, i) => {
      const row: any = { no: i + 1, nama_santri: r.nama_santri };
      mapelNilaiList.forEach(m => {
        const santriScore = m.santri_data.find(s => s.santri_id === r.id);
        row[`mapel_${m.mapel_id}`] = santriScore?.nilai_rapor ?? '-';
      });
      return row;
    });
  }, [mapelNilaiList]);

  const loading = kelasLoading || mapelLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Memuat data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kelasData) {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Kelas tidak ditemukan</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/app/penilaian')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <MainPageHeader
        title="Rekap Nilai Akademik"
        backTo={`/app/penilaian/${kelasId}`}
        subtitle={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1 text-xs">
              <GraduationCap className="h-3 w-3" />
              {kelasData.nama}
            </Badge>
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1 text-xs">
              <CalendarDays className="h-3 w-3" />
              {kelasData.tahun_ajaran}
            </Badge>
            <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1 text-xs">
              <Users className="h-3 w-3" />
              {kelasData.jumlah_santri || 0} Santri
            </Badge>
            {currentSemester && (
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1 text-xs">
                Semester {currentSemester === 'ganjil' ? 'Ganjil' : 'Genap'}
              </Badge>
            )}
          </div>
        }
        actions={
          <Button
            size="sm"
            onClick={() => setShowPublishModal(true)}
            disabled={publishMutation.isPending}
            className={isPublished
              ? "bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5"
              : "bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1.5"
            }
          >
            {isPublished ? (
              <><EyeOff className="h-4 w-4" />Unpublish</>
            ) : (
              <><Send className="h-4 w-4" />Publish</>
            )}
          </Button>
        }
      />

      {mapelNilaiList.length > 0 && (
        <DataExportPanel
          data={exportData}
          columns={exportColumns}
          filename={`Rekap_Nilai_Akademik_${kelasData?.nama || 'Kelas'}`}
          title={`Rekap Nilai Akademik - Kelas ${kelasData?.nama || 'Kelas'}`}
          subtitle={`Tahun Ajaran ${kelasData?.tahun_ajaran || '-'} - Semester ${currentSemester === 'ganjil' ? 'Ganjil' : 'Genap'}`}
          exportToPdf={exportToPdf}
          exportToXlsx={exportToXlsx}
        />
      )}

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
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada mata pelajaran</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab || mapelNilaiList[0]?.mapel_id} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full gap-2 rounded-2xl bg-card border border-border p-2 shadow-sm h-auto mb-6 overflow-x-auto">
            {mapelNilaiList.slice(0, 2).map(mapel => (
              <TabsTrigger 
                key={mapel.mapel_id} 
                value={mapel.mapel_id} 
                className="flex-1 rounded-xl py-3 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium min-w-0"
              >
                <span className="font-medium truncate block text-xs sm:text-sm">{mapel.mapel_nama}</span>
              </TabsTrigger>
            ))}
            {mapelNilaiList.length > 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant={mapelNilaiList.slice(2).some(m => m.mapel_id === (activeTab || mapelNilaiList[0]?.mapel_id)) ? "default" : "outline"} 
                    className="rounded-xl py-3 px-4 h-auto font-medium text-xs sm:text-sm"
                  >
                    <span className="truncate">
                      {mapelNilaiList.slice(2).find(m => m.mapel_id === (activeTab || mapelNilaiList[0]?.mapel_id))?.mapel_nama || `+${mapelNilaiList.length - 2}`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {mapelNilaiList.slice(2).map(mapel => (
                    <DropdownMenuItem 
                      key={mapel.mapel_id} 
                      onClick={() => setActiveTab(mapel.mapel_id)}
                      className={activeTab === mapel.mapel_id ? "bg-primary/10 text-primary" : ""}
                    >
                      {mapel.mapel_nama}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TabsList>

          {mapelNilaiList.map(mapel => (
            <TabsContent key={mapel.mapel_id} value={mapel.mapel_id} className="mt-6">
              <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
                <CardHeader className="border-b bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{mapel.mapel_nama}</CardTitle>
                        <CardDescription className="mt-1">
                          <span>Pengampu: {mapel.pengampu_nama}</span>
                        </CardDescription>
                      </div>
                    </div>
                    {mapel.is_finalized ? (
                      <Badge variant="success" className="rounded-xl shadow-md">Finalisasi</Badge>
                    ) : mapel.finalized_count > 0 ? (
                      <Badge variant="warning" className="rounded-xl shadow-md">{mapel.finalized_count}/{mapel.total_santri} Dinilai</Badge>
                    ) : (
                      <Badge variant="pending" className="rounded-xl">Belum Dinilai</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {mapel.finalized_count > 0 ? (
                    <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-border bg-muted/50">
                            <TableHead className="border-r w-[50px] py-3 text-center font-semibold text-xs">No</TableHead>
                            <TableHead className="border-r min-w-[150px] py-3 font-semibold text-xs">Nama Santri</TableHead>
                            <TableHead className="border-r text-center w-[80px] py-3 font-semibold text-xs">Nilai</TableHead>
                            <TableHead className="py-3 font-semibold text-xs">Capaian Kompetensi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mapel.santri_data.map((santri, index) => (
                            <TableRow key={santri.santri_id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="border-r font-medium text-center py-3 text-xs">{index + 1}</TableCell>
                              <TableCell className="border-r font-semibold py-3 text-xs">{santri.santri_nama}</TableCell>
                              <TableCell className="border-r text-center py-3">
                                <span className="text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                                  {santri.nilai_rapor?.toFixed(1) || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <p className="text-xs leading-relaxed text-muted-foreground">{santri.capaian_kompetensi}</p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-muted/20 rounded-lg">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Belum ada nilai yang difinalisasi untuk mata pelajaran ini.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
