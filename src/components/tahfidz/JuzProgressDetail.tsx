import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JuzProgress, SurahProgress } from "@/lib/hafalanProgressUtils";

interface JuzProgressDetailProps {
  allJuzProgress: JuzProgress[];
  selectedJuz?: number | null;
  onSelectJuz?: (juz: number | null) => void;
}

export function JuzProgressDetail({ 
  allJuzProgress, 
  selectedJuz,
  onSelectJuz 
}: JuzProgressDetailProps) {
  // If no juz selected, don't render anything
  if (!selectedJuz) return null;
  
  const selectedJuzProgress = allJuzProgress.find(j => j.juzNumber === selectedJuz);
  if (!selectedJuzProgress) return null;

  // Format gaps for display
  const formatGaps = (gaps: SurahProgress['gaps']): string => {
    if (gaps.length === 0) return "";
    if (gaps.length === 1) {
      const g = gaps[0];
      return `Ayat ${g.start}-${g.end}`;
    }
    return gaps.map(g => `${g.start}-${g.end}`).join(", ");
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{selectedJuz}</span>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Detail Juz {selectedJuz}</h4>
            <p className="text-xs text-muted-foreground">
              {selectedJuzProgress.memorizedVersesInJuz} / {selectedJuzProgress.totalVersesInJuz} ayat dihafal
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={() => onSelectJuz?.(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
        <Progress 
          value={selectedJuzProgress.percentage} 
          className="flex-1 h-2.5"
        />
        <Badge variant="secondary" className="shrink-0">
          {selectedJuzProgress.percentage}%
        </Badge>
      </div>

      {/* Surahs in this Juz - sorted: completed first, then by percentage desc */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {[...selectedJuzProgress.surahs]
          .sort((a, b) => {
            // Completed surahs first
            if (a.isComplete && !b.isComplete) return -1;
            if (!a.isComplete && b.isComplete) return 1;
            // Then by percentage descending
            return b.percentage - a.percentage;
          })
          .map((surah) => (
          <div
            key={`${selectedJuz}-${surah.surahNumber}`}
            className={`p-3 rounded-xl border transition-all ${
              surah.isComplete 
                ? 'bg-gradient-to-r from-emerald-50 to-emerald-50/30 border-emerald-200 dark:from-emerald-950/30 dark:to-transparent dark:border-emerald-800' 
                : surah.percentage > 0
                ? 'bg-gradient-to-r from-amber-50 to-amber-50/30 border-amber-200 dark:from-amber-950/20 dark:to-transparent dark:border-amber-800/50'
                : 'bg-muted/30 border-border/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {surah.isComplete ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                ) : surah.percentage > 0 ? (
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-medium text-sm">{surah.surahName}</span>
                  <span className="text-xs text-muted-foreground/70 ml-1.5">
                    {surah.surahNameArabic}
                  </span>
                </div>
              </div>
              <Badge 
                variant={surah.isComplete ? "default" : "secondary"}
                className={`text-xs ${surah.isComplete ? "bg-emerald-500 hover:bg-emerald-500" : ""}`}
              >
                {surah.percentage}%
              </Badge>
            </div>
            
            <Progress 
              value={surah.percentage} 
              className="h-1 mb-2"
            />
            
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Ayat {surah.versesInJuzRange.start}-{surah.versesInJuzRange.end}
                <span className="opacity-60 ml-1">
                  ({surah.memorizedCount}/{surah.totalVersesInJuz})
                </span>
              </span>
              {surah.gaps.length > 0 && !surah.isComplete && surah.percentage > 0 && (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">Gap: {formatGaps(surah.gaps)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
