/**
 * Indonesia Statutory Payroll & Tax Engine
 * Compliant with PP 58/2023 (PPh 21 TER), PMK 168/2023, Permenaker 102/2004 (Lembur), & BPJS Regulations
 */

export type TerCategory = 'A' | 'B' | 'C';

export interface TerRateBracket {
  maxIncome: number;
  rate: number; // in decimal (e.g. 0.0025 = 0.25%)
}

// ─── TABEL TER KATEGORI A (PP 58/2023) ──────────────────────────────────────────
// PTKP: TK/0 (Rp 54 jt), TK/1 (Rp 58.5 jt), K/0 (Rp 58.5 jt)
export const TER_A_BRACKETS: TerRateBracket[] = [
  { maxIncome: 5400000, rate: 0.00 },
  { maxIncome: 5650000, rate: 0.0025 },
  { maxIncome: 5950000, rate: 0.005 },
  { maxIncome: 6300000, rate: 0.0075 },
  { maxIncome: 6750000, rate: 0.01 },
  { maxIncome: 7500000, rate: 0.0125 },
  { maxIncome: 8550000, rate: 0.015 },
  { maxIncome: 9650000, rate: 0.0175 },
  { maxIncome: 10050000, rate: 0.02 },
  { maxIncome: 10350000, rate: 0.0225 },
  { maxIncome: 10700000, rate: 0.025 },
  { maxIncome: 11050000, rate: 0.03 },
  { maxIncome: 11600000, rate: 0.035 },
  { maxIncome: 12500000, rate: 0.04 },
  { maxIncome: 13750000, rate: 0.05 },
  { maxIncome: 15100000, rate: 0.06 },
  { maxIncome: 16950000, rate: 0.07 },
  { maxIncome: 19750000, rate: 0.08 },
  { maxIncome: 24150000, rate: 0.09 },
  { maxIncome: 26450000, rate: 0.10 },
  { maxIncome: 28000000, rate: 0.11 },
  { maxIncome: 30050000, rate: 0.12 },
  { maxIncome: 32400000, rate: 0.13 },
  { maxIncome: 35400000, rate: 0.14 },
  { maxIncome: 39100000, rate: 0.15 },
  { maxIncome: 43850000, rate: 0.16 },
  { maxIncome: 47800000, rate: 0.17 },
  { maxIncome: 51400000, rate: 0.18 },
  { maxIncome: 56300000, rate: 0.19 },
  { maxIncome: 62200000, rate: 0.20 },
  { maxIncome: 68600000, rate: 0.21 },
  { maxIncome: 77500000, rate: 0.22 },
  { maxIncome: 89000000, rate: 0.23 },
  { maxIncome: 103000000, rate: 0.24 },
  { maxIncome: 125000000, rate: 0.25 },
  { maxIncome: 157000000, rate: 0.26 },
  { maxIncome: 206000000, rate: 0.27 },
  { maxIncome: 337000000, rate: 0.28 },
  { maxIncome: 454000000, rate: 0.29 },
  { maxIncome: 550000000, rate: 0.30 },
  { maxIncome: 695000000, rate: 0.31 },
  { maxIncome: 910000000, rate: 0.32 },
  { maxIncome: 1400000000, rate: 0.33 },
  { maxIncome: Infinity, rate: 0.34 },
];

