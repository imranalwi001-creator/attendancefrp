import { forwardRef } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ReportPrintTemplate, { type SignerData } from './ReportPrintTemplate';
import { PengumpulanTugas } from '@/types';

export interface TugasSubmissionsPrintReportProps {
  tugasJudul: string;
  mapelNama?: string;
  kelasNama?: string;
  deadline?: string | null;
  tahunAjaran?: string;
  semester?: 'ganjil' | 'genap';
  signer?: SignerData;
  submissions: PengumpulanTugas[];
  getSantriName: (santriId: string, submission?: any) => string;
}

function formatJawaban(s: PengumpulanTugas): { label: string; content: string } {
  const tipe = s.jawaban?.tipe;
  const value = s.jawaban?.value || '';
  if (tipe === 'teks') return { label: 'Teks', content: value || '-' };
  if (tipe === 'link') return { label: 'Link', content: value || '-' };
  if (tipe === 'file') {
    const urls = value.split(',').map(u => u.trim()).filter(Boolean);
    return { label: `File${urls.length > 1 ? ` (${urls.length})` : ''}`, content: urls.join('\n') || '-' };
  }
  return { label: '-', content: value || '-' };
}

function PrintCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-md p-4 bg-muted/20">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground break-words [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function NumberedRow({ number, label, value }: { number: number; label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_140px_1fr] text-sm py-1.5">
      <span className="font-bold text-foreground">{number}.</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground break-words [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

const TugasSubmissionsPrintReport = forwardRef<HTMLDivElement, TugasSubmissionsPrintReportProps>(
  ({ tugasJudul, mapelNama, kelasNama, deadline, tahunAjaran, semester, signer, submissions, getSantriName }, ref) => {
    const graded = submissions.filter(s => s.nilai != null);

    return (
      <ReportPrintTemplate
        ref={ref}
        title="LAPORAN PENILAIAN TUGAS"
        tahunAjaran={tahunAjaran}
        semester={semester}
        signer={signer}
      >
        <div className="space-y-6">
          {graded.map((s, idx) => {
            const jawaban = formatJawaban(s);
            const santriId = (s.santriId || s.santri_id || '') as string;
            const namaSantri = getSantriName(santriId, s);
            const nilai = s.nilai ?? '-';
            const komentar = s.komentarGuru || s.catatan_nilai || '-';
            const feedback = s.feedbackSantri || s.feedback_santri || '-';
            const tanggal = s.submittedAt || s.tanggal_submit;

            return (
              <div
                key={s.id}
                className="space-y-4"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {graded.length > 1 && (
                  <p className="text-xs text-muted-foreground">Submission #{idx + 1}</p>
                )}

                {/* Identitas Santri (numbered) */}
                <div>
                  <NumberedRow number={1} label="Nama Santri" value={namaSantri} />
                  <NumberedRow number={2} label="Kelas" value={kelasNama || '-'} />
                  <NumberedRow
                    number={3}
                    label="Tanggal Pengumpulan"
                    value={tanggal ? format(new Date(tanggal), "d MMMM yyyy, HH:mm", { locale: id }) : '-'}
                  />
                </div>

                {/* Card: Informasi Tugas */}
                <PrintCard title="Informasi Tugas">
                  <InfoRow label="Judul Tugas" value={tugasJudul} />
                  {mapelNama && <InfoRow label="Mata Pelajaran" value={mapelNama} />}
                </PrintCard>

                {/* Card: Jawaban */}
                <PrintCard title={`Informasi Jawaban (${jawaban.label})`}>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {jawaban.content}
                  </p>
                </PrintCard>

                {/* Card: Penilaian + Komentar + Feedback (3 kolom) */}
                <PrintCard title="Penilaian Guru">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Nilai</p>
                      <p className="text-2xl font-bold text-foreground">{nilai}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Komentar Guru</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {komentar}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Feedback Santri</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {feedback}
                      </p>
                    </div>
                  </div>
                </PrintCard>
              </div>
            );
          })}

          {graded.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-8">
              Belum ada submission yang dinilai.
            </p>
          )}
        </div>
      </ReportPrintTemplate>
    );
  }
);

TugasSubmissionsPrintReport.displayName = 'TugasSubmissionsPrintReport';

export default TugasSubmissionsPrintReport;
