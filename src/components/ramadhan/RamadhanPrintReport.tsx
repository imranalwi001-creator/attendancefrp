import { forwardRef } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import ReportPrintTemplate from "@/components/print/ReportPrintTemplate";
import type { DayDetail } from "@/hooks/useMonitoringRamadhan";

const moodEmoji: Record<string, string> = {
  happy: "😊", neutral: "😐", sad: "😢", excited: "🤩", calm: "😌",
  sangat_bahagia: "😄", bahagia: "😊", biasa: "😐", sedih: "😢",
  sangat_sedih: "😭", semangat: "🔥", lelah: "😴", bersyukur: "🤲",
};

interface Activity {
  id: string;
  title: string;
  category: string;
}

interface RamadhanPrintReportProps {
  santriName?: string;
  santriKelas?: string | null;
  tahunHijriah?: string;
  days: DayDetail[];
  activities: Activity[];
}

const RamadhanPrintReport = forwardRef<HTMLDivElement, RamadhanPrintReportProps>(
  ({ santriName, santriKelas, tahunHijriah, days, activities }, ref) => {
    const fardhuActs = activities.filter((a) => a.category === "fardhu");
    const sunnahActs = activities.filter((a) => a.category === "sunnah");
    const akhlakActs = activities.filter((a) => a.category === "akhlak");

    const totalDays = days.length;

    const calcCategoryStats = (acts: Activity[]) => {
      const totalDone = acts.reduce(
        (sum, act) => sum + days.filter((d) => d.completedActivityIds.includes(act.id)).length, 0
      );
      const totalPossible = acts.length * totalDays;
      const pct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
      return { totalDone, totalPossible, pct };
    };

    const fardhuStats = calcCategoryStats(fardhuActs);
    const sunnahStats = calcCategoryStats(sunnahActs);
    const akhlakStats = calcCategoryStats(akhlakActs);

    const tilawahDays = days.filter((d) => d.tilawahSurahAwal || d.tilawahSurahAkhir);
    const filledDays = days.filter((d) => d.completedActivityIds.length > 0 || d.mood);

    const tableStyle: React.CSSProperties = {
      width: "100%", borderCollapse: "collapse", fontSize: "9pt", marginBottom: "15px",
    };
    const thStyle: React.CSSProperties = {
      border: "1px solid #333", padding: "6px 8px", backgroundColor: "#f5f5f5", fontWeight: 600, textAlign: "left",
    };
    const tdStyle: React.CSSProperties = {
      border: "1px solid #333", padding: "5px 8px", verticalAlign: "top",
    };
    const tdCenterStyle: React.CSSProperties = { ...tdStyle, textAlign: "center" };
    const sectionTitleStyle: React.CSSProperties = {
      fontSize: "11pt", fontWeight: 600, margin: "20px 0 10px 0", paddingBottom: "5px", borderBottom: "1px solid #ddd",
    };

    return (
      <div ref={ref}>
        <ReportPrintTemplate
          title={tahunHijriah ? `LAPORAN MONITORING RAMADHAN ${tahunHijriah}` : "LAPORAN MONITORING RAMADHAN"}
          studentData={santriName ? { nama: santriName, kelas: santriKelas || '-' } : undefined}
        >
          {/* A. Identitas Santri */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: 600, margin: "0 0 10px 0" }}>
              A. Identitas Santri
            </h3>
            <table style={{ fontSize: "10pt", lineHeight: 1.6 }}>
              <tbody>
                <tr>
                  <td style={{ width: "100px", fontWeight: 500 }}>Nama</td>
                  <td style={{ width: "20px" }}>:</td>
                  <td>{santriName || "-"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>Kelas</td>
                  <td>:</td>
                  <td>{santriKelas || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* B. Rekap Aktivitas Ramadhan */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: 600, margin: "0 0 10px 0" }}>
              B. Rekap Aktivitas Ramadhan
            </h3>
            {[
              { label: "Fardhu", acts: fardhuActs, stats: fardhuStats },
              { label: "Sunnah", acts: sunnahActs, stats: sunnahStats },
              { label: "Akhlak", acts: akhlakActs, stats: akhlakStats },
            ].map(({ label, acts, stats }) => (
              <div key={label} style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "10pt", fontWeight: 600, margin: "0 0 5px 0" }}>
                  {label} — {stats.pct}%
                </p>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: "30px", textAlign: "center" }}>No</th>
                      <th style={thStyle}>Aktivitas</th>
                      <th style={{ ...thStyle, width: "90px", textAlign: "center" }}>Terlaksana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acts.map((act, idx) => {
                      const doneCount = days.filter((d) => d.completedActivityIds.includes(act.id)).length;
                      return (
                        <tr key={act.id}>
                          <td style={tdCenterStyle}>{idx + 1}</td>
                          <td style={tdStyle}>{act.title}</td>
                          <td style={tdCenterStyle}>{doneCount}/{totalDays}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* C. Rekap Tilawah */}
          {tilawahDays.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <h3 style={sectionTitleStyle}>C. Rekap Tilawah Al-Quran</h3>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: "30px", textAlign: "center" }}>Hari</th>
                    <th style={{ ...thStyle, width: "90px", textAlign: "center" }}>Tanggal</th>
                    <th style={thStyle}>Surah Awal</th>
                    <th style={thStyle}>Surah Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {tilawahDays.map((day) => (
                    <tr key={day.date}>
                      <td style={tdCenterStyle}>{day.hijriDay}</td>
                      <td style={tdCenterStyle}>
                        {format(new Date(day.date), "d MMM yyyy", { locale: id })}
                      </td>
                      <td style={tdStyle}>{day.tilawahSurahAwal || "-"}</td>
                      <td style={tdStyle}>{day.tilawahSurahAkhir || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: "9pt", margin: 0 }}>
                Total hari tilawah: <strong>{tilawahDays.length}</strong> dari {totalDays} hari
              </p>
            </div>
          )}

          {/* D. Detail Harian */}
          <div>
            <h3 style={sectionTitleStyle}>
              {tilawahDays.length > 0 ? "D" : "C"}. Detail Aktivitas Harian
            </h3>
            {filledDays.length > 0 ? (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: "30px", textAlign: "center" }}>Hari</th>
                    <th style={{ ...thStyle, width: "80px", textAlign: "center" }}>Tanggal</th>
                    <th style={{ ...thStyle, width: "55px", textAlign: "center" }}>Fardhu</th>
                    <th style={{ ...thStyle, width: "55px", textAlign: "center" }}>Sunnah</th>
                    <th style={{ ...thStyle, width: "55px", textAlign: "center" }}>Akhlak</th>
                    <th style={{ ...thStyle, width: "40px", textAlign: "center" }}>Mood</th>
                    <th style={{ ...thStyle, width: "50px", textAlign: "center" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {filledDays.map((day) => (
                    <tr key={day.date}>
                      <td style={tdCenterStyle}>{day.hijriDay}</td>
                      <td style={tdCenterStyle}>
                        {format(new Date(day.date), "d MMM", { locale: id })}
                      </td>
                      <td style={tdCenterStyle}>{day.fardhuCount}/{day.fardhuTotal}</td>
                      <td style={tdCenterStyle}>{day.sunnahCount}/{day.sunnahTotal}</td>
                      <td style={tdCenterStyle}>{day.akhlakCount}/{day.akhlakTotal}</td>
                      <td style={tdCenterStyle}>
                        {day.mood ? (moodEmoji[day.mood] ?? "—") : "—"}
                      </td>
                      <td style={tdCenterStyle}>{Math.round(day.percentage)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: "9pt", fontStyle: "italic", color: "#666" }}>
                Belum ada data aktivitas Ramadhan.
              </p>
            )}
          </div>
        </ReportPrintTemplate>
      </div>
    );
  }
);

RamadhanPrintReport.displayName = "RamadhanPrintReport";

export { RamadhanPrintReport };
