import React, { useState, useMemo, useRef } from 'react';
import { UserProfile, AttendanceRecord, OvertimeRecord, LeaveRequest, getEmployeeCategoryGroup } from '@/types/hrm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Printer,
  Download,
  FileSpreadsheet,
  X,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Info,
  CheckCircle2,
  Save,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { api } from '@/services/apiClient';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface HrmSplMultiplierMatrixModalProps {
  open: boolean;
  onClose: () => void;
  employees: UserProfile[];
  attendances: AttendanceRecord[];
  overtimes: OvertimeRecord[];
  leaves: LeaveRequest[];
  initialMonth?: string;
  onDataChanged?: () => void;
}

interface CellClickTarget {
  employee: UserProfile;
  dateStr: string;
  dayNumber: number;
  multiplier: number;
  existingOt?: OvertimeRecord | null;
}

export const HrmSplMultiplierMatrixModal: React.FC<HrmSplMultiplierMatrixModalProps> = ({
  open,
  onClose,
  employees,
  attendances,
  overtimes,
  leaves,
  initialMonth = new Date().toISOString().slice(0, 7),
  onDataChanged,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedGroup, setSelectedGroup] = useState<'SHIPMENT' | 'RUMAH TANGGA' | 'ALL'>('SHIPMENT');
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Local Reactive States for Live Synchronization
  const [activeAttendances, setActiveAttendances] = useState<AttendanceRecord[]>(attendances || []);
  const [activeOvertimes, setActiveOvertimes] = useState<OvertimeRecord[]>(overtimes || []);
  const [activeLeaves, setActiveLeaves] = useState<LeaveRequest[]>(leaves || []);
  const [activeSchedules, setActiveSchedules] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState<boolean>(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string>('');

  // Sinkronisasi data awal dari props
  React.useEffect(() => {
    if (attendances && attendances.length > 0) setActiveAttendances(attendances);
  }, [attendances]);
  React.useEffect(() => {
    if (overtimes && overtimes.length > 0) setActiveOvertimes(overtimes);
  }, [overtimes]);
  React.useEffect(() => {
    if (leaves && leaves.length > 0) setActiveLeaves(leaves);
  }, [leaves]);

  // Fungsi Fetch Realtime Laporan Langsung ke Database PostgreSQL
  const fetchLatestMatrixData = React.useCallback(async (targetMonth: string) => {
    setIsFetchingData(true);
    try {
      const [aRes, oRes, lRes, sRes] = await Promise.all([
        fetch(`/api/attendances?month=${targetMonth}&_t=${Date.now()}`),
        fetch(`/api/overtime?month=${targetMonth}&_t=${Date.now()}`),
        fetch(`/api/leaves?_t=${Date.now()}`),
        fetch(`/api/employee-schedules?month=${targetMonth}&_t=${Date.now()}`),
      ]);
      if (aRes.ok) {
        const aJson = await aRes.json();
        if (aJson.success && Array.isArray(aJson.data)) {
          setActiveAttendances(aJson.data);
        }
      }
      if (oRes.ok) {
        const oJson = await oRes.json();
        if (oJson.success && Array.isArray(oJson.data)) {
          setActiveOvertimes(oJson.data);
        }
      }
      if (lRes.ok) {
        const lJson = await lRes.json();
        if (lJson.success && Array.isArray(lJson.data)) {
          setActiveLeaves(lJson.data);
        }
      }
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (sJson.success && Array.isArray(sJson.data)) {
          setActiveSchedules(sJson.data);
        }
      }
      setLastSyncTimestamp(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA');
    } catch (err) {
      console.warn('[Matrix Sync Warn]:', err);
    } finally {
      setIsFetchingData(false);
    }
  }, []);

  // Auto-fetch saat modal dibuka atau bulan diubah
  React.useEffect(() => {
    if (open) {
      fetchLatestMatrixData(selectedMonth);
    }
  }, [open, selectedMonth, fetchLatestMatrixData]);

  // Event Listeners: Reaktif Otomatis begitu SPKL manual diterbitkan atau presensi berubah!
  React.useEffect(() => {
    const handleSyncEvent = () => {
      if (open) {
        fetchLatestMatrixData(selectedMonth);
      }
    };
    window.addEventListener('hrm_overtime_updated', handleSyncEvent);
    window.addEventListener('hrm_attendance_updated', handleSyncEvent);
    window.addEventListener('hrm_data_updated', handleSyncEvent);
    return () => {
      window.removeEventListener('hrm_overtime_updated', handleSyncEvent);
      window.removeEventListener('hrm_attendance_updated', handleSyncEvent);
      window.removeEventListener('hrm_data_updated', handleSyncEvent);
    };
  }, [open, selectedMonth, fetchLatestMatrixData]);

  // Cell Editor Modal State
  const [cellEditOpen, setCellEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CellClickTarget | null>(null);
  const [inputRealHours, setInputRealHours] = useState<number>(8);
  const [inputMultiplier, setInputMultiplier] = useState<number>(2.0);
  const [inputTaskDesc, setInputTaskDesc] = useState<string>('Tugas Pengganti Pos / Lembur Resmi');
  const [inputIsHoliday, setInputIsHoliday] = useState<boolean>(true);
  const [isSavingCell, setIsSavingCell] = useState(false);

  // Month & Day Meta
  const [yearNum, monthNum] = useMemo(() => {
    const parts = selectedMonth.split('-').map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    return new Date(yearNum, monthNum - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [yearNum, monthNum]);

  const daysInMonth = useMemo(() => {
    return new Date(yearNum, monthNum, 0).getDate();
  }, [yearNum, monthNum]);

  const daysMeta = useMemo(() => {
    const dayNames = ['MG', 'SN', 'SL', 'RB', 'KM', 'JM', 'SB'];
    const res = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(yearNum, monthNum - 1, d);
      const dayOfWeek = dt.getDay();
      res.push({
        dayNumber: d,
        dayAbbr: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        dateStr: `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return res;
  }, [yearNum, monthNum, daysInMonth]);

  // Departemen & Unit Metadata
  const orgMeta = useMemo(() => {
    if (selectedGroup === 'RUMAH TANGGA') {
      return {
        dept: 'Dept. of General Affairs & Household',
        unit: 'Unit Wisma Biring Ere & Kantor Pusat Semen Tonasa',
        seksi: 'Seksi Pengelola Rumah Tangga & Wisma',
      };
    }
    return {
      dept: 'Dept. of Distribution Management',
      unit: 'Unit of Outbond Inventory I & IV',
      seksi: 'Sec. of Shipment Management 2',
    };
  }, [selectedGroup]);

  // Target Employees in Group
  const targetEmployees = useMemo(() => {
    return employees
      .filter((emp) => {
        const nipClean = (emp.nip || '').replace(/[\s.]/g, '').toUpperCase();
        if (!nipClean.startsWith('FR')) return false;

        const grp = getEmployeeCategoryGroup(emp.nip || emp.id);
        if (selectedGroup === 'SHIPMENT') return grp === 'SHIPMENT';
        if (selectedGroup === 'RUMAH TANGGA') return grp === 'RUMAH TANGGA';
        return grp === 'SHIPMENT' || grp === 'RUMAH TANGGA';
      })
      .sort((a, b) => {
        const aNum = parseInt((a.nip || '').replace(/\D/g, ''), 10) || 0;
        const bNum = parseInt((b.nip || '').replace(/\D/g, ''), 10) || 0;
        return aNum - bNum;
      });
  }, [employees, selectedGroup]);

  // Overtime Hourly Rate: Rp 23.381,79
  const HOURLY_RATE = 23381.79;

  // Build Multi-Tier Matrix Data (7 rows per employee)
  const matrixData = useMemo(() => {
    const todayWitaStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

    return targetEmployees.map((emp, empIdx) => {
      const empNipNorm = (emp.nip || '').replace(/[\s.]/g, '').toUpperCase();
      const empIdStr = (emp.id || '').toString();
      const nipDisplay = emp.nip ? (emp.nip.includes('.') ? emp.nip : emp.nip.replace(/(FR)(07)(\d+)/, '$1.$2.$3')) : `FR.07.${String(empIdx + 34).padStart(3, '0')}`;

      // 1. Attendances (Normalisasi Defensif Snake & Camel Case)
      const empAtts = activeAttendances.filter((a) => {
        const aNip = ((a as any).user_nip || (a as any).userNip || (a as any).nip || '').replace(/[\s.]/g, '').toUpperCase();
        const aUserId = ((a as any).user_id || (a as any).userId || (a as any).id || '').toString();
        const aDateStr = ((a as any).attendance_date_str || (a as any).attendance_date || (a as any).attendanceDate || (a as any).date || '').toString().slice(0, 10);
        const inMonth = aDateStr.startsWith(selectedMonth);
        return inMonth && (aUserId === empIdStr || (empNipNorm && aNip && empNipNorm === aNip));
      });

      // 2. Approved Leaves
      const empLeaves = activeLeaves.filter((l) => {
        const lNip = ((l as any).user_nip || (l as any).userNip || (l as any).nip || '').replace(/[\s.]/g, '').toUpperCase();
        const lUserId = ((l as any).user_id || (l as any).userId || '').toString();
        const isApp = (l.status || '').toLowerCase() === 'approved';
        return isApp && (lUserId === empIdStr || (empNipNorm && lNip && empNipNorm === lNip));
      });

      // 3. Employee Shift Schedules (Roster Database)
      const empSchedules = activeSchedules.filter((s) => {
        const sNip = ((s as any).userNip || (s as any).user_nip || (s as any).nip || '').replace(/[\s.]/g, '').toUpperCase();
        const sUserId = ((s as any).userId || (s as any).user_id || '').toString();
        return sUserId === empIdStr || (empNipNorm && sNip && empNipNorm === sNip);
      });

      // 4. Overtimes in Month (Sinkron Otomatis dari Input Manual & PWA)
      const empOts = activeOvertimes.filter((o) => {
        const oNip = ((o as any).user_nip || (o as any).userNip || (o as any).nip || '').replace(/[\s.]/g, '').toUpperCase();
        const oUserId = ((o as any).user_id || (o as any).userId || '').toString();
        const oDateStr = ((o as any).date_str || (o as any).date || '').toString().slice(0, 10);
        const inMonth = oDateStr.startsWith(selectedMonth);
        const isApp = (o.status || '').toLowerCase() === 'approved' || Boolean((o as any).assignedByAdmin || (o as any).isManualAdmin);
        return inMonth && isApp && (oUserId === empIdStr || (empNipNorm && oNip && empNipNorm === oNip));
      });

      // Baris 1: Presensi Harian (1 = Hadir, 0 = Off, A = Alfa/Mangkir, S = Sakit, I = Izin, CT = Cuti)
      const attendanceCells: { val: string; isHoliday: boolean }[] = [];
      let totalHariKerja = 0;

      daysMeta.forEach((d) => {
        // A. Cek Cuti / Izin / Sakit Resmi Disahkan
        const leave = empLeaves.find((l) => {
          const s = ((l as any).start_date || (l as any).startDate || '').toString().slice(0, 10);
          const e = ((l as any).end_date || (l as any).endDate || '').toString().slice(0, 10);
          return s <= d.dateStr && e >= d.dateStr;
        });
        if (leave) {
          const t = ((leave as any).leave_type || (leave as any).leaveType || '').toLowerCase();
          if (t.includes('sakit') || t.includes('sick')) {
            attendanceCells.push({ val: 'S', isHoliday: d.isWeekend });
          } else if (t.includes('izin') || t.includes('permission')) {
            attendanceCells.push({ val: 'I', isHoliday: d.isWeekend });
          } else {
            attendanceCells.push({ val: 'CT', isHoliday: d.isWeekend });
          }
          return;
        }

        // B. Cek Jadwal Roster Resmi (Roster OFF = 0, BUKAN A!)
        const sched = empSchedules.find((s) => {
          const dt = (s.scheduleDate || s.schedule_date || s.date || '').slice(0, 10);
          return dt === d.dateStr;
        });
        const isSchedOff = Boolean(
          sched && (sched.isOff || sched.is_off || sched.shiftCode === 'OFF' || sched.shift_code === 'OFF')
        );

        // C. Cek Record Presensi Harian di Database
        const att = empAtts.find((a) => {
          const dt = ((a as any).attendance_date_str || (a as any).attendance_date || (a as any).attendanceDate || (a as any).date || '').toString().slice(0, 10);
          return dt === d.dateStr;
        });

        // D. Cek Lembur di Hari Ini (Jika ada lembur pengganti/hari libur)
        const otOnDay = empOts.find((o) => {
          const dt = ((o as any).date_str || (o as any).date || '').toString().slice(0, 10);
          return dt === d.dateStr;
        });

        if (att) {
          const st = (att.status || '').toLowerCase().trim();
          if (st === 'cuti') {
            attendanceCells.push({ val: 'CT', isHoliday: d.isWeekend });
          } else if (st === 'sakit') {
            attendanceCells.push({ val: 'S', isHoliday: d.isWeekend });
          } else if (st === 'izin') {
            attendanceCells.push({ val: 'I', isHoliday: d.isWeekend });
          } else if (st === 'mangkir' || st === 'alpa') {
            attendanceCells.push({ val: 'A', isHoliday: d.isWeekend });
          } else if (isSchedOff || st === 'off' || st === 'libur') {
            attendanceCells.push({ val: '0', isHoliday: d.isWeekend });
          } else if (st === 'hadir' || st === 'terlambat' || (att as any).clock_in || (att as any).clockIn) {
            if (isSchedOff) {
              attendanceCells.push({ val: '0', isHoliday: d.isWeekend });
            } else {
              attendanceCells.push({ val: '1', isHoliday: d.isWeekend });
              totalHariKerja++;
            }
          } else {
            // Status lain (e.g. 'belum absen'): jika belum masuk di hari kerja tetap '0'
            attendanceCells.push({ val: '0', isHoliday: d.isWeekend });
          }
          return;
        }

        // E. Jika jadwal resmi di Roster adalah OFF (atau ada lembur pengganti di hari libur): 100% adalah '0', BUKAN 'A'
        if (isSchedOff) {
          attendanceCells.push({ val: '0', isHoliday: d.isWeekend || true });
          return;
        }

        // F. Fallback Presensi:
        if (d.isWeekend) {
          attendanceCells.push({ val: '0', isHoliday: true });
        } else if (d.dateStr < todayWitaStr) {
          // Hari kerja lampau: jika ada jadwal shift kerja aktif (bukan OFF) dan tidak ada presensi -> ALPA / MANGKIR (A)
          if (sched && !sched.isOff) {
            attendanceCells.push({ val: 'A', isHoliday: false });
          } else if (!sched) {
            if (otOnDay) {
              attendanceCells.push({ val: '0', isHoliday: false });
            } else {
              attendanceCells.push({ val: 'A', isHoliday: false });
            }
          } else {
            attendanceCells.push({ val: '0', isHoliday: false });
          }
        } else {
          // Tanggal hari ini (jika belum absen) atau tanggal mendatang (seperti 14 dan seterusnya yang belum dimulai)
          // Sesuai aturan pimpinan: Hari mendatang atau hari ini yang belum clock-in tetap '0'.
          // Hanya berubah menjadi '1' jika sudah masuk di hari kerja (status hadir/terlambat/clock_in di atas).
          attendanceCells.push({ val: '0', isHoliday: false });
        }
      });

      // 5 Baris Pengali Lembur Per Karyawan Sesuai Aturan Resmi PT FRP:
      // Row 1: 1.5x (Kelebihan jam hari kerja reguler ke-1)
      // Row 2: 2.0x (Kelebihan jam hari kerja reguler ke-2 dst)
      // Row 3: 2.0x (Libur / Relief Pengganti - Kolom Kuning)
      // Row 4: 3.0x
      // Row 5: 4.0x

      const cells15: { hours: number; rawOt?: OvertimeRecord; isYellow: boolean }[] = [];
      const cells2w: { hours: number; rawOt?: OvertimeRecord; isYellow: boolean }[] = [];
      const cells2r: { hours: number; rawOt?: OvertimeRecord; isYellow: boolean }[] = [];
      const cells3: { hours: number; rawOt?: OvertimeRecord; isYellow: boolean }[] = [];
      const cells4: { hours: number; rawOt?: OvertimeRecord; isYellow: boolean }[] = [];

      let row15Real = 0, row15Paid = 0;
      let row2wReal = 0, row2wPaid = 0;
      let row2rReal = 0, row2rPaid = 0;
      let row3Real = 0, row3Paid = 0;
      let row4Real = 0, row4Paid = 0;

      const empDiv = ((emp.divisionName || (emp as any).division_name || (emp as any).seksi || emp.jobTitle || '')).toLowerCase();
      const isTimbanganOrSegel = empDiv.includes('timbangan') || empDiv.includes('segel');
      const isMatching = empDiv.includes('matching');

      daysMeta.forEach((d) => {
        const schedOnDay = empSchedules.find((s) => (s.scheduleDate || s.schedule_date || '').slice(0, 10) === d.dateStr);
        const isSchedOff = Boolean(schedOnDay && (schedOnDay.isOff || schedOnDay.is_off || schedOnDay.shiftCode === 'OFF' || schedOnDay.shift_code === 'OFF'));

        const matchOt = empOts.find((o) => {
          const oDateStr = ((o as any).date_str || (o as any).date || '').toString().slice(0, 10);
          return oDateStr === d.dateStr;
        });

        let h15 = 0, h2w = 0, h2r = 0, h3 = 0, h4 = 0;

        if (matchOt) {
          const rawHours = parseFloat((matchOt as any).duration_hours || (matchOt as any).durationHours || (matchOt as any).approved_hours || (matchOt as any).approvedHours || 0);
          const desc = ((matchOt as any).task_description || (matchOt as any).taskDescription || '').toLowerCase();

          const isReliefOrHoliday =
            Boolean((matchOt as any).is_weekend_holiday || (matchOt as any).isWeekendHoliday) ||
            isSchedOff ||
            d.isWeekend ||
            desc.includes('pengganti') ||
            desc.includes('mengganti') ||
            desc.includes('menggantikan') ||
            desc.includes('ganti') ||
            desc.includes('relief') ||
            desc.includes('sambung') ||
            desc.includes('libur') ||
            desc.includes('off') ||
            desc.includes('cuti') ||
            desc.includes('pos');

          const explicitMult = Number((matchOt as any).rate_multiplier || (matchOt as any).rateMultiplier);

          if (explicitMult === 3.0) {
            h3 = rawHours;
          } else if (explicitMult === 4.0) {
            h4 = rawHours;
          } else if (isReliefOrHoliday) {
            // ATURAN BAKU KHUSUS LEMBUR PENGGANTI SHIFT / LIBUR / OFF:
            // 1. Divisi Timbangan & Segel: Tanpa potongan istirahat (0 jam) & TANPA PENGALI 1.5x. Seluruh jam langsung 2.0x!
            // 2. Divisi Matching: Dikenakan potongan istirahat 1 jam jika jam tugas penuh (>= 8 jam) & TANPA PENGALI 1.5x. Seluruh jam langsung 2.0x!
            // 3. Divisi lain pengganti/libur: Langsung pengali 2.0x di baris Libur/Relief.
            // PENGALI 1.5x TIDAK BERLAKU (h15 = 0, h2w = 0)!
            let effectiveHours = rawHours;
            if (isMatching) {
              if (rawHours >= 8) {
                effectiveHours = rawHours - 1; // Potongan istirahat 1 jam
              } else {
                effectiveHours = rawHours;
              }
            } else if (isTimbanganOrSegel) {
              effectiveHours = rawHours; // Utuh tanpa potongan istirahat
            } else {
              effectiveHours = rawHours;
            }

            h2r = effectiveHours;
          } else {
            // ATURAN BAKU KELEBIHAN JAM REGULER DI HARI KERJA (Shift 7-7 dsb):
            // 1 jam pertama @ 1.5x, jam ke-2 & berikutnya @ 2.0x Hari Kerja
            h15 = Math.min(1, rawHours);
            h2w = Math.max(0, rawHours - 1);
          }
        }

        // Push ke masing-masing baris (Tanpa Duplikasi / Alokasi Presisi)
        cells15.push({ hours: h15, rawOt: matchOt, isYellow: false });
        row15Real += h15;
        row15Paid += h15 * 1.5;

        cells2w.push({ hours: h2w, rawOt: matchOt, isYellow: false });
        row2wReal += h2w;
        row2wPaid += h2w * 2.0;

        const isYellowCell = isSchedOff || d.isWeekend;
        cells2r.push({ hours: h2r, rawOt: matchOt, isYellow: isYellowCell || h2r > 0 });
        row2rReal += h2r;
        row2rPaid += h2r * 2.0;

        cells3.push({ hours: h3, rawOt: matchOt, isYellow: false });
        row3Real += h3;
        row3Paid += h3 * 3.0;

        cells4.push({ hours: h4, rawOt: matchOt, isYellow: false });
        row4Real += h4;
        row4Paid += h4 * 4.0;
      });

      const row15 = { mult: 1.5, label: '1.5', cells: cells15, rowReal: row15Real, rowPaid: row15Paid };
      const row2Weekday = { mult: 2.0, label: '2', cells: cells2w, rowReal: row2wReal, rowPaid: row2wPaid };
      const row2Relief = { mult: 2.0, label: '2 (Libur/Relief)', cells: cells2r, rowReal: row2rReal, rowPaid: row2rPaid };
      const row3 = { mult: 3.0, label: '3', cells: cells3, rowReal: row3Real, rowPaid: row3Paid };
      const row4 = { mult: 4.0, label: '4', cells: cells4, rowReal: row4Real, rowPaid: row4Paid };

      // Subtotal Karyawan (Peach Row)
      const subtotalDailyHours: number[] = [];
      let totalLemburReal = row15.rowReal + row2Weekday.rowReal + row2Relief.rowReal + row3.rowReal + row4.rowReal;
      let totalLemburPaid = row15.rowPaid + row2Weekday.rowPaid + row2Relief.rowPaid + row3.rowPaid + row4.rowPaid;

      daysMeta.forEach((_, dIdx) => {
        const sumOnDay =
          row15.cells[dIdx].hours +
          row2Weekday.cells[dIdx].hours +
          row2Relief.cells[dIdx].hours +
          row3.cells[dIdx].hours +
          row4.cells[dIdx].hours;
        subtotalDailyHours.push(sumOnDay);
      });

      const shiftName = emp.jobTitle?.includes('DAY') ? 'DAY SIFT' : 'SIFT 213';

      return {
        emp,
        no: empIdx + 1,
        nama: (emp.fullName || '').toUpperCase(),
        noId: nipDisplay,
        polaShift: shiftName,
        totalHariKerja,
        attendanceCells,
        multiplierRows: [
          { key: 'm15', pengaliLabel: '1.5', ...row15 },
          { key: 'm2w', pengaliLabel: '2', ...row2Weekday },
          { key: 'm2r', pengaliLabel: '2', ...row2Relief, isReliefHeader: true },
          { key: 'm3', pengaliLabel: '3', ...row3 },
          { key: 'm4', pengaliLabel: '4', ...row4 },
        ],
        subtotalDailyHours,
        totalLemburReal,
        totalLemburPaid,
      };
    });
  }, [targetEmployees, activeAttendances, activeLeaves, activeOvertimes, activeSchedules, selectedMonth, daysMeta]);

  // Grand Totals for Bottom Row
  const grandTotals = useMemo(() => {
    return matrixData.reduce(
      (acc, r) => {
        acc.hariKerja += r.totalHariKerja;
        acc.realHours += r.totalLemburReal;
        acc.paidHours += r.totalLemburPaid;
        return acc;
      },
      { hariKerja: 0, realHours: 0, paidHours: 0 }
    );
  }, [matrixData]);

  // Open Cell Input Dialog
  const handleCellClick = (employee: UserProfile, dayNumber: number, multiplier: number, existingOt?: OvertimeRecord | null) => {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const dt = new Date(yearNum, monthNum - 1, dayNumber);
    const isWk = dt.getDay() === 0 || dt.getDay() === 6;

    setEditTarget({
      employee,
      dateStr,
      dayNumber,
      multiplier,
      existingOt,
    });

    if (existingOt) {
      setInputRealHours(Number(existingOt.durationHours || existingOt.approvedHours || 8));
      setInputMultiplier(Number(existingOt.rateMultiplier || multiplier));
      setInputTaskDesc(existingOt.taskDescription || 'Tugas Pengganti Shift / Relief');
      setInputIsHoliday(Boolean(existingOt.isWeekendHoliday));
    } else {
      setInputRealHours(8);
      setInputMultiplier(multiplier);
      setInputTaskDesc(isWk || multiplier === 2.0 ? 'Tugas Pengganti Pos Resmi / Relief' : 'Kelebihan Jam Shift Reguler');
      setInputIsHoliday(isWk);
    }

    setCellEditOpen(true);
  };

  // Save / Sync Overtime Cell directly to PostgreSQL Database
  const handleSaveCell = async () => {
    if (!editTarget) return;

    try {
      setIsSavingCell(true);
      const duration = Number(inputRealHours) || 0;
      const mult = Number(inputMultiplier) || 2.0;

      // Division Rules:
      // Timbangan/Segel: 0 hr break, multiplier 2.0x
      // Matching: 1 hr break, multiplier 2.0x
      const divName = (editTarget.employee.divisionName || '').toLowerCase();
      let effectiveHours = duration;
      if (divName.includes('matching')) {
        effectiveHours = Math.max(0, duration - 1);
      }
      const paidHours = effectiveHours * mult;
      const compensationAmount = Math.round(paidHours * HOURLY_RATE);

      const payload = {
        userId: editTarget.employee.id,
        userNip: editTarget.employee.nip || '-',
        userName: editTarget.employee.fullName,
        divisionName: editTarget.employee.divisionName || 'SHIPMENT',
        date: editTarget.dateStr,
        startTime: '07:30:00',
        endTime: `${String(7 + Math.floor(duration)).padStart(2, '0')}:30:00`,
        durationHours: duration,
        approvedHours: duration,
        rateMultiplier: mult,
        rateApplied: HOURLY_RATE,
        totalPay: compensationAmount,
        compensationAmount,
        taskDescription: inputTaskDesc,
        isWeekendHoliday: inputIsHoliday,
        status: 'approved',
        paymentStatus: 'unpaid',
      };

      if (editTarget.existingOt?.id) {
        // Update existing record
        const res: any = await api.put(`/overtime/${editTarget.existingOt.id}`, payload);
        if (res?.success) {
          toast.success(`Jam lembur ${editTarget.employee.fullName} tgl ${editTarget.dayNumber} berhasil diperbarui!`);
        }
      } else {
        // Create new overtime record
        const res: any = await api.post('/overtime', payload);
        if (res?.success) {
          toast.success(`Lembur ${duration} jam (${mult}x) tersimpan & tersinkron ke database & PWA karyawan!`);
        }
      }

      setCellEditOpen(false);
      setEditTarget(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hrm_overtime_updated'));
        window.dispatchEvent(new CustomEvent('hrm_data_updated'));
      }
      fetchLatestMatrixData(selectedMonth);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan catatan lembur');
    } finally {
      setIsSavingCell(false);
    }
  };

  // Delete Overtime Cell
  const handleDeleteCell = async () => {
    if (!editTarget?.existingOt?.id) return;
    if (!window.confirm('Yakin ingin menghapus lembur pada tanggal ini?')) return;

    try {
      setIsSavingCell(true);
      const res: any = await api.delete(`/overtime/${editTarget.existingOt.id}`);
      if (res?.success) {
        toast.success('Catatan lembur pada tanggal tersebut berhasil dihapus!');
        setCellEditOpen(false);
        setEditTarget(null);
        if (onDataChanged) onDataChanged();
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus lembur');
    } finally {
      setIsSavingCell(false);
    }
  };

  // Print Window Handler (A3 Landscape)
  const handlePrint = () => {
    if (!printAreaRef.current) return;
    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) return;

    const CSS = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #000;
        background: #fff;
        padding: 12px;
      }
      @page {
        size: A3 landscape;
        margin: 6mm;
      }
      .spl-wrapper { width: 100%; }
      .spl-hdr { text-align: center; margin-bottom: 10px; }
      .spl-hdr h1 { font-size: 13pt; font-weight: 900; letter-spacing: 0.5px; text-decoration: underline; margin-bottom: 2px; }
      .spl-hdr p { font-size: 9pt; font-weight: 700; margin-top: 1px; }
      table.spl-table { width: 100%; border-collapse: collapse; font-size: 7pt; }
      table.spl-table th, table.spl-table td { border: 1px solid #000; padding: 2px 1.5px; text-align: center; vertical-align: middle; }
      table.spl-table th { background-color: #f2f2f2; font-weight: 800; }
      table.spl-table td.col-left { text-align: left; padding-left: 3px; }
      table.spl-table td.col-right { text-align: right; padding-right: 3px; }
      .bg-yellow { background-color: #fef08a !important; font-weight: 900; }
      .bg-peach { background-color: #ffedd5 !important; font-weight: 900; }
      .bg-grand { background-color: #e2e8f0 !important; font-weight: 900; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
      }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>REKAP SPL - ${selectedGroup} - ${monthLabel}</title>
          <style>${CSS}</style>
        </head>
        <body>
          <div class="spl-wrapper">
            ${printAreaRef.current.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 450);
  };

  // Ekspor Excel Multi-Row SPL (.xlsx)
  const handleExportExcel = () => {
    const headers1 = ['REKAP SURAT PERINTAH LEMBUR (SPL)'];
    const headers2 = [`DEPARTEMEN : ${orgMeta.dept}`];
    const headers3 = [`UNIT KERJA : ${orgMeta.unit}`];
    const headers4 = [`SEKSI : ${orgMeta.seksi}`];
    const headers5 = [`PERIODE : ${monthLabel}`];

    const tableHeader1 = [
      'NO',
      'NAMA',
      'NO ID',
      'POLA SHIFT',
      'PENGALI',
      ...Array(daysInMonth).fill(monthLabel.split(' ')[0]),
      'TOTAL HARI KERJA & LEMBUR REAL (Jam)',
      'JUMLAH LEMBUR YG DIBAYAR (Jam)',
    ];

    const tableHeader2 = [
      '',
      '',
      '',
      '',
      '',
      ...daysMeta.map((d) => d.dayAbbr),
      '',
      '',
    ];

    const tableHeader3 = [
      '',
      '',
      '',
      '',
      '',
      ...daysMeta.map((d) => d.dayNumber),
      '',
      '',
    ];

    const rowsData: any[] = [];
    matrixData.forEach((empRow) => {
      // Row 1: Attendance
      rowsData.push([
        empRow.no,
        empRow.nama,
        empRow.noId,
        empRow.polaShift,
        '',
        ...empRow.attendanceCells.map((c) => c.val),
        empRow.totalHariKerja,
        '',
      ]);

      // Multiplier Rows
      empRow.multiplierRows.forEach((mRow) => {
        rowsData.push([
          '',
          '',
          '',
          '',
          mRow.pengaliLabel,
          ...mRow.cells.map((c) => (c.hours > 0 ? c.hours : '')),
          mRow.rowReal > 0 ? mRow.rowReal : 0,
          mRow.rowPaid > 0 ? mRow.rowPaid.toFixed(1) : '0.0',
        ]);
      });

      // Subtotal Peach Row
      rowsData.push([
        '',
        '',
        '',
        '',
        'TOTAL',
        ...empRow.subtotalDailyHours.map((h) => (h > 0 ? h : '-')),
        empRow.totalLemburReal.toFixed(1),
        empRow.totalLemburPaid.toFixed(1),
      ]);
    });

    // Grand Total Row
    const grandRow = [
      'GRAND TOTAL',
      '',
      '',
      '',
      '',
      ...Array(daysInMonth).fill(''),
      grandTotals.realHours.toFixed(1),
      grandTotals.paidHours.toFixed(1),
    ];

    const allSheet = [
      headers1,
      headers2,
      headers3,
      headers4,
      headers5,
      [],
      tableHeader1,
      tableHeader2,
      tableHeader3,
      ...rowsData,
      grandRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(allSheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rekap_SPL_${selectedGroup}`);
    XLSX.writeFile(wb, `Rekap_SPL_Matrix_${selectedGroup}_${selectedMonth}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[1500px] max-h-[95vh] rounded-2xl p-0 overflow-y-auto border border-border shadow-2xl">
        {/* Top Control Header */}
        <div className="p-4 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-foreground flex items-center gap-2">
                REKAP SURAT PERINTAH LEMBUR (SPL) MULTIPLIER MATRIX
              </h2>
              <p className="text-xs text-muted-foreground">
                Input Otomatis Jam Lembur • Matriks Pengali Bertingkat (1.5x / 2.0x / 3x / 4x) • Sinkron Real-Time ke Database &amp; PWA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Group Switcher */}
            <div className="flex bg-muted p-1 rounded-xl text-xs font-semibold border border-border">
              <button
                type="button"
                onClick={() => setSelectedGroup('SHIPMENT')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedGroup === 'SHIPMENT' ? 'bg-sky-600 text-white shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🚢 Shipment (47 Org)
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('RUMAH TANGGA')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedGroup === 'RUMAH TANGGA' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🏡 Rumah Tangga (33 Org)
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroup('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedGroup === 'ALL' ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                👥 Gabungan (80 Org)
              </button>
            </div>

            {/* Month Picker */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="h-9 px-2 text-xs rounded-xl border border-border bg-card font-mono font-bold"
            />

            {/* Live Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLatestMatrixData(selectedMonth)}
              disabled={isFetchingData}
              className="h-9 text-xs gap-1.5 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/10"
              title="Sinkronisasi Ulang Data Realtime dari Database"
            >
              <RotateCw size={13} className={isFetchingData ? 'animate-spin text-primary' : ''} />
              {isFetchingData ? 'Menyinkronkan...' : 'Sinkron Realtime'}
            </Button>

            {/* Print & Excel */}
            <Button onClick={handlePrint} className="h-9 text-xs gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground shadow-sm">
              <Printer size={14} /> Cetak Rekap SPL (PDF)
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-9 text-xs gap-1.5 rounded-xl font-semibold text-emerald-700 border-emerald-500/40 hover:bg-emerald-50"
            >
              <Download size={14} /> Ekspor Excel (.xlsx)
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-9 w-9">
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Quick Instructions Banner */}
        <div className="px-6 py-2 bg-indigo-500/5 border-b border-indigo-500/20 flex flex-wrap items-center justify-between text-xs text-indigo-950 dark:text-indigo-200">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-600" />
            <span>
              <strong>Petunjuk Input Cepat:</strong> Klik langsung pada sel tanggal di baris pengali manapun untuk mengetik/mengubah jam lembur personil. Hasil langsung tersimpan ke PostgreSQL dan memicu update otomatis ke PWA karyawan.
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono font-bold text-xs">
            <span>Total Jam Real: {grandTotals.realHours.toFixed(1)} Jam</span>
            <span>•</span>
            <span className="text-emerald-700 dark:text-emerald-400">Total Jam Bayar: {grandTotals.paidHours.toFixed(1)} Jam</span>
          </div>
        </div>

        {/* Scrollable Printable Matrix Viewport */}
        <div className="p-4 md:p-6 bg-slate-100 dark:bg-slate-900/60 overflow-x-auto flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full bg-white text-black p-6 rounded-xl shadow-xs font-sans text-xs"
            style={{ minWidth: '1350px' }}
          >
            {/* Header Master SPL */}
            <div className="spl-hdr text-center mb-4 space-y-0.5">
              <h1 className="text-base md:text-lg font-black tracking-wide uppercase underline">
                REKAP SURAT PERINTAH LEMBUR (SPL)
              </h1>
              <p className="text-xs font-bold text-slate-800">
                DEPARTEMEN : {orgMeta.dept}
              </p>
              <p className="text-xs font-bold text-slate-800">
                UNIT KERJA : {orgMeta.unit}
              </p>
              <p className="text-xs font-bold text-slate-800">
                SEKSI : {orgMeta.seksi}
              </p>
              <div className="text-xs font-black uppercase tracking-wider pt-0.5">
                PERIODE : {monthLabel}
              </div>
            </div>

            {/* Matriks Table Multi-Row */}
            <table className="spl-table w-full border-collapse border border-black text-[9px]">
              <thead>
                {/* Header Row 1: Month Title span */}
                <tr className="bg-slate-100">
                  <th rowSpan={3} className="border border-black px-1 py-1 w-6">NO</th>
                  <th rowSpan={3} className="border border-black px-2 py-1 text-left min-w-[130px]">NAMA</th>
                  <th rowSpan={3} className="border border-black px-1 py-1 w-16">NO ID</th>
                  <th rowSpan={3} className="border border-black px-1 py-1 w-14">POLA SHIFT</th>
                  <th rowSpan={3} className="border border-black px-1 py-1 w-14">PENGALI</th>
                  <th colSpan={daysInMonth} className="border border-black py-0.5 font-black uppercase bg-slate-200">
                    {monthLabel.split(' ')[0]}
                  </th>
                  <th rowSpan={3} className="border border-black px-1.5 py-1 w-20 font-black leading-tight">
                    TOTAL HARI KERJA &amp; LEMBUR REAL (Jam)
                  </th>
                  <th rowSpan={3} className="border border-black px-1.5 py-1 w-16 font-black leading-tight">
                    JUMLAH LEMBUR YG DIBAYAR (Jam)
                  </th>
                </tr>

                {/* Header Row 2: Day Names (RB, KM, JM, SB...) */}
                <tr className="bg-slate-100 text-[8px]">
                  {daysMeta.map((d) => (
                    <th key={`day-${d.dayNumber}`} className={`border border-black px-0.5 py-0.5 w-6 ${d.isWeekend ? 'bg-yellow-200 text-black font-extrabold' : ''}`}>
                      {d.dayAbbr}
                    </th>
                  ))}
                </tr>

                {/* Header Row 3: Day Numbers (1, 2, 3... 31) */}
                <tr className="bg-slate-100 text-[8.5px] font-mono">
                  {daysMeta.map((d) => (
                    <th key={`num-${d.dayNumber}`} className={`border border-black px-0.5 py-0.5 ${d.isWeekend ? 'bg-yellow-200 font-black' : ''}`}>
                      {d.dayNumber}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {matrixData.map((empBlock) => (
                  <React.Fragment key={`emp-block-${empBlock.no}`}>
                    {/* 1. Baris Absensi Kehadiran */}
                    <tr className="border-t border-black bg-white">
                      <td rowSpan={7} className="border border-black text-center font-mono font-bold align-middle bg-slate-50">
                        {empBlock.no}
                      </td>
                      <td rowSpan={7} className="border border-black text-left font-extrabold px-1.5 align-middle bg-slate-50 whitespace-nowrap">
                        {empBlock.nama}
                      </td>
                      <td rowSpan={7} className="border border-black text-center font-mono align-middle bg-slate-50 whitespace-nowrap">
                        {empBlock.noId}
                      </td>
                      <td rowSpan={7} className="border border-black text-center font-semibold align-middle bg-slate-50 whitespace-nowrap">
                        {empBlock.polaShift}
                      </td>
                      <td className="border border-black text-center font-bold text-slate-500 py-0.5">
                        -
                      </td>

                      {/* Absen Cells */}
                      {empBlock.attendanceCells.map((cell, dIdx) => {
                        const isWk = daysMeta[dIdx]?.isWeekend;
                        return (
                          <td
                            key={`att-${empBlock.no}-${dIdx}`}
                            className={`border border-black text-center font-mono font-bold py-0.5 ${
                              cell.val === 'CT'
                                ? 'bg-sky-100 text-sky-800'
                                : cell.val === 'SK'
                                ? 'bg-rose-100 text-rose-800'
                                : cell.val === 'I'
                                ? 'bg-amber-100 text-amber-800'
                                : cell.val === 'A'
                                ? 'bg-red-200 text-red-900'
                                : cell.val === '0'
                                ? 'text-slate-400'
                                : isWk
                                ? 'bg-yellow-100 text-black'
                                : 'text-black'
                            }`}
                          >
                            {cell.val}
                          </td>
                        );
                      })}

                      {/* Total Hari Kerja */}
                      <td className="border border-black text-center font-mono font-black py-0.5 bg-slate-50">
                        {empBlock.totalHariKerja}
                      </td>
                      <td className="border border-black text-center font-mono py-0.5 bg-slate-50">-</td>
                    </tr>

                    {/* 2. Baris Multiplier Rows (1.5, 2, 2 relief, 3, 4) */}
                    {empBlock.multiplierRows.map((mRow) => (
                      <tr key={`mrow-${empBlock.no}-${mRow.key}`} className="hover:bg-indigo-50/20">
                        <td className={`border border-black text-center font-mono font-bold py-0.5 ${mRow.isReliefHeader ? 'bg-yellow-50 text-amber-900' : ''}`}>
                          {mRow.pengaliLabel}
                        </td>

                        {/* Interactive Cell Columns for Dates */}
                        {mRow.cells.map((cell, dIdx) => {
                          const isWk = daysMeta[dIdx]?.isWeekend;
                          const hasHours = cell.hours > 0;
                          return (
                            <td
                              key={`cell-${empBlock.no}-${mRow.key}-${dIdx}`}
                              onClick={() => handleCellClick(empBlock.emp, dIdx + 1, mRow.mult, cell.rawOt)}
                              title={`Klik untuk edit lembur ${empBlock.nama} tgl ${dIdx + 1}`}
                              className={`border border-black text-center font-mono cursor-pointer transition-colors py-0.5 ${
                                hasHours && cell.isYellow
                                  ? 'bg-yellow-300 text-red-700 font-extrabold hover:bg-yellow-400'
                                  : hasHours
                                  ? 'bg-emerald-100 text-emerald-900 font-extrabold hover:bg-emerald-200'
                                  : isWk
                                  ? 'bg-yellow-50 hover:bg-yellow-100'
                                  : 'hover:bg-indigo-100/50'
                              }`}
                            >
                              {hasHours ? cell.hours : ''}
                            </td>
                          );
                        })}

                        {/* Real Hours & Paid Hours for this multiplier */}
                        <td className="border border-black text-center font-mono py-0.5">
                          {mRow.rowReal > 0 ? mRow.rowReal : '0'}
                        </td>
                        <td className="border border-black text-right font-mono pr-2 py-0.5">
                          {mRow.rowPaid > 0 ? mRow.rowPaid.toFixed(1) : '0.0'}
                        </td>
                      </tr>
                    ))}

                    {/* 3. Baris Subtotal Karyawan (Peach Row) */}
                    <tr className="bg-orange-100/80 border-b-2 border-black font-black text-orange-950">
                      <td colSpan={5} className="border border-black text-right pr-2 py-1 font-bold tracking-tight">
                        TOTAL LEMBUR:
                      </td>

                      {/* Daily sum for peach row */}
                      {empBlock.subtotalDailyHours.map((dailySum, dIdx) => {
                        const isWk = daysMeta[dIdx]?.isWeekend;
                        return (
                          <td
                            key={`subsum-${empBlock.no}-${dIdx}`}
                            className={`border border-black text-center font-mono font-black py-1 ${
                              dailySum > 0 ? (isWk ? 'bg-yellow-300 text-red-700' : 'text-black') : 'text-slate-400'
                            }`}
                          >
                            {dailySum > 0 ? dailySum : '-'}
                          </td>
                        );
                      })}

                      {/* Subtotal Real & Paid */}
                      <td className="border border-black text-center font-mono font-black py-1 text-[9.5px]">
                        {empBlock.totalLemburReal.toFixed(1)}
                      </td>
                      <td className="border border-black text-right font-mono font-black pr-2 py-1 text-[9.5px]">
                        {empBlock.totalLemburPaid.toFixed(1)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* GRAND TOTAL ROW */}
                <tr className="bg-slate-300 border-t-2 border-black font-black text-slate-900 text-[10px]">
                  <td colSpan={5} className="border border-black text-center py-2 font-bold uppercase tracking-wider">
                    TOTAL KESELURUHAN OPERASIONAL
                  </td>
                  {Array(daysInMonth)
                    .fill(null)
                    .map((_, i) => (
                      <td key={`gt-${i}`} className="border border-black"></td>
                    ))}
                  <td className="border border-black text-center font-mono font-black py-2">
                    {grandTotals.realHours.toFixed(1)} Jam
                  </td>
                  <td className="border border-black text-right font-mono font-black pr-2 py-2">
                    {grandTotals.paidHours.toFixed(1)} Jam
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 text-center mt-8 text-xs font-sans">
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-800">Dibuat Oleh,</p>
                  <p className="text-[10px] text-slate-600">Pengawas / Korlap Lapangan</p>
                </div>
                <div>
                  <p className="font-bold underline text-slate-900">Muh Aslam Faisal / Korlap</p>
                  <p className="text-[10px] text-slate-600 font-mono">NIP: FRP 07065</p>
                </div>
              </div>

              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-800">Diperiksa Oleh,</p>
                  <p className="text-[10px] text-slate-600">HRD &amp; Personalia / Keuangan</p>
                </div>
                <div>
                  <p className="sig-name font-bold underline text-slate-900">Reski Faisal, S.E.</p>
                  <p className="text-[10px] text-slate-600 font-mono">Bagian Verifikasi Payroll</p>
                </div>
              </div>

              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-800">Menyetujui,</p>
                  <p className="text-[10px] text-slate-600">Direktur Utama PT. FRP</p>
                </div>
                <div>
                  <p className="sig-name font-bold underline text-slate-900">Alam AS simpuang ago, S.Sos</p>
                  <p className="text-[10px] text-slate-600 font-mono">Direktur Utama</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inline Quick Cell Input & Sync Modal */}
        <Dialog open={cellEditOpen} onOpenChange={setCellEditOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                Input / Edit Jam Lembur Matriks SPL
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {editTarget?.employee.fullName} ({editTarget?.employee.nip}) • Tanggal: {editTarget?.dateStr}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Jam Lembur Riil (Fisik)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={inputRealHours}
                    onChange={(e) => setInputRealHours(Number(e.target.value))}
                    className="h-9 text-xs rounded-xl mt-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs">Pengali (Multiplier)</Label>
                  <Select value={String(inputMultiplier)} onValueChange={(v) => setInputMultiplier(Number(v))}>
                    <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.5">1.5x (Hari Kerja Awal)</SelectItem>
                      <SelectItem value="2">2.0x (Hari Kerja Lanjutan / Libur / Relief)</SelectItem>
                      <SelectItem value="3">3.0x (Hari Libur Resmi Jam Ke-8)</SelectItem>
                      <SelectItem value="4">4.0x (Hari Libur Resmi Jam Ke-9+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Uraian Tugas / Alasan Penugasan SPKL</Label>
                <Input
                  type="text"
                  value={inputTaskDesc}
                  onChange={(e) => setInputTaskDesc(e.target.value)}
                  placeholder="Contoh: Tugas Pengganti Pos Resmi untuk Amrin Amir..."
                  className="h-9 text-xs rounded-xl mt-1"
                />
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Jenis Hari Libur / Akhir Pekan</span>
                  <span className="text-[10px] text-muted-foreground">Aktifkan jika penugasan pada hari OFF atau tanggal merah</span>
                </div>
                <input
                  type="checkbox"
                  checked={inputIsHoliday}
                  onChange={(e) => setInputIsHoliday(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
              </div>

              {/* Real-time Calculation Preview */}
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                <span className="text-[11px] font-bold text-primary block">Kalkulasi Otomatis Sesuai Aturan Divisi:</span>
                <div className="flex justify-between text-xs">
                  <span>Jam Riil: <strong>{inputRealHours} Jam</strong></span>
                  <span>Pengali: <strong>{inputMultiplier}x</strong></span>
                  <span>Jam Bayar: <strong>{(inputRealHours * inputMultiplier).toFixed(1)} Jam</strong></span>
                </div>
                <div className="text-right pt-1 font-mono font-extrabold text-foreground text-sm">
                  Estimasi Biaya: Rp {Math.round(inputRealHours * inputMultiplier * HOURLY_RATE).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              {editTarget?.existingOt?.id && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteCell}
                  disabled={isSavingCell}
                  className="mr-auto rounded-xl text-xs gap-1"
                >
                  <Trash2 size={13} /> Hapus
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setCellEditOpen(false)} className="rounded-xl text-xs">
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleSaveCell}
                disabled={isSavingCell}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs gap-1 font-bold shadow-sm"
              >
                <Save size={13} /> Simpan &amp; Sinkronkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

