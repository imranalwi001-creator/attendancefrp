import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { UjianSoal } from '@/hooks/useUjian';

interface ExamQuestionProps {
  soal: UjianSoal;
  nomorSoal: number;
  totalSoal: number;
  selectedAnswer: string;
  onAnswerChange: (answer: string) => void;
}

export function ExamQuestion({
  soal,
  nomorSoal,
  totalSoal,
  selectedAnswer,
  onAnswerChange,
}: ExamQuestionProps) {
  // Strip HTML tags for display
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border">
      {/* Question Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
          Soal {nomorSoal} / {totalSoal}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {soal.bobot_nilai} poin
        </Badge>
      </div>

      {/* Question Content */}
      <div className="p-5 space-y-5">
        {/* Question Text */}
        <div className="text-lg leading-relaxed text-foreground">
          <div dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} />
        </div>

        {/* Question Image */}
        {soal.gambar_pertanyaan && (
          <div className="mt-4">
            <img
              src={soal.gambar_pertanyaan}
              alt="Gambar soal"
              className="max-w-full h-auto rounded-lg border"
            />
          </div>
        )}

        {/* Answer Area */}
        <div className="pt-4 border-t space-y-3">
          {/* Multiple Choice */}
          {soal.jenis_soal === 'pilihan_ganda' && soal.opsi && (
            <div className="space-y-3">
              {soal.opsi.map((opsi) => (
                <button
                  key={opsi.id}
                  type="button"
                  onClick={() => onAnswerChange(opsi.label)}
                  className={cn(
                    'w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                    selectedAnswer === opsi.label
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent/30'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold text-lg shrink-0 transition-colors',
                      selectedAnswer === opsi.label
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    {selectedAnswer === opsi.label ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      opsi.label
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <p className="text-base">{opsi.teks}</p>
                    {opsi.gambar && (
                      <img
                        src={opsi.gambar}
                        alt={`Opsi ${opsi.label}`}
                        className="mt-2 max-w-xs h-auto rounded border"
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* True/False */}
          {soal.jenis_soal === 'true_false' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => onAnswerChange('benar')}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all',
                  selectedAnswer === 'benar'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                )}
              >
                <div
                  className={cn(
                    'p-3 rounded-full',
                    selectedAnswer === 'benar'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  <Check className="h-8 w-8" />
                </div>
                <span className="text-lg font-semibold">BENAR</span>
              </button>

              <button
                type="button"
                onClick={() => onAnswerChange('salah')}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all',
                  selectedAnswer === 'salah'
                    ? 'border-red-500 bg-red-50'
                    : 'border-border hover:border-red-300 hover:bg-red-50/50'
                )}
              >
                <div
                  className={cn(
                    'p-3 rounded-full',
                    selectedAnswer === 'salah'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-100 text-red-600'
                  )}
                >
                  <X className="h-8 w-8" />
                </div>
                <span className="text-lg font-semibold">SALAH</span>
              </button>
            </div>
          )}

          {/* Essay */}
          {soal.jenis_soal === 'essai' && (
            <Textarea
              value={selectedAnswer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Ketik jawaban Anda di sini..."
              rows={8}
              className="text-base resize-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ExamQuestion;