// ─── TABEL TER KATEGORI B (PP 58/2023) ──────────────────────────────────────────
// PTKP: TK/2 (Rp 63 jt), TK/3 (Rp 67.5 jt), K/1 (Rp 63 jt), K/2 (Rp 67.5 jt)
export const TER_B_BRACKETS: TerRateBracket[] = [
  { maxIncome: 6200000, rate: 0.00 },
  { maxIncome: 6500000, rate: 0.0025 },
  { maxIncome: 6850000, rate: 0.005 },
  { maxIncome: 7300000, rate: 0.0075 },
  { maxIncome: 9200000, rate: 0.01 },
  { maxIncome: 10750000, rate: 0.015 },
  { maxIncome: 11250000, rate: 0.02 },
  { maxIncome: 11600000, rate: 0.025 },
  { maxIncome: 12600000, rate: 0.03 },
  { maxIncome: 13600000, rate: 0.04 },
  { maxIncome: 14950000, rate: 0.05 },
  { maxIncome: 16400000, rate: 0.06 },
  { maxIncome: 18450000, rate: 0.07 },
  { maxIncome: 21850000, rate: 0.08 },
  { maxIncome: 26000000, rate: 0.09 },
  { maxIncome: 27700000, rate: 0.10 },
  { maxIncome: 29350000, rate: 0.11 },
  { maxIncome: 31450000, rate: 0.12 },
  { maxIncome: 33950000, rate: 0.13 },
  { maxIncome: 37100000, rate: 0.14 },
  { maxIncome: 41100000, rate: 0.15 },
  { maxIncome: 45800000, rate: 0.16 },
  { maxIncome: 49500000, rate: 0.17 },
  { maxIncome: 53800000, rate: 0.18 },
  { maxIncome: 58500000, rate: 0.19 },
  { maxIncome: 64000000, rate: 0.20 },
  { maxIncome: 71000000, rate: 0.21 },
  { maxIncome: 80000000, rate: 0.22 },
  { maxIncome: 93000000, rate: 0.23 },
  { maxIncome: 109000000, rate: 0.24 },
  { maxIncome: 129000000, rate: 0.25 },
  { maxIncome: 163000000, rate: 0.26 },
  { maxIncome: 211000000, rate: 0.27 },
  { maxIncome: 374000000, rate: 0.28 },
  { maxIncome: 459000000, rate: 0.29 },
  { maxIncome: 555000000, rate: 0.30 },
  { maxIncome: 704000000, rate: 0.31 },
  { maxIncome: 957000000, rate: 0.32 },
  { maxIncome: 1405000000, rate: 0.33 },
  { maxIncome: Infinity, rate: 0.34 },
];

// ─── TABEL TER KATEGORI C (PP 58/2023) ──────────────────────────────────────────
// PTKP: K/3 (Rp 72 jt)
export const TER_C_BRACKETS: TerRateBracket[] = [
  { maxIncome: 6600000, rate: 0.00 },
  { maxIncome: 6950000, rate: 0.0025 },
  { maxIncome: 7350000, rate: 0.005 },
  { maxIncome: 7800000, rate: 0.0075 },
  { maxIncome: 8850000, rate: 0.01 },
  { maxIncome: 9800000, rate: 0.0125 },
  { maxIncome: 10950000, rate: 0.015 },
  { maxIncome: 11200000, rate: 0.0175 },
  { maxIncome: 12050000, rate: 0.02 },
  { maxIncome: 12950000, rate: 0.03 },
  { maxIncome: 14150000, rate: 0.04 },
  { maxIncome: 15550000, rate: 0.05 },
  { maxIncome: 17050000, rate: 0.06 },
  { maxIncome: 19500000, rate: 0.07 },
  { maxIncome: 22700000, rate: 0.08 },
  { maxIncome: 26600000, rate: 0.09 },
  { maxIncome: 28100000, rate: 0.10 },
  { maxIncome: 30100000, rate: 0.11 },
  { maxIncome: 32600000, rate: 0.12 },
  { maxIncome: 35400000, rate: 0.13 },
  { maxIncome: 38900000, rate: 0.14 },
  { maxIncome: 43000000, rate: 0.15 },
  { maxIncome: 47400000, rate: 0.16 },
  { maxIncome: 51200000, rate: 0.17 },
  { maxIncome: 55800000, rate: 0.18 },
  { maxIncome: 60400000, rate: 0.19 },
  { maxIncome: 66700000, rate: 0.20 },
  { maxIncome: 74500000, rate: 0.21 },
  { maxIncome: 83200000, rate: 0.22 },
  { maxIncome: 95600000, rate: 0.23 },
  { maxIncome: 110000000, rate: 0.24 },
  { maxIncome: 134000000, rate: 0.25 },
  { maxIncome: 169000000, rate: 0.26 },
  { maxIncome: 221000000, rate: 0.27 },
  { maxIncome: 390000000, rate: 0.28 },
  { maxIncome: 463000000, rate: 0.29 },
  { maxIncome: 561000000, rate: 0.30 },
  { maxIncome: 709000000, rate: 0.31 },
  { maxIncome: 965000000, rate: 0.32 },
  { maxIncome: 1419000000, rate: 0.33 },
  { maxIncome: Infinity, rate: 0.34 },
];

