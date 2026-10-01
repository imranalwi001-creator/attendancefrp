import {
  Role,
  Division,
  Shift,
  OfficeLocation,
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  AttendanceStatus,
  AppSettings,
  OvertimeSettings,
  OvertimeRecord,
  OvertimeStatus,
  OvertimePaymentStatus,
  PayrollSettings,
  EmployeeSalaryProfile,
  PayrollPeriod,
  PayrollPeriodStatus,
  PayrollSlip,
  PayrollSlipStatus,
  HrmNotification,
  CompanyProfile,
  CompanyDocument,
  CompanyDocumentType,
  EmployeeDocument,
  EmployeeDocumentType,
  PerimeterViolation,
  ShiftSwapRecord,
  SmartSubstituteCandidate,
  EmployeeSchedule,
} from '@/types/hrm';
import { api } from './apiClient';
import { payrollTaxEngine } from './payrollTaxEngine';
import { GenerationResult, DEFAULT_SHIFTS as ROSTER_DEFAULT_SHIFTS } from './rosterSchedulerService';

const STORAGE_KEYS = {
  ROLES: 'hrm_roles',
  DIVISIONS: 'hrm_divisions',
  SHIFTS: 'hrm_shifts',
  OFFICE: 'hrm_office',
  USERS: 'hrm_users',
  ATTENDANCE: 'hrm_attendance',
  LEAVES: 'hrm_leaves',
  CURRENT_USER: 'hrm_current_user',
  APP_SETTINGS: 'hrm_app_settings',
  OVERTIME_SETTINGS: 'hrm_overtime_settings',
  OVERTIME_RECORDS: 'hrm_overtime_records',
  PAYROLL_SETTINGS: 'hrm_payroll_settings',
  PAYROLL_SALARY_PROFILES: 'hrm_payroll_salary_profiles',
  PAYROLL_PERIODS: 'hrm_payroll_periods',
  PAYROLL_SLIPS: 'hrm_payroll_slips',
  NOTIFICATIONS: 'hrm_notifications',
  COMPANY_PROFILE: 'hrm_company_profile',
  COMPANY_DOCUMENTS: 'hrm_company_documents',
  PERIMETER_VIOLATIONS: 'hrm_perimeter_violations',
  EMPLOYEE_SCHEDULES: 'hrm_employee_schedules',
};

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  id: 'company-main',
  companyName: 'PT. FAWWAZ RESKI PERWIRA',
  shortName: 'FRP',
  legalType: 'PT',
  businessSector: 'Teknologi Informasi & Jasa Konsultasi',
  foundedDate: '2015-03-15',
  npwp: '12.345.678.9-000.001',
  nib: '1234567890123',
  siupNumber: 'SIUP-2015-001234',
  deedNumber: 'No. 001/Akta/2015',
  deedNotary: 'Notaris Budi Santoso, S.H.',
  skMenkumham: 'AHU-0012345.AH.01.01.2015',
  totalEmployees: 0,
  address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
  city: 'Jakarta Selatan',
  province: 'DKI Jakarta',
  postalCode: '12190',
  country: 'Indonesia',
  phone: '+62 21 1234 5678',
  fax: '+62 21 1234 5679',
  email: 'info@frp-group.co.id',
  website: 'https://frp-group.co.id',
  instagram: '@frp_group',
  linkedin: 'PT-Fawwaz-Reski-Perwira',
  facebook: 'FRPGroup',
  vision: 'Menjadi perusahaan teknologi terdepan yang memberikan solusi inovatif dan berdampak positif bagi masyarakat Indonesia.',
  mission: '1. Menghadirkan produk dan layanan teknologi berkualitas tinggi.\n2. Membangun tim yang profesional, kreatif, dan berintegritas.\n3. Mendukung pertumbuhan ekonomi digital Indonesia yang berkelanjutan.',
  directorName: 'Fawwaz Reski Perwira, S.T., M.B.A.',
  hrManagerName: 'Siti Rahayu, S.Psi.',
  logoUrl: null,
  updatedAt: new Date().toISOString(),
};

const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  salaryCalculationDay: 25,
  paymentDay: 1,
  workingDaysPerMonth: 22,
  lateDeductionPerMinute: 1000,
  absenceDeductionPerDay: 155000,
  defaultTaxRate: 0,
  bpjsKesehatanEmployee: 1,
  bpjsKesehatanEmployer: 4,
  bpjsKetenagakerjaanEmployee: 3,
  bpjsKetenagakerjaanEmployer: 3.7,
  includeOvertimeInPayroll: true,
  currency: 'IDR',
};

// Initial Seed Data
const DEFAULT_ROLES: Role[] = [
  {
    id: 'role-superadmin',
    name: 'superadmin',
    label: 'Super Admin',
    description: 'Akses kontrol penuh ke seluruh sistem, peran, divisi, dan pengguna',
    isSystem: true,
    permissions: ['all'],
  },
  {
    id: 'role-admin',
    name: 'admin',
    label: 'Admin HRD',
    description: 'Manajemen presensi harian, pendaftaran karyawan, dan rekapitulasi',
    isSystem: true,
    permissions: ['manage_attendance', 'manage_employees', 'approve_leave', 'view_reports'],
  },
  {
    id: 'role-hrd',
    name: 'hrd',
    label: 'HRD Staff',
    description: 'Operasional HR, monitoring absensi, dan approval izin',
    isSystem: false,
    permissions: ['manage_attendance', 'approve_leave', 'view_reports'],
  },
  {
    id: 'role-pimpinan',
    name: 'pimpinan',
    label: 'Pimpinan / Direksi',
    description: 'Monitoring analitik kehadiran tim dan approval tingkat eksekutif',
    isSystem: false,
    permissions: ['view_analytics', 'approve_leave', 'view_reports'],
  },
  {
    id: 'role-keuangan',
    name: 'keuangan',
    label: 'Keuangan & Payroll',
    description: 'Rekapitulasi jam kerja, lembur, dan potongan keterlambatan untuk penggajian',
    isSystem: false,
    permissions: ['view_payroll_reports', 'export_reports'],
  },
  {
    id: 'role-karyawan',
    name: 'karyawan',
    label: 'Karyawan',
    description: 'Presensi mandiri (GPS & Foto), pengajuan cuti/izin, dan riwayat presensi pribadi',
    isSystem: true,
    permissions: ['self_attendance', 'apply_leave', 'view_own_history'],
  },
];

const DEFAULT_DIVISIONS: Division[] = [
  {
    id: 'div-it',
    code: 'IT',
    name: 'Teknologi Informasi',
    description: 'Tim Pengembang Software & Infrastruktur',
    leaderName: 'Rian Pratama',
    locationName: 'Graha IT Tower Lt. 5',
    address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
    latitude: -6.2250,
    longitude: 106.8090,
    radiusMeters: 150,
  },
  {
    id: 'div-fin',
    code: 'FIN',
    name: 'Keuangan & Akuntansi',
    description: 'Pengelolaan Kas, Pajak, dan Penggajian',
    leaderName: 'Siti Rahmah',
    locationName: 'Gedung Finance Center Lt. 3',
    address: 'Jl. HR Rasuna Said Blok X-5, Jakarta Selatan',
    latitude: -6.2235,
    longitude: 106.8310,
    radiusMeters: 150,
  },
  {
    id: 'div-hrd',
    code: 'HRD',
    name: 'Sumber Daya Manusia',
    description: 'Manajemen Pegawai & Rekrutmen',
    leaderName: 'Dimas Wicaksono',
    locationName: 'Headquarters Graha Lt. 2',
    address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
    latitude: -6.2250,
    longitude: 106.8090,
    radiusMeters: 150,
  },
  {
    id: 'div-ops',
    code: 'OPS',
    name: 'Operasional & Umum',
    description: 'Logistik, Sarana, dan Fasilitas Gudang',
    leaderName: 'Budi Santoso',
    locationName: 'Depo & Gudang Logistik Pulogadung',
    address: 'Kawasan Industri Rawa Gelam, Pulogadung, Jakarta Timur',
    latitude: -6.1950,
    longitude: 106.9120,
    radiusMeters: 300,
  },
  {
    id: 'div-mkt',
    code: 'MKT',
    name: 'Pemasaran & Bisnis',
    description: 'Ekspansi Bisnis dan Kemitraan',
    leaderName: 'Maya Indah',
    locationName: 'Kantor Cabang Bisnis Simatupang',
    address: 'Jl. TB Simatupang No. 18, Jakarta Selatan',
    latitude: -6.2950,
    longitude: 106.8250,
    radiusMeters: 200,
  },
];

const DEFAULT_SHIFTS: Shift[] = [
  {
    id: 'shift-regular',
    code: 'REG',
    name: 'Reguler Kantor (08:00 - 17:00)',
    startTime: '08:00',
    endTime: '17:00',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    lateToleranceMinutes: 15,
    earliestClockInMinutes: 60,
    isCrossDay: false,
    workingDays: [1, 2, 3, 4, 5],
    colorTag: '#0d9488',
    description: 'Jam kerja standar kantor pusat & divisi administrasi (5 hari kerja)',
    isDefault: true,
  },
  {
    id: 'shift-morning',
    code: 'PAGI',
    name: 'Shift 1 - Pagi (07:00 - 15:30)',
    startTime: '07:00',
    endTime: '15:30',
    breakStartTime: '11:30',
    breakEndTime: '12:30',
    lateToleranceMinutes: 15,
    earliestClockInMinutes: 60,
    isCrossDay: false,
    workingDays: [1, 2, 3, 4, 5, 6],
    colorTag: '#3b82f6',
    description: 'Shift operasional pagi hari',
    isDefault: false,
  },
  {
    id: 'shift-afternoon',
    code: 'SIANG',
    name: 'Shift 2 - Siang (13:30 - 21:30)',
    startTime: '13:30',
    endTime: '21:30',
    breakStartTime: '17:30',
    breakEndTime: '18:30',
    lateToleranceMinutes: 15,
    earliestClockInMinutes: 60,
    isCrossDay: false,
    workingDays: [1, 2, 3, 4, 5, 6],
    colorTag: '#f59e0b',
    description: 'Shift operasional siang s/d malam',
    isDefault: false,
  },
  {
    id: 'shift-night',
    code: 'MALAM',
    name: 'Shift 3 - Malam Lintas Hari (21:30 - 06:00)',
    startTime: '21:30',
    endTime: '06:00',
    breakStartTime: '01:00',
    breakEndTime: '02:00',
    lateToleranceMinutes: 15,
    earliestClockInMinutes: 60,
    isCrossDay: true,
    workingDays: [1, 2, 3, 4, 5, 6],
    colorTag: '#8b5cf6',
    description: 'Shift malam penjagaan & operasional logistik lintas hari',
    isDefault: false,
  },
];

const DEFAULT_OFFICE: OfficeLocation = {
  id: 'office-hq',
  name: 'Kantor Pusat HRM Graha',
  address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
  latitude: -6.2250,
  longitude: 106.8090,
  radiusMeters: 150,
  isActive: true,
  bssidWhitelist: '00:14:22:01:23:45, a4:2b:b0:c1:d2:e3',
  wifiSsid: 'OFFICE_CORP_5G',
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'PT. FAWWAZ RESKI PERWIRA',
  logoUrl: null,
};

const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr-superadmin',
    nip: 'SA001',
    fullName: 'Master Super Administrator',
    email: 'superadmin@hrm.local',
    password: 'password123',
    phone: '081234567890',
    roleId: 'role-superadmin',
    roleName: 'superadmin',
    divisionId: 'div-it',
    divisionName: 'Teknologi Informasi',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-admin',
    nip: 'ADM001',
    fullName: 'Budi Prakoso (Admin HR)',
    email: 'admin@hrm.local',
    password: 'password123',
    phone: '081234567891',
    roleId: 'role-admin',
    roleName: 'admin',
    divisionId: 'div-hrd',
    divisionName: 'Sumber Daya Manusia',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-pimpinan',
    nip: 'DIR001',
    fullName: 'Drs. Hendra Gunawan (Direktur)',
    email: 'pimpinan@hrm.local',
    password: 'password123',
    phone: '081234567892',
    roleId: 'role-pimpinan',
    roleName: 'pimpinan',
    divisionId: 'div-ops',
    divisionName: 'Operasional & Umum',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-keuangan',
    nip: 'FIN001',
    fullName: 'Anisa Lestari (Payroll & Keuangan)',
    email: 'keuangan@hrm.local',
    password: 'password123',
    phone: '081234567893',
    roleId: 'role-keuangan',
    roleName: 'keuangan',
    divisionId: 'div-fin',
    divisionName: 'Keuangan & Akuntansi',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-karyawan1',
    nip: 'EMP001',
    fullName: 'Ahmad Fauzi',
    email: 'fauzi@hrm.local',
    password: 'password123',
    phone: '081234567894',
    roleId: 'role-karyawan',
    roleName: 'karyawan',
    divisionId: 'div-it',
    divisionName: 'Teknologi Informasi',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-karyawan2',
    nip: 'EMP002',
    fullName: 'Dewi Sartika',
    email: 'dewi@hrm.local',
    password: 'password123',
    phone: '081234567895',
    roleId: 'role-karyawan',
    roleName: 'karyawan',
    divisionId: 'div-mkt',
    divisionName: 'Pemasaran & Bisnis',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-karyawan7',
    nip: 'EMP007',
    fullName: 'Karyawan EMP007',
    email: 'emp007@hrm.local',
    password: 'password123',
    phone: '081234567897',
    roleId: 'role-karyawan',
    roleName: 'karyawan',
    divisionId: 'div-it',
    divisionName: 'Teknologi Informasi',
    shiftId: 'shift-regular',
    annualLeaveQuota: 12,
    usedLeaveDays: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Initial Overtime Policy Settings
const DEFAULT_OVERTIME_SETTINGS: OvertimeSettings = {
  hourlyRate: 25000,
  weekendRateMultiplier: 2.0,
  minDurationMinutes: 30,
  roundingMinutes: 30,
  maxDailyHours: 4,
  autoDetectFromClockOut: true,
  requireApproval: true,
};

