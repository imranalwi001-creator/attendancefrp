import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButtonGroup, DetailButton } from '@/components/ui/action-buttons';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TooltipProvider } from '@/components/ui/tooltip';
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
 import { ArrowLeft, Brain, Search, Loader2, Send, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';

interface MonitoringStudent {
  id: string;
  name: string;
  nis: string;
  avatar: string | null;
  hasStifin: boolean;
  hasAsesmenAwal: boolean;
  konselingPoin: number;
  affectiveScore: number | null;
  hasSavedReport: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function RekapNilaiPsikologiKelas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const { currentSemester, activeAcademicYear } = useAcademicYear();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kelas data
  const { data: kelas, isLoading: isLoadingKelas } = useQuery({
    queryKey: ['rekap-psikologi-kelas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select('id, nama, tingkat, tahun_ajaran')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch finalization status
  const { data: finalizationData } = useQuery({
    queryKey: ['psikologi-finalization', id, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!id || !activeAcademicYear?.id || !currentSemester) return null;
      
      const { data, error } = await supabase
        .from('psikologi_finalization')
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
        .from('psikologi_finalization')
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
      queryClient.invalidateQueries({ queryKey: ['psikologi-finalization', id] });
      toast({
        title: shouldPublish ? 'Raport Dipublish' : 'Raport Di-unpublish',
        description: shouldPublish 
          ? 'Raport psikologi sekarang dapat dilihat oleh santri dan orang tua.'
          : 'Raport psikologi tidak lagi ditampilkan di dashboard.',
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

  // Fetch santri list with all related data
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['rekap-psikologi-students', id, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!id || !activeAcademicYear?.id) return [];

      // 1. Fetch santri from kelas with profiles
      const { data: santriList, error: santriError } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          profiles!santri_id_fkey(name, avatar_url)
        `)
        .eq('kelas_id', id);

      if (santriError) throw santriError;
      if (!santriList || santriList.length === 0) return [];

      const santriIds = santriList.map(s => s.id);

      // 2. Fetch STIFIN results from santri_stifin_results table
      const { data: stifinResults } = await supabase
        .from('santri_stifin_results')
        .select('santri_id, tipe_stifin')
        .in('santri_id', santriIds);

      const stifinSet = new Set((stifinResults || []).filter(r => r.tipe_stifin).map(r => r.santri_id));

      // 3. Fetch psikologi results (for asesmen awal detection)
      const { data: psikologiResults } = await supabase
        .from('santri_psikologi_results')
        .select('santri_id, profil_psikologis')
        .in('santri_id', santriIds);

      // Map santri to their asesmen awal data
      const asesmenAwalSet = new Set(
        (psikologiResults || []).filter(r => r.profil_psikologis).map(r => r.santri_id)
      );

      // 4. Fetch konseling records (sum poin)
      const { data: konselingRecords } = await supabase
        .from('konseling_records')
        .select('santri_id, poin')
        .in('santri_id', santriIds)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil');

      const konselingMap = new Map<string, number>();
      (konselingRecords || []).forEach(r => {
        const current = konselingMap.get(r.santri_id) || 0;
        konselingMap.set(r.santri_id, current + (r.poin || 0));
      });

      // 5. Fetch affective scores (average)
      const { data: affectiveScores } = await supabase
        .from('affective_scores')
        .select('santri_id, score')
        .in('santri_id', santriIds)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil');

      const affectiveMap = new Map<string, number[]>();
      (affectiveScores || []).forEach(r => {
        if (!affectiveMap.has(r.santri_id)) {
          affectiveMap.set(r.santri_id, []);
        }
        affectiveMap.get(r.santri_id)!.push(r.score);
      });

      // 6. Fetch saved psikologi reports
      const { data: psikologiReports } = await supabase
        .from('santri_psikologi_reports')
        .select('santri_id')
        .in('santri_id', santriIds)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil');

      const savedReportSet = new Set((psikologiReports || []).map(r => r.santri_id));

      // 7. Map to MonitoringStudent
      return santriList.map((santri): MonitoringStudent => {
        const profile = santri.profiles as { name: string; avatar_url: string | null } | null;
        const affectiveScoresArr = affectiveMap.get(santri.id) || [];
        const avgAffective = affectiveScoresArr.length > 0
          ? Math.round(affectiveScoresArr.reduce((a, b) => a + b, 0) / affectiveScoresArr.length)
          : null;


        return {
          id: santri.id,
          name: profile?.name || 'Unknown',
          nis: santri.nis || '-',
          avatar: profile?.avatar_url || null,
          hasStifin: stifinSet.has(santri.id),
          hasAsesmenAwal: asesmenAwalSet.has(santri.id),
          konselingPoin: konselingMap.get(santri.id) || 0,
          affectiveScore: avgAffective,
          hasSavedReport: savedReportSet.has(santri.id),
        };
      });
    },
    enabled: !!id && !!activeAcademicYear?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const searchLower = search.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(searchLower) || 
      s.nis.includes(search)
    );
  }, [students, search]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = students.length;
    const ready = students.filter(s => s.hasSavedReport).length;
    const notReady = total - ready;
    return { total, ready, notReady };
  }, [students]);

  const isLoading = isLoadingKelas || isLoadingStudents;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Memuat data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kelas) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Data kelas tidak ditemukan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
          
          <div className="relative flex items-start gap-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/admin/penilaian/kelas/${id}`)}
              className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-3">
                <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                  <Brain className="h-8 w-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-primary-foreground mb-3">
                    Raport Psikologi {kelas.nama}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground border-0" />
                    <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 gap-1">
                      Tingkat {kelas.tingkat}
                    </Badge>
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
                  ? 'Apakah Anda yakin ingin unpublish raport ini? Raport psikologi tidak akan ditampilkan di dashboard santri dan orang tua.'
                  : 'Apakah Anda yakin ingin mempublish raport psikologi kelas ini? Raport akan ditampilkan di dashboard santri dan orang tua.'
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

        {/* Filters Row & Table */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari Siswa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Monitoring Card List */}
            <div className="space-y-3">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'Tidak ada siswa yang cocok dengan pencarian' : 'Tidak ada data siswa'}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all duration-200 p-3 lg:p-4"
                  >
                    {/* Mobile Layout */}
                    <div className="lg:hidden space-y-3">
                      {/* Header: Avatar + Name */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.nis}</p>
                        </div>
                        <ActionButtonGroup>
                          <DetailButton onClick={() => navigate(`/admin/penilaian/kelas/${id}/psikologi/${student.id}`)} />
                        </ActionButtonGroup>
                      </div>
                      
                      {/* Badge Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">Stifin</span>
                          <Badge variant={student.hasStifin ? 'success' : 'destructive'} className="text-[10px] px-1.5">
                            {student.hasStifin ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">Asesmen Awal</span>
                          <Badge variant={student.hasAsesmenAwal ? 'success' : 'destructive'} className="text-[10px] px-1.5">
                            {student.hasAsesmenAwal ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">Konseling</span>
                          <Badge variant={student.konselingPoin > 0 ? 'success' : 'destructive'} className="text-[10px] px-1.5">
                            {student.konselingPoin > 0 ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">Asertif</span>
                          <Badge variant={student.affectiveScore !== null ? 'success' : 'destructive'} className="text-[10px] px-1.5">
                            {student.affectiveScore !== null ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="col-span-2 flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">Ringkasan</span>
                          <Badge variant={student.hasSavedReport ? 'success' : 'warning'} className="text-[10px] px-1.5">
                            {student.hasSavedReport ? 'Selesai' : 'Belum Selesai'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden lg:flex lg:items-center lg:gap-4">
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 min-w-0 w-64 shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={student.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.nis}</p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-6 flex-1">
                        <div className="w-28 shrink-0">
                          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Stifin</p>
                          <Badge variant={student.hasStifin ? 'success' : 'destructive'} className="text-xs">
                            {student.hasStifin ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="w-28 shrink-0">
                          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Asesmen Awal</p>
                          <Badge variant={student.hasAsesmenAwal ? 'success' : 'destructive'} className="text-xs">
                            {student.hasAsesmenAwal ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="w-28 shrink-0">
                          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Konseling</p>
                          <Badge variant={student.konselingPoin > 0 ? 'success' : 'destructive'} className="text-xs">
                            {student.konselingPoin > 0 ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="w-28 shrink-0">
                          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Asertif</p>
                          <Badge variant={student.affectiveScore !== null ? 'success' : 'destructive'} className="text-xs">
                            {student.affectiveScore !== null ? 'Tersedia' : 'Tidak Tersedia'}
                          </Badge>
                        </div>
                        <div className="w-28 shrink-0">
                          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Ringkasan</p>
                          <Badge variant={student.hasSavedReport ? 'success' : 'warning'} className="text-xs">
                            {student.hasSavedReport ? 'Selesai' : 'Belum Selesai'}
                          </Badge>
                        </div>
                      </div>

                      {/* Action */}
                      <ActionButtonGroup>
                        <DetailButton onClick={() => navigate(`/admin/penilaian/kelas/${id}/psikologi/${student.id}`)} />
                      </ActionButtonGroup>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </TooltipProvider>
  );
}