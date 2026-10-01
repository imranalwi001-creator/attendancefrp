import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { AttendanceRecord } from '@/types/hrm';
import { CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const HrmAttendanceHistoryPage: React.FC = () => {
  const { user } = useHrmAuth();
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const load = () => {
      const all = hrmService.getAttendances().filter((a) => a.userId === user.id);
      setHistory(all);
    };
    load();
    hrmService.syncWithBackend().then(load);
    window.addEventListener('hrm_data_updated', load);
    return () => window.removeEventListener('hrm_data_updated', load);
  }, [user]);

  const filteredHistory = history.filter((a) => {
    if (!filterMonth) return true;
    if (!a || !a.attendanceDate) return false;
    try {
      const cleanDate = typeof a.attendanceDate === 'string'
        ? a.attendanceDate.split('T')[0]
        : new Date(a.attendanceDate).toISOString().split('T')[0];
      return cleanDate.startsWith(filterMonth);
    } catch {
      return false;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Riwayat Presensi Pribadi
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Log lengkap jam kehadiran, kepulangan, durasi kerja, dan sertifikat verifikasi dual-shield Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="text-xs bg-card rounded-xl border-border w-full sm:w-48"
            placeholder="Pilih Bulan..."
          />
          {filterMonth && (
            <button
              type="button"
              onClick={() => setFilterMonth('')}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border hover:bg-muted shrink-0"
              title="Reset Filter"
            >
              Semua
            </button>
          )}
        </div>
      </div>

      {/* History Table */}
      <Card className="border-border bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4">Tanggal Presensi</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Durasi Jam Kerja</th>
                <th className="py-3 px-4">Keterlambatan</th>
                <th className="py-3 px-4">Status Kehadiran</th>
                <th className="py-3 px-4">Verifikasi Gate</th>
                <th className="py-3 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Belum ada rekaman presensi pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {item.attendanceDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      {item.clockIn || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-foreground">
                      {item.clockOut || '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.workDurationMinutes > 0
                        ? `${Math.floor(item.workDurationMinutes / 60)} Jam ${item.workDurationMinutes % 60} Menit`
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {item.lateMinutes > 0 ? (
                        <span className="font-medium text-destructive">{item.lateMinutes} Menit</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.status === 'hadir' ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">Tepat Waktu</Badge>
                      ) : item.status === 'terlambat' ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] rounded-md">Terlambat</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] rounded-md">{item.status}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.biometricScore != null && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] rounded-md">
                            Face {item.biometricScore}%
                          </Badge>
                        )}
                        {item.geofenceDistance != null && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">
                            {Math.round(item.geofenceDistance)}m
                          </Badge>
                        )}
                        {item.biometricScore == null && item.geofenceDistance == null && (
                          <span className="text-muted-foreground/60 text-[11px]">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate text-[11px]">
                      {item.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
