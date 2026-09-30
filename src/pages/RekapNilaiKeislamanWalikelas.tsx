import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, FileText, Moon, ChevronDown, GraduationCap, CalendarDays, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

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

export default function RekapNilaiKeislamanWalikelas() {
  const navigate = useNavigate();
  const { kelasId } = useParams<{ kelasId: string }>();
  const { getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const [activeTab, setActiveTab] = useState<string | null>(null);

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

  const { data: mapelNilaiList = [], isLoading: mapelLoading } = useQuery({
    queryKey: ['rekap-mapel-nilai-keislaman-walikelas', kelasData?.id],
    queryFn: async () => {
      if (!kelasData?.id) return [];

      // Fetch mapel with kategori 'asrama' for this kelas
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select(`
          id, nama, kode_mapel, kategori,
          pengampu:profiles!mapel_pengampu_id_fkey(id, name)
        `)
        .eq('kelas_id', kelasData.id)
        .eq('status', 'aktif')
        .eq('kategori', 'asrama')
        .order('nama');

      if (mapelError) throw mapelError;

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
            const { data: santriData } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', santriIds);

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
    enabled: !!kelasData?.id,
    staleTime: 2 * 60 * 1000,
  });

  const loading = kelasLoading || mapelLoading;

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
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
      <div className="space-y-6 pb-24">
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
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />

        <div className="relative flex items-start gap-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/app/penilaian/${kelasId}`)}
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <div className="flex items-start gap-4 mb-3">
              <div className="p-3 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                <Moon className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-primary-foreground mb-2">
                  Rekap Nilai Keislaman
                </h1>
                <div className="flex flex-wrap items-center gap-2">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {mapelNilaiList.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Moon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Belum ada mata pelajaran keislaman/asrama untuk kelas ini
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={activeTab || mapelNilaiList[0]?.mapel_id}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="flex w-full gap-2 rounded-2xl bg-card border border-border p-2 shadow-sm h-auto mb-6 overflow-x-auto">
            {mapelNilaiList.slice(0, 2).map((mapel) => (
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
                    variant={
                      mapelNilaiList
                        .slice(2)
                        .some((m) => m.mapel_id === (activeTab || mapelNilaiList[0]?.mapel_id))
                        ? 'default'
                        : 'outline'
                    }
                    className="rounded-xl py-3 px-4 h-auto font-medium text-xs sm:text-sm"
                  >
                    <span className="truncate">
                      {mapelNilaiList
                        .slice(2)
                        .find((m) => m.mapel_id === (activeTab || mapelNilaiList[0]?.mapel_id))
                        ?.mapel_nama || `+${mapelNilaiList.length - 2}`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {mapelNilaiList.slice(2).map((mapel) => (
                    <DropdownMenuItem
                      key={mapel.mapel_id}
                      onClick={() => setActiveTab(mapel.mapel_id)}
                      className={activeTab === mapel.mapel_id ? 'bg-primary/10 text-primary' : ''}
                    >
                      {mapel.mapel_nama}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TabsList>

          {mapelNilaiList.map((mapel) => (
            <TabsContent key={mapel.mapel_id} value={mapel.mapel_id} className="mt-6">
              <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
                <CardHeader className="border-b bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Moon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{mapel.mapel_nama}</CardTitle>
                        <CardDescription className="mt-1">
                          <span>Pengampu: {mapel.pengampu_nama}</span>
                        </CardDescription>
                      </div>
                    </div>
                    {mapel.is_finalized ? (
                      <Badge variant="success" className="rounded-xl shadow-md">
                        Finalisasi
                      </Badge>
                    ) : mapel.finalized_count > 0 ? (
                      <Badge variant="warning" className="rounded-xl shadow-md">
                        {mapel.finalized_count}/{mapel.total_santri} Dinilai
                      </Badge>
                    ) : (
                      <Badge variant="pending" className="rounded-xl">
                        Belum Dinilai
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {mapel.finalized_count > 0 ? (
                    <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-border bg-muted/50">
                            <TableHead className="border-r w-[50px] py-3 text-center font-semibold text-xs">
                              No
                            </TableHead>
                            <TableHead className="border-r min-w-[150px] py-3 font-semibold text-xs">
                              Nama Santri
                            </TableHead>
                            <TableHead className="border-r text-center w-[80px] py-3 font-semibold text-xs">
                              Nilai
                            </TableHead>
                            <TableHead className="py-3 font-semibold text-xs">Capaian Kompetensi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mapel.santri_data.map((santri, index) => (
                            <TableRow
                              key={santri.santri_id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="border-r font-medium text-center py-3 text-xs">
                                {index + 1}
                              </TableCell>
                              <TableCell className="border-r font-semibold py-3 text-xs">
                                {santri.santri_nama}
                              </TableCell>
                              <TableCell className="border-r text-center py-3">
                                <span className="text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                                  {santri.nilai_rapor?.toFixed(1) || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {santri.capaian_kompetensi}
                                </p>
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
