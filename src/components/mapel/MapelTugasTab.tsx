import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BottomDrawer, BottomDrawerFooter } from '@/components/ui/bottom-drawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ClipboardList, CheckCircle2, Clock, Calendar, FileText, Award, XCircle, Edit, X, ExternalLink, Save, ChevronRight, Upload, AlertCircle, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { parseJakartaDateTime } from '@/lib/dateUtils';
import { Tugas, PengumpulanTugas } from '@/types';
import TugasList from '@/components/tugas/TugasList';
import TugasForm from '@/components/tugas/TugasForm';
import TugasDetail from '@/components/tugas/TugasDetail';
import TugasSubmitForm from '@/components/tugas/TugasSubmitForm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getContentImageUrl } from '@/lib/storageUtils';
import { sanitizeHtml } from '@/lib/sanitize';
import { SubmissionFilePreview } from './SubmissionFilePreview';

interface MapelTugasTabProps {
  mapelId: string;
  userRole: string;
  userId: string;
  tugasList: any[];
  pengumpulanList: any[];
  santriList: any[];
  totalSantri: number;
  selectedSemester: 'ganjil' | 'genap';
  isMapelInfoComplete: () => boolean;
  onShowIncompleteInfoModal: () => void;
  onRefreshTugas: () => Promise<void>;
}

