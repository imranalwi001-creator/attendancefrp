import { AttendanceRecord, EmployeeCategoryGroup, UserProfile, getEmployeeCategoryGroup } from '@/types/hrm';

export const KARYAWAN_TETAP_DAILY_RATE = 140000;
export const STANDARD_BASE_SALARY = 4045050;
export const DEFAULT_ABSENCE_DEDUCTION_RATE = 155000;

export function countWeekdaysInMonth(yearMonth: string): number {
  const [yStr, mStr] = String(yearMonth || '').split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  if (!year || !month || month < 1 || month > 12) return 21;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let workdays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) workdays += 1;
  }
  return workdays;
}

export function isWeekdayIsoDate(dateStr: string): boolean {
  const m = String(dateStr || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return dow !== 0 && dow !== 6;
}

export function normalizeNipCompact(nip?: string | null): string {
  return String(nip || '').trim().toUpperCase().replace(/[\s.]/g, '');
}

export function matchesAttendanceUser(att: any, user: UserProfile): boolean {
  if (!att || !user) return false;
  if (att.userId && user.id && att.userId === user.id) return true;
  if (att.user_id && user.id && att.user_id === user.id) return true;
  const uNip = normalizeNipCompact(user.nip);
  const aNip = normalizeNipCompact(att.userNip || att.user_nip);
  if (uNip && aNip && uNip === aNip) return true;
  if (att.userId && user.nip && att.userId === user.nip) return true;
  return false;
}

export interface FrpEmployeePayrollCalc {
  group: EmployeeCategoryGroup;
  isKaryawanTetap: boolean;
  workdaysInMonth: number;
  paidWorkdays: number;
  alpaDays: number;
  baseSalary: number;
  bpjsTk: number;
  bpjsKes: number;
  totalBpjs: number;
  alpaDeduction: number;
  overtimePay: number;
  netSalary: number;
}

export function calculateFrpEmployeeRealtimePay(params: {
  user: UserProfile;
  month: string;
  attendances: AttendanceRecord[];
  monthOvertimePay: number;
  absenceDeductionRate?: number;
}): FrpEmployeePayrollCalc {
  const { user, month, attendances, monthOvertimePay, absenceDeductionRate = DEFAULT_ABSENCE_DEDUCTION_RATE } = params;
  const group = getEmployeeCategoryGroup(user);
  const isKaryawanTetap = group === 'KARYAWAN TETAP';
  const workdaysInMonth = countWeekdaysInMonth(month);

  const alpaDates = new Set<string>();
  for (const a of attendances || []) {
    if (!matchesAttendanceUser(a, user)) continue;
    const dt = String(a.attendanceDate || (a as any).attendance_date || (a as any).date || '').slice(0, 10);
    if (!dt.startsWith(month)) continue;
    const st = String(a.status || '').toLowerCase();
    const sub = String((a as any).absentSubtype || '').toLowerCase();
    if (st === 'alpa' || st === 'alfa' || sub === 'mangkir') {
      if (!isKaryawanTetap || isWeekdayIsoDate(dt)) {
        alpaDates.add(dt);
      }
    }
  }

  const alpaDays = alpaDates.size;

  if (isKaryawanTetap) {
    const paidWorkdays = Math.max(0, workdaysInMonth - alpaDays);
    const baseSalary = workdaysInMonth * KARYAWAN_TETAP_DAILY_RATE;
    const alpaDeduction = alpaDays * KARYAWAN_TETAP_DAILY_RATE;
    const netSalary = Math.max(0, baseSalary - alpaDeduction);
    return {
      group,
      isKaryawanTetap: true,
      workdaysInMonth,
      paidWorkdays,
      alpaDays,
      baseSalary,
      bpjsTk: 0,
      bpjsKes: 0,
      totalBpjs: 0,
      alpaDeduction,
      overtimePay: 0,
      netSalary,
    };
  }

  const rawSalary = Number((user as any).baseSalary ?? (user as any).base_salary ?? STANDARD_BASE_SALARY);
  const baseSalary = Number.isFinite(rawSalary) && rawSalary > 0 ? Math.round(rawSalary) : STANDARD_BASE_SALARY;
  const bpjsTk = Math.round(baseSalary * 0.03);
  const bpjsKes = Math.round(baseSalary * 0.01);
  const totalBpjs = bpjsTk + bpjsKes;
  const overtimePay = Math.max(0, Math.round(Number(monthOvertimePay || 0)));
  const alpaDeduction = alpaDays * absenceDeductionRate;
  const netSalary = Math.max(0, baseSalary - totalBpjs - alpaDeduction + overtimePay);

  return {
    group,
    isKaryawanTetap: false,
    workdaysInMonth,
    paidWorkdays: workdaysInMonth,
    alpaDays,
    baseSalary,
    bpjsTk,
    bpjsKes,
    totalBpjs,
    alpaDeduction,
    overtimePay,
    netSalary,
  };
}

export interface FrpGroupPayrollBucket {
  employeeCount: number;
  totalBaseSalary: number;
  totalBpjs: number;
  totalAlpaDeduction: number;
  totalOvertimePay: number;
  totalNetSalary: number;
}

const emptyBucket = (): FrpGroupPayrollBucket => ({
  employeeCount: 0,
  totalBaseSalary: 0,
  totalBpjs: 0,
  totalAlpaDeduction: 0,
  totalOvertimePay: 0,
  totalNetSalary: 0,
});

export function aggregateFrpGroupPayroll(
  rows: Array<{
    group: EmployeeCategoryGroup;
    baseSalary: number;
    totalBpjs: number;
    alpaDeduction: number;
    overtimePay: number;
    netSalary: number;
  }>
) {
  const shipment = emptyBucket();
  const rumahTangga = emptyBucket();
  const karyawanTetap = emptyBucket();
  const all = emptyBucket();

  for (const r of rows) {
    const target =
      r.group === 'SHIPMENT'
        ? shipment
        : r.group === 'RUMAH TANGGA'
        ? rumahTangga
        : karyawanTetap;

    for (const bucket of [target, all]) {
      bucket.employeeCount += 1;
      bucket.totalBaseSalary += r.baseSalary;
      bucket.totalBpjs += r.totalBpjs;
      bucket.totalAlpaDeduction += r.alpaDeduction;
      bucket.totalOvertimePay += r.overtimePay;
      bucket.totalNetSalary += r.netSalary;
    }
  }

  return { all, shipment, rumahTangga, karyawanTetap };
}

