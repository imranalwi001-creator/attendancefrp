import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, GraduationCap, Clock, Brain, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
interface CategoryItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  enabled: boolean;
  finalizationTable?: string;
}
export default function RekapNilaiMenu() {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const {
    activeAcademicYear,
    getCurrentSemester
  } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  const activeAcademicYearId = activeAcademicYear?.id;

  // Query finalization status for each category
  const { data: finalizationStatus } = useQuery({
    queryKey: ['rekap-menu-finalization', id, activeAcademicYearId, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYearId || !id) return {};

      // Fetch all finalization statuses in parallel
      const [raportResult, cambridgeResult] = await Promise.all([
        supabase
          .from('raport_finalization')
          .select('is_finalized')
          .eq('kelas_id', id)
          .eq('academic_year_id', activeAcademicYearId)
          .eq('semester', currentSemester)
          .maybeSingle(),
        supabase
          .from('cambridge_finalization')
          .select('is_finalized')
          .eq('kelas_id', id)
          .eq('academic_year_id', activeAcademicYearId)
          .eq('semester', currentSemester)
          .maybeSingle(),
      ]);

      return {
        akademik: raportResult.data?.is_finalized ?? false,
        cambridge: cambridgeResult.data?.is_finalized ?? false,
        psikologi: false, // Psikologi tidak memiliki finalization per kelas
      };
    },
    enabled: !!id && !!activeAcademicYearId,
    staleTime: 30 * 1000,
  });

  const {
    data: kelas,
    isLoading
  } = useQuery({
    queryKey: ['rekap-menu-kelas', id],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('kelas').select('id, nama, tingkat, tahun_ajaran').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const categories: CategoryItem[] = [{
    id: 'akademik',
    title: 'Akademik',
    description: 'Rekap nilai mata pelajaran (wajib, pilihan, ekstrakurikuler)',
    icon: <BookOpen className="h-8 w-8" />,
    path: `/admin/penilaian/kelas/${id}/akademik`,
    enabled: true,
    finalizationTable: 'raport_finalization'
  }, {
    id: 'cambridge',
    title: 'Cambridge',
    description: 'Rekap nilai program Cambridge',
    icon: <GraduationCap className="h-8 w-8" />,
    path: `/admin/penilaian/kelas/${id}/cambridge`,
    enabled: true,
    finalizationTable: 'cambridge_finalization'
  }, {
    id: 'psikologi',
    title: 'Raport Psikologi',
    description: 'Rekap hasil asesmen psikologi santri',
    icon: <Brain className="h-8 w-8" />,
    path: `/admin/penilaian/kelas/${id}/psikologi`,
    enabled: true
  }];
  if (isLoading) {
    return <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Memuat data...</p>
          </CardContent>
        </Card>
      </div>;
  }
  if (!kelas) {
    return <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Data kelas tidak ditemukan</p>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
        
        <div className="relative flex items-start gap-4 z-10">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/penilaian')} className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-3">
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-3">
                  Rekap Nilai Akademik {kelas.nama}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground border-0" />
                  <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1">
                    <GraduationCap className="h-3 w-3" />
                    Tingkat {kelas.tingkat}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(category => {
          const isPublished = finalizationStatus?.[category.id as keyof typeof finalizationStatus] ?? false;
          const hasFinalization = !!category.finalizationTable;
          
          return <Card key={category.id} className={`rounded-2xl border-2 transition-all duration-300 cursor-pointer ${category.enabled ? 'hover:border-primary hover:shadow-lg hover:scale-[1.02]' : 'opacity-60 cursor-not-allowed'}`} onClick={() => category.enabled && navigate(category.path)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${category.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {category.icon}
                </div>
                {!category.enabled ? (
                  <Badge variant="secondary" className="rounded-lg text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Segera Hadir
                  </Badge>
                ) : hasFinalization ? (
                  isPublished ? (
                    <Badge variant="success" className="rounded-lg text-xs gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="rounded-lg text-xs gap-1">
                      <XCircle className="h-3 w-3" />
                      Unpublished
                    </Badge>
                  )
                ) : null}
              </div>
              <CardTitle className="text-xl mt-3">{category.title}</CardTitle>
              <CardDescription className="text-sm">
                {category.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {category.enabled ? <Button variant="btn_sec" className="w-full rounded-xl">
                  Lihat Rekap
                </Button> : <Button variant="outline" disabled className="w-full rounded-xl">
                  Belum Tersedia
                </Button>}
            </CardContent>
          </Card>;
        })}
      </div>
    </div>;
}