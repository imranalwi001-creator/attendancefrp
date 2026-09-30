import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SantriRekapLiburan } from "@/hooks/useMonitoringLiburan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LiburanTrendChartProps {
  data: SantriRekapLiburan[];
  config: any;
  totalActivities: number;
}

export function LiburanTrendChart({ data, config, totalActivities }: LiburanTrendChartProps) {
  const ranking = useMemo(() => [...data].sort((a, b) => b.totalAmalanToday - a.totalAmalanToday).slice(0, 10), [data]);

  const buildExportRows = async () => {
    if (!config) throw new Error("Konfigurasi liburan belum tersedia");

    const startDate = new Date(config.tanggal_mulai);
    const endDate = new Date(config.tanggal_selesai);
    const totalDays = differenceInDays(endDate, startDate) + 1;
    const santriIds = data.map((s) => s.id);

    const endStr = format(endDate, "yyyy-MM-dd");
    const { data: allLogs } = await supabase
        .from("liburan_daily_logs" as any)
        .select("santri_id, date, is_completed")
        .eq("is_completed", true)
        .gte("date", config.tanggal_mulai)
        .lte("date", endStr)
        .in("santri_id", santriIds);

    const logMap: Record<string, Record<string, number>> = {};
    ((allLogs || []) as any[]).forEach((l) => {
      if (!logMap[l.santri_id]) logMap[l.santri_id] = {};
      logMap[l.santri_id][l.date] = (logMap[l.santri_id][l.date] || 0) + 1;
    });

    return data.map((s, idx) => {
      const row: any = { No: idx + 1, "Nama Santri": s.name };
      let totalPct = 0;
      for (let i = 0; i < totalDays; i++) {
        const dateStr = format(addDays(startDate, i), "yyyy-MM-dd");
        const count = logMap[s.id]?.[dateStr] ?? 0;
        const pct = totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0;
        row[`Hari ${i + 1}`] = `${pct}%`;
        totalPct += pct;
      }
      row["Rata-rata"] = `${Math.round(totalPct / totalDays)}%`;
      return row;
    });
  };

  const handleExportExcel = async () => {
    try {
      const { utils, writeFile } = await import("xlsx");
      const rows = await buildExportRows();
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Rekap Liburan");
      writeFile(wb, `Rekap_Kontroling_Liburan.xlsx`);
      toast.success("File Excel berhasil didownload!");
    } catch (e) { toast.error("Gagal export Excel"); }
  };

  const handleExportPDF = async () => {
    try {
      const rows = await buildExportRows();
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("REKAP KONTROLING LIBURAN", pageWidth / 2, 16, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${config?.tanggal_mulai || "-"} s/d ${config?.tanggal_selesai || "-"}`, 14, 26);
      doc.text(`Total aktivitas harian: ${totalActivities}`, 14, 32);

      autoTable(doc, {
        startY: 40,
        head: [["No", "Nama Santri", "Rata-rata", "Hari 1", "Hari 2", "Hari 3", "Hari 4", "Hari 5", "Hari 6", "Hari 7"]],
        body: rows.map((row: any) => [
          row.No,
          row["Nama Santri"],
          row["Rata-rata"],
          row["Hari 1"],
          row["Hari 2"],
          row["Hari 3"],
          row["Hari 4"],
          row["Hari 5"],
          row["Hari 6"],
          row["Hari 7"],
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        columnStyles: { 0: { halign: "center", cellWidth: 10 }, 2: { halign: "center" } },
      });

      doc.save("Rekap_Kontroling_Liburan.pdf");
      toast.success("File PDF berhasil didownload!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal export PDF");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button variant="outline" className="w-full" onClick={handleExportExcel}>
          <Download className="h-4 w-4 mr-2" />Export Excel
        </Button>
        <Button variant="outline" className="w-full" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Ranking Konsistensi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ranking.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
              <span className="text-sm font-bold text-muted-foreground w-6 text-center">{idx + 1}</span>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{s.name}</p></div>
              <div className="flex items-center gap-1"><span className="text-xs font-semibold">{s.totalAmalanToday} aktivitas</span></div>
              <Badge variant="secondary" className="text-[10px]">{s.totalAmalanToday}/{totalActivities}</Badge>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Belum ada data</p>}
        </CardContent>
      </Card>
    </div>
  );
}
