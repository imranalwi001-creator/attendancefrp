import { useMemo } from "react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";

interface CategoryScore {
  categoryId: string;
  categoryName: string;
  averageScore: number;
  color: string;
}

interface AffectiveRadarChartProps {
  data: CategoryScore[];
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}

export function AffectiveRadarChart({ data, size = "md", showLabels = true }: AffectiveRadarChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      category: item.categoryName,
      score: item.averageScore,
      fullMark: 100,
    }));
  }, [data]);

  const sizeConfig = {
    sm: { height: 200, outerRadius: 60 },
    md: { height: 280, outerRadius: 90 },
    lg: { height: 320, outerRadius: 110 },
  };

  const config = sizeConfig[size];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Belum ada data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={config.height}>
      <RadarChart cx="50%" cy="50%" outerRadius={config.outerRadius} data={chartData}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis 
          dataKey="category" 
          tick={{ 
            fill: "hsl(var(--muted-foreground))", 
            fontSize: size === "sm" ? 10 : 12 
          }}
          style={{ display: showLabels ? "block" : "none" }}
        />
        <PolarRadiusAxis 
          angle={90} 
          domain={[0, 100]} 
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
        />
        <Radar
          name="Nilai"
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--popover-foreground))",
          }}
          formatter={(value: number) => [`${value.toFixed(1)}`, "Nilai"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