// Initial Seed Overtime Records for instant realistic reports
const DEFAULT_OVERTIME_RECORDS: OvertimeRecord[] = [
  {
    id: 'ot-001',
    userId: 'usr-karyawan1',
    userName: 'Ahmad Fauzi',
    userNip: 'EMP001',
    divisionId: 'div-it',
    divisionName: 'Teknologi Informasi',
    date: '2026-09-07',
    startTime: '17:30',
    endTime: '20:30',
    durationMinutes: 180,
    durationHours: 3.0,
    isWeekendHoliday: false,
    hourlyRate: 25000,
    rateMultiplier: 1.0,
    totalPay: 75000,
    taskDescription: 'Maintenance server database utama dan pembaruan sistem backup berkala',
    status: 'approved',
    paymentStatus: 'included_in_payroll',
    approvedBy: 'usr-admin',
    approvedByName: 'Admin HRD',
    approvalNotes: 'Pekerjaan mendesak sesuai arahan kepala IT.',
    createdAt: '2026-09-07T13:00:00.000Z',
  },
  {
    id: 'ot-002',
    userId: 'usr-karyawan1',
    userName: 'Ahmad Fauzi',
    userNip: 'EMP001',
    divisionId: 'div-it',
    divisionName: 'Teknologi Informasi',
    date: '2026-09-05',
    startTime: '09:00',
    endTime: '13:00',
    durationMinutes: 240,
    durationHours: 4.0,
    isWeekendHoliday: true,
    hourlyRate: 25000,
    rateMultiplier: 2.0,
    totalPay: 200000,
    taskDescription: 'Migrasi arsitektur cloud server weekend tanpa downtime operasional',
    status: 'approved',
    paymentStatus: 'paid',
    approvedBy: 'usr-superadmin',
    approvedByName: 'Super Admin',
    approvalNotes: 'Lembur akhir pekan disetujui.',
    createdAt: '2026-09-05T07:30:00.000Z',
  },
  {
    id: 'ot-003',
    userId: 'usr-karyawan2',
    userName: 'Dewi Sartika',
    userNip: 'EMP002',
    divisionId: 'div-mkt',
    divisionName: 'Pemasaran & Bisnis',
    date: '2026-09-08',
    startTime: '17:30',
    endTime: '19:30',
    durationMinutes: 120,
    durationHours: 2.0,
    isWeekendHoliday: false,
    hourlyRate: 25000,
    rateMultiplier: 1.0,
    totalPay: 50000,
    taskDescription: 'Penyusunan berkas penawaran tender pengadaan instansi pemerintah',
    status: 'pending',
    paymentStatus: 'unpaid',
    createdAt: '2026-09-08T09:30:00.000Z',
  },
  {
    id: 'ot-004',
    userId: 'usr-admin',
    userName: 'Budi Santoso',
    userNip: 'ADM001',
    divisionId: 'div-hr',
    divisionName: 'Sumber Daya Manusia',
    date: '2026-09-06',
    startTime: '17:00',
    endTime: '20:00',
    durationMinutes: 180,
    durationHours: 3.0,
    isWeekendHoliday: false,
    hourlyRate: 25000,
    rateMultiplier: 1.0,
    totalPay: 75000,
    taskDescription: 'Rekapitulasi data berkas seleksi calon karyawan baru',
    status: 'approved',
    paymentStatus: 'unpaid',
    approvedBy: 'usr-superadmin',
    approvedByName: 'Super Admin',
    approvalNotes: 'Disetujui.',
    createdAt: '2026-09-06T10:00:00.000Z',
  },
];

export const getTodayDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

export const safeGetJson = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    return JSON.parse(item) as T;
  } catch (err) {
    console.warn(`[HRM Storage] Failed parsing ${key}, falling back to default:`, err);
    return fallback;
  }
};

