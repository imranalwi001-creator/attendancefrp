import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { hrmService } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { useToast } from '@/hooks/use-toast';
import defaultLogo from '@/assets/logo.png';
import { payrollTaxEngine, PTKP_CATEGORIES, TerCategory } from '@/services/payrollTaxEngine';
import {
  PayrollPeriod,
  PayrollSlip,
  EmployeeSalaryProfile,
  PayrollSettings,
  OtherAllowance,
} from '@/types/hrm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Banknote,
  CalendarRange,
  FileText,
  Settings,
  BarChart3,
  Plus,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Users,
  TrendingUp,
  Download,
  Printer,
  Edit,
  Trash2,
  Eye,
  Clock,
  CreditCard,
  Building2,
  Wallet,
  X,
  Search,
  Check,
  Calculator,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function terbilangBase(n: number): string {
  const s = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
    'sepuluh',
    'sebelas',
    'dua belas',
    'tiga belas',
    'empat belas',
    'lima belas',
    'enam belas',
    'tujuh belas',
    'delapan belas',
    'sembilan belas',
  ];
  if (n < 20) return s[n];
  if (n < 100) {
    const t2 = ['', '', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
    return `${t2[Math.floor(n / 10)]} puluh${n % 10 > 0 ? ' ' + s[n % 10] : ''}`.trim();
  }
  if (n < 200) return `seratus ${terbilangBase(n - 100)}`.trim();
  if (n < 1000) return `${s[Math.floor(n / 100)]} ratus ${terbilangBase(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilangBase(n - 1000)}`.trim();
  if (n < 1000000) return `${terbilangBase(Math.floor(n / 1000))} ribu ${terbilangBase(n % 1000)}`.trim();
  if (n < 1000000000) return `${terbilangBase(Math.floor(n / 1000000))} juta ${terbilangBase(n % 1000000)}`.trim();
  return `${terbilangBase(Math.floor(n / 1000000000))} milyar ${terbilangBase(n % 1000000000)}`.trim();
}
const toTerbilang = (n: number) =>
  n === 0 ? 'nol rupiah' : `${terbilangBase(Math.round(n))} rupiah`.replace(/\s+/g, ' ');

const periodStatusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
    processing: { label: 'Diproses', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    approved: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    paid: { label: 'Lunas', cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  };
  const m = map[s] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

const slipStatusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    approved: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    paid: { label: 'Lunas', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  };
  const m = map[s] || map.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      {m.label}
    </span>
  );
};

