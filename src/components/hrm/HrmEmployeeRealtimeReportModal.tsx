import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
} from 'lucide-react';
import { UserProfile, AttendanceRecord, OvertimeRecord } from '@/types/hrm';
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
      setEmployeeKaur(user.kepalaReguName || 'Kaur Operasional');
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

    Promise.allSettled([attPromise, otPromise]).finally(() => {
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

      // Default KAUR jika ada kehadiran tapi belum ada data nama pengawas
      if (hasClockIn && memerintahkanKaur === '-') {
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

  // Statistik Rekapan Bulanan
  const stats = useMemo(() => {
    let totalHadir = 0;
    let totalTelatKali = 0;
    let totalTelatMnt = 0;
    let totalOff = 0;
    let totalCuti = 0;
    let totalIzinSakit = 0;
    let totalAlpa = 0;
    let totalJamLembur = 0;

    monthlyRows.forEach((r) => {
      if (r.ket === 'HADIR' || r.ket === 'TELAT' || (r.absenMasuk !== '-' && r.absenMasuk !== 'OFF')) {
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
      if (r.ket === 'IZIN' || r.ket === 'SAKIT') {
        totalIzinSakit++;
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
      totalIzinSakit,
      totalAlpa,
      totalJamLembur: Number(totalJamLembur.toFixed(1)),
    };
  }, [monthlyRows]);

  // Ekspor Excel (.xlsx) dengan Format Persis Lampiran
  const handleExportExcel = () => {
    if (!user) return;

    const wsData: any[][] = [];

    // Header Instansi
    wsData.push(['PT. FAWWAZ RESKI PERWIRA']);
    wsData.push(['SISTEM OPERASIONAL, PRESENSI & AUDIT LEMBUR KARYAWAN']);
    wsData.push([`REKAPITULASI PRESENSI & LEMBUR - BULAN ${monthLabel.toUpperCase()}`]);
    wsData.push([]);

    // Kotak Metadata Karyawan (Sesuai Lampiran)
    wsData.push(['NAMA', ':', user.fullName, '', '', 'SEKSI', ':', employeeSeksi]);
    wsData.push(['NO.ID', ':', user.nip, '', '', 'UNIT', ':', employeeUnit]);
    wsData.push(['POLA SHIFT', ':', employeeShiftPattern, '', '', 'DEPARTEMEN', ':', employeeDept]);
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
      `Izin/Sakit/Cuti: ${stats.totalIzinSakit + stats.totalCuti} Hari`,
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
    wsData.push(['5. Total Izin / Sakit / Cuti', ':', `${stats.totalIzinSakit + stats.totalCuti} Hari`]);
    wsData.push(['6. Total Mangkir / Alpa', ':', `${stats.totalAlpa} Hari`]);
    wsData.push([]);

    // Tanda Tangan Pengesahan (3 Kolom)
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

  // Unduh Langsung Dokumen PDF (.pdf) Otomatis - WAJIB TEPAT 1 HALAMAN TUNGGAL
  const handleDownloadPdf = async () => {
    if (!user) return;
    const reportElement = document.getElementById('printable-timesheet-report');
    if (!reportElement) {
      toast.error('Elemen dokumen tidak ditemukan.');
      return;
    }

    setIsGeneratingPdf(true);
    toast.info('Sedang merender laporan PDF presisi 1 halaman...');

    try {
      // Delay mikro agar render DOM selesai stabil
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvas(reportElement, {
        scale: 2.2, // Skala 2.2x agar teks sangat tajam, bersih dan terbaca jelas
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1240,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 297mm (A4 Landscape)
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210mm (A4 Landscape)
      const marginX = 6;
      const marginY = 5;
      const maxAvailableWidth = pdfWidth - marginX * 2; // 285mm
      const maxAvailableHeight = pdfHeight - marginY * 2; // 200mm

      // Skala presisi agar TEPAT 100% mencukupi 1 halaman penuh (TIDAK ADA HALAMAN KE-2)
      const scaleW = maxAvailableWidth / canvas.width;
      const scaleH = maxAvailableHeight / canvas.height;
      const finalScale = Math.min(scaleW, scaleH);

      const finalWidth = canvas.width * finalScale;
      const finalHeight = canvas.height * finalScale;

      // Posisikan persis di tengah halaman (Center alignment)
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight);

      const cleanName = user.fullName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const cleanNip = user.nip.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Laporan_Presensi_Lembur_${cleanNip}_${cleanName}_${selectedMonth}.pdf`;
      pdf.save(filename);
      toast.success(`Laporan PDF (1 Halaman Pas) berhasil diunduh: ${filename}`);
    } catch (error) {
      console.error('Gagal generate PDF via canvas:', error);
      toast.error('Gagal membuat PDF otomatis. Mengalihkan ke dialog cetak...');
      window.print();
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
            {/* KOTAK HEADER KARYAWAN (PERSIS SEPERTI GAMBAR LAMPIRAN) */}
            <div className="border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 rounded-sm p-2.5 text-[11px] font-sans leading-tight">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1.5 gap-x-8">
                {/* Kolom Kiri */}
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

                {/* Kolom Kanan */}
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
                      MEMERINTAHKAN<br />(KAUR)
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
                    <td className="border border-slate-300 dark:border-slate-700 py-1 text-left px-2 text-[9.5px] text-slate-700 dark:text-slate-300">
                      Izin/Sakit/Cuti: {stats.totalIzinSakit + stats.totalCuti} Hari
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

            {/* KOTAK REKAPAN RINGKAS DI BAWAH TABEL (KOMPAK 1 BARIS) */}
            <div className="p-2 rounded-sm border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="grid grid-cols-6 gap-2 text-center text-xs">
                <div className="p-1 rounded bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[9px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Total Hadir</span>
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 leading-tight">{stats.totalHadir} <span className="text-[9px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300">Keterlambatan</span>
                  <p className="text-xs font-black text-amber-700 dark:text-amber-400 leading-tight">{stats.totalTelatMnt} <span className="text-[9px] font-normal">Mnt</span> ({stats.totalTelatKali}x)</p>
                </div>

                <div className="p-1 rounded bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-[9px] uppercase font-bold text-blue-800 dark:text-blue-300">Jam Lembur</span>
                  <p className="text-xs font-black text-blue-700 dark:text-blue-400 leading-tight">{stats.totalJamLembur} <span className="text-[9px] font-normal">Jam</span></p>
                </div>

                <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                  <span className="text-[9px] uppercase font-bold text-slate-700 dark:text-slate-300">Libur / OFF</span>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">{stats.totalOff} <span className="text-[9px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <span className="text-[9px] uppercase font-bold text-purple-800 dark:text-purple-300">Izin/Sakit/Cuti</span>
                  <p className="text-xs font-black text-purple-700 dark:text-purple-400 leading-tight">{stats.totalIzinSakit + stats.totalCuti} <span className="text-[9px] font-normal">Hari</span></p>
                </div>

                <div className="p-1 rounded bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <span className="text-[9px] uppercase font-bold text-rose-800 dark:text-rose-300">Mangkir / Alpa</span>
                  <p className="text-xs font-black text-rose-700 dark:text-rose-400 leading-tight">{stats.totalAlpa} <span className="text-[9px] font-normal">Hari</span></p>
                </div>
              </div>
            </div>

            {/* PENGESAHAN & TANDA TANGAN (3 KOLOM RESMI - KOMPAK 1 HALAMAN) */}
            <div className="pt-2 border-t border-slate-300 dark:border-slate-700">
              <div className="text-right text-[10px] text-muted-foreground mb-2 font-medium">
                Pangkep / Makassar, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center text-xs">
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

                {/* Kolom 2: KAUR / Pengawas */}
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

                {/* Kolom 3: Pimpinan / Direktur Utama */}
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
