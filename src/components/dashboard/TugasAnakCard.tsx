import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, ClipboardList, FileText, Calendar, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { BottomDrawer, BottomDrawerFooter } from '@/components/ui/bottom-drawer';
import { sanitizeHtml } from '@/lib/sanitize';
import { SubmissionFilePreview } from '@/components/mapel/SubmissionFilePreview';

export function TugasAnakCard() {
  const { user } = useAuth();
  const [selectedTugasId, setSelectedTugasId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Get parent's children (with name + kelas)
  const { data: children = [] } = useQuery({
    queryKey: ['parent-children-tugas', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: pc } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      if (!pc?.length) return [];
      const childIds = pc.map((p) => p.child_id);
      const { data: santri } = await supabase
        .from('santri')
        .select('id, kelas_id')
        .in('id', childIds);
      const { data: namesData } = await supabase.rpc('get_profile_names', { _ids: childIds });
      const nameMap: Record<string, string> = {};
      (namesData || []).forEach((p: any) => {
        if (p?.id && p?.name) nameMap[p.id] = p.name;
      });
      return (santri || []).map((s) => ({
        id: s.id,
        kelas_id: s.kelas_id,
        name: nameMap[s.id] || 'Anak',
      }));
    },
    enabled: !!user?.id && user?.role === 'orangtua',
  });

  // Get tugas for all children's classes
  const { data: tugasList = [], isLoading } = useQuery({
    queryKey: ['anak-tugas-aktif', children.map((c) => c.id).join(',')],
    queryFn: async () => {
      if (!children.length) return [];
      const kelasIds = children.map((c) => c.kelas_id).filter(Boolean);
      if (!kelasIds.length) return [];

      const { data: mapelData } = await supabase
        .from('mapel')
        .select('id, nama, kelas_id')
        .in('kelas_id', kelasIds)
        .eq('status', 'aktif');

      const mapelIds = mapelData?.map((m) => m.id) || [];
      if (!mapelIds.length) return [];
      const mapelMap: Record<string, { nama: string; kelas_id: string }> = {};
      mapelData?.forEach((m) => {
        mapelMap[m.id] = { nama: m.nama, kelas_id: m.kelas_id };
      });

      const { data: tugasData } = await supabase
        .from('tugas')
        .select('id, judul, tanggal_deadline, mapel_id')
        .in('mapel_id', mapelIds)
        .eq('status', 'aktif')
        .order('tanggal_deadline', { ascending: true })
        .limit(30);

      const tugasIds = tugasData?.map((t) => t.id) || [];
      if (!tugasIds.length) return [];

      const childIds = children.map((c) => c.id);
      const { data: submittedData } = await supabase
        .from('pengumpulan_tugas')
        .select('tugas_id, santri_id, created_at')
        .in('santri_id', childIds)
        .in('tugas_id', tugasIds);

      const submittedMap: Record<string, Record<string, string>> = {};
      (submittedData || []).forEach((s) => {
        if (!submittedMap[s.tugas_id]) submittedMap[s.tugas_id] = {};
        submittedMap[s.tugas_id][s.santri_id] = s.created_at;
      });

      // Expand: one row per (tugas, child) where child kelas matches mapel kelas
      const rows: any[] = [];
      (tugasData || []).forEach((t) => {
        const m = mapelMap[t.mapel_id];
        if (!m) return;
        const eligibleChildren = children.filter((c) => c.kelas_id === m.kelas_id);
        eligibleChildren.forEach((child) => {
          const submittedAt = submittedMap[t.id]?.[child.id];
          const deadlinePassed = new Date(t.tanggal_deadline) < new Date();
          let submissionStatus: 'sudah' | 'belum' | 'terlambat' = 'belum';
          if (submittedAt) {
            submissionStatus =
              new Date(submittedAt) > new Date(t.tanggal_deadline) ? 'terlambat' : 'sudah';
          } else if (deadlinePassed) {
            submissionStatus = 'terlambat';
          }
          rows.push({
            ...t,
            mapel_nama: m.nama,
            child_id: child.id,
            child_name: child.name,
            submissionStatus,
          });
        });
      });
      return rows.sort(
        (a, b) => new Date(a.tanggal_deadline).getTime() - new Date(b.tanggal_deadline).getTime()
      );
    },
    enabled: children.length > 0,
  });

  // Detail query
  const { data: tugasDetail } = useQuery({
    queryKey: ['anak-tugas-detail', selectedTugasId, selectedChildId],
    queryFn: async () => {
      if (!selectedTugasId || !selectedChildId) return null;
      const { data: t } = await supabase
        .from('tugas')
        .select('id, judul, deskripsi, tanggal_deadline, tipe_jawaban, mapel_id, status, nilai_maksimal')
        .eq('id', selectedTugasId)
        .single();
      const { data: sub } = await supabase
        .from('pengumpulan_tugas')
        .select('id, jawaban_teks, file_url, tanggal_submit, status, nilai, catatan_nilai')
        .eq('tugas_id', selectedTugasId)
        .eq('santri_id', selectedChildId)
        .maybeSingle();
      return { tugas: t, submission: sub };
    },
    enabled: !!selectedTugasId && !!selectedChildId && drawerOpen,
  });

  const handleCardClick = (tugasId: string, childId: string) => {
    setSelectedTugasId(tugasId);
    setSelectedChildId(childId);
    setDrawerOpen(true);
  };

  const getStatusBadge = (
    status: 'sudah' | 'belum' | 'terlambat'
  ): { label: string; variant: 'success' | 'destructive' | 'warning' } => {
    if (status === 'sudah') return { label: 'Selesai', variant: 'success' };
    if (status === 'terlambat') return { label: 'Terlambat', variant: 'destructive' };
    return { label: 'Belum', variant: 'warning' };
  };

  const getRelativeDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffMs < 0) {
      const absMinutes = Math.abs(diffMinutes);
      const absHours = Math.abs(diffHours);
      const absDays = Math.abs(differenceInDays(date, now));
      if (absMinutes < 60) return `Deadline lewat ${absMinutes} menit lalu`;
      if (absHours < 24) return `Deadline lewat ${absHours} jam lalu`;
      if (absDays === 1) return 'Deadline lewat kemarin';
      if (absDays <= 6) return `Deadline lewat ${absDays} hari lalu`;
      return `Deadline lewat sejak ${format(date, 'dd MMM', { locale: idLocale })}`;
    }
    if (diffMinutes < 60) return `Tinggal ${diffMinutes} menit lagi`;
    if (diffHours < 24) return `Tinggal ${diffHours} jam lagi`;
    const days = differenceInDays(date, now);
    if (days === 0) return `Hari ini pukul ${format(date, 'HH:mm', { locale: idLocale })}`;
    if (days === 1) return `Besok pukul ${format(date, 'HH:mm', { locale: idLocale })}`;
    if (days <= 6) return `${days + 1} hari lagi`;
    if (days <= 13) return 'Minggu depan';
    if (days <= 29) return `${Math.floor((days + 1) / 7)} minggu lagi`;
    return format(date, 'dd MMM yyyy', { locale: idLocale });
  };

  const renderDetailContent = () => {
    if (!tugasDetail?.tugas) {
      return (
        <div className="space-y-3 p-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }
    const t = tugasDetail.tugas;
    const submission = tugasDetail.submission;
    const childName = children.find((c) => c.id === selectedChildId)?.name;

    return (
      <div className="space-y-6 pb-6">
        <div className="space-y-4">
          {childName && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Untuk Ananda
              </Label>
              <p className="text-sm font-semibold mt-1">{childName}</p>
            </div>
          )}
          <div>
            <Label className="text-sm font-semibold text-muted-foreground">Deskripsi</Label>
            {t.deskripsi ? (
              <div
                className="text-sm mt-1 prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.deskripsi) }}
              />
            ) : (
              <p className="text-sm mt-1 text-muted-foreground">-</p>
            )}
          </div>
          {t.tanggal_deadline && (
            <div>
              <Label className="text-sm font-semibold text-muted-foreground">Deadline</Label>
              <p className="text-sm mt-1">
                {format(new Date(t.tanggal_deadline), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
              </p>
            </div>
          )}

          {submission?.tanggal_submit ? (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-muted/20 border-2 border-primary/20 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label className="text-base font-bold text-foreground">Status Pengumpulan</Label>
                  <p className="text-xs text-muted-foreground">
                    Detail jawaban yang telah dikumpulkan ananda
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Waktu Pengumpulan
                  </Label>
                  <p className="text-sm font-semibold text-foreground">
                    {format(new Date(submission.tanggal_submit), 'dd MMMM yyyy HH:mm', {
                      locale: idLocale,
                    })}
                  </p>
                </div>

                {submission.jawaban_teks && (
                  <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Jawaban Ananda
                    </Label>
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {submission.jawaban_teks}
                      </p>
                    </div>
                  </div>
                )}

                {submission.file_url && <SubmissionFilePreview fileUrl={submission.file_url} />}

                {(submission.nilai || submission.catatan_nilai) && (
                  <div className="p-3 rounded-xl bg-background/80 border border-primary/20">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                      <Award className="h-3.5 w-3.5" />
                      Hasil Penilaian
                    </Label>
                    <div className="space-y-3">
                      {submission.nilai && (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground">Nilai:</span>
                          <Badge className="px-4 py-1.5 text-lg font-bold bg-primary shadow-sm">
                            {submission.nilai}
                          </Badge>
                        </div>
                      )}
                      {submission.catatan_nilai && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Catatan Guru:
                          </span>
                          <div className="p-3 bg-background rounded-lg border border-border">
                            <p className="text-sm text-foreground leading-relaxed">
                              {submission.catatan_nilai}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                ⚠ Ananda belum mengumpulkan jawaban untuk tugas ini.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full">
        <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
          <CardTitle className="text-sm md:text-lg font-semibold">Tugas Ananda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 md:space-y-3 p-2.5 md:p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5 md:gap-4 p-2 md:p-3">
              <Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-full" />
              <div className="flex-1 space-y-1.5 md:space-y-2">
                <Skeleton className="h-3.5 md:h-4 w-20 md:w-24" />
                <Skeleton className="h-2.5 md:h-3 w-14 md:w-16" />
              </div>
              <Skeleton className="h-5 md:h-6 w-14 md:w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full flex flex-col">
        <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-lg font-semibold">Tugas Ananda</CardTitle>
            <Link
              to="/app/mapel"
              className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
            >
              <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-2.5 md:p-6">
          <div className="flex-1 space-y-1.5 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto">
            {tugasList.length > 0 ? (
              tugasList.map((tugas: any, index: number) => {
                const badge = getStatusBadge(tugas.submissionStatus);
                return (
                  <button
                    key={`${tugas.id}-${tugas.child_id}`}
                    type="button"
                    onClick={() => handleCardClick(tugas.id, tugas.child_id)}
                    className="w-full text-left block group p-2 md:p-3 rounded-lg md:rounded-xl hover:bg-muted/30 transition-all duration-300 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Mobile */}
                    <div className="md:hidden flex items-center gap-2.5">
                      <Avatar className="h-9 w-9 border-2 border-border/50 group-hover:border-primary/30 transition-colors shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-[10px] font-medium text-primary truncate">
                          {tugas.mapel_nama} • {tugas.child_name}
                        </p>
                        <h4 className="font-semibold text-xs text-foreground truncate">
                          {tugas.judul}
                        </h4>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {getRelativeDeadline(tugas.tanggal_deadline)}
                        </p>
                      </div>
                      <Badge
                        variant={badge.variant}
                        className="whitespace-nowrap text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {badge.label}
                      </Badge>
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:flex items-center gap-4">
                      <Avatar className="h-11 w-11 border-2 border-border/50 group-hover:border-primary/30 transition-colors">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <FileText className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-xs font-medium text-primary truncate">
                          {tugas.mapel_nama} • {tugas.child_name}
                        </p>
                        <h4 className="font-semibold text-base text-foreground truncate">
                          {tugas.judul}
                        </h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {getRelativeDeadline(tugas.tanggal_deadline)}
                        </p>
                      </div>
                      <Badge variant={badge.variant} className="whitespace-nowrap text-xs px-2 py-0.5">
                        {badge.label}
                      </Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-5 md:py-8 text-center flex-1">
                <ClipboardList className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground/50 mb-1.5 md:mb-2" />
                <p className="text-xs md:text-sm text-muted-foreground">Tidak ada tugas aktif</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <BottomDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerOpen(false);
            setSelectedTugasId(null);
            setSelectedChildId(null);
          }
        }}
        title={tugasDetail?.tugas?.judul || 'Detail Tugas'}
        icon={<ClipboardList className="h-5 w-5 text-primary" />}
        onClose={() => setDrawerOpen(false)}
        footer={<BottomDrawerFooter onClose={() => setDrawerOpen(false)} closeLabel="Tutup" />}
      >
        {renderDetailContent()}
      </BottomDrawer>
    </>
  );
}
