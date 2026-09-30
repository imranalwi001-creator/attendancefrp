import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Lock, FileText, Calendar, ClipboardCheck, Send, QrCode } from 'lucide-react';
import { EditButton, ActionButtonGroup, SecondaryButton } from '@/components/ui/action-buttons';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';
import { Tugas } from '@/types';

interface TugasDetailHeaderProps {
  tugas: Tugas;
  isDeadlinePassed: boolean;
  hasUngradedSubmissions: boolean;
  onBack: () => void;
  onEdit: () => void;
  onClose: () => void;
  onPublish?: () => void;
  onPrintQr?: () => void;
}

export function TugasDetailHeader({
  tugas,
  isDeadlinePassed,
  hasUngradedSubmissions,
  onBack,
  onEdit,
  onClose,
  onPublish,
  onPrintQr,
}: TugasDetailHeaderProps) {
  const isDraft = tugas.status === 'draft';
  const isClosed = !isDraft && (tugas.status === 'ditutup' || isDeadlinePassed);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/10 border border-primary/20 p-6 shadow-primary/5 shadow-sm">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="action-detail" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{tugas.judul}</h1>
              <Badge variant={isDraft ? 'secondary' : isClosed ? 'destructive' : 'default'}>
                {isDraft ? 'Draft' : isClosed ? 'Ditutup' : 'Publish'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-foreground/70 font-medium">
              {tugas.bab && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {tugas.bab}
                </span>
              )}
              {tugas.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(tugas.deadline), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <ClipboardCheck className="h-3.5 w-3.5" />
                {tugas.tipeJawaban === 'teks' ? 'Teks' : tugas.tipeJawaban}
              </span>
            </div>
          </div>
        </div>
        <ActionButtonGroup>
          {!isClosed && <EditButton onClick={onEdit} title="Edit Tugas" />}
          {onPrintQr && (
            <SecondaryButton onClick={onPrintQr} title="Cetak lembar tugas dengan QR unik per siswa">
              <QrCode className="h-4 w-4" />
              Cetak (QR)
            </SecondaryButton>
          )}
          {isDraft && onPublish && (
            <SecondaryButton onClick={onPublish} title="Publish tugas agar tampil di dashboard santri">
              <Send className="h-4 w-4" />
              Publish
            </SecondaryButton>
          )}
          {tugas.status === 'aktif' && !isDeadlinePassed && (
            <SecondaryButton
              onClick={onClose}
              disabled={hasUngradedSubmissions}
              title={hasUngradedSubmissions ? 'Masih ada submission belum dinilai' : 'Tutup tugas'}
            >
              <Lock className="h-4 w-4" />
              Tutup
            </SecondaryButton>
          )}
        </ActionButtonGroup>
      </div>
    </div>
  );
}
