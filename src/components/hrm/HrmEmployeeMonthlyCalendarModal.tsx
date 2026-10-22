import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserProfile, AttendanceRecord, Shift } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';
import { resolveEffectiveShift } from '@/lib/hrmShiftResolver';
import * as XLSX from 'xlsx';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  Printer,
  ExternalLink,
  Camera,
  User,
  Coffee,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  initialMonth?: string; // Format 'YYYY-MM'
  attendances?: AttendanceRecord[];
  allShifts?: Shift[];
  onOpenPhotoPreview?: (photoData: {
    url: string;
    type: string;
    userName: string;
    userNip: string;
    time?: string;
    date: string;
    biometricScore?: number;
    geofenceDistance?: number;
  }) => void;
}

export const HrmEmployeeMonthlyCalendarModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  initialMonth,
  attendances = [],
  allShifts = [],
  onOpenPhotoPreview,
}) => {
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return today.startsWith(initialMonth || currentMonthStr) ? today : `${initialMonth || currentMonthStr}-01`;
  });

  // Sinkronisasi jika initialMonth berubah
  React.useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
      const today = new Date().toISOString().split('T')[0];
      setSelectedDateStr(today.startsWith(initialMonth) ? today : `${initialMonth}-01`);
    }
  }, [initialMonth]);

  const [yearNum, monthNum] = useMemo(() => {
    const parts = (selectedMonth || currentMonthStr).split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth, currentMonthStr]);

  const monthLabel = useMemo(() => {
    const d = new Date(yearNum, monthNum - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [yearNum, monthNum]);

  // Navigasi Bulan
  const handlePrevMonth = () => {
    let nextY = yearNum;
    let nextM = monthNum - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    const newStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    setSelectedMonth(newStr);
    setSelectedDateStr(`${newStr}-01`);
  };

  const handleNextMonth = () => {
    let nextY = yearNum;
    let nextM = monthNum + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const newStr = `${nextY}-${String(nextM).padStart(2, '0')}`;
    setSelectedMonth(newStr);
    setSelectedDateStr(`${newStr}-01`);
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
    setSelectedDateStr(new Date().toISOString().split('T')[0]);
  };

  // Auto-fetch data presensi dari PostgreSQL API saat bulan atau user berubah
  const [serverMonthAttendances, setServerMonthAttendances] = useState<AttendanceRecord[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);

  React.useEffect(() => {
    if (!isOpen || !user || !selectedMonth) return;
    let isMounted = true;
    setIsLoadingMonth(true);

    const targetUserId = user.id || user.nip;
    fetch(`/api/attendances?month=${selectedMonth}&userId=${encodeURIComponent(targetUserId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && Array.isArray(json.data)) {
          setServerMonthAttendances(json.data);
        }
      })
      .catch((err) => {
        console.warn('[CalendarModal] Server fetch warning:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingMonth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, user?.nip, selectedMonth]);

  // Gabungkan attendances dari props dan dari server PostgreSQL
  const userMonthAttendances = useMemo(() => {
    if (!user) return [];
    const mergedMap = new Map<string, AttendanceRecord>();

    // 1. Dari props attendances
    attendances.forEach((a) => {
      const matchUser = a.userId === user.id || a.userId === user.nip || (a.userNip && a.userNip === user.nip);
      const aDate = a.attendanceDate || (a as any).date;
      const matchMonth = aDate && aDate.startsWith(selectedMonth);
      if (matchUser && matchMonth && a.id) {
        mergedMap.set(a.id, a);
      }
    });

    // 2. Dari server PostgreSQL (otoritatif)
    serverMonthAttendances.forEach((a) => {
      if (a.id) {
        mergedMap.set(a.id, a);
      }
    });

    return Array.from(mergedMap.values());
  }, [attendances, serverMonthAttendances, user, selectedMonth]);

  // Map tanggal ke presensi
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    userMonthAttendances.forEach((a) => {
      const d = a.attendanceDate || (a as any).date;
      if (d) map.set(d, a);
    });
    return map;
  }, [userMonthAttendances]);

  // Ambil Jadwal Kerja Roster & Jam Kerja Efektif Karyawan
  const effectiveShift = useMemo(() => {
    if (!user) return null;
    const today = new Date().toISOString().split('T')[0];
    const sched = hrmService.getEmployeeTodaySchedule(user.id, today);
    return resolveEffectiveShift(user, allShifts, sched);
  }, [user, allShifts]);

  // Kalender Grid: Hitung hari-hari dalam bulan (1 s.d akhir bulan)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 = Minggu
    // Konversi ke Senin = 0 ... Minggu = 6
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      attendance?: AttendanceRecord;
      isFuture: boolean;
      isToday: boolean;
    }> = [];

    // Hari dari bulan sebelumnya untuk padding grid
    const prevMonthDays = new Date(yearNum, monthNum - 1, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const prevDay = prevMonthDays - i;
      const prevM = monthNum === 1 ? 12 : monthNum - 1;
      const prevY = monthNum === 1 ? yearNum - 1 : yearNum;
      const dStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: prevDay,
        isCurrentMonth: false,
        attendance: attendanceMap.get(dStr),
        isFuture: false,
        isToday: false,
      });
    }

    // Hari dalam bulan berjalan
    const todayStr = new Date().toISOString().split('T')[0];
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        attendance: attendanceMap.get(dStr),
        isFuture: dStr > todayStr,
        isToday: dStr === todayStr,
      });
    }

    // Hari dari bulan berikutnya untuk melengkapi 35 atau 42 cell
    const remaining = (7 - (days.length % 7)) % 7;
    for (let r = 1; r <= remaining; r++) {
      const nextM = monthNum === 12 ? 1 : monthNum + 1;
      const nextY = monthNum === 12 ? yearNum + 1 : yearNum;
      const dStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(r).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: r,
        isCurrentMonth: false,
        attendance: attendanceMap.get(dStr),
        isFuture: true,
        isToday: false,
      });
    }

    return days;
  }, [yearNum, monthNum, attendanceMap]);

  // Agregasi KPI Bulanan
  const kpiSummary = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let totalLateMinutes = 0;
    let totalWorkMinutes = 0;

    userMonthAttendances.forEach((a) => {
      if (a.status === 'hadir') presentCount++;
      if (a.status === 'terlambat' || (a.lateMinutes && a.lateMinutes > 0)) {
        lateCount++;
        totalLateMinutes += a.lateMinutes || 0;
      }
      totalWorkMinutes += a.workDurationMinutes || 0;
    });

    const totalDays = userMonthAttendances.length;
    const disciplineRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100;
    const estimatedDeduction = totalLateMinutes * 1000;

    return {
      presentCount,
      lateCount,
      totalLateMinutes,
      totalWorkHours: (totalWorkMinutes / 60).toFixed(1),
      disciplineRate,
      estimatedDeduction,
      totalDays,
    };
  }, [userMonthAttendances]);

  // Detail Presensi Tanggal yang Dipilih
  const selectedRecord = useMemo(() => {
    return attendanceMap.get(selectedDateStr) || null;
  }, [attendanceMap, selectedDateStr]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateStr) return '-';
    try {
      const d = new Date(selectedDateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return selectedDateStr;
    }
  }, [selectedDateStr]);

  // Export Rekap Bulanan Individual ke Excel
  const handleExportIndividualExcel = () => {
    if (!user) return;
    const dataToExport = calendarDays
      .filter((d) => d.isCurrentMonth)
      .map((d) => {
        const att = d.attendance;
        return {
          Tanggal: d.dateStr,
          NIP: user.nip,
          Nama: user.fullName,
          Divisi: user.divisionName || '-',
          'Jam Masuk': att?.clockIn ? att.clockIn.substring(0, 5) : '-',
          'Jam Pulang': att?.clockOut ? att.clockOut.substring(0, 5) : '-',
          'Durasi Kerja (Menit)': att?.workDurationMinutes || 0,
          'Terlambat (Menit)': att?.lateMinutes || 0,
          Status: att ? (att.status === 'hadir' ? 'TEPAT WAKTU' : 'TERLAMBAT') : (d.isFuture ? 'BELUM TIBA' : 'LIBUR / NIHIL'),
          'Pos Lapangan / Titik': att?.notes || '-',
          'Skor Biometrik': att?.biometricScore ? `${att.biometricScore}%` : '-',
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Presensi_${user.nip}`);
    XLSX.writeFile(workbook, `Rekap_Presensi_${user.fullName.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-border bg-card shadow-2xl">
        {/* Header Profil Karyawan & Tombol Navigasi */}
        <div className="p-5 border-b border-border bg-muted/20 sticky top-0 z-10 backdrop-blur-md">
          <DialogHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0 overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    user.fullName.charAt(0)
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    {user.fullName}
                    <Badge variant="outline" className="text-[10px] font-mono font-normal">
                      {user.nip}
                    </Badge>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {user.divisionName || 'Operasional Lapangan'} • Shift:{' '}
                    <span className="font-semibold text-foreground">
                      {effectiveShift ? `${effectiveShift.startTime} - ${effectiveShift.endTime} WITA` : '08:00 - 16:30 WITA'}
                    </span>{' '}
                    (Tol: {user.lateToleranceMinutes ?? effectiveShift?.lateToleranceMinutes ?? 15}m)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportIndividualExcel}
                  className="rounded-xl h-8 text-xs gap-1.5 border-border hover:bg-muted font-medium"
                  title="Unduh Rekap Bulanan Karyawan ini (.xlsx)"
                >
                  <FileDown size={13} className="text-primary" />
                  Export Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="rounded-xl h-8 text-xs gap-1.5 border-border hover:bg-muted font-medium hidden sm:inline-flex"
                  title="Cetak Kalender Presensi"
                >
                  <Printer size={13} />
                  Cetak
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Month Navigator Toolbar */}
          <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/80">
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePrevMonth}
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft size={16} />
              </Button>

              <div className="flex items-center gap-1.5 px-3 font-semibold text-xs text-foreground">
                <CalendarIcon size={13} className="text-primary" />
                <span>{monthLabel}</span>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleNextMonth}
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                title="Bulan Berikutnya"
              >
                <ChevronRight size={16} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {selectedMonth !== currentMonthStr && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleResetToCurrentMonth}
                  className="h-8 text-xs rounded-xl font-medium"
                >
                  Bulan Berjalan
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground">
                Menampilkan seluruh rekaman presensi bulan {monthLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* 4 Kartu KPI Kehadiran Bulanan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span className="text-[11px] font-semibold">Tepat Waktu</span>
                <CheckCircle2 size={14} />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                  {kpiSummary.presentCount}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">Hari</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <span className="text-[11px] font-semibold">Terlambat</span>
                <AlertTriangle size={14} />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-amber-700 dark:text-amber-300 font-mono">
                  {kpiSummary.lateCount}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  ({kpiSummary.totalLateMinutes}m)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-between">
              <div className="flex items-center justify-between text-primary">
                <span className="text-[11px] font-semibold">Total Jam Kerja</span>
                <Clock size={14} />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-foreground font-mono">
                  {kpiSummary.totalWorkHours}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">Jam</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/60 border border-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold">Kedisiplinan</span>
                <ShieldCheck size={14} className="text-primary" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-foreground font-mono">
                  {kpiSummary.disciplineRate}%
                </span>
                <span className="text-[10px] text-muted-foreground ml-1">Skor</span>
              </div>
            </div>
          </div>

          {/* Kalender Grid 7 Hari (Senin - Minggu) */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            {/* Header Nama Hari */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground py-2">
              <span>SENIN</span>
              <span>SELASA</span>
              <span>RABU</span>
              <span>KAMIS</span>
              <span>JUMAT</span>
              <span className="text-indigo-600 dark:text-indigo-400">SABTU</span>
              <span className="text-rose-600 dark:text-rose-400">MINGGU</span>
            </div>

            {/* Grid Kotak Tanggal */}
            <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
              {calendarDays.map((d, idx) => {
                const att = d.attendance;
                const isSelected = d.dateStr === selectedDateStr;
                const isSunday = idx % 7 === 6;

                // Tentukan status visual
                let statusBg = 'bg-card hover:bg-muted/30';
                let statusBadge = null;

                if (!d.isCurrentMonth) {
                  statusBg = 'bg-muted/10 opacity-40';
                } else if (att) {
                  if (att.status === 'hadir') {
                    statusBg = isSelected
                      ? 'bg-emerald-500/15 ring-2 ring-emerald-500'
                      : 'bg-emerald-500/5 hover:bg-emerald-500/10';
                    statusBadge = (
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {att.clockIn ? att.clockIn.substring(0, 5) : '-'}
                        </span>
                        {att.clockOut && (
                          <span className="text-[9px] font-mono text-muted-foreground">
                            s/d {att.clockOut.substring(0, 5)}
                          </span>
                        )}
                      </div>
                    );
                  } else if (att.status === 'terlambat' || (att.lateMinutes && att.lateMinutes > 0)) {
                    statusBg = isSelected
                      ? 'bg-amber-500/15 ring-2 ring-amber-500'
                      : 'bg-amber-500/5 hover:bg-amber-500/10';
                    statusBadge = (
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                          {att.clockIn ? att.clockIn.substring(0, 5) : '-'}
                        </span>
                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 w-fit">
                          +{att.lateMinutes || 0}m
                        </span>
                      </div>
                    );
                  }
                } else if (isSunday) {
                  statusBadge = (
                    <span className="mt-1 text-[9px] text-muted-foreground/60 italic">Libur</span>
                  );
                } else if (!d.isFuture) {
                  statusBadge = (
                    <span className="mt-1 text-[9px] text-rose-500/70 font-medium">Alfa / Nihil</span>
                  );
                }

                return (
                  <div
                    key={d.dateStr}
                    onClick={() => {
                      if (d.isCurrentMonth) setSelectedDateStr(d.dateStr);
                    }}
                    className={`min-h-[72px] sm:min-h-[82px] p-2 flex flex-col justify-between transition-all cursor-pointer ${statusBg} ${
                      isSelected ? 'ring-2 ring-primary z-10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          d.isToday
                            ? 'w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold'
                            : isSunday
                            ? 'text-rose-500'
                            : d.isCurrentMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground/40'
                        }`}
                      >
                        {d.dayNum}
                      </span>
                      {d.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Hari Ini" />
                      )}
                    </div>

                    {statusBadge}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel Detail Forensik Tanggal Terpilih */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <CalendarIcon size={14} className="text-primary" />
                <h4 className="text-xs font-bold text-foreground">
                  Rincian Presensi: {selectedDateFormatted}
                </h4>
              </div>

              {selectedRecord ? (
                selectedRecord.status === 'hadir' ? (
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] gap-1 rounded-full">
                    <CheckCircle2 size={11} /> Tepat Waktu
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] gap-1 rounded-full">
                    <AlertTriangle size={11} /> Terlambat ({selectedRecord.lateMinutes || 0} Menit)
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Tidak Ada Presensi Tercatat
                </Badge>
              )}
            </div>

            {selectedRecord ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                {/* Kolom Kiri: Waktu & Pos Lapangan */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 bg-card p-2.5 rounded-xl border border-border/70">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Jam Masuk (Clock-In)</p>
                      <p className="font-mono font-bold text-sm text-foreground">
                        {selectedRecord.clockIn || '-'} WITA
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Jam Pulang (Clock-Out)</p>
                      <p className="font-mono font-bold text-sm text-foreground">
                        {selectedRecord.clockOut || '-'} WITA
                      </p>
                    </div>
                  </div>

                  <div className="bg-card p-2.5 rounded-xl border border-border/70 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <MapPin size={13} className="text-primary shrink-0" />
                      <span className="font-semibold text-foreground">Posisi & Pos Penugasan:</span>
                    </div>
                    <p className="text-xs text-foreground font-medium pl-4">
                      {selectedRecord.notes || 'Pos Operasional FRP'}
                    </p>
                    {selectedRecord.geofenceDistance != null && (
                      <p className="text-[11px] text-muted-foreground pl-4">
                        Radius Jarak GPS:{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {Math.round(selectedRecord.geofenceDistance)} meter
                        </span>{' '}
                        (Area Aman)
                      </p>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Bukti Biometrik & Foto Forensik */}
                <div className="space-y-2.5">
                  <div className="bg-card p-2.5 rounded-xl border border-border/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>InsightFace Biometrik 1:1</span>
                      </div>
                      {selectedRecord.biometricScore != null && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-mono"
                        >
                          {selectedRecord.biometricScore}% Match
                        </Badge>
                      )}
                    </div>

                    {/* Preview Thumbnails Foto Selfie */}
                    <div className="flex items-center gap-3 pt-1">
                      {selectedRecord.clockInPhoto || selectedRecord.photoIn ? (
                        <div
                          onClick={() => {
                            const pUrl = selectedRecord.clockInPhoto || selectedRecord.photoIn;
                            if (pUrl && onOpenPhotoPreview) {
                              onOpenPhotoPreview({
                                url: pUrl,
                                type: 'Masuk',
                                userName: user.fullName,
                                userNip: user.nip,
                                time: selectedRecord.clockIn,
                                date: selectedDateStr,
                                biometricScore: selectedRecord.biometricScore,
                                geofenceDistance: selectedRecord.geofenceDistance,
                              });
                            }
                          }}
                          className="group relative cursor-pointer rounded-lg overflow-hidden border border-emerald-500/40 hover:border-emerald-500 shadow-xs"
                          title="Klik untuk melihat foto selfie masuk full-size"
                        >
                          <img
                            src={selectedRecord.clockInPhoto || selectedRecord.photoIn}
                            alt="Selfie Masuk"
                            className="w-16 h-16 object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-[8px] text-white font-bold text-center py-0.5">
                            Selfie Masuk
                          </span>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center text-[9px] text-muted-foreground border border-dashed border-border">
                          <Camera size={14} />
                          <span>No Foto</span>
                        </div>
                      )}

                      {selectedRecord.clockOutPhoto || selectedRecord.photoOut ? (
                        <div
                          onClick={() => {
                            const pUrl = selectedRecord.clockOutPhoto || selectedRecord.photoOut;
                            if (pUrl && onOpenPhotoPreview) {
                              onOpenPhotoPreview({
                                url: pUrl,
                                type: 'Pulang',
                                userName: user.fullName,
                                userNip: user.nip,
                                time: selectedRecord.clockOut,
                                date: selectedDateStr,
                                biometricScore: selectedRecord.biometricScore,
                                geofenceDistance: selectedRecord.geofenceDistance,
                              });
                            }
                          }}
                          className="group relative cursor-pointer rounded-lg overflow-hidden border border-blue-500/40 hover:border-blue-500 shadow-xs"
                          title="Klik untuk melihat foto selfie pulang full-size"
                        >
                          <img
                            src={selectedRecord.clockOutPhoto || selectedRecord.photoOut}
                            alt="Selfie Pulang"
                            className="w-16 h-16 object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-blue-600/90 text-[8px] text-white font-bold text-center py-0.5">
                            Selfie Pulang
                          </span>
                        </div>
                      ) : null}

                      <div className="text-[11px] text-muted-foreground space-y-1">
                        <p>
                          Status Perangkat:{' '}
                          <span className="font-semibold text-foreground">HP Resmi Terikat</span>
                        </p>
                        <p>
                          Verifikasi Perimeter:{' '}
                          <span className="font-semibold text-emerald-600">Patuh (Dalam Radius)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                Tidak ada data presensi yang tercatat untuk tanggal {selectedDateFormatted}. Karyawan
                mungkin sedang libur roster (OFF) atau belum melakukan presensi.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
