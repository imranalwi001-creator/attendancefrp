import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Eye,
  Download,
  Building2,
  User,
  Activity,
  Edit3,
  Save,
  RotateCcw,
  Sparkles,
  Loader2,
  CalendarCheck,
} from 'lucide-react';
import { UserProfile, AttendanceRecord, OvertimeRecord, isLeadershipSpecialFieldOfficer, isSpecialDutyOfficer } from '@/types/hrm';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import defaultLogo from '@/assets/logo.png';
import { HrmEmployeeLeaveCorrectionModal } from './HrmEmployeeLeaveCorrectionModal';

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
  // 3 Petugas Lapangan Khusus Pimpinan (Muh Aslam Faisal, La Unga Samsi, Takdir)
  const isSpecialTarget = useMemo(() => {
    if (!user) return false;
    return isLeadershipSpecialFieldOfficer(user) || isSpecialDutyOfficer(user);
  }, [user]);

  const todayStr = getTodayDateStr(); // e.g. '2026-10-29'
  const currentMonthStr = todayStr.slice(0, 7); // e.g. '2026-10'

  // Hitung string bulan lalu (N-1)
  const prevMonthStr = useMemo(() => {
    const [y, m] = currentMonthStr.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevY}-${prevM}`;
  }, [currentMonthStr]);

  // State bulan yang dipilih
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [serverAttendances, setServerAttendances] = useState<AttendanceRecord[]>([]);
  const [serverOvertimes, setServerOvertimes] = useState<OvertimeRecord[]>([]);
  const [serverLeaves, setServerLeaves] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Tab view: format lembar kerja resmi vs forensik
  const [activeTab, setActiveTab] = useState<'timesheet' | 'forensic'>('timesheet');

  // Metadata form editable (NAMA, NO.ID, POLA SHIFT, SEKSI, UNIT, DEPARTEMEN, KAUR)
  const [isEditingMeta, setIsEditingMeta] = useState<boolean>(false);
  const [employeeSeksi, setEmployeeSeksi] = useState<string>('');
  const [employeeUnit, setEmployeeUnit] = useState<string>('');
  const [employeeDept, setEmployeeDept] = useState<string>('');
  const [employeeShiftPattern, setEmployeeShiftPattern] = useState<string>('');
  const [employeeKaur, setEmployeeKaur] = useState<string>('');

  // Dialog Koreksi Kuota & Saldo Cuti Karyawan
  const [isLeaveCorrectionOpen, setIsLeaveCorrectionOpen] = useState<boolean>(false);
  const [manualLeaveOverride, setManualLeaveOverride] = useState<{ quota: number; used: number; remaining: number } | null>(null);

  // Preview foto forensik
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  // Ambil pengaturan aplikasi & profil kantor
  const appSettings = useMemo(() => hrmService.getAppSettings(), []);
  const office = useMemo(() => hrmService.getOfficeLocation(), []);

  // Format label bulan Indonesia (contoh: "Oktober 2026")
  const monthLabel = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const prevMonthLabel = useMemo(() => {
    if (!prevMonthStr) return '';
    const [y, m] = prevMonthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [prevMonthStr]);

  const currentMonthLabel = useMemo(() => {
    if (!currentMonthStr) return '';
    const [y, m] = currentMonthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [currentMonthStr]);

  // Inisialisasi metadata saat user dibuka
  useEffect(() => {
    if (!user) return;

    const nipUpper = (user.nip || '').toUpperCase();
    const isShipment =
      user.operationalGroup === 'SHIPMENT' ||
      nipUpper.includes('FR07') ||
      (user.divisionName && user.divisionName.toLowerCase().includes('shipment'));

    const isWisma =
      user.operationalGroup === 'RUMAH TANGGA' ||
      (user.divisionName && user.divisionName.toLowerCase().includes('wisma'));

    if (isShipment) {
      setEmployeeSeksi(user.divisionName ? `Sec. of ${user.divisionName}` : 'Sec. of Shipment Management 2');
      setEmployeeUnit('Unit of Outbond Inventory I & IV');
      setEmployeeDept('kantor pusat semen tonasa');
      setEmployeeShiftPattern(shift?.name || user.shiftName || 'SIFT NORMAL ( 2/1/3)');
      setEmployeeKaur(user.kepalaReguName || 'Kaur Sec. of Shipment Management');
    } else if (isWisma) {
      setEmployeeSeksi(user.divisionName ? `Seksi ${user.divisionName}` : 'Seksi Pengelolaan Wisma');
      setEmployeeUnit('Unit Wisma Biring Ere');
      setEmployeeDept('kantor pusat semen tonasa');
      setEmployeeShiftPattern(shift?.name || user.shiftName || 'SIFT NORMAL ( 2/1/3)');
      setEmployeeKaur(user.kepalaReguName || 'Kaur Rumah Tangga & Wisma');
    } else {
      setEmployeeSeksi(user.divisionName ? `Seksi ${user.divisionName}` : 'Seksi Administrasi & Operasional');
      setEmployeeUnit('Unit Operasional Lapangan');
      setEmployeeDept('kantor pusat semen tonasa');
      setEmployeeShiftPattern(shift?.name || user.shiftName || 'SIFT NORMAL ( 2/1/3)');
      setEmployeeKaur(isSpecialTarget ? 'Pimpinan PT. FRP' : (user.kepalaReguName || 'Kaur Operasional'));
    }
  }, [user, shift]);

  // Ambil data presensi & lembur dari server & local
  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    setIsLoadingData(true);

    const validIds = [user.id, user.nip, user.email].filter(Boolean);

    // Fetch attendances dari API
    const attPromise = api
      .get<{ success: boolean; data?: any[] }>(`/attendances?userId=${encodeURIComponent(user.id)}`)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.data)) {
          setServerAttendances(res.data);
        } else {
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
      });

    // Fetch overtimes dari API & LocalStorage
    const otPromise = api
      .get<{ success: boolean; data?: any[] }>(`/overtime?userId=${encodeURIComponent(user.id)}`)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.data)) {
          setServerOvertimes(res.data);
        } else {
          const localOt = hrmService.getOvertimeRecords().filter((o) => validIds.includes(o.userId) || validIds.includes(o.userNip));
          setServerOvertimes(localOt);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const localOt = hrmService.getOvertimeRecords().filter((o) => validIds.includes(o.userId) || validIds.includes(o.userNip));
        setServerOvertimes(localOt);
      });

    // Fetch leaves dari API & LocalStorage
    const leavePromise = api
      .get<{ success: boolean; data?: any[] }>(`/leaves?userId=${encodeURIComponent(user.id)}`)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.data)) {
          setServerLeaves(res.data);
        } else {
          const localLeaves = hrmService.getLeaveRequests().filter((l) => validIds.includes(l.userId) || validIds.includes(l.userNip));
          setServerLeaves(localLeaves);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const localLeaves = hrmService.getLeaveRequests().filter((l) => validIds.includes(l.userId) || validIds.includes(l.userNip));
        setServerLeaves(localLeaves);
      });

    Promise.allSettled([attPromise, otPromise, leavePromise]).finally(() => {
      if (isMounted) setIsLoadingData(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user, allAttendances]);

  // Gabungkan attendance hari ini agar realtime
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

    return list;
  }, [serverAttendances, attendance, todayStr, user]);

  // Gabungkan overtime lokal & server
  const combinedOvertimes = useMemo(() => {
    if (!user) return [];
    const localOt = hrmService.getOvertimeRecords().filter((o) => o.userId === user.id || o.userNip === user.nip);
    const map = new Map<string, OvertimeRecord>();
    localOt.forEach((o) => map.set(o.id || o.date, o));
    serverOvertimes.forEach((o) => map.set(o.id || o.date, o));
    return Array.from(map.values());
  }, [serverOvertimes, user]);

  // Buat deretan baris harian tanggal 1 sampai akhir bulan (persis format lampiran)
  const monthlyRows = useMemo(() => {
    if (!selectedMonth || !user) return [];

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const rows = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayPadded = String(day).padStart(2, '0');
      const dateStr = `${yearStr}-${monthStr}-${dayPadded}`;
      const dateLabel = `${day}-${month}-${year}`; // e.g. "1-10-2026"

      const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0: Minggu, 6: Sabtu
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;

      // Cari presensi pada tanggal ini
      const att = combinedAttendances.find(
        (a) => (a.attendanceDate || (a as any).date || '').slice(0, 10) === dateStr
      );

      // Cari lembur pada tanggal ini
      const ot = combinedOvertimes.find((o) => o.date === dateStr);

      let absenMasuk = '-';
      let absenPulang = '-';
      let telatMnt = '-';
      let lemburMulai = '-';
      let lemburSelesai = '-';
      let realisasiJamLembur = '-';
      let uraianPekerjaan = '-';
      let memerintahkanKaur = '-';
      let ket = '-';

      const hasClockIn = Boolean(att?.clockIn);
      const hasClockOut = Boolean(att?.clockOut);

      if (att) {
        if (hasClockIn) {
          absenMasuk = (att.clockIn || '').substring(0, 5);
        }
        if (hasClockOut) {
          absenPulang = (att.clockOut || '').substring(0, 5);
        }

        if (att.lateMinutes && Number(att.lateMinutes) > 0) {
          telatMnt = String(att.lateMinutes);
        }

        if (att.status === 'hadir') {
          ket = 'HADIR';
        } else if (att.status === 'terlambat') {
          ket = 'TELAT';
        } else if (att.status === 'off' || att.status === 'libur') {
          absenMasuk = 'OFF';
          absenPulang = 'OFF';
          ket = 'OFF';
        } else if (att.status === 'cuti') {
          absenMasuk = 'CUTI';
          absenPulang = 'CUTI';
          ket = 'CUTI';
        } else if (att.status === 'izin') {
          absenMasuk = 'IZIN';
          absenPulang = 'IZIN';
          ket = 'IZIN';
        } else if (att.status === 'sakit') {
          absenMasuk = 'SAKIT';
          absenPulang = 'SAKIT';
          ket = 'SAKIT';
        } else if (att.status === 'alfa') {
          absenMasuk = '-';
          absenPulang = '-';
          ket = 'ALPA';
        } else if (hasClockIn) {
          ket = 'HADIR';
        }

        if (att.notes) {
          uraianPekerjaan = att.notes;
        }
      } else {
        // Belum ada data presensi
        if (isWeekend) {
          absenMasuk = 'OFF';
          absenPulang = 'OFF';
          ket = 'OFF';
        } else if (isPast) {
          absenMasuk = '-';
          absenPulang = '-';
          ket = 'ALPA';
        } else if (isToday) {
          absenMasuk = '-';
          absenPulang = '-';
          ket = 'BELUM ABSEN';
        }
      }

      // Lembur
      if (ot) {
        lemburMulai = ot.startTime ? ot.startTime.substring(0, 5) : '-';
        lemburSelesai = ot.endTime ? ot.endTime.substring(0, 5) : '-';
        const hours = Number(ot.approvedHours || ot.durationHours || 0);
        realisasiJamLembur = hours > 0 ? String(hours) : '-';
        if (ot.taskDescription) {
          uraianPekerjaan = ot.taskDescription;
        }
        memerintahkanKaur = ot.supervisorName || ot.approvedByName || employeeKaur || '-';
        if (ket === '-' || ket === 'OFF') {
          ket = 'LEMBUR';
        }
      } else if (att && (att as any).overtimeHours) {
        realisasiJamLembur = String((att as any).overtimeHours);
        if (ket === '-' || ket === 'OFF') ket = 'LEMBUR';
      }

      // Tentukan Uraian Pekerjaan secara Dinamis & Elegan (bebas tag teknis sistem)
      if (ket === 'CUTI') {
        uraianPekerjaan = 'Cuti Tahunan';
      } else if (ket === 'SAKIT') {
        uraianPekerjaan = 'Izin Sakit (Surat Dokter)';
      } else if (ket === 'IZIN') {
        uraianPekerjaan = 'Izin Tidak Masuk Kerja';
      } else if (ket === 'ALPA') {
        uraianPekerjaan = 'Mangkir / Tanpa Keterangan';
      } else if (ket === 'OFF') {
        uraianPekerjaan = '-';
      } else if (ot && ot.taskDescription) {
        uraianPekerjaan = ot.taskDescription;
      } else if (att && att.notes) {
        let clean = att.notes;
        clean = clean
          .replace(/\[Koreksi Superadmin: Kehadiran Disahkan\]/gi, '')
          .replace(/\[AUTO-CLOSED.*?\]/gi, '')
          .replace(/\[Dispensasi.*?\]/gi, '')
          .trim();
        const posMatch = clean.match(/\[Pos:\s*([^\]]+)\]/i);
        if (posMatch) {
          uraianPekerjaan = `Tugas Lapangan di Pos ${posMatch[1].trim()}`;
        } else if (clean.length > 0 && !clean.startsWith('[')) {
          uraianPekerjaan = clean;
        } else {
          uraianPekerjaan = isSpecialTarget ? 'Pengawasan Lapangan Khusus Pimpinan' : 'Tugas Lapangan Operasional';
        }
      } else if (hasClockIn) {
        uraianPekerjaan = isSpecialTarget ? 'Pengawasan Lapangan Khusus Pimpinan' : 'Tugas Lapangan Operasional';
      }

      // Default KAUR / Pengesahan: Khusus 3 Petugas Lapangan Khusus Pimpinan langsung oleh Pimpinan PT. FRP
      if (isSpecialTarget) {
        memerintahkanKaur = ket === 'OFF' ? '-' : 'Pimpinan PT. FRP';
      } else if (hasClockIn && memerintahkanKaur === '-') {
        memerintahkanKaur = employeeKaur || '-';
      }

      rows.push({
        no: day,
        tanggal: dateLabel,
        rawDate: dateStr,
        isWeekend,
        isToday,
        isPast,
        absenMasuk,
        absenPulang,
        telatMnt,
        lemburMulai,
        lemburSelesai,
        realisasiJamLembur,
        uraianPekerjaan,
        memerintahkanKaur,
        ket,
        attRecord: att,
      });
    }

    return rows;
  }, [selectedMonth, user, todayStr, combinedAttendances, combinedOvertimes, employeeKaur]);

  // Statistik Rekapan Bulanan (Presisi & Dinamis)
  const stats = useMemo(() => {
    let totalHadir = 0;
    let totalTelatKali = 0;
    let totalTelatMnt = 0;
    let totalOff = 0;
    let totalCuti = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpa = 0;
    let totalJamLembur = 0;

    monthlyRows.forEach((r) => {
      // HANYA hitung Hadir jika benar-benar HADIR atau TELAT atau LEMBUR (Bukan Cuti/Sakit/Izin/Off/Alpa)
      if (r.ket === 'HADIR' || r.ket === 'TELAT' || r.ket === 'LEMBUR') {
        totalHadir++;
      }
      if (r.telatMnt !== '-') {
        totalTelatKali++;
        totalTelatMnt += parseInt(r.telatMnt, 10) || 0;
      }
      if (r.ket === 'OFF') {
        totalOff++;
      }
      if (r.ket === 'CUTI') {
        totalCuti++;
      }
      if (r.ket === 'IZIN') {
        totalIzin++;
      }
      if (r.ket === 'SAKIT') {
        totalSakit++;
      }
      if (r.ket === 'ALPA') {
        totalAlpa++;
      }
      if (r.realisasiJamLembur !== '-') {
        totalJamLembur += parseFloat(r.realisasiJamLembur) || 0;
      }
    });

    return {
      totalHadir,
      totalTelatKali,
      totalTelatMnt,
      totalOff,
      totalCuti,
      totalIzin,
      totalSakit,
      totalAlpa,
      totalJamLembur: Number(totalJamLembur.toFixed(1)),
    };
  }, [monthlyRows]);

  // Status Cuti Karyawan Realtime (Sinkron Database PostgreSQL & Quota Tracking)
  const leaveStats = useMemo(() => {
    if (manualLeaveOverride) {
      return manualLeaveOverride;
    }
    if (!user) return { quota: 12, used: 0, remaining: 12 };
    const quota = Number(user.annualLeaveQuota ?? (user as any).annual_leave_quota ?? 12);
    const profileUsed = Number(user.usedLeaveDays ?? (user as any).used_leave_days ?? 0);

    const validIds = [user.id, user.nip, user.email].filter(Boolean).map((s) => String(s).toLowerCase().trim());

    // 1. Akumulasi tanggal cuti unik dari seluruh riwayat presensi (serverAttendances & combinedAttendances)
    const cutiDatesSet = new Set<string>();
    const allAtts = serverAttendances.length > 0 ? serverAttendances : combinedAttendances;
    allAtts.forEach((a: any) => {
      const st = String(a.status || '').toLowerCase().trim();
      const notes = String(a.notes || '').toLowerCase().trim();
      const isCuti = st === 'cuti' || (notes.includes('cuti') && (!a.clockIn || a.clockIn === '-' || a.clockIn === 'CUTI'));
      const d = a.attendanceDate || a.date;
      if (isCuti && d) {
        cutiDatesSet.add(String(d).substring(0, 10));
      }
    });

    // 2. Tambahkan hari cuti dari tabel bulan aktif (monthlyRows)
    monthlyRows.forEach((r) => {
      if (r.ket === 'CUTI' || r.absenMasuk === 'CUTI') {
        if (r.rawDate) {
          cutiDatesSet.add(String(r.rawDate).substring(0, 10));
        }
      }
    });

    // 3. Sertakan pengajuan cuti yang disetujui (hrm_leave_requests)
    const leaveSource = serverLeaves.length > 0 ? serverLeaves : hrmService.getLeaveRequests();
    const approvedCutiList = leaveSource.filter((l: any) => {
      const uId = String(l.userId || l.user_id || '').toLowerCase().trim();
      const uNip = String(l.userNip || l.user_nip || l.nip || '').toLowerCase().trim();
      const match = validIds.includes(uId) || (uNip && validIds.includes(uNip));
      const isApproved = String(l.status || '').toLowerCase() === 'approved';
      const lType = String(l.leaveType || l.leave_type || '').toLowerCase();
      const isCuti = lType.includes('cuti') || lType === 'annual_leave';
      return match && isApproved && isCuti;
    });

    let leaveReqDays = 0;
    approvedCutiList.forEach((l: any) => {
      const totalDays = Number(l.totalDays || l.total_days || 1);
      if (l.startDate && l.endDate) {
        const s = new Date(l.startDate);
        const e = new Date(l.endDate);
        for (let dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) {
          cutiDatesSet.add(dt.toISOString().substring(0, 10));
        }
      } else {
        leaveReqDays += totalDays;
      }
    });

    // 4. Hitung total cuti terpakai realtime
    const used = Math.max(
      profileUsed,
      cutiDatesSet.size,
      stats.totalCuti,
      leaveReqDays
    );

    // 5. Hitung sisa cuti (tidak boleh negatif)
    const remaining = Math.max(0, quota - used);

    return { quota, used, remaining };
  }, [user, serverLeaves, serverAttendances, combinedAttendances, monthlyRows, stats.totalCuti]);

  // Ekspor Excel (.xlsx) dengan Format Persis Lampiran
  const handleExportExcel = () => {
    if (!user) return;

    const wsData: any[][] = [];

    // Header Instansi
    wsData.push(['PT. FAWWAZ RESKI PERWIRA']);
    wsData.push(['SISTEM OPERASIONAL, PRESENSI & AUDIT LEMBUR KARYAWAN']);
    wsData.push([`REKAPITULASI PRESENSI & LEMBUR - BULAN ${monthLabel.toUpperCase()}`]);
    wsData.push([]);

    // Kotak Metadata Karyawan (Sesuai Lampiran + Informasi Cuti Realtime)
    wsData.push(['NAMA', ':', user.fullName, '', '', 'SEKSI', ':', employeeSeksi, '', 'HAK CUTI TAHUNAN', ':', `${leaveStats.quota} Hari`]);
    wsData.push(['NO.ID', ':', user.nip, '', '', 'UNIT', ':', employeeUnit, '', 'CUTI TERPAKAI', ':', `${leaveStats.used} Hari (Realtime)`]);
    wsData.push(['POLA SHIFT', ':', employeeShiftPattern, '', '', 'DEPARTEMEN', ':', employeeDept, '', 'SISA CUTI', ':', `${leaveStats.remaining} Hari`]);
    wsData.push([]);

    // Baris Header Tabel Tingkat 1
    wsData.push([
      'NO',
      'TANGGAL',
      'ABSEN',
      '',
      '',
      'LEMBUR',
      '',
      'REALISASI JAM LEMBUR',
      'URAIAN PEKERJAAN',
      'MEMERINTAHKAN (KAUR)',
      'KET.',
    ]);

    // Baris Header Tabel Tingkat 2
    wsData.push([
      '',
      '',
      'MASUK',
      'PULANG',
      'TELAT (MNT)',
      'MULAI',
      'SELESAI',
      '',
      '',
      '',
      '',
    ]);

    // Baris Data Harian (1 sampai akhir bulan)
    monthlyRows.forEach((r) => {
      wsData.push([
        r.no,
        r.tanggal,
        r.absenMasuk,
        r.absenPulang,
        r.telatMnt,
        r.lemburMulai,
        r.lemburSelesai,
        r.realisasiJamLembur,
        r.uraianPekerjaan,
        r.memerintahkanKaur,
        r.ket,
      ]);
    });

    // Baris Total / Rekapan
    wsData.push([]);
    wsData.push([
      '',
      'TOTAL / REKAPAN',
      `Hadir: ${stats.totalHadir} Hari`,
      `OFF: ${stats.totalOff} Hari`,
      stats.totalTelatMnt > 0 ? `${stats.totalTelatMnt} Mnt (${stats.totalTelatKali}x)` : '-',
      '',
      '',
      stats.totalJamLembur > 0 ? `${stats.totalJamLembur} Jam` : '-',
      `Cuti: ${stats.totalCuti} | Sakit: ${stats.totalSakit} | Izin: ${stats.totalIzin}`,
      '',
      `Alpa: ${stats.totalAlpa} Hari`,
    ]);

    // Ringkasan Tambahan
    wsData.push([]);
    wsData.push(['RINGKASAN REKAPITULASI:']);
    wsData.push(['1. Total Kehadiran Kerja', ':', `${stats.totalHadir} Hari`]);
    wsData.push(['2. Total Keterlambatan', ':', `${stats.totalTelatMnt} Menit (${stats.totalTelatKali} kali)`]);
    wsData.push(['3. Total Realisasi Jam Lembur', ':', `${stats.totalJamLembur} Jam`]);
    wsData.push(['4. Total Hari Libur / OFF', ':', `${stats.totalOff} Hari`]);
    wsData.push(['5. Total Cuti Tahunan', ':', `${stats.totalCuti} Hari`]);
    wsData.push(['6. Total Izin Sakit', ':', `${stats.totalSakit} Hari`]);
    wsData.push(['7. Total Izin Lainnya', ':', `${stats.totalIzin} Hari`]);
    wsData.push(['8. Total Mangkir / Alpa', ':', `${stats.totalAlpa} Hari`]);
    wsData.push([]);

    // Tanda Tangan Pengesahan (Khusus Petugas Lapangan Khusus Pimpinan 2 Kolom, Reguler 3 Kolom)
    const exportCityDate = `Pangkep, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    wsData.push(['', '', '', '', '', '', '', '', exportCityDate]);
    if (isSpecialTarget) {
      wsData.push([
        '',
        'Karyawan Bersangkutan,',
        '',
        '',
        '',
        '',
        '',
        'Mengetahui / Menyetujui,',
        '',
      ]);
      wsData.push([]);
      wsData.push([]);
      wsData.push([
        '',
        user.fullName,
        '',
        '',
        '',
        '',
        '',
        'Alam AS simpuang ago, S.Sos / Reski Faisal',
        '',
      ]);
      wsData.push([
        '',
        `NIP. ${user.nip}`,
        '',
        '',
        '',
        '',
        '',
        'Direktur Utama / Pimpinan PT. FRP',
        '',
      ]);
    } else {
      wsData.push([
        '',
        'Karyawan Bersangkutan,',
        '',
        '',
        'Memerintahkan (KAUR),',
        '',
        '',
        '',
        'Mengetahui / Menyetujui,',
        '',
      ]);
      wsData.push([]);
      wsData.push([]);
      wsData.push([
        '',
        user.fullName,
        '',
        '',
        employeeKaur || '(...........................)',
        '',
        '',
        '',
        'Alam AS simpuang ago, S.Sos / Reski Faisal',
        '',
      ]);
      wsData.push([
        '',
        `NIP. ${user.nip}`,
        '',
        '',
        'Pengawas Lapangan / KAUR',
        '',
        '',
        '',
        'Direktur Utama / Pimpinan PT. FRP',
        '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge Cells Sesuai Gambar
    ws['!merges'] = [
      // Judul
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      // Header Kolom Baris 8-9 (index r: 7 dan 8)
      { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } }, // NO
      { s: { r: 7, c: 1 }, e: { r: 8, c: 1 } }, // TANGGAL
      { s: { r: 7, c: 2 }, e: { r: 7, c: 4 } }, // ABSEN (MASUK, PULANG, TELAT)
      { s: { r: 7, c: 5 }, e: { r: 7, c: 6 } }, // LEMBUR (MULAI, SELESAI)
      { s: { r: 7, c: 7 }, e: { r: 8, c: 7 } }, // REALISASI JAM LEMBUR
      { s: { r: 7, c: 8 }, e: { r: 8, c: 8 } }, // URAIAN PEKERJAAN
      { s: { r: 7, c: 9 }, e: { r: 8, c: 9 } }, // MEMERINTAHKAN (KAUR)
      { s: { r: 7, c: 10 }, e: { r: 8, c: 10 } }, // KET.
    ];

    // Lebar Kolom Proporsional
    ws['!cols'] = [
      { wch: 6 },  // NO
      { wch: 13 }, // TANGGAL (1-10-2026)
      { wch: 10 }, // MASUK
      { wch: 10 }, // PULANG
      { wch: 13 }, // TELAT (MNT)
      { wch: 10 }, // MULAI
      { wch: 10 }, // SELESAI
      { wch: 16 }, // REALISASI JAM LEMBUR
      { wch: 32 }, // URAIAN PEKERJAAN
      { wch: 25 }, // MEMERINTAHKAN (KAUR)
      { wch: 10 }, // KET.
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = `Rekap_${selectedMonth}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanName = user.fullName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const cleanNip = user.nip.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Rekap_Presensi_Lembur_${cleanNip}_${cleanName}_${selectedMonth}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Unduh Langsung Dokumen PDF (.pdf) Otomatis - VEKTOR ASLI PRESTINE 1 HALAMAN PENUH
  const handleDownloadPdf = async () => {
    if (!user) return;
    setIsGeneratingPdf(true);
    toast.info('Membuat dokumen PDF resmi dengan Kop & Logo...');

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 297mm (A4 Landscape)
      const marginX = 8;
      const contentWidth = pageWidth - marginX * 2; // 281mm

      // Helper load image data to base64 Data URL
      const loadImgData = (src: string): Promise<string> => {
        return new Promise((resolve) => {
          if (!src) {
            resolve('');
            return;
          }
          if (src.startsWith('data:')) {
            resolve(src);
            return;
          }
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              } else {
                resolve(src);
              }
            } catch {
              resolve(src);
            }
          };
          img.onerror = () => resolve(src);
          img.src = src;
        });
      };

      // 0. KOP SURAT RESMI PT. FAWWAZ RESKI PERWIRA & LOGO
      const logoSrc = appSettings?.companyLogo || defaultLogo;
      try {
        const logoData = await loadImgData(logoSrc);
        if (logoData) {
          doc.addImage(logoData, 'PNG', marginX + 1, 5, 14, 14);
        }
      } catch (e) {
        console.warn('Gagal memuat logo untuk PDF:', e);
      }

      // Keterangan Instansi di samping logo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(15, 23, 42);
      doc.text('PT. FAWWAZ RESKI PERWIRA', marginX + 17, 9.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(4, 120, 87);
      doc.text('PENGELOLAAN FASILITAS OPERASIONAL & SUMBER DAYA KARYAWAN', marginX + 17, 13.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Tamanroja Desa Batara, Kec. Minasatene, Kab. Pangkep, Sulawesi Selatan 90651 • Web: fawwazreskiperwira.com', marginX + 17, 17.5);

      // Kanan Kop: Judul Dokumen & Periode
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('LEMBAR REKAPITULASI PRESENSI & LEMBUR', pageWidth - marginX - 1, 9.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(29, 78, 216);
      doc.text(`Periode: ${monthLabel.toUpperCase()}`, pageWidth - marginX - 1, 14, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Format Resmi Dokumen Lampiran 2', pageWidth - marginX - 1, 17.5, { align: 'right' });

      // Garis Ganda Pembatas Kop Surat
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.35);
      doc.line(marginX, 21, pageWidth - marginX, 21);

      doc.setLineWidth(0.12);
      doc.line(marginX, 21.7, pageWidth - marginX, 21.7);

      // 1. KOTAK INFORMASI PEGAWAI & STATUS CUTI REALTIME (HEADER BOX)
      const boxY = 23.5;
      const boxH = 14;
      doc.setDrawColor(180, 190, 205);
      doc.setLineWidth(0.2);
      doc.setFillColor(250, 252, 255);
      doc.rect(marginX, boxY, contentWidth, boxH, 'FD');

      // Kolom 1 (Data Diri)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      doc.text('NAMA', marginX + 3, boxY + 3.8);
      doc.text(':', marginX + 22, boxY + 3.8);
      doc.text((user.fullName || '').toUpperCase(), marginX + 25, boxY + 3.8);

      doc.text('NO.ID', marginX + 3, boxY + 7.5);
      doc.text(':', marginX + 22, boxY + 7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(user.nip || '-', marginX + 25, boxY + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.text('POLA SHIFT', marginX + 3, boxY + 11.2);
      doc.text(':', marginX + 22, boxY + 11.2);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeShiftPattern || 'SIFT NORMAL ( 2/1/3)', marginX + 25, boxY + 11.2);

      // Kolom 2 (Divisi/Unit)
      const midColX = marginX + 98;
      doc.setFont('helvetica', 'bold');
      doc.text('SEKSI', midColX, boxY + 3.8);
      doc.text(':', midColX + 22, boxY + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeSeksi || '-', midColX + 25, boxY + 3.8);

      doc.setFont('helvetica', 'bold');
      doc.text('UNIT', midColX, boxY + 7.5);
      doc.text(':', midColX + 22, boxY + 7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeUnit || '-', midColX + 25, boxY + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.text('DEPARTEMEN', midColX, boxY + 11.2);
      doc.text(':', midColX + 22, boxY + 11.2);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeDept || 'kantor pusat semen tonasa', midColX + 25, boxY + 11.2);

      // Kolom 3 (Informasi Sisa Cuti Realtime)
      const rightColX = marginX + 192;
      doc.setFillColor(240, 253, 244); // light emerald
      doc.setDrawColor(167, 243, 208);
      doc.rect(rightColX - 2, boxY + 1, (pageWidth - marginX) - rightColX + 1, boxH - 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(6, 95, 70); // emerald-800
      doc.text('STATUS CUTI REALTIME', rightColX + 1, boxY + 3.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      doc.text('KUOTA TAHUNAN', rightColX + 1, boxY + 7.2);
      doc.text(':', rightColX + 30, boxY + 7.2);
      doc.text(`${leaveStats.quota} Hari`, rightColX + 33, boxY + 7.2);

      doc.text('CUTI TERPAKAI', rightColX + 1, boxY + 10.5);
      doc.text(':', rightColX + 30, boxY + 10.5);
      doc.text(`${leaveStats.used} Hari (Realtime)`, rightColX + 33, boxY + 10.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87);
      doc.text('SISA CUTI', rightColX + 54, boxY + 7.2);
      doc.text(':', rightColX + 67, boxY + 7.2);
      doc.setFontSize(7.5);
      doc.text(`${leaveStats.remaining} Hari`, rightColX + 70, boxY + 7.2);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text('*Update sinkron PostgreSQL', rightColX + 54, boxY + 10.5);

      // 2. TABEL PRESENSI & LEMBUR (2 TINGKAT)
      const header = [
        [
          { content: 'NO', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
          { content: 'TANGGAL', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
          { content: 'ABSEN', colSpan: 3, styles: { halign: 'center' } },
          { content: 'LEMBUR', colSpan: 2, styles: { halign: 'center' } },
          { content: 'REALISASI\nJAM LEMBUR', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
          { content: 'URAIAN PEKERJAAN', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } },
          { content: isSpecialTarget ? 'PENGESAHAN\n(PIMPINAN)' : 'MEMERINTAHKAN\n(KAUR)', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
          { content: 'KET.', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        ],
        [
          { content: 'MASUK', styles: { halign: 'center' } },
          { content: 'PULANG', styles: { halign: 'center' } },
          { content: 'TELAT\n(MNT)', styles: { halign: 'center', textColor: [180, 83, 9], fillColor: [255, 248, 238] } },
          { content: 'MULAI', styles: { halign: 'center' } },
          { content: 'SELESAI', styles: { halign: 'center' } },
        ],
      ];

      const body: any[] = monthlyRows.map((r) => {
        const isOff = r.absenMasuk === 'OFF';
        const isLate = r.telatMnt !== '-';
        const hasOt = r.realisasiJamLembur !== '-';

        return [
          { content: r.no, styles: { halign: 'center', textColor: [100, 116, 139] } },
          { content: r.tanggal, styles: { halign: 'center', fontStyle: 'bold' } },
          { content: r.absenMasuk, styles: { halign: 'center', textColor: isOff ? [148, 163, 184] : [15, 23, 42], fontStyle: isOff ? 'normal' : 'bold' } },
          { content: r.absenPulang, styles: { halign: 'center', textColor: isOff ? [148, 163, 184] : [15, 23, 42], fontStyle: isOff ? 'normal' : 'bold' } },
          { content: r.telatMnt, styles: { halign: 'center', textColor: isLate ? [180, 83, 9] : [148, 163, 184], fontStyle: isLate ? 'bold' : 'normal', fillColor: isLate ? [255, 251, 235] : undefined } },
          { content: r.lemburMulai, styles: { halign: 'center' } },
          { content: r.lemburSelesai, styles: { halign: 'center' } },
          { content: r.realisasiJamLembur, styles: { halign: 'center', textColor: hasOt ? [29, 78, 216] : [148, 163, 184], fontStyle: hasOt ? 'bold' : 'normal' } },
          { content: r.uraianPekerjaan, styles: { halign: 'left' } },
          { content: r.memerintahkanKaur, styles: { halign: 'center' } },
          {
            content: r.ket,
            styles: {
              halign: 'center',
              fontStyle: 'bold',
              textColor:
                r.ket === 'HADIR'
                  ? [4, 120, 87]
                  : r.ket === 'TELAT'
                  ? [180, 83, 9]
                  : r.ket === 'LEMBUR'
                  ? [29, 78, 216]
                  : r.ket === 'OFF'
                  ? [148, 163, 184]
                  : [190, 18, 60],
            },
          },
        ];
      });

      // Baris Total / Rekapan
      body.push([
        { content: 'TOTAL / REKAP', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [233, 238, 245] } },
        { content: `${stats.totalHadir} Hari`, styles: { halign: 'center', fontStyle: 'bold', textColor: [4, 120, 87] } },
        { content: `${stats.totalOff} OFF`, styles: { halign: 'center', textColor: [71, 85, 105] } },
        { content: stats.totalTelatMnt > 0 ? `${stats.totalTelatMnt}m` : '-', styles: { halign: 'center', fontStyle: 'bold', textColor: [180, 83, 9], fillColor: [255, 248, 238] } },
        { content: '-', styles: { halign: 'center' } },
        { content: '-', styles: { halign: 'center' } },
        { content: stats.totalJamLembur > 0 ? `${stats.totalJamLembur} Jam` : '-', styles: { halign: 'center', fontStyle: 'bold', textColor: [29, 78, 216] } },
        { content: `Cuti: ${stats.totalCuti} | Sakit: ${stats.totalSakit} | Izin: ${stats.totalIzin}`, styles: { halign: 'left' } },
        { content: '-', styles: { halign: 'center' } },
        { content: stats.totalAlpa > 0 ? `${stats.totalAlpa} Alpa` : 'Nihil', styles: { halign: 'center', fontStyle: 'bold', textColor: stats.totalAlpa > 0 ? [190, 18, 60] : [71, 85, 105] } },
      ]);

      autoTable(doc, {
        startY: 39.5,
        tableWidth: contentWidth,
        margin: { left: marginX, right: marginX },
        head: header,
        body: body,
        theme: 'grid',
        styles: {
          fontSize: 6.2,
          cellPadding: 0.32,
          lineColor: [180, 190, 205],
          lineWidth: 0.12,
          overflow: 'ellipsize',
        },
        headStyles: {
          fillColor: [233, 238, 245],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
          fontSize: 6.2,
        },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center' },   // NO
          1: { cellWidth: 19, halign: 'center' },  // TANGGAL
          2: { cellWidth: 14, halign: 'center' },  // MASUK
          3: { cellWidth: 14, halign: 'center' },  // PULANG
          4: { cellWidth: 14, halign: 'center' },  // TELAT
          5: { cellWidth: 13, halign: 'center' },  // MULAI
          6: { cellWidth: 13, halign: 'center' },  // SELESAI
          7: { cellWidth: 21, halign: 'center' },  // REALISASI
          8: { cellWidth: 88, halign: 'left' },    // URAIAN
          9: { cellWidth: 46, halign: 'center' },  // KAUR
          10: { cellWidth: 30, halign: 'center' }, // KET
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY;

      // 3. KOTAK REKAPAN RINGKAS (8 BLOK INDIKATOR TERPISAH)
      const boxYMetrics = finalY + 2;
      const boxWidth = contentWidth / 8;
      const boxHeight = 7.2;
      const metrics = [
        { label: 'TOTAL HADIR', val: `${stats.totalHadir} Hari`, color: [4, 120, 87] },
        { label: 'KETERLAMBATAN', val: `${stats.totalTelatMnt}m (${stats.totalTelatKali}x)`, color: [180, 83, 9] },
        { label: 'JAM LEMBUR', val: `${stats.totalJamLembur} Jam`, color: [29, 78, 216] },
        { label: 'LIBUR / OFF', val: `${stats.totalOff} Hari`, color: [71, 85, 105] },
        { label: 'CUTI', val: `${stats.totalCuti} Hari`, color: [126, 34, 206] },
        { label: 'SAKIT', val: `${stats.totalSakit} Hari`, color: [219, 39, 119] },
        { label: 'IZIN', val: `${stats.totalIzin} Hari`, color: [79, 70, 229] },
        { label: 'MANGKIR', val: `${stats.totalAlpa} Hari`, color: [190, 18, 60] },
      ];

      metrics.forEach((m, idx) => {
        const bx = marginX + idx * boxWidth;
        doc.setDrawColor(200, 210, 225);
        doc.setFillColor(248, 250, 252);
        doc.rect(bx, boxYMetrics, boxWidth - 0.8, boxHeight, 'FD');

        doc.setFontSize(4.8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(m.label, bx + (boxWidth - 0.8) / 2, boxYMetrics + 2.5, { align: 'center' });

        doc.setFontSize(6.8);
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(m.val, bx + (boxWidth - 0.8) / 2, boxYMetrics + 5.8, { align: 'center' });
      });

      // 4. PENGESAHAN & TANDA TANGAN (Khusus 3 Petugas Lapangan Khusus Pimpinan 2 Kolom, Reguler 3 Kolom)
      const sigY = boxYMetrics + boxHeight + 2.8;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Pangkep, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - marginX - 1, sigY, { align: 'right' });

      const titlesY = sigY + 3.2;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);

      if (isSpecialTarget) {
        // 2 Kolom Paraf Khusus 3 Petugas Lapangan Khusus Pimpinan (Karyawan & Pimpinan)
        const sigColWidth = contentWidth / 2;
        doc.text('Karyawan Yang Bersangkutan,', marginX + sigColWidth * 0.5, titlesY, { align: 'center' });
        doc.text('Mengetahui / Menyetujui,', marginX + sigColWidth * 1.5, titlesY, { align: 'center' });

        const nameY = titlesY + 14;
        doc.text(`( ${user.fullName} )`, marginX + sigColWidth * 0.5, nameY, { align: 'center' });
        doc.text('( Alam AS simpuang ago, S.Sos / Reski Faisal )', marginX + sigColWidth * 1.5, nameY, { align: 'center' });

        const subY = nameY + 3.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`NIP. ${user.nip}`, marginX + sigColWidth * 0.5, subY, { align: 'center' });
        doc.text('Direktur Utama / Pimpinan PT. FRP', marginX + sigColWidth * 1.5, subY, { align: 'center' });
      } else {
        // 3 Kolom Paraf Reguler
        const sigColWidth = contentWidth / 3;
        doc.text('Karyawan Yang Bersangkutan,', marginX + sigColWidth * 0.5, titlesY, { align: 'center' });
        doc.text('Memerintahkan (KAUR),', marginX + sigColWidth * 1.5, titlesY, { align: 'center' });
        doc.text('Mengetahui / Menyetujui,', marginX + sigColWidth * 2.5, titlesY, { align: 'center' });

        const nameY = titlesY + 14;
        doc.text(`( ${user.fullName} )`, marginX + sigColWidth * 0.5, nameY, { align: 'center' });
        doc.text(`( ${employeeKaur || '........................................'} )`, marginX + sigColWidth * 1.5, nameY, { align: 'center' });
        doc.text('( Alam AS simpuang ago, S.Sos / Reski Faisal )', marginX + sigColWidth * 2.5, nameY, { align: 'center' });

        const subY = nameY + 3.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`NIP. ${user.nip}`, marginX + sigColWidth * 0.5, subY, { align: 'center' });
        doc.text('Pengawas Lapangan / KAUR', marginX + sigColWidth * 1.5, subY, { align: 'center' });
        doc.text('Direktur Utama / Pimpinan PT. FRP', marginX + sigColWidth * 2.5, subY, { align: 'center' });
      }

      const cleanName = user.fullName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const cleanNip = user.nip.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Laporan_Presensi_Lembur_${cleanNip}_${cleanName}_${selectedMonth}.pdf`;
      doc.save(filename);
      toast.success(`Laporan PDF (1 Halaman Penuh Presisi) berhasil diunduh: ${filename}`);
    } catch (error) {
      console.error('Gagal generate PDF:', error);
      toast.error('Gagal membuat PDF otomatis.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Cetak Dokumen Resmi / PDF
  const handlePrintPdf = () => {
    window.print();
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[94vh] overflow-y-auto p-0 rounded-2xl border-border bg-card shadow-2xl">
          {/* Header Action Bar */}
          <div className="p-4 sm:p-5 border-b border-border bg-muted/30 sticky top-0 z-20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/20 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Lembar Rekap Presensi &amp; Lembur Karyawan
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                    Format Resmi
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {user.fullName} ({user.nip}) • {employeeSeksi || user.divisionName || 'Operasional'}
                </p>
              </div>
            </div>

            {/* Tombol Aksi Download & Cetak */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingMeta(!isEditingMeta)}
                className={`h-8 px-3 text-xs rounded-xl gap-1.5 border-border ${
                  isEditingMeta ? 'bg-amber-500/10 text-amber-600 border-amber-500/40' : 'hover:bg-muted'
                }`}
                title="Sesuaikan Seksi, Unit, Departemen, Pola Shift & KAUR"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingMeta ? 'Tutup Edit Info' : 'Sesuaikan Info'}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsLeaveCorrectionOpen(true)}
                className="h-8 px-3 text-xs rounded-xl gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium shadow-xs"
                title="Koreksi kuota dan saldo cuti terpakai karyawan"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Koreksi Cuti</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="h-8 px-3 text-xs rounded-xl gap-1.5 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 font-medium shadow-xs"
                title="Unduh langsung dokumen PDF (.pdf) resmi ke perangkat"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh PDF (.pdf)'}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
                className="h-8 px-3 text-xs rounded-xl gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium shadow-xs"
                title="Unduh format spreadsheet Excel (.xlsx) persis seperti template"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Unduh Excel (.xlsx)
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handlePrintPdf}
                className="h-8 px-2.5 text-xs rounded-xl gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                title="Cetak langsung ke mesin printer fisik / dialog cetak"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak
              </Button>
            </div>
          </div>

          {/* PERIODE SWITCHER BAR (Bulan Berjalan vs Bulan Lalu) */}
          <div className="px-5 py-3 border-b border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Pilih Periode:</span>
              
              {/* Tombol Cepat: Bulan Berjalan */}
              <Button
                size="sm"
                variant={selectedMonth === currentMonthStr ? 'default' : 'outline'}
                onClick={() => setSelectedMonth(currentMonthStr)}
                className="h-7 px-3 text-xs rounded-lg gap-1.5 font-medium"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Bulan Berjalan ({currentMonthLabel})</span>
              </Button>

              {/* Tombol Cepat: Bulan Lalu */}
              <Button
                size="sm"
                variant={selectedMonth === prevMonthStr ? 'default' : 'outline'}
                onClick={() => setSelectedMonth(prevMonthStr)}
                className="h-7 px-3 text-xs rounded-lg gap-1.5 font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Bulan Lalu ({prevMonthLabel})</span>
              </Button>
            </div>

            {/* Input Pemilih Bulan Kustom */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pilih Bulan Lain:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-7 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* FORM EDIT METADATA (Bila User Membuka Mode Edit) */}
          {isEditingMeta && (
            <div className="p-4 bg-amber-500/5 border-b border-amber-500/20 text-xs space-y-3 no-print">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Sesuaikan Metadata Lembar Presensi &amp; Lembur:
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Perubahan langsung tampil pada preview tabel, cetak PDF, dan file Excel.
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold">SEKSI</label>
                  <Input
                    value={employeeSeksi}
                    onChange={(e) => setEmployeeSeksi(e.target.value)}
                    className="h-7 text-xs mt-1"
                    placeholder="Sec. of Shipment Management 2"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold">UNIT</label>
                  <Input
                    value={employeeUnit}
                    onChange={(e) => setEmployeeUnit(e.target.value)}
                    className="h-7 text-xs mt-1"
                    placeholder="Unit of Outbond Inventory I & IV"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold">DEPARTEMEN</label>
                  <Input
                    value={employeeDept}
                    onChange={(e) => setEmployeeDept(e.target.value)}
                    className="h-7 text-xs mt-1"
                    placeholder="kantor pusat semen tonasa"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold">POLA SHIFT</label>
                  <Input
                    value={employeeShiftPattern}
                    onChange={(e) => setEmployeeShiftPattern(e.target.value)}
                    className="h-7 text-xs mt-1"
                    placeholder="SIFT NORMAL ( 2/1/3)"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-semibold">MEMERINTAHKAN (KAUR)</label>
                  <Input
                    value={employeeKaur}
                    onChange={(e) => setEmployeeKaur(e.target.value)}
                    className="h-7 text-xs mt-1"
                    placeholder="Kaur Sec. of Shipment Management"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DOKUMEN CONTAINER (FORMAT PERSIS SEPERTI LAMPIRAN - DIOPTIMALKAN PAS 1 HALAMAN TUNGGAL) */}
          <div id="printable-timesheet-report" className="p-3 sm:p-5 space-y-2.5 max-w-[1240px] mx-auto bg-card text-foreground">
            {/* ═══ KOP SURAT RESMI PT. FAWWAZ RESKI PERWIRA & LOGO ═══ */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 dark:border-slate-300 pb-2.5 mb-2.5 gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={appSettings?.companyLogo || defaultLogo}
                  alt="Logo PT. FRP"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div>
                  <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-slate-900 dark:text-white leading-tight">
                    PT. FAWWAZ RESKI PERWIRA
                  </h1>
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    PENGELOLAAN FASILITAS OPERASIONAL &amp; SUMBER DAYA KARYAWAN
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Tamanroja Desa Batara, Minasatene, Kab. Pangkep, Sulawesi Selatan 90651 • Web: fawwazreskiperwira.com
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 rounded-lg px-3 py-1.5 shadow-2xs">
                  <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                    DOKUMEN RESMI LAMPIRAN 2
                  </p>
                  <p className="text-xs font-black text-slate-900 dark:text-white uppercase">
                    LEMBAR REKAPITULASI
                  </p>
                  <p className="text-[10px] font-bold text-primary font-mono">
                    Periode: {monthLabel.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* KOTAK HEADER KARYAWAN & INFORMASI CUTI REALTIME */}
            <div className="border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 rounded-sm p-2.5 text-[11px] font-sans leading-tight">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-6">
                {/* Kolom 1: Identitas Karyawan */}
                <div className="space-y-1">
                  <div className="flex items-baseline">
                    <span className="w-24 font-bold text-slate-800 dark:text-slate-200">NAMA</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                      {user.fullName}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 font-bold text-slate-800 dark:text-slate-200">NO.ID</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {user.nip}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 font-bold text-slate-800 dark:text-slate-200">POLA SHIFT</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-300">
                      {employeeShiftPattern || 'SIFT NORMAL ( 2/1/3)'}
                    </span>
                  </div>
                </div>

                {/* Kolom 2: Penugasan Unit / Departemen */}
                <div className="space-y-1">
                  <div className="flex items-baseline">
                    <span className="w-24 font-bold text-slate-800 dark:text-slate-200">SEKSI</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-300">
                      {employeeSeksi || '-'}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 font-bold text-slate-800 dark:text-slate-200">UNIT</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-300">
                      {employeeUnit || '-'}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 font-bold text-slate-800 dark:text-slate-200">DEPARTEMEN</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-300">
                      {employeeDept || 'kantor pusat semen tonasa'}
                    </span>
                  </div>
                </div>

                {/* Kolom 3: Status Cuti Realtime Karyawan */}
                <div className="space-y-1 bg-emerald-500/10 dark:bg-emerald-950/20 p-2 rounded-md border border-emerald-500/30">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-500/20 text-[10.5px]">
                    <span className="font-bold text-emerald-950 dark:text-emerald-200">
                      STATUS CUTI REALTIME
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLeaveCorrectionOpen(true)}
                      className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white bg-white/70 dark:bg-black/40 px-1.5 py-0.5 rounded border border-emerald-500/30 hover:border-emerald-500 transition-all cursor-pointer shadow-2xs"
                      title="Klik untuk Koreksi Saldo & Hak Cuti Karyawan"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Koreksi</span>
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between text-[10.5px]">
                    <span className="text-slate-700 dark:text-slate-300">Total Hak Cuti:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">{leaveStats.quota} Hari</span>
                  </div>
                  <div className="flex items-baseline justify-between text-[10.5px]">
                    <span className="text-amber-700 dark:text-amber-400 font-medium">Cuti Terpakai:</span>
                    <span className="font-bold font-mono text-amber-700 dark:text-amber-400">{leaveStats.used} Hari</span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] pt-0.5 border-t border-emerald-500/20">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Sisa Cuti:</span>
                    <span className="font-extrabold font-mono text-emerald-700 dark:text-emerald-300 text-xs">{leaveStats.remaining} Hari</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL DOKUMEN REKAPITULASI (PERSIS SEPERTI LAMPIRAN) */}
            <div className="overflow-x-auto border border-slate-300 dark:border-slate-700 rounded-sm">
              <table className="w-full border-collapse text-center text-[10px] font-sans">
                <thead>
                  {/* Baris Header 1 */}
                  <tr className="bg-[#E9EEF5] dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold border-b border-slate-300 dark:border-slate-700 leading-tight">
                    <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-1 py-1 w-8">
                      NO
                    </th>
                    <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1 w-20">
                      TANGGAL
                    </th>
                    <th colSpan={3} className="border border-slate-300 dark:border-slate-700 px-1 py-0.5">
                      ABSEN
                    </th>
                    <th colSpan={2} className="border border-slate-300 dark:border-slate-700 px-1 py-0.5">
                      LEMBUR
                    </th>
                    <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-1 py-1 w-20 leading-tight">
                      REALISASI<br />JAM LEMBUR
                    </th>
                    <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1 min-w-[160px]">
                      URAIAN PEKERJAAN
                    </th>
                    <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1 w-28 leading-tight">
                      {isSpecialTarget ? <>PENGESAHAN<br />(PIMPINAN)</> : <>MEMERINTAHKAN<br />(KAUR)</>}
                    </th>
                    <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-1 py-1 w-14">
                      KET.
                    </th>
                  </tr>

                  {/* Baris Header 2 (Sub-Kolom) */}
                  <tr className="bg-[#E9EEF5] dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold border-b border-slate-300 dark:border-slate-700 leading-tight">
                    <th className="border border-slate-300 dark:border-slate-700 px-1 py-0.5 w-14">
                      MASUK
                    </th>
                    <th className="border border-slate-300 dark:border-slate-700 px-1 py-0.5 w-14">
                      PULANG
                    </th>
                    <th className="border border-slate-300 dark:border-slate-700 px-1 py-0.5 w-14 text-[#b45309] dark:text-amber-400 bg-[#FFF7ED] dark:bg-amber-950/30">
                      TELAT<br />(MNT)
                    </th>
                    <th className="border border-slate-300 dark:border-slate-700 px-1 py-0.5 w-14">
                      MULAI
                    </th>
                    <th className="border border-slate-300 dark:border-slate-700 px-1 py-0.5 w-14">
                      SELESAI
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {monthlyRows.map((r) => {
                    const isOff = r.absenMasuk === 'OFF';
                    const hasLate = r.telatMnt !== '-';
                    const hasOt = r.realisasiJamLembur !== '-';

                    return (
                      <tr
                        key={r.no}
                        className={`border-b border-slate-200 dark:border-slate-800 transition-colors ${
                          r.isToday
                            ? 'bg-emerald-500/5 font-semibold'
                            : isOff
                            ? 'bg-slate-50/50 dark:bg-slate-900/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* NO */}
                        <td className="border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 text-slate-500 font-mono text-[9.5px]">
                          {r.no}
                        </td>

                        {/* TANGGAL */}
                        <td className="border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 text-slate-700 dark:text-slate-300 font-medium">
                          {r.tanggal}
                        </td>

                        {/* ABSEN MASUK */}
                        <td
                          className={`border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 font-mono ${
                            isOff
                              ? 'text-slate-400 dark:text-slate-500 font-normal'
                              : 'font-semibold text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {r.absenMasuk}
                        </td>

                        {/* ABSEN PULANG */}
                        <td
                          className={`border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 font-mono ${
                            isOff
                              ? 'text-slate-400 dark:text-slate-500 font-normal'
                              : 'font-semibold text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {r.absenPulang}
                        </td>

                        {/* TELAT (MNT) */}
                        <td
                          className={`border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 font-mono font-medium ${
                            hasLate
                              ? 'text-amber-700 dark:text-amber-400 font-bold bg-amber-50/60 dark:bg-amber-950/20'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {r.telatMnt}
                        </td>

                        {/* LEMBUR MULAI */}
                        <td className="border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 text-slate-700 dark:text-slate-300 font-mono">
                          {r.lemburMulai}
                        </td>

                        {/* LEMBUR SELESAI */}
                        <td className="border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 text-slate-700 dark:text-slate-300 font-mono">
                          {r.lemburSelesai}
                        </td>

                        {/* REALISASI JAM LEMBUR */}
                        <td
                          className={`border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 font-semibold ${
                            hasOt
                              ? 'text-blue-700 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/20'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {r.realisasiJamLembur}
                        </td>

                        {/* URAIAN PEKERJAAN */}
                        <td className="border border-slate-300 dark:border-slate-700 py-[2.5px] text-left px-2 text-slate-700 dark:text-slate-300 text-[9.5px] truncate max-w-[200px]">
                          {r.uraianPekerjaan}
                        </td>

                        {/* MEMERINTAHKAN (KAUR) */}
                        <td className="border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 text-slate-700 dark:text-slate-300 text-[9.5px]">
                          {r.memerintahkanKaur}
                        </td>

                        {/* KET. */}
                        <td
                          className={`border border-slate-300 dark:border-slate-700 py-[2.5px] px-1 font-bold text-[9.5px] ${
                            r.ket === 'OFF'
                              ? 'text-slate-400 dark:text-slate-500'
                              : r.ket === 'HADIR'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : r.ket === 'TELAT'
                              ? 'text-amber-700 dark:text-amber-400'
                              : r.ket === 'LEMBUR'
                              ? 'text-blue-700 dark:text-blue-400'
                              : r.ket === 'ALPA'
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-purple-700 dark:text-purple-400'
                          }`}
                        >
                          {r.ket}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Baris Total / Rekapan Tabel */}
                <tfoot>
                  <tr className="bg-[#E9EEF5] dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-t-2 border-slate-400 dark:border-slate-600 text-[10px]">
                    <td colSpan={2} className="border border-slate-300 dark:border-slate-700 py-1 px-2 text-center uppercase tracking-wide">
                      TOTAL / REKAP
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {stats.totalHadir} Hari
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 font-mono text-slate-600 dark:text-slate-300">
                      {stats.totalOff} OFF
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 font-mono text-amber-700 dark:text-amber-400 font-bold bg-[#FFF7ED] dark:bg-amber-950/30">
                      {stats.totalTelatMnt > 0 ? `${stats.totalTelatMnt}m` : '-'}
                    </td>
                    <td colSpan={2} className="border border-slate-300 dark:border-slate-700 py-1 text-slate-400">
                      -
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 font-mono text-blue-700 dark:text-blue-400 font-bold">
                      {stats.totalJamLembur > 0 ? `${stats.totalJamLembur} Jam` : '-'}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 text-left px-2 text-[9.5px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      Cuti: {stats.totalCuti} Hr | Sakit: {stats.totalSakit} Hr | Izin: {stats.totalIzin} Hr
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 text-slate-400">
                      -
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-1 font-mono text-rose-700 dark:text-rose-400 font-bold">
                      {stats.totalAlpa > 0 ? `${stats.totalAlpa} Alpa` : 'Nihil'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* KOTAK REKAPAN RINGKAS DI BAWAH TABEL (8 KARTU TERPISAH & DINAMIS) */}
            <div className="p-2 rounded-sm border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center text-xs">
                <div className="p-1 rounded bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[8.5px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Total Hadir</span>
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 leading-tight">{stats.totalHadir} <span className="text-[8.5px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-[8.5px] uppercase font-bold text-amber-800 dark:text-amber-300">Keterlambatan</span>
                  <p className="text-xs font-black text-amber-700 dark:text-amber-400 leading-tight">{stats.totalTelatMnt}m <span className="text-[8.5px] font-normal">({stats.totalTelatKali}x)</span></p>
                </div>

                <div className="p-1 rounded bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-[8.5px] uppercase font-bold text-blue-800 dark:text-blue-300">Jam Lembur</span>
                  <p className="text-xs font-black text-blue-700 dark:text-blue-400 leading-tight">{stats.totalJamLembur} <span className="text-[8.5px] font-normal">Jam</span></p>
                </div>

                <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                  <span className="text-[8.5px] uppercase font-bold text-slate-700 dark:text-slate-300">Libur / OFF</span>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">{stats.totalOff} <span className="text-[8.5px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <span className="text-[8.5px] uppercase font-bold text-purple-800 dark:text-purple-300">Cuti</span>
                  <p className="text-xs font-black text-purple-700 dark:text-purple-400 leading-tight">{stats.totalCuti} <span className="text-[8.5px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-pink-50/80 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800">
                  <span className="text-[8.5px] uppercase font-bold text-pink-800 dark:text-pink-300">Sakit</span>
                  <p className="text-xs font-black text-pink-700 dark:text-pink-400 leading-tight">{stats.totalSakit} <span className="text-[8.5px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                  <span className="text-[8.5px] uppercase font-bold text-indigo-800 dark:text-indigo-300">Izin</span>
                  <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 leading-tight">{stats.totalIzin} <span className="text-[8.5px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <span className="text-[8.5px] uppercase font-bold text-rose-800 dark:text-rose-300">Mangkir / Alpa</span>
                  <p className="text-xs font-black text-rose-700 dark:text-rose-400 leading-tight">{stats.totalAlpa} <span className="text-[8.5px] font-normal">Hari</span></p>
                </div>
              </div>
            </div>

            {/* PENGESAHAN & TANDA TANGAN (3 KOLOM RESMI - KOMPAK 1 HALAMAN) */}
            <div className="pt-2 border-t border-slate-300 dark:border-slate-700">
              <div className="text-right text-[10px] text-muted-foreground mb-2 font-medium">
                Pangkep, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>

              {isSpecialTarget ? (
                /* Khusus 3 Petugas Lapangan Khusus Pimpinan (Aslam, Samsi, Takdir): 2 Kolom Paraf (Karyawan & Pimpinan Saja, Tanpa KAUR) */
                <div className="grid grid-cols-2 gap-8 text-center text-xs">
                  {/* Kolom 1: Karyawan */}
                  <div className="space-y-8">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-[10.5px]">
                      Karyawan Yang Bersangkutan,
                    </p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white uppercase tracking-wide text-[11px]">
                        ( {user.fullName} )
                      </p>
                      <p className="text-[9.5px] text-muted-foreground font-mono">
                        NIP. {user.nip}
                      </p>
                    </div>
                  </div>

                  {/* Kolom 2: Pimpinan / Direktur Utama */}
                  <div className="space-y-8">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-[10.5px]">
                      Mengetahui / Menyetujui,
                    </p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white text-[11px]">
                        ( Alam AS simpuang ago, S.Sos / Reski Faisal )
                      </p>
                      <p className="text-[9.5px] text-muted-foreground">
                        Direktur Utama / Pimpinan PT. FRP
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Karyawan Reguler: 3 Kolom Paraf (Karyawan, KAUR, Pimpinan) */
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  <div className="space-y-8">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-[10.5px]">
                      Karyawan Yang Bersangkutan,
                    </p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white uppercase tracking-wide text-[11px]">
                        ( {user.fullName} )
                      </p>
                      <p className="text-[9.5px] text-muted-foreground font-mono">
                        NIP. {user.nip}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-[10.5px]">
                      Memerintahkan (KAUR),
                    </p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white uppercase tracking-wide text-[11px]">
                        ( {employeeKaur || '................................'} )
                      </p>
                      <p className="text-[9.5px] text-muted-foreground">
                        Pengawas Lapangan / KAUR
                      </p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-[10.5px]">
                      Mengetahui / Menyetujui,
                    </p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white text-[11px]">
                        ( Alam AS simpuang ago, S.Sos / Reski Faisal )
                      </p>
                      <p className="text-[9.5px] text-muted-foreground">
                        Direktur Utama / Pimpinan PT. FRP
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Koreksi Saldo Cuti Karyawan */}
      <HrmEmployeeLeaveCorrectionModal
        isOpen={isLeaveCorrectionOpen}
        onClose={() => setIsLeaveCorrectionOpen(false)}
        user={user}
        currentQuota={leaveStats.quota}
        currentUsed={leaveStats.used}
        suggestedAttUsed={stats.totalCuti}
        onSaved={(upd) => {
          setManualLeaveOverride(upd);
        }}
      />

      {/* CSS PRINT MEDIA STYLES (PRESISI 1 LEMBAR CETAK A4 LANDSCAPE) */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 8mm;
          }
          html, body {
            height: 100% !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-timesheet-report,
          #printable-timesheet-report * {
            visibility: visible;
          }
          #printable-timesheet-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-color: #333333 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          th, td {
            border-color: #333333 !important;
            color: #000000 !important;
          }
          th {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
};