export interface PtkpInfo {
  code: string;
  terCategory: TerCategory;
  annualPtkp: number;
  description: string;
}

export const PTKP_CATEGORIES: Record<string, PtkpInfo> = {
  'TK/0': { code: 'TK/0', terCategory: 'A', annualPtkp: 54000000, description: 'Tidak Kawin, 0 Tanggungan' },
  'TK/1': { code: 'TK/1', terCategory: 'A', annualPtkp: 58500000, description: 'Tidak Kawin, 1 Tanggungan' },
  'TK/2': { code: 'TK/2', terCategory: 'B', annualPtkp: 63000000, description: 'Tidak Kawin, 2 Tanggungan' },
  'TK/3': { code: 'TK/3', terCategory: 'B', annualPtkp: 67500000, description: 'Tidak Kawin, 3 Tanggungan' },
  'K/0': { code: 'K/0', terCategory: 'A', annualPtkp: 58500000, description: 'Kawin, 0 Tanggungan' },
  'K/1': { code: 'K/1', terCategory: 'B', annualPtkp: 63000000, description: 'Kawin, 1 Tanggungan' },
  'K/2': { code: 'K/2', terCategory: 'B', annualPtkp: 67500000, description: 'Kawin, 2 Tanggungan' },
  'K/3': { code: 'K/3', terCategory: 'C', annualPtkp: 72000000, description: 'Kawin, 3 Tanggungan' },
};

export class PayrollTaxEngine {
  /**
   * Determine TER category based on PTKP code (e.g. 'TK/0', 'K/1') or marital status & dependents
   */
  public getTerCategory(maritalStatusOrCode?: string, dependents: number = 0): TerCategory {
    if (maritalStatusOrCode && PTKP_CATEGORIES[maritalStatusOrCode]) {
      return PTKP_CATEGORIES[maritalStatusOrCode].terCategory;
    }
    const isMarried = maritalStatusOrCode?.toLowerCase().includes('menikah') || maritalStatusOrCode?.toLowerCase().includes('kawin') || false;

    if (!isMarried) {
      if (dependents === 0 || dependents === 1) return 'A'; // TK/0, TK/1
      if (dependents >= 2) return 'B'; // TK/2, TK/3
    } else {
      if (dependents === 0) return 'A'; // K/0
      if (dependents === 1 || dependents === 2) return 'B'; // K/1, K/2
      if (dependents >= 3) return 'C'; // K/3
    }
    return 'A';
  }

  /**
   * Calculate PPh 21 TER for monthly gross salary based on PP 58/2023
   */
  public calculatePph21Ter(grossIncome: number, category: TerCategory): { rate: number; taxAmount: number } {
    if (grossIncome <= 0) return { rate: 0, taxAmount: 0 };

    let brackets: TerRateBracket[];
    switch (category) {
      case 'B':
        brackets = TER_B_BRACKETS;
        break;
      case 'C':
        brackets = TER_C_BRACKETS;
        break;
      default:
        brackets = TER_A_BRACKETS;
        break;
    }

    const matched = brackets.find((b) => grossIncome <= b.maxIncome) || brackets[brackets.length - 1];
    const taxAmount = Math.round(grossIncome * matched.rate);

    return {
      rate: Number((matched.rate * 100).toFixed(2)),
      taxAmount,
    };
  }

