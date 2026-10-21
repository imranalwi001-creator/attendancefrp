import React, { useState, useMemo, useRef } from 'react';
import { UserProfile, AttendanceRecord, OvertimeRecord, Shift } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';
import {
  Printer,
  FileSpreadsheet,
  Calendar,
  User,
  Clock,
  Sparkles,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import * as XLSX from 'xlsx';

interface HrmAbsenSplModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: UserProfile[];
  initialUserId?: string;
  initialMonth?: string; // Format 'YYYY-MM'
  attendances: AttendanceRecord[];
  overtimes: OvertimeRecord[];
  shifts?: Shift[];
}

export const HrmAbsenSplModal: React.FC<HrmAbsenSplModalProps> = ({
  isOpen,
  onClose,
  employees,
  initialUserId,
  initialMonth,
  attendances,
  overtimes,
  shifts = [],
}) => {
  // Current Date Helper
  const now = new Date();
  const defaultMonthStr = initialMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Selection States
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || employees[0]?.id || '');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Selected Employee
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedUserId) || employees[0] || null;
  }, [employees, selectedUserId]);

  // Form Configurable Metadata
  const [regu, setRegu] = useState<string>('REGU 1');
  const [polaShift, setPolaShift] = useState<string>('SIFT NORMAL ( 2/1/3)');
  const [seksi, setSeksi] = useState<string>('Sec. of Shipment Management 2');
  const [unit, setUnit] = useState<string>('Unit of Outbond Inventory I & IV');
  const [departemen, setDepartemen] = useState<string>('Dept. of Distribution Management');
  const [kaurName, setKaurName] = useState<string>('Bpk. Kaur Operasional');

  // Sync default employee metadata when employee changes
  React.useEffect(() => {
    if (selectedEmployee) {
      if (selectedEmployee.divisionName) {
        setDepartemen(selectedEmployee.divisionName);
      }
      if (selectedEmployee.kepalaReguName) {
        setKaurName(selectedEmployee.kepalaReguName);
      }
      if (selectedEmployee.operationalGroup) {
        setRegu(selectedEmployee.operationalGroup);
      }
    }
  }, [selectedEmployee]);

  // Available Month List (Past 12 Months + Future 2 Months)
  const availableMonths = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const base = new Date();
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    for (let i = -2; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      list.push({ value: val, label: lbl });
    }
    return list;
  }, []);

  // Compute Days of Selected Month and Populate Full Data Rows
  const monthDaysData = useMemo(() => {
    if (!selectedMonth || !selectedEmployee) return [];

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed

    const daysInMonth = new Date(year, month, 0).getDate();
    const rows = [];

    // Today tracker for realtime indicator
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentHourMinute = today.getHours() * 60 + today.getMinutes();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, day);
      const dayOfWeek = dayDate.getDay(); // 0 is Sunday
      const isSunday = dayOfWeek === 0;
      const isToday = dateStr === todayStr;

      // Find attendance for this employee & date
      const att = attendances.find(
        (a) => a.userId === selectedEmployee.id && a.attendanceDate === dateStr
      );

      // Find overtime for this employee & date
      const ot = overtimes.find(
        (o) => o.userId === selectedEmployee.id && o.date === dateStr && o.status !== 'rejected'
      );

      // ─── Format Clock In & Out ───
      let clockInDisplay = '-';
      let clockOutDisplay = '-';
      let lateMinutesDisplay = '-';
      let isLate = false;
      let isRealtimeLate = false;
      let realtimeLateMinutes = 0;
      let statusBadge = '-';

      if (att) {
        clockInDisplay = att.clockIn ? att.clockIn.slice(0, 5) : '-';
        clockOutDisplay = att.clockOut ? att.clockOut.slice(0, 5) : (att.clockIn ? 'Aktif' : '-');
        statusBadge = att.status ? att.status.toUpperCase() : 'HADIR';

        // Check Lateness
        const rawLate = Number(att.lateMinutes) || 0;
        if (rawLate > 0) {
          isLate = true;
          lateMinutesDisplay = `${rawLate} mnt`;
        } else if (att.clockIn) {
          lateMinutesDisplay = '0 mnt';
        }

        if (att.status === 'sakit') {
          clockInDisplay = 'SAKIT';
          clockOutDisplay = 'SAKIT';
          statusBadge = 'SAKIT';
        } else if (att.status === 'izin') {
          clockInDisplay = 'IZIN';
          clockOutDisplay = 'IZIN';
          statusBadge = 'IZIN';
        } else if (att.status === 'cuti') {
          clockInDisplay = 'CUTI';
          clockOutDisplay = 'CUTI';
          statusBadge = 'CUTI';
        } else if (att.status === 'alpha') {
          clockInDisplay = 'ALPHA';
          clockOutDisplay = 'ALPHA';
          statusBadge = 'ALPHA';
        }
      } else {
        // If no attendance recorded
        if (isSunday) {
          clockInDisplay = 'OFF';
          clockOutDisplay = 'OFF';
          statusBadge = 'OFF';
        } else if (isToday) {
          // REALTIME CHECK: Shift starts at 07:30 (450 mins). If now > 07:45 and not clocked in:
          const shiftStartMins = 7 * 60 + 30; // 07:30 WITA
          if (currentHourMinute > shiftStartMins) {
            realtimeLateMinutes = currentHourMinute - shiftStartMins;
            isRealtimeLate = true;
            statusBadge = 'BELUM ABSEN';
          } else {
            statusBadge = 'HARI INI';
          }
        } else if (dayDate < today) {
          // Past working day without attendance
          statusBadge = 'OFF';
          clockInDisplay = 'OFF';
          clockOutDisplay = 'OFF';
        } else {
          // Future day
          statusBadge = '-';
        }
      }

      // ─── Format Overtime ───
      const otStart = ot?.startTime ? ot.startTime.slice(0, 5) : '-';
      const otEnd = ot?.endTime ? ot.endTime.slice(0, 5) : '-';
      const otHours = ot?.durationHours != null ? `${Number(ot.durationHours).toFixed(1)} Jam` : '-';
      const otTask = ot?.taskDescription || (ot ? 'Tugas Lembur Operasional' : '-');
      const otApprover = ot?.approvedByName || (ot ? kaurName : '-');
      const otNotes = ot?.status === 'approved' ? 'Disetujui' : (ot?.status === 'pending' ? 'Menunggu' : '-');

      rows.push({
        no: day,
        dateFormatted: `${day}-${month}-${year}`,
        dayName: dayDate.toLocaleDateString('id-ID', { weekday: 'short' }),
        clockIn: clockInDisplay,
        clockOut: clockOutDisplay,
        lateMinutes: isRealtimeLate ? `+${realtimeLateMinutes}m (Live)` : lateMinutesDisplay,
        isLate,
        isRealtimeLate,
        otStart,
        otEnd,
        otHours,
        otTask,
        otApprover,
        ket: otNotes !== '-' ? `${statusBadge} / SPL ${otNotes}` : statusBadge,
      });
    }

    return rows;
  }, [selectedMonth, selectedEmployee, attendances, overtimes, kaurName]);

  // Aggregate Statistics
  const summary = useMemo(() => {
    let totalHadir = 0;
    let totalOff = 0;
    let totalSakitIzinCuti = 0;
    let lateCount = 0;
    let totalLateMinutes = 0;
    let totalOtHours = 0;

    monthDaysData.forEach((row) => {
      if (row.clockIn !== '-' && row.clockIn !== 'OFF' && row.clockIn !== 'SAKIT' && row.clockIn !== 'IZIN' && row.clockIn !== 'CUTI') {
        totalHadir++;
      } else if (row.clockIn === 'OFF') {
        totalOff++;
      } else if (['SAKIT', 'IZIN', 'CUTI'].includes(row.clockIn)) {
        totalSakitIzinCuti++;
      }

      if (row.isLate) {
        lateCount++;
        const mins = parseInt(row.lateMinutes, 10) || 0;
        totalLateMinutes += mins;
      }
      if (row.otHours !== '-') {
        totalOtHours += parseFloat(row.otHours) || 0;
      }
    });

    return {
      totalHadir,
      totalOff,
      totalSakitIzinCuti,
      lateCount,
      totalLateMinutes,
      totalOtHours: totalOtHours.toFixed(1),
    };
  }, [monthDaysData]);

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Handle Excel Export (.xlsx)
  const handleExportExcel = () => {
    if (!selectedEmployee) return;

    // Build worksheet data matching exactly the physical document structure
    const wsData: any[][] = [];

    // 1. Header Titles
    wsData.push(['', '', '', '', 'PT. FAWWAZ RESKI PERWIRA', '', '', '', `REGU : ${regu}`]);
    wsData.push(['', '', '', '', 'ABSEN/SPL', '', '', '', '']);
    wsData.push([]);

    // 2. Metadata Columns
    wsData.push([`NAMA        : ${selectedEmployee.fullName}`, '', '', '', '', `SEKSI       : ${seksi}`, '', '', '']);
    wsData.push([`NO.ID       : ${selectedEmployee.nip}`, '', '', '', '', `UNIT        : ${unit}`, '', '', '']);
    wsData.push([`POLA SHIFT  : ${polaShift}`, '', '', '', '', `DEPARTEMEN  : ${departemen}`, '', '', '']);
    wsData.push([]);

    // 3. Table Header Row 1
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

    // 4. Table Header Row 2 (Sub-columns)
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

    // 5. Data Rows
    monthDaysData.forEach((r) => {
      wsData.push([
        r.no,
        r.dateFormatted,
        r.clockIn,
        r.clockOut,
        r.lateMinutes,
        r.otStart,
        r.otEnd,
        r.otHours,
        r.otTask,
        r.otApprover,
        r.ket,
      ]);
    });

    // 6. Summary Row
    wsData.push([]);
    wsData.push([
      'TOTAL REKAPITULASI:',
      `Hadir: ${summary.totalHadir} Hari`,
      `Libur/Off: ${summary.totalOff} Hari`,
      `Sakit/Izin/Cuti: ${summary.totalSakitIzinCuti} Hari`,
      `Total Telat: ${summary.lateCount}x (${summary.totalLateMinutes} Mnt)`,
      '',
      '',
      `Total Lembur: ${summary.totalOtHours} Jam`,
      '',
      '',
      '',
    ]);

    // 7. Signatures
    wsData.push([]);
    wsData.push(['', 'Karyawan / Pemohon,', '', '', 'Kepala Urusan (KAUR),', '', '', 'Kepala Departemen / Pimpinan,']);
    wsData.push([]);
    wsData.push([]);
    wsData.push([
      '',
      `( ${selectedEmployee.fullName} )`,
      '',
      '',
      `( ${kaurName} )`,
      '',
      '',
      '( Drs. Hendra Setiawan, M.M. )',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge Cells for physical look
    ws['!merges'] = [
      // Title
      { s: { r: 0, c: 4 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 7 } },
      // Headers
      { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // NO
      { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } }, // TANGGAL
      { s: { r: 6, c: 2 }, e: { r: 6, c: 4 } }, // ABSEN (MASUK, PULANG, TELAT)
      { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } }, // LEMBUR (MULAI, SELESAI)
      { s: { r: 6, c: 7 }, e: { r: 7, c: 7 } }, // REALISASI
      { s: { r: 6, c: 8 }, e: { r: 7, c: 8 } }, // URAIAN
      { s: { r: 6, c: 9 }, e: { r: 7, c: 9 } }, // KAUR
      { s: { r: 6, c: 10 }, e: { r: 7, c: 10 } }, // KET
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ABSEN_SPL');
    XLSX.writeFile(wb, `ABSEN_SPL_${selectedEmployee.nip}_${selectedMonth}.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[94vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-700 text-slate-100">
        
        {/* Modal Top Bar (Controls - Hidden in Print) */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">📋</span>
              Form ABSEN/SPL Resmi PT. Fawwaz Reski Perwira
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Format lembar presensi fisik, lembur kerja, dan pemantauan keterlambatan presisi & realtime.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="border-slate-600 bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs h-8"
            >
              <Settings2 className="w-3.5 h-3.5 mr-1 text-teal-400" />
              Sesuaikan Info Kop
              {showConfig ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="border-emerald-600/50 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs h-8"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Unduh Excel (.xlsx)
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs h-8 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Cetak Dokumen A4
            </Button>
          </div>
        </div>

        {/* Filter Selection Strip (Hidden in Print) */}
        <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-700/60 flex flex-wrap items-center gap-4 text-xs no-print">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-teal-400" /> Karyawan:
            </span>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[260px] h-8 text-xs bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue placeholder="Pilih Karyawan" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 max-h-60">
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs focus:bg-slate-700">
                    {emp.fullName} ({emp.nip}) - {emp.divisionName || 'Operasional'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-400" /> Periode Bulan:
            </span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                {availableMonths.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs focus:bg-slate-700">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Metrics Bar */}
          <div className="ml-auto flex items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
              Hadir: {summary.totalHadir} Hari
            </span>
            <span className="text-amber-300 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50">
              Telat: {summary.lateCount}x ({summary.totalLateMinutes} mnt)
            </span>
            <span className="text-sky-300 font-semibold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
              Lembur: {summary.totalOtHours} Jam
            </span>
          </div>
        </div>

        {/* Optional Collapsible Metadata Config (Hidden in Print) */}
        {showConfig && (
          <div className="p-4 bg-slate-800/60 border-b border-slate-700/60 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs no-print animate-in fade-in duration-200">
            <div>
              <Label className="text-[11px] text-slate-300">REGU Kerja:</Label>
              <Input
                value={regu}
                onChange={(e) => setRegu(e.target.value)}
                className="h-7 text-xs bg-slate-900 border-slate-700 text-white mt-1"
                placeholder="misal: REGU 1 / REGU TONASA"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-300">Pola Shift:</Label>
              <Input
                value={polaShift}
                onChange={(e) => setPolaShift(e.target.value)}
                className="h-7 text-xs bg-slate-900 border-slate-700 text-white mt-1"
                placeholder="misal: SIFT NORMAL ( 2/1/3)"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-300">Seksi (Section):</Label>
              <Input
                value={seksi}
                onChange={(e) => setSeksi(e.target.value)}
                className="h-7 text-xs bg-slate-900 border-slate-700 text-white mt-1"
                placeholder="misal: Sec. of Shipment Management 2"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-300">Unit Kerja:</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-7 text-xs bg-slate-900 border-slate-700 text-white mt-1"
                placeholder="misal: Unit of Outbond Inventory I & IV"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-300">Departemen:</Label>
              <Input
                value={departemen}
                onChange={(e) => setDepartemen(e.target.value)}
                className="h-7 text-xs bg-slate-900 border-slate-700 text-white mt-1"
                placeholder="misal: Dept. of Distribution Management"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-300">Nama KAUR (Pemberi Perintah):</Label>
              <Input
                value={kaurName}
                onChange={(e) => setKaurName(e.target.value)}
                className="h-7 text-xs bg-slate-900 border-slate-700 text-white mt-1"
                placeholder="misal: Bpk. Kaur Operasional"
              />
            </div>
          </div>
        )}

        {/* Scrollable Paper Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950/70">
          
          {/* THE PHYSICAL PAPER REPLICA CONTAINER (Print Area) */}
          <div
            id="printable-absen-spl"
            className="max-w-[950px] mx-auto bg-white text-slate-900 p-6 md:p-8 rounded shadow-2xl font-sans border border-slate-300 text-[11px]"
            style={{ minHeight: '1100px' }}
          >
            {/* Header: Company Title & REGU */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex-1 text-center pl-16">
                <h1 className="text-lg md:text-xl font-black tracking-wider text-slate-950 uppercase font-serif">
                  PT. FAWWAZ RESKI PERWIRA
                </h1>
                <p className="text-xs md:text-sm font-bold tracking-widest text-slate-800 underline uppercase mt-0.5">
                  ABSEN/SPL
                </p>
              </div>
              <div className="text-right w-36">
                <span className="text-xs md:text-sm font-bold font-serif uppercase tracking-wide">
                  REGU : {regu}
                </span>
              </div>
            </div>

            {/* Metadata Grid (Left & Right Boxes) */}
            <div className="grid grid-cols-2 gap-4 border border-slate-900 p-2 mb-3 text-[11px] font-medium leading-relaxed">
              {/* Left Column */}
              <div className="space-y-0.5">
                <div className="flex">
                  <span className="w-28 font-bold">NAMA</span>
                  <span className="w-3">:</span>
                  <span className="font-bold uppercase text-slate-950">
                    {selectedEmployee?.fullName || '-'}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold">NO.ID</span>
                  <span className="w-3">:</span>
                  <span className="font-mono font-bold text-slate-950">
                    {selectedEmployee?.nip || '-'}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold">POLA SHIFT</span>
                  <span className="w-3">:</span>
                  <span className="font-semibold uppercase text-slate-800">
                    {polaShift}
                  </span>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-0.5">
                <div className="flex">
                  <span className="w-28 font-bold">SEKSI</span>
                  <span className="w-3">:</span>
                  <span className="text-slate-800">{seksi}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold">UNIT</span>
                  <span className="w-3">:</span>
                  <span className="text-slate-800">{unit}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold">DEPARTEMEN</span>
                  <span className="w-3">:</span>
                  <span className="text-slate-800 font-semibold">{departemen}</span>
                </div>
              </div>
            </div>

            {/* The Main ABSEN/SPL Table with Option A Sub-Column */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-900 text-center text-[10px]">
                <thead>
                  {/* Top Header Row */}
                  <tr className="bg-slate-100 font-bold border-b border-slate-900">
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-1 w-8">
                      NO
                    </th>
                    <th rowSpan={2} className="border border-slate-900 py-1.5 px-2 w-20">
                      TANGGAL
                    </th>
                    {/* ABSEN GROUP (COLSPAN 3 -> MASUK, PULANG, TELAT) */}
                    <th colSpan={3} className="border border-slate-900 py-1 px-2 bg-slate-200">
                      ABSEN
                    </th>
                    {/* LEMBUR GROUP (COLSPAN 2 -> MULAI, SELESAI) */}
                    <th colSpan={2} className="border border-slate-900 py-1 px-2 bg-slate-200">
                      LEMBUR
                    </th>
                    <th rowSpan={2} className="border border-slate-900 py-1 px-1.5 w-16">
                      REALISASI JAM LEMBUR
                    </th>
                    <th rowSpan={2} className="border border-slate-900 py-1 px-2 text-left">
                      URAIAN PEKERJAAN
                    </th>
                    <th rowSpan={2} className="border border-slate-900 py-1 px-2 w-24">
                      MEMERINTAHKAN<br />
                      <span className="font-normal text-[9px] uppercase">(KAUR)</span>
                    </th>
                    <th rowSpan={2} className="border border-slate-900 py-1 px-1 w-16">
                      KET.
                    </th>
                  </tr>
                  {/* Sub Header Row */}
                  <tr className="bg-slate-100 font-bold border-b border-slate-900 text-[9.5px]">
                    <th className="border border-slate-900 py-1 px-1 w-12">MASUK</th>
                    <th className="border border-slate-900 py-1 px-1 w-12">PULANG</th>
                    <th className="border border-slate-900 py-1 px-1 w-14 text-amber-800 bg-amber-50">
                      TELAT (MNT)
                    </th>
                    <th className="border border-slate-900 py-1 px-1 w-12">MULAI</th>
                    <th className="border border-slate-900 py-1 px-1 w-12">SELESAI</th>
                  </tr>
                </thead>

                <tbody>
                  {monthDaysData.map((row) => {
                    const isOff = row.clockIn === 'OFF';
                    const hasLate = row.isLate;
                    const isLive = row.isRealtimeLate;

                    return (
                      <tr
                        key={row.no}
                        className={`border-b border-slate-400 hover:bg-slate-50 transition-colors ${
                          isOff ? 'bg-slate-50/70 text-slate-400' : ''
                        }`}
                      >
                        <td className="border border-slate-900 py-1 font-mono font-medium">
                          {row.no}
                        </td>
                        <td className="border border-slate-900 py-1 font-mono font-semibold whitespace-nowrap">
                          {row.dateFormatted}
                        </td>
                        
                        {/* ABSEN MASUK */}
                        <td className={`border border-slate-900 py-1 font-mono font-bold ${isOff ? 'text-slate-400' : 'text-slate-900'}`}>
                          {row.clockIn}
                        </td>
                        
                        {/* ABSEN PULANG */}
                        <td className={`border border-slate-900 py-1 font-mono font-bold ${isOff ? 'text-slate-400' : 'text-slate-900'}`}>
                          {row.clockOut}
                        </td>

                        {/* OPSI A: TELAT (MNT) PRESISI & REALTIME */}
                        <td
                          className={`border border-slate-900 py-1 font-mono font-bold ${
                            hasLate
                              ? 'bg-amber-100/90 text-amber-900 font-black'
                              : isLive
                              ? 'bg-rose-100 text-rose-800 font-black animate-pulse'
                              : 'text-slate-400'
                          }`}
                        >
                          {row.lateMinutes}
                        </td>

                        {/* LEMBUR MULAI & SELESAI */}
                        <td className="border border-slate-900 py-1 font-mono">
                          {row.otStart}
                        </td>
                        <td className="border border-slate-900 py-1 font-mono">
                          {row.otEnd}
                        </td>

                        {/* REALISASI JAM */}
                        <td className="border border-slate-900 py-1 font-mono font-bold text-slate-950">
                          {row.otHours}
                        </td>

                        {/* URAIAN PEKERJAAN */}
                        <td className="border border-slate-900 py-1 px-2 text-left truncate max-w-[180px]">
                          {row.otTask}
                        </td>

                        {/* MEMERINTAHKAN (KAUR) */}
                        <td className="border border-slate-900 py-1 px-1 font-medium truncate max-w-[100px]">
                          {row.otApprover}
                        </td>

                        {/* KET. */}
                        <td className="border border-slate-900 py-1 px-1 text-[9px] font-semibold">
                          {row.ket}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer: Summary Stats */}
                <tfoot>
                  <tr className="bg-slate-200 font-bold border-t-2 border-slate-900 text-[10px]">
                    <td colSpan={2} className="border border-slate-900 py-2 text-center uppercase">
                      TOTAL REKAP:
                    </td>
                    <td className="border border-slate-900 py-2 text-emerald-800">
                      {summary.totalHadir} Hadir
                    </td>
                    <td className="border border-slate-900 py-2 text-slate-600">
                      {summary.totalOff} OFF
                    </td>
                    <td className="border border-slate-900 py-2 text-amber-900 bg-amber-100 font-black">
                      {summary.lateCount}x ({summary.totalLateMinutes}m)
                    </td>
                    <td colSpan={2} className="border border-slate-900 py-2 text-slate-500">
                      -
                    </td>
                    <td className="border border-slate-900 py-2 text-sky-900 font-black">
                      {summary.totalOtHours} Jam
                    </td>
                    <td colSpan={3} className="border border-slate-900 py-2 text-left px-2 font-normal text-[9px] text-slate-600">
                      * Data presensi dan durasi lembur diverifikasi sistem secara sah & mutlak.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Official Signatures Block (Bottom Section) */}
            <div className="mt-8 pt-4 grid grid-cols-3 gap-6 text-center text-xs font-serif">
              <div>
                <p className="font-semibold text-slate-700">Karyawan / Pemohon,</p>
                <div className="h-16"></div>
                <p className="font-bold underline uppercase text-slate-950">
                  ( {selectedEmployee?.fullName || '...........................'} )
                </p>
                <p className="text-[10px] font-mono text-slate-600">
                  NIP: {selectedEmployee?.nip || '-'}
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Kepala Urusan (KAUR),</p>
                <div className="h-16"></div>
                <p className="font-bold underline uppercase text-slate-950">
                  ( {kaurName || '...........................'} )
                </p>
                <p className="text-[10px] text-slate-600">Pemberi Perintah</p>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Kepala Departemen / Pimpinan,</p>
                <div className="h-16"></div>
                <p className="font-bold underline uppercase text-slate-950">
                  ( Drs. Hendra Setiawan, M.M. )
                </p>
                <p className="text-[10px] text-slate-600">Manajemen PT FRP</p>
              </div>
            </div>

            {/* Official Watermark / Footer Stamp */}
            <div className="mt-6 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>Sistem Manajemen Kehadiran & SPL Elektronik PT. Fawwaz Reski Perwira</span>
              <span>Dicetak Pada: {new Date().toLocaleString('id-ID')} WITA</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
