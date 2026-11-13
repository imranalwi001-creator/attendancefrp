/**
 * FRP Accurate Overtime Engine - Test & Verification Script
 * Validates Divisional Overtime Rules:
 *   1. Timbangan & Segel on OFF/Holiday: NO break deduction, NO 1.5x (ALL 2.0x).
 *   2. Matching on OFF/Holiday: 1 HOUR break deduction, NO 1.5x (ALL 2.0x on remaining).
 *   3. All Shipment Divisions on Weekday: 1.5x for 1st hour, 2.0x for subsequent hours.
 */

function calculateOvertimeByDivision(baseSalary, divisionName, entries) {
  const hourlyRate = baseSalary / 173;
  const divUpper = (divisionName || '').toUpperCase();
  const isMatching = divUpper.includes('MATCHING');
  const isTimbanganOrSegel = divUpper.includes('TIMBANGAN') || divUpper.includes('SEGEL');

  let totalRawHours = 0;
  let totalBreakDeductionHours = 0;
  let effectiveWorkedHours = 0;
  let hours15 = 0;
  let hours20 = 0;

  for (const entry of entries) {
    totalRawHours += entry.rawHours;

    if (entry.isOffDay) {
      // ─── LEMBUR HARI OFF / TANGGAL MERAH ───
      let breakDeduction = 0;
      if (isMatching && entry.rawHours > 1) {
        breakDeduction = 1; // Divisi Matching: Dipotong 1 jam istirahat
      }
      totalBreakDeductionHours += breakDeduction;

      const effectiveHours = Math.max(0, entry.rawHours - breakDeduction);
      effectiveWorkedHours += effectiveHours;

      // Tidak dikenakan pengali 1.5x -> Seluruh jam efektif dihitung pengali 2.0x
      hours20 += effectiveHours;
    } else {
      // ─── LEMBUR HARI KERJA BIASA (KELEBIHAN JAM / SHIFT 7-7) ───
      effectiveWorkedHours += entry.rawHours;

      if (entry.rawHours > 0) {
        const h1 = Math.min(1, entry.rawHours);
        const h2 = Math.max(0, entry.rawHours - 1);
        hours15 += h1;
        hours20 += h2;
      }
    }
  }

  const payHours15 = hours15 * 1.5;
  const payHours20 = hours20 * 2.0;
  const totalPayHours = payHours15 + payHours20;
  const totalPayRp = Math.round(totalPayHours * hourlyRate);

  return {
    divisionName,
    baseSalary,
    hourlyRate: Number(hourlyRate.toFixed(2)),
    totalRawHours,
    totalBreakDeductionHours,
    effectiveWorkedHours,
    hours15,
    hours20,
    payHours15,
    payHours20,
    totalPayHours,
    totalPayRp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KASUS 1: AMRIN AMIR (FR.07.069) - DIVISI TIMBANGAN 4/5 (OKTOBER 2026)
// ─────────────────────────────────────────────────────────────────────────────
const amrinAmirEntries = [
  // 13 Hari Kerja Shift 7-7 (3 jam lembur riil / hari kerja)
  { date: '2026-10-01', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  { date: '2026-10-02', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Malam' },
  { date: '2026-10-03', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Malam' },
  // 04 Okt (Hari OFF): 12 jam riil -> Tanpa potongan istirahat, tanpa 1.5x -> 12 x 2.0 = 24 jam bayar
  { date: '2026-10-04', isOffDay: true, rawHours: 12, description: 'Lembur Shift 7-7 Malam (Hari OFF - Gantikan Juanda)' },
  { date: '2026-10-06', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  { date: '2026-10-07', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  { date: '2026-10-08', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Malam' },
  { date: '2026-10-09', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Malam' },
  { date: '2026-10-12', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  { date: '2026-10-13', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  { date: '2026-10-14', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Malam' },
  { date: '2026-10-15', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Malam' },
  { date: '2026-10-18', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  { date: '2026-10-19', isOffDay: false, rawHours: 3, description: 'Shift 7-7 Pagi' },
  // 23 Okt (Hari OFF): 9 jam riil -> Tanpa potongan istirahat, tanpa 1.5x -> 9 x 2.0 = 18 jam bayar
  { date: '2026-10-23', isOffDay: true, rawHours: 9, description: 'Lembur Shift 3 (Hari OFF - Gantikan Juanda)' },
];

const resTimbangan = calculateOvertimeByDivision(4045050, 'TIMBANGAN 4/5', amrinAmirEntries);

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('UJI 1: DIVISI TIMBANGAN & SEGEL (AMRIN AMIR - FR.07.069)');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('Divisi                 :', resTimbangan.divisionName);
console.log('Potongan Istirahat     :', resTimbangan.totalBreakDeductionHours, 'Jam (Aturan: 0 Jam / Bebas Potongan)');
console.log('Jam Pengali 1.5x       :', resTimbangan.hours15, 'Jam Riil ->', resTimbangan.payHours15, 'Jam Bayar (Hanya di hari kerja)');
console.log('Jam Pengali 2.0x       :', resTimbangan.hours20, 'Jam Riil ->', resTimbangan.payHours20, 'Jam Bayar (Hari kerja + Full Hari OFF)');
console.log('Total Jam Bayar        :', resTimbangan.totalPayHours, 'Jam (Target Lampiran: 113.5 Jam)');
console.log('Total Upah Lembur (Rp) :', 'Rp', resTimbangan.totalPayRp.toLocaleString('id-ID'), '(Target Lampiran: Rp 2.653.833)');
console.log('Status Hasil           :', resTimbangan.totalPayRp === 2653833 ? '✅ 100% PERSIS TARGET!' : '❌ Selisih');

// ─────────────────────────────────────────────────────────────────────────────
// KASUS 2: SIMULASI JIKA DITUGASKAN DI DIVISI MATCHING
// (Dengan jadwal yang sama: tgl 4 Okt 12j & tgl 23 Okt 9j dipotong istirahat 1j masing-masing)
// ─────────────────────────────────────────────────────────────────────────────
const resMatching = calculateOvertimeByDivision(4045050, 'MATCHING BONTOA', amrinAmirEntries);

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('UJI 2: SIMULASI JIKA DI DIVISI MATCHING (DIPOTONG 1 JAM ISTIRAHAT)');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('Divisi                 :', resMatching.divisionName);
console.log('Potongan Istirahat     :', resMatching.totalBreakDeductionHours, 'Jam (Aturan: 1 Jam per hari OFF = 2 Jam total)');
console.log('Jam Riil Efektif       :', resMatching.effectiveWorkedHours, 'Jam (60 - 2 = 58 Jam)');
console.log('Jam Pengali 1.5x       :', resMatching.hours15, 'Jam Riil ->', resMatching.payHours15, 'Jam Bayar (Hanya hari kerja)');
console.log('Jam Pengali 2.0x       :', resMatching.hours20, 'Jam Riil ->', resMatching.payHours20, 'Jam Bayar (Hari kerja 26j + OFF 19j = 45j)');
console.log('Total Jam Bayar        :', resMatching.totalPayHours, 'Jam (19.5 + 90 = 109.5 Jam)');
console.log('Total Upah Lembur (Rp) :', 'Rp', resMatching.totalPayRp.toLocaleString('id-ID'));
console.log('Selisih Istirahat      :', (resTimbangan.totalPayHours - resMatching.totalPayHours), 'Jam Bayar (Rp ' + (resTimbangan.totalPayRp - resMatching.totalPayRp).toLocaleString('id-ID') + ')');
console.log('═══════════════════════════════════════════════════════════════════════');