  /**
   * Calculate statutory overtime pay compliant with Permenaker 102/2004
   * 1 hour overtime base rate = 1/173 x monthly base salary
   */
  public calculateOvertimeDepnaker(
    baseSalary: number,
    hours: number,
    isWeekendHoliday: boolean = false
  ): { hourlyRate: number; totalPay: number } {
    const hourlyRate = Math.round(baseSalary / 173);
    let totalPay = 0;

    if (!isWeekendHoliday) {
      // Workday overtime: 1st hour = 1.5x, 2nd+ hours = 2.0x
      if (hours <= 1) {
        totalPay = hours * 1.5 * hourlyRate;
      } else {
        totalPay = (1 * 1.5 * hourlyRate) + ((hours - 1) * 2.0 * hourlyRate);
      }
    } else {
      // Holiday overtime: first 7 hours = 2x, 8th hour = 3x, 9th+ hours = 4x
      if (hours <= 7) {
        totalPay = hours * 2.0 * hourlyRate;
      } else if (hours <= 8) {
        totalPay = (7 * 2.0 * hourlyRate) + ((hours - 7) * 3.0 * hourlyRate);
      } else {
        totalPay = (7 * 2.0 * hourlyRate) + (1 * 3.0 * hourlyRate) + ((hours - 8) * 4.0 * hourlyRate);
      }
    }

    return {
      hourlyRate,
      hourlyWageRate: hourlyRate,
      totalPay: Math.round(totalPay),
      totalOvertimePay: Math.round(totalPay),
    };
  }

  /**
   * Calculate detailed BPJS breakdown for employees and company
   */
  public calculateBpjsBreakdown(baseSalary: number) {
    const healthBasis = Math.min(baseSalary, 12000000);
    const employeeKesehatan = Math.round(healthBasis * 0.01);
    const companyKesehatan = Math.round(healthBasis * 0.04);

    const jpBasis = Math.min(baseSalary, 10042300);
    const employeeJht = Math.round(baseSalary * 0.02);
    const employeeJp = Math.round(jpBasis * 0.01);

    const companyJht = Math.round(baseSalary * 0.037);
    const companyJkk = Math.round(baseSalary * 0.0024);
    const companyJkm = Math.round(baseSalary * 0.003);
    const companyJp = Math.round(jpBasis * 0.02);

    const employeeTotal = employeeKesehatan + employeeJht + employeeJp;
    const companyTotal = companyKesehatan + companyJht + companyJkk + companyJkm + companyJp;

    return {
      employeeKesehatan,
      companyKesehatan,
      employeeJht,
      employeeJp,
      companyJht,
      companyJkk,
      companyJkm,
      companyJp,
      employeeTotal,
      companyTotal,
    };
  }

  /**
   * Calculate BPJS Kesehatan and BPJS Ketenagakerjaan employee and employer shares
   */
  public calculateBpjs(baseSalary: number): {
    bpjsKesehatanEmployee: number;
    bpjsKesehatanEmployer: number;
    bpjsKetenagakerjaanEmployee: number;
    bpjsKetenagakerjaanEmployer: number;
  } {
    const breakdown = this.calculateBpjsBreakdown(baseSalary);
    return {
      bpjsKesehatanEmployee: breakdown.employeeKesehatan,
      bpjsKesehatanEmployer: breakdown.companyKesehatan,
      bpjsKetenagakerjaanEmployee: breakdown.employeeJht + breakdown.employeeJp,
      bpjsKetenagakerjaanEmployer: breakdown.companyJht + breakdown.companyJkk + breakdown.companyJkm + breakdown.companyJp,
    };
  }
}

export const payrollTaxEngine = new PayrollTaxEngine();