export const hrmService = {
  // Centralized PostgreSQL Backend Synchronizer
  syncWithBackend: async (): Promise<boolean> => {
    try {
      const res = await api.get<{ success: boolean; data: any }>('/sync/bootstrap');
      if (res && res.success && res.data) {
        const { users, roles, divisions, shifts, office, company, attendances } = res.data;
        if (Array.isArray(users) && users.length > 0) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
        if (Array.isArray(roles) && roles.length > 0) {
          localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
        }
        if (Array.isArray(divisions) && divisions.length > 0) {
          localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(divisions));
        }
        if (Array.isArray(shifts) && shifts.length > 0) {
          localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
        }
        if (office) {
          localStorage.setItem(STORAGE_KEYS.OFFICE, JSON.stringify(office));
        }
        if (company) {
          localStorage.setItem(STORAGE_KEYS.COMPANY_PROFILE, JSON.stringify(company));
        }
        if (Array.isArray(attendances) && attendances.length > 0) {
          localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendances));
        }
        if (Array.isArray(res.data.perimeterViolations)) {
          localStorage.setItem(STORAGE_KEYS.PERIMETER_VIOLATIONS, JSON.stringify(res.data.perimeterViolations));
        }
        const currentUsersList: UserProfile[] = Array.isArray(users) && users.length > 0 ? users : hrmService.getUsers();
        if (Array.isArray(res.data.leaves)) {
          const mappedLeaves = res.data.leaves.map((l: any) => {
            const user = currentUsersList.find((u: any) => u.id === l.user_id || u.email === l.user_id || u.nip === l.user_id);
            return {
              id: l.id,
              userId: l.user_id,
              userName: l.user_name || (user ? (user.fullName || user.name) : 'Karyawan'),
              userNip: l.user_nip || (user ? user.nip : ''),
              divisionName: l.division_name || (user ? (user.division || user.divisionName) : '-'),
              leaveType: l.leave_type,
              startDate: l.start_date ? new Date(l.start_date).toISOString().split('T')[0] : '',
              endDate: l.end_date ? new Date(l.end_date).toISOString().split('T')[0] : '',
              totalDays: l.total_days || 1,
              reason: l.reason || '',
              attachmentUrl: l.attachment_url,
              status: l.status || 'pending',
              approvedBy: l.approved_by,
              approvedByName: l.approver_name,
              approvalNotes: l.approval_notes,
              createdAt: l.created_at,
            };
          });
          localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(mappedLeaves));
          window.dispatchEvent(new Event('hrm_leaves_updated'));
        }
        if (Array.isArray(res.data.overtimeRecords)) {
          const mappedOt = res.data.overtimeRecords.map((o: any) => {
            const user = currentUsersList.find((u: any) => u.id === o.user_id || u.email === o.user_id || u.nip === o.user_id);
            const hourlyRate = Number(o.rate_applied ?? o.hourly_rate ?? o.hourlyRate ?? 30000);
            const totalPay = Number(o.compensation_amount ?? o.total_pay ?? o.totalPay ?? 0);
            return {
              id: o.id,
              userId: o.user_id,
              userName: o.user_name || (user ? (user.fullName || user.name) : 'Karyawan'),
              userNip: o.user_nip || (user ? user.nip : ''),
              divisionName: o.division_name || (user ? (user.division || user.divisionName) : '-'),
              date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
              startTime: o.start_time ? o.start_time.substring(0, 5) : '17:00',
              endTime: o.end_time ? o.end_time.substring(0, 5) : '19:00',
              durationHours: parseFloat(o.duration_hours) || 2,
              durationMinutes: Math.round((parseFloat(o.duration_hours) || 2) * 60),
              taskDescription: o.task_description || '',
              hourlyRate: hourlyRate,
              rateApplied: hourlyRate,
              totalPay: totalPay,
              compensationAmount: totalPay,
              status: o.status || 'pending',
              paymentStatus: o.payment_status || 'unpaid',
              approvedBy: o.approved_by,
              approvedByName: o.approver_name,
              createdAt: o.created_at,
            };
          });
          localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(mappedOt));
          window.dispatchEvent(new Event('hrm_overtime_updated'));
        }
        if (Array.isArray(res.data.notifications)) {
          const mappedNotifs = res.data.notifications.map((n: any) => ({
            id: n.id,
            userId: n.user_id || undefined,
            recipientRole: n.recipient_role || undefined,
            title: n.title,
            message: n.message,
            type: n.type || 'info',
            isRead: n.is_read === true,
            link: n.link || undefined,
            createdAt: n.created_at,
            metadata: n.metadata,
          }));
          localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(mappedNotifs));
          window.dispatchEvent(new Event('hrm_notifications_updated'));
        }
        if (Array.isArray(res.data.salaryProfiles) && res.data.salaryProfiles.length > 0) {
          const mappedSalaryProfiles = res.data.salaryProfiles.map((sp: any) => ({
            id: sp.id,
            userId: sp.user_id,
            baseSalary: Number(sp.base_salary) || 0,
            positionAllowance: Number(sp.position_allowance) || 0,
            transportAllowance: Number(sp.transport_allowance) || 0,
            mealAllowance: Number(sp.meal_allowance) || 0,
            housingAllowance: Number(sp.housing_allowance) || 0,
            healthAllowance: Number(sp.health_allowance) || 0,
            otherAllowances: Array.isArray(sp.other_allowances) ? sp.other_allowances : [],
            taxSetting: sp.tax_setting || 'gross',
            employeeType: sp.employee_type || 'tetap',
            bankName: sp.bank_name || '',
            bankAccount: sp.bank_account_number || '',
            bankAccountName: sp.bank_account_holder || '',
            effectiveDate: sp.effective_date ? new Date(sp.effective_date).toISOString().split('T')[0] : '',
            updatedAt: sp.updated_at,
          }));
          localStorage.setItem(STORAGE_KEYS.PAYROLL_SALARY_PROFILES, JSON.stringify(mappedSalaryProfiles));
          window.dispatchEvent(new Event('hrm_salary_profiles_updated'));
        }
        if (Array.isArray(res.data.payrollPeriods) && res.data.payrollPeriods.length > 0) {
          const mappedPeriods = res.data.payrollPeriods.map((pp: any) => ({
            id: pp.id,
            month: pp.month,
            year: pp.year,
            periodLabel: pp.period_label,
            startDate: pp.start_date ? new Date(pp.start_date).toISOString().split('T')[0] : '',
            endDate: pp.end_date ? new Date(pp.end_date).toISOString().split('T')[0] : '',
            status: pp.status || 'draft',
            totalEmployees: pp.total_employees || 0,
            totalGross: Number(pp.total_gross) || 0,
            totalDeductions: Number(pp.total_deductions) || 0,
            totalNet: Number(pp.total_net) || 0,
            totalOvertimePay: Number(pp.total_overtime_pay) || 0,
            createdAt: pp.created_at,
          }));
          localStorage.setItem(STORAGE_KEYS.PAYROLL_PERIODS, JSON.stringify(mappedPeriods));
          window.dispatchEvent(new Event('hrm_payroll_periods_updated'));
        }
        window.dispatchEvent(new Event('hrm_data_updated'));
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[HRM Sync] Backend sync skipped or unavailable:', err);
      return false;
    }
  },

  // Initialization
  init: () => {
    if (!localStorage.getItem(STORAGE_KEYS.ROLES)) {
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(DEFAULT_ROLES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DIVISIONS)) {
      localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(DEFAULT_DIVISIONS));
    } else {
      // Ensure divisions have location fields
      const existingDivs: Division[] = safeGetJson<Division[]>(STORAGE_KEYS.DIVISIONS, DEFAULT_DIVISIONS);
      let updated = false;
      const merged = existingDivs.map((d) => {
        const fallback = DEFAULT_DIVISIONS.find((def) => def.id === d.id || def.code === d.code);
        if (!d.latitude && fallback?.latitude) {
          updated = true;
          return {
            ...d,
            locationName: d.locationName || fallback.locationName,
            address: d.address || fallback.address,
            latitude: fallback.latitude,
            longitude: fallback.longitude,
            radiusMeters: d.radiusMeters || fallback.radiusMeters,
          };
        }
        return d;
      });
      if (updated) {
        localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(merged));
      }
    }

    if (!localStorage.getItem(STORAGE_KEYS.SHIFTS)) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(DEFAULT_SHIFTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.OFFICE)) {
      localStorage.setItem(STORAGE_KEYS.OFFICE, JSON.stringify(DEFAULT_OFFICE));
    }
    if (!localStorage.getItem(STORAGE_KEYS.OVERTIME_SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.OVERTIME_SETTINGS, JSON.stringify(DEFAULT_OVERTIME_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.OVERTIME_RECORDS)) {
      localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(DEFAULT_OVERTIME_RECORDS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APP_SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(DEFAULT_APP_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      const today = getTodayDateStr();
      const sampleAttendances: AttendanceRecord[] = [
        {
          id: 'att-1',
          userId: 'usr-karyawan1',
          userName: 'Ahmad Fauzi',
          userNip: 'EMP001',
          divisionName: 'Teknologi Informasi',
          attendanceDate: today,
          clockIn: '07:54:12',
          clockOut: undefined,
          latIn: -6.22505,
          longIn: 106.80902,
          status: 'hadir',
          lateMinutes: 0,
          earlyLeavingMinutes: 0,
          workDurationMinutes: 0,
          notes: 'Absensi via Web Geofencing',
        },
        {
          id: 'att-2',
          userId: 'usr-admin',
          userName: 'Budi Prakoso (Admin HR)',
          userNip: 'ADM001',
          divisionName: 'Sumber Daya Manusia',
          attendanceDate: today,
          clockIn: '08:18:05',
          clockOut: undefined,
          latIn: -6.2251,
          longIn: 106.8091,
          status: 'terlambat',
          lateMinutes: 3,
          earlyLeavingMinutes: 0,
          workDurationMinutes: 0,
          notes: 'Macet di jalan tol',
        },
      ];
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(sampleAttendances));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVES)) {
      const sampleLeaves: LeaveRequest[] = [
        {
          id: 'leave-1',
          userId: 'usr-karyawan2',
          userName: 'Dewi Sartika',
          userNip: 'EMP002',
          divisionName: 'Pemasaran & Bisnis',
          leaveType: 'cuti_tahunan',
          startDate: getTodayDateStr(),
          endDate: getTodayDateStr(),
          totalDays: 1,
          reason: 'Acara keluarga di luar kota',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(sampleLeaves));
    }
  },

  // APP SETTINGS & LOGO
  getAppSettings: (): AppSettings => {
    hrmService.init();
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      if (!raw) return DEFAULT_APP_SETTINGS;
      const parsed = JSON.parse(raw);
      if (!parsed.appName || parsed.appName === 'HRM Attendance System') {
        parsed.appName = 'PT. FAWWAZ RESKI PERWIRA';
      }
      return parsed;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  },

  updateAppSettings: (updates: Partial<AppSettings>): AppSettings => {
    const current = hrmService.getAppSettings();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(updated));
    // Dispatch custom storage event for instant UI update
    window.dispatchEvent(new Event('hrm_settings_updated'));
    return updated;
  },

  // ROLES
  getRoles: (): Role[] => {
    hrmService.init();
    return safeGetJson<Role[]>(STORAGE_KEYS.ROLES, DEFAULT_ROLES);
  },

  addRole: (role: Omit<Role, 'id' | 'isSystem'>): Role => {
    const roles = hrmService.getRoles();
    const newRole: Role = {
      ...role,
      id: `role-${Date.now()}`,
      isSystem: false,
    };
    roles.push(newRole);
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
    return newRole;
  },

  updateRole: (id: string, updates: Partial<Role>): Role => {
    const roles = hrmService.getRoles();
    const idx = roles.findIndex((r) => r.id === id);
    if (idx !== -1) {
      roles[idx] = { ...roles[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
      return roles[idx];
    }
    throw new Error('Role tidak ditemukan');
  },

  deleteRole: (id: string) => {
    const roles = hrmService.getRoles();
    const role = roles.find((r) => r.id === id);
    if (role?.isSystem) {
      throw new Error('Role sistem tidak dapat dihapus');
    }
    const filtered = roles.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(filtered));
  },

  // DIVISIONS & PER-DIVISION GEOFENCE
  getDivisions: (): Division[] => {
    hrmService.init();
    return safeGetJson<Division[]>(STORAGE_KEYS.DIVISIONS, DEFAULT_DIVISIONS);
  },

  addDivision: async (div: Omit<Division, 'id'>): Promise<Division> => {
    const divisions = hrmService.getDivisions();
    const tempId = `div-${Date.now()}`;
    const newDiv: Division = { ...div, id: tempId };
    divisions.push(newDiv);
    localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(divisions));
    window.dispatchEvent(new Event('hrm_data_updated'));

    try {
      const res = await api.post<{ success: boolean; data: any }>('/divisions', div);
      if (res && res.success && res.data) {
        const saved = res.data;
        const mapped: Division = {
          id: saved.id,
          code: saved.code,
          name: saved.name,
          description: saved.description || '',
          leaderName: div.leaderName || '',
          locationName: saved.locationName || saved.location_name || '',
          address: saved.address || '',
          latitude: typeof saved.latitude === 'number' ? saved.latitude : parseFloat(saved.latitude),
          longitude: typeof saved.longitude === 'number' ? saved.longitude : parseFloat(saved.longitude),
          radiusMeters: saved.radiusMeters || saved.radius_meters || 150,
        };
        const currentDivs = hrmService.getDivisions().filter((d) => d.id !== tempId);
        currentDivs.push(mapped);
        localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(currentDivs));
        window.dispatchEvent(new Event('hrm_data_updated'));
        return mapped;
      }
    } catch (err) {
      console.error('[HRM] Error adding division to PostgreSQL:', err);
    }
    return newDiv;
  },

  updateDivision: async (id: string, updates: Partial<Division>): Promise<Division> => {
    const divisions = hrmService.getDivisions();
    const idx = divisions.findIndex((d) => d.id === id || d.code === updates.code);
    let updatedDiv: Division;
    if (idx !== -1) {
      divisions[idx] = { ...divisions[idx], ...updates };
      updatedDiv = divisions[idx];
    } else {
      updatedDiv = { id, ...updates } as Division;
      divisions.push(updatedDiv);
    }
    localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(divisions));
    window.dispatchEvent(new Event('hrm_data_updated'));

    try {
      const res = await api.put<{ success: boolean; data: any }>(`/divisions/${id}`, updates);
      if (res && res.success && res.data) {
        const saved = res.data;
        const mapped: Division = {
          id: saved.id,
          code: saved.code,
          name: saved.name,
          description: saved.description || '',
          leaderName: updates.leaderName || (idx !== -1 ? divisions[idx]?.leaderName : '') || '',
          locationName: saved.locationName || saved.location_name || '',
          address: saved.address || '',
          latitude: typeof saved.latitude === 'number' ? saved.latitude : parseFloat(saved.latitude),
          longitude: typeof saved.longitude === 'number' ? saved.longitude : parseFloat(saved.longitude),
          radiusMeters: saved.radiusMeters || saved.radius_meters || 150,
        };
        const currentDivs = hrmService.getDivisions();
        const curIdx = currentDivs.findIndex((d) => d.id === id || d.id === saved.id || d.code === saved.code);
        if (curIdx !== -1) {
          currentDivs[curIdx] = mapped;
        } else {
          currentDivs.push(mapped);
        }
        localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(currentDivs));
        window.dispatchEvent(new Event('hrm_data_updated'));
        return mapped;
      }
    } catch (err) {
      console.error('[HRM] Error updating division in PostgreSQL:', err);
    }
    return updatedDiv;
  },

  deleteDivision: async (id: string): Promise<void> => {
    const divisions = hrmService.getDivisions().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(divisions));
    window.dispatchEvent(new Event('hrm_data_updated'));
    try {
      await api.delete(`/divisions/${id}`);
    } catch (err) {
      console.error('[HRM] Error deleting division from PostgreSQL:', err);
    }
  },

  getDivisionLocation: (divisionId?: string): {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } => {
    hrmService.init();
    const office = hrmService.getOfficeLocation();
    if (!divisionId) {
      return office;
    }
    const divisions = hrmService.getDivisions();
    const div = divisions.find((d) => d.id === divisionId);
    if (div && typeof div.latitude === 'number' && typeof div.longitude === 'number') {
      return {
        name: div.locationName || `Lokasi Divisi ${div.name}`,
        address: div.address || office.address,
        latitude: div.latitude,
        longitude: div.longitude,
        radiusMeters: div.radiusMeters || 150,
      };
    }
    return office;
  },

  getDivisionEmployees: (divisionId: string): UserProfile[] => {
    hrmService.init();
    const users = hrmService.getUsers();
    return users.filter((u) => u.divisionId === divisionId);
  },

  // SHIFTS
  getShifts: (): Shift[] => {
    hrmService.init();
    return safeGetJson<Shift[]>(STORAGE_KEYS.SHIFTS, DEFAULT_SHIFTS);
  },

  saveShifts: (shifts: Shift[]) => {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    window.dispatchEvent(new Event('hrm_shifts_updated'));
  },

  addShift: (shiftData: Omit<Shift, 'id'>): Shift => {
    const shifts = hrmService.getShifts();
    const newShift: Shift = {
      ...shiftData,
      id: `shift-${Date.now()}`,
      isDefault: shiftData.isDefault || false,
    };
    if (newShift.isDefault) {
      shifts.forEach((s) => (s.isDefault = false));
    }
    shifts.push(newShift);
    hrmService.saveShifts(shifts);
    return newShift;
  },

  updateShift: (id: string, shiftData: Partial<Shift>): Shift => {
    const shifts = hrmService.getShifts();
    const idx = shifts.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Shift tidak ditemukan');
    if (shiftData.isDefault) {
      shifts.forEach((s) => (s.isDefault = false));
    }
    shifts[idx] = { ...shifts[idx], ...shiftData };
    hrmService.saveShifts(shifts);
    return shifts[idx];
  },

  deleteShift: (id: string): boolean => {
    const shifts = hrmService.getShifts();
    const users = hrmService.getUsers();
    if (users.some((u) => u.shiftId === id)) {
      throw new Error('Shift tidak dapat dihapus karena masih digunakan oleh beberapa karyawan.');
    }
    const filtered = shifts.filter((s) => s.id !== id);
    if (filtered.length === 0) {
      throw new Error('Minimal harus ada 1 shift yang aktif di sistem.');
    }
    hrmService.saveShifts(filtered);
    return true;
  },

  setDefaultShift: (id: string) => {
    const shifts = hrmService.getShifts();
    shifts.forEach((s) => {
      s.isDefault = s.id === id;
    });
    hrmService.saveShifts(shifts);
  },

  // ─── EMPLOYEE ROSTER & SCHEDULE PERSISTENCE ──────────────────────────────
  getEmployeeSchedules: (filters?: {
    month?: number;
    year?: number;
    userId?: string;
    date?: string;
    divisionId?: string;
  }): EmployeeSchedule[] => {
    hrmService.init();
    const all = safeGetJson<EmployeeSchedule[]>(STORAGE_KEYS.EMPLOYEE_SCHEDULES, []);
    return all.filter((s) => {
      if (filters?.userId && s.userId !== filters.userId) return false;
      if (filters?.divisionId && filters.divisionId !== 'all' && s.divisionId !== filters.divisionId) return false;
      if (filters?.date && s.scheduleDate !== filters.date) return false;
      if (filters?.month && filters?.year) {
        const [y, m] = s.scheduleDate.split('-').map(Number);
        if (y !== filters.year || m !== filters.month) return false;
      }
      return true;
    });
  },

  getEmployeeTodaySchedule: (userId: string, dateStr?: string): EmployeeSchedule | null => {
    const targetDate = dateStr || getTodayDateStr();
    const schedules = hrmService.getEmployeeSchedules({ userId, date: targetDate });
    return schedules[0] || null;
  },

  saveEmployeeSchedules: async (
    schedules: EmployeeSchedule[]
  ): Promise<{ success: boolean; count: number }> => {
    hrmService.init();
    const existing = safeGetJson<EmployeeSchedule[]>(STORAGE_KEYS.EMPLOYEE_SCHEDULES, []);
    
    // Map existing by composite key userId_date
    const map = new Map<string, EmployeeSchedule>();
    existing.forEach((item) => {
      map.set(`${item.userId}_${item.scheduleDate}`, item);
    });

    // Upsert new ones
    schedules.forEach((item) => {
      map.set(`${item.userId}_${item.scheduleDate}`, {
        ...item,
        updatedAt: new Date().toISOString(),
      });
    });

    const merged = Array.from(map.values());
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_SCHEDULES, JSON.stringify(merged));
    window.dispatchEvent(new Event('hrm_schedules_updated'));

    // Attempt sync to PostgreSQL backend API
    try {
      await api.post('/employee-schedules/batch', { schedules });
    } catch (err: any) {
      console.warn('[HRM] Syncing schedules to PostgreSQL backend notice:', err.message || err);
    }

    return { success: true, count: schedules.length };
  },

  applyRosterToDatabase: async (
    result: GenerationResult,
    divisionId?: string
  ): Promise<{ success: boolean; count: number; message: string }> => {
    const users = hrmService.getUsers();
    const shifts = hrmService.getShifts();
    const scheduleItems: EmployeeSchedule[] = [];

    const monthStr = String(result.month).padStart(2, '0');

    result.rosters.forEach((r) => {
      const u = users.find((usr) => usr.id === r.employeeId);
      const userDivId = u?.divisionId || divisionId;

      Array.from({ length: result.daysInMonth }, (_, i) => i + 1).forEach((dayNum) => {
        const dayStr = String(dayNum).padStart(2, '0');
        const dateStr = `${result.year}-${monthStr}-${dayStr}`;
        const asg = r.assignments[dateStr];
        const code = asg?.shiftCode || 'OFF';

        let sName = 'Libur / Off';
        let sStart = '00:00';
        let sEnd = '00:00';
        let duration = 0;
        let isNight = false;
        let isOff = true;

        if (code === 'P') {
          sName = 'Shift Pagi (07:00 - 15:00 WIB)';
          sStart = '07:00';
          sEnd = '15:00';
          duration = 8;
          isOff = false;
        } else if (code === 'S') {
          sName = 'Shift Siang (15:00 - 23:00 WIB)';
          sStart = '15:00';
          sEnd = '23:00';
          duration = 8;
          isOff = false;
        } else if (code === 'M') {
          sName = 'Shift Malam (23:00 - 07:00 WIB)';
          sStart = '23:00';
          sEnd = '07:00';
          duration = 8;
          isNight = true;
          isOff = false;
        }

        const matchedMasterShift = shifts.find((sh) => sh.code === code);

        scheduleItems.push({
          id: `sched-${r.employeeId}-${dateStr}`,
          userId: r.employeeId,
          userName: r.employeeName,
          userNip: u?.nip || '',
          divisionId: userDivId,
          scheduleDate: dateStr,
          shiftId: matchedMasterShift?.id || asg?.shiftId || undefined,
          shiftCode: code,
          shiftName: matchedMasterShift?.name ? `${matchedMasterShift.name} (${sStart}-${sEnd})` : sName,
          startTime: matchedMasterShift?.startTime || sStart,
          endTime: matchedMasterShift?.endTime || sEnd,
          durationHours: duration,
          isNightShift: isNight,
          isOff,
          notes: `Jadwal Matriks ${result.month}/${result.year}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    });

    await hrmService.saveEmployeeSchedules(scheduleItems);

    // Broadcast in-app notification to all employees
    hrmService.addNotification({
      userId: 'all',
      title: `📅 Jadwal Shift ${result.month}/${result.year} Diterbitkan`,
      message: `Jadwal shift kerja untuk periode ${result.month}/${result.year} telah diterapkan ke sistem absensi. Silakan cek jadwal harian Anda pada dashboard.`,
      type: 'info',
      link: '/karyawan',
    });

    return {
      success: true,
      count: scheduleItems.length,
      message: `Berhasil menerapkan ${scheduleItems.length} jadwal kerja ke database & mengunci jam absensi karyawan!`,
    };
  },

  getSavedRosterResult: (
    month: number,
    year: number,
    divisionId?: string
  ): GenerationResult | null => {
    const schedules = hrmService.getEmployeeSchedules({ month, year, divisionId });
    if (schedules.length === 0) return null;

    const daysInMonth = new Date(year, month, 0).getDate();
    const rosterMap: Record<string, any> = {};

    schedules.forEach((s) => {
      if (!rosterMap[s.userId]) {
        rosterMap[s.userId] = {
          employeeId: s.userId,
          employeeName: s.userName,
          assignments: {},
          totalWorkHours: 0,
          totalWorkDays: 0,
          totalNightShifts: 0,
          totalOffDays: 0,
        };
      }

      const dt = new Date(s.scheduleDate);
      rosterMap[s.userId].assignments[s.scheduleDate] = {
        date: s.scheduleDate,
        dayOfWeek: dt.getDay(),
        shiftId: s.shiftId || '',
        shiftCode: s.shiftCode,
      };

      if (!s.isOff && s.shiftCode !== 'OFF') {
        rosterMap[s.userId].totalWorkHours += s.durationHours || 8;
        rosterMap[s.userId].totalWorkDays += 1;
        if (s.isNightShift || s.shiftCode === 'M') {
          rosterMap[s.userId].totalNightShifts += 1;
        }
      } else {
        rosterMap[s.userId].totalOffDays += 1;
      }
    });

    return {
      month,
      year,
      daysInMonth,
      rosters: Object.values(rosterMap),
      audit: {
        violations: [],
        fairnessIndex: 90,
        laborLawCompliance: true,
      },
    };
  },

  // ─── HRM IN-APP NOTIFICATIONS ─────────────────────────────────────────────
  getNotifications: (userId?: string, role?: string): HrmNotification[] => {
    hrmService.init();
    const all = safeGetJson<HrmNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    if (!userId && !role) return all;
    const normRole = (role || '').toLowerCase();

    return all.filter((n) => {
      // 1. Direct user match
      if (userId && n.userId === userId) return true;
      if (n.userId === 'all') return true;

      // 2. Role-based matching
      const nRole = (n.recipientRole || '').toLowerCase();
      if (normRole === 'superadmin') {
        // Superadmin receives all administrative & management notifications
        if (['superadmin', 'admin', 'hrd', 'pimpinan', 'all'].includes(nRole) || n.userId === 'all_admin') return true;
      } else if (normRole === 'pimpinan') {
        if (['pimpinan', 'admin', 'all'].includes(nRole) || n.userId === 'all_admin') return true;
      } else if (['admin', 'hrd'].includes(normRole)) {
        if (['admin', 'hrd', 'all'].includes(nRole) || n.userId === 'all_admin') return true;
      }

      if (nRole && nRole === normRole) return true;
      return false;
    });
  },

  fetchBackendNotifications: async (userId?: string, role?: string): Promise<HrmNotification[]> => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (role) params.append('role', role);
      const res = await api.get<{ success: boolean; data: any[] }>(`/notifications?${params.toString()}`);
      if (res && res.success && Array.isArray(res.data)) {
        const mappedNotifs: HrmNotification[] = res.data.map((n: any) => ({
          id: n.id,
          userId: n.user_id || undefined,
          recipientRole: n.recipient_role || undefined,
          title: n.title,
          message: n.message,
          type: n.type || 'info',
          isRead: n.is_read === true,
          link: n.link || undefined,
          createdAt: n.created_at,
          metadata: n.metadata,
        }));
        
        // Merge with existing local notifications to prevent losing offline items
        const existing = safeGetJson<HrmNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
        const idMap = new Map<string, HrmNotification>();
        mappedNotifs.forEach((n) => idMap.set(n.id, n));
        existing.forEach((n) => {
          if (!idMap.has(n.id)) idMap.set(n.id, n);
        });
        const merged = Array.from(idMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(merged.slice(0, 150)));
        window.dispatchEvent(new Event('hrm_notifications_updated'));
        return hrmService.getNotifications(userId, role);
      }
    } catch (_) {}
    return hrmService.getNotifications(userId, role);
  },

  addNotification: (
    notif: Omit<HrmNotification, 'id' | 'createdAt' | 'isRead'>
  ): HrmNotification => {
    const all = safeGetJson<HrmNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const newNotif: HrmNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    all.unshift(newNotif);
    // Keep last 150 notifications
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all.slice(0, 150)));
    window.dispatchEvent(new Event('hrm_notifications_updated'));
    
    // Also push to backend asynchronously
    api.post('/notifications', {
      userId: notif.userId,
      recipientRole: notif.recipientRole,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      link: notif.link,
      metadata: notif.metadata,
    }).catch(() => null);

    return newNotif;
  },

  markNotificationAsRead: (id: string) => {
    const all = safeGetJson<HrmNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const idx = all.findIndex((n) => n.id === id);
    if (idx !== -1) {
      all[idx].isRead = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
      window.dispatchEvent(new Event('hrm_notifications_updated'));
    }
    // Asynchronously update backend database
    api.patch(`/notifications/${id}/read`, {}).catch(() => null);
  },

  markAllNotificationsAsRead: (userId?: string, role?: string) => {
    const all = safeGetJson<HrmNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    all.forEach((n) => {
      n.isRead = true;
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
    window.dispatchEvent(new Event('hrm_notifications_updated'));
    api.post('/notifications/read-all', { userId, role }).catch(() => null);
  },

  clearNotifications: (userId?: string) => {
    if (!userId) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    } else {
      const all = safeGetJson<HrmNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
      const remaining = all.filter((n) => n.userId !== userId);
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(remaining));
    }
    window.dispatchEvent(new Event('hrm_notifications_updated'));
  },

  // OFFICE GEOFENCE
  getOfficeLocation: (): OfficeLocation => {
    hrmService.init();
    return safeGetJson<OfficeLocation>(STORAGE_KEYS.OFFICE, DEFAULT_OFFICE);
  },

  updateOfficeLocation: async (office: OfficeLocation): Promise<OfficeLocation> => {
    localStorage.setItem(STORAGE_KEYS.OFFICE, JSON.stringify(office));
    window.dispatchEvent(new Event('hrm_data_updated'));
    try {
      const res = await api.put<{ success: boolean; data: any }>('/office', office);
      if (res && res.success && res.data) {
        const d = res.data;
        const mapped: OfficeLocation = {
          id: d.id,
          name: d.name,
          address: d.address,
          latitude: typeof d.latitude === 'number' ? d.latitude : parseFloat(d.latitude),
          longitude: typeof d.longitude === 'number' ? d.longitude : parseFloat(d.longitude),
          radiusMeters: d.radiusMeters || d.radius_meters || 100,
          isActive: d.isActive !== undefined ? d.isActive : d.is_active,
        };
        localStorage.setItem(STORAGE_KEYS.OFFICE, JSON.stringify(mapped));
        window.dispatchEvent(new Event('hrm_data_updated'));
        return mapped;
      }
    } catch (err) {
      console.error('[HRM] Error updating office location in PostgreSQL:', err);
    }
    return office;
  },

  // USERS (EMPLOYEES)
  getUsers: (): UserProfile[] => {
    hrmService.init();
    return safeGetJson<UserProfile[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
  },

  addUser: (user: Omit<UserProfile, 'id' | 'createdAt'>): UserProfile => {
    const users = hrmService.getUsers();
    if (users.some((u) => u.nip.toLowerCase() === user.nip.toLowerCase())) {
      throw new Error(`NIP ${user.nip} sudah digunakan oleh karyawan lain`);
    }
    if (users.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
      throw new Error(`Email ${user.email} sudah terdaftar`);
    }

    const newUser: UserProfile = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Persist to PostgreSQL database directly
    api.post('/users', user)
      .then((res: any) => {
        if (res?.data?.id) {
          newUser.id = res.data.id;
          const currentUsers = hrmService.getUsers();
          const foundIdx = currentUsers.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
          if (foundIdx !== -1) {
            currentUsers[foundIdx] = { ...currentUsers[foundIdx], id: res.data.id };
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));
          }
        }
        hrmService.syncWithBackend().catch(() => null);
      })
      .catch((err) => console.warn('[AddUser] Backend sync warning:', err));

    return newUser;
  },

  bulkAddUsers: (
    newUsers: Array<Omit<UserProfile, 'id' | 'createdAt'>>
  ): { successCount: number; failedCount: number; errors: string[]; addedUsers: UserProfile[] } => {
    hrmService.init();
    const currentUsers = hrmService.getUsers();
    const addedUsers: UserProfile[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    newUsers.forEach((u, index) => {
      const rowNum = index + 1;
      const cleanNip = (u.nip || '').trim();
      const cleanEmail = (u.email || '').trim().toLowerCase();

      if (!cleanNip) {
        errors.push(`Baris ${rowNum}: NIP tidak boleh kosong.`);
        failedCount++;
        return;
      }
      if (!u.fullName?.trim()) {
        errors.push(`Baris ${rowNum} (${cleanNip}): Nama lengkap tidak boleh kosong.`);
        failedCount++;
        return;
      }
      if (!cleanEmail) {
        errors.push(`Baris ${rowNum} (${cleanNip}): Email tidak boleh kosong.`);
        failedCount++;
        return;
      }

      // Check duplicate against existing and newly added in this batch
      const duplicateNip =
        currentUsers.some((ex) => ex.nip.toLowerCase() === cleanNip.toLowerCase()) ||
        addedUsers.some((ad) => ad.nip.toLowerCase() === cleanNip.toLowerCase());

      if (duplicateNip) {
        errors.push(`Baris ${rowNum}: NIP ${cleanNip} sudah ada di sistem.`);
        failedCount++;
        return;
      }

      const duplicateEmail =
        currentUsers.some((ex) => ex.email.toLowerCase() === cleanEmail) ||
        addedUsers.some((ad) => ad.email.toLowerCase() === cleanEmail);

      if (duplicateEmail) {
        errors.push(`Baris ${rowNum}: Email ${cleanEmail} sudah terdaftar.`);
        failedCount++;
        return;
      }

      const created: UserProfile = {
        ...u,
        nip: cleanNip,
        fullName: u.fullName.trim(),
        email: cleanEmail,
        id: `usr-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        password: u.password || 'password123',
        isActive: u.isActive ?? true,
        annualLeaveQuota: u.annualLeaveQuota || 12,
        usedLeaveDays: u.usedLeaveDays || 0,
        createdAt: new Date().toISOString(),
      };

      addedUsers.push(created);
      currentUsers.push(created);
      successCount++;
    });

    if (successCount > 0) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));
      // Persist all added users to backend asynchronously
      Promise.all(addedUsers.map((u) => api.post('/users', u).catch(() => null)))
        .then(() => hrmService.syncWithBackend().catch(() => null));
    }

    return { successCount, failedCount, errors, addedUsers };
  },

  updateUser: (id: string, updates: Partial<UserProfile>): UserProfile => {
    const users = hrmService.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      window.dispatchEvent(new Event('hrm_users_updated'));

      // Persist to PostgreSQL database directly
      api.put(`/users/${id}`, { ...users[idx], ...updates })
        .then(() => {
          hrmService.syncWithBackend().catch(() => null);
        })
        .catch((err) => console.warn('[UpdateUser] Backend sync warning:', err));

      return users[idx];
    }
    throw new Error('User tidak ditemukan');
  },

  // ─── ADMIN LOCATION / DIVISION REASSIGNMENT & MUTATION ───────────────────
  assignUserDivision: (
    userId: string,
    newDivisionId: string,
    notes?: string,
    adminName = 'Superadmin'
  ): UserProfile => {
    const users = hrmService.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    if (userIdx === -1) throw new Error('Karyawan tidak ditemukan');

    const divisions = hrmService.getDivisions();
    const targetDivision = divisions.find((d) => d.id === newDivisionId);
    if (!targetDivision) throw new Error('Divisi tujuan tidak ditemukan');

    const user = users[userIdx];
    const prevDivisionName = user.divisionName || 'Tanpa Divisi';

    // Save original division if not already in mutation state
    const originalDivisionId = user.originalDivisionId || user.divisionId;
    const originalDivisionName = user.originalDivisionName || user.divisionName;

    user.originalDivisionId = originalDivisionId;
    user.originalDivisionName = originalDivisionName;
    user.divisionId = newDivisionId;
    user.divisionName = targetDivision.name;
    user.assignmentNotes = notes || undefined;

    users[userIdx] = user;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('hrm_users_updated'));

    // Send Notification to Employee
    hrmService.addNotification({
      userId: user.id,
      recipientRole: 'karyawan',
      title: 'Pemindahan Lokasi / Divisi Kerja',
      message: `Anda telah dialihkan ke Divisi ${targetDivision.name} (${targetDivision.locationName || targetDivision.address}). Koordinat GPS dan Barcode presensi Anda telah disesuaikan.${notes ? ' Catatan: ' + notes : ''}`,
      type: 'transfer',
      metadata: {
        employeeId: user.id,
        employeeName: user.fullName,
        divisionId: targetDivision.id,
        divisionName: targetDivision.name,
        previousDivisionName: prevDivisionName,
        actionByAdminName: adminName,
      },
    });

    // Send Notification to Admin Log
    hrmService.addNotification({
      userId: 'all_admin',
      recipientRole: 'admin',
      title: 'Pemindahan Lokasi Karyawan Berhasil',
      message: `Karyawan ${user.fullName} (${user.nip}) berhasil dipindahkan dari ${prevDivisionName} ke ${targetDivision.name} oleh ${adminName}.`,
      type: 'transfer',
      metadata: {
        employeeId: user.id,
        employeeName: user.fullName,
        divisionId: targetDivision.id,
        divisionName: targetDivision.name,
        actionByAdminName: adminName,
      },
    });

    return user;
  },

  restoreUserOriginalDivision: (userId: string, adminName = 'Superadmin'): UserProfile => {
    const users = hrmService.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    if (userIdx === -1) throw new Error('Karyawan tidak ditemukan');

    const user = users[userIdx];
    if (!user.originalDivisionId) {
      throw new Error('Karyawan ini tidak memiliki catatan divisi asal / belum pernah dipindahkan.');
    }

    const divisions = hrmService.getDivisions();
    const origDiv = divisions.find((d) => d.id === user.originalDivisionId);
    const targetName = origDiv ? origDiv.name : (user.originalDivisionName || 'Divisi Asal');
    const currentDivName = user.divisionName || '-';

    user.divisionId = user.originalDivisionId;
    user.divisionName = targetName;
    user.originalDivisionId = undefined;
    user.originalDivisionName = undefined;
    user.assignmentNotes = undefined;

    users[userIdx] = user;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('hrm_users_updated'));

    // Send Notification to Employee
    hrmService.addNotification({
      userId: user.id,
      recipientRole: 'karyawan',
      title: 'Pengembalian ke Divisi Asal',
      message: `Masa penugasan Anda telah selesai. Anda telah dikembalikan ke divisi asal: ${targetName}.`,
      type: 'transfer',
      metadata: {
        employeeId: user.id,
        employeeName: user.fullName,
        divisionName: targetName,
        actionByAdminName: adminName,
      },
    });

    // Send Notification to Admin Log
    hrmService.addNotification({
      userId: 'all_admin',
      recipientRole: 'admin',
      title: 'Karyawan Dikembalikan ke Divisi Asal',
      message: `Karyawan ${user.fullName} (${user.nip}) telah dikembalikan dari ${currentDivName} ke divisi asal ${targetName}.`,
      type: 'transfer',
      metadata: {
        employeeId: user.id,
        employeeName: user.fullName,
        divisionName: targetName,
        actionByAdminName: adminName,
      },
    });

    return user;
  },

  deleteUser: (id: string) => {
    const users = hrmService.getUsers().filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('hrm_users_updated'));

    // Delete from PostgreSQL database directly
    api.delete(`/users/${id}`)
      .then(() => {
        hrmService.syncWithBackend().catch(() => null);
      })
      .catch((err) => console.warn('[DeleteUser] Backend sync warning:', err));
  },

  // ─── BIOMETRIC FACE RECOGNITION (MASTER ENROLLMENT & RESET) ──────────────
  enrollMasterFace: async (
    userId: string,
    descriptor: number[],
    photoUrl: string
  ): Promise<UserProfile> => {
    const users = hrmService.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Karyawan tidak ditemukan');

    const nowIso = new Date().toISOString();
    users[idx].isFaceEnrolled = true;
    users[idx].faceDescriptor = descriptor;
    users[idx].faceEnrolledPhoto = photoUrl;
    users[idx].faceEnrolledAt = nowIso;
    users[idx].avatarUrl = photoUrl;

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Update current user in session if matches
    const currentUser = safeGetJson<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(users[idx]));
    }

    window.dispatchEvent(new Event('hrm_users_updated'));

    // Persist to PostgreSQL backend database
    try {
      const res = await api.post<{ success: boolean; data: UserProfile }>('/biometrics/enroll', {
        userId,
        faceDescriptor: descriptor,
        enrolledPhoto: photoUrl,
      });
      if (res && res.success && res.data) {
        users[idx] = { ...users[idx], ...res.data };
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        if (currentUser && currentUser.id === userId) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(users[idx]));
        }
      }
    } catch (err) {
      console.warn('[Biometrics] Syncing master face to backend warning:', err);
    }

    return users[idx];
  },

  resetMasterFace: async (userId: string): Promise<UserProfile> => {
    const users = hrmService.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Karyawan tidak ditemukan');

    users[idx].isFaceEnrolled = false;
    users[idx].faceDescriptor = undefined;
    users[idx].faceEnrolledPhoto = undefined;
    users[idx].faceEnrolledAt = undefined;

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const currentUser = safeGetJson<UserProfile | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(users[idx]));
    }

    window.dispatchEvent(new Event('hrm_users_updated'));

    // Sync with PostgreSQL backend database
    try {
      await api.post(`/biometrics/reset/${userId}`, {});
    } catch (err) {
      console.warn('[Biometrics] Backend face reset warning:', err);
    }

    return users[idx];
  },

  // ATTENDANCES
  getAttendances: (date?: string): AttendanceRecord[] => {
    hrmService.init();
    const all: AttendanceRecord[] = safeGetJson<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, []);
    if (date) {
      return all.filter((a) => a.attendanceDate === date);
    }
    return all;
  },

  getUserTodayAttendance: (userId: string): AttendanceRecord | undefined => {
    const today = getTodayDateStr();
    const list = hrmService.getAttendances(today);
    return list.find((a) => a.userId === userId);
  },

  // ─── ANTI-FRAUD & SECURITY ENGINE ──────────────────────────────────────────
  getDeviceFingerprint: (): string => {
    let fp = localStorage.getItem('hrm_device_fingerprint');
    if (!fp) {
      const ua = navigator.userAgent;
      const screenRes = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'desktop';
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      fp = `DEV-${btoa(ua.slice(0, 10) + screenRes).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}-${rand}`;
      localStorage.setItem('hrm_device_fingerprint', fp);
    }
    return fp;
  },

  getDeviceModel: (): string => {
    if (typeof navigator === 'undefined') return 'Web Client';
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Android Device';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'Apple iOS Device';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Macintosh/i.test(ua)) return 'Mac OS Device';
    if (/Linux/i.test(ua)) return 'Linux Workstation';
    return 'Web Browser Device';
  },

  resetUserDeviceBinding: (userId: string): boolean => {
    const users = hrmService.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    users[idx].registeredDeviceId = undefined;
    users[idx].deviceModel = undefined;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    window.dispatchEvent(new Event('hrm_users_updated'));
    return true;
  },

  getDynamicOfficeQrCode: (divisionId?: string): { code: string; expiresAt: number; remainingSeconds: number } => {
    const intervalSec = 10;
    const now = Date.now();
    const slot = Math.floor(now / (intervalSec * 1000));

    // Kode acak penggabungan angka dan huruf (tidak mudah ditebak, berubah tiap 10 detik)
    const generateSecureToken = (s: number, divId?: string): string => {
      let hash = 0x811c9dc5;
      const seedStr = `HRM_AUTH_SEC_${s}_${divId || 'HQ'}_2026_PERWIRA`;
      for (let i = 0; i < seedStr.length; i++) {
        hash ^= seedStr.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = 'HRM-';
      let n = Math.abs(hash);
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        n = (n * 1664525 + 1013904223) >>> 0;
        code += chars[n % chars.length];
      }
      return code;
    };

    const token = generateSecureToken(slot, divisionId);
    const expiresAt = (slot + 1) * intervalSec * 1000;
    const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    return { code: token, expiresAt, remainingSeconds };
  },

  validateDynamicOfficeQrCode: (scannedCode: string, divisionId?: string): boolean => {
    if (!scannedCode) return false;
    const intervalSec = 10;
    const now = Date.now();
    const currentSlot = Math.floor(now / (intervalSec * 1000));
    const cleanScanned = scannedCode.trim().toUpperCase();

    const generateSecureToken = (s: number, divId?: string): string => {
      let hash = 0x811c9dc5;
      const seedStr = `HRM_AUTH_SEC_${s}_${divId || 'HQ'}_2026_PERWIRA`;
      for (let i = 0; i < seedStr.length; i++) {
        hash ^= seedStr.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = 'HRM-';
      let n = Math.abs(hash);
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        n = (n * 1664525 + 1013904223) >>> 0;
        code += chars[n % chars.length];
      }
      return code;
    };

    // Validasi slot sekarang dan 1 slot sebelumnya (toleransi jeda scan)
    for (let offset = 0; offset <= 1; offset++) {
      const slot = currentSlot - offset;
      const expected = generateSecureToken(slot, divisionId);
      if (cleanScanned === expected) return true;
    }
    return false;
  },

  recordClockIn: (data: {
    userId: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    notes?: string;
    deviceId?: string;
    isMockSuspected?: boolean;
    securityFlags?: string[];
    biometricScore?: number;
    biometricMatch?: boolean;
    geofenceDistance?: number;
    geofenceValid?: boolean;
    isMockLocation?: boolean;
  }): AttendanceRecord => {
    const today = getTodayDateStr();
    const existing = hrmService.getUserTodayAttendance(data.userId);
    if (existing && existing.clockIn) {
      throw new Error('Anda sudah melakukan presensi masuk hari ini');
    }

    const users = hrmService.getUsers();
    const userIdx = users.findIndex((u) => u.id === data.userId);
    if (userIdx === -1) throw new Error('Pengguna tidak ditemukan');
    const user = users[userIdx];

    const currentDeviceId = data.deviceId || hrmService.getDeviceFingerprint();
    const currentModel = hrmService.getDeviceModel();
    const flags = [...(data.securityFlags || [])];

    // Device Binding Enforcement (Anti Titip Absen)
    if (!user.registeredDeviceId) {
      // First time device registration
      user.registeredDeviceId = currentDeviceId;
      user.deviceModel = currentModel;
      users[userIdx] = user;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      flags.push('DEVICE_BOUND_INITIAL');
    } else if (user.registeredDeviceId === currentDeviceId) {
      flags.push('DEVICE_MATCH_OK');
    } else {
      // Device mismatch (possible account sharing)
      flags.push('DEVICE_MISMATCH_DETECTED');
    }

    if (data.biometricMatch === true) {
      flags.push('BIOMETRIC_1TO1_MATCH_VERIFIED');
    } else if (data.biometricMatch === false) {
      flags.push('BIOMETRIC_1TO1_MISMATCH_SUSPECTED');
    }

    if (data.geofenceValid === true) {
      flags.push(`GEOFENCE_VERIFIED_${Math.round(data.geofenceDistance || 0)}M`);
    } else if (data.geofenceValid === false) {
      flags.push(`GEOFENCE_BREACH_${Math.round(data.geofenceDistance || 0)}M`);
    }

    // Evaluate Security Score
    let securityScore = 100;
    if (flags.includes('DEVICE_MISMATCH_DETECTED')) securityScore -= 35;
    if (flags.includes('BIOMETRIC_1TO1_MISMATCH_SUSPECTED')) securityScore -= 50;
    if (data.isMockSuspected || data.isMockLocation) securityScore -= 40;
    if (!data.photoUrl) securityScore -= 20;

    const shifts = hrmService.getShifts();
    const userShift = shifts.find((s) => s.id === user.shiftId) || shifts[0];

    // Priority 1: Check dynamic employee schedule from database roster for today
    const dailySchedule = hrmService.getEmployeeTodaySchedule(user.id, today);
    const activeStartTime = dailySchedule ? dailySchedule.startTime : userShift.startTime;
    const activeShiftCode = dailySchedule ? dailySchedule.shiftCode : (userShift.code || 'REG');
    const activeShiftName = dailySchedule ? dailySchedule.shiftName : userShift.name;

    const now = new Date();
    const clockInStr = now.toTimeString().split(' ')[0];

    const [shiftHour, shiftMinute] = activeStartTime.split(':').map(Number);
    const shiftStartTotalMinutes = shiftHour * 60 + shiftMinute;
    const tolerance = userShift.lateToleranceMinutes || 15;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    let status: AttendanceStatus = 'hadir';
    let lateMinutes = 0;

    let notesText = data.notes || 'Presensi masuk terverifikasi sistem';
    if (dailySchedule && dailySchedule.isOff) {
      notesText = `[Jadwal Libur/OFF] ${notesText}`;
    }

    if (!dailySchedule?.isOff && currentTotalMinutes > shiftStartTotalMinutes + tolerance) {
      status = 'terlambat';
      lateMinutes = currentTotalMinutes - (shiftStartTotalMinutes + tolerance);
    }

    const all = hrmService.getAttendances();
    const newRecord: AttendanceRecord = {
      id: existing ? existing.id : `att-${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      userNip: user.nip,
      userAvatar: user.avatarUrl,
      divisionName: user.divisionName || '-',
      attendanceDate: today,
      clockIn: clockInStr,
      latIn: data.latitude,
      longIn: data.longitude,
      photoIn: data.photoUrl,
      status,
      lateMinutes,
      earlyLeavingMinutes: 0,
      workDurationMinutes: 0,
      notes: notesText,
      shiftId: dailySchedule?.shiftId || userShift.id,
      shiftCode: activeShiftCode,
      shiftName: activeShiftName,
      deviceId: currentDeviceId,
      isMockSuspected: Boolean(data.isMockSuspected || data.isMockLocation),
      securityScore: Math.max(0, securityScore),
      securityFlags: flags,
      biometricScore: data.biometricScore,
      biometricMatch: data.biometricMatch,
      geofenceDistance: data.geofenceDistance,
      geofenceValid: data.geofenceValid,
      isMockLocation: data.isMockLocation,
    };

    if (existing) {
      const idx = all.findIndex((a) => a.id === existing.id);
      all[idx] = newRecord;
    } else {
      all.push(newRecord);
    }

    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(all));

    // Push clock-in to PostgreSQL backend API
    api.post('/attendances/clock-in', {
      userId: user.id,
      date: today,
      time: clockInStr,
      photo: data.photoUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      status,
      lateMinutes,
      notes: data.notes || '',
      biometricScore: data.biometricScore,
      biometricMatch: data.biometricMatch,
      geofenceDistance: data.geofenceDistance,
      geofenceValid: data.geofenceValid,
      isMockLocation: data.isMockLocation,
      securityFlags: flags,
    }).catch((err) => console.warn('[Attendance] Backend clock-in warning:', err));

    return newRecord;
  },

  recordClockOut: (data: {
    userId: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    notes?: string;
    deviceId?: string;
    isMockSuspected?: boolean;
    securityFlags?: string[];
    biometricScore?: number;
    biometricMatch?: boolean;
    geofenceDistance?: number;
    geofenceValid?: boolean;
    isMockLocation?: boolean;
  }): AttendanceRecord => {
    const existing = hrmService.getUserTodayAttendance(data.userId);
    if (!existing || !existing.clockIn) {
      throw new Error('Anda belum melakukan presensi masuk hari ini');
    }
    if (existing.clockOut) {
      throw new Error('Anda sudah melakukan presensi pulang hari ini');
    }

    if (existing.isLocked || existing.isPerimeterBreached) {
      throw new Error('Presensi Pulang Terkunci: Terdeteksi pelanggaran perimeter kerja (meninggalkan area kerja saat jam kantor tanpa izin resmi). Presensi checkout dibekukan demi integritas audit.');
    }

    const currentDeviceId = data.deviceId || hrmService.getDeviceFingerprint();
    const flags = existing.securityFlags ? [...existing.securityFlags] : [];
    if (data.securityFlags) {
      data.securityFlags.forEach((f) => {
        if (!flags.includes(f)) flags.push(f);
      });
    }

    const users = hrmService.getUsers();
    const user = users.find((u) => u.id === data.userId);
    if (user && user.registeredDeviceId && user.registeredDeviceId !== currentDeviceId) {
      flags.push('CLOCKOUT_DEVICE_MISMATCH');
    }

    if (data.biometricMatch === true) {
      flags.push('BIOMETRIC_CLOCKOUT_MATCH_VERIFIED');
    }

    if (data.geofenceValid === true) {
      flags.push(`GEOFENCE_OUT_VERIFIED_${Math.round(data.geofenceDistance || 0)}M`);
    }

    const now = new Date();
    const clockOutStr = now.toTimeString().split(' ')[0];

    const [inH, inM] = existing.clockIn.split(':').map(Number);
    const inTotalMins = inH * 60 + inM;
    const outTotalMins = now.getHours() * 60 + now.getMinutes();
    const durationMins = Math.max(0, outTotalMins - inTotalMins);

    const all = hrmService.getAttendances();
    const idx = all.findIndex((a) => a.id === existing.id);

    existing.clockOut = clockOutStr;
    existing.latOut = data.latitude;
    existing.longOut = data.longitude;
    existing.photoOut = data.photoUrl;
    existing.workDurationMinutes = durationMins;
    if (data.notes) existing.notes = (existing.notes ? existing.notes + ' | ' : '') + data.notes;
    existing.securityFlags = flags;
    if (data.isMockSuspected || data.isMockLocation) existing.isMockSuspected = true;
    if (data.biometricScore != null) existing.biometricScore = data.biometricScore;
    if (data.biometricMatch != null) existing.biometricMatch = data.biometricMatch;
    if (data.geofenceDistance != null) existing.geofenceDistance = data.geofenceDistance;
    if (data.geofenceValid != null) existing.geofenceValid = data.geofenceValid;
    if (data.isMockLocation != null) existing.isMockLocation = data.isMockLocation;

    all[idx] = existing;
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(all));

    // Push clock-out to PostgreSQL backend API
    api.post('/attendances/clock-out', {
      userId: existing.userId,
      date: existing.attendanceDate,
      time: clockOutStr,
      photo: data.photoUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      earlyLeavingMinutes: existing.earlyLeavingMinutes || 0,
      workDurationMinutes: durationMins,
      biometricScore: data.biometricScore,
      biometricMatch: data.biometricMatch,
      geofenceDistance: data.geofenceDistance,
      geofenceValid: data.geofenceValid,
      isMockLocation: data.isMockLocation,
      securityFlags: flags,
    }).catch((err) => console.warn('[Attendance] Backend clock-out warning:', err));

    return existing;
  },

  // Get user's effective work location based on their division or headquarters
  getUserWorkLocation: (
    userId: string
  ): {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    locationName: string;
    divisionName: string;
  } => {
    const user = hrmService.getUsers().find((u) => u.id === userId);
    const divisions = hrmService.getDivisions();
    const office = hrmService.getOfficeLocation();

    if (user && user.divisionId) {
      const div = divisions.find((d) => d.id === user.divisionId);
      if (div && typeof div.latitude === 'number' && typeof div.longitude === 'number') {
        return {
          latitude: div.latitude,
          longitude: div.longitude,
          radiusMeters: div.radiusMeters || 150,
          locationName: div.locationName || `Gedung Divisi ${div.name}`,
          divisionName: div.name,
        };
      }
    }

    return {
      latitude: office.latitude,
      longitude: office.longitude,
      radiusMeters: office.radiusMeters || 150,
      locationName: office.name,
      divisionName: user?.divisionName || 'Pusat',
    };
  },

  // Auto-lock attendances for employees who forgot to selfie checkout
  autoLockExpiredAttendances: (): number => {
    const today = getTodayDateStr();
    const attendances = hrmService.getAttendances(today);
    const users = hrmService.getUsers();
    const shifts = hrmService.getShifts();
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let lockedCount = 0;
    const all = hrmService.getAttendances();

    attendances.forEach((att) => {
      if (att.clockIn && !att.clockOut) {
        const user = users.find((u) => u.id === att.userId);
        const shift = shifts.find((s) => s.id === user?.shiftId) || shifts[0];
        const dailySchedule = hrmService.getEmployeeTodaySchedule(att.userId, today);
        const activeEndTime = dailySchedule && !dailySchedule.isOff ? dailySchedule.endTime : shift.endTime;
        const [endH, endM] = activeEndTime.split(':').map(Number);
        const shiftEndMins = endH * 60 + endM;

        // Check if user has an approved overtime today
        const ot = hrmService.getUserTodayApprovedOvertime(att.userId, today);
        let allowedEndMins = shiftEndMins;
        if (ot && ot.endTime) {
          const [otH, otM] = ot.endTime.split(':').map(Number);
          allowedEndMins = otH * 60 + otM;
        }

        // Tolerance: 90 minutes after allowed end time
        if (currentMins >= allowedEndMins + 90) {
          const idx = all.findIndex((a) => a.id === att.id);
          if (idx !== -1) {
            const clockOutTime = ot && ot.endTime ? ot.endTime + ':00' : shift.endTime + ':00';
            const [inH, inM] = att.clockIn.split(':').map(Number);
            const inMins = inH * 60 + inM;
            const duration = Math.max(0, allowedEndMins - inMins);

            const flags = att.securityFlags ? [...att.securityFlags] : [];
            flags.push('AUTO_CLOCKOUT_FORGOTTEN_SELFIE');

            all[idx] = {
              ...all[idx],
              clockOut: clockOutTime,
              workDurationMinutes: duration,
              securityFlags: flags,
              notes: (all[idx].notes ? all[idx].notes + ' | ' : '') + 'Terkunci otomatis oleh sistem (lupa selfie checkout)',
            };

            lockedCount++;

            // Send notification to employee
            hrmService.addNotification({
              userId: att.userId,
              recipientRole: 'karyawan',
              title: 'Kepulangan Terkunci Otomatis',
              message: `Anda tidak melakukan selfie checkout pada hari ini. Sistem telah mengunci jam pulang Anda pada pukul ${clockOutTime.slice(0, 5)} WIB secara otomatis.`,
              type: 'warning',
              metadata: {
                attendanceId: att.id,
                date: today,
              },
            });
          }
        }
      }
    });

    if (lockedCount > 0) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(all));
      window.dispatchEvent(new Event('hrm_attendance_updated'));
    }

    return lockedCount;
  },

  // LEAVE REQUESTS
  getLeaves: (): LeaveRequest[] => {
    hrmService.init();
    const leaves = safeGetJson<LeaveRequest[]>(STORAGE_KEYS.LEAVES, []);
    const users = hrmService.getUsers();
    return leaves.map((l) => {
      if (!l.userName || l.userName === 'Karyawan' || !l.userNip) {
        const u = users.find((usr) => usr.id === l.userId || usr.email === l.userId || usr.nip === l.userId);
        if (u) {
          return {
            ...l,
            userName: l.userName && l.userName !== 'Karyawan' ? l.userName : u.fullName,
            userNip: l.userNip || u.nip,
            divisionName: l.divisionName && l.divisionName !== '-' ? l.divisionName : (u.divisionName || u.division || '-'),
          };
        }
      }
      return l;
    });
  },

  getUserLeaves: (userId: string): LeaveRequest[] => {
    return hrmService.getLeaves().filter((l) => l.userId === userId);
  },

  createLeaveRequest: (req: {
    userId: string;
    leaveType: LeaveRequest['leaveType'];
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string;
  }): LeaveRequest => {
    const user = hrmService.getUsers().find((u) => u.id === req.userId);
    if (!user) throw new Error('Pengguna tidak ditemukan');

    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leaves = hrmService.getLeaves();
    const newLeave: LeaveRequest = {
      id: `leave-${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      userNip: user.nip,
      divisionName: user.divisionName || '-',
      leaveType: req.leaveType,
      startDate: req.startDate,
      endDate: req.endDate,
      totalDays,
      reason: req.reason,
      attachmentUrl: req.attachmentUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    leaves.unshift(newLeave);
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaves));
    return newLeave;
  },

  updateLeaveStatus: (
    leaveId: string,
    status: 'approved' | 'rejected',
    approverId: string,
    notes?: string
  ): LeaveRequest => {
    const leaves = hrmService.getLeaves();
    const idx = leaves.findIndex((l) => l.id === leaveId);
    if (idx === -1) throw new Error('Pengajuan tidak ditemukan');

    const approver = hrmService.getUsers().find((u) => u.id === approverId);

    leaves[idx].status = status;
    leaves[idx].approvedBy = approverId;
    leaves[idx].approvedByName = approver?.fullName || 'HRD / Pimpinan';
    leaves[idx].approvalNotes = notes;

    if (status === 'approved' && leaves[idx].leaveType === 'cuti_tahunan') {
      const users = hrmService.getUsers();
      const uIdx = users.findIndex((u) => u.id === leaves[idx].userId);
      if (uIdx !== -1) {
        users[uIdx].usedLeaveDays = (users[uIdx].usedLeaveDays || 0) + leaves[idx].totalDays;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
    }

    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaves));
    window.dispatchEvent(new Event('hrm_leaves_updated'));

    // Asynchronously push approval/rejection to backend database
    api.put(`/leaves/${leaveId}/status`, {
      status,
      approverId,
      approverName: approver?.fullName || 'Atasan / HRD',
      notes,
    }).catch((err) => {
      console.warn('[HRM] Warning syncing leave status to backend:', err);
    });

    return leaves[idx];
  },

  // ANALYTICS & VISUALIZATION DATA
  getAttendanceTrend: (days: number = 7) => {
    hrmService.init();
    const attendances = hrmService.getAttendances();
    const result: Array<{
      date: string;
      displayDate: string;
      hadir: number;
      terlambat: number;
      izin: number;
      rate: number;
    }> = [];

    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

      const dayRecords = attendances.filter((a) => a.attendanceDate === dateStr);
      let hadir = dayRecords.filter((a) => a.status === 'hadir').length;
      let terlambat = dayRecords.filter((a) => a.status === 'terlambat').length;
      let izin = dayRecords.filter((a) => a.status === 'izin' || a.status === 'sakit' || a.status === 'cuti').length;

      // If simulated past days have zero records, supply realistic demo trends for rich visualization
      if (dayRecords.length === 0 && i > 0) {
        hadir = Math.floor(4 + (i % 3));
        terlambat = Math.floor(1 + ((i * 2) % 2));
        izin = i % 2 === 0 ? 1 : 0;
      }

      const total = hadir + terlambat + izin;
      const rate = total > 0 ? Math.round((hadir / (hadir + terlambat)) * 100) : 100;

      result.push({
        date: dateStr,
        displayDate,
        hadir,
        terlambat,
        izin,
        rate,
      });
    }

    return result;
  },

  getDivisionAnalytics: () => {
    hrmService.init();
    const divisions = hrmService.getDivisions();
    const users = hrmService.getUsers();
    const attendances = hrmService.getAttendances();

    return divisions.map((d) => {
      const divEmployees = users.filter((u) => u.divisionId === d.id);
      const divAttendances = attendances.filter((a) => a.divisionName?.toLowerCase() === d.name.toLowerCase());

      const onTime = divAttendances.filter((a) => a.status === 'hadir').length;
      const late = divAttendances.filter((a) => a.status === 'terlambat').length;
      const totalAtt = divAttendances.length;
      const onTimeRate = totalAtt > 0 ? Math.round((onTime / totalAtt) * 100) : 100;

      return {
        id: d.id,
        name: d.name,
        code: d.code,
        employeeCount: divEmployees.length,
        onTimeCount: onTime,
        lateCount: late,
        totalAttendance: totalAtt,
        onTimeRate,
      };
    });
  },

  getEmployeeDisciplineRankings: () => {
    hrmService.init();
    const users = hrmService.getUsers().filter((u) => u.roleName !== 'superadmin');
    const attendances = hrmService.getAttendances();

    return users
      .map((u) => {
        const userAtts = attendances.filter((a) => a.userId === u.id || a.userNip === u.nip);
        const total = userAtts.length;
        const onTime = userAtts.filter((a) => a.status === 'hadir').length;
        const late = userAtts.filter((a) => a.status === 'terlambat').length;
        const totalLateMinutes = userAtts.reduce((acc, a) => acc + (a.lateMinutes || 0), 0);
        const totalWorkMinutes = userAtts.reduce((acc, a) => acc + (a.workDurationMinutes || 0), 0);
        const avgWorkHours = total > 0 ? (totalWorkMinutes / total / 60).toFixed(1) : '8.0';
        const score = total > 0 ? Math.round((onTime / total) * 100) : 95;

        return {
          id: u.id,
          nip: u.nip,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
          divisionName: u.divisionName || '-',
          totalAttendance: total,
          onTimeCount: onTime,
          lateCount: late,
          totalLateMinutes,
          avgWorkHours,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  },

  // ==========================================
  // OVERTIME (LEMBUR) MANAGEMENT SYSTEM
  // ==========================================
  getOvertimeSettings: (): OvertimeSettings => {
    hrmService.init();
    const stored = localStorage.getItem(STORAGE_KEYS.OVERTIME_SETTINGS);
    if (!stored) {
      return DEFAULT_OVERTIME_SETTINGS;
    }
    try {
      return { ...DEFAULT_OVERTIME_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_OVERTIME_SETTINGS;
    }
  },

  updateOvertimeSettings: (settings: OvertimeSettings): OvertimeSettings => {
    hrmService.init();
    localStorage.setItem(STORAGE_KEYS.OVERTIME_SETTINGS, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('hrm_overtime_settings_updated', { detail: settings }));
    return settings;
  },

  getOvertimeRecords: (): OvertimeRecord[] => {
    hrmService.init();
    const stored = localStorage.getItem(STORAGE_KEYS.OVERTIME_RECORDS);
    if (!stored) return [];
    try {
      const records = JSON.parse(stored);
      if (!Array.isArray(records)) return [];
      const users = hrmService.getUsers();
      return records.map((r: any) => {
        const u = (!r.userName || r.userName === 'Karyawan' || !r.userNip)
          ? users.find((usr) => usr.id === r.userId || usr.email === r.userId || usr.nip === r.userId)
          : null;
        const hourlyRate = Number(r.hourlyRate ?? r.rateApplied ?? 30000);
        const totalPay = Number(r.totalPay ?? r.compensationAmount ?? 0);
        return {
          ...r,
          userName: (r.userName && r.userName !== 'Karyawan') ? r.userName : (u ? u.fullName : (r.userName || 'Karyawan')),
          userNip: r.userNip || (u ? u.nip : ''),
          divisionName: (r.divisionName && r.divisionName !== '-') ? r.divisionName : (u ? (u.divisionName || u.division || '-') : (r.divisionName || '-')),
          hourlyRate,
          rateApplied: hourlyRate,
          totalPay,
          compensationAmount: totalPay,
        };
      });
    } catch {
      return [];
    }
  },

  getUserOvertimeRecords: (userId: string): OvertimeRecord[] => {
    hrmService.init();
    const records = hrmService.getOvertimeRecords();
    return records
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  calculateOvertime: (
    startTimeStr: string,
    endTimeStr: string,
    isWeekend: boolean,
    hourlyRateOverride?: number
  ): {
    durationMinutes: number;
    durationHours: number;
    hourlyRate: number;
    rateMultiplier: number;
    totalPay: number;
  } => {
    const settings = hrmService.getOvertimeSettings();
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    let startTotal = (startH || 0) * 60 + (startM || 0);
    let endTotal = (endH || 0) * 60 + (endM || 0);

    // Handle overnight shift if any
    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }

    let diffMinutes = Math.max(0, endTotal - startTotal);

    // Check minimum duration threshold
    if (diffMinutes < settings.minDurationMinutes) {
      return {
        durationMinutes: diffMinutes,
        durationHours: 0,
        hourlyRate: hourlyRateOverride || settings.hourlyRate,
        rateMultiplier: isWeekend ? settings.weekendRateMultiplier : 1.0,
        totalPay: 0,
      };
    }

    // Apply rounding
    if (settings.roundingMinutes > 0) {
      diffMinutes = Math.floor(diffMinutes / settings.roundingMinutes) * settings.roundingMinutes;
    }

    // Convert to hours
    let hours = diffMinutes / 60;

    // Cap at maxDailyHours
    if (settings.maxDailyHours > 0 && hours > settings.maxDailyHours) {
      hours = settings.maxDailyHours;
    }

    const hourlyRate = hourlyRateOverride || settings.hourlyRate;
    const rateMultiplier = isWeekend ? settings.weekendRateMultiplier : 1.0;
    const totalPay = Math.round(hours * hourlyRate * rateMultiplier);

    return {
      durationMinutes: diffMinutes,
      durationHours: Number(hours.toFixed(1)),
      hourlyRate,
      rateMultiplier,
      totalPay,
    };
  },

  createOvertimeRequest: (
    data: Omit<OvertimeRecord, 'id' | 'createdAt' | 'status' | 'paymentStatus'> & {
      status?: OvertimeStatus;
      paymentStatus?: OvertimePaymentStatus;
    }
  ): OvertimeRecord => {
    hrmService.init();
    const settings = hrmService.getOvertimeSettings();
    const records = hrmService.getOvertimeRecords();

    const newRecord: OvertimeRecord = {
      ...data,
      id: `ot-${Date.now()}`,
      status: data.status || (settings.requireApproval ? 'pending' : 'approved'),
      paymentStatus: data.paymentStatus || 'unpaid',
      createdAt: new Date().toISOString(),
    };

    records.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(records));
    window.dispatchEvent(new Event('hrm_overtime_updated'));
    return newRecord;
  },

  // Admin Direct Overtime Assignment (SPL Mandat Admin)
  assignOvertimeDirectly: (data: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    hours: number;
    taskDescription: string;
    adminId: string;
    adminName: string;
  }): OvertimeRecord => {
    hrmService.init();
    const users = hrmService.getUsers();
    const user = users.find((u) => u.id === data.userId);
    if (!user) throw new Error('Karyawan tidak ditemukan');

    const dateObj = new Date(data.date);
    const day = dateObj.getDay();
    const isWeekend = day === 0 || day === 6;

    const calc = hrmService.calculateOvertime(data.startTime, data.endTime, isWeekend);
    const hourlyRate = calc.hourlyRate;
    const rateMultiplier = calc.rateMultiplier;
    const totalPay = Math.round(data.hours * hourlyRate * rateMultiplier);

    const record = hrmService.createOvertimeRequest({
      userId: user.id,
      userName: user.fullName,
      userNip: user.nip,
      divisionId: user.divisionId,
      divisionName: user.divisionName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.hours * 60,
      durationHours: data.hours,
      requestedHours: data.hours,
      approvedHours: data.hours,
      assignedByAdmin: true,
      isWeekendHoliday: isWeekend,
      hourlyRate,
      rateMultiplier,
      totalPay,
      taskDescription: data.taskDescription,
      status: 'approved',
      paymentStatus: 'unpaid',
      approvedBy: data.adminId,
      approvedByName: data.adminName,
      approvalNotes: 'Ditugaskan langsung oleh Admin / HRD',
    });

    // Notify Employee
    hrmService.addNotification({
      userId: user.id,
      recipientRole: 'karyawan',
      title: 'Surat Perintah Lembur Resmi',
      message: `Anda ditugaskan lembur oleh ${data.adminName} pada tanggal ${data.date} (${data.startTime} - ${data.endTime}, ${data.hours} Jam). Tugas: ${data.taskDescription}`,
      type: 'overtime',
      metadata: {
        employeeId: user.id,
        employeeName: user.fullName,
        overtimeId: record.id,
        overtimeHours: data.hours,
        actionByAdminName: data.adminName,
      },
    });

    return record;
  },

  // Employee Overtime Request
  requestOvertime: (data: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    hours: number;
    taskDescription: string;
  }): OvertimeRecord => {
    hrmService.init();
    const users = hrmService.getUsers();
    const user = users.find((u) => u.id === data.userId);
    if (!user) throw new Error('Karyawan tidak ditemukan');

    const dateObj = new Date(data.date);
    const day = dateObj.getDay();
    const isWeekend = day === 0 || day === 6;

    const calc = hrmService.calculateOvertime(data.startTime, data.endTime, isWeekend);
    const hourlyRate = calc.hourlyRate;
    const rateMultiplier = calc.rateMultiplier;
    const totalPay = Math.round(data.hours * hourlyRate * rateMultiplier);

    const record = hrmService.createOvertimeRequest({
      userId: user.id,
      userName: user.fullName,
      userNip: user.nip,
      divisionId: user.divisionId,
      divisionName: user.divisionName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.hours * 60,
      durationHours: data.hours,
      requestedHours: data.hours,
      assignedByAdmin: false,
      isWeekendHoliday: isWeekend,
      hourlyRate,
      rateMultiplier,
      totalPay,
      taskDescription: data.taskDescription,
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    // Notify Admin
    hrmService.addNotification({
      userId: 'all_admin',
      recipientRole: 'admin',
      title: 'Pengajuan Lembur Baru',
      message: `${user.fullName} (${user.divisionName || 'Umum'}) mengajukan lembur ${data.hours} Jam pada ${data.date}. Alasan: ${data.taskDescription}`,
      type: 'overtime',
      metadata: {
        employeeId: user.id,
        employeeName: user.fullName,
        overtimeId: record.id,
        overtimeHours: data.hours,
      },
    });

    return record;
  },

  // Admin Approval with Specified Approved Hours
  approveOvertimeWithHours: (
    id: string,
    approvedHours: number,
    adminId: string,
    adminName: string,
    notes?: string
  ): OvertimeRecord => {
    hrmService.init();
    const records = hrmService.getOvertimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Catatan lembur tidak ditemukan.');

    const rec = records[index];
    const totalPay = Math.round(approvedHours * rec.hourlyRate * rec.rateMultiplier);

    records[index] = {
      ...rec,
      status: 'approved',
      approvedHours,
      durationHours: approvedHours,
      durationMinutes: approvedHours * 60,
      totalPay,
      approvedBy: adminId,
      approvedByName: adminName,
      approvalNotes: notes || `Disetujui ${approvedHours} Jam lembur`,
    };

    localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(records));
    window.dispatchEvent(new Event('hrm_overtime_updated'));

    // Notify Employee
    hrmService.addNotification({
      userId: rec.userId,
      recipientRole: 'karyawan',
      title: 'Pengajuan Lembur Disetujui',
      message: `Lembur Anda pada tanggal ${rec.date} telah disetujui sebanyak ${approvedHours} Jam oleh ${adminName}.${notes ? ' Catatan: ' + notes : ''}`,
      type: 'overtime',
      metadata: {
        overtimeId: rec.id,
        approvedHours,
        actionByAdminName: adminName,
      },
    });

    // Asynchronously push overtime approval to backend database
    api.put(`/overtime/${id}/status`, {
      status: 'approved',
      approvedHours,
      approverId: adminId,
      approverName: adminName,
      notes,
    }).catch((err) => {
      console.warn('[HRM] Warning syncing overtime approval to backend:', err);
    });

    return records[index];
  },

  rejectOvertime: (
    id: string,
    adminId: string,
    adminName: string,
    notes?: string
  ): OvertimeRecord => {
    hrmService.init();
    const records = hrmService.getOvertimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Catatan lembur tidak ditemukan.');

    const rec = records[index];
    records[index] = {
      ...rec,
      status: 'rejected',
      approvedBy: adminId,
      approvedByName: adminName,
      approvalNotes: notes || 'Ditolak oleh atasan / HRD',
    };

    localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(records));
    window.dispatchEvent(new Event('hrm_overtime_updated'));

    // Notify Employee
    hrmService.addNotification({
      userId: rec.userId,
      recipientRole: 'karyawan',
      title: 'Pengajuan Lembur Ditolak',
      message: `Pengajuan lembur Anda pada ${rec.date} tidak disetujui.${notes ? ' Alasan: ' + notes : ''}`,
      type: 'overtime',
      metadata: {
        overtimeId: rec.id,
        actionByAdminName: adminName,
      },
    });

    // Asynchronously push overtime rejection to backend database
    api.put(`/overtime/${id}/status`, {
      status: 'rejected',
      approverId: adminId,
      approverName: adminName,
      notes,
    }).catch((err) => {
      console.warn('[HRM] Warning syncing overtime rejection to backend:', err);
    });

    return records[index];
  },

  getUserTodayApprovedOvertime: (userId: string, dateStr?: string): OvertimeRecord | null => {
    hrmService.init();
    const targetDate = dateStr || getTodayDateStr();
    const records = hrmService.getOvertimeRecords();
    return (
      records.find(
        (r) => r.userId === userId && r.date === targetDate && r.status === 'approved'
      ) || null
    );
  },

  updateOvertimeStatus: (
    id: string,
    status: OvertimeStatus,
    approvedBy: string,
    notes?: string
  ): OvertimeRecord => {
    hrmService.init();
    const records = hrmService.getOvertimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Catatan lembur tidak ditemukan.');

    const approver = hrmService.getUsers().find((u) => u.id === approvedBy);

    records[index] = {
      ...records[index],
      status,
      approvedBy,
      approvedByName: approver?.fullName || 'HRD / Pimpinan',
      approvalNotes: notes || (status === 'approved' ? 'Disetujui' : 'Ditolak'),
    };

    localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(records));
    window.dispatchEvent(new Event('hrm_overtime_updated'));
    return records[index];
  },

  updateOvertimePaymentStatus: (
    id: string,
    paymentStatus: OvertimePaymentStatus
  ): OvertimeRecord => {
    hrmService.init();
    const records = hrmService.getOvertimeRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Catatan lembur tidak ditemukan.');

    records[index] = {
      ...records[index],
      paymentStatus,
    };

    localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(records));
    return records[index];
  },

  getOvertimeAnalytics: () => {
    hrmService.init();
    const records = hrmService.getOvertimeRecords();
    const divisions = hrmService.getDivisions();

    const totalHours = records.reduce((sum, r) => sum + (r.durationHours || 0), 0);
    const totalPay = records.reduce((sum, r) => sum + (r.totalPay || 0), 0);
    const approvedRecords = records.filter((r) => r.status === 'approved');
    const approvedPay = approvedRecords.reduce((sum, r) => sum + (r.totalPay || 0), 0);
    const pendingCount = records.filter((r) => r.status === 'pending').length;
    const paidRecords = records.filter((r) => r.paymentStatus === 'paid' || r.paymentStatus === 'included_in_payroll');
    const paidPay = paidRecords.reduce((sum, r) => sum + (r.totalPay || 0), 0);

    const divisionBreakdown = divisions.map((d) => {
      const divRecords = records.filter(
        (r) => r.divisionId === d.id || r.divisionName?.toLowerCase() === d.name.toLowerCase()
      );
      const hours = divRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0);
      const pay = divRecords.reduce((sum, r) => sum + (r.totalPay || 0), 0);
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        count: divRecords.length,
        hours: Number(hours.toFixed(1)),
        totalPay: pay,
      };
    });

    return {
      totalRecords: records.length,
      totalHours: Number(totalHours.toFixed(1)),
      totalPay,
      approvedPay,
      pendingCount,
      paidPay,
      divisionBreakdown,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYROLL MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  getPayrollSettings: (): PayrollSettings => {
    hrmService.init();
    try {
      return JSON.parse(
        localStorage.getItem(STORAGE_KEYS.PAYROLL_SETTINGS) ||
          JSON.stringify(DEFAULT_PAYROLL_SETTINGS)
      );
    } catch {
      return DEFAULT_PAYROLL_SETTINGS;
    }
  },

  updatePayrollSettings: (updates: Partial<PayrollSettings>): PayrollSettings => {
    const current = hrmService.getPayrollSettings();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.PAYROLL_SETTINGS, JSON.stringify(updated));
    return updated;
  },

  // ─── Salary Profiles ───────────────────────────────────────────────────────
  getSalaryProfiles: (): EmployeeSalaryProfile[] => {
    hrmService.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYROLL_SALARY_PROFILES) || '[]');
    } catch {
      return [];
    }
  },

  getSalaryProfile: (userId: string): EmployeeSalaryProfile | null => {
    const profiles = hrmService.getSalaryProfiles();
    return profiles.find((p) => p.userId === userId) || null;
  },

  upsertSalaryProfile: (data: Omit<EmployeeSalaryProfile, 'id' | 'updatedAt'>): EmployeeSalaryProfile => {
    const profiles = hrmService.getSalaryProfiles();
    const idx = profiles.findIndex((p) => p.userId === data.userId);
    const updated: EmployeeSalaryProfile = {
      ...data,
      id: idx !== -1 ? profiles[idx].id : `sp-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      profiles[idx] = updated;
    } else {
      profiles.push(updated);
    }
    localStorage.setItem(STORAGE_KEYS.PAYROLL_SALARY_PROFILES, JSON.stringify(profiles));
    window.dispatchEvent(new Event('hrm_salary_profiles_updated'));

    // Asynchronously push to PostgreSQL database
    api.post('/payroll/profiles', {
      userId: data.userId,
      baseSalary: data.baseSalary,
      positionAllowance: data.positionAllowance,
      mealAllowance: data.mealAllowance,
      transportAllowance: data.transportAllowance,
      bankName: data.bankName,
      bankAccount: data.bankAccount,
      bankAccountName: data.bankAccountName,
    }).catch((err) => console.warn('[HRM] Warning syncing salary profile to backend:', err));

    return updated;
  },

  fetchUserSalarySlip: async (userId: string) => {
    try {
      const res = await api.get<{ success: boolean; slip: any }>(`/payroll/slip/${userId}`);
      if (res && res.success && res.slip) {
        return res.slip;
      }
    } catch (err) {
      console.warn('[HRM] Error fetching live salary slip from backend:', err);
    }
    return null;
  },

  deleteSalaryProfile: (userId: string) => {
    const profiles = hrmService.getSalaryProfiles().filter((p) => p.userId !== userId);
    localStorage.setItem(STORAGE_KEYS.PAYROLL_SALARY_PROFILES, JSON.stringify(profiles));
  },

  // ─── Payroll Periods ───────────────────────────────────────────────────────
  getPayrollPeriods: (): PayrollPeriod[] => {
    hrmService.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYROLL_PERIODS) || '[]');
    } catch {
      return [];
    }
  },

  getPayrollPeriod: (id: string): PayrollPeriod | null => {
    return hrmService.getPayrollPeriods().find((p) => p.id === id) || null;
  },

  createPayrollPeriod: (month: number, year: number, notes?: string): PayrollPeriod => {
    const existing = hrmService.getPayrollPeriods();
    const dup = existing.find((p) => p.month === month && p.year === year);
    if (dup) throw new Error(`Periode ${dup.periodLabel} sudah ada.`);

    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;

    const period: PayrollPeriod = {
      id: `pp-${year}${String(month).padStart(2,'0')}-${Date.now()}`,
      month,
      year,
      periodLabel: `${monthNames[month - 1]} ${year}`,
      startDate,
      endDate,
      status: 'draft',
      totalEmployees: 0,
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      totalOvertimePay: 0,
      notes,
      createdAt: new Date().toISOString(),
    };
    existing.unshift(period);
    localStorage.setItem(STORAGE_KEYS.PAYROLL_PERIODS, JSON.stringify(existing));
    return period;
  },

  updatePayrollPeriodStatus: (
    id: string,
    status: PayrollPeriodStatus,
    approvedBy?: string,
    notes?: string
  ): PayrollPeriod => {
    const periods = hrmService.getPayrollPeriods();
    const idx = periods.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Periode tidak ditemukan');
    const approver = approvedBy ? hrmService.getUsers().find((u) => u.id === approvedBy) : null;
    periods[idx] = {
      ...periods[idx],
      status,
      approvedBy: approvedBy || periods[idx].approvedBy,
      approvedByName: approver?.fullName || periods[idx].approvedByName,
      approvedAt: status === 'approved' ? new Date().toISOString() : periods[idx].approvedAt,
      paidAt: status === 'paid' ? new Date().toISOString() : periods[idx].paidAt,
      notes: notes !== undefined ? notes : periods[idx].notes,
    };
    localStorage.setItem(STORAGE_KEYS.PAYROLL_PERIODS, JSON.stringify(periods));
    return periods[idx];
  },

  deletePayrollPeriod: (id: string) => {
    const periods = hrmService.getPayrollPeriods().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PAYROLL_PERIODS, JSON.stringify(periods));
    // Also remove all slips for that period
    const slips = hrmService.getPayrollSlips().filter((s) => s.periodId !== id);
    localStorage.setItem(STORAGE_KEYS.PAYROLL_SLIPS, JSON.stringify(slips));
  },

  // ─── Payroll Slips ─────────────────────────────────────────────────────────
  getPayrollSlips: (): PayrollSlip[] => {
    hrmService.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYROLL_SLIPS) || '[]');
    } catch {
      return [];
    }
  },

  getPayrollSlipsByPeriod: (periodId: string): PayrollSlip[] => {
    return hrmService.getPayrollSlips().filter((s) => s.periodId === periodId);
  },

  getPayrollSlipsByUser: (userId: string): PayrollSlip[] => {
    return hrmService.getPayrollSlips().filter((s) => s.userId === userId);
  },

  // Core calculation function: generate slip for one employee in a period
  calculateSlipForEmployee: (userId: string, period: PayrollPeriod): PayrollSlip | null => {
    const users = hrmService.getUsers();
    const employee = users.find((u) => u.id === userId && u.isActive);
    if (!employee) return null;

    const profile = hrmService.getSalaryProfile(userId);
    const settings = hrmService.getPayrollSettings();
    const otSettings = hrmService.getOvertimeSettings();

    // Defaults if no salary profile exists
    const baseSalary = profile?.baseSalary || 0;
    const positionAllowance = profile?.positionAllowance || 0;
    const transportAllowance = profile?.transportAllowance || 0;
    const mealAllowance = profile?.mealAllowance || 0;
    const housingAllowance = profile?.housingAllowance || 0;
    const healthAllowance = profile?.healthAllowance || 0;
    const otherAllowances = profile?.otherAllowances || [];

    // ── Attendance in this period ──
    const allAttendance = hrmService.getAttendance();
    const periodAttendance = allAttendance.filter(
      (a) => a.userId === userId && a.attendanceDate >= period.startDate && a.attendanceDate <= period.endDate
    );

    const presentDays = periodAttendance.filter((a) =>
      ['hadir', 'terlambat'].includes(a.status)
    ).length;
    const lateRecords = periodAttendance.filter((a) => a.status === 'terlambat');
    const lateCount = lateRecords.length;
    const totalLateMinutes = lateRecords.reduce((s, a) => s + (a.lateMinutes || 0), 0);
    const absentCount = periodAttendance.filter((a) => a.status === 'alfa').length;
    const leaveCount = periodAttendance.filter((a) =>
      ['izin', 'sakit', 'cuti'].includes(a.status)
    ).length;

    // ── Overtime in this period ──
    const allOt = hrmService.getOvertimeRecords();
    const periodOt = settings.includeOvertimeInPayroll
      ? allOt.filter(
          (r) =>
            r.userId === userId &&
            r.date >= period.startDate &&
            r.date <= period.endDate &&
            r.status === 'approved' &&
            r.paymentStatus === 'unpaid'
        )
      : [];

    const overtimePay = periodOt.reduce((s, r) => s + (r.totalPay || 0), 0);
    const overtimeHours = periodOt.reduce((s, r) => s + (r.durationHours || 0), 0);
    const overtimeRecordIds = periodOt.map((r) => r.id);

    // ── Income ──
    const fixedAllowances = positionAllowance + transportAllowance + mealAllowance + housingAllowance + healthAllowance;
    const otherTotal = otherAllowances.reduce((s, a) => s + a.amount, 0);
    const grossIncome = baseSalary + fixedAllowances + otherTotal + overtimePay;

    // ── Deductions ──
    const lateDeduction = totalLateMinutes * settings.lateDeductionPerMinute;
    const absenceDeduction = absentCount * settings.absenceDeductionPerDay;
    const bpjsKesehatan = Math.round((settings.bpjsKesehatanEmployee / 100) * baseSalary);
    const bpjsKetenagakerjaan = Math.round((settings.bpjsKetenagakerjaanEmployee / 100) * baseSalary);
    // Official Indonesian PPh 21 TER (PP 58/2023) calculation
    const taxCat = payrollTaxEngine.getTerCategory(profile?.taxStatus || 'TK/0');
    const terCalc = payrollTaxEngine.calculatePph21Ter(grossIncome, taxCat);
    const pph21 = terCalc.taxAmount;
    const totalDeductions = lateDeduction + absenceDeduction + bpjsKesehatan + bpjsKetenagakerjaan + pph21;

    const netSalary = Math.max(0, grossIncome - totalDeductions);

    const slip: PayrollSlip = {
      id: `slip-${userId}-${period.id}`,
      periodId: period.id,
      periodLabel: period.periodLabel,
      userId,
      userName: employee.fullName,
      userNip: employee.nip,
      divisionId: employee.divisionId,
      divisionName: employee.divisionName,
      employeeType: profile?.employeeType || 'tetap',
      bankName: profile?.bankName || '-',
      bankAccount: profile?.bankAccount || '-',
      bankAccountName: profile?.bankAccountName || employee.fullName,
      baseSalary,
      positionAllowance,
      transportAllowance,
      mealAllowance,
      housingAllowance,
      healthAllowance,
      otherAllowances,
      overtimePay,
      overtimeHours: Number(overtimeHours.toFixed(2)),
      grossIncome,
      lateDeduction,
      absenceDeduction,
      bpjsKesehatan,
      bpjsKetenagakerjaan,
      pph21,
      otherDeductions: [],
      totalDeductions,
      netSalary,
      workingDays: settings.workingDaysPerMonth,
      presentDays,
      lateCount,
      totalLateMinutes,
      absentCount,
      leaveCount,
      overtimeRecordIds,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    return slip;
  },

  // Generate all slips for a period (for all active employees)
  generatePayrollSlips: (periodId: string): PayrollSlip[] => {
    const period = hrmService.getPayrollPeriod(periodId);
    if (!period) throw new Error('Periode tidak ditemukan');

    const users = hrmService.getUsers().filter((u) => u.isActive && u.roleName !== 'superadmin');
    const newSlips: PayrollSlip[] = [];

    for (const user of users) {
      const slip = hrmService.calculateSlipForEmployee(user.id, period);
      if (slip) newSlips.push(slip);
    }

    // Replace old slips for this period
    const otherSlips = hrmService.getPayrollSlips().filter((s) => s.periodId !== periodId);
    const allSlips = [...otherSlips, ...newSlips];
    localStorage.setItem(STORAGE_KEYS.PAYROLL_SLIPS, JSON.stringify(allSlips));

    // Update period summary totals
    const totalGross = newSlips.reduce((s, sl) => s + sl.grossIncome, 0);
    const totalDeductions = newSlips.reduce((s, sl) => s + sl.totalDeductions, 0);
    const totalNet = newSlips.reduce((s, sl) => s + sl.netSalary, 0);
    const totalOvertimePay = newSlips.reduce((s, sl) => s + sl.overtimePay, 0);

    const periods = hrmService.getPayrollPeriods();
    const idx = periods.findIndex((p) => p.id === periodId);
    if (idx !== -1) {
      periods[idx] = {
        ...periods[idx],
        status: 'processing',
        totalEmployees: newSlips.length,
        totalGross,
        totalDeductions,
        totalNet,
        totalOvertimePay,
      };
      localStorage.setItem(STORAGE_KEYS.PAYROLL_PERIODS, JSON.stringify(periods));
    }

    // Mark linked overtime records as included_in_payroll
    const otRecordIds = newSlips.flatMap((sl) => sl.overtimeRecordIds);
    if (otRecordIds.length > 0) {
      const otRecords = hrmService.getOvertimeRecords();
      const updated = otRecords.map((r) =>
        otRecordIds.includes(r.id) ? { ...r, paymentStatus: 'included_in_payroll' as const } : r
      );
      localStorage.setItem(STORAGE_KEYS.OVERTIME_RECORDS, JSON.stringify(updated));
    }

    return newSlips;
  },

  updatePayrollSlipStatus: (
    slipId: string,
    status: PayrollSlipStatus,
    approvedBy?: string,
    notes?: string
  ): PayrollSlip => {
    const slips = hrmService.getPayrollSlips();
    const idx = slips.findIndex((s) => s.id === slipId);
    if (idx === -1) throw new Error('Slip tidak ditemukan');
    const approver = approvedBy ? hrmService.getUsers().find((u) => u.id === approvedBy) : null;
    slips[idx] = {
      ...slips[idx],
      status,
      approvedBy: approvedBy || slips[idx].approvedBy,
      approvedByName: approver?.fullName || slips[idx].approvedByName,
      paidAt: status === 'paid' ? new Date().toISOString() : slips[idx].paidAt,
      notes: notes !== undefined ? notes : slips[idx].notes,
    };
    localStorage.setItem(STORAGE_KEYS.PAYROLL_SLIPS, JSON.stringify(slips));
    return slips[idx];
  },

  getPayrollAnalytics: () => {
    hrmService.init();
    const periods = hrmService.getPayrollPeriods();
    const slips = hrmService.getPayrollSlips();
    const users = hrmService.getUsers().filter((u) => u.isActive);
    const divisions = hrmService.getDivisions();

    const paidPeriods = periods.filter((p) => p.status === 'paid' || p.status === 'approved');
    const totalPayroll = paidPeriods.reduce((s, p) => s + p.totalNet, 0);
    const latestPeriod = periods[0] || null;
    const avgSalary = slips.length > 0
      ? slips.reduce((s, sl) => s + sl.netSalary, 0) / slips.length
      : 0;

    // Monthly trend (last 6 periods)
    const trend = periods.slice(0, 6).reverse().map((p) => ({
      label: p.periodLabel,
      gross: p.totalGross,
      net: p.totalNet,
      overtime: p.totalOvertimePay,
      employees: p.totalEmployees,
    }));

    // Division breakdown from latest period slips
    const latestSlips = latestPeriod ? slips.filter((s) => s.periodId === latestPeriod.id) : [];
    const divBreakdown = divisions.map((d) => {
      const divSlips = latestSlips.filter((s) => s.divisionId === d.id || s.divisionName === d.name);
      return {
        name: d.name,
        code: d.code,
        count: divSlips.length,
        totalNet: divSlips.reduce((s, sl) => s + sl.netSalary, 0),
        totalGross: divSlips.reduce((s, sl) => s + sl.grossIncome, 0),
      };
    }).filter((d) => d.count > 0);

    return {
      totalPayroll,
      avgSalary: Math.round(avgSalary),
      latestPeriod,
      totalEmployees: users.length,
      trend,
      divBreakdown,
      totalPeriods: periods.length,
    };
  },

  // ─── COMPANY PROFILE ──────────────────────────────────────────────────────
  getCompanyProfile(): CompanyProfile {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANY_PROFILE);
    if (raw) {
      try { return JSON.parse(raw) as CompanyProfile; } catch { /* fallthrough */ }
    }
    return { ...DEFAULT_COMPANY_PROFILE };
  },

  async updateCompanyProfile(data: Partial<CompanyProfile>): Promise<CompanyProfile> {
    const existing = hrmService.getCompanyProfile();
    const updated: CompanyProfile = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.COMPANY_PROFILE, JSON.stringify(updated));
    window.dispatchEvent(new Event('hrm_company_updated'));
    try {
      await api.put('/company', updated);
    } catch (err) {
      console.warn('[HRM] Failed syncing company profile to PostgreSQL:', err);
    }
    return updated;
  },

  // ─── COMPANY DOCUMENTS ────────────────────────────────────────────────────
  getCompanyDocuments(): CompanyDocument[] {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANY_DOCUMENTS);
    if (raw) {
      try { return JSON.parse(raw) as CompanyDocument[]; } catch { /* fallthrough */ }
    }
    return [];
  },

  addCompanyDocument(doc: Omit<CompanyDocument, 'id' | 'uploadedAt'>): CompanyDocument {
    const docs = hrmService.getCompanyDocuments();
    const newDoc: CompanyDocument = {
      ...doc,
      id: `cdoc-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
    };
    docs.unshift(newDoc);
    localStorage.setItem(STORAGE_KEYS.COMPANY_DOCUMENTS, JSON.stringify(docs));
    return newDoc;
  },

  deleteCompanyDocument(docId: string): void {
    const docs = hrmService.getCompanyDocuments().filter((d) => d.id !== docId);
    localStorage.setItem(STORAGE_KEYS.COMPANY_DOCUMENTS, JSON.stringify(docs));
  },

  // ─── EMPLOYEE DOCUMENTS ───────────────────────────────────────────────────
  getEmployeeDocuments(userId: string): EmployeeDocument[] {
    const users = hrmService.getUsers();
    const user = users.find((u) => u.id === userId);
    return user?.employeeDocuments || [];
  },

  addEmployeeDocument(userId: string, doc: Omit<EmployeeDocument, 'id' | 'userId' | 'uploadedAt'>): EmployeeDocument {
    const users = hrmService.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    if (userIdx === -1) throw new Error('Karyawan tidak ditemukan');
    const newDoc: EmployeeDocument = {
      ...doc,
      id: `edoc-${Date.now()}`,
      userId,
      uploadedAt: new Date().toISOString(),
    };
    const existing = users[userIdx].employeeDocuments || [];
    users[userIdx] = {
      ...users[userIdx],
      employeeDocuments: [newDoc, ...existing],
    };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return newDoc;
  },

  deleteEmployeeDocument(userId: string, docId: string): void {
    const users = hrmService.getUsers();
    const userIdx = users.findIndex((u) => u.id === userId);
    if (userIdx === -1) return;
    users[userIdx] = {
      ...users[userIdx],
      employeeDocuments: (users[userIdx].employeeDocuments || []).filter((d) => d.id !== docId),
    };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  // ─── GEOFENCE PERIMETER WATCHDOG & BREACH DISCIPLINARY ENGINE ─────────────
  getPerimeterViolations(): PerimeterViolation[] {
    return safeGetJson<PerimeterViolation[]>(STORAGE_KEYS.PERIMETER_VIOLATIONS, []);
  },

  getActivePerimeterViolation(userId: string, date?: string): PerimeterViolation | undefined {
    const today = date || getTodayDateStr();
    const violations = hrmService.getPerimeterViolations();
    return violations.find((v) => v.userId === userId && v.violationDate === today && v.status === 'active');
  },

  isUserOnApprovedPermit(userId: string, date?: string): boolean {
    const checkDate = date || getTodayDateStr();
    const leaves = hrmService.getLeaveRequests();
    return leaves.some((l) => {
      if (l.userId !== userId || l.status !== 'approved') return false;
      return l.startDate <= checkDate && l.endDate >= checkDate;
    });
  },

  async reportPerimeterBreach(data: {
    userId: string;
    attendanceId?: string;
    divisionId?: string;
    distanceMeters: number;
    latitude?: number;
    longitude?: number;
    durationOutsideMinutes?: number;
    notes?: string;
  }): Promise<PerimeterViolation> {
    const today = getTodayDateStr();
    const user = hrmService.getUsers().find((u) => u.id === data.userId);
    const div = hrmService.getDivisions().find((d) => d.id === data.divisionId);

    const newViolation: PerimeterViolation = {
      id: `viol-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: data.userId,
      userName: user?.fullName || 'Karyawan',
      userNip: user?.nip || '',
      attendanceId: data.attendanceId,
      divisionId: data.divisionId,
      divisionName: div?.name || user?.divisionName || '',
      violationDate: today,
      detectedAt: new Date().toISOString(),
      distanceMeters: data.distanceMeters,
      exitLatitude: data.latitude,
      exitLongitude: data.longitude,
      durationOutsideMinutes: data.durationOutsideMinutes || 0,
      status: 'active',
      notes: data.notes || 'Meninggalkan area kantor tanpa izin dinas aktif saat jam kerja',
      createdAt: new Date().toISOString(),
    };

    // Update local violations
    const violations = hrmService.getPerimeterViolations();
    violations.unshift(newViolation);
    localStorage.setItem(STORAGE_KEYS.PERIMETER_VIOLATIONS, JSON.stringify(violations));

    // Update today's attendance: lock and mark breach
    const attendances = hrmService.getAttendances();
    const attIdx = attendances.findIndex((a) => a.userId === data.userId && a.attendanceDate === today);
    if (attIdx !== -1) {
      attendances[attIdx].isLocked = true;
      attendances[attIdx].isPerimeterBreached = true;
      attendances[attIdx].perimeterBreachCount = (attendances[attIdx].perimeterBreachCount || 0) + 1;
      attendances[attIdx].timeOutsideMinutes = (attendances[attIdx].timeOutsideMinutes || 0) + (data.durationOutsideMinutes || 0);
      if (!attendances[attIdx].securityFlags) attendances[attIdx].securityFlags = [];
      if (!attendances[attIdx].securityFlags!.includes('PERIMETER_ABANDONMENT_BREACH_DETECTED')) {
        attendances[attIdx].securityFlags!.push('PERIMETER_ABANDONMENT_BREACH_DETECTED');
      }
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendances));
    }

    // Add high-priority local notification
    hrmService.addNotification({
      userId: data.userId,
      title: 'PERINGATAN DISIPLIN: Pelanggaran Perimeter Terdeteksi',
      message: 'Anda terdeteksi meninggalkan area kerja tanpa izin resmi. Presensi checkout dibekukan otomatis demi integritas sistem.',
      type: 'alert',
      isRead: false,
    });

    window.dispatchEvent(new Event('hrm_data_updated'));

    // Push to backend API
    try {
      await api.post('/geofence/report-breach', data);
    } catch (err) {
      console.warn('[PerimeterWatchdog] Backend report breach warning:', err);
    }

    return newViolation;
  },

  async resolvePerimeterBreach(data: {
    violationId: string;
    resolvedBy: string;
    resolutionNotes: string;
    unlockAttendance: boolean;
  }): Promise<void> {
    const violations = hrmService.getPerimeterViolations();
    const vIdx = violations.findIndex((v) => v.id === data.violationId);
    const resolver = hrmService.getUsers().find((u) => u.id === data.resolvedBy);

    if (vIdx !== -1) {
      violations[vIdx].status = 'resolved';
      violations[vIdx].resolutionNotes = data.resolutionNotes;
      violations[vIdx].resolvedBy = data.resolvedBy;
      violations[vIdx].resolvedByName = resolver?.fullName || 'Atasan / HRD';
      violations[vIdx].resolvedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.PERIMETER_VIOLATIONS, JSON.stringify(violations));

      if (data.unlockAttendance) {
        const attendances = hrmService.getAttendances();
        const attIdx = attendances.findIndex(
          (a) => a.userId === violations[vIdx].userId && a.attendanceDate === violations[vIdx].violationDate
        );
        if (attIdx !== -1) {
          attendances[attIdx].isLocked = false;
          attendances[attIdx].isPerimeterBreached = false;
          attendances[attIdx].notes = (attendances[attIdx].notes ? attendances[attIdx].notes + ' | ' : '') + `[Dispensasi Perimeter oleh Atasan: ${data.resolutionNotes}]`;
          localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendances));
        }
      }
    }

    window.dispatchEvent(new Event('hrm_data_updated'));

    try {
      await api.post('/geofence/resolve-breach', data);
    } catch (err) {
      console.warn('[PerimeterWatchdog] Backend resolve breach warning:', err);
    }
  },

  // ─── SHIFT SWAP & VACANCY METHODS (DANRU -> KORLAP) ─────────────────────────
  getShiftSwaps: async (userId?: string, role?: string): Promise<ShiftSwapRecord[]> => {
    try {
      const q = new URLSearchParams();
      if (userId) q.set('userId', userId);
      if (role) q.set('role', role);
      const res = await api.get<{ success: boolean; data: ShiftSwapRecord[] }>(`/shift-swaps?${q.toString()}`);
      return res.data || [];
    } catch (err) {
      console.warn('[ShiftSwaps] Failed to fetch shift swaps:', err);
      return [];
    }
  },

  getSmartSubstituteCandidates: async (
    requesterId: string,
    swapDate: string,
    originalShift?: string
  ): Promise<SmartSubstituteCandidate[]> => {
    try {
      const q = new URLSearchParams({
        requesterId,
        swapDate,
        originalShift: originalShift || 'Reguler',
      });
      const res = await api.get<{ success: boolean; data: SmartSubstituteCandidate[] }>(
        `/shift-swaps/smart-candidates?${q.toString()}`
      );
      return res.data || [];
    } catch (err) {
      console.warn('[ShiftSwaps] Failed to fetch smart candidates:', err);
      return [];
    }
  },

  submitShiftSwap: async (data: {
    requester_id: string;
    swap_date: string;
    original_shift: string;
    target_shift?: string;
    reason: string;
    notes?: string;
  }): Promise<{ success: boolean; data?: ShiftSwapRecord; error?: string }> => {
    try {
      const res = await api.post<{ success: boolean; data?: ShiftSwapRecord; error?: string }>(
        '/shift-swaps',
        data
      );
      window.dispatchEvent(new Event('hrm_data_updated'));
      window.dispatchEvent(new Event('hrm_swaps_updated'));
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengajukan permohonan' };
    }
  },

  danruRecommendSwap: async (
    swapId: string,
    data: {
      danru_id: string;
      recommended_substitute_id: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; data?: ShiftSwapRecord; error?: string }> => {
    try {
      const res = await api.put<{ success: boolean; data?: ShiftSwapRecord; error?: string }>(
        `/shift-swaps/${swapId}/danru-recommend`,
        data
      );
      window.dispatchEvent(new Event('hrm_data_updated'));
      window.dispatchEvent(new Event('hrm_swaps_updated'));
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengirim rekomendasi' };
    }
  },

  korlapApproveSwap: async (
    swapId: string,
    data: {
      korlap_id: string;
      status: 'approved' | 'rejected';
      substitute_id?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; data?: ShiftSwapRecord; error?: string }> => {
    try {
      const res = await api.put<{ success: boolean; data?: ShiftSwapRecord; error?: string }>(
        `/shift-swaps/${swapId}/approval`,
        data
      );
      window.dispatchEvent(new Event('hrm_data_updated'));
      window.dispatchEvent(new Event('hrm_swaps_updated'));
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memproses persetujuan Korlap' };
    }
  },
};
