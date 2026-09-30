import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Shield, MessageSquare, Crown, Lock, Unlock } from "lucide-react";
import { AffectiveRadarChart } from "@/components/affective/AffectiveRadarChart";
import { AffectiveScoreBadge, getPredikat } from "@/components/affective/AffectiveScoreBadge";

interface AffectiveCategory {
  id: string;
  name: string;
  color: string | null;
}

interface AffectiveIndicator {
  id: string;
  name: string;
  category_id: string;
}

interface CategoryScore {
  categoryId: string;
  categoryName: string;
  averageScore: number;
  color: string;
}

interface AfektifTabContentProps {
  isAffectiveFinalized: boolean;
  overallAffectiveScore: number;
  affectiveCategories: AffectiveCategory[] | undefined;
  affectiveIndicators: AffectiveIndicator[] | undefined;
  affectiveCategoryScores: CategoryScore[];
  indicatorScoreMap: Map<string, number>;
}

export function AfektifTabContent({
  isAffectiveFinalized,
  overallAffectiveScore,
  affectiveCategories,
  affectiveIndicators,
  affectiveCategoryScores,
  indicatorScoreMap,
}: AfektifTabContentProps) {
  // Category icons for affective
  const affectiveCategoryIcons: Record<string, React.ReactNode> = {
    "Confidence": <Shield className="h-4 w-4" />,
    "Communication": <MessageSquare className="h-4 w-4" />,
    "Leadership": <Crown className="h-4 w-4" />,
    "Emotional Control": <Heart className="h-4 w-4" />,
  };

  if (isAffectiveFinalized && overallAffectiveScore > 0) {
    return (
      <div className="space-y-4">
        {/* Radar Chart and Overall Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="title-card">
                <div className="title-card-icon bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  <Heart className="h-4 w-4" />
                </div>
                <h3 className="title-card-title text-rose-600 dark:text-rose-400">Ringkasan Nilai Afektif</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                  <Lock className="h-3 w-3" />
                  Sudah Difinalisasi
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <AffectiveRadarChart
                data={affectiveCategoryScores}
                size="lg"
                showLabels={true}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">Nilai Rata-rata</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <AffectiveScoreBadge score={overallAffectiveScore} size="lg" />
                  <span className="text-lg font-semibold text-foreground">
                    {getPredikat(overallAffectiveScore)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-foreground">Nilai per Kategori</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {affectiveCategories?.map((category) => {
              const categoryScore = affectiveCategoryScores.find(
                (c) => c.categoryId === category.id
              );
              const categoryIndicators = affectiveIndicators?.filter(
                (ind) => ind.category_id === category.id
              );

              return (
                <div
                  key={category.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-md"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <span style={{ color: category.color || undefined }}>
                          {affectiveCategoryIcons[category.name]}
                        </span>
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <AffectiveScoreBadge
                      score={categoryScore?.averageScore || 0}
                      size="md"
                    />
                  </div>

                  {/* Indicator List */}
                  <div className="space-y-2 pl-8">
                    {categoryIndicators?.map((indicator) => {
                      const indicatorScore = indicatorScoreMap.get(indicator.id) || 0;
                      return (
                        <div
                          key={indicator.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {indicator.name}
                          </span>
                          <span className="font-medium">
                            {indicatorScore > 0 ? indicatorScore : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="title-card">
            <div className="title-card-icon bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
              <Heart className="h-4 w-4" />
            </div>
            <h3 className="title-card-title text-rose-600 dark:text-rose-400">Ringkasan Nilai Afektif</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
              <Unlock className="h-3 w-3" />
              Belum Difinalisasi
            </Badge>
          </div>
        </div>
        <div className="text-center py-8">
          <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {!isAffectiveFinalized 
              ? "Nilai afektif belum difinalisasi oleh pembina." 
              : "Belum ada data penilaian afektif untuk santri ini."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
