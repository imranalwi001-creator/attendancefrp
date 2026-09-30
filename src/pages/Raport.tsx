import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, BookOpen, FileText, Moon, Heart, Shield, MessageSquare, Crown, Lock, Unlock, ScrollText, GraduationCap, ExternalLink } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { AffectiveRadarChart, AffectiveScoreBadge, getPredikat } from '@/components/affective';
import { TahfidzTabContent } from '@/components/tahfidz';
import { HafalanTabContent } from '@/components/hafalan';
import { useMemo, useState } from 'react';

interface NilaiAkademik {
  mapel_id: string;
  mapel_nama: string;
  kode_mapel: string;
  pengampu_nama: string;
  nilai_rapor: number | null;
  capaian_kompetensi: string;
}

interface AffectiveCategory {
  id: string;
  name: string;
  color: string | null;
}

interface AffectiveIndicator {
  id: string;
  name: string;
  category_id: string;
}

interface CategoryScore {
  categoryId: string;
  categoryName: string;
  averageScore: number;
  color: string;
}

export default function Raport() {
  const { user } = useAuth();
  const { section } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeSection = section || 'akademik';
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester() || 'ganjil';
  
  const isOrangtua = user?.role === 'orangtua';
  const [selectedChildId, setSelectedChildId] = useState<string | null>(searchParams.get('childId'));

  const sectionTitles: Record<string, string> = {
    akademik: 'Nilai Akademik',
    afektif: 'Afektif & Kepribadian',
    keislaman: 'Penilaian Keislaman',
    'tahsin-tahfidz': 'Tahsin & Tahfidz',
    hafalan: 'Hafalan Materi',
    cambridge: 'Cambridge English Assessment'
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    akademik: <BookOpen className="h-8 w-8 text-primary-foreground" />,
    keislaman: <Moon className="h-8 w-8 text-primary-foreground" />,
    afektif: <Heart className="h-8 w-8 text-primary-foreground" />,
    'tahsin-tahfidz': <ScrollText className="h-8 w-8 text-primary-foreground" />,
  };

  // Fetch children for orangtua
  const { data: childrenData = [] } = useQuery({
    queryKey: ['parent-children-raport', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: parentChildren } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      
      if (!parentChildren || parentChildren.length === 0) return [];

      const childIds = parentChildren.map(pc => pc.child_id);

      const { data: santriDataResult } = await supabase
        .from('santri')
        .select('id, kelas_id')
        .in('id', childIds);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', childIds);

      return (santriDataResult || []).map(santri => {
        const profile = profilesData?.find(p => p.id === santri.id);
        return {
          id: santri.id,
          name: profile?.name || 'Anak',
          avatar_url: profile?.avatar_url,
          kelas_id: santri.kelas_id
        };
      });
    },
    enabled: !!user?.id && isOrangtua
  });

  // Set default selected child
  const effectiveChildId = selectedChildId || (childrenData.length > 0 ? childrenData[0].id : null);
  const selectedChild = childrenData.find(c => c.id === effectiveChildId);

  // Determine which santri ID to use
  const santriId = isOrangtua ? effectiveChildId : user?.id;

  // Fetch santri's kelas_id
  const { data: santriData } = useQuery({
    queryKey: ['santri-kelas', santriId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri')
        .select('kelas_id')
        .eq('id', santriId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!santriId,
  });

  const kelasId = isOrangtua ? selectedChild?.kelas_id : santriData?.kelas_id;

  // Fetch finalized academic grades for santri (non-asrama)
  const { data: nilaiAkademik = [], isLoading: isLoadingAkademik } = useQuery({
    queryKey: ['santri-nilai-akademik', santriId, kelasId],
    queryFn: async () => {
      if (!kelasId || !santriId) return [];

      // Get all mapel for santri's kelas (excluding asrama)
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select(`
          id, 
          nama, 
          kode_mapel, 
          pengampu:profiles!mapel_pengampu_id_fkey(id, name)
        `)
        .eq('kelas_id', kelasId)
        .eq('status', 'aktif')
        .neq('kategori', 'asrama')
        .order('nama');

      if (mapelError) throw mapelError;

      // Get finalized assessments for this santri
      const { data: asesmenData, error: asesmenError } = await supabase
        .from('asesmen_sumatif')
        .select('mapel_id, nilai_rapor, is_finalized')
        .eq('santri_id', santriId)
        .eq('is_finalized', true);

      if (asesmenError) throw asesmenError;

      // Get formatif data for capaian kompetensi
      const { data: formatifData } = await supabase
        .from('asesmen_formatif')
        .select('mapel_id, deskripsi_tertinggi, deskripsi_terendah, tp_assessments')
        .eq('santri_id', santriId);

      // Map data
      const nilaiList: NilaiAkademik[] = (mapelData || [])
        .map(mapel => {
          const asesmen = asesmenData?.find(a => a.mapel_id === mapel.id);
          if (!asesmen) return null; // Only show finalized grades

          const formatif = formatifData?.find(f => f.mapel_id === mapel.id);
          let capaianKompetensi = '-';

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
            mapel_id: mapel.id,
            mapel_nama: mapel.nama,
            kode_mapel: mapel.kode_mapel || '-',
            pengampu_nama: (mapel.pengampu as any)?.name || '-',
            nilai_rapor: asesmen.nilai_rapor,
            capaian_kompetensi: capaianKompetensi,
          };
        })
        .filter(Boolean) as NilaiAkademik[];

      return nilaiList;
    },
    enabled: !!santriId && !!kelasId && activeSection === 'akademik',
  });

  // Fetch finalized keislaman grades for santri (asrama category)
  const { data: nilaiKeislaman = [], isLoading: isLoadingKeislaman } = useQuery({
    queryKey: ['santri-nilai-keislaman', santriId, kelasId],
    queryFn: async () => {
      if (!kelasId || !santriId) return [];

      // Get all mapel for santri's kelas with kategori 'asrama'
      const { data: mapelData, error: mapelError } = await supabase
        .from('mapel')
        .select(`
          id, 
          nama, 
          kode_mapel, 
          pengampu:profiles!mapel_pengampu_id_fkey(id, name)
        `)
        .eq('kelas_id', kelasId)
        .eq('status', 'aktif')
        .eq('kategori', 'asrama')
        .order('nama');

      if (mapelError) throw mapelError;

      // Get finalized assessments for this santri
      const { data: asesmenData, error: asesmenError } = await supabase
        .from('asesmen_sumatif')
        .select('mapel_id, nilai_rapor, is_finalized')
        .eq('santri_id', santriId)
        .eq('is_finalized', true);

      if (asesmenError) throw asesmenError;

      // Get formatif data for capaian kompetensi
      const { data: formatifData } = await supabase
        .from('asesmen_formatif')
        .select('mapel_id, deskripsi_tertinggi, deskripsi_terendah, tp_assessments')
        .eq('santri_id', santriId);

      // Map data
      const nilaiList: NilaiAkademik[] = (mapelData || [])
        .map(mapel => {
          const asesmen = asesmenData?.find(a => a.mapel_id === mapel.id);
          if (!asesmen) return null; // Only show finalized grades

          const formatif = formatifData?.find(f => f.mapel_id === mapel.id);
          let capaianKompetensi = '-';

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
            mapel_id: mapel.id,
            mapel_nama: mapel.nama,
            kode_mapel: mapel.kode_mapel || '-',
            pengampu_nama: (mapel.pengampu as any)?.profiles?.name || '-',
            nilai_rapor: asesmen.nilai_rapor,
            capaian_kompetensi: capaianKompetensi,
          };
        })
        .filter(Boolean) as NilaiAkademik[];

      return nilaiList;
    },
    enabled: !!santriId && !!kelasId && activeSection === 'keislaman',
  });

  // Fetch affective finalization status
  const { data: affectiveFinalization, isLoading: isLoadingFinalization } = useQuery({
    queryKey: ['affective-finalization', kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affective_finalization')
        .select('*')
        .eq('kelas_id', kelasId!)
        .eq('academic_year_id', activeAcademicYear!.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id && !!currentSemester && activeSection === 'afektif',
  });

  const isAffectiveFinalized = !!affectiveFinalization?.is_finalized;

  // Fetch affective categories
  const { data: affectiveCategories } = useQuery({
    queryKey: ['affective-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affective_categories')
        .select('*')
        .order('order_index');
      if (error) throw error;
      return data as AffectiveCategory[];
    },
    enabled: activeSection === 'afektif',
  });

  // Fetch affective indicators
  const { data: affectiveIndicators } = useQuery({
    queryKey: ['affective-indicators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affective_indicators')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return data as AffectiveIndicator[];
    },
    enabled: activeSection === 'afektif',
  });

  // Fetch affective scores for santri
  const { data: affectiveScores, isLoading: isLoadingAffective } = useQuery({
    queryKey: ['santri-affective-scores', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id || !santriId) return [];
      const { data, error } = await supabase
        .from('affective_scores')
        .select('*')
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester);
      if (error) throw error;
      return data || [];
    },
    enabled: !!santriId && !!activeAcademicYear?.id && activeSection === 'afektif',
  });

  // Calculate affective category scores and indicator score map
  const { affectiveCategoryScores, indicatorScoreMap, overallAffectiveScore } = useMemo(() => {
    if (!affectiveCategories || !affectiveIndicators || !affectiveScores) {
      return { affectiveCategoryScores: [], indicatorScoreMap: new Map<string, number>(), overallAffectiveScore: 0 };
    }

    const scoreMap = new Map<string, number>();
    affectiveScores.forEach(score => {
      scoreMap.set(score.indicator_id, score.score);
    });

    const categoryScores: CategoryScore[] = affectiveCategories.map(category => {
      const categoryIndicators = affectiveIndicators.filter(ind => ind.category_id === category.id);
      const scores = categoryIndicators.map(ind => scoreMap.get(ind.id) || 0).filter(s => s > 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        categoryId: category.id,
        categoryName: category.name,
        averageScore: avgScore,
        color: category.color || 'hsl(var(--primary))',
      };
    });

    const allScores = categoryScores.map(c => c.averageScore).filter(s => s > 0);
    const overall = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    return { 
      affectiveCategoryScores: categoryScores, 
      indicatorScoreMap: scoreMap,
      overallAffectiveScore: overall 
    };
  }, [affectiveCategories, affectiveIndicators, affectiveScores]);

  // Category icons for affective
  const affectiveCategoryIcons: Record<string, React.ReactNode> = {
    "Confidence": <Shield className="h-4 w-4" />,
    "Communication": <MessageSquare className="h-4 w-4" />,
    "Leadership": <Crown className="h-4 w-4" />,
    "Emotional Control": <Heart className="h-4 w-4" />,
  };

  // Fetch tahfidz finalization status
  const { data: tahfidzFinalization } = useQuery({
    queryKey: ['tahfidz-finalization', activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tahfidz_finalization')
        .select('*')
        .eq('academic_year_id', activeAcademicYear!.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeAcademicYear?.id && !!currentSemester && activeSection === 'tahsin-tahfidz',
  });

  const isTahfidzFinalized = !!tahfidzFinalization?.is_finalized;

  // Fetch tahfidz/tahsin records for santri
  const { data: tahfidzRecords = [], isLoading: isLoadingTahfidz, refetch: refetchTahfidz } = useQuery({
    queryKey: ['santri-tahfidz-records', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return [];
      const { data, error } = await supabase
        .from('tahfidz_tahsin')
        .select('id, tipe, mode, surah, juz, ayat_awal, ayat_akhir, materi_tahsin, nilai, status, tanggal')
        .eq('santri_id', santriId)
        .eq('tahun_ajaran_id', activeAcademicYear!.id)
        .eq('semester', currentSemester)
        .order('tanggal', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        tipe: r.tipe as "tahfidz" | "tahsin",
      }));
    },
    enabled: !!santriId && !!activeAcademicYear?.id && activeSection === 'tahsin-tahfidz',
  });

  // Fetch santri profile for TahfidzTabContent
  const { data: santriProfile } = useQuery({
    queryKey: ['santri-profile', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', santriId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!santriId && (activeSection === 'tahsin-tahfidz' || activeSection === 'hafalan'),
  });

  // Fetch hafalan finalization status
  const { data: hafalanFinalization } = useQuery({
    queryKey: ['hafalan-finalization', activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hafalan_finalization')
        .select('*')
        .eq('academic_year_id', activeAcademicYear!.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeAcademicYear?.id && !!currentSemester && activeSection === 'hafalan',
  });

  const isHafalanFinalized = !!hafalanFinalization?.is_finalized;

  // Fetch Cambridge document for santri
  const { data: cambridgeDocument, isLoading: isLoadingCambridge } = useQuery({
    queryKey: ['santri-cambridge-document', santriId, kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId || !kelasId || !activeAcademicYear?.id) return null;
      const { data, error } = await supabase
        .from('cambridge_documents')
        .select('*')
        .eq('santri_id', santriId)
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!santriId && !!kelasId && !!activeAcademicYear?.id && activeSection === 'cambridge',
  });

  // Fetch hafalan (setoran) records for santri
  const { data: hafalanRecords = [], isLoading: isLoadingHafalan, refetch: refetchHafalan } = useQuery({
    queryKey: ['santri-hafalan-records', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return [];
      const { data, error } = await supabase
        .from('setoran_hafalan')
        .select('id, kategori, judul, nilai, status, tanggal, catatan, audio_url, audio_type')
        .eq('santri_id', santriId)
        .eq('tahun_ajaran_id', activeAcademicYear!.id)
        .eq('semester', currentSemester)
        .order('tanggal', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        kategori: r.kategori as "quran" | "hadist" | "doa",
        judul: r.judul,
        tanggal: r.tanggal,
        nilai: r.nilai || 0,
        status: r.status as "lancar" | "belum_lancar" | "lanjut_besok",
        catatan: r.catatan,
        audioUrl: r.audio_url,
        audioType: r.audio_type as "recording" | "drive" | undefined,
      }));
    },
    enabled: !!santriId && !!activeAcademicYear?.id && activeSection === 'hafalan',
  });

  if (!user) return null;

  // Render grades table component
  const renderGradesTable = (
    nilaiList: NilaiAkademik[],
    isLoading: boolean,
    icon: React.ReactNode,
    emptyMessage: string
  ) => {
    if (isLoading) {
      return (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Memuat data...</p>
          </CardContent>
        </Card>
      );
    }

    if (nilaiList.length === 0) {
      return (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">{emptyMessage}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nilai akan muncul setelah guru memfinalisasi penilaian
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
        <CardHeader className="border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              {icon}
            </div>
            <div>
              <CardTitle className="text-xl">Daftar Nilai</CardTitle>
              <CardDescription className="mt-1">
                {nilaiList.length} mata pelajaran telah dinilai
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border bg-muted/50">
                  <TableHead className="border-r w-[60px] py-4 text-center font-semibold">No</TableHead>
                  <TableHead className="border-r min-w-[200px] py-4 font-semibold">Mata Pelajaran</TableHead>
                  <TableHead className="border-r text-center w-[120px] py-4 font-semibold">Nilai</TableHead>
                  <TableHead className="py-4 font-semibold">Capaian Kompetensi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nilaiList.map((nilai, index) => (
                  <TableRow key={nilai.mapel_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="border-r font-medium text-center py-4">{index + 1}</TableCell>
                    <TableCell className="border-r py-4">
                      <p className="font-semibold">{nilai.mapel_nama}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{nilai.pengampu_nama}</p>
                    </TableCell>
                    <TableCell className="border-r text-center py-4">
                      <span className="text-2xl font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg inline-block">
                        {nilai.nilai_rapor?.toFixed(1) || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">{nilai.capaian_kompetensi}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render academic section
  if (activeSection === 'akademik') {
    return (
      <div className="space-y-6">
        {/* Header dengan gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/app/raport')} 
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <BookOpen className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-primary-foreground mb-2">{sectionTitles[activeSection]}</h1>
                  <p className="text-primary-foreground/80 text-sm">
                    Rekap nilai mata pelajaran yang sudah difinalisasi
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {renderGradesTable(
          nilaiAkademik,
          isLoadingAkademik,
          <BookOpen className="h-5 w-5 text-primary" />,
          'Belum ada nilai akademik yang difinalisasi'
        )}
      </div>
    );
  }

  // Render keislaman section
  if (activeSection === 'keislaman') {
    return (
      <div className="space-y-6">
        {/* Header dengan gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/app/raport')} 
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <Moon className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-primary-foreground mb-2">{sectionTitles[activeSection]}</h1>
                  <p className="text-primary-foreground/80 text-sm">
                    Rekap nilai keislaman yang sudah difinalisasi
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {renderGradesTable(
          nilaiKeislaman,
          isLoadingKeislaman,
          <Moon className="h-5 w-5 text-primary" />,
          'Belum ada nilai keislaman yang difinalisasi'
        )}
      </div>
    );
  }

  // Render tahsin-tahfidz section
  if (activeSection === 'tahsin-tahfidz') {
    return (
      <div className="space-y-6">
        {/* Header dengan gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/app/raport')} 
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <ScrollText className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{sectionTitles[activeSection]}</h1>
                  <p className="text-primary-foreground/80 text-sm">
                    Rekap nilai tahfidz & tahsin semester ini
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Only show if finalized */}
        {isTahfidzFinalized ? (
          <TahfidzTabContent
            santriId={user?.id || ''}
            santriName={santriProfile?.name}
            santriNis={null}
            santriKelas={undefined}
            tahfidzRecords={tahfidzRecords}
            tahfidzLoading={isLoadingTahfidz}
            isTahfidzFinalized={isTahfidzFinalized}
            onRefetch={() => refetchTahfidz()}
            readOnly
          />
        ) : (
          <Card className="rounded-2xl border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <ScrollText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nilai Tahfidz & Tahsin belum difinalisasi oleh pembina.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Render hafalan section
  if (activeSection === 'hafalan') {
    return (
      <div className="space-y-6">
        {/* Header dengan gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/app/raport')} 
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <BookOpen className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{sectionTitles[activeSection]}</h1>
                  <p className="text-primary-foreground/80 text-sm">
                    Rekap nilai hafalan materi semester ini
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <HafalanTabContent
          santriId={santriId || ''}
          setoranList={hafalanRecords}
          setoranLoading={isLoadingHafalan}
          isHafalanFinalized={isHafalanFinalized}
          onRefetch={() => refetchHafalan()}
        />
      </div>
    );
  }

  if (activeSection === 'afektif') {
    return (
      <div className="space-y-6">
        {/* Header dengan gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/app/raport')} 
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <Heart className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{sectionTitles[activeSection]}</h1>
                  <p className="text-primary-foreground/80 text-sm">
                    Penilaian afektif dan kepribadian santri
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {(isLoadingAffective || isLoadingFinalization) ? (
          <Card className="rounded-2xl border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Memuat data...</p>
            </CardContent>
          </Card>
        ) : isAffectiveFinalized ? (
          overallAffectiveScore > 0 ? (
            <div className="space-y-4">
              {/* Radar Chart and Overall Score */}
              <Card className="rounded-2xl border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                        <Heart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      </div>
                      <h3 className="font-semibold">Ringkasan Nilai Afektif</h3>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                      <Lock className="h-3 w-3" />
                      Sudah Difinalisasi
                    </Badge>
                  </div>
                  <div className="flex flex-col items-center">
                    <AffectiveRadarChart
                      data={affectiveCategoryScores}
                      size="lg"
                      showLabels={true}
                    />
                    <div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground">Nilai Rata-rata</p>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <AffectiveScoreBadge score={overallAffectiveScore} size="lg" />
                        <span className="text-lg font-semibold text-foreground">
                          {getPredikat(overallAffectiveScore)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            {/* Category Breakdown */}
            <Card className="rounded-2xl border-0 shadow-md">
              <CardHeader className="pb-2">
                <h3 className="font-semibold text-foreground">Nilai per Kategori</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {affectiveCategories?.map((category) => {
                  const categoryScore = affectiveCategoryScores.find(
                    (c) => c.categoryId === category.id
                  );
                  const categoryIndicators = affectiveIndicators?.filter(
                    (ind) => ind.category_id === category.id
                  );

                  return (
                    <div
                      key={category.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="p-1.5 rounded-md"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <span style={{ color: category.color || undefined }}>
                              {affectiveCategoryIcons[category.name] || <Heart className="h-4 w-4" />}
                            </span>
                          </div>
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <AffectiveScoreBadge
                          score={categoryScore?.averageScore || 0}
                          size="md"
                        />
                      </div>

                      {/* Indicator List */}
                      <div className="space-y-2 pl-8">
                        {categoryIndicators?.map((indicator) => {
                          const indicatorScore = indicatorScoreMap.get(indicator.id) || 0;
                          return (
                            <div
                              key={indicator.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-muted-foreground">
                                {indicator.name}
                              </span>
                              <span className="font-medium">
                                {indicatorScore > 0 ? indicatorScore : "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </div>
          ) : (
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                      <Heart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <h3 className="font-semibold text-rose-600 dark:text-rose-400">Ringkasan Nilai Afektif</h3>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                    <Lock className="h-3 w-3" />
                    Sudah Difinalisasi
                  </Badge>
                </div>
                <div className="text-center py-8">
                  <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Belum ada data penilaian afektif untuk santri ini.
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="rounded-2xl border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                    <Heart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="font-semibold text-rose-600 dark:text-rose-400">Ringkasan Nilai Afektif</h3>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                  <Unlock className="h-3 w-3" />
                  Belum Difinalisasi
                </Badge>
              </div>
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nilai afektif belum difinalisasi oleh pembina.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Render cambridge section
  if (activeSection === 'cambridge') {
    return (
      <div className="space-y-6">
        {/* Header dengan gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/app/raport')} 
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <GraduationCap className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-primary-foreground mb-2">{sectionTitles[activeSection]}</h1>
                  <p className="text-primary-foreground/80 text-sm">
                    Dokumen hasil assessment Cambridge English
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoadingCambridge ? (
          <Card className="rounded-2xl border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Memuat data...</p>
            </CardContent>
          </Card>
        ) : cambridgeDocument?.document_url ? (
          <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
            <CardHeader className="border-b bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Dokumen Cambridge Assessment</CardTitle>
                  <CardDescription className="mt-1">
                    {cambridgeDocument.document_name || 'Cambridge English Assessment Document'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Document Preview */}
              <div className="rounded-xl border-2 border-border/50 shadow-lg overflow-hidden bg-card">
                <div className="aspect-[3/4] w-full">
                  <iframe
                    src={cambridgeDocument.document_url}
                    className="w-full h-full"
                    title="Cambridge Document"
                  />
                </div>
              </div>
              
              {/* Action Button */}
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(cambridgeDocument.document_url!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Buka di Tab Baru
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Belum ada dokumen Cambridge</p>
              <p className="text-sm text-muted-foreground mt-1">
                Dokumen akan muncul setelah diunggah oleh admin
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Default placeholder for other sections
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
        
        <div className="relative flex items-start gap-4 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/app/raport')} 
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                <BookOpen className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-2">{sectionTitles[activeSection]}</h1>
                <p className="text-primary-foreground/80 text-sm">
                  Rekap nilai kategori ini
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Data nilai akan ditampilkan di sini</p>
        </CardContent>
      </Card>
    </div>
  );
}
