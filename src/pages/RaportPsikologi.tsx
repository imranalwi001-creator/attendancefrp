import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Brain, Lock, User, TrendingUp, TrendingDown, Minus, Trophy, AlertOctagon, CheckCircle2, ScrollText, Sparkles, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface StifinData {
  tipe_stifin?: string | null;
  kecerdasan_dominan?: string | null;
  deskripsi?: string | null;
  kekuatan?: string[];
  kelemahan?: string[];
  gaya_belajar?: string | null;
}

interface AffectiveDetail {
  indicator_name: string;
  category_name: string;
  score: number;
}

interface KonselingLog {
  id: string;
  date: string;
  title: string;
  type: 'pelanggaran' | 'prestasi';
  point: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getPredikat(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Sangat Baik', color: 'text-emerald-600' };
  if (score >= 75) return { label: 'Baik', color: 'text-blue-600' };
  if (score >= 60) return { label: 'Cukup', color: 'text-amber-600' };
  return { label: 'Perlu Perhatian', color: 'text-red-600' };
}

export default function RaportPsikologi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeAcademicYear, currentSemester } = useAcademicYear();
  
  const isOrangtua = user?.role === 'orangtua';
  const [selectedChildId, setSelectedChildId] = useState<string | null>(searchParams.get('childId'));

  // Fetch children for orangtua
  const { data: childrenData = [] } = useQuery({
    queryKey: ['parent-children-raport-psikologi', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: parentChildren } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      
      if (!parentChildren || parentChildren.length === 0) return [];

      const childIds = parentChildren.map(pc => pc.child_id);

      const { data: santriData } = await supabase
        .from('santri')
        .select('id, kelas_id')
        .in('id', childIds);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', childIds);

      return (santriData || []).map(santri => {
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

  const effectiveChildId = selectedChildId || (childrenData.length > 0 ? childrenData[0].id : null);
  const selectedChild = childrenData.find(c => c.id === effectiveChildId);
  const santriId = isOrangtua ? effectiveChildId : user?.id;

  // Get santri's kelas_id
  const { data: santriData } = useQuery({
    queryKey: ['santri-kelas-psikologi', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data } = await supabase
        .from('santri')
        .select('kelas_id, nis')
        .eq('id', santriId)
        .single();
      return data;
    },
    enabled: !!santriId
  });

  const { data: profileData } = useQuery({
    queryKey: ['santri-profile-psikologi', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', santriId)
        .single();
      return data;
    },
    enabled: !!santriId
  });

  const kelasId = isOrangtua ? selectedChild?.kelas_id : santriData?.kelas_id;

  // Check psikologi finalization
  const { data: isFinalized, isLoading: isLoadingFinalization } = useQuery({
    queryKey: ['psikologi-finalization-check', kelasId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!kelasId || !activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('psikologi_finalization')
        .select('is_finalized')
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil')
        .eq('is_finalized', true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id
  });

  // Fetch saved psikologi report
  const { data: savedReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['santri-psikologi-report', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id) return null;
      const { data } = await supabase
        .from('santri_psikologi_reports')
        .select('summary, language_style, updated_at')
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil')
        .maybeSingle();
      return data;
    },
    enabled: !!santriId && !!activeAcademicYear?.id && isFinalized === true
  });

  // Fetch STIFIN data
  const { data: stifinData, isLoading: isLoadingStifin } = useQuery({
    queryKey: ['santri-stifin-raport', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data } = await supabase
        .from('santri_stifin_results')
        .select('tipe_stifin, kecerdasan_dominan, deskripsi, kekuatan, kelemahan, gaya_belajar')
        .eq('santri_id', santriId)
        .maybeSingle();
      return data as StifinData | null;
    },
    enabled: !!santriId && isFinalized === true
  });

  // Fetch affective data
  const { data: affectiveData, isLoading: isLoadingAffective } = useQuery({
    queryKey: ['santri-affective-raport', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id) return null;
      const { data: scores } = await supabase
        .from('affective_scores')
        .select(`
          score,
          affective_indicators!inner(
            name,
            affective_categories!inner(name)
          )
        `)
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil');

      if (!scores || scores.length === 0) return null;

      const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
      const avgScore = Math.round(totalScore / scores.length);

      const details: AffectiveDetail[] = scores.map(s => {
        const indicator = s.affective_indicators as { name: string; affective_categories: { name: string } };
        return {
          indicator_name: indicator?.name || '',
          category_name: indicator?.affective_categories?.name || '',
          score: s.score
        };
      });

      // Group by category
      const grouped = details.reduce((acc, d) => {
        if (!acc[d.category_name]) acc[d.category_name] = [];
        acc[d.category_name].push(d);
        return acc;
      }, {} as Record<string, AffectiveDetail[]>);

      return { totalScore: avgScore, grouped };
    },
    enabled: !!santriId && !!activeAcademicYear?.id && isFinalized === true
  });

  // Fetch konseling data
  const { data: konselingData, isLoading: isLoadingKonseling } = useQuery({
    queryKey: ['santri-konseling-raport', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id) return null;
      const { data } = await supabase
        .from('konseling_records')
        .select('id, tipe, kategori, poin, tanggal')
        .eq('santri_id', santriId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester || 'ganjil')
        .order('tanggal', { ascending: false });

      if (!data || data.length === 0) return null;

      const logs: KonselingLog[] = data.map(r => ({
        id: r.id,
        date: r.tanggal,
        title: r.kategori,
        type: r.tipe as 'pelanggaran' | 'prestasi',
        point: r.poin
      }));

      const prestasiPoints = logs.filter(l => l.type === 'prestasi').reduce((sum, l) => sum + l.point, 0);
      const pelanggaranPoints = logs.filter(l => l.type === 'pelanggaran').reduce((sum, l) => sum + l.point, 0);
      const totalPoints = Math.max(0, Math.min(100 - pelanggaranPoints + prestasiPoints, 200));

      return { totalPoints, prestasiPoints, pelanggaranPoints, logs };
    },
    enabled: !!santriId && !!activeAcademicYear?.id && isFinalized === true
  });

  const isLoading = isLoadingFinalization || isLoadingReport;

  return (
    <div className="space-y-6 pb-24">
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
                <Brain className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-2">
                  Raport Psikologi
                </h1>
                <p className="text-primary-foreground/80 text-sm">
                  Hasil asesmen psikologi dan perkembangan santri
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground border-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="py-8 space-y-4">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Not Finalized State */}
      {!isLoading && !isFinalized && (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="py-16">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  Raport Belum Tersedia
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Raport psikologi untuk semester ini belum dipublikasikan oleh pihak sekolah. 
                  Silakan cek kembali nanti.
                </p>
              </div>
              <Badge variant="secondary" className="mt-4">
                Menunggu Publikasi
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finalized Content */}
      {!isLoading && isFinalized && (
        <div className="space-y-6">
          {/* Santri Profile Card */}
          <Card className="rounded-2xl border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profileData?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(profileData?.name || 'S')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{profileData?.name || 'Santri'}</h2>
                  <p className="text-sm text-muted-foreground">NIS: {santriData?.nis || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ringkasan AI (Summary) */}
          {savedReport?.summary && (
            <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/10">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Ringkasan Psikologi
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap">
                  {savedReport.summary}
                </div>
                {savedReport.updated_at && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Diperbarui: {format(new Date(savedReport.updated_at), 'd MMMM yyyy', { locale: localeId })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* STIFIN Section */}
          {stifinData && stifinData.tipe_stifin && (
            <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-500/5 to-violet-500/10 border-b border-violet-500/10">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-violet-600" />
                  Profil STIFIN
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{stifinData.tipe_stifin?.charAt(0) || '?'}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{stifinData.tipe_stifin}</h3>
                    {stifinData.kecerdasan_dominan && (
                      <p className="text-sm text-muted-foreground">{stifinData.kecerdasan_dominan}</p>
                    )}
                  </div>
                </div>

                {stifinData.deskripsi && (
                  <p className="text-sm text-foreground/80">{stifinData.deskripsi}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stifinData.kekuatan && stifinData.kekuatan.length > 0 && (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                      <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Kekuatan
                      </h4>
                      <ul className="text-sm space-y-1 text-foreground/80">
                        {stifinData.kekuatan.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {stifinData.kelemahan && stifinData.kelemahan.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                      <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Area Pengembangan
                      </h4>
                      <ul className="text-sm space-y-1 text-foreground/80">
                        {stifinData.kelemahan.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {stifinData.gaya_belajar && (
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <ScrollText className="h-4 w-4" />
                      Gaya Belajar
                    </h4>
                    <p className="text-sm text-foreground/80">{stifinData.gaya_belajar}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Affective Score Section */}
          {affectiveData && (
            <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-rose-500/5 to-rose-500/10 border-b border-rose-500/10">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-rose-600" />
                    Penilaian Afektif
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{affectiveData.totalScore}</span>
                    <span className={`text-sm font-medium ${getPredikat(affectiveData.totalScore).color}`}>
                      {getPredikat(affectiveData.totalScore).label}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {Object.entries(affectiveData.grouped).map(([category, indicators]) => {
                  const categoryAvg = Math.round(
                    indicators.reduce((sum, i) => sum + i.score, 0) / indicators.length
                  );
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-foreground">{category}</span>
                        <span className="text-sm font-semibold">{categoryAvg}/100</span>
                      </div>
                      <Progress value={categoryAvg} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Konseling Section */}
          {konselingData && (
            <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-amber-500/5 to-amber-500/10 border-b border-amber-500/10">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-600" />
                    Catatan Konseling
                  </div>
                  <Badge variant="outline" className="text-sm">
                    Skor: {konselingData.totalPoints}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-center">
                    <Trophy className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">+{konselingData.prestasiPoints}</p>
                    <p className="text-xs text-muted-foreground">Poin Prestasi</p>
                  </div>
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-center">
                    <AlertOctagon className="h-6 w-6 text-red-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">-{konselingData.pelanggaranPoints}</p>
                    <p className="text-xs text-muted-foreground">Poin Pelanggaran</p>
                  </div>
                </div>

                {konselingData.logs.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground">Catatan Terbaru</h4>
                    {konselingData.logs.slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          {log.type === 'prestasi' ? (
                            <Trophy className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertOctagon className="h-4 w-4 text-red-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{log.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.date), 'd MMM yyyy', { locale: localeId })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={log.type === 'prestasi' ? 'success' : 'destructive'} className="text-xs">
                          {log.type === 'prestasi' ? '+' : '-'}{log.point}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No Data State */}
          {!savedReport?.summary && !stifinData && !affectiveData && !konselingData && (
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                    <Brain className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      Data Psikologi Belum Tersedia
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Belum ada data psikologi yang tercatat untuk semester ini.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
