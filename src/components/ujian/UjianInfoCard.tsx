import { ContentCard, ContentCardBody } from '@/components/ui/content-card';
import { Progress } from '@/components/ui/progress';
import { Users, FileQuestion, CheckCircle } from 'lucide-react';

interface UjianStats {
  totalSoal: number;
  totalPeserta: number;
  sudahMengerjakan: number;
}

interface UjianInfoCardProps {
  stats: UjianStats;
}

export function UjianInfoCard({ stats }: UjianInfoCardProps) {
  const persentaseMengerjakan = stats.totalPeserta > 0 
    ? Math.round((stats.sudahMengerjakan / stats.totalPeserta) * 100) 
    : 0;

  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/50 bg-muted/30">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          Ringkasan Ujian
        </h3>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Total Soal */}
          <ContentCard className="rounded-xl shadow-none">
            <ContentCardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10">
                  <FileQuestion className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalSoal}</p>
                  <p className="text-xs text-muted-foreground">Butir Soal</p>
                </div>
              </div>
            </ContentCardBody>
          </ContentCard>

          {/* Total Peserta */}
          <ContentCard className="rounded-xl shadow-none">
            <ContentCardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalPeserta}</p>
                  <p className="text-xs text-muted-foreground">Peserta</p>
                </div>
              </div>
            </ContentCardBody>
          </ContentCard>

          {/* Progress Mengerjakan */}
          <ContentCard className="rounded-xl shadow-none">
            <ContentCardBody className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Progress
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{stats.sudahMengerjakan}/{stats.totalPeserta}</span>
                  <span className="font-semibold text-emerald-600">{persentaseMengerjakan}%</span>
                </div>
              </div>
              <Progress 
                value={persentaseMengerjakan} 
                className="h-2 [&>div]:bg-emerald-500" 
              />
            </ContentCardBody>
          </ContentCard>
        </div>
      </div>
    </div>
  );
}
