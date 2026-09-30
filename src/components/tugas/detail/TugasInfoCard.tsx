import { ContentCard, ContentCardBody } from '@/components/ui/content-card';
import { Progress } from '@/components/ui/progress';
import { FileText, ClipboardCheck, Send } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize';

interface TugasStats {
  total: number;
  submitted: number;
  graded: number;
  pending: number;
}

interface TugasInfoCardProps {
  deskripsi: string;
  stats: TugasStats;
}

export function TugasInfoCard({ deskripsi, stats }: TugasInfoCardProps) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50 bg-muted/30">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          Informasi Tugas
        </h3>
      </div>
      <div className="p-5 space-y-4">
        {/* Progress Bar Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Pengumpulan Card */}
          <ContentCard className="rounded-xl shadow-none">
            <ContentCardBody className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Pengumpulan
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{stats.submitted}/{stats.total}</span>
                  <span className="font-semibold text-primary">
                    {stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <Progress value={stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0} className="h-2" />
            </ContentCardBody>
          </ContentCard>

          {/* Penilaian Card */}
          <ContentCard className="rounded-xl shadow-none">
            <ContentCardBody className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  Penilaian
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{stats.graded}/{stats.submitted}</span>
                  <span className="font-semibold text-emerald-600">
                    {stats.submitted > 0 ? Math.round((stats.graded / stats.submitted) * 100) : 0}%
                  </span>
                </div>
              </div>
              <Progress value={stats.submitted > 0 ? (stats.graded / stats.submitted) * 100 : 0} className="h-2 [&>div]:bg-emerald-500" />
            </ContentCardBody>
          </ContentCard>
        </div>

        {/* Description content */}
        <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Deskripsi Tugas</span>
          </div>
          <div
            className="prose prose-xs max-w-none text-sm text-foreground prose-headings:text-foreground prose-headings:text-base prose-p:text-foreground prose-p:text-sm prose-li:text-foreground prose-li:text-sm prose-strong:text-foreground prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(deskripsi) }}
          />
        </div>
      </div>
    </div>
  );
}
