import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Book, Clock, Calendar, ChevronRight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListCard, ListCardColumn } from '@/components/ui/list-card';
import { formatDurasi, getJenisUjianLabel } from '@/lib/ujianUtils';
import type { UjianForSantri } from '@/hooks/useUjianSantri';

interface ExamCardProps {
  ujian: UjianForSantri;
  onStart: () => void;
  onViewResult: () => void;
}

type ExamStatus = 'upcoming' | 'available' | 'completed';

function getExamStatus(ujian: UjianForSantri): ExamStatus {
  if (ujian.peserta_status === 'selesai') return 'completed';
  
  // Exam is only available when admin has started it (status = 'berlangsung')
  if (ujian.status === 'berlangsung') return 'available';
  
  return 'upcoming';
}

function getStatusBadgeConfig(status: ExamStatus) {
  switch (status) {
    case 'available':
      return { label: 'Berlangsung', variant: 'default' as const };
    case 'upcoming':
      return { label: 'Terjadwal', variant: 'warning' as const };
    case 'completed':
      return { label: 'Selesai', variant: 'success' as const };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function ExamCard({ ujian, onStart, onViewResult }: ExamCardProps) {
  const status = getExamStatus(ujian);
  const statusBadge = getStatusBadgeConfig(status);
  const isCompleted = status === 'completed';
  const score = ujian.nilai_total;

  const columns: ListCardColumn[] = [
    {
      value: getJenisUjianLabel(ujian.jenis),
      subValue: ujian.mapel?.nama || 'Mata Pelajaran',
    },
    {
      label: 'Tanggal',
      value: (
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(ujian.tanggal_pelaksanaan), 'dd MMM yyyy', { locale: localeId })}
        </span>
      ),
    },
    // Show score for completed exams, otherwise show duration
    isCompleted && score !== null && score !== undefined
      ? {
          label: 'Skor',
          value: (
            <span className={`flex items-center gap-1 font-semibold ${getScoreColor(score)}`}>
              <Trophy className="h-3 w-3" />
              {Math.round(score)}
            </span>
          ),
        }
      : {
          label: 'Durasi',
          value: (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDurasi(ujian.durasi_menit)}
            </span>
          ),
        },
  ];

  const actions = (
    <>
      {status === 'upcoming' && (
        <Button 
          variant="outline" 
          size="sm" 
          disabled 
          className="rounded-xl text-muted-foreground text-xs"
        >
          Belum Mulai
        </Button>
      )}
      {status === 'available' && (
        <Button 
          size="sm" 
          onClick={onStart}
          className="rounded-xl text-xs"
        >
          Mulai
          <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
        </Button>
      )}
      {status === 'completed' && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onViewResult}
          className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 text-xs"
        >
          Lihat Hasil
        </Button>
      )}
    </>
  );

  return (
    <ListCard
      icon={<Book className="h-5 w-5 text-primary" />}
      iconBgColor="hsl(var(--primary) / 0.1)"
      columns={columns}
      badge={{
        label: statusBadge.label,
        variant: statusBadge.variant,
      }}
      actions={actions}
    />
  );
}

export default ExamCard;
