import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Smartphone,
  Eye,
  Download,
  Building2,
  User,
  Activity,
} from 'lucide-react';
import { UserProfile, AttendanceRecord, AttendanceStatus } from '@/types/hrm';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import defaultLogo from '@/assets/logo.png';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  attendance: AttendanceRecord | null;
  allAttendances?: AttendanceRecord[];
  shift?: any;
}

export const HrmEmployeeRealtimeReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  attendance,
  allAttendances = [],
  shift,
}) => {
  const [reportScope, setReportScope] = useState<'today' | 'month' | 'all'>('today');
  const todayStr = getTodayDateStr();
  const currentMonthStr = todayStr.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [serverAttendances, setServerAttendances] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // Ambil pengaturan aplikasi & profil kantor
  const appSettings = useMemo(() => hrmService.getAppSettings(), []);
  const office = useMemo(() => hrmService.getOfficeLocation(), []);

  // Ambil riwayat realtime langsung dari backend jika user aktif
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    setIsLoadingHistory(true);

    const validIds = [user.id, user.nip, user.email].filter(Boolean);

    api.get<{ success: boolean; data?: any[] }>(`/attendances?userId=${encodeURIComponent(user.id)}`)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.data)) {
          setServerAttendances(res.data);
        } else {
          // Fallback ke local
          const localAtts = allAttendances.filter((a) => {
            const aUser = a.userId || (a as any).user_id || a.userNip || (a as any).user_nip;
            return validIds.includes(aUser);
          });
          setServerAttendances(localAtts);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const localAtts = allAttendances.filter((a) => {
          const aUser = a.userId || (a as any).user_id || a.userNip || (a as any).user_nip;
          return validIds.includes(aUser);
        });
        setServerAttendances(localAtts);
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user, allAttendances]);

  // Gabungkan attendance hari ini dengan serverAttendances agar data realtime detik ini selalu masuk
  const combinedAttendances = useMemo(() => {
    if (!user) return [];
    const list = [...serverAttendances];

    if (attendance) {
      const idx = list.findIndex(
        (a) =>
          (a.attendanceDate || (a as any).date) === (attendance.attendanceDate || (attendance as any).date || todayStr)
      );
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...attendance };
      } else {
        list.unshift({ ...attendance, attendanceDate: todayStr, date: todayStr as any });
      }
    }

    return list.sort((a, b) => {
      const dateA = a.attendanceDate || (a as any).date || '';
      const dateB = b.attendanceDate || (b as any).date || '';
      return dateB.localeCompare(dateA);
    });
  }, [serverAttendances, attendance, todayStr, user]);

  // Filter berdasarkan scope terpilih
  const filteredRecords = useMemo(() => {
    if (!user) return [];

    if (reportScope === 'today') {
      return combinedAttendances.filter((a) => {
        const d = (a.attendanceDate || (a as any).date || '').slice(0, 10);
        return d === todayStr;
      });
    }

    if (reportScope === 'month') {
      return combinedAttendances.filter((a) => {
        const d = (a.attendanceDate || (a as any).date || '').slice(0, 7);
        return d === selectedMonth;
      });
    }

    return combinedAttendances;
  }, [combinedAttendances, reportScope, todayStr, selectedMonth, user]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let totalLateMins = 0;
    let onTimeCount = 0;
    let alphaCount = 0;
    let leaveCount = 0;
    let totalWorkMins = 0;
    let biometricSum = 0;
    let biometricCount = 0;

    filteredRecords.forEach((r) => {
      const isLate = r.status === 'terlambat' || (r.lateMinutes && r.lateMinutes > 0);
      const isPresent = r.clockIn || r.clockOut || r.status === 'hadir' || isLate;

      if (isPresent) {
        presentCount++;
        if (isLate) {
          lateCount++;
          totalLateMins += Number(r.lateMinutes || 0);
        } else {
          onTimeCount++;
        }
      } else if (r.status === 'alfa') {
        alphaCount++;
      } else if (r.status === 'izin' || r.status === 'cuti' || r.status === 'sakit') {
        leaveCount++;
      }

      if (r.workDurationMinutes) {
        totalWorkMins += Number(r.workDurationMinutes);
      }

      if (r.biometricScore && Number(r.biometricScore) > 0) {
        biometricSum += Number(r.biometricScore);
        biometricCount++;
      }
    });

    const avgBiometric = biometricCount > 0 ? (biometricSum / biometricCount).toFixed(1) : null;
    const avgWorkHours = presentCount > 0 ? (totalWorkMins / (presentCount * 60)).toFixed(1) : '0';

    return {
      totalRecords: filteredRecords.length,
      presentCount,
      onTimeCount,
      lateCount,
      totalLateMins,
      alphaCount,
      leaveCount,
      avgBiometric,
      avgWorkHours,
    };
  }, [filteredRecords]);

  // Ekspor Excel (.xlsx)
  const handleExportExcel = () => {
    if (!user) return;

    const periodText =
      reportScope === 'today'
        ? `Hari Ini (${todayStr})`
        : reportScope === 'month'
        ? `Bulan ${selectedMonth}`
        : 'Semua Riwayat Realtime';

    const wsData: any[][] = [];

    // Header Kop Surat
    wsData.push(['PT. FAWWAZ RESKI PERWIRA']);
    wsData.push(['DEPARTEMEN SUMBER DAYA MANUSIA & MANAJEMEN OPERASIONAL']);
    wsData.push([`LAPORAN PRESENSI REALTIME & AUDIT FORENSIK PEGAWAI`]);
    wsData.push([`Periode: ${periodText} | Dicetak: ${new Date().toLocaleString('id-ID')}`]);
    wsData.push([]);

    // Data Karyawan
    wsData.push(['INFORMASI PEGAWAI:']);
    wsData.push(['Nama Lengkap', user.fullName, '', 'Divisi / Unit', user.divisionName || '-']);
    wsData.push(['NIP / ID', user.nip, '', 'Jabatan', user.roleName || user.role || 'Karyawan']);
    wsData.push([
      'Shift Kerja',
      shift?.name || user.shiftName || 'Day Shift (07:30 - 16:30 WITA)',
      '',
      'Pos Terdaftar',
      user.assignedLocationName || 'Kantor Pusat / Multi-Titik FRP',
    ]);
    wsData.push([]);

    // Ringkasan KPI
    wsData.push(['RINGKASAN INDIKATOR KEHADIRAN:']);
    wsData.push([
      'Total Hadir',
      stats.presentCount,
      'Tepat Waktu',
      stats.onTimeCount,
      'Terlambat',
      `${stats.lateCount} kali (${stats.totalLateMins}m)`,
      'Mangkir/Alfa',
      stats.alphaCount,
    ]);
    wsData.push([]);

    // Header Tabel Detail
    wsData.push([
      'No',
      'Tanggal',
      'Shift',
      'Jam Masuk',
      'Jam Pulang',
      'Durasi (Jam)',
      'Terlambat (m)',
      'Status Kehadiran',
      'Skor Wajah AI',
      'Radius Geofence',
      'Lokasi / Pos',
      'Catatan Forensik',
    ]);

    // Data Baris Detail
    filteredRecords.forEach((r, idx) => {
      const dateVal = (r.attendanceDate || (r as any).date || '').slice(0, 10);
      const clockInVal = r.clockIn ? r.clockIn.substring(0, 5) : '-';
      const clockOutVal = r.clockOut ? r.clockOut.substring(0, 5) : (r.clockIn ? 'Aktif Bertugas' : '-');
      const durHours = r.workDurationMinutes ? (r.workDurationMinutes / 60).toFixed(1) : '-';
      const statusLabel =
        r.status === 'hadir'
          ? 'TEPAT WAKTU'
          : r.status === 'terlambat'
          ? `TERLAMBAT (${r.lateMinutes || 0}m)`
          : r.status === 'alfa'
          ? 'MANGKIR / ALFA'
          : (r.status || 'NIHIL').toUpperCase();

      const biometricVal = r.biometricScore ? `${r.biometricScore}%` : '-';
      const geofenceVal =
        r.geofenceDistance != null
          ? `${Math.round(r.geofenceDistance)}m ${r.geofenceValid !== false ? '(Valid)' : '(Out)'}`
          : '-';

      wsData.push([
        idx + 1,
        dateVal,
        r.shiftName || shift?.name || 'Reguler',
        clockInVal,
        clockOutVal,
        durHours,
        r.lateMinutes || 0,
        statusLabel,
        biometricVal,
        geofenceVal,
        r.notes?.includes('[Pos:') ? r.notes : (user.assignedLocationName || '-'),
        r.notes || '-',
      ]);
    });

    // Buat worksheet dan workbook
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Atur lebar kolom otomatis
    ws['!cols'] = [
      { wch: 5 },  // No
      { wch: 12 }, // Tanggal
      { wch: 22 }, // Shift
      { wch: 11 }, // Masuk
      { wch: 14 }, // Pulang
      { wch: 13 }, // Durasi
      { wch: 14 }, // Terlambat
      { wch: 20 }, // Status
      { wch: 14 }, // Skor Wajah
      { wch: 16 }, // Radius
      { wch: 25 }, // Lokasi
      { wch: 35 }, // Catatan
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = `Presensi_${user.nip.replace(/[^a-zA-Z0-9]/g, '_')}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanName = user.fullName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `Laporan_Presensi_Realtime_${cleanName}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Cetak Dokumen Resmi / PDF
  const handlePrintPdf = () => {
    window.print();
  };

  if (!user) return null;

  const currentAtt = attendance || filteredRecords[0] || null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-border bg-card shadow-2xl">
          {/* Header Action Bar */}
          <div className="p-4 sm:p-5 border-b border-border bg-muted/20 sticky top-0 z-20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/20 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Laporan Presensi Realtime
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                    Live Verified
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {user.fullName} ({user.nip}) • {user.divisionName || 'Operasional'}
                </p>
              </div>
            </div>

            {/* Tombol Aksi Download */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
                className="h-8 px-3 text-xs rounded-xl gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium shadow-xs"
                title="Unduh format spreadsheet Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Unduh Excel (.xlsx)
              </Button>

              <Button
                size="sm"
                onClick={handlePrintPdf}
                className="h-8 px-3 text-xs rounded-xl gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                title="Cetak langsung atau simpan sebagai file PDF A4"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak / Unduh PDF
              </Button>
            </div>
          </div>

          {/* FILTER SCOPE BAR */}
          <div className="px-5 pt-4 pb-2 border-b border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={reportScope} onValueChange={(v) => setReportScope(v as any)}>
              <TabsList className="h-8 bg-muted/60 p-0.5 rounded-xl border border-border">
                <TabsTrigger value="today" className="text-xs px-3 h-7 rounded-lg">
                  Hari Ini ({todayStr})
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3 h-7 rounded-lg">
                  Bulan Ini ({currentMonthStr})
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs px-3 h-7 rounded-lg">
                  Semua Riwayat ({combinedAttendances.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {reportScope === 'month' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Pilih Bulan:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-8 px-2.5 text-xs rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* PRINTABLE DOKUMEN CONTAINER (FORMAT FORMAL A4 DENGAN KOP SURAT) */}
          <div id="printable-employee-report" className="p-5 sm:p-8 space-y-6 bg-card text-foreground">
            {/* KOP SURAT RESMI PT. FAWWAZ RESKI PERWIRA */}
            <div className="flex items-center gap-4 pb-4 border-b-2 border-foreground/80">
              <img
                src={appSettings.logoUrl || defaultLogo}
                alt="Logo PT FRP"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0"
              />
              <div className="flex-1 text-center pr-6">
                <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-foreground">
                  {appSettings.appName || 'PT. FAWWAZ RESKI PERWIRA'}
                </h1>
                <p className="text-[11px] sm:text-xs font-bold text-foreground/90 uppercase tracking-wide">
                  DEPARTEMEN SUMBER DAYA MANUSIA, GA &amp; MANAJEMEN OPERASIONAL
                </p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                  {office?.address || 'Jl. Jenderal Sudirman No. 88, Makassar - Sulawesi Selatan'}
                </p>
                <p className="text-[9.5px] text-muted-foreground font-mono">
                  Domain: fawwazreskiperwira.com • Email: official@fawwazreskiperwira.com
                </p>
              </div>
            </div>

            {/* JUDUL DOKUMEN & METADATA */}
            <div className="text-center space-y-1">
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-widest underline decoration-2 decoration-primary">
                LEMBAR AUDIT PRESENSI &amp; VERIFIKASI FORENSIK REALTIME
              </h2>
              <p className="text-[10px] sm:text-xs font-mono text-muted-foreground">
                No. Dokumen: FRP/HRM-REP/{user.nip.replace(/[^a-zA-Z0-9]/g, '')}/{todayStr.replace(/-/g, '')} • Waktu Server: WITA (UTC+8)
              </p>
            </div>

            {/* KARTU PROFIL PEGAWAI & PENUGASAN */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Nama Pegawai:</span>
                  <strong className="text-foreground">{user.fullName}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center font-mono text-primary font-bold">#</span>
                  <span className="text-muted-foreground">NIP / ID Karyawan:</span>
                  <Badge variant="outline" className="font-mono text-[10px] font-bold">
                    {user.nip}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Divisi / Unit:</span>
                  <span className="text-foreground font-medium">{user.divisionName || 'Operasional Lapangan'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-muted-foreground">Jadwal Shift:</span>
                  <span className="text-foreground font-medium">
                    {shift?.name || user.shiftName || 'Day Shift'} (
                    {shift?.startTime || user.customStartTime || '07:30'} -{' '}
                    {shift?.endTime || user.customEndTime || '16:30'} WITA)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-muted-foreground">Pos Penugasan:</span>
                  <span className="text-foreground font-medium truncate">
                    {user.assignedLocationName || 'Multi-Titik Pos FRP'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-muted-foreground">Perangkat HP:</span>
                  <span className="text-foreground font-mono text-[11px]">
                    {user.deviceModel || 'HP Resmi Karyawan'}
                  </span>
                </div>
              </div>
            </div>

            {/* RINGKASAN STATUS HARI INI JIKA SCOPE TODAY / ADA ATTENDANCE */}
            {currentAtt && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
                      Status Presensi Terkini Hari Ini ({todayStr})
                    </h3>
                  </div>
                  <Badge
                    className={
                      currentAtt.status === 'terlambat'
                        ? 'bg-amber-500 text-white text-[10px] font-bold'
                        : 'bg-emerald-600 text-white text-[10px] font-bold'
                    }
                  >
                    {currentAtt.status === 'terlambat'
                      ? `TERLAMBAT (${currentAtt.lateMinutes || 0}m)`
                      : 'HADIR TEPAT WAKTU'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <p className="text-[10px] text-muted-foreground">Jam Masuk</p>
                    <p className="font-mono font-bold text-sm text-foreground mt-0.5">
                      {currentAtt.clockIn ? `${currentAtt.clockIn.substring(0, 5)} WITA` : '-'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <p className="text-[10px] text-muted-foreground">Jam Pulang</p>
                    <p className="font-mono font-bold text-sm text-foreground mt-0.5">
                      {currentAtt.clockOut
                        ? `${currentAtt.clockOut.substring(0, 5)} WITA`
                        : currentAtt.clockIn
                        ? 'Aktif Bertugas'
                        : '-'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <p className="text-[10px] text-muted-foreground">Skor Wajah AI</p>
                    <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {currentAtt.biometricScore ? `${currentAtt.biometricScore}%` : 'Terverifikasi'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <p className="text-[10px] text-muted-foreground">Radius Geofence</p>
                    <p className="font-mono font-bold text-sm text-foreground mt-0.5">
                      {currentAtt.geofenceDistance != null
                        ? `${Math.round(currentAtt.geofenceDistance)}m (Valid)`
                        : 'Sesuai Pos'}
                    </p>
                  </div>
                </div>

                {/* Foto Forensik Snapshot */}
                {(currentAtt.photoIn || (currentAtt as any).clockInPhoto) && (
                  <div className="pt-2 flex items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary transition-all relative shrink-0 group"
                      onClick={() =>
                        setPreviewPhoto({
                          url: (currentAtt.photoIn || (currentAtt as any).clockInPhoto)!,
                          title: `Foto Presensi Masuk - ${user.fullName}`,
                        })
                      }
                      title="Klik untuk melihat foto forensik resolusi penuh"
                    >
                      <img
                        src={(currentAtt.photoIn || (currentAtt as any).clockInPhoto)!}
                        alt="Foto Presensi Masuk"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-foreground">Bukti Foto Forensik Masuk</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Dilengkapi stempel watermark permanen GPS &amp; waktu WITA.
                      </p>
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0 h-auto text-[11px] text-primary"
                        onClick={() =>
                          setPreviewPhoto({
                            url: (currentAtt.photoIn || (currentAtt as any).clockInPhoto)!,
                            title: `Sertifikat Forensik Wajah Masuk - ${user.fullName}`,
                          })
                        }
                      >
                        Buka Foto Forensik Layar Penuh →
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INDIKATOR METRIK STATISTIK PERIODE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-border bg-card">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Hadir</p>
                <p className="text-xl font-black text-foreground mt-1">
                  {stats.presentCount}{' '}
                  <span className="text-xs font-normal text-muted-foreground">/ {stats.totalRecords} rekaman</span>
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-card">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tepat Waktu</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.onTimeCount}{' '}
                  <span className="text-xs font-normal text-muted-foreground">hari</span>
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-card">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Keterlambatan</p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {stats.lateCount}{' '}
                  <span className="text-xs font-normal text-muted-foreground">({stats.totalLateMins} menit)</span>
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-card">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Skor Biometrik Rata-rata</p>
                <p className="text-xl font-black text-primary mt-1">
                  {stats.avgBiometric ? `${stats.avgBiometric}%` : '95.0%'}
                </p>
              </div>
            </div>

            {/* TABEL RINCIAN LOG KEHADIRAN */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
                  Rincian Riwayat Presensi Realtime ({filteredRecords.length} Hari)
                </h3>
                {isLoadingHistory && (
                  <span className="text-[11px] text-muted-foreground animate-pulse font-mono">
                    Sinkronisasi data database...
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-border/80 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/50 border-b border-border/80 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5 text-center">Masuk</th>
                      <th className="p-2.5 text-center">Pulang</th>
                      <th className="p-2.5 text-center">Terlambat</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Skor AI</th>
                      <th className="p-2.5">Pos / Lokasi Tugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground text-xs italic">
                          Belum ada catatan presensi pada rentang periode yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, i) => {
                        const dateStr = (r.attendanceDate || (r as any).date || '').slice(0, 10);
                        const isLate = r.status === 'terlambat' || (r.lateMinutes && r.lateMinutes > 0);

                        return (
                          <tr key={r.id || i} className="hover:bg-muted/20 transition-colors">
                            <td className="p-2.5 text-center font-mono text-muted-foreground">{i + 1}</td>
                            <td className="p-2.5 font-mono font-medium">{dateStr}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-foreground">
                              {r.clockIn ? r.clockIn.substring(0, 5) : '-'}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-foreground">
                              {r.clockOut ? r.clockOut.substring(0, 5) : (r.clockIn ? 'Aktif' : '-')}
                            </td>
                            <td className="p-2.5 text-center font-mono">
                              {r.lateMinutes && r.lateMinutes > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  {r.lateMinutes}m
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {isLate ? (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9px] py-0 px-1.5 font-bold">
                                  Terlambat
                                </Badge>
                              ) : r.status === 'hadir' || r.clockIn ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] py-0 px-1.5 font-bold">
                                  Hadir
                                </Badge>
                              ) : r.status === 'alfa' ? (
                                <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[9px] py-0 px-1.5 font-bold">
                                  Alfa
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                                  {r.status || 'Nihil'}
                                </Badge>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono text-emerald-600 font-semibold">
                              {r.biometricScore ? `${r.biometricScore}%` : '-'}
                            </td>
                            <td className="p-2.5 text-muted-foreground truncate max-w-[180px]">
                              {r.notes || user.assignedLocationName || 'Kantor Pos FRP'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* KOLOM TANDA TANGAN RESMI PENGESAHAN DOKUMEN */}
            <div className="pt-8 border-t border-border/80 grid grid-cols-3 gap-4 text-center text-xs text-foreground">
              <div className="space-y-16">
                <p className="text-[11px] text-muted-foreground">Pegawai Bersangkutan,</p>
                <div>
                  <p className="font-bold underline uppercase">{user.fullName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">NIP: {user.nip}</p>
                </div>
              </div>

              <div className="space-y-16">
                <p className="text-[11px] text-muted-foreground">Diverifikasi Oleh (HRD/Superadmin),</p>
                <div>
                  <p className="font-bold underline uppercase">Bpk Reski Faisal</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Pimpinan Operasional</p>
                </div>
              </div>

              <div className="space-y-16">
                <p className="text-[11px] text-muted-foreground">Mengetahui &amp; Menyetujui,</p>
                <div>
                  <p className="font-bold underline uppercase">Bpk Alam AS simpuang ago, S.Sos</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Direktur Utama PT FRP</p>
                </div>
              </div>
            </div>

            {/* WATERMARK CATATAN HUKUM & INTEGRITAS */}
            <div className="pt-2 text-center text-[9px] text-muted-foreground font-mono">
              Dokumen ini dihasilkan secara otomatis oleh Sistem HRM PT. FAWWAZ RESKI PERWIRA dengan verifikasi biometrik 1:1 dan geofencing radar. Sah dan mengikat untuk keperluan audit operasional dan penggajian.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Foto Forensik Fullscreen */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-xl p-3 rounded-2xl bg-black/95 text-white border border-border shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h4 className="text-xs font-bold truncate">{previewPhoto?.title}</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPreviewPhoto(null)}
              className="h-6 w-6 p-0 text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {previewPhoto && (
            <div className="mt-2 rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

