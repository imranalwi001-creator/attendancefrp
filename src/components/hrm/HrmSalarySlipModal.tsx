import React, { useRef, useState } from 'react';
import { PayrollSlip } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';
import defaultLogo from '@/assets/logo.png';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

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

export interface HrmSalarySlipModalProps {
  slip: PayrollSlip | null;
  open: boolean;
  onClose: () => void;
}

export const HrmSalarySlipModal: React.FC<HrmSalarySlipModalProps> = ({ slip, open, onClose }) => {
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

  const upahVal = Number(slip.baseSalary || 4045050);
  const lemburVal = Number(slip.overtimePay || 0);
  const pesangonVal = Number(slip.otherAllowances?.[0]?.amount || 0);
  const totalPendapatanVal = upahVal + lemburVal + pesangonVal;

  const bpjsTkVal = 121351; // Resmi: 3% (121.351)
  const bpjsKesVal = 40450;  // Resmi: 1% (40.450)
  const alpaDays = slip.absentCount || 0;
  const alpaVal = Number(slip.absenceDeduction || 0);
  const totalPotonganVal = 161802 + alpaVal;

  const jumlahGajiVal = totalPendapatanVal - totalPotonganVal;
  const periodMonthName = (slip.periodLabel || 'November 2026').split(' ')[0];

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

                {/* 2. Employee Info */}
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
                      <div className="flex justify-between"><span>Lembur ({slip.overtimeHours.toFixed(1)}j)</span><span className="font-mono">Rp {lemburVal.toLocaleString('id-ID')}</span></div>
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