export default function MapelTugasTab({
  mapelId,
  userRole,
  userId,
  tugasList,
  pengumpulanList,
  santriList,
  totalSantri,
  selectedSemester,
  isMapelInfoComplete,
  onShowIncompleteInfoModal,
  onRefreshTugas,
}: MapelTugasTabProps) {
  const { toast } = useToast();
  
  // Local state for tugas management
  const [showTugasSheet, setShowTugasSheet] = useState(false);
  const [showTugasDetailDrawer, setShowTugasDetailDrawer] = useState(false);
  const [tugasView, setTugasView] = useState<'list' | 'detail' | 'submit'>('list');
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);
  const [selectedTugas, setSelectedTugas] = useState<Tugas | undefined>();
  
  // State for unsaved changes protection
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Feedback santri state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Callback to track form changes from TugasSubmitForm
  const handleFormChange = useCallback((hasData: boolean) => {
    setHasUnsavedChanges(hasData);
  }, []);

  const handleOpenFeedbackModal = () => {
    const submission = selectedTugas ? pengumpulanList.find(p => p.tugas_id === selectedTugas.id) : null;
    setFeedbackText(submission?.feedback_santri || '');
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedTugas || !userId) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      toast({ title: 'Feedback wajib diisi', description: 'Silakan tulis feedback Anda terlebih dahulu.', variant: 'destructive' });
      return;
    }
    const submission = pengumpulanList.find(p => p.tugas_id === selectedTugas.id);
    if (!submission) return;
    setSubmittingFeedback(true);
    try {
      const { error } = await supabase
        .from('pengumpulan_tugas')
        .update({ feedback_santri: trimmed })
        .eq('id', submission.id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: 'Feedback berhasil dikirim. Terima kasih!' });
      setShowFeedbackModal(false);
      await onRefreshTugas();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Gagal mengirim feedback', variant: 'destructive' });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Handler functions
  const handleAddTugas = () => {
    if (!isMapelInfoComplete()) {
      onShowIncompleteInfoModal();
      return;
    }
    setSelectedTugas(undefined);
    setShowTugasSheet(true);
  };

  const handleEditTugas = (tugas: Tugas) => {
    const parsedDeadline = parseJakartaDateTime(tugas.tanggal_deadline || tugas.deadline);
    const isDeadlinePassed = !!(parsedDeadline && parsedDeadline.getTime() < Date.now());
    if (tugas.status === 'ditutup' || isDeadlinePassed) {
      toast({
        title: 'Tidak dapat diedit',
        description: 'Tugas yang sudah ditutup atau melewati deadline tidak dapat diedit.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTugas(tugas);
    setShowTugasSheet(true);
  };

  const handleViewTugas = (tugas: Tugas) => {
    console.log('[handleViewTugas] click', { tugasId: tugas.id, status: tugas.status, role: userRole });
    setSelectedTugas(tugas);

    if (userRole === 'santri') {
      const submitted = pengumpulanList.find(p => p.tugas_id === tugas.id && p.santri_id === userId);
      const isTugasClosed = tugas.status === 'ditutup';
      console.log('[handleViewTugas] santri decision', {
        submitted: !!submitted,
        isTugasClosed,
        nextView: !submitted && !isTugasClosed ? 'submit' : 'detail'
      });

      // Always open drawer for santri, set view based on submission status
      if (!submitted && !isTugasClosed) {
        setTugasView('submit');
      } else {
        setTugasView('detail');
      }
      setShowTugasDetailDrawer(true);
    } else {
      setTugasView('detail');
    }
  };

  // Safe close handler - checks for unsaved changes
  const handleRequestClose = () => {
    if (tugasView === 'submit' && hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  // Force close without checking
  const handleForceClose = () => {
    setTugasView('list');
    setSelectedTugas(undefined);
    setIsEditingSubmission(false);
    setShowTugasDetailDrawer(false);
    setHasUnsavedChanges(false);
    setShowDiscardConfirm(false);
  };

  const handleBackToTugasList = () => {
    handleRequestClose();
  };

  const handleSaveTugas = async (tugas: Partial<Tugas>) => {
    console.log('Saving tugas:', tugas);
    await onRefreshTugas();
    setShowTugasSheet(false);
    setSelectedTugas(undefined);
    setTugasView('list');
  };

  const handleCloseTugasSheet = () => {
    setShowTugasSheet(false);
    setSelectedTugas(undefined);
  };

  const handleSubmitTugas = async (jawaban: {
    tipe: 'file' | 'teks' | 'link';
    value: string;
  }) => {
    if (!selectedTugas || !userId) return;
    try {
      const { data: santriData, error: santriError } = await supabase
        .from('santri')
        .select('id')
        .eq('id', userId)
        .single();

      if (santriError || !santriData) {
        toast({
          title: "Error",
          description: "Anda tidak terdaftar sebagai santri. Silakan hubungi admin.",
          variant: "destructive"
        });
        return;
      }

      const { data: existingSubmissionDb } = await supabase
        .from('pengumpulan_tugas')
        .select('id')
        .eq('tugas_id', selectedTugas.id)
        .eq('santri_id', santriData.id)
        .maybeSingle();

      if (existingSubmissionDb) {
        const { error } = await supabase.from('pengumpulan_tugas').update({
          jawaban_teks: jawaban.tipe === 'teks' ? jawaban.value : null,
          file_url: jawaban.tipe === 'file' || jawaban.tipe === 'link' ? jawaban.value : null,
          tanggal_submit: new Date().toISOString(),
          status: 'submitted'
        }).eq('id', existingSubmissionDb.id);

        if (error) throw error;
        toast({
          title: "Berhasil",
          description: "Jawaban berhasil diperbarui"
        });
      } else {
        const { error } = await supabase.from('pengumpulan_tugas').insert({
          tugas_id: selectedTugas.id,
          santri_id: santriData.id,
          jawaban_teks: jawaban.tipe === 'teks' ? jawaban.value : null,
          file_url: jawaban.tipe === 'file' || jawaban.tipe === 'link' ? jawaban.value : null,
          status: 'submitted'
        });
        if (error) throw error;
        toast({
          title: "Berhasil",
          description: "Tugas berhasil dikumpulkan"
        });
      }
      await onRefreshTugas();
      setIsEditingSubmission(false);
      setTugasView('detail');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isEditingSubmission ? "Gagal memperbarui jawaban" : "Gagal mengumpulkan tugas"),
        variant: "destructive"
      });
    }
  };

  const handleEditSubmission = () => {
    setIsEditingSubmission(true);
    setTugasView('submit');
  };

  // Render for guru/admin/walikelas
  const renderGuruView = () => {
    if (tugasView === 'list') {
      return (
        <TugasList
          tugasList={tugasList}
          pengumpulanList={pengumpulanList}
          totalSantri={totalSantri}
          onAdd={handleAddTugas}
          onEdit={handleEditTugas}
          onView={handleViewTugas}
          onRefresh={onRefreshTugas}
        />
      );
    }
    if (tugasView === 'detail' && selectedTugas) {
      return (
        <TugasDetail
          tugas={selectedTugas}
          pengumpulanList={pengumpulanList.filter((p: any) => p.tugasId === selectedTugas.id)}
          santriList={santriList}
          onBack={handleBackToTugasList}
          onEdit={() => handleEditTugas(selectedTugas)}
          onRefresh={onRefreshTugas}
        />
      );
    }
    return null;
  };

  // Render for santri - list view
  const renderSantriListView = () => {
    if (tugasList.length === 0) {
      return (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Belum ada tugas tersedia</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {tugasList.map(tugas => {
          const pengumpulan = pengumpulanList.find(p => p.tugas_id === tugas.id);
          const parsedDeadline = parseJakartaDateTime(tugas.tanggal_deadline || tugas.deadline);
          const isDeadlinePassed = !!(parsedDeadline && parsedDeadline.getTime() < Date.now());
          const isClosed = tugas.status === 'ditutup' || isDeadlinePassed;
          const isGraded = !!(pengumpulan && pengumpulan.nilai !== null && pengumpulan.nilai !== undefined);

          return (
            <Card 
              key={tugas.id} 
              className="rounded-2xl border-2 border-border/50 hover:border-primary/20 transition-all duration-300 cursor-pointer bg-card shadow-sm"
              onClick={() => handleViewTugas(tugas)}
            >
              <CardContent className="p-4 md:p-5">
                {/* Main Row */}
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pengumpulan ? 'bg-muted' : 'bg-primary/10'}`}>
                      <ClipboardList className={`w-6 h-6 ${pengumpulan ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {tugas.judul}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {tugas.deskripsi ? (tugas.deskripsi.replace(/<[^>]*>/g, '').slice(0, 60) + (tugas.deskripsi.length > 60 ? '...' : '')) : 'Tidak ada deskripsi'}
                    </p>
                  </div>
                  
                  {/* Status Badge - Desktop */}
                  <div className="flex-shrink-0 hidden sm:block">
                    {isGraded ? (
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-transparent"
                      >
                        Sudah Dinilai
                      </Badge>
                    ) : isClosed ? (
                      <Badge 
                        variant="outline" 
                        className={tugas.status === 'ditutup' ? "bg-muted text-muted-foreground border-transparent" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-transparent"}
                      >
                        {tugas.status === 'ditutup' ? 'Ditutup' : 'Berakhir'}
                      </Badge>
                    ) : pengumpulan ? (
                      <Badge 
                        variant="outline" 
                        className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent"
                      >
                        Sudah Dikumpulkan
                      </Badge>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent"
                      >
                        Belum Dikumpulkan
                      </Badge>
                    )}
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </div>
                
                {/* Info Row */}
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground">
                  {/* Deadline */}
                  {tugas.tanggal_deadline && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDistanceToNow(new Date(tugas.tanggal_deadline), { addSuffix: true, locale: idLocale })}</span>
                    </div>
                  )}
                  
                  {/* Mobile status */}
                  <div className="sm:hidden ml-auto">
                    {isGraded ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-transparent"
                      >
                        Dinilai
                      </Badge>
                    ) : isClosed ? (
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 h-4 border-transparent ${tugas.status === 'ditutup' ? "bg-muted text-muted-foreground" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                      >
                        {tugas.status === 'ditutup' ? 'Ditutup' : 'Berakhir'}
                      </Badge>
                    ) : pengumpulan ? (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent"
                      >
                        Dikumpulkan
                      </Badge>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent"
                      >
                        Belum
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // Render for santri - detail view content (used inside Drawer)
  const renderSantriDetailContent = () => {
    if (!selectedTugas) return null;

    const submission = pengumpulanList.find(p => p.tugas_id === selectedTugas.id);
    const parsedDeadline = parseJakartaDateTime(selectedTugas.tanggal_deadline || selectedTugas.deadline);
    const isDeadlinePassed = !!(parsedDeadline && parsedDeadline.getTime() < Date.now());
    const canEdit = submission?.tanggal_submit && !isDeadlinePassed && !submission.nilai;

    return (
      <div className="space-y-6 pb-6">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-muted-foreground">Deskripsi</Label>
            {selectedTugas.deskripsi ? (
              <div
                className="text-sm mt-1 prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedTugas.deskripsi) }}
              />
            ) : (
              <p className="text-sm mt-1 text-muted-foreground">-</p>
            )}
          </div>
          {(selectedTugas.tanggal_deadline || selectedTugas.deadline) && (
            <div>
              <Label className="text-sm font-semibold text-muted-foreground">Deadline</Label>
              <p className="text-sm mt-1">
                {format(new Date(selectedTugas.tanggal_deadline || selectedTugas.deadline), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
              </p>
            </div>
          )}
          
          {/* Submission Status Card */}
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
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words overflow-wrap-anywhere [overflow-wrap:anywhere]">
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
                      {submission.feedback_santri ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Pesanmu:
                            </span>
                            <Button variant="ghost" size="sm" onClick={handleOpenFeedbackModal} className="h-7 px-2 text-xs gap-1">
                              <Edit className="h-3 w-3" />
                              Ubah
                            </Button>
                          </div>
                          <div className="p-3 bg-background rounded-lg border border-border">
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                              {submission.feedback_santri}
                            </p>
                          </div>
                        </div>
                      ) : submission.nilai ? (
                        <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <span>Yuk, tulis pesan untuk gurumu!</span>
                          </div>
                          <Button size="sm" onClick={handleOpenFeedbackModal} className="rounded-lg gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Tulis Pesan
                          </Button>
                        </div>
                      ) : null}
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

  // Render santri view - always show list, drawer handles detail/submit
  const renderSantriView = () => {
    return <div className="space-y-4">{renderSantriListView()}</div>;
  };

  // Render submit form content (used inside Drawer)
  const renderSantriSubmitContent = () => {
    if (!selectedTugas) return null;

    return (
      <TugasSubmitForm
        tugas={selectedTugas}
        onBack={handleBackToTugasList}
        onSubmit={handleSubmitTugas}
        existingSubmission={isEditingSubmission ? pengumpulanList.find(p => p.tugas_id === selectedTugas.id) : undefined}
        isEditing={isEditingSubmission}
        inDrawer={true}
        onFormChange={handleFormChange}
      />
    );
  };

  return (
    <>
      {/* Main Content */}
      {userRole === 'guru' || userRole === 'walikelas' || userRole === 'admin' || userRole === 'Pembina'
        ? renderGuruView()
        : userRole === 'santri'
        ? renderSantriView()
        : null}
      
      {/* Feedback Santri Modal - mandatory after grading */}
      <Dialog
        open={showFeedbackModal}
        onOpenChange={(open) => {
          if (submittingFeedback) return;
          setShowFeedbackModal(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle>Tulis Pesan untuk Guru</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Tugasmu sudah dinilai gurumu. Tulis kesan, pendapat, atau pertanyaanmu tentang tugas ini, ya!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="feedback-text" className="text-sm font-medium">
              Pesanmu <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="feedback-text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Contoh: Terima kasih, Bu/Pak! Tugasnya seru, tapi bagian ... agak sulit buatku..."
              rows={5}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {feedbackText.length}/1000
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || !feedbackText.trim()}
              className="w-full sm:w-auto"
            >
              {submittingFeedback ? 'Mengirim...' : 'Kirim Pesan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Changes Confirmation Dialog */}
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
            <AlertDialogAction 
              onClick={handleForceClose}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Tugas Detail/Submit Drawer for Santri */}
      <BottomDrawer 
        open={showTugasDetailDrawer} 
        onOpenChange={(open) => {
          if (!open) {
            handleRequestClose();
          } else {
            setShowTugasDetailDrawer(true);
          }
        }}
        title={selectedTugas?.judul}
        icon={<ClipboardList className="h-5 w-5 text-primary" />}
        onClose={handleRequestClose}
        footer={
          <BottomDrawerFooter
            onClose={handleRequestClose}
            closeLabel={tugasView === 'submit' ? 'Batal' : 'Tutup'}
            primaryAction={tugasView === 'submit' ? {
              label: isEditingSubmission ? 'Perbarui Jawaban' : 'Kirim Tugas',
              icon: <Upload className="h-4 w-4 mr-2" />,
              onClick: () => {
                const submitBtn = document.querySelector('[data-tugas-submit]') as HTMLButtonElement;
                submitBtn?.click();
              }
            } : undefined}
          />
        }
      >
        {tugasView === 'submit' ? renderSantriSubmitContent() : renderSantriDetailContent()}
      </BottomDrawer>
      
      {/* Tugas Form Sheet */}
      <Sheet open={showTugasSheet} onOpenChange={setShowTugasSheet}>
        <SheetContent side="full" className="p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-muted/30 to-muted/10 flex-shrink-0 flex-row items-center justify-between">
            <SheetTitle>
              {selectedTugas ? 'Edit Tugas' : 'Tambah Tugas Baru'}
            </SheetTitle>
            <button onClick={() => setShowTugasSheet(false)} className="p-2 rounded-lg bg-muted/50 hover:bg-muted opacity-70 hover:opacity-100 transition-all">
              <X className="h-5 w-5" />
            </button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 pt-3 pb-6">
              <TugasForm
                tugas={selectedTugas}
                mapelId={mapelId}
                semester={selectedSemester}
                onBack={handleCloseTugasSheet}
                onSave={handleSaveTugas}
                renderFooter={false}
              />
            </div>
          </div>
          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={handleCloseTugasSheet} className="rounded-xl">
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button
                onClick={() => {
                  const saveBtn = document.querySelector('[data-tugas-save]') as HTMLButtonElement;
                  saveBtn?.click();
                }}
                className="rounded-xl"
              >
                <Save className="h-4 w-4 mr-2" />
                Simpan Tugas
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
