import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BookText, FileText, CheckCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';

interface TahfidzTahsinData {
  santri_id: string;
  santri_nama: string;
  tahfidz_ziyadah: number;
  tahfidz_murojaah: number;
  tahfidz_avg: number | null;
  tahsin_tajwid: number | null;
  tahsin_makhraj: number | null;
  tahsin_kelancaran: number | null;
  tahsin_avg: number | null;
}

export default function RekapNilaiTahfidzTahsinWalikelas() {
  const { kelasId } = useParams();
  const navigate = useNavigate();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const [activeTab, setActiveTab] = useState<'tahfidz' | 'tahsin'>('tahfidz');

  const { data: kelas, isLoading: kelasLoading } = useQuery({
    queryKey: ['rekap-kelas-tahfidz-walikelas', kelasId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran, walikelas_id')
        .eq('id', kelasId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!kelasId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: profilesData = [] } = useQuery({
    queryKey: ['profiles-for-rekap-tahfidz-walikelas', kelas?.walikelas_id],
    queryFn: async () => {
      if (!kelas?.walikelas_id) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', kelas.walikelas_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!kelas?.walikelas_id,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const { data: finalizationData, isLoading: finalizationLoading } = useQuery({
    queryKey: ['tahfidz-finalization-walikelas', activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester) return null;
      
      const { data, error } = await supabase
        .from('tahfidz_finalization')
        .select('id, is_finalized, finalized_at')
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester)
        .eq('is_finalized', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeAcademicYear?.id && !!currentSemester,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: tahfidzTahsinData = [], isLoading: dataLoading } = useQuery({
    queryKey: ['rekap-tahfidz-tahsin-walikelas', kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id || !currentSemester) return [];

      const { data: santriList, error: santriError } = await supabase
        .from('santri')
        .select('id, profiles!santri_id_fkey(id, name)')
        .eq('kelas_id', kelasId)
        .limit(100);

      if (santriError) throw santriError;
      if (!santriList || santriList.length === 0) return [];

      const santriIds = santriList.map(s => s.id);

      const { data: records, error: recordsError } = await supabase
        .from('tahfidz_tahsin')
        .select('id, santri_id, tipe, mode, surah, nilai, tajwid, makhraj, kelancaran')
        .in('santri_id', santriIds)
        .eq('tahun_ajaran_id', activeAcademicYear.id)
        .eq('semester', currentSemester);

      if (recordsError) throw recordsError;

      const studentData: TahfidzTahsinData[] = santriList.map(santri => {
        const studentRecords = records?.filter(r => r.santri_id === santri.id) || [];
        
        const tahfidzRecords = studentRecords.filter(r => r.tipe === 'tahfidz');
        const ziyadahRecords = tahfidzRecords.filter(r => r.mode === 'ziyadah');
        const murojaahRecords = tahfidzRecords.filter(r => r.mode === 'murojaah');
        
        const ziyadahAvg = ziyadahRecords.length > 0 
          ? ziyadahRecords.reduce((sum, r) => sum + (r.nilai || 0), 0) / ziyadahRecords.length 
          : 0;
        const murojaahAvg = murojaahRecords.length > 0 
          ? murojaahRecords.reduce((sum, r) => sum + (r.nilai || 0), 0) / murojaahRecords.length 
          : 0;
        
        const tahfidzCount = (ziyadahRecords.length > 0 ? 1 : 0) + (murojaahRecords.length > 0 ? 1 : 0);
        const tahfidzAvg = tahfidzCount > 0 ? (ziyadahAvg + murojaahAvg) / tahfidzCount : null;

        const tahsinRecords = studentRecords.filter(r => r.tipe === 'tahsin');
        const tahsinTajwidAvg = tahsinRecords.length > 0
          ? tahsinRecords.reduce((sum, r) => sum + (r.tajwid || 0), 0) / tahsinRecords.length
          : null;
        const tahsinMakhrajAvg = tahsinRecords.length > 0
          ? tahsinRecords.reduce((sum, r) => sum + (r.makhraj || 0), 0) / tahsinRecords.length
          : null;
        const tahsinKelancaranAvg = tahsinRecords.length > 0
          ? tahsinRecords.reduce((sum, r) => sum + (r.kelancaran || 0), 0) / tahsinRecords.length
          : null;
        const tahsinAvg = tahsinRecords.length > 0
          ? tahsinRecords.reduce((sum, r) => sum + (r.nilai || 0), 0) / tahsinRecords.length
          : null;

        return {
          santri_id: santri.id,
          santri_nama: (santri.profiles as any)?.name || 'Unknown',
          tahfidz_ziyadah: Math.round(ziyadahAvg),
          tahfidz_murojaah: Math.round(murojaahAvg),
          tahfidz_avg: tahfidzAvg ? Math.round(tahfidzAvg) : null,
          tahsin_tajwid: tahsinTajwidAvg ? Math.round(tahsinTajwidAvg) : null,
          tahsin_makhraj: tahsinMakhrajAvg ? Math.round(tahsinMakhrajAvg) : null,
          tahsin_kelancaran: tahsinKelancaranAvg ? Math.round(tahsinKelancaranAvg) : null,
          tahsin_avg: tahsinAvg ? Math.round(tahsinAvg) : null,
        };
      });

      return studentData.sort((a, b) => a.santri_nama.localeCompare(b.santri_nama));
    },
    enabled: !!kelasId && !!activeAcademicYear?.id && !!currentSemester && !!finalizationData,
  });

  const getWaliKelasName = () => {
    if (!kelas?.walikelas_id) return null;
    const profile = profilesData.find((p: any) => p.id === kelas.walikelas_id);
    return profile?.name || null;
  };

  const isFinalized = !!finalizationData?.is_finalized;
  const loading = kelasLoading || finalizationLoading || dataLoading;

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

  if (!kelas) {
    return (
      <div className="space-y-6 pb-24">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Data kelas tidak ditemukan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isFinalized) {
    return (
      <div className="space-y-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />

          <div className="relative z-10">
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 mb-3 -ml-2"
              onClick={() => navigate(`/app/penilaian/${kelasId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Kembali
            </Button>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                <BookText className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-primary-foreground mb-2">
                  Rekap Tahfidz & Tahsin {kelas.nama}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
                    {kelas.tahun_ajaran}
                  </Badge>
                  {currentSemester && (
                    <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
                      Semester {currentSemester === 'ganjil' ? 'Ganjil' : 'Genap'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <BookText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Nilai Belum Difinalisasi
            </p>
            <p className="text-sm text-muted-foreground">
              Rekap nilai akan tampil setelah nilai difinalisasi.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />

        <div className="relative z-10">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 mb-3 -ml-2"
            onClick={() => navigate(`/app/penilaian/${kelasId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Kembali
          </Button>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <BookText className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-primary-foreground mb-2">
                Rekap Tahfidz & Tahsin {kelas.nama}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
                  {kelas.tahun_ajaran}
                </Badge>
                {getWaliKelasName() && (
                  <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
                    Wali Kelas: {getWaliKelasName()}
                  </Badge>
                )}
                {currentSemester && (
                  <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
                    Semester {currentSemester === 'ganjil' ? 'Ganjil' : 'Genap'}
                  </Badge>
                )}
                <Badge className="bg-green-500/20 text-green-100 border-0 gap-1 text-xs">
                  <CheckCircle className="h-3 w-3" />
                  Difinalisasi
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tahfidz' | 'tahsin')} className="w-full">
        <TabsList className="flex w-full gap-2 rounded-2xl bg-card border border-border p-2 shadow-sm h-auto mb-4">
          <TabsTrigger
            value="tahfidz"
            className="flex-1 rounded-xl py-3 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium"
          >
            Tahfidz
          </TabsTrigger>
          <TabsTrigger
            value="tahsin"
            className="flex-1 rounded-xl py-3 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:hover:bg-muted transition-all duration-300 font-medium"
          >
            Tahsin
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tahfidz" className="mt-4">
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
            <CardHeader className="border-b bg-card py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <BookText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Nilai Tahfidz</CardTitle>
                  <CardDescription className="text-sm">Ziyadah dan Murojaah</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {tahfidzTahsinData.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px] py-3 text-center font-semibold">No</TableHead>
                        <TableHead className="py-3 font-semibold">Nama</TableHead>
                        <TableHead className="text-center w-[80px] py-3 font-semibold">Ziyadah</TableHead>
                        <TableHead className="text-center w-[80px] py-3 font-semibold">Murojaah</TableHead>
                        <TableHead className="text-center w-[80px] py-3 font-semibold">Rata-rata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tahfidzTahsinData.map((santri, index) => (
                        <TableRow key={santri.santri_id} className="hover:bg-muted/30">
                          <TableCell className="text-center py-3">{index + 1}</TableCell>
                          <TableCell className="font-medium py-3">{santri.santri_nama}</TableCell>
                          <TableCell className="text-center py-3">
                            <span className={santri.tahfidz_ziyadah > 0 ? 'text-primary font-bold' : 'text-muted-foreground'}>
                              {santri.tahfidz_ziyadah > 0 ? santri.tahfidz_ziyadah : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className={santri.tahfidz_murojaah > 0 ? 'text-primary font-bold' : 'text-muted-foreground'}>
                              {santri.tahfidz_murojaah > 0 ? santri.tahfidz_murojaah : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className={`font-bold ${santri.tahfidz_avg ? 'text-primary' : 'text-muted-foreground'}`}>
                              {santri.tahfidz_avg ?? '-'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/20 rounded-lg">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Belum ada data nilai tahfidz.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tahsin" className="mt-4">
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
            <CardHeader className="border-b bg-card py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <BookText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Nilai Tahsin</CardTitle>
                  <CardDescription className="text-sm">Tajwid, Makhraj, Kelancaran</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {tahfidzTahsinData.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px] py-3 text-center font-semibold">No</TableHead>
                        <TableHead className="py-3 font-semibold min-w-[150px]">Nama</TableHead>
                        <TableHead className="text-center w-[70px] py-3 font-semibold">Tajwid</TableHead>
                        <TableHead className="text-center w-[70px] py-3 font-semibold">Makhraj</TableHead>
                        <TableHead className="text-center w-[70px] py-3 font-semibold">Lancar</TableHead>
                        <TableHead className="text-center w-[70px] py-3 font-semibold">Rata-rata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tahfidzTahsinData.map((santri, index) => (
                        <TableRow key={santri.santri_id} className="hover:bg-muted/30">
                          <TableCell className="text-center py-3">{index + 1}</TableCell>
                          <TableCell className="font-medium py-3">{santri.santri_nama}</TableCell>
                          <TableCell className="text-center py-3">
                            <span className={santri.tahsin_tajwid ? 'text-primary font-bold' : 'text-muted-foreground'}>
                              {santri.tahsin_tajwid ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className={santri.tahsin_makhraj ? 'text-primary font-bold' : 'text-muted-foreground'}>
                              {santri.tahsin_makhraj ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className={santri.tahsin_kelancaran ? 'text-primary font-bold' : 'text-muted-foreground'}>
                              {santri.tahsin_kelancaran ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className={`font-bold ${santri.tahsin_avg ? 'text-primary' : 'text-muted-foreground'}`}>
                              {santri.tahsin_avg ?? '-'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/20 rounded-lg">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Belum ada data nilai tahsin.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
