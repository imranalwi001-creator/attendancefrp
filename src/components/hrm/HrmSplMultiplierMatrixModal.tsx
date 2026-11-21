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
  UserCheck,
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
  rowKey?: 'm15' | 'm2w' | 'm2r' | 'm3' | 'm4';
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

  // Attendance Editor Modal State (Khusus Rekonsiliasi Pra-PWA Oktober 2026)
  const [attEditOpen, setAttEditOpen] = useState(false);
  const [attEditTarget, setAttEditTarget] = useState<{
    employee: UserProfile;
    dateStr: string;
    dayNumber: number;
    currentVal: string;
    attRecord?: AttendanceRecord | null;
  } | null>(null);
  const [selectedAttStatus, setSelectedAttStatus] = useState<string>('hadir');
  const [attNotes, setAttNotes] = useState<string>('');
  const [isSavingAtt, setIsSavingAtt] = useState(false);

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

  // Target Employees in Group (HANYA 80 Personil Lembur Sah: 47 Shipment & 33 Rumah Tangga)
  const targetEmployees = useMemo(() => {
    return employees
      .filter((emp) => {
        const nipClean = (emp.nip || '').replace(/[\s.]/g, '').toUpperCase();
        if (!nipClean.startsWith('FR')) return false;

        // Karyawan Tetap (Aslam, Samsi, Takdir) BUKAN personil lembur (SPL)!
        const grp = getEmployeeCategoryGroup(emp);
        if (grp === 'KARYAWAN TETAP') return false;

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
      const empNameNorm = (emp.fullName || (emp as any).name || '').toLowerCase().trim();
      const nipDisplay = emp.nip ? (emp.nip.includes('.') ? emp.nip : emp.nip.replace(/(FR)(07)(\d+)/, '$1.$2.$3')) : `FR.07.${String(empIdx + 34).padStart(3, '0')}`;

      // 1. Attendances (Normalisasi Defensif Snake & Camel Case & Name Fallback)
      const empAtts = activeAttendances.filter((a) => {
        const aNip = ((a as any).user_nip || (a as any).userNip || (a as any).nip || '').replace(/[\s.]/g, '').toUpperCase();
        const aUserId = ((a as any).user_id || (a as any).userId || '').toString();
        const aName = ((a as any).userName || (a as any).user_name || '').toLowerCase().trim();
        const aDateStr = ((a as any).attendance_date_str || (a as any).attendance_date || (a as any).attendanceDate || (a as any).date || '').toString().slice(0, 10);
        const inMonth = aDateStr.startsWith(selectedMonth);
        const matchesUser = (aUserId && empIdStr && aUserId === empIdStr) ||
          (empNipNorm && aNip && empNipNorm === aNip) ||
          (empNameNorm && aName && (empNameNorm === aName || (empNameNorm.includes('honnes') && aName.includes('honnes'))));
        return inMonth && matchesUser;
      });

      // 2. Approved Leaves
      const empLeaves = activeLeaves.filter((l) => {
        const lNip = ((l as any).user_nip || (l as any).userNip || (l as any).nip || '').replace(/[\s.]/g, '').toUpperCase();
        const lUserId = ((l as any).user_id || (l as any).userId || '').toString();
        const lName = ((l as any).userName || (l as any).user_name || (l as any).full_name || '').toLowerCase().trim();
        const isApp = (l.status || '').toLowerCase() === 'approved';
        const matchesUser = (lUserId && empIdStr && lUserId === empIdStr) ||
          (empNipNorm && lNip && empNipNorm === lNip) ||
          (empNameNorm && lName && (empNameNorm === lName || (empNameNorm.includes('honnes') && lName.includes('honnes'))));
        return isApp && matchesUser;
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
      const attendanceCells: { val: string; isHoliday: boolean; attRecord?: any; leaveRecord?: any }[] = [];
      let totalHariKerja = 0;
      const isOctober2026 = selectedMonth === '2026-10';

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
            attendanceCells.push({ val: 'S', isHoliday: d.isWeekend, leaveRecord: leave });
          } else if (t.includes('izin') || t.includes('permission')) {
            attendanceCells.push({ val: 'I', isHoliday: d.isWeekend, leaveRecord: leave });
          } else {
            attendanceCells.push({ val: 'CT', isHoliday: d.isWeekend, leaveRecord: leave });
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
          if (st === 'cuti' || st.includes('cuti')) {
            attendanceCells.push({ val: 'CT', isHoliday: d.isWeekend, attRecord: att });
          } else if (st === 'sakit' || st.includes('sakit')) {
            attendanceCells.push({ val: 'S', isHoliday: d.isWeekend, attRecord: att });
          } else if (st === 'izin' || st.includes('izin')) {
            attendanceCells.push({ val: 'I', isHoliday: d.isWeekend, attRecord: att });
          } else if (st === 'mangkir' || st === 'alfa') {
            attendanceCells.push({ val: 'A', isHoliday: d.isWeekend, attRecord: att });
          } else if (isSchedOff || st === 'off' || st === 'libur') {
            attendanceCells.push({ val: '0', isHoliday: d.isWeekend, attRecord: att });
          } else if (st === 'hadir' || st === 'terlambat' || st === 'present' || (att as any).clock_in || (att as any).clockIn) {
            if (isSchedOff) {
              attendanceCells.push({ val: '0', isHoliday: d.isWeekend, attRecord: att });
            } else {
              attendanceCells.push({ val: '1', isHoliday: d.isWeekend, attRecord: att });
              totalHariKerja++;
            }
          } else {
            // Status lain (e.g. 'belum absen'): jika belum masuk di hari kerja tetap '0'
            attendanceCells.push({ val: '0', isHoliday: d.isWeekend, attRecord: att });
          }
          return;
        }

        // E. Jika jadwal resmi di Roster adalah OFF (atau ada lembur pengganti di hari libur): 100% adalah '0', BUKAN 'A'
        if (isSchedOff) {
          attendanceCells.push({ val: '0', isHoliday: d.isWeekend || true });
          return;
        }

        // F. Fallback Presensi:
        if (isOctober2026) {
          // KHUSUS BULAN OKTOBER 2026:
          // Karena absensi mobile PWA baru resmi diberlakukan pada bulan November 2026,
          // seluruh hari kerja yang bukan jadwal OFF secara default diisi '1' (Hadir),
          // dan dapat diedit langsung oleh Admin (Hadir / Cuti / Sakit / Izin / Alfa / Off).
          if (isSchedOff || (d.isWeekend && !sched)) {
            attendanceCells.push({ val: '0', isHoliday: true, attRecord: att });
          } else {
            attendanceCells.push({ val: '1', isHoliday: false, attRecord: att });
            totalHariKerja++;
          }
        } else {
          // BULAN NOVEMBER 2026 DAN SETERUSNYA (Data Aktual & Real-Time PWA):
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
            attendanceCells.push({ val: '0', isHoliday: false });
          }
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

      const empDiv = ((emp.divisionName || (emp as any).division_name || (emp as any).seksi || emp.jobTitle || '')).toLowerCase();
      const empName = ((emp.fullName || (emp as any).full_name || (emp as any).name || '')).toLowerCase();
      const empNip = ((emp.nip || '')).toUpperCase();
      const isTimbanganOrSegel = empDiv.includes('timbangan') || empDiv.includes('segel');
      const isMatchingOrIchtiar = empDiv.includes('matching') || empName.includes('ichtiar') || empName.includes('icthiar') || empNip.includes('7044') || empNip.includes('7047');

      daysMeta.forEach((d) => {
        const schedOnDay = empSchedules.find((s) => (s.scheduleDate || s.schedule_date || '').slice(0, 10) === d.dateStr);
        const isSchedOff = Boolean(schedOnDay && (schedOnDay.isOff || schedOnDay.is_off || schedOnDay.shiftCode === 'OFF' || schedOnDay.shift_code === 'OFF'));

        // Ambil SEMUA rekaman lembur pada tanggal ini (mendukung multi-baris pengali di tanggal yang sama)
        const dayOts = empOts.filter((o) => {
          const oDateStr = ((o as any).date_str || (o as any).date || '').toString().slice(0, 10);
          return oDateStr === d.dateStr;
        });

        let ot15: OvertimeRecord | undefined;
        let ot2w: OvertimeRecord | undefined;
        let ot2r: OvertimeRecord | undefined;
        let ot3: OvertimeRecord | undefined;
        let ot4: OvertimeRecord | undefined;

        let h15 = 0, h2w = 0, h2r = 0, h3 = 0, h4 = 0;

        dayOts.forEach((o) => {
          const rawHours = parseFloat((o as any).duration_hours || (o as any).durationHours || (o as any).approved_hours || (o as any).approvedHours || 0);
          const desc = ((o as any).task_description || (o as any).taskDescription || '').toLowerCase();
          const notes = ((o as any).approval_notes || (o as any).approvalNotes || '').toLowerCase();
          const tagInfo = `${desc} ${notes}`;
          const explicitMult = Number((o as any).rate_multiplier || (o as any).rateMultiplier);

          if (tagInfo.includes('[m15]')) {
            ot15 = o;
            h15 += rawHours;
          } else if (tagInfo.includes('[m3]')) {
            ot3 = o;
            h3 += rawHours;
          } else if (tagInfo.includes('[m4]')) {
            ot4 = o;
            h4 += rawHours;
          } else if (tagInfo.includes('[m2w]')) {
            ot2w = o;
            h2w += rawHours;
          } else if (tagInfo.includes('[m2r]')) {
            ot2r = o;
            h2r += rawHours;
          } else if (explicitMult === 1.5) {
            ot15 = o;
            h15 += rawHours;
          } else if (explicitMult === 3.0) {
            ot3 = o;
            h3 += rawHours;
          } else if (explicitMult === 4.0) {
            ot4 = o;
            h4 += rawHours;
          } else {
            // Rekaman tanpa tag eksplisit baris (didekomposisi sesuai aturan baku PT FRP)
            const isDayOff = Boolean((o as any).is_weekend_holiday || (o as any).isWeekendHoliday || isSchedOff || d.isWeekend);
            const isReliefDuty = Boolean(
              (o as any).leave_request_id ||
              desc.includes('pengganti') ||
              desc.includes('mengganti') ||
              desc.includes('menggantikan') ||
              desc.includes('ganti') ||
              desc.includes('relief') ||
              desc.includes('sambung') ||
              desc.includes('cuti') ||
              desc.includes('off') ||
              desc.includes('libur') ||
              desc.includes('pos')
            );

            if (isMatchingOrIchtiar) {
              // ── 1. MATCHING & ICHTIAR ──────────────────────────────────────────
              if (isDayOff) {
                // Hari OFF: Dipotong 1 jam istirahat (jika > 1 jam), seluruh jam efektif pengali 2.0x Libur (m2r)
                const breakDed = rawHours > 1 ? 1 : 0;
                const eff = Math.max(0, rawHours - breakDed);
                h2r += eff;
                ot2r = o;
              } else {
                // Hari Kerja:
                // - Jika <= 6 jam (termasuk < 4 jam): TIDAK DIPOTONG ISTIRAHAT
                // - Jika > 6 jam: DIPOTONG ISTIRAHAT 1 JAM
                // - Tetap menggunakan pengali 1.5x di 1 jam pertama, sisanya 2.0x Reguler (m2w)
                const breakDed = rawHours > 6 ? 1 : 0;
                const eff = Math.max(0, rawHours - breakDed);
                const p15 = Math.min(1, eff);
                const p2w = Math.max(0, eff - 1);
                h15 += p15;
                if (!ot15) ot15 = o;
                h2w += p2w;
                if (!ot2w) ot2w = o;
              }
            } else if (isTimbanganOrSegel) {
              // ── 2. TIMBANGAN & SEGEL ─────────────────────────────────────────
              if (isDayOff) {
                // Lembur mengganti cuti/izin di hari OFF: TANPA POTONGAN ISTIRAHAT, langsung pengali 2.0x Libur (m2r)
                h2r += rawHours;
                ot2r = o;
              } else {
                // Hari Kerja (lembur < 5 jam maupun mengganti cuti/izin di hari kerja):
                // TANPA POTONGAN ISTIRAHAT, pengali 1.5x di 1 jam pertama, sisanya 2.0x Reguler (m2w)
                const p15 = Math.min(1, rawHours);
                const p2w = Math.max(0, rawHours - 1);
                h15 += p15;
                if (!ot15) ot15 = o;
                h2w += p2w;
                if (!ot2w) ot2w = o;
              }
            } else {
              // ── 3. SHIPMENT UMUM LAINNYA ─────────────────────────────────────
              if (isDayOff) {
                const breakDed = rawHours > 1 ? 1 : 0;
                const eff = Math.max(0, rawHours - breakDed);
                h2r += eff;
                ot2r = o;
              } else {
                const breakDed = rawHours > 6 ? 1 : 0;
                const eff = Math.max(0, rawHours - breakDed);
                const p15 = Math.min(1, eff);
                const p2w = Math.max(0, eff - 1);
                h15 += p15;
                if (!ot15) ot15 = o;
                h2w += p2w;
                if (!ot2w) ot2w = o;
              }
            }
          }
        });

        // Push ke masing-masing baris pengali dengan ref rawOt independen
        cells15.push({ hours: h15, rawOt: ot15, isYellow: false });
        cells2w.push({ hours: h2w, rawOt: ot2w, isYellow: false });
        const isYellowCell = isSchedOff || d.isWeekend;
        cells2r.push({ hours: h2r, rawOt: ot2r, isYellow: isYellowCell || h2r > 0 });
        cells3.push({ hours: h3, rawOt: ot3, isYellow: false });
        cells4.push({ hours: h4, rawOt: ot4, isYellow: false });
      });

      // ── STANDAR REKAPITULASI RESMI SPL PT FRP ──────────────────────────────────
      // Pengali TIDAK dikalikan satu per satu harian, melainkan dihitung dulu
      // TOTAL rekapan jam riil selama sebulan penuh, BARU kemudian dikalikan pengali:
      const row15Real = cells15.reduce((acc, c) => acc + c.hours, 0);
      const row15Paid = Number((row15Real * 1.5).toFixed(1));

      const row2wReal = cells2w.reduce((acc, c) => acc + c.hours, 0);
      const row2wPaid = Number((row2wReal * 2.0).toFixed(1));

      const row2rReal = cells2r.reduce((acc, c) => acc + c.hours, 0);
      const row2rPaid = Number((row2rReal * 2.0).toFixed(1));

      const row3Real = cells3.reduce((acc, c) => acc + c.hours, 0);
      const row3Paid = Number((row3Real * 3.0).toFixed(1));

      const row4Real = cells4.reduce((acc, c) => acc + c.hours, 0);
      const row4Paid = Number((row4Real * 4.0).toFixed(1));

      const row15 = { mult: 1.5, label: '1.5', cells: cells15, rowReal: row15Real, rowPaid: row15Paid };
      const row2Weekday = { mult: 2.0, label: '2', cells: cells2w, rowReal: row2wReal, rowPaid: row2wPaid };
      const row2Relief = { mult: 2.0, label: '2 (Libur/Relief)', cells: cells2r, rowReal: row2rReal, rowPaid: row2rPaid };
      const row3 = { mult: 3.0, label: '3', cells: cells3, rowReal: row3Real, rowPaid: row3Paid };
      const row4 = { mult: 4.0, label: '4', cells: cells4, rowReal: row4Real, rowPaid: row4Paid };

      // Subtotal Karyawan (Peach Row)
      const subtotalDailyHours: number[] = [];
      const totalLemburReal = row15Real + row2wReal + row2rReal + row3Real + row4Real;
      const totalLemburPaid = row15Paid + row2wPaid + row2rPaid + row3Paid + row4Paid;

      daysMeta.forEach((_, dIdx) => {
        const sumOnDay =
          row15.cells[dIdx].hours +
          row2Weekday.cells[dIdx].hours +
          row2Relief.cells[dIdx].hours +
          row3.cells[dIdx].hours +
          row4.cells[dIdx].hours;
        subtotalDailyHours.push(sumOnDay);
      });

      const hasDayShift =
        empSchedules.some((s) => {
          const sName = (s.shiftName || s.shift_name || (s as any).name || '').toUpperCase();
          return sName.includes('DAY');
        }) ||
        (emp.jobTitle || '').toUpperCase().includes('DAY') ||
        (emp.divisionName || (emp as any).division_name || '').toLowerCase().includes('kantor pusat');

      const shiftName = hasDayShift ? 'DAY SIFT' : 'SIFT 213';

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
  const handleCellClick = (
    employee: UserProfile,
    dayNumber: number,
    multiplier: number,
    existingOt?: OvertimeRecord | null,
    rowKey?: 'm15' | 'm2w' | 'm2r' | 'm3' | 'm4'
  ) => {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const dt = new Date(yearNum, monthNum - 1, dayNumber);
    const isWk = dt.getDay() === 0 || dt.getDay() === 6;

    setEditTarget({
      employee,
      dateStr,
      dayNumber,
      multiplier,
      existingOt,
      rowKey,
    });

    if (existingOt) {
      setInputRealHours(Number(existingOt.durationHours || (existingOt as any).duration_hours || existingOt.approvedHours || (existingOt as any).approved_hours || (multiplier === 1.5 ? 1 : 2)));
      setInputMultiplier(Number(existingOt.rateMultiplier || (existingOt as any).rate_multiplier || multiplier));
      setInputTaskDesc(existingOt.taskDescription || (existingOt as any).task_description || (
        multiplier === 1.5
          ? 'Kelebihan Jam Shift Reguler (Jam ke-1)'
          : rowKey === 'm2w'
          ? 'Kelebihan Jam Shift Reguler (Jam ke-2 dst)'
          : rowKey === 'm2r'
          ? 'Tugas Pengganti Pos Resmi / Relief'
          : rowKey === 'm3'
          ? 'Lembur Hari Libur Resmi Jam Ke-8'
          : 'Lembur Hari Libur Resmi Jam Ke-9+'
      ));
      setInputIsHoliday(Boolean(existingOt.isWeekendHoliday || (existingOt as any).is_weekend_holiday || rowKey === 'm2r' || isWk));
    } else {
      setInputRealHours(multiplier === 1.5 ? 1 : rowKey === 'm2w' ? 2 : rowKey === 'm2r' ? 8 : 1);
      setInputMultiplier(multiplier);
      setInputTaskDesc(
        multiplier === 1.5
          ? 'Kelebihan Jam Shift Reguler (Jam ke-1)'
          : rowKey === 'm2w'
          ? 'Kelebihan Jam Shift Reguler (Jam ke-2 dst)'
          : rowKey === 'm2r'
          ? 'Tugas Pengganti Pos Resmi / Relief'
          : rowKey === 'm3'
          ? 'Lembur Hari Libur Resmi Jam Ke-8'
          : 'Lembur Hari Libur Resmi Jam Ke-9+'
      );
      setInputIsHoliday(rowKey === 'm2r' || isWk);
    }

    setCellEditOpen(true);
  };

  // Save / Sync Overtime Cell directly to PostgreSQL Database
  const handleSaveCell = async () => {
    if (!editTarget) return;

    try {
      setIsSavingCell(true);
      const duration = Number(inputRealHours) || 0;
      const mult = Number(inputMultiplier) || editTarget.multiplier || 2.0;

      // Division Rules Sesuai Kebijakan Direksi & Operasional PT FRP:
      // 1. Matching & Ichtiar:
      //    • Hari Kerja: Jika duration <= 6 jam (termasuk < 4 jam) TIDAK DIPOTONG ISTIRAHAT; jika > 6 jam dipotong 1 jam istirahat.
      //    • Hari OFF: Dipotong 1 jam istirahat (jika duration > 1 jam).
      // 2. Timbangan & Segel:
      //    • Hari Kerja & Hari OFF (lembur < 5 jam maupun mengganti cuti/izin): TANPA POTONGAN ISTIRAHAT (0 jam).
      // 3. Divisi Shipment Lainnya:
      //    • Hari OFF: Dipotong 1 jam istirahat (jika duration > 1 jam).
      //    • Hari Kerja: Dipotong 1 jam istirahat hanya jika duration > 6 jam.
      const divName = (editTarget.employee.divisionName || (editTarget.employee as any).division_name || '').toLowerCase();
      const empName = (editTarget.employee.fullName || (editTarget.employee as any).full_name || (editTarget.employee as any).name || '').toLowerCase();
      const empNip = (editTarget.employee.nip || '').toUpperCase();
      const isMatchingOrIchtiar = divName.includes('matching') || empName.includes('ichtiar') || empName.includes('icthiar') || empNip.includes('7044') || empNip.includes('7047');
      const isTimbanganOrSegel = divName.includes('timbangan') || divName.includes('segel');

      let effectiveHours = duration;
      if (isMatchingOrIchtiar) {
        if (inputIsHoliday || editTarget.rowKey === 'm2r') {
          effectiveHours = duration > 1 ? Math.max(0, duration - 1) : duration;
        } else {
          effectiveHours = duration > 6 ? Math.max(0, duration - 1) : duration;
        }
      } else if (isTimbanganOrSegel) {
        // Timbangan & Segel: TANPA POTONGAN ISTIRAHAT
        effectiveHours = duration;
      } else {
        if (inputIsHoliday || editTarget.rowKey === 'm2r') {
          effectiveHours = duration > 1 ? Math.max(0, duration - 1) : duration;
        } else {
          effectiveHours = duration > 6 ? Math.max(0, duration - 1) : duration;
        }
      }
      const paidHours = effectiveHours * mult;
      const compensationAmount = Math.round(paidHours * HOURLY_RATE);

      const rowTag = editTarget.rowKey ? `[${editTarget.rowKey.toUpperCase()}]` : (mult === 1.5 ? '[M15]' : '[M2W]');
      const finalApprovalNotes = `${rowTag} Ditugaskan dan disahkan langsung oleh Super Administrator`;

      const payload = {
        userId: editTarget.employee.id,
        userNip: editTarget.employee.nip || '-',
        userName: editTarget.employee.fullName,
        divisionName: editTarget.employee.divisionName || 'SHIPMENT',
        date: editTarget.dateStr,
        startTime: '07:30:00',
        endTime: `${String(7 + Math.floor(duration)).padStart(2, '0')}:${duration % 1 !== 0 ? '30' : '00'}:00`,
        durationHours: duration,
        approvedHours: duration,
        rateMultiplier: mult,
        rateApplied: HOURLY_RATE,
        totalPay: compensationAmount,
        compensationAmount,
        taskDescription: inputTaskDesc,
        approvalNotes: finalApprovalNotes,
        isWeekendHoliday: inputIsHoliday,
        status: 'approved',
        paymentStatus: 'unpaid',
        isManualAdmin: true,
        assignedByAdmin: true,
      };

      if (duration === 0 && editTarget.existingOt?.id) {
        // Hapus jika diisi 0 jam
        const res: any = await api.delete(`/overtime/${editTarget.existingOt.id}`);
        if (res?.success) {
          toast.success(`Jam lembur tgl ${editTarget.dayNumber} dihapus`);
        }
      } else if (editTarget.existingOt?.id) {
        // Update existing record
        const res: any = await api.put(`/overtime/${editTarget.existingOt.id}`, payload);
        if (res?.success) {
          toast.success(`Jam lembur ${editTarget.employee.fullName} tgl ${editTarget.dayNumber} (${mult}x) berhasil diperbarui!`);
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
    if (!window.confirm('Yakin ingin menghapus lembur pada baris ini?')) return;

    try {
      setIsSavingCell(true);
      const res: any = await api.delete(`/overtime/${editTarget.existingOt.id}`);
      if (res?.success) {
        toast.success('Catatan lembur pada baris tersebut berhasil dihapus!');
        setCellEditOpen(false);
        setEditTarget(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hrm_overtime_updated'));
          window.dispatchEvent(new CustomEvent('hrm_data_updated'));
        }
        fetchLatestMatrixData(selectedMonth);
        if (onDataChanged) onDataChanged();
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus lembur');
    } finally {
      setIsSavingCell(false);
    }
  };

  // Open Attendance Editor Dialog (Khusus Rekonsiliasi Pra-PWA Oktober 2026)
  const handleAttendanceCellClick = (
    employee: UserProfile,
    dayNumber: number,
    currentVal: string,
    attRecord?: AttendanceRecord | null
  ) => {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    setAttEditTarget({
      employee,
      dateStr,
      dayNumber,
      currentVal,
      attRecord,
    });

    if (currentVal === 'CT') setSelectedAttStatus('cuti');
    else if (currentVal === 'S' || currentVal === 'SK') setSelectedAttStatus('sakit');
    else if (currentVal === 'I') setSelectedAttStatus('izin');
    else if (currentVal === 'A') setSelectedAttStatus('alfa');
    else if (currentVal === '0') setSelectedAttStatus('off');
    else setSelectedAttStatus('hadir');

    setAttNotes((attRecord as any)?.notes || 'Rekonsiliasi Kehadiran Oktober 2026');
    setAttEditOpen(true);
  };

  // Save Attendance directly to PostgreSQL Database
  const handleSaveAttendance = async () => {
    if (!attEditTarget) return;

    try {
      setIsSavingAtt(true);
      const res: any = await api.post('/attendances/manual-entry', {
        userId: attEditTarget.employee.id,
        attendanceDate: attEditTarget.dateStr,
        status: selectedAttStatus,
        notes: attNotes || 'Rekonsiliasi Kehadiran Oktober 2026',
        clockIn: selectedAttStatus === 'hadir' ? '07:30:00' : null,
        clockOut: selectedAttStatus === 'hadir' ? '15:30:00' : null,
      });

      if (res?.success) {
        const statusLabel =
          selectedAttStatus === 'hadir'
            ? 'HADIR (1)'
            : selectedAttStatus === 'cuti'
            ? 'CUTI (CT)'
            : selectedAttStatus === 'sakit'
            ? 'SAKIT (S)'
            : selectedAttStatus === 'izin'
            ? 'IZIN (I)'
            : selectedAttStatus === 'alfa'
            ? 'ALFA (A)'
            : 'OFF / LIBUR (0)';
        toast.success(
          `Kehadiran ${attEditTarget.employee.fullName} tgl ${attEditTarget.dayNumber} Okt diperbarui: ${statusLabel}`
        );
        setAttEditOpen(false);
        setAttEditTarget(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hrm_attendance_updated'));
          window.dispatchEvent(new CustomEvent('hrm_data_updated'));
        }
        fetchLatestMatrixData(selectedMonth);
        if (onDataChanged) onDataChanged();
      } else {
        toast.error(res?.error || 'Gagal menyimpan status kehadiran');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan status kehadiran');
    } finally {
      setIsSavingAtt(false);
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
                      <td rowSpan={6} className="border border-black text-center font-mono font-bold align-middle bg-slate-50">
                        {empBlock.no}
                      </td>
                      <td rowSpan={6} className="border border-black text-left font-extrabold px-1.5 align-middle bg-slate-50 whitespace-nowrap">
                        {empBlock.nama}
                      </td>
                      <td rowSpan={6} className="border border-black text-center font-mono align-middle bg-slate-50 whitespace-nowrap">
                        {empBlock.noId}
                      </td>
                      <td rowSpan={6} className="border border-black text-center font-semibold align-middle bg-slate-50 whitespace-nowrap">
                        {empBlock.polaShift}
                      </td>
                      <td className="border border-black text-center font-bold text-slate-500 py-0.5">
                        -
                      </td>

                      {/* Absen Cells */}
                      {empBlock.attendanceCells.map((cell, dIdx) => {
                        const isWk = daysMeta[dIdx]?.isWeekend;
                        const isOctober2026 = selectedMonth === '2026-10';
                        return (
                          <td
                            key={`att-${empBlock.no}-${dIdx}`}
                            onClick={() => isOctober2026 && handleAttendanceCellClick(empBlock.emp, dIdx + 1, cell.val, cell.attRecord)}
                            title={
                              isOctober2026
                                ? `Klik untuk edit kehadiran ${empBlock.nama} tgl ${dIdx + 1} Okt (${cell.val})`
                                : undefined
                            }
                            className={`border border-black text-center font-mono font-bold py-0.5 ${
                              isOctober2026
                                ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:opacity-80 transition-all select-none'
                                : ''
                            } ${
                              cell.val === 'CT'
                                ? 'bg-sky-100 text-sky-800'
                                : cell.val === 'SK' || cell.val === 'S'
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
                              onClick={() => handleCellClick(empBlock.emp, dIdx + 1, mRow.mult, cell.rawOt, mRow.key as any)}
                              title={`Klik untuk input/edit lembur ${empBlock.nama} tgl ${dIdx + 1} (Baris ${mRow.pengaliLabel}x)`}
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
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-sm md:text-base font-bold flex items-center gap-2">
                  <Clock size={16} className="text-indigo-600" />
                  {editTarget?.existingOt ? 'Edit Jam Lembur' : 'Input Lembur Baru'}
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                  Baris {editTarget?.rowKey === 'm15' ? '1.5x (Reguler)' : editTarget?.rowKey === 'm2w' ? '2.0x (Reguler)' : editTarget?.rowKey === 'm2r' ? '2.0x (Libur/Relief)' : editTarget?.rowKey === 'm3' ? '3.0x' : '4.0x'}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {editTarget?.employee.fullName} ({editTarget?.employee.nip}) • Tanggal: {editTarget?.dateStr}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <Label className="text-xs font-semibold">Jam Lembur Riil (Fisik)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={inputRealHours}
                    onChange={(e) => setInputRealHours(Number(e.target.value))}
                    className="h-9 text-xs rounded-xl mt-1 font-mono font-bold"
                    placeholder="Contoh: 1 atau 2..."
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Pengali Baris SPL (Terkunci)</Label>
                  <div className="h-9 px-3 mt-1 rounded-xl border border-border bg-muted/60 flex items-center justify-between text-xs font-mono font-bold text-foreground">
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {editTarget?.multiplier || inputMultiplier}x
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-sans font-medium">
                      {editTarget?.rowKey === 'm15'
                        ? '1 Jam Pertama'
                        : editTarget?.rowKey === 'm2w'
                        ? 'Jam Lanjutan'
                        : editTarget?.rowKey === 'm2r'
                        ? 'Libur / Relief'
                        : editTarget?.rowKey === 'm3'
                        ? 'Libur Jam Ke-8'
                        : 'Libur Jam Ke-9+'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Uraian Tugas / Alasan Penugasan SPKL</Label>
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
                  <span className="font-semibold block text-xs">Jenis Hari Libur / Akhir Pekan</span>
                  <span className="text-[10px] text-muted-foreground">Aktifkan jika penugasan pada hari OFF atau tanggal merah</span>
                </div>
                <input
                  type="checkbox"
                  checked={inputIsHoliday}
                  onChange={(e) => setInputIsHoliday(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              {/* Info Standar Akumulasi Bulanan Rekap SPL */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200 text-xs">
                  <Info size={14} className="text-indigo-600 shrink-0" />
                  <span>Standar Rekapitulasi SPL PT FRP:</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Angka pada sel ini dicatat murni sebagai <strong>Jam Lembur Riil (Fisik)</strong> harian. Seluruh jam riil pada baris ini <strong>dijumlahkan dulu sebulan penuh</strong>, kemudian <strong>total rekapan sebulan tersebut dikalikan pengali {(editTarget?.multiplier || inputMultiplier)}x</strong> di kolom rekapitulasi akhir, bukan dikalikan harian satu per satu.
                </p>
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


        {/* Modal Dialog Edit Status Kehadiran (Khusus Pra-PWA Oktober 2026) */}
        <Dialog open={attEditOpen} onOpenChange={setAttEditOpen}>
          <DialogContent className="max-w-md rounded-2xl shadow-2xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">
                    Edit Status Kehadiran (Oktober 2026)
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {attEditTarget?.employee.fullName} ({attEditTarget?.employee.nip || '-'}) • Tanggal {attEditTarget?.dayNumber} Okt 2026
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Karyawan:</span>
                  <span className="font-bold text-foreground">{attEditTarget?.employee.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Divisi / Penugasan:</span>
                  <span className="font-semibold">{attEditTarget?.employee.divisionName || 'SHIPMENT'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span className="font-mono font-semibold">{attEditTarget?.dateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status Saat Ini:</span>
                  <span className="font-mono font-bold text-indigo-600">
                    {attEditTarget?.currentVal === '1'
                      ? '1 (Hadir)'
                      : attEditTarget?.currentVal === 'CT'
                      ? 'CT (Cuti)'
                      : attEditTarget?.currentVal === 'S' || attEditTarget?.currentVal === 'SK'
                      ? 'S (Sakit)'
                      : attEditTarget?.currentVal === 'I'
                      ? 'I (Izin)'
                      : attEditTarget?.currentVal === 'A'
                      ? 'A (Alfa)'
                      : '0 (OFF)'}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Pilih Status Kehadiran:</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'hadir', val: '1', label: 'Hadir', desc: 'Masuk kerja normal', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300' },
                    { key: 'cuti', val: 'CT', label: 'Cuti', desc: 'Cuti resmi disahkan', color: 'bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-300' },
                    { key: 'sakit', val: 'S', label: 'Sakit', desc: 'Keterangan dokter', color: 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300' },
                    { key: 'izin', val: 'I', label: 'Izin', desc: 'Izin resmi disahkan', color: 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300' },
                    { key: 'alfa', val: 'A', label: 'Alfa', desc: 'Mangkir / tanpa kabar', color: 'bg-red-50 hover:bg-red-100 text-red-900 border-red-300' },
                    { key: 'off', val: '0', label: 'OFF', desc: 'Jadwal lepas / libur', color: 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300' },
                  ].map((opt) => {
                    const isSelected = selectedAttStatus === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSelectedAttStatus(opt.key)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'ring-2 ring-emerald-600 border-emerald-600 bg-emerald-50/80 shadow-sm'
                            : `${opt.color} opacity-80 hover:opacity-100`
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-black">{opt.val}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <div className="mt-1">
                          <span className="font-bold text-xs block leading-tight">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground block leading-tight">{opt.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Keterangan / Catatan Tambahan (Opsional):</Label>
                <Input
                  type="text"
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  placeholder="Contoh: Rekonsiliasi Kehadiran Manual Oktober 2026..."
                  className="h-9 text-xs rounded-xl mt-1"
                />
              </div>

              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Perubahan status kehadiran akan langsung disimpan ke database PostgreSQL dan memperbarui total hari kerja pada matriks ini secara real-time.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAttEditOpen(false)}
                className="rounded-xl text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAttendance}
                disabled={isSavingAtt}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1 font-bold shadow-sm"
              >
                <Save size={13} /> {isSavingAtt ? 'Menyimpan...' : 'Simpan Status Kehadiran'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

