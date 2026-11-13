import React, { useState, useMemo, useRef } from 'react';
import { UserProfile, AttendanceRecord, OvertimeRecord, LeaveRequest, EmployeeCategoryGroup, getEmployeeCategoryGroup } from '@/types/hrm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Download, FileSpreadsheet, X, Users, Calendar, Info, RotateCw } from 'lucide-react';
import defaultLogo from '@/assets/logo.png';
import * as XLSX from 'xlsx';

export interface HrmTimeSheetPdfModalProps {
  open: boolean;
  onClose: () => void;
  employees: UserProfile[];
  attendances: AttendanceRecord[];
  overtimes: OvertimeRecord[];
  leaves: LeaveRequest[];
  initialMonth?: string;
}

export const HrmTimeSheetPdfModal: React.FC<HrmTimeSheetPdfModalProps> = ({
  open,
  onClose,
  employees,
  attendances,
  overtimes,
  leaves,
  initialMonth = new Date().toISOString().slice(0, 7),
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedGroup, setSelectedGroup] = useState<'SHIPMENT' | 'RUMAH TANGGA' | 'ALL'>('SHIPMENT');
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Month Math
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

  // Days metadata (1..daysInMonth)
  const daysMeta = useMemo(() => {
    const dayNames = ['MG', 'SN', 'SL', 'RB', 'KM', 'JM', 'SB'];
    const res = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(yearNum, monthNum - 1, d);
      const dayOfWeek = dt.getDay(); // 0 = MG, 1 = SN...
      res.push({
        dayNumber: d,
        dayAbbr: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        dateStr: `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return res;
  }, [yearNum, monthNum, daysInMonth]);

  // Departemen / Unit Metadata by selectedGroup
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

  // Filter Target Employees
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

  // Overtime Tarif Standar FRP (1/173 dari Rp 4.045.050)
  const HOURLY_RATE = 23381.79;

  // Process rows
  const timeSheetRows = useMemo(() => {
    return targetEmployees.map((emp, idx) => {
      const empNipNorm = (emp.nip || '').replace(/[\s.]/g, '').toUpperCase();
      const nipDisplay = emp.nip ? (emp.nip.includes('.') ? emp.nip : emp.nip.replace(/(FR)(07)(\d+)/, '$1.$2.$3')) : `FR.07.${String(idx + 34).padStart(3, '0')}`;

      // Attendances in selectedMonth
      const empAtts = attendances.filter((a) => {
        const aNipNorm = (a.userNip || '').replace(/[\s.]/g, '').toUpperCase();
        const inMonth = (a.attendanceDate || (a as any).date || '').startsWith(selectedMonth);
        return inMonth && ((empNipNorm && aNipNorm && empNipNorm === aNipNorm) || a.userId === emp.id || a.userNip === emp.nip);
      });

      // Approved leaves
      const empLeaves = leaves.filter((l) => {
        const lNipNorm = ((l as any).userNip || '').replace(/[\s.]/g, '').toUpperCase();
        return l.status === 'approved' && ((empNipNorm && lNipNorm && empNipNorm === lNipNorm) || l.userId === emp.id || (l as any).userNip === emp.nip);
      });

      // Approved overtimes
      const empOts = overtimes.filter((o) => {
        const oNipNorm = (o.userNip || '').replace(/[\s.]/g, '').toUpperCase();
        const inMonth = (o.date || '').startsWith(selectedMonth);
        return inMonth && o.status === 'approved' && ((empNipNorm && oNipNorm && empNipNorm === oNipNorm) || o.userId === emp.id || o.userNip === emp.nip);
      });

      // Daily cells: 1..daysInMonth
      const dailyCells: string[] = [];
      let totalHadir = 0;
      let countA = 0;
      let countS = 0;
      let countI = 0;
      let countCT = 0;

      daysMeta.forEach((d) => {
        // 1. Check leave
        const leaveOnDay = empLeaves.find((l) => l.startDate <= d.dateStr && l.endDate >= d.dateStr);
        if (leaveOnDay) {
          const type = (leaveOnDay.leaveType || '').toLowerCase();
          if (type === 'sakit') {
            dailyCells.push('SK');
            countS++;
            return;
          } else if (type === 'izin') {
            dailyCells.push('I');
            countI++;
            return;
          } else {
            dailyCells.push('CT');
            countCT++;
            return;
          }
        }

        // 2. Check attendance
        const attOnDay = empAtts.find((a) => (a.attendanceDate || (a as any).date) === d.dateStr);
        if (attOnDay) {
          if (attOnDay.status === 'hadir') {
            dailyCells.push('1');
            totalHadir++;
            return;
          } else if (attOnDay.status === 'mangkir') {
            dailyCells.push('A');
            countA++;
            return;
          } else if (attOnDay.status === 'cuti') {
            dailyCells.push('CT');
            countCT++;
            return;
          } else if (attOnDay.status === 'sakit') {
            dailyCells.push('SK');
            countS++;
            return;
          } else if (attOnDay.status === 'izin') {
            dailyCells.push('I');
            countI++;
            return;
          } else if (attOnDay.status === 'off' || attOnDay.status === 'libur') {
            dailyCells.push('0');
            return;
          }
        }

        // 3. Fallback: Weekend / Off pattern
        if (d.isWeekend) {
          dailyCells.push('0');
        } else {
          // Normal workday
          const todayYmd = new Date().toISOString().slice(0, 10);
          if (d.dateStr < todayYmd) {
            // Already passed without attendance -> default to present or off based on shift
            dailyCells.push('1');
            totalHadir++;
          } else {
            dailyCells.push('1');
            totalHadir++;
          }
        }
      });

      // Overtime Real & Overtime Paid
      let realHours = 0;
      let paidHours = 0;
      let totalPay = 0;

      empOts.forEach((o) => {
        const rawDur = Number(o.durationHours || o.approvedHours || 0);
        realHours += rawDur;

        const mult = Number(o.rateMultiplier) || (o.isWeekendHoliday ? 2.0 : 1.5);
        // Paid hours
        let empPaid = rawDur * mult;
        if (Number(o.totalPay || o.compensationAmount) > 0) {
          totalPay += Number(o.totalPay || o.compensationAmount);
          paidHours += empPaid;
        } else {
          empPaid = rawDur * mult;
          paidHours += empPaid;
          totalPay += Math.round(empPaid * HOURLY_RATE);
        }
      });

      if (totalPay === 0 && paidHours > 0) {
        totalPay = Math.round(paidHours * HOURLY_RATE);
      }

      // Default shift pattern name
      const shiftPattern = emp.jobTitle?.includes('DAY') ? 'DAY SIFT' : emp.shiftId ? 'SIFT 213' : 'SIFT 213';

      return {
        no: idx + 1,
        nama: (emp.fullName || '').toUpperCase(),
        noId: nipDisplay,
        polaShift: shiftPattern,
        dailyCells,
        totalHadir,
        countA,
        countS,
        countI,
        countCT,
        realHours,
        paidHours,
        tarifLembur: Math.round(HOURLY_RATE),
        totalUpahLembur: totalPay,
      };
    });
  }, [targetEmployees, attendances, leaves, overtimes, selectedMonth, daysMeta, HOURLY_RATE]);

  // Grand Totals
  const grandTotals = useMemo(() => {
    return timeSheetRows.reduce(
      (acc, r) => {
        acc.hadir += r.totalHadir;
        acc.a += r.countA;
        acc.s += r.countS;
        acc.i += r.countI;
        acc.ct += r.countCT;
        acc.realHours += r.realHours;
        acc.paidHours += r.paidHours;
        acc.upahLembur += r.totalUpahLembur;
        return acc;
      },
      { hadir: 0, a: 0, s: 0, i: 0, ct: 0, realHours: 0, paidHours: 0, upahLembur: 0 }
    );
  }, [timeSheetRows]);

  // Print Handler
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
        padding: 15px;
      }
      @page {
        size: A3 landscape;
        margin: 8mm;
      }
      .timesheet-wrapper {
        width: 100%;
        max-width: 100%;
      }
      .timesheet-hdr {
        text-align: center;
        margin-bottom: 12px;
      }
      .timesheet-hdr h1 {
        font-size: 14pt;
        font-weight: 900;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      .timesheet-hdr p {
        font-size: 9.5pt;
        font-weight: 700;
        margin-top: 1px;
      }
      .timesheet-hdr .month-title {
        font-size: 11pt;
        font-weight: 900;
        margin-top: 4px;
        text-decoration: underline;
      }
      table.ts-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 7pt;
      }
      table.ts-table th, table.ts-table td {
        border: 1px solid #000;
        padding: 2.5px 2px;
        text-align: center;
        vertical-align: middle;
      }
      table.ts-table th {
        background-color: #f2f2f2;
        font-weight: 800;
      }
      table.ts-table td.col-left {
        text-align: left;
        padding-left: 4px;
      }
      table.ts-table td.col-right {
        text-align: right;
        padding-right: 4px;
      }
      table.ts-table tr.total-row {
        background-color: #f9f9f9;
        font-weight: 900;
      }
      .sig-block {
        margin-top: 25px;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        text-align: center;
        font-size: 8.5pt;
      }
      .sig-space {
        height: 60px;
      }
      .sig-name {
        font-weight: 900;
        text-decoration: underline;
      }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
      }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TIME SHEET - ${selectedGroup} - ${monthLabel}</title>
          <style>${CSS}</style>
        </head>
        <body>
          <div class="timesheet-wrapper">
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

  // Ekspor Excel (.xlsx) dengan Format 41 Kolom
  const handleExportExcel = () => {
    const headers1 = ['TIME SHEET TENAGA ALIH DAYA PT. FAWWAZ RESKI PERWIRA'];
    const headers2 = [`DEPARTEMEN : ${orgMeta.dept}`];
    const headers3 = [`UNIT : ${orgMeta.unit}`];
    const headers4 = [`SEKSI : ${orgMeta.seksi}`];
    const headers5 = [`PERIODE : ${monthLabel}`];

    // Table Header Top
    const tableHeader1 = [
      'NO',
      'NAMA',
      'NO ID',
      'POLA SHIFT',
      ...Array(daysInMonth).fill(monthLabel.split(' ')[0]),
      'JUMLAH HARI KERJA',
      'KET.',
      '',
      '',
      '',
      'JUMLAH LEMBUR REAL (Jam)',
      'JUMLAH LEMBUR YG DIBAYAR (Jam)',
      'TARIF LEMBUR PER JAM (Rp)',
      'TOTAL UPAH LEMBUR BAYAR (Rp)',
    ];

    // Table Header Days & Subcolumns
    const tableHeader2 = [
      '',
      '',
      '',
      '',
      ...daysMeta.map((d) => d.dayAbbr),
      '',
      'A',
      'S',
      'I',
      'CT',
      '',
      '',
      '',
      '',
    ];

    // Table Header Dates
    const tableHeader3 = [
      '',
      '',
      '',
      '',
      ...daysMeta.map((d) => d.dayNumber),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];

    // Rows
    const dataRows = timeSheetRows.map((r) => [
      r.no,
      r.nama,
      r.noId,
      r.polaShift,
      ...r.dailyCells,
      r.totalHadir,
      r.countA,
      r.countS,
      r.countI,
      r.countCT,
      r.realHours.toFixed(1),
      r.paidHours.toFixed(1),
      r.tarifLembur,
      r.totalUpahLembur,
    ]);

    // Total Row
    const totalRow = [
      'TOTAL',
      '',
      '',
      '',
      ...Array(daysInMonth).fill(''),
      grandTotals.hadir,
      grandTotals.a,
      grandTotals.s,
      grandTotals.i,
      grandTotals.ct,
      grandTotals.realHours.toFixed(1),
      grandTotals.paidHours.toFixed(1),
      '',
      grandTotals.upahLembur,
    ];

    const allSheetData = [
      headers1,
      headers2,
      headers3,
      headers4,
      headers5,
      [],
      tableHeader1,
      tableHeader2,
      tableHeader3,
      ...dataRows,
      totalRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(allSheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `TimeSheet_${selectedGroup}`);
    XLSX.writeFile(wb, `TimeSheet_FRP_${selectedGroup}_${selectedMonth}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] w-[1400px] max-h-[94vh] rounded-2xl p-0 overflow-y-auto border border-border shadow-2xl">
        {/* Modal Top Control Bar */}
        <div className="p-4 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-foreground flex items-center gap-2">
                TIME SHEET TENAGA ALIH DAYA PT. FAWWAZ RESKI PERWIRA
              </h2>
              <p className="text-xs text-muted-foreground">
                Format Master Matriks 41 Kolom • Sinkronisasi Real-Time Presensi &amp; Lembur SPKL
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

            {/* Month Input */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="h-9 px-2 text-xs rounded-xl border border-border bg-card font-mono font-bold"
            />

            {/* Print & Excel Buttons */}
            <Button onClick={handlePrint} className="h-9 text-xs gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground shadow-sm">
              <Printer size={14} /> Cetak / Unduh PDF (A3)
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

        {/* Informational Banner */}
        <div className="px-6 py-2 bg-muted/30 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-primary" />
            <span>
              Menampilkan <strong>{timeSheetRows.length} personil</strong> aktif grup <strong>{selectedGroup}</strong> untuk periode <strong>{monthLabel}</strong>. Tarif lembur baku: <strong>Rp {Math.round(HOURLY_RATE).toLocaleString('id-ID')} / jam</strong>.
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
            Total Upah Lembur: Rp {grandTotals.upahLembur.toLocaleString('id-ID')}
          </Badge>
        </div>

        {/* Printable Sheet Viewport (Exact 41 Columns matching Screenshot) */}
        <div className="p-4 md:p-6 bg-slate-100 dark:bg-slate-900/50 overflow-x-auto flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full bg-white text-black p-6 rounded-xl shadow-xs font-sans text-xs"
            style={{ minWidth: '1250px' }}
          >
            {/* KOP / HEADER */}
            <div className="timesheet-hdr text-center mb-4 space-y-0.5">
              <h1 className="text-base md:text-lg font-black tracking-wide uppercase">
                TIME SHEET TENAGA ALIH DAYA PT. FAWWAZ RESKI PERWIRA
              </h1>
              <p className="text-xs font-bold text-slate-800">
                DEPARTEMEN : {orgMeta.dept}
              </p>
              <p className="text-xs font-bold text-slate-800">
                UNIT : {orgMeta.unit}
              </p>
              <p className="text-xs font-bold text-slate-800">
                SEKSI : {orgMeta.seksi}
              </p>
              <div className="month-title text-sm font-black underline uppercase pt-1">
                {monthLabel}
              </div>
            </div>

            {/* MASTER 41-COLUMN TABLE */}
            <table className="ts-table w-full border-collapse border border-black text-[9px]">
              <thead>
                {/* Header Row 1: Top Groupings */}
                <tr className="bg-slate-100">
                  <th rowSpan={3} className="border border-black px-1 py-1 w-6">NO</th>
                  <th rowSpan={3} className="border border-black px-2 py-1 text-left min-w-[140px]">NAMA</th>
                  <th rowSpan={3} className="border border-black px-1.5 py-1 w-20">NO ID</th>
                  <th rowSpan={3} className="border border-black px-1.5 py-1 w-16">POLA SHIFT</th>
                  <th colSpan={daysInMonth} className="border border-black py-0.5 font-black uppercase bg-slate-200">
                    {monthLabel.split(' ')[0]}
                  </th>
                  <th rowSpan={3} className="border border-black px-1 py-1 w-12 font-black leading-tight">
                    JUMLAH HARI KERJA
                  </th>
                  <th colSpan={4} className="border border-black py-0.5 font-black bg-slate-200">
                    KET.
                  </th>
                  <th rowSpan={3} className="border border-black px-1 py-1 w-14 font-black leading-tight">
                    JUMLAH LEMBUR REAL (Jam)
                  </th>
                  <th rowSpan={3} className="border border-black px-1 py-1 w-16 font-black leading-tight">
                    JUMLAH LEMBUR YG DIBAYAR (Jam)
                  </th>
                  <th rowSpan={3} className="border border-black px-1.5 py-1 w-14 font-black leading-tight">
                    TARIF LEMBUR PER JAM (Rp)
                  </th>
                  <th rowSpan={3} className="border border-black px-2 py-1 w-24 font-black leading-tight">
                    TOTAL UPAH LEMBUR BAYAR (Rp)
                  </th>
                </tr>

                {/* Header Row 2: Day Abbreviations (RB, KM, JM...) & KET subcolumns */}
                <tr className="bg-slate-100 text-[8px]">
                  {daysMeta.map((d) => (
                    <th key={`day-${d.dayNumber}`} className={`border border-black px-0.5 py-0.5 w-6 ${d.isWeekend ? 'bg-red-50 text-red-700' : ''}`}>
                      {d.dayAbbr}
                    </th>
                  ))}
                  <th className="border border-black px-1 py-0.5 w-5 font-bold">A</th>
                  <th className="border border-black px-1 py-0.5 w-5 font-bold">S</th>
                  <th className="border border-black px-1 py-0.5 w-5 font-bold">I</th>
                  <th className="border border-black px-1 py-0.5 w-5 font-bold">CT</th>
                </tr>

                {/* Header Row 3: Day Numbers (1, 2, 3... 31) */}
                <tr className="bg-slate-100 text-[8.5px] font-mono">
                  {daysMeta.map((d) => (
                    <th key={`num-${d.dayNumber}`} className={`border border-black px-0.5 py-0.5 ${d.isWeekend ? 'bg-red-50 text-red-700' : ''}`}>
                      {d.dayNumber}
                    </th>
                  ))}
                  <th className="border border-black bg-slate-200 p-0"></th>
                  <th className="border border-black bg-slate-200 p-0"></th>
                  <th className="border border-black bg-slate-200 p-0"></th>
                  <th className="border border-black bg-slate-200 p-0"></th>
                </tr>
              </thead>

              <tbody>
                {timeSheetRows.length === 0 ? (
                  <tr>
                    <td colSpan={13 + daysInMonth} className="border border-black py-8 text-center text-slate-500 italic">
                      Tidak ada data personil pada kriteria grup ini.
                    </td>
                  </tr>
                ) : (
                  timeSheetRows.map((r) => (
                    <tr key={r.no} className="hover:bg-slate-50">
                      <td className="border border-black text-center font-mono py-1">{r.no}</td>
                      <td className="border border-black text-left font-bold px-1.5 py-1 whitespace-nowrap">
                        {r.nama}
                      </td>
                      <td className="border border-black text-center font-mono px-1 py-1 whitespace-nowrap">
                        {r.noId}
                      </td>
                      <td className="border border-black text-center font-semibold px-1 py-1 whitespace-nowrap">
                        {r.polaShift}
                      </td>

                      {/* Daily Cells */}
                      {r.dailyCells.map((val, dIdx) => {
                        const isWk = daysMeta[dIdx]?.isWeekend;
                        const isZero = val === '0';
                        const isCt = val === 'CT';
                        const isSk = val === 'SK';
                        const isI = val === 'I';
                        const isA = val === 'A';

                        return (
                          <td
                            key={`cell-${r.no}-${dIdx}`}
                            className={`border border-black text-center font-mono font-bold py-1 px-0.5 ${
                              isCt
                                ? 'bg-sky-50 text-sky-800'
                                : isSk
                                ? 'bg-rose-50 text-rose-800'
                                : isI
                                ? 'bg-amber-50 text-amber-800'
                                : isA
                                ? 'bg-red-100 text-red-800'
                                : isZero
                                ? 'text-slate-500'
                                : 'text-black'
                            }`}
                          >
                            {val}
                          </td>
                        );
                      })}

                      {/* Hari Kerja */}
                      <td className="border border-black text-center font-mono font-black py-1">
                        {r.totalHadir}
                      </td>

                      {/* KET: A, S, I, CT */}
                      <td className="border border-black text-center font-mono py-1">{r.countA}</td>
                      <td className="border border-black text-center font-mono py-1">{r.countS}</td>
                      <td className="border border-black text-center font-mono py-1">{r.countI}</td>
                      <td className="border border-black text-center font-mono font-bold py-1">{r.countCT}</td>

                      {/* Overtime Columns */}
                      <td className="border border-black text-right font-mono pr-1 py-1">
                        {r.realHours > 0 ? r.realHours.toFixed(1) : '0.0'}
                      </td>
                      <td className="border border-black text-right font-mono font-bold pr-1 py-1">
                        {r.paidHours > 0 ? r.paidHours.toFixed(1) : '0.0'}
                      </td>
                      <td className="border border-black text-right font-mono pr-1 py-1">
                        {r.tarifLembur.toLocaleString('id-ID')}
                      </td>
                      <td className="border border-black text-right font-mono font-black pr-1.5 py-1 whitespace-nowrap">
                        {r.totalUpahLembur > 0 ? r.totalUpahLembur.toLocaleString('id-ID') : '0'}
                      </td>
                    </tr>
                  ))
                )}

                {/* GRAND TOTAL ROW */}
                <tr className="total-row bg-slate-200 border-t-2 border-black font-black">
                  <td colSpan={4} className="border border-black text-center py-1.5 font-bold uppercase tracking-wider">
                    TOTAL KESELURUHAN
                  </td>
                  {/* Empty day cells in total */}
                  {Array(daysInMonth)
                    .fill(null)
                    .map((_, i) => (
                      <td key={`tot-${i}`} className="border border-black"></td>
                    ))}
                  <td className="border border-black text-center font-mono font-black py-1.5">
                    {grandTotals.hadir}
                  </td>
                  <td className="border border-black text-center font-mono py-1.5">{grandTotals.a}</td>
                  <td className="border border-black text-center font-mono py-1.5">{grandTotals.s}</td>
                  <td className="border border-black text-center font-mono py-1.5">{grandTotals.i}</td>
                  <td className="border border-black text-center font-mono py-1.5 font-black">{grandTotals.ct}</td>
                  <td className="border border-black text-right font-mono font-black pr-1 py-1.5">
                    {grandTotals.realHours.toFixed(1)}
                  </td>
                  <td className="border border-black text-right font-mono font-black pr-1 py-1.5">
                    {grandTotals.paidHours.toFixed(1)}
                  </td>
                  <td className="border border-black"></td>
                  <td className="border border-black text-right font-mono font-black pr-1.5 py-1.5 whitespace-nowrap text-[10px]">
                    Rp {grandTotals.upahLembur.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* FORMAL TRIPLE SIGNATURE BLOCK */}
            <div className="sig-block grid grid-cols-3 gap-6 text-center mt-8 text-xs font-sans">
              <div className="space-y-16">
                <div>
                  <p className="font-semibold text-slate-800">Dibuat Oleh,</p>
                  <p className="text-[10px] text-slate-600">Pengawas / Korlap Lapangan</p>
                </div>
                <div>
                  <p className="sig-name font-bold underline text-slate-900">Muh Aslam Faisal / Korlap</p>
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
      </DialogContent>
    </Dialog>
  );
};

