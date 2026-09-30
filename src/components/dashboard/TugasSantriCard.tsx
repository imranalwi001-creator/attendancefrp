import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, ClipboardList, FileText, Calendar, Award, Edit, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { BottomDrawer, BottomDrawerFooter } from '@/components/ui/bottom-drawer';
import { parseJakartaDateTime } from '@/lib/dateUtils';
import { sanitizeHtml } from '@/lib/sanitize';
import { SubmissionFilePreview } from '@/components/mapel/SubmissionFilePreview';
import TugasSubmitForm from '@/components/tugas/TugasSubmitForm';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';
import { Tugas } from '@/types';

export function TugasSantriCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTugasId, setSelectedTugasId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<'detail' | 'submit'>('detail');
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { data: kelasId } = useQuery({
    queryKey: ['santri-kelas-tugas', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('santri')
        .select('kelas_id')
        .eq('id', user.id)
        .maybeSingle();
      return data?.kelas_id || null;
    },
    enabled: !!user?.id && user?.role === 'santri',
  });

  const { data: tugasList = [], isLoading } = useQuery({
    queryKey: ['santri-tugas-aktif', kelasId, user?.id],
    queryFn: async () => {
      if (!kelasId || !user?.id) return [];

      const { data: mapelData } = await supabase
        .from('mapel')
        .select('id, nama')
        .eq('kelas_id', kelasId)
        .eq('status', 'aktif');

      const mapelIds = mapelData?.map((m) => m.id) || [];
      if (mapelIds.length === 0) return [];
      const mapelMap: Record<string, string> = {};
      mapelData?.forEach((m) => {
        mapelMap[m.id] = m.nama;
      });

      const { data: tugasData } = await supabase
        .from('tugas')
        .select('id, judul, tanggal_deadline, mapel_id, created_at')
        .in('mapel_id', mapelIds)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false })
        .limit(20);

      const tugasIds = tugasData?.map((t) => t.id) || [];
      if (tugasIds.length === 0) return [];

      const { data: submittedData } = await supabase
        .from('pengumpulan_tugas')
        .select('tugas_id, created_at, nilai')
        .eq('santri_id', user.id)
        .in('tugas_id', tugasIds);

      const submittedMap: Record<string, { created_at: string; nilai: number | null }> = {};
      (submittedData || []).forEach((s) => {
        submittedMap[s.tugas_id] = { created_at: s.created_at, nilai: s.nilai };
      });

      return (tugasData || []).map((t) => {
        const sub = submittedMap[t.id];
        const submittedAt = sub?.created_at;
        const deadlinePassed = new Date(t.tanggal_deadline) < new Date();
        let submissionStatus: 'sudah' | 'belum' | 'terlambat' | 'dinilai' = 'belum';
        if (submittedAt) {
          if (sub?.nilai !== null && sub?.nilai !== undefined) {
            submissionStatus = 'dinilai';
          } else {
            submissionStatus = new Date(submittedAt) > new Date(t.tanggal_deadline) ? 'terlambat' : 'sudah';
          }
        } else if (deadlinePassed) {
          submissionStatus = 'terlambat';
        }
        return {
          ...t,
          mapel_nama: mapelMap[t.mapel_id] || 'Mata Pelajaran',
          submissionStatus,
          hasSubmission: !!submittedAt,
        };
      });
    },
    enabled: !!kelasId && !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Realtime: refresh list saat guru publish/ubah/hapus tugas
  useEffect(() => {
    if (!kelasId || !user?.id) return;
    const channel = supabase
      .channel(`santri-tugas-realtime-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tugas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['santri-tugas-aktif'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [kelasId, user?.id, queryClient]);

  // Fetch detail tugas + submission ketika drawer dibuka
  const { data: tugasDetail } = useQuery({
    queryKey: ['santri-tugas-detail', selectedTugasId, user?.id],
    queryFn: async () => {
      if (!selectedTugasId || !user?.id) return null;
      const { data: t } = await supabase
        .from('tugas')
        .select('id, judul, deskripsi, tanggal_deadline, tanggal_mulai, tipe_jawaban, mapel_id, status, nilai_maksimal')
        .eq('id', selectedTugasId)
        .single();
      const { data: sub } = await supabase
        .from('pengumpulan_tugas')
        .select('id, tugas_id, santri_id, jawaban_teks, file_url, tanggal_submit, status, nilai, catatan_nilai')
        .eq('tugas_id', selectedTugasId)
        .eq('santri_id', user.id)
        .maybeSingle();
      return { tugas: t, submission: sub };
    },
    enabled: !!selectedTugasId && !!user?.id && drawerOpen,
  });

  const handleCardClick = (tugasId: string, submissionStatus: 'sudah' | 'belum' | 'terlambat' | 'dinilai', hasSubmission: boolean) => {
    setSelectedTugasId(tugasId);
    setIsEditingSubmission(false);
    // Buka form submit jika santri belum mengumpulkan (termasuk yang sudah lewat deadline)
    setDrawerView(!hasSubmission ? 'submit' : 'detail');
    setDrawerOpen(true);
  };

  const handleRequestClose = () => {
    if (drawerView === 'submit' && hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setDrawerOpen(false);
    setSelectedTugasId(null);
    setIsEditingSubmission(false);
    setHasUnsavedChanges(false);
    setShowDiscardConfirm(false);
    setDrawerView('detail');
  };

  const handleEditSubmission = () => {
    setIsEditingSubmission(true);
    setDrawerView('submit');
  };

  const handleSubmit = async (jawaban: { tipe: 'file' | 'teks' | 'link'; value: string }) => {
    if (!tugasDetail?.tugas || !user?.id) return;
    try {
      const { data: santriData, error: santriError } = await supabase
        .from('santri').select('id').eq('id', user.id).single();
      if (santriError || !santriData) {
        toast({ title: 'Error', description: 'Anda tidak terdaftar sebagai santri.', variant: 'destructive' });
        return;
      }
      const existing = tugasDetail.submission;
      if (existing) {
        const { error } = await supabase.from('pengumpulan_tugas').update({
          jawaban_teks: jawaban.tipe === 'teks' ? jawaban.value : null,
          file_url: jawaban.tipe === 'file' || jawaban.tipe === 'link' ? jawaban.value : null,
          tanggal_submit: new Date().toISOString(),
          status: 'submitted',
        }).eq('id', existing.id);
        if (error) throw error;
        toast({ title: 'Berhasil', description: 'Jawaban berhasil diperbarui' });
      } else {
        const { error } = await supabase.from('pengumpulan_tugas').insert({
          tugas_id: tugasDetail.tugas.id,
          santri_id: santriData.id,
          jawaban_teks: jawaban.tipe === 'teks' ? jawaban.value : null,
          file_url: jawaban.tipe === 'file' || jawaban.tipe === 'link' ? jawaban.value : null,
          status: 'submitted',
        });
        if (error) throw error;
        toast({ title: 'Berhasil', description: 'Tugas berhasil dikumpulkan' });
      }
      await queryClient.invalidateQueries({ queryKey: ['santri-tugas-detail', selectedTugasId, user.id] });
      await queryClient.invalidateQueries({ queryKey: ['santri-tugas-aktif'] });
      setHasUnsavedChanges(false);
      setIsEditingSubmission(false);
      setDrawerView('detail');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Gagal mengirim tugas', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: 'sudah' | 'belum' | 'terlambat' | 'dinilai'): { label: string; variant: 'success' | 'destructive' | 'warning' | 'default' } => {
    if (status === 'dinilai') return { label: 'Sudah Dinilai', variant: 'default' };
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

  // Detail content (santri) — mirroring MapelTugasTab.renderSantriDetailContent
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
    const parsedDeadline = parseJakartaDateTime(t.tanggal_deadline);
    const isDeadlinePassed = !!(parsedDeadline && parsedDeadline.getTime() < Date.now());
    const canEdit = submission?.tanggal_submit && !isDeadlinePassed && !submission.nilai;

    return (
      <div className="space-y-6 pb-6">
        <div className="space-y-4">
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

          {submission?.tanggal_submit && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-muted/20 border-2 border-primary/20 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-base font-bold text-foreground">
                      Status Pengumpulan
                    </Label>
                    <p className="text-xs text-muted-foreground">Detail jawaban yang telah dikumpulkan</p>
                  </div>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleEditSubmission} className="rounded-xl h-8 gap-2 border-primary/20 hover:bg-primary/10">
                    <Edit className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Edit Jawaban</span>
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Waktu Pengumpulan
                  </Label>
                  <p className="text-sm font-semibold text-foreground">
                    {format(new Date(submission.tanggal_submit), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
                  </p>
                </div>

                {submission.jawaban_teks && (
                  <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Jawaban Anda
                    </Label>
                    <div className="p-3 bg-background rounded-lg border border-border">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">
                        {submission.jawaban_teks}
                      </p>
                    </div>
                  </div>
                )}

                {submission.file_url && (
                  <SubmissionFilePreview fileUrl={submission.file_url} />
                )}

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
                          <Badge className="px-4 py-1.5 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                            {submission.nilai}
                          </Badge>
                        </div>
                      )}
                      {submission.catatan_nilai && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Catatan Guru:</span>
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
          )}
        </div>
      </div>
    );
  };

  const renderSubmitContent = () => {
    if (!tugasDetail?.tugas) return null;
    const tugasForForm = {
      ...tugasDetail.tugas,
      deadline: tugasDetail.tugas.tanggal_deadline,
      tipeJawaban: tugasDetail.tugas.tipe_jawaban,
      mapelId: tugasDetail.tugas.mapel_id,
    } as unknown as Tugas;
    return (
      <TugasSubmitForm
        tugas={tugasForForm}
        onBack={handleRequestClose}
        onSubmit={handleSubmit}
        existingSubmission={isEditingSubmission ? tugasDetail.submission || undefined : undefined}
        isEditing={isEditingSubmission}
        inDrawer={true}
        onFormChange={setHasUnsavedChanges}
      />
    );
  };

  if (isLoading) {
    return (
      <Card className="border hover:border-primary/30 transition-all duration-300 shadow-sm rounded-xl md:rounded-2xl h-full">
        <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-2 md:pb-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-t-xl md:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-lg font-semibold">Yuk Kerjakan Tugas! ✨</CardTitle>
            <Link
              to="/app/mapel"
              className="h-7 w-7 md:h-9 md:w-9 rounded-lg border border-border/40 bg-card/50 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-105 transition-all duration-300 flex items-center justify-center"
            >
              <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Link>
          </div>
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
            <CardTitle className="text-sm md:text-lg font-semibold">Yuk Kerjakan Tugas! ✨</CardTitle>
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
                    key={tugas.id}
                    type="button"
                    onClick={() => handleCardClick(tugas.id, tugas.submissionStatus, tugas.hasSubmission)}
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
                          {tugas.mapel_nama}
                        </p>
                        <h4 className="font-semibold text-xs text-foreground truncate">
                          {tugas.judul}
                        </h4>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {getRelativeDeadline(tugas.tanggal_deadline)}
                        </p>
                      </div>
                      <Badge variant={badge.variant} className="whitespace-nowrap text-[10px] px-1.5 py-0 shrink-0">
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
                          {tugas.mapel_nama}
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
                <p className="text-xs md:text-sm text-muted-foreground">
                  Tidak ada tugas aktif
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Discard confirm */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="animate-scale-in">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDialogTitle>Batalkan Pengisian?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              Anda memiliki jawaban yang belum disimpan. Apakah Anda yakin ingin menutup tanpa menyimpan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Kembali ke Form</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceClose} className="rounded-xl bg-destructive hover:bg-destructive/90">
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail / Submit Drawer */}
      <BottomDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) handleRequestClose();
          else setDrawerOpen(true);
        }}
        title={tugasDetail?.tugas?.judul || 'Detail Tugas'}
        icon={<ClipboardList className="h-5 w-5 text-primary" />}
        onClose={handleRequestClose}
        footer={
          <BottomDrawerFooter
            onClose={handleRequestClose}
            closeLabel={drawerView === 'submit' ? 'Batal' : 'Tutup'}
            primaryAction={drawerView === 'submit' ? {
              label: isEditingSubmission ? 'Perbarui Jawaban' : 'Kirim Tugas',
              icon: <Upload className="h-4 w-4 mr-2" />,
              onClick: () => {
                const submitBtn = document.querySelector('[data-tugas-submit]') as HTMLButtonElement;
                submitBtn?.click();
              },
            } : undefined}
          />
        }
      >
        {drawerView === 'submit' ? renderSubmitContent() : renderDetailContent()}
      </BottomDrawer>
    </>
  );
}