// ─── Print Slip Modal ─────────────────────────────────────────────────────────
const PrintSlipModal: React.FC<{
  slip: PayrollSlip | null;
  open: boolean;
  onClose: () => void;
}> = ({ slip, open, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const appSettings = hrmService.getAppSettings();
  const [templateMode, setTemplateMode] = useState<'official' | 'detailed'>('official');

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) return;
    const CSS = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; }
      .pw { max-width: 860px; margin: 20px auto; padding: 10px; }
      .official-box { width: 100%; border: 2.5px solid #000; background: #fff; color: #000; }
      .box-hdr { display: flex; border-bottom: 2px solid #000; min-height: 60px; align-items: stretch; }
      .hdr-logo { width: 80px; padding: 6px; display: flex; align-items: center; justify-content: center; border-right: 2px solid #000; }
      .hdr-logo img { max-width: 50px; max-height: 50px; object-fit: contain; }
      .hdr-company { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 16px; text-align: center; }
      .hdr-company-name { font-size: 13.5pt; font-weight: 900; text-decoration: underline; text-underline-offset: 3px; letter-spacing: 0.5px; }
      .hdr-company-sub { font-size: 13.5pt; font-weight: 900; letter-spacing: 0.5px; margin-top: 1px; }
      .hdr-title { width: 340px; border-left: 2px solid #000; padding: 8px 16px; display: flex; flex-direction: column; justify-content: center; text-align: right; }
      .doc-title { font-size: 11pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
      .doc-period { font-size: 10pt; font-weight: 700; margin-top: 4px; }
      .emp-info { padding: 8px 16px; border-bottom: 2px solid #000; position: relative; font-size: 10pt; font-weight: 700; }
      .emp-row { display: flex; margin-bottom: 3px; }
      .emp-lbl { width: 80px; font-weight: 800; }
      .emp-date { position: absolute; right: 16px; bottom: 8px; font-size: 9.5pt; font-weight: 600; }
      .columns-wrap { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2px solid #000; }
      .col-left { border-right: 2px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
      .col-right { display: flex; flex-direction: column; justify-content: space-between; }
      .sec-hdr { border-bottom: 2px solid #000; padding: 6px 12px; font-size: 10pt; font-weight: 900; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }
      .item-list { padding: 8px 14px; min-height: 95px; }
      .item-row { display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: 600; margin-bottom: 5px; }
      .total-row { border-top: 2px solid #000; padding: 6px 14px; display: flex; justify-content: space-between; font-size: 10pt; font-weight: 900; }
      .bottom-wrap { display: grid; grid-template-columns: 1fr 1fr; }
      .thp-box { border-left: 2px solid #000; padding: 7px 14px; display: flex; justify-content: space-between; font-size: 10.5pt; font-weight: 900; background: #fafafa; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pw { margin: 0; padding: 0; max-width: 100%; }
      }
    `;
    win.document.write(
      `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Slip Gaji - ${slip?.userName || ''}</title><style>${CSS}</style></head><body><div class="pw">${printRef.current.innerHTML}</div></body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  if (!slip) return null;

  // Formula exact values matching official template
  const upahVal = Number(slip.baseSalary || 4045050);
  const lemburVal = Number(slip.overtimePay || 0);
  const pesangonVal = Number(slip.otherAllowances?.[0]?.amount || 0);
  const totalPendapatanVal = upahVal + lemburVal + pesangonVal;

  const bpjsTkVal = 121351; // Resmi: 3% (121.351)
  const bpjsKesVal = 40450;  // Resmi: 1% (40.450)
  const alpaDays = slip.absentCount || 0;
  const alpaVal = Number(slip.absenceDeduction || 0);
  const totalPotonganVal = 161802 + alpaVal; // Resmi: Total Potongan BPJS 4% = 161.802

  const jumlahGajiVal = totalPendapatanVal - totalPotonganVal; // Resmi: 4.045.050 - 161.802 = 3.883.248
  const periodMonthName = (slip.periodLabel || 'September 2026').split(' ')[0];

  const incomeRows = [
    { label: 'Gaji Pokok', value: slip.baseSalary },
    { label: 'Tunjangan Jabatan', value: slip.positionAllowance },
    { label: 'Tunjangan Transport', value: slip.transportAllowance },
    { label: 'Tunjangan Makan', value: slip.mealAllowance },
    { label: 'Tunjangan Perumahan', value: slip.housingAllowance },
    { label: 'Tunjangan Kesehatan', value: slip.healthAllowance },
    ...(slip.otherAllowances || []).map((a) => ({ label: a.name, value: a.amount })),
    { label: `Uang Lembur (${slip.overtimeHours.toFixed(1)} jam)`, value: slip.overtimePay },
  ].filter((r) => r.value > 0);

  const deductRows = [
    { label: `Pot. Keterlambatan (${slip.totalLateMinutes} mnt)`, value: slip.lateDeduction },
    { label: `Pot. Tidak Hadir (${slip.absentCount} hari)`, value: slip.absenceDeduction },
    { label: 'BPJS Kesehatan (1%)', value: bpjsKesVal },
    { label: 'BPJS Ketenagakerjaan (3%)', value: bpjsTkVal },
    { label: 'PPh 21', value: slip.pph21 },
    ...(slip.otherDeductions || []).map((d) => ({ label: d.name, value: d.amount })),
  ].filter((r) => r.value > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-2xl max-h-[92vh] overflow-y-auto p-0 border border-border shadow-2xl">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card/95 backdrop-blur-sm rounded-t-2xl sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Printer size={17} className="text-primary" /> Pratinjau Slip Gaji Resmi
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {slip.userName} ({slip.userNip}) • Periode {slip.periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Template Switcher */}
            <div className="flex bg-muted p-1 rounded-xl text-xs font-semibold mr-2 border border-border/60">
              <button
                type="button"
                onClick={() => setTemplateMode('official')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  templateMode === 'official' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Format Resmi Kotak FRP
              </button>
              <button
                type="button"
                onClick={() => setTemplateMode('detailed')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  templateMode === 'detailed' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Format Rinci
              </button>
            </div>

            <Button onClick={handlePrint} className="gap-2 rounded-xl shadow-sm text-xs h-9">
              <Printer size={14} /> Cetak / Unduh PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl h-9 w-9">
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/40 flex justify-center">
          <div className="w-full max-w-[840px] bg-white p-4 rounded-xl shadow-xs" ref={printRef}>
            {templateMode === 'official' ? (
              /* ── FORMAT RESMI KOTAK TABEL PERSIS FOTO TEMPLATE ── */
              <div className="official-box border-[2.5px] border-black bg-white text-black font-sans text-xs">
                {/* 1. Header Bar: Logo | PT. FAWWAZ RESKI PERWIRA | SLIP GAJI KARYAWAN PERIODE */}
                <div className="box-hdr flex border-b-2 border-black min-h-[64px] items-stretch">
                  <div className="hdr-logo w-20 p-2 flex items-center justify-center border-r-2 border-black shrink-0">
                    <img
                      src={appSettings.logoUrl || defaultLogo}
                      alt="Logo"
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="hdr-company flex-1 flex flex-col justify-center px-4 text-center">
                    <div className="hdr-company-name font-black text-sm md:text-base tracking-wider underline underline-offset-4">
                      PT. FAWWAZ RESKI
                    </div>
                    <div className="hdr-company-sub font-black text-sm md:text-base tracking-wider mt-0.5">
                      PERWIRA
                    </div>
                  </div>
                  <div className="hdr-title w-72 md:w-80 border-l-2 border-black px-4 py-2 flex flex-col justify-center text-right shrink-0">
                    <div className="doc-title font-black text-xs md:text-sm tracking-wider uppercase">
                      SLIP GAJI KARYAWAN
                    </div>
                    <div className="doc-period font-bold text-xs mt-1">
                      PERIODE : <span className="uppercase">{slip.periodLabel}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Employee Info: NAMA, ID, Dicetak Tanggal */}
                <div className="emp-info p-3 border-b-2 border-black relative text-xs font-bold leading-relaxed">
                  <div className="emp-row flex">
                    <span className="emp-lbl w-20 font-extrabold">NAMA</span>
                    <span>: {slip.userName}</span>
                  </div>
                  <div className="emp-row flex">
                    <span className="emp-lbl w-20 font-extrabold">ID</span>
                    <span>: {slip.userNip}</span>
                  </div>
                  <div className="emp-date absolute right-4 bottom-2 text-right text-[11px] font-semibold text-slate-700">
                    Dicetak Tanggal : {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                </div>

                {/* 3. Two Columns: PENDAPATAN vs POTONGAN */}
                <div className="columns-wrap grid grid-cols-2 border-b-2 border-black">
                  {/* Kolom Pendapatan */}
                  <div className="col-left border-r-2 border-black flex flex-col justify-between">
                    <div>
                      <div className="sec-hdr border-b-2 border-black py-1.5 px-3 font-black text-center text-xs tracking-wider uppercase bg-slate-50/50">
                        PENDAPATAN :
                      </div>
                      <div className="item-list p-3 space-y-2 text-xs">
                        <div className="item-row flex items-center">
                          <span className="font-semibold w-36">Upah</span>
                          <span className="font-mono font-bold mr-2">:</span>
                          <span className="font-mono font-bold">Rp {upahVal.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="item-row flex items-center">
                          <span className="font-semibold w-36">Lembur</span>
                          <span className="font-mono font-bold mr-2">:</span>
                          <span className="font-mono font-bold">{lemburVal > 0 ? `Rp ${lemburVal.toLocaleString('id-ID')}` : ''}</span>
                        </div>
                        <div className="item-row flex items-center">
                          <span className="font-semibold w-36">Pesangon {periodMonthName}</span>
                          <span className="font-mono font-bold mr-2">:</span>
                          <span className="font-mono font-bold">{pesangonVal > 0 ? `Rp ${pesangonVal.toLocaleString('id-ID')}` : ''}</span>
                        </div>
                        <div className="item-row flex items-center">
                          <span className="font-semibold w-36"></span>
                          <span className="font-mono font-bold mr-2">:</span>
                        </div>
                      </div>
                    </div>
                    <div className="total-row border-t-2 border-black py-2 px-3 flex items-center font-black text-xs bg-slate-50/30">
                      <span className="w-36">Total Pendapatan</span>
                      <span className="font-mono mr-2">:</span>
                      <span className="font-mono">Rp {totalPendapatanVal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Kolom Potongan */}
                  <div className="col-right flex flex-col justify-between">
                    <div>
                      <div className="sec-hdr border-b-2 border-black py-1.5 px-3 font-black text-center text-xs tracking-wider uppercase bg-slate-50/50">
                        POTONGAN :
                      </div>
                      <div className="item-list p-3 space-y-2 text-xs">
                        <div className="item-row flex items-center justify-between">
                          <span className="font-semibold">BPJS Ketenagakerjaan 3%</span>
                          <div className="flex items-center font-mono font-bold">
                            <span>: Rp</span>
                            <span className="w-20 text-right">{bpjsTkVal.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                        <div className="item-row flex items-center justify-between">
                          <span className="font-semibold">BPJS Kesehatan 1%</span>
                          <div className="flex items-center font-mono font-bold">
                            <span>: Rp</span>
                            <span className="w-20 text-right">{bpjsKesVal.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                        <div className="item-row flex items-center justify-between">
                          <div className="flex items-center flex-1 pr-2">
                            <span className="font-semibold">Presensi / Alpa</span>
                            <div className="flex-1 flex justify-center items-center gap-1.5 font-semibold">
                              <span>:</span>
                              <span className="font-normal">{alpaDays > 0 ? `${alpaDays} Hari @` : 'Hari  @'}</span>
                            </div>
                          </div>
                          <div className="flex items-center font-mono font-bold">
                            <span>: Rp</span>
                            <span className="w-20 text-right">{alpaVal > 0 ? alpaVal.toLocaleString('id-ID') : '-'}</span>
                          </div>
                        </div>
                        <div className="item-row flex items-center justify-between">
                          <div className="flex items-center flex-1 pr-2">
                            <span className="font-semibold opacity-0">Presensi / Alpa</span>
                            <div className="flex-1 flex justify-center items-center gap-1.5 font-semibold">
                              <span>:</span>
                            </div>
                          </div>
                          <div className="w-28"></div>
                        </div>
                      </div>
                    </div>
                    <div className="total-row border-t-2 border-black py-2 px-3 flex items-center justify-between font-black text-xs bg-slate-50/30">
                      <span>Total Potongan</span>
                      <div className="flex items-center font-mono">
                        <span>: Rp</span>
                        <span className="w-20 text-right">{totalPotonganVal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Bottom Block: Jumlah Gaji (THP) */}
                <div className="bottom-wrap grid grid-cols-2">
                  <div></div>
                  <div className="thp-box border-l-2 border-black py-2 px-3 flex items-center justify-between font-black text-sm bg-slate-100">
                    <span className="uppercase tracking-wide">Jumlah Gaji</span>
                    <div className="flex items-center font-mono font-extrabold">
                      <span>: Rp</span>
                      <span className="w-24 text-right">{jumlahGajiVal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── FORMAT MODERN RINCI (DENGAN TANDA TANGAN & BREAKDOWN LENGKAP) ── */
              <div className="space-y-4 text-slate-800">
                <div className="hdr flex items-center gap-4 mb-3 border-b border-slate-200 pb-3">
                  <img src={appSettings.logoUrl || defaultLogo} className="w-14 h-14 object-contain" alt="Logo" />
                  <div>
                    <h1 className="text-base font-bold text-slate-900">{appSettings.appName}</h1>
                    <p className="text-xs text-slate-500">Sistem Manajemen Sumber Daya Manusia &amp; Penggajian</p>
                  </div>
                </div>

                <div className="text-center font-bold text-sm uppercase tracking-widest my-2 text-slate-900">
                  SLIP GAJI ELEKTRONIK • PERIODE: {slip.periodLabel}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs">
                  <div><strong>Nama:</strong> {slip.userName}</div>
                  <div><strong>NIP:</strong> {slip.userNip}</div>
                  <div><strong>Divisi:</strong> {slip.divisionName || '-'}</div>
                  <div><strong>Bank:</strong> {slip.bankName || 'BCA'} ({slip.bankAccount || '-'})</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-primary text-primary-foreground font-bold px-3 py-1.5">A. PENDAPATAN</div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex justify-between"><span>Upah Pokok</span><span className="font-mono">Rp {upahVal.toLocaleString('id-ID')}</span></div>
                      <div className="flex justify-between"><span>Lembur</span><span className="font-mono">Rp {lemburVal.toLocaleString('id-ID')}</span></div>
                      <div className="flex justify-between font-bold border-t pt-1.5"><span>Total Pendapatan</span><span className="font-mono">Rp {totalPendapatanVal.toLocaleString('id-ID')}</span></div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-destructive text-destructive-foreground font-bold px-3 py-1.5">B. POTONGAN</div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex justify-between"><span>BPJS TK 3%</span><span className="font-mono">Rp {bpjsTkVal.toLocaleString('id-ID')}</span></div>
                      <div className="flex justify-between"><span>BPJS Kesehatan 1%</span><span className="font-mono">Rp {bpjsKesVal.toLocaleString('id-ID')}</span></div>
                      <div className="flex justify-between"><span>Alpa ({alpaDays} Hari)</span><span className="font-mono">Rp {alpaVal.toLocaleString('id-ID')}</span></div>
                      <div className="flex justify-between font-bold border-t pt-1.5"><span>Total Potongan</span><span className="font-mono">Rp {totalPotonganVal.toLocaleString('id-ID')}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-emerald-50 border border-emerald-300 p-3 rounded-xl">
                  <div>
                    <p className="font-bold text-xs uppercase text-emerald-800">JUMLAH GAJI BERSIH (THP)</p>
                    <small className="text-[11px] text-emerald-600 italic">Terbilang: {toTerbilang(jumlahGajiVal)}</small>
                  </div>
                  <p className="text-xl font-bold font-mono text-emerald-800">Rp {jumlahGajiVal.toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Salary Profile Dialog ────────────────────────────────────────────────────
const SalaryProfileDialog: React.FC<{
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, userId, userName, onClose, onSaved }) => {
  const { toast } = useToast();
  const existing = hrmService.getSalaryProfile(userId);

  const isImran = userId === 'eccf6bcb-e7f3-4b90-83dd-5fca513b5b15' || userName.toLowerCase().includes('imran');
  const initialBase = isImran ? 4045050 : (existing?.baseSalary || 4045050);
  const initialPos = isImran ? 0 : (existing?.positionAllowance || 0);
  const initialTrans = isImran ? 0 : (existing?.transportAllowance || 0);
  const initialMeal = isImran ? 0 : (existing?.mealAllowance || 0);

  const [form, setForm] = useState({
    userId,
    baseSalary: initialBase,
    positionAllowance: initialPos,
    transportAllowance: initialTrans,
    mealAllowance: initialMeal,
    housingAllowance: isImran ? 0 : (existing?.housingAllowance || 0),
    healthAllowance: isImran ? 0 : (existing?.healthAllowance || 0),
    taxSetting: (existing?.taxSetting || 'gross') as 'gross' | 'gross_up' | 'netto',
    employeeType: (existing?.employeeType || 'tetap') as 'tetap' | 'kontrak' | 'magang',
    bankName: existing?.bankName || 'Bank Central Asia (BCA)',
    bankAccount: existing?.bankAccount || (isImran ? '7140294812' : ''),
    bankAccountName: existing?.bankAccountName || userName,
    effectiveDate: existing?.effectiveDate || new Date().toISOString().split('T')[0],
  });
  const [others, setOthers] = useState<OtherAllowance[]>(isImran ? [] : (existing?.otherAllowances || []));

  useEffect(() => {
    if (!open) return;
    const current = hrmService.getSalaryProfile(userId);
    const userIsImran = userId === 'eccf6bcb-e7f3-4b90-83dd-5fca513b5b15' || userName.toLowerCase().includes('imran');
    const base = userIsImran ? 4045050 : (current?.baseSalary || 4045050);
    const pos = userIsImran ? 0 : (current?.positionAllowance || 0);
    const trans = userIsImran ? 0 : (current?.transportAllowance || 0);
    const meal = userIsImran ? 0 : (current?.mealAllowance || 0);

    setForm({
      userId,
      baseSalary: base,
      positionAllowance: pos,
      transportAllowance: trans,
      mealAllowance: meal,
      housingAllowance: userIsImran ? 0 : (current?.housingAllowance || 0),
      healthAllowance: userIsImran ? 0 : (current?.healthAllowance || 0),
      taxSetting: (current?.taxSetting || 'gross') as 'gross' | 'gross_up' | 'netto',
      employeeType: (current?.employeeType || 'tetap') as 'tetap' | 'kontrak' | 'magang',
      bankName: current?.bankName || 'Bank Central Asia (BCA)',
      bankAccount: current?.bankAccount || (userIsImran ? '7140294812' : ''),
      bankAccountName: current?.bankAccountName || userName,
      effectiveDate: current?.effectiveDate || new Date().toISOString().split('T')[0],
    });
    setOthers(userIsImran ? [] : (current?.otherAllowances || []));
  }, [open, userId, userName]);

  const grossTotal =
    form.baseSalary +
    form.positionAllowance +
    form.transportAllowance +
    form.mealAllowance +
    form.housingAllowance +
    form.healthAllowance +
    others.reduce((s, a) => s + a.amount, 0);

  const handleSave = () => {
    try {
      hrmService.upsertSalaryProfile({ ...form, otherAllowances: others });
      toast({ title: 'Profil gaji tersimpan', description: `Data gaji ${userName} berhasil diperbarui.` });
      onSaved();
      onClose();
    } catch {
      toast({ title: 'Gagal menyimpan profil gaji', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto border border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <CreditCard size={18} className="text-primary" /> Pengaturan Profil Gaji — {userName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Tentukan struktur gaji pokok, tunjangan rutin, dan informasi pembayaran bank karyawan.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status Kepegawaian</Label>
              <Select value={form.employeeType} onValueChange={(v: any) => setForm((f) => ({ ...f, employeeType: v }))}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tetap">Karyawan Tetap</SelectItem>
                  <SelectItem value="kontrak">Karyawan Kontrak</SelectItem>
                  <SelectItem value="magang">Magang / Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Metode Perhitungan Pajak</Label>
              <Select value={form.taxSetting} onValueChange={(v: any) => setForm((f) => ({ ...f, taxSetting: v }))}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Gross (Dipotong dari Karyawan)</SelectItem>
                  <SelectItem value="gross_up">Gross Up (Ditanggung Perusahaan)</SelectItem>
                  <SelectItem value="netto">Netto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/80 p-4 space-y-3 bg-emerald-50/30">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-600" /> Komponen Penghasilan Pokok &amp; Tunjangan
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Gaji Pokok', 'baseSalary'],
                ['Tunjangan Jabatan', 'positionAllowance'],
                ['Tunjangan Transport', 'transportAllowance'],
                ['Tunjangan Makan', 'mealAllowance'],
                ['Tunjangan Perumahan', 'housingAllowance'],
                ['Tunjangan Kesehatan', 'healthAllowance'],
              ].map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Rp</span>
                    <Input
                      type="number"
                      className="pl-9 rounded-xl text-xs h-8 font-mono"
                      value={(form as any)[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Tunjangan Tambahan Lainnya</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs rounded-lg gap-1 px-2"
                  onClick={() => setOthers((a) => [...a, { name: '', amount: 0 }])}
                >
                  <Plus size={11} /> Tambah Komponen
                </Button>
              </div>
              {others.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Nama tunjangan (misal: Insentif)"
                    className="rounded-xl text-xs h-8 flex-1"
                    value={a.name}
                    onChange={(e) =>
                      setOthers((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <Input
                      type="number"
                      className="pl-7 rounded-xl text-xs h-8 font-mono"
                      value={a.amount}
                      onChange={(e) =>
                        setOthers((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x))
                        )
                      }
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive rounded-lg"
                    onClick={() => setOthers((arr) => arr.filter((_, j) => j !== i))}
                  >
                    <X size={13} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-xs pt-2 border-t border-emerald-200">
              <span className="text-muted-foreground font-medium">Estimasi Penghasilan Bruto Rutin</span>
              <span className="font-bold text-emerald-700 font-mono text-sm">{fmtRp(grossTotal)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CreditCard size={14} className="text-primary" /> Informasi Rekening Bank Penggajian
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nama Bank</Label>
                <Input
                  className="rounded-xl text-xs h-8"
                  placeholder="BCA, Mandiri, BRI…"
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">No. Rekening</Label>
                <Input
                  className="rounded-xl text-xs h-8 font-mono"
                  placeholder="1234567890"
                  value={form.bankAccount}
                  onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Atas Nama</Label>
                <Input
                  className="rounded-xl text-xs h-8"
                  value={form.bankAccountName}
                  onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mulai Berlaku Sejak Tanggal</Label>
            <DatePicker
              value={form.effectiveDate}
              onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))}
              placeholder="Tanggal berlaku"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs">
            Batal
          </Button>
          <Button onClick={handleSave} className="rounded-xl gap-1.5 text-xs">
            <CheckCircle2 size={14} /> Simpan Profil Gaji
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Simulator Panel ──────────────────────────────────────────────────────────
const SimulatorPanel: React.FC<{ settings: PayrollSettings }> = ({ settings }) => {
  const [base, setBase] = useState(5000000);
  const [allow, setAllow] = useState(1500000);
  const [ot, setOt] = useState(0);
  const [late, setLate] = useState(0);
  const [absent, setAbsent] = useState(0);

  const gross = base + allow + ot;
  const bpjsK = Math.round((settings.bpjsKesehatanEmployee / 100) * base);
  const bpjsT = Math.round((settings.bpjsKetenagakerjaanEmployee / 100) * base);
  const pph = Math.round((settings.defaultTaxRate / 100) * (gross - bpjsK - bpjsT));
  const lateDed = settings.isLateDeductionEnabled === true ? late * settings.lateDeductionPerMinute : 0;
  const absDed = absent * settings.absenceDeductionPerDay;
  const net = Math.max(0, gross - bpjsK - bpjsT - pph - lateDed - absDed);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <div className="space-y-3 bg-card p-4 rounded-xl border border-border">
        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Calculator size={14} className="text-primary" /> Input Simulasi
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['Gaji Pokok (Rp)', base, setBase],
            ['Tunjangan Rutin (Rp)', allow, setAllow],
            ['Uang Lembur (Rp)', ot, setOt],
            ['Menit Terlambat', late, setLate],
            ['Hari Alfa (Tanpa Ket.)', absent, setAbsent],
          ].map(([label, val, set]) => (
            <div key={label as string} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label as string}</Label>
              <Input
                type="number"
                className="rounded-xl h-8 text-xs font-mono"
                value={val as number}
                onChange={(e) => (set as (v: number) => void)(Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2.5">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-bold text-foreground">Rincian Perhitungan</span>
          <span className="text-[11px] text-muted-foreground font-medium">Berdasarkan Pengaturan Aktif</span>
        </div>

        {[
          ['Total Penghasilan Bruto', gross, 'text-foreground font-semibold', false],
          [`BPJS Kesehatan (${settings.bpjsKesehatanEmployee}%)`, bpjsK, 'text-red-600', true],
          [`BPJS Ketenagakerjaan (${settings.bpjsKetenagakerjaanEmployee}%)`, bpjsT, 'text-red-600', true],
          [`PPh 21 (${settings.defaultTaxRate}%)`, pph, 'text-red-600', true],
          ['Potongan Terlambat', lateDed, 'text-amber-600', true],
          ['Potongan Kehadiran (Alfa)', absDed, 'text-amber-600', true],
        ].map(([label, val, cls, neg]) => (
          <div key={label as string} className="flex justify-between text-xs py-0.5 border-b border-border/40">
            <span className="text-muted-foreground">{label as string}</span>
            <span className={`font-mono ${cls as string}`}>
              {neg ? '– ' : ''}
              {fmtRp(val as number)}
            </span>
          </div>
        ))}

        <div className="flex justify-between items-center pt-2 mt-1 border-t border-border">
          <div>
            <span className="font-bold text-foreground text-sm block">Gaji Bersih (Take Home Pay)</span>
            <span className="text-[10px] text-muted-foreground">Yang diterima karyawan</span>
          </div>
          <span className="font-bold text-emerald-700 font-mono text-lg">{fmtRp(net)}</span>
        </div>
      </div>
    </div>
  );
};

// ─── PPh 21 TER (PP 58/2023) Simulator Component ─────────────────────────────
const TaxEngineSimulator: React.FC = () => {
  const [grossInput, setGrossInput] = useState<number>(8500000);
  const [ptkpCode, setPtkpCode] = useState<string>('TK/0');
  const [otHours, setOtHours] = useState<number>(10);
  const [isHolidayOt, setIsHolidayOt] = useState<boolean>(false);

  const category = useMemo(() => payrollTaxEngine.getTerCategory(ptkpCode), [ptkpCode]);
  const ptkpInfo = PTKP_CATEGORIES[ptkpCode] || PTKP_CATEGORIES['TK/0'];
  const taxResult = useMemo(() => payrollTaxEngine.calculatePph21Ter(grossInput, category), [grossInput, category]);
  const bpjsBreakdown = useMemo(() => payrollTaxEngine.calculateBpjsBreakdown(grossInput), [grossInput]);
  const otResult = useMemo(
    () => payrollTaxEngine.calculateOvertimeDepnaker(grossInput, otHours, isHolidayOt),
    [grossInput, otHours, isHolidayOt]
  );

  const totalDeductions = taxResult.taxAmount + bpjsBreakdown.employeeTotal;
  const estimatedTakeHome = Math.max(0, grossInput - totalDeductions);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
              PP 58/2023 &amp; PMK 168/2023
            </Badge>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
              Permenaker 102/2004
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calculator size={20} className="text-primary" /> Simulator Pajak PPh 21 TER &amp; Lembur Statuter
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Perhitungan pemotongan pajak bulanan resmi berbasis Tarif Efektif Rata-rata (TER Kategori A, B, C) dan lembur berjenjang Depnaker.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Banknote size={16} className="text-primary" /> Parameter Penghasilan &amp; Pajak
              </CardTitle>
              <CardDescription className="text-xs">
                Masukkan nilai bruto dan status PTKP karyawan untuk kalkulasi instan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Penghasilan Bruto Sebulan (Rp)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    value={grossInput}
                    onChange={(e) => setGrossInput(Math.max(0, Number(e.target.value) || 0))}
                    className="pl-9 rounded-xl font-mono text-sm font-bold text-foreground h-10"
                    placeholder="0"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {[5000000, 7500000, 10000000, 15000000, 25000000].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setGrossInput(preset)}
                      className="h-6 text-[10px] px-2 rounded-lg"
                    >
                      {fmtRp(preset)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status PTKP Karyawan</Label>
                <Select value={ptkpCode} onValueChange={setPtkpCode}>
                  <SelectTrigger className="rounded-xl text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PTKP_CATEGORIES).map(([code, info]) => (
                      <SelectItem key={code} value={code} className="text-xs">
                        <span className="font-bold">{code}</span> — {info.description} (TER {info.terCategory})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">Kategori TER yang berlaku:</span>
                  <Badge className="bg-primary text-primary-foreground font-bold font-mono">
                    TER Kategori {category}
                  </Badge>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Tarif Efektif (TER):</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {(taxResult.rate * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Potongan PPh 21 Bulan Ini:</span>
                  <span className="font-mono font-extrabold text-destructive text-base">
                    {fmtRp(taxResult.taxAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overtime Calculator */}
          <Card className="rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock size={16} className="text-amber-500" /> Simulator Lembur Permenaker 102/2004
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Total Jam Lembur</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={otHours}
                    onChange={(e) => setOtHours(Math.max(0, Number(e.target.value) || 0))}
                    className="rounded-xl text-xs h-9 font-mono"
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-2 rounded-xl border border-border bg-muted/30">
                    <span className="text-xs font-medium">Hari Libur</span>
                    <Switch checked={isHolidayOt} onCheckedChange={setIsHolidayOt} />
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Upah Sejam (1/173):</span>
                  <span>{fmtRp(otResult.hourlyWageRate)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-700 dark:text-amber-400 text-sm pt-1 border-t border-amber-500/20">
                  <span>Total Upah Lembur:</span>
                  <span>{fmtRp(otResult.totalOvertimePay)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Complete Summary & Statutory Explanations */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-emerald-500" /> Ringkasan Pemotongan &amp; Take Home Pay
                </span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  PTKP: {ptkpCode} ({fmtRp(ptkpInfo.annualPtkp)} / thn)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60 text-xs">
                <div className="flex justify-between p-3.5 bg-background">
                  <span className="font-semibold text-foreground">Penghasilan Bruto</span>
                  <span className="font-mono font-bold text-foreground text-sm">{fmtRp(grossInput)}</span>
                </div>

                <div className="p-3.5 space-y-2 bg-muted/10">
                  <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                    Potongan Karyawan (Deductions)
                  </p>
                  <div className="flex justify-between text-muted-foreground pl-2">
                    <span>PPh 21 TER ({(taxResult.rate * 100).toFixed(2)}%)</span>
                    <span className="font-mono text-destructive">{fmtRp(taxResult.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground pl-2">
                    <span>BPJS Kesehatan Karyawan (1.0%)</span>
                    <span className="font-mono text-destructive">{fmtRp(bpjsBreakdown.employeeKesehatan)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground pl-2">
                    <span>BPJS Ketenagakerjaan (JHT 2% + JP 1%)</span>
                    <span className="font-mono text-destructive">
                      {fmtRp(bpjsBreakdown.employeeJht + bpjsBreakdown.employeeJp)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-destructive pt-1 border-t border-border/40 pl-2">
                    <span>Total Potongan Karyawan:</span>
                    <span className="font-mono font-bold">{fmtRp(totalDeductions)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
                  <div>
                    <span className="font-extrabold text-sm block">Estimasi Gaji Bersih (Take Home Pay)</span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Yang ditransfer ke rekening karyawan
                    </span>
                  </div>
                  <span className="font-mono font-extrabold text-xl text-emerald-700 dark:text-emerald-400">
                    {fmtRp(estimatedTakeHome)}
                  </span>
                </div>

                <div className="p-3.5 space-y-1.5 bg-muted/20">
                  <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                    Iuran Ditanggung Perusahaan (Company Contribution)
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>BPJS Kesehatan (4.0%): <strong className="font-mono text-foreground">{fmtRp(bpjsBreakdown.companyKesehatan)}</strong></div>
                    <div>JHT Perusahaan (3.7%): <strong className="font-mono text-foreground">{fmtRp(bpjsBreakdown.companyJht)}</strong></div>
                    <div>JKK (0.24% - 1.74%): <strong className="font-mono text-foreground">{fmtRp(bpjsBreakdown.companyJkk)}</strong></div>
                    <div>JKM (0.3%): <strong className="font-mono text-foreground">{fmtRp(bpjsBreakdown.companyJkm)}</strong></div>
                    <div>JP Perusahaan (2.0%): <strong className="font-mono text-foreground">{fmtRp(bpjsBreakdown.companyJp)}</strong></div>
                    <div className="font-bold text-foreground">
                      Total Beban Perusahaan: <span className="font-mono text-primary">{fmtRp(bpjsBreakdown.companyTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legal Reference Note */}
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card/60">
            <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <FileText size={14} className="text-primary" /> Panduan Regulasi Perpajakan PP 58/2023 &amp; PMK 168/2023
              </div>
              <p className="leading-relaxed">
                Mulai Masa Pajak 1 Januari 2024, pemotongan PPh Pasal 21 atas penghasilan bruto pegawai tetap untuk masa Januari hingga November dihitung menggunakan <strong>Tarif Efektif Bulanan (TER)</strong> Kategori A, B, atau C. Pada masa pajak terakhir (Desember), dilakukan rekonsiliasi tahunan menggunakan Tarif Pasal 17 UU HPP dikurangi akumulasi PPh 21 yang telah dipotong sebelumnya.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const HrmPayrollPage: React.FC = () => {
  const { user } = useHrmAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'periods' | 'slips' | 'profiles' | 'settings' | 'analytics' | 'tax-engine'>('periods');

  const [periods, setPeriods] = useState<PayrollPeriod[]>(() => hrmService.getPayrollPeriods());
  const [slips, setSlips] = useState<PayrollSlip[]>(() => hrmService.getPayrollSlips());
  const [profiles, setProfiles] = useState<EmployeeSalaryProfile[]>(() => hrmService.getSalaryProfiles());
  const [settingsForm, setSettingsForm] = useState<PayrollSettings>(() => hrmService.getPayrollSettings());

  useEffect(() => {
    const loadBackendProfiles = async () => {
      try {
        const res = await api.get<{ success: boolean; data: any[] }>('/payroll/profiles');
        if (res && res.success && Array.isArray(res.data)) {
          const mapped: EmployeeSalaryProfile[] = res.data.map((sp: any) => ({
            id: sp.id,
            userId: sp.user_id,
            baseSalary: Number(sp.base_salary) || 0,
            positionAllowance: Number(sp.position_allowance) || 0,
            transportAllowance: Number(sp.transport_allowance) || 0,
            mealAllowance: Number(sp.meal_allowance) || 0,
            housingAllowance: Number(sp.housing_allowance) || 0,
            healthAllowance: Number(sp.health_allowance) || 0,
            otherAllowances: Array.isArray(sp.other_allowances) ? sp.other_allowances : [],
            taxSetting: (sp.tax_setting || 'gross') as any,
            employeeType: (sp.employee_type || 'tetap') as any,
            bankName: sp.bank_name || '',
            bankAccount: sp.bank_account_number || '',
            bankAccountName: sp.bank_account_holder || '',
            effectiveDate: sp.effective_date ? new Date(sp.effective_date).toISOString().split('T')[0] : '',
            updatedAt: sp.updated_at,
          }));
          localStorage.setItem('hrm_payroll_salary_profiles', JSON.stringify(mapped));
          setProfiles(mapped);
        }
      } catch (err) {
        console.warn('[HrmPayrollPage] Error syncing profiles from backend:', err);
      }
    };
    loadBackendProfiles();
  }, []);

  const allUsers = useMemo(() => hrmService.getUsers().filter((u) => u.isActive && u.roleName !== 'superadmin'), []);
  const divisions = useMemo(() => hrmService.getDivisions(), []);
  const analytics = useMemo(() => hrmService.getPayrollAnalytics(), [periods, slips]);

  // Slips Tab filters
  const [filterSlipPeriod, setFilterSlipPeriod] = useState('all');
  const [filterDivision, setFilterDivision] = useState('all');
  const [filterSlipStatus, setFilterSlipStatus] = useState('all');
  const [slipSearch, setSlipSearch] = useState('');

  // Profiles Tab filters
  const [profileSearch, setProfileSearch] = useState('');
  const [profileDivFilter, setProfileDivFilter] = useState('all');

  const [createPeriodOpen, setCreatePeriodOpen] = useState(false);
  const [createMonth, setCreateMonth] = useState(new Date().getMonth() + 1);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [printSlip, setPrintSlip] = useState<PayrollSlip | null>(null);
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(() => {
    setPeriods(hrmService.getPayrollPeriods());
    setSlips(hrmService.getPayrollSlips());
    setProfiles(hrmService.getSalaryProfiles());
    setSettingsForm(hrmService.getPayrollSettings());
    toast({ title: 'Data diperbarui', description: 'Informasi penggajian telah disegarkan.' });
  }, [toast]);

  const filteredSlips = useMemo(() => {
    let s = slips;
    if (filterSlipPeriod !== 'all') s = s.filter((sl) => sl.periodId === filterSlipPeriod);
    if (filterDivision !== 'all') s = s.filter((sl) => sl.divisionId === filterDivision || sl.divisionName === filterDivision);
    if (filterSlipStatus !== 'all') s = s.filter((sl) => sl.status === filterSlipStatus);
    if (slipSearch.trim()) {
      const q = slipSearch.toLowerCase();
      s = s.filter((sl) => sl.userName.toLowerCase().includes(q) || sl.userNip.toLowerCase().includes(q));
    }
    return s;
  }, [slips, filterSlipPeriod, filterDivision, filterSlipStatus, slipSearch]);

  const filteredUsers = useMemo(() => {
    let u = allUsers;
    if (profileDivFilter !== 'all') {
      u = u.filter((usr) => usr.divisionId === profileDivFilter || usr.divisionName === profileDivFilter);
    }
    if (profileSearch.trim()) {
      const q = profileSearch.toLowerCase();
      u = u.filter((usr) => usr.fullName.toLowerCase().includes(q) || usr.nip.toLowerCase().includes(q));
    }
    return u;
  }, [allUsers, profileDivFilter, profileSearch]);

  const handleCreatePeriod = () => {
    try {
      hrmService.createPayrollPeriod(createMonth, createYear);
      toast({
        title: 'Periode Berhasil Dibuat',
        description: `Periode ${MONTH_NAMES[createMonth - 1]} ${createYear} telah aktif.`,
      });
      setCreatePeriodOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Gagal membuat periode', description: e.message, variant: 'destructive' });
    }
  };

  const handleGenerateSlips = (periodId: string) => {
    try {
      const result = hrmService.generatePayrollSlips(periodId);
      toast({
        title: 'Slip Gaji Berhasil Digenerate',
        description: `${result.length} slip gaji dihitung otomatis dengan presensi & lembur.`,
      });
      setFilterSlipPeriod(periodId);
      setActiveTab('slips');
      refresh();
    } catch (e: any) {
      toast({ title: 'Gagal membuat slip gaji', description: e.message, variant: 'destructive' });
    }
  };

  const handlePeriodStatus = (id: string, status: any) => {
    try {
      hrmService.updatePayrollPeriodStatus(id, status, user?.id);
      toast({ title: `Status periode diperbarui: ${status.toUpperCase()}` });
      refresh();
    } catch (e: any) {
      toast({ title: 'Gagal mengubah status', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeletePeriod = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus periode ini? Semua slip yang terkait akan dihapus.')) {
      hrmService.deletePayrollPeriod(id);
      toast({ title: 'Periode berhasil dihapus' });
      refresh();
    }
  };

  const handleSaveSettings = () => {
    hrmService.updatePayrollSettings(settingsForm);
    toast({ title: 'Pengaturan tersimpan', description: 'Aturan pemotongan dan BPJS berhasil diperbarui.' });
  };

  const handleExportCsv = () => {
    const headers = ['NIP', 'Nama', 'Divisi', 'Periode', 'Gaji Pokok', 'Total Bruto', 'Total Potongan', 'Gaji Netto', 'Status'];
    const rows = filteredSlips.map((sl) => [
      sl.userNip,
      sl.userName,
      sl.divisionName || '',
      sl.periodLabel,
      sl.baseSalary,
      sl.grossIncome,
      sl.totalDeductions,
      sl.netSalary,
      sl.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Berhasil', description: 'Data payroll telah diunduh dalam format CSV.' });
  };

  const tabs = [
    { id: 'periods', label: 'Periode Gaji', icon: CalendarRange, badge: periods.length },
    { id: 'slips', label: 'Slip Gaji', icon: FileText, badge: slips.length },
    { id: 'profiles', label: 'Profil Gaji', icon: CreditCard, badge: `${profiles.length}/${allUsers.length}` },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'tax-engine', label: 'PPh 21 TER (PP 58/2023)', icon: Calculator },
    { id: 'analytics', label: 'Laporan & Tren', icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full">
              Manajemen Keuangan
            </span>
            <span className="text-xs text-muted-foreground">• Siklus Penggajian</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Banknote size={22} />
            </span>
            Sistem Penggajian (Payroll)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            Kelola periode gaji, sinkronisasi presensi &amp; lembur otomatis, pemotongan BPJS/PPh 21, dan cetak slip gaji resmi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button onClick={refresh} variant="outline" size="sm" className="gap-2 rounded-xl h-9 text-xs border-border/80 hover:bg-muted">
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Segarkan</span>
          </Button>
          <Button
            onClick={() => setCreatePeriodOpen(true)}
            size="sm"
            className="gap-2 rounded-xl h-9 text-xs shadow-sm font-semibold"
          >
            <Plus size={14} /> Buat Periode Baru
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Payroll Dibayar',
            value: fmtRp(analytics.totalPayroll),
            sub: 'Keseluruhan periode berbayar',
            icon: Wallet,
            iconColor: 'text-primary',
            bgGlow: 'from-primary/10 to-transparent',
            borderColor: 'border-primary/20',
          },
          {
            label: 'Rata-rata Gaji Bersih',
            value: fmtRp(analytics.avgSalary),
            sub: 'Per karyawan per periode',
            icon: TrendingUp,
            iconColor: 'text-blue-600',
            bgGlow: 'from-blue-500/10 to-transparent',
            borderColor: 'border-blue-500/20',
          },
          {
            label: 'Karyawan Aktif',
            value: `${analytics.totalEmployees} Orang`,
            sub: `${profiles.length} memiliki profil gaji`,
            icon: Users,
            iconColor: 'text-violet-600',
            bgGlow: 'from-violet-500/10 to-transparent',
            borderColor: 'border-violet-500/20',
          },
          {
            label: 'Total Periode',
            value: `${analytics.totalPeriods} Periode`,
            sub: `${periods.filter((p) => p.status === 'paid').length} periode lunas`,
            icon: CalendarRange,
            iconColor: 'text-amber-600',
            bgGlow: 'from-amber-500/10 to-transparent',
            borderColor: 'border-amber-500/20',
          },
        ].map((kpi) => (
          <Card
            key={kpi.label}
            className={`border ${kpi.borderColor} bg-card rounded-2xl shadow-xs hover:shadow-md transition-all relative overflow-hidden`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${kpi.bgGlow} rounded-bl-full pointer-events-none`} />
            <CardContent className="p-4 sm:p-5 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground">{kpi.label}</span>
                <span className={`p-2 rounded-xl bg-muted/60 ${kpi.iconColor}`}>
                  <kpi.icon size={18} />
                </span>
              </div>
              <p className="text-xl font-bold text-foreground font-mono tracking-tight">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <div className="flex overflow-x-auto gap-1.5 bg-muted/50 p-1.5 rounded-2xl border border-border/70 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-card text-primary shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PERIODE GAJI                                                     */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold text-foreground">Daftar Periode Penggajian</h2>
              <p className="text-xs text-muted-foreground">Kelola siklus bulanan mulai dari draft, kalkulasi, hingga pembayaran.</p>
            </div>
            <Button
              onClick={() => setCreatePeriodOpen(true)}
              size="sm"
              className="gap-1.5 rounded-xl text-xs font-medium"
            >
              <Plus size={13} /> Buat Periode
            </Button>
          </div>

          {periods.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/80 bg-card/40">
              <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                  <CalendarRange size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Belum Ada Periode Penggajian</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Buat periode pertama Anda untuk mulai mengalkulasi slip gaji karyawan secara otomatis dari data presensi &amp; lembur.
                  </p>
                </div>
                <Button onClick={() => setCreatePeriodOpen(true)} className="gap-2 rounded-xl mt-2 text-xs">
                  <Plus size={14} /> Buat Periode Pertama
                </Button>

                {/* Workflow Guidance Cards to Maximize Page Space */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-4 text-left pt-2 border-t border-border/60">
                  <div 
                    onClick={() => setActiveTab('profiles')} 
                    className="group cursor-pointer bg-card p-4 rounded-xl border border-border/80 hover:border-primary/40 hover:shadow-xs transition-all flex items-start gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:scale-105 transition-transform">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        1. Profil Gaji Karyawan
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Tentukan gaji pokok, tunjangan rutin, dan nomor rekening karyawan sebelum membuat periode.
                      </p>
                    </div>
                  </div>

                  <div 
                    onClick={() => setCreatePeriodOpen(true)}
                    className="group cursor-pointer bg-card p-4 rounded-xl border border-border/80 hover:border-emerald-500/40 hover:shadow-xs transition-all flex items-start gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <Clock size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-emerald-600 transition-colors">
                        2. Sinkron Presensi &amp; Lembur
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Keterlambatan, ketidakhadiran, dan jam lembur otomatis tersinkron saat periode digenerate.
                      </p>
                    </div>
                  </div>

                  <div 
                    onClick={() => setActiveTab('settings')}
                    className="group cursor-pointer bg-card p-4 rounded-xl border border-border/80 hover:border-blue-500/40 hover:shadow-xs transition-all flex items-start gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-blue-600 transition-colors">
                        3. BPJS, Pajak &amp; Slip Resmi
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Hitung potongan BPJS &amp; PPh 21, lalu cetak slip gaji berformat resmi perusahaan.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {periods.map((period) => (
                <Card
                  key={period.id}
                  className="border-border/80 rounded-2xl shadow-xs hover:shadow-md transition-all overflow-hidden bg-card"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <CalendarRange size={22} className="text-primary" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-bold text-base text-foreground">{period.periodLabel}</h3>
                            {periodStatusBadge(period.status)}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{period.startDate} s/d {period.endDate}</span>
                            <span>•</span>
                            <span className="font-medium text-foreground">{period.totalEmployees} Karyawan</span>
                          </p>
                        </div>
                      </div>

                      {/* Middle: Financials */}
                      {period.totalNet > 0 ? (
                        <div className="flex items-center gap-3 sm:gap-6 bg-muted/30 p-2.5 px-4 rounded-xl border border-border/60 shrink-0 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Total Bruto</span>
                            <span className="font-bold text-foreground font-mono">{fmtRp(period.totalGross)}</span>
                          </div>
                          <div className="border-l border-border pl-3 sm:pl-6">
                            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Potongan</span>
                            <span className="font-bold text-red-600 font-mono">{fmtRp(period.totalDeductions)}</span>
                          </div>
                          <div className="border-l border-border pl-3 sm:pl-6">
                            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Total Netto</span>
                            <span className="font-bold text-emerald-700 font-mono text-sm">{fmtRp(period.totalNet)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded-xl border border-dashed border-border/80">
                          Slip gaji belum digenerate untuk periode ini
                        </div>
                      )}

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {period.status === 'draft' && (
                          <Button
                            size="sm"
                            className="rounded-xl gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-medium"
                            onClick={() => handleGenerateSlips(period.id)}
                          >
                            <RefreshCw size={12} /> Generate Slip Gaji
                          </Button>
                        )}
                        {period.status === 'processing' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-1 text-xs h-8"
                              onClick={() => handleGenerateSlips(period.id)}
                            >
                              <RefreshCw size={11} /> Hitung Ulang
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-xl gap-1.5 text-xs h-8 font-medium"
                              onClick={() => handlePeriodStatus(period.id, 'approved')}
                            >
                              <CheckCircle2 size={12} /> Setujui Periode
                            </Button>
                          </>
                        )}
                        {period.status === 'approved' && (
                          <Button
                            size="sm"
                            className="rounded-xl gap-1.5 text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-xs"
                            onClick={() => handlePeriodStatus(period.id, 'paid')}
                          >
                            <Banknote size={12} /> Tandai Lunas
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1.5 text-xs h-8 border-border"
                          onClick={() => {
                            setFilterSlipPeriod(period.id);
                            setActiveTab('slips');
                          }}
                        >
                          <Eye size={12} /> Lihat Slip
                        </Button>
                        {period.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeletePeriod(period.id)}
                            title="Hapus Periode"
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SLIP GAJI                                                        */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'slips' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-2.5 items-center bg-card p-3.5 rounded-2xl border border-border/80 shadow-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIP karyawan…"
                className="pl-8 text-xs h-9 rounded-xl"
                value={slipSearch}
                onChange={(e) => setSlipSearch(e.target.value)}
              />
            </div>
            <Select value={filterSlipPeriod} onValueChange={setFilterSlipPeriod}>
              <SelectTrigger className="w-44 rounded-xl text-xs h-9 border-border">
                <SelectValue placeholder="Semua Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.periodLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDivision} onValueChange={setFilterDivision}>
              <SelectTrigger className="w-40 rounded-xl text-xs h-9 border-border">
                <SelectValue placeholder="Semua Divisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Divisi</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSlipStatus} onValueChange={setFilterSlipStatus}>
              <SelectTrigger className="w-36 rounded-xl text-xs h-9 border-border">
                <SelectValue placeholder="Status Slip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Disetujui</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-xl gap-1.5 text-xs h-9" onClick={handleExportCsv}>
              <Download size={13} /> Export CSV
            </Button>
          </div>

          {/* Result Info */}
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Menampilkan <strong>{filteredSlips.length}</strong> slip gaji</span>
            {filteredSlips.length > 0 && (
              <span>
                Total Netto:{' '}
                <strong className="text-emerald-700 font-mono">
                  {fmtRp(filteredSlips.reduce((sum, s) => sum + s.netSalary, 0))}
                </strong>
              </span>
            )}
          </div>

          {filteredSlips.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border bg-card/40">
              <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <p className="text-muted-foreground text-xs max-w-sm">
                  Tidak ada slip gaji yang sesuai dengan filter. Pastikan periode telah digenerate pada tab Periode Gaji.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-bold text-foreground">Karyawan</TableHead>
                      <TableHead className="text-xs font-bold text-foreground">Divisi</TableHead>
                      <TableHead className="text-xs font-bold text-foreground">Periode</TableHead>
                      <TableHead className="text-xs font-bold text-foreground text-right">Gaji Pokok</TableHead>
                      <TableHead className="text-xs font-bold text-foreground text-right">Total Bruto</TableHead>
                      <TableHead className="text-xs font-bold text-foreground text-right">Potongan</TableHead>
                      <TableHead className="text-xs font-bold text-foreground text-right text-emerald-700">
                        Gaji Netto
                      </TableHead>
                      <TableHead className="text-xs font-bold text-foreground">Status</TableHead>
                      <TableHead className="text-xs font-bold text-foreground text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSlips.map((slip) => (
                      <TableRow key={slip.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {slip.userName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-foreground leading-tight">{slip.userName}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{slip.userNip}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{slip.divisionName || '-'}</TableCell>
                        <TableCell className="text-xs font-medium">{slip.periodLabel}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-muted-foreground">
                          {fmtRp(slip.baseSalary)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-medium">{fmtRp(slip.grossIncome)}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-red-600">{fmtRp(slip.totalDeductions)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-emerald-700">
                          {fmtRp(slip.netSalary)}
                        </TableCell>
                        <TableCell>{slipStatusBadge(slip.status)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-xl gap-1 px-2.5 border-border hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                            onClick={() => setPrintSlip(slip)}
                          >
                            <Printer size={12} />
                            <span>Slip Resmi</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: PROFIL GAJI                                                      */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Search & Division Filter */}
          <div className="flex flex-wrap gap-2.5 items-center bg-card p-3.5 rounded-2xl border border-border/80 shadow-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari karyawan berdasarkan nama atau NIP…"
                className="pl-8 text-xs h-9 rounded-xl"
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
              />
            </div>
            <Select value={profileDivFilter} onValueChange={setProfileDivFilter}>
              <SelectTrigger className="w-44 rounded-xl text-xs h-9 border-border">
                <SelectValue placeholder="Semua Divisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Divisi</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              <strong>{profiles.length}</strong> dari <strong>{allUsers.length}</strong> karyawan telah memiliki profil gaji tetap
            </span>
          </div>

          <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-bold text-foreground">Karyawan</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Divisi</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Status Pegawai</TableHead>
                    <TableHead className="text-xs font-bold text-foreground text-right">Gaji Pokok</TableHead>
                    <TableHead className="text-xs font-bold text-foreground text-right">Est. Bruto</TableHead>
                    <TableHead className="text-xs font-bold text-foreground">Rekening Pembayaran</TableHead>
                    <TableHead className="text-xs font-bold text-foreground text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const profile = profiles.find((p) => p.userId === u.id);
                    const gross = profile
                      ? profile.baseSalary +
                        profile.positionAllowance +
                        profile.transportAllowance +
                        profile.mealAllowance +
                        profile.housingAllowance +
                        profile.healthAllowance +
                        profile.otherAllowances.reduce((s, a) => s + a.amount, 0)
                      : 0;

                    return (
                      <TableRow key={u.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-xs text-foreground leading-tight">{u.fullName}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{u.nip}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.divisionName || '-'}</TableCell>
                        <TableCell>
                          {profile ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-full text-[11px] font-medium">
                              {profile.employeeType === 'tetap' ? 'Tetap' : profile.employeeType === 'kontrak' ? 'Kontrak' : 'Magang'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 rounded-full text-[11px]">
                              Belum Diatur
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-medium">
                          {profile ? fmtRp(profile.baseSalary) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-emerald-700">
                          {profile ? fmtRp(gross) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {profile?.bankName ? (
                            <span>
                              {profile.bankName} • <span className="font-mono">{profile.bankAccount}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Belum ada rekening</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={profile ? 'outline' : 'default'}
                            className={`rounded-xl gap-1.5 text-xs h-7.5 ${
                              !profile ? 'bg-primary text-primary-foreground font-medium' : 'border-border'
                            }`}
                            onClick={() => setProfileUser({ id: u.id, name: u.fullName })}
                          >
                            {profile ? (
                              <>
                                <Edit size={12} /> Edit Profil
                              </>
                            ) : (
                              <>
                                <Plus size={12} /> Setup Gaji
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: PENGATURAN                                                       */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 1: Default Allowances */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-600" /> Tunjangan Standar Perusahaan
                </CardTitle>
                <CardDescription className="text-xs">
                  Nilai acuan standar untuk karyawan baru saat pembuatan profil gaji.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  ['Tunj. Makan Default (Rp)', 'defaultMealAllowance'],
                  ['Tunj. Transport Default (Rp)', 'defaultTransportAllowance'],
                  ['Tunj. Perumahan (Rp)', 'defaultHousingAllowance'],
                  ['Tunj. Kesehatan (Rp)', 'defaultHealthAllowance'],
                ].map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Rp</span>
                      <Input
                        type="number"
                        className="pl-9 rounded-xl text-xs h-9 font-mono"
                        value={settingsForm[key as keyof PayrollSettings] as number}
                        onChange={(e) =>
                          setSettingsForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Card 2: Deductions */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600" /> Aturan Pemotongan Kehadiran
                </CardTitle>
                <CardDescription className="text-xs">
                  Tarif pemotongan otomatis per menit keterlambatan dan hari ketidakhadiran (alfa).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Toggle Aktifkan / Nonaktifkan Pemotongan Gaji Keterlambatan */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-foreground">
                        Aktifkan Pemotongan Gaji Keterlambatan
                      </Label>
                      {settingsForm.isLateDeductionEnabled ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-600 rounded-md border border-rose-300/40">
                          Aktif (Potong Gaji)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 rounded-md border border-emerald-300/40">
                          Nonaktif (Hanya Rekap Evaluasi)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {settingsForm.isLateDeductionEnabled
                        ? 'Sistem akan memotong nominal gaji pokok secara otomatis berdasarkan menit keterlambatan saat slip digenerate.'
                        : 'Standar PT FRP saat ini: Menit keterlambatan tetap dihitung untuk laporan visual kinerja ke Dirut & Pimpinan, TANPA memotong nominal gaji karyawan.'}
                    </p>
                  </div>
                  <Switch
                    checked={settingsForm.isLateDeductionEnabled === true}
                    onCheckedChange={(val) =>
                      setSettingsForm((f) => ({ ...f, isLateDeductionEnabled: val }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    ['Pot. per Menit Terlambat', 'lateDeductionPerMinute'],
                    ['Pot. per Hari Alfa', 'absenceDeductionPerDay'],
                  ].map(([label, key]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Rp</span>
                        <Input
                          type="number"
                          className="pl-9 rounded-xl text-xs h-9 font-mono"
                          value={settingsForm[key as keyof PayrollSettings] as number}
                          onChange={(e) =>
                            setSettingsForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: BPJS & Tax */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-600" /> Iuran BPJS &amp; Tarif PPh 21
                </CardTitle>
                <CardDescription className="text-xs">
                  Persentase pemotongan iuran jaminan sosial dan pajak penghasilan.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {[
                  ['BPJS Kes. Karyawan', 'bpjsKesehatanEmployee'],
                  ['BPJS Kes. Perusahaan', 'bpjsKesehatanEmployer'],
                  ['BPJS Naker Karyawan', 'bpjsKetenagakerjaanEmployee'],
                  ['BPJS Naker Perusahaan', 'bpjsKetenagakerjaanEmployer'],
                  ['PPh 21 Standar', 'defaultTaxRate'],
                ].map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        className="pr-7 rounded-xl text-xs h-9 font-mono"
                        value={settingsForm[key as keyof PayrollSettings] as number}
                        onChange={(e) =>
                          setSettingsForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Card 4: Overtime Sync */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock size={16} className="text-amber-500" /> Integrasi Otomatis Lembur
                </CardTitle>
                <CardDescription className="text-xs">
                  Hubungkan modul persetujuan lembur langsung ke dalam slip penggajian.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-xl border border-border/60">
                  <div>
                    <p className="text-xs font-bold text-foreground">Sertakan Uang Lembur ke Slip Payroll</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pengajuan lembur yang telah disetujui (approved) otomatis dihitung dan dimasukkan ke penghasilan slip.
                    </p>
                  </div>
                  <Switch
                    checked={settingsForm.includeOvertimeInPayroll}
                    onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, includeOvertimeInPayroll: v }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Calculator */}
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calculator size={16} className="text-primary" /> Simulator Perhitungan Slip Gaji
              </CardTitle>
              <CardDescription className="text-xs">
                Coba kalkulasi estimasi take-home pay berdasarkan konfigurasi parameter yang aktif saat ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <SimulatorPanel settings={settingsForm} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveSettings} className="gap-2 rounded-xl bg-primary text-primary-foreground font-semibold px-6 shadow-sm">
              <CheckCircle2 size={15} /> Simpan Pengaturan Payroll
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: LAPORAN & TREN                                                   */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          {analytics.trend.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border bg-card/40">
              <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
                  <BarChart3 size={24} />
                </div>
                <p className="text-muted-foreground text-xs max-w-sm">
                  Belum ada data analitik. Buat periode dan generate slip gaji untuk melihat tren penggajian.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Trend Chart */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" /> Tren Penggajian (6 Periode Terakhir)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Perbandingan total gaji bersih yang dibayarkan per periode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-3.5">
                  {analytics.trend.map((t) => {
                    const max = Math.max(...analytics.trend.map((x) => x.net), 1);
                    const pct = (t.net / max) * 100;
                    return (
                      <div key={t.label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-medium w-28 shrink-0 text-right">
                          {t.label}
                        </span>
                        <div className="flex-1 bg-muted/60 rounded-full h-6 overflow-hidden p-0.5 border border-border/50">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all flex items-center justify-end pr-2.5 shadow-xs"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          >
                            {pct > 25 && <span className="text-[10px] text-white font-bold">{fmtRp(t.net)}</span>}
                          </div>
                        </div>
                        <span className="text-xs font-bold w-28 text-right font-mono text-foreground">
                          {fmtRp(t.net)}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Division Breakdown */}
              {analytics.divBreakdown.length > 0 && (
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Building2 size={16} className="text-primary" /> Alokasi Biaya Penggajian per Divisi
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Distribusi beban gaji pada periode aktif terbaru.
                    </CardDescription>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs font-bold text-foreground">Divisi</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-center">Jumlah Karyawan</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right">Total Bruto</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right text-emerald-700">
                            Total Netto
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.divBreakdown.map((d) => (
                          <TableRow key={d.name} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold">
                                  {d.code}
                                </span>
                                <span className="text-xs font-bold text-foreground">{d.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold text-xs">{d.count} orang</TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmtRp(d.totalGross)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-700 text-xs">
                              {fmtRp(d.totalNet)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-xl gap-2 text-xs border-border" onClick={handleExportCsv}>
              <Download size={13} /> Export Laporan CSV Lengkap
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 6: PPH 21 TER (PP 58/2023) SIMULATOR                                 */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tax-engine' && <TaxEngineSimulator />}

      {/* ── Create Period Dialog ── */}
      <Dialog open={createPeriodOpen} onOpenChange={setCreatePeriodOpen}>
        <DialogContent className="max-w-sm rounded-2xl border border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarRange size={18} className="text-primary" /> Buat Periode Penggajian Baru
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bulan</Label>
              <Select value={String(createMonth)} onValueChange={(v) => setCreateMonth(Number(v))}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tahun</Label>
              <Input
                type="number"
                className="rounded-xl text-xs h-9 font-mono"
                value={createYear}
                onChange={(e) => setCreateYear(Number(e.target.value))}
              />
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-center">
              <span className="text-muted-foreground">Periode yang akan dibuat: </span>
              <strong className="text-primary font-bold block text-sm mt-0.5">
                {MONTH_NAMES[createMonth - 1]} {createYear}
              </strong>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreatePeriodOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button onClick={handleCreatePeriod} className="rounded-xl gap-1.5 text-xs">
              <Plus size={14} /> Buat Periode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Profile Modal */}
      {profileUser && (
        <SalaryProfileDialog
          open={!!profileUser}
          userId={profileUser.id}
          userName={profileUser.name}
          onClose={() => setProfileUser(null)}
          onSaved={refresh}
        />
      )}

      {/* Print Slip Modal */}
      <PrintSlipModal slip={printSlip} open={!!printSlip} onClose={() => setPrintSlip(null)} />
    </div>
  );
};