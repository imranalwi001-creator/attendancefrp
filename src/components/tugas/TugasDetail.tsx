import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Printer } from 'lucide-react';
import { ActionButtonGroup } from '@/components/ui/action-buttons';
import { Tugas, PengumpulanTugas, User } from '@/types';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  TugasDetailHeader,
  TugasInfoCard,
  SubmissionList,
  EmptySubmissionList,
  SelectedSubmissionPanel,
  CloseConfirmDialog
} from './detail';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PrintButton, TugasSubmissionsPrintReport } from '@/components/print';
import { PrintTugasQrDialog } from './qr/PrintTugasQrDialog';

interface TugasDetailProps {
  tugas: Tugas;
  pengumpulanList: PengumpulanTugas[];
  santriList: User[];
  mapelNama?: string;
  kelasNama?: string;
  signer?: { name: string; jabatan: string; nip?: string };
  onBack: () => void;
  onEdit: () => void;
  onRefresh?: () => void;
}

export default function TugasDetail({
  tugas,
  pengumpulanList,
  santriList,
  mapelNama,
  kelasNama,
  signer,
  onBack,
  onEdit,
  onRefresh
}: TugasDetailProps) {
  const [grades, setGrades] = useState<Record<string, { nilai: number; komentar: string }>>({});
  const [selectedSubmission, setSelectedSubmission] = useState<PengumpulanTugas | null>(
    pengumpulanList.length > 0 ? pengumpulanList[0] : null
  );
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [editedSubmissions, setEditedSubmissions] = useState<Set<string>>(new Set());
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [activeFileUrl, setActiveFileUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printQrOpen, setPrintQrOpen] = useState(false);
  const isSelectedGraded = !!selectedSubmission && selectedSubmission.nilai != null;

  // Reset zoom + active file when submission changes
  const handleSelectSubmission = (submission: PengumpulanTugas) => {
    setSelectedSubmission(submission);
    setImageZoom(1);
    setActiveFileUrl(null);
  };

  useEffect(() => {
    if (!selectedSubmission) return;
    const urls = selectedSubmission.jawaban.value
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);
    setActiveFileUrl(urls[0] || null);
  }, [selectedSubmission?.id]);

  // Check if deadline has passed
  const isDeadlinePassed = useMemo(() => {
    if (!tugas.deadline) return false;
    return new Date(tugas.deadline) < new Date();
  }, [tugas.deadline]);

  const deadlineLabel = useMemo(() => {
    const d: any = (tugas as any).deadline || (tugas as any).tanggal_deadline;
    if (!d) return null;
    try {
      return format(new Date(d), 'dd MMM yyyy, HH:mm', { locale: idLocale });
    } catch {
      return null;
    }
  }, [tugas]);

  const mapelIdForPrint = (tugas as any).mapelId || (tugas as any).mapel_id || (tugas as any).mapelId;

  // Statistics
  const stats = useMemo(() => {
    const total = santriList.length;
    const submitted = pengumpulanList.length;
    const graded = pengumpulanList.filter(p => p.nilai != null).length;
    const pending = submitted - graded;
    return { total, submitted, graded, pending };
  }, [santriList.length, pengumpulanList]);

  const hasUngradedSubmissions = pengumpulanList.some(p => p.nilai == null);

  const handleGradeChange = useCallback((submissionId: string, field: 'nilai' | 'komentar', value: string | number) => {
    setGrades(prev => ({
      ...prev,
      [submissionId]: {
        nilai: prev[submissionId]?.nilai || 0,
        komentar: prev[submissionId]?.komentar || '',
        [field]: value
      }
    }));
    setEditedSubmissions(prev => new Set(prev).add(submissionId));
  }, []);

  const handleSaveGrade = useCallback(async (submissionId: string) => {
    const currentGrade = grades[submissionId];
    if (!currentGrade) return;

    setSavingStates(prev => ({ ...prev, [submissionId]: true }));

    try {
      if (currentGrade.nilai < 0 || currentGrade.nilai > 100) {
        toast.error('Nilai harus antara 0-100');
        setSavingStates(prev => ({ ...prev, [submissionId]: false }));
        return;
      }

      const { error } = await supabase
        .from('pengumpulan_tugas')
        .update({
          nilai: currentGrade.nilai,
          catatan_nilai: currentGrade.komentar,
          status: 'graded',
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;

      setEditedSubmissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(submissionId);
        return newSet;
      });

      toast.success('Penilaian berhasil disimpan');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error saving grade:', error);
      toast.error('Gagal menyimpan. Silakan coba lagi.');
    } finally {
      setSavingStates(prev => ({ ...prev, [submissionId]: false }));
    }
  }, [grades, onRefresh]);

  const handleCancelGrade = useCallback((submissionId: string) => {
    setGrades(prev => {
      const updated = { ...prev };
      delete updated[submissionId];
      return updated;
    });
    setEditedSubmissions(prev => {
      const updated = new Set(prev);
      updated.delete(submissionId);
      return updated;
    });
  }, []);

  const handleCloseClick = () => {
    if (hasUngradedSubmissions) {
      const ungradedCount = pengumpulanList.filter(p => p.nilai == null).length;
      toast.error(`Tidak dapat menutup tugas`, {
        description: `Masih ada ${ungradedCount} submission yang belum dinilai.`
      });
      return;
    }

    if (!isDeadlinePassed) {
      setCloseConfirmOpen(true);
      return;
    }

    executeClose();
  };

  const executeClose = async () => {
    setCloseConfirmOpen(false);
    try {
      const { error } = await supabase
        .from('tugas')
        .update({
          status: 'ditutup',
          updated_at: new Date().toISOString()
        })
        .eq('id', tugas.id);

      if (error) throw error;

      toast.success('Tugas berhasil ditutup');
      if (onRefresh) await onRefresh();
      setTimeout(() => onBack(), 500);
    } catch (error) {
      console.error('Error closing tugas:', error);
      toast.error('Gagal menutup tugas. Silakan coba lagi.');
    }
  };

  const handlePublishClick = () => {
    setPublishConfirmOpen(true);
  };

  const executePublish = async () => {
    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('tugas')
        .update({ status: 'aktif', updated_at: new Date().toISOString() })
        .eq('id', tugas.id);
      if (error) throw error;
      toast.success('Tugas berhasil dipublish');
      setPublishConfirmOpen(false);
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error('Error publishing tugas:', error);
      toast.error('Gagal publish tugas. Silakan coba lagi.');
    } finally {
      setIsPublishing(false);
    }
  };

  const getSantriName = (santriId: string, submission?: any) => {
    if (submission?.santriName) return submission.santriName;
    const santri = santriList.find(s => s.id === santriId);
    if (santri) return (santri as any).profiles?.name || santri.name || 'Unknown';
    return 'Unknown';
  };

  // Zoom handlers
  const handleZoomIn = () => setImageZoom(prev => Math.min(3, prev + 0.1));
  const handleZoomOut = () => setImageZoom(prev => Math.max(0.1, prev - 0.1));
  const handleZoomReset = () => setImageZoom(1);
  const handleFileSelect = (url: string) => {
    setActiveFileUrl(url);
    setImageZoom(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <TugasDetailHeader
        tugas={tugas}
        isDeadlinePassed={isDeadlinePassed}
        hasUngradedSubmissions={hasUngradedSubmissions}
        onBack={onBack}
        onEdit={onEdit}
        onClose={handleCloseClick}
        onPublish={handlePublishClick}
        onPrintQr={() => setPrintQrOpen(true)}
      />

      {/* Description Card with Stats */}
      {tugas.deskripsi && (
        <TugasInfoCard deskripsi={tugas.deskripsi} stats={stats} />
      )}

      {/* Submissions Section */}
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Pengumpulan Santri
            </h3>
            {pengumpulanList.length > 0 && (
              <Badge variant="secondary">{pengumpulanList.length} Pengumpulan</Badge>
            )}
          </div>
        </div>

        {pengumpulanList.length === 0 ? (
          <EmptySubmissionList />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] min-h-[400px]">
            {/* Left Column - Preview Panel */}
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-border/50 overflow-y-auto max-h-[600px]">
              <SelectedSubmissionPanel
                submission={selectedSubmission}
                imageZoom={imageZoom}
                activeFileUrl={activeFileUrl}
                currentGrade={selectedSubmission ? grades[selectedSubmission.id] : undefined}
                isEdited={selectedSubmission ? editedSubmissions.has(selectedSubmission.id) : false}
                isSaving={selectedSubmission ? savingStates[selectedSubmission.id] || false : false}
                getSantriName={getSantriName}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                onFileSelect={handleFileSelect}
                onGradeChange={(field, value) => selectedSubmission && handleGradeChange(selectedSubmission.id, field, value)}
                onSaveGrade={() => selectedSubmission && handleSaveGrade(selectedSubmission.id)}
                onCancelGrade={() => selectedSubmission && handleCancelGrade(selectedSubmission.id)}
                printSlot={isSelectedGraded && selectedSubmission ? (
                  <ActionButtonGroup>
                    <Button
                      variant="action-edit"
                      size="icon-sm"
                      onClick={() => setPrintPreviewOpen(true)}
                      title="Preview & Cetak"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </ActionButtonGroup>
                ) : null}
              />
            </div>

            {/* Right Column - Student List */}
            <SubmissionList
              pengumpulanList={pengumpulanList}
              selectedSubmission={selectedSubmission}
              onSelectSubmission={handleSelectSubmission}
              getSantriName={getSantriName}
            />
          </div>
        )}
      </div>

      {/* Close Confirmation Dialog */}
      <CloseConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        deadline={tugas.deadline}
        onConfirm={executeClose}
      />

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish tugas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Setelah dipublish, tugas <strong>{tugas.judul}</strong> akan langsung tampil di dashboard santri dan dapat dikerjakan. Pastikan detail tugas sudah benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); executePublish(); }} disabled={isPublishing}>
              {isPublishing ? 'Memublish...' : 'Ya, Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Preview Dialog */}
      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Preview Cetak</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30 p-6">
            <div className="bg-white rounded-md shadow-sm mx-auto" style={{ maxWidth: '210mm' }}>
              <TugasSubmissionsPrintReport
                ref={printRef}
                tugasJudul={tugas.judul}
                mapelNama={mapelNama}
                kelasNama={kelasNama}
                signer={signer}
                deadline={tugas.deadline || tugas.tanggal_deadline}
                submissions={selectedSubmission && isSelectedGraded ? [selectedSubmission] : []}
                getSantriName={getSantriName}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button variant="outline" onClick={() => setPrintPreviewOpen(false)}>
              Tutup
            </Button>
            {selectedSubmission && (
              <PrintButton
                contentRef={printRef}
                documentTitle={`Tugas - ${tugas.judul} - ${getSantriName((selectedSubmission.santriId || selectedSubmission.santri_id || '') as string, selectedSubmission)}`}
                variant="default"
                size="default"
              />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintTugasQrDialog
        open={printQrOpen}
        onOpenChange={setPrintQrOpen}
        tugasId={tugas.id}
        mapelId={mapelIdForPrint}
        judulTugas={tugas.judul}
        bab={(tugas as any).bab || null}
        deadlineLabel={deadlineLabel}
      />
    </div>
  );
}
