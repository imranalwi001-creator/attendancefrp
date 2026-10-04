export interface Role {
  id: string;
  name: string; // 'superadmin' | 'admin' | 'hrd' | 'pimpinan' | 'keuangan' | 'karyawan' | string
  label: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}

export interface AppSettings {
  appName: string;
  logoUrl: string | null;
  breakPolicyEnabled?: boolean;
  breakDurationMinutes?: number;
  breakAllowOutside?: boolean;
}

// ─── COMPANY PROFILE ─────────────────────────────────────────────────────────
export interface CompanyProfile {
  id: string;
  companyName: string;           // Nama resmi (e.g. "PT. FAWWAZ RESKI PERWIRA")
  shortName?: string;            // Nama singkat / brand
  legalType: string;             // 'PT' | 'CV' | 'Yayasan' | 'UD' | 'Koperasi' | string
  businessSector?: string;       // Bidang usaha / industri
  foundedDate?: string;          // YYYY-MM-DD
  npwp?: string;                 // Nomor NPWP perusahaan
  nib?: string;                  // Nomor Induk Berusaha
  siupNumber?: string;           // No. SIUP / TDP
  deedNumber?: string;           // Nomor Akta Pendirian
  deedNotary?: string;           // Nama Notaris
  skMenkumham?: string;          // No. SK Kemenkumham
  totalEmployees?: number;       // Estimasi jumlah karyawan
  // Alamat
  address: string;               // Alamat lengkap
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  // Kontak
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  // Sosial Media
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  // Visi Misi
  vision?: string;
  mission?: string;
  // Pimpinan
  directorName?: string;         // Direktur / Pemilik
  hrManagerName?: string;        // Manajer HRD
  logoUrl?: string | null;
  updatedAt: string;
}

// ─── COMPANY DOCUMENTS ───────────────────────────────────────────────────────
export type CompanyDocumentType =
  | 'akta_pendirian'
  | 'sk_kemenkumham'
  | 'npwp'
  | 'siup'
  | 'nib'
  | 'tdp'
  | 'iso'
  | 'sertifikasi'
  | 'perjanjian'
  | 'lainnya';

export interface CompanyDocument {
  id: string;
  name: string;                  // Nama dokumen
  type: CompanyDocumentType;
  fileUrl: string;               // Base64 atau URL
  fileType?: string;             // 'pdf' | 'jpg' | 'png' | 'docx'
  fileSizeKb?: number;
  issuedDate?: string;           // Tanggal terbit
  expiryDate?: string;           // Tanggal kadaluarsa (opsional)
  notes?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

// ─── EMPLOYEE DOCUMENTS ──────────────────────────────────────────────────────
export type EmployeeDocumentType =
  | 'ktp'
  | 'kk'
  | 'npwp'
  | 'ijazah'
  | 'transkrip'
  | 'cv'
  | 'sertifikat'
  | 'kontrak_kerja'
  | 'bpjs_kesehatan'
  | 'bpjs_ketenagakerjaan'
  | 'surat_referensi'
  | 'lainnya';

export interface EmployeeDocument {
  id: string;
  userId: string;
  name: string;                  // Nama dokumen
  type: EmployeeDocumentType;
  fileUrl: string;               // Base64 atau URL
  fileType?: string;
  fileSizeKb?: number;
  uploadedAt: string;
  notes?: string;
}

export interface Division {
  id: string;
  code: string;
  name: string;
  description?: string;
  leaderName?: string;
  locationName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  polygonCoords?: Array<{ lat: number; lng: number }>;
  bssidWhitelist?: string;
  wifiSsid?: string;
}

export interface Shift {
  id: string;
  code?: string;                // e.g. 'REG', 'PAGI', 'SIANG', 'MALAM'
  name: string;
  startTime: string;            // '08:00'
  endTime: string;              // '17:00'
  breakStartTime?: string;      // '12:00'
  breakEndTime?: string;        // '13:00'
  lateToleranceMinutes: number; // e.g. 15
  earliestClockInMinutes?: number; // e.g. 60 mins before start
  isCrossDay?: boolean;         // Shift malam lintas hari (misal 22:00 - 06:00)
  workingDays?: number[];       // [1, 2, 3, 4, 5] (1=Senin s/d 7=Minggu)
  colorTag?: string;            // e.g. '#0d9488', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'
  description?: string;
  isDefault?: boolean;
}

export interface EmployeeSchedule {
  id: string;
  userId: string;
  userName: string;
  userNip?: string;
  divisionId?: string;
  scheduleDate: string; // YYYY-MM-DD
  shiftId?: string;
  shiftCode: string; // 'P' | 'S' | 'M' | 'OFF' | string
  shiftName: string; // 'Shift 1 (07:30 - 15:30)', etc.
  startTime: string; // '07:30'
  endTime: string;   // '15:30'
  durationHours: number;
  isNightShift: boolean;
  isOff: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  bssidWhitelist?: string; // Comma-separated router MAC addresses / BSSIDs
  wifiSsid?: string;       // Official office Wi-Fi SSID
}

export interface UserProfile {
  id: string;
  nip: string;
  fullName: string;
  email: string;
  password?: string;
  phone: string;
  roleId: string;
  roleName: string; // e.g. 'superadmin', 'admin', 'hrd', 'pimpinan', 'keuangan', 'karyawan'
  divisionId?: string;
  divisionName?: string;
  originalDivisionId?: string;   // Divisi asal sebelum mutasi/penugasan
  originalDivisionName?: string;
  assignmentNotes?: string;      // Catatan penugasan lokasi kerja baru
  shiftId?: string;
  avatarUrl?: string;
  annualLeaveQuota: number;
  usedLeaveDays: number;
  isActive: boolean;
  registeredDeviceId?: string; // Device Fingerprint UUID
  deviceModel?: string;        // Browser / Device name
  createdAt: string;

  // ─── Biometric Face Recognition Master Data ──────────────
  isFaceEnrolled?: boolean;
  faceDescriptor?: number[];
  faceEnrolledPhoto?: string;
  faceEnrolledAt?: string;

  // ─── Extended Personal Data ──────────────────────────────
  nickname?: string;             // Nama panggilan
  gender?: 'L' | 'P';           // Laki-laki / Perempuan
  birthPlace?: string;
  birthDate?: string;            // YYYY-MM-DD
  religion?: string;             // Islam | Kristen | Katolik | Hindu | Buddha | Konghucu
  maritalStatus?: string;        // Belum Menikah | Menikah | Cerai
  bloodType?: string;            // A | B | AB | O
  education?: string;            // SD | SMP | SMA/SMK | D1 | D2 | D3 | D4 | S1 | S2 | S3

  // ─── Extended Contact & Address ─────────────────────────
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  nik?: string;                  // NIK KTP (16 digit)
  npwpPersonal?: string;         // NPWP Pribadi

  // ─── Emergency Contact ──────────────────────────────────
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  // ─── Employment Data ────────────────────────────────────
  joinDate?: string;             // YYYY-MM-DD
  contractType?: 'PKWT' | 'PKWTT' | 'Magang' | 'Freelance';
  contractEndDate?: string;      // YYYY-MM-DD (untuk PKWT)
  bpjsKesehatan?: string;        // No. BPJS Kesehatan
  bpjsKetenagakerjaan?: string;  // No. BPJS Ketenagakerjaan
  kepalaReguId?: string;         // UUID of assigned Kepala Regu (Danru)
  kepalaReguName?: string;       // Name of assigned Kepala Regu (Danru)

  // ─── Field Sentinel & Dynamic Flexible Geofencing ──────────────
  assignedLocationName?: string;
  assignedLatitude?: number;
  assignedLongitude?: number;
  assignedRadiusMeters?: number;
  isFieldSentinelEnabled?: boolean;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  lastKnownAccuracy?: number;
  lastKnownPingAt?: string;
  isOutOfBounds?: boolean;
  outOfBoundsDistance?: number;
  currentActivePostId?: string;
  currentActivePostName?: string;
  currentActivePostEnteredAt?: string;
  assignedPosts?: FieldAssignedPost[];

  // ─── Documents ──────────────────────────────────────────
  employeeDocuments?: EmployeeDocument[];
}

export interface FieldAssignedPost {
  id: string;
  userId: string;
  postCode: string;
  postName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FieldPatrolCheck {
  id: string;
  userId: string;
  userName: string;
  userNip: string;
  checkType: 'spot_check' | 'clock_in' | 'clock_out' | 'pimpinan_instruction';
  locationName: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceFromTarget: number;
  isWithinRadius: boolean;
  watermarkedPhotoUrl: string;
  biometricScore?: number;
  biometricVerified?: boolean;
  notes?: string;
  createdAt: string;
}

export type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'cuti' | 'alfa';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userNip: string;
  userAvatar?: string;
  divisionName?: string;
  attendanceDate: string; // YYYY-MM-DD
  clockIn?: string;       // HH:mm:ss
  clockOut?: string;      // HH:mm:ss
  latIn?: number;
  longIn?: number;
  photoIn?: string;
  latOut?: number;
  longOut?: number;
  photoOut?: string;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeavingMinutes: number;
  workDurationMinutes: number;
  notes?: string;
  // Shift assignment metadata
  shiftId?: string;
  shiftCode?: string;          // 'P' | 'S' | 'M' | 'OFF'
  shiftName?: string;
  // Anti-fraud security metadata
  deviceId?: string;
  isMockSuspected?: boolean;
  securityScore?: number;      // 0 - 100%
  securityFlags?: string[];    // e.g. ['DEVICE_MATCH', 'GEO_RADIUS_OK', 'HARDWARE_CAM', 'WATERMARK_VERIFIED']
  biometricScore?: number;     // 0 - 100% (Face recognition confidence against master vector)
  biometricMatch?: boolean;    // true if match >= threshold
  geofenceDistance?: number;   // Distance in meters to assigned office/division
  geofenceValid?: boolean;     // true if within allowed radius
  isMockLocation?: boolean;    // true if mock provider / spoofing detected
  isLocked?: boolean;          // true if attendance is locked due to breach
  isPerimeterBreached?: boolean; // true if employee left office without permit
  perimeterBreachCount?: number; // count of breach events today
  timeOutsideMinutes?: number; // cumulative minutes outside office perimeter
  // Early Leave & Remote Unlock (Rekomendasi 1, 2, 3)
  isEarlyLeave?: boolean;
  earlyLeaveReason?: string;
  earlyLeaveCategory?: 'sakit_mendadak' | 'darurat_keluarga' | 'tugas_luar' | 'lainnya' | string;
  isRemoteUnlocked?: boolean;
  remoteUnlockedBy?: string;
  remoteUnlockedAt?: string;
  // 1-Hour Break Time Policy
  isOnBreak?: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
  breakDurationMinutes?: number;
}

export type ViolationStatus = 'active' | 'resolved' | 'penalized';

export interface PerimeterViolation {
  id: string;
  userId: string;
  userName: string;
  userNip: string;
  attendanceId?: string;
  divisionId?: string;
  divisionName?: string;
  violationDate: string;
  detectedAt: string;
  distanceMeters: number;
  exitLatitude?: number;
  exitLongitude?: number;
  durationOutsideMinutes: number;
  status: ViolationStatus;
  notes: string;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
}

export type LeaveType = 'cuti_tahunan' | 'sakit' | 'izin' | 'dinas';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userNip: string;
  divisionName?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvalNotes?: string;
  substituteId?: string;
  substituteName?: string;
  substituteNip?: string;
  createdAt: string;
}

// ─── PAYROLL SYSTEM MODELS ──────────────────────────────────────────────────

export interface PayrollSettings {
  salaryCalculationDay: number;      // Tanggal tutup periode (misal 25)
  paymentDay: number;                // Tanggal gajian (misal 1)
  workingDaysPerMonth: number;       // Standar hari kerja sebulan (default 22)
  lateDeductionPerMinute: number;    // Potongan per menit keterlambatan (Rp)
  absenceDeductionPerDay: number;    // Potongan per hari absen/alfa (Rp)
  defaultTaxRate: number;            // PPh 21 default dalam % (misal 5)
  bpjsKesehatanEmployee: number;     // % BPJS Kesehatan dari gaji pokok (1%)
  bpjsKesehatanEmployer: number;     // % BPJS Kesehatan employer (4%)
  bpjsKetenagakerjaanEmployee: number; // % JHT karyawan (2%)
  bpjsKetenagakerjaanEmployer: number; // % JHT employer (3.7%)
  includeOvertimeInPayroll: boolean; // Auto-include approved OT
  currency: string;                  // 'IDR'
}

export interface OtherAllowance {
  name: string;
  amount: number;
}

export interface EmployeeSalaryProfile {
  id: string;
  userId: string;
  baseSalary: number;              // Gaji pokok
  positionAllowance: number;       // Tunjangan jabatan
  transportAllowance: number;      // Tunjangan transport
  mealAllowance: number;           // Tunjangan makan
  housingAllowance: number;        // Tunjangan perumahan
  healthAllowance: number;         // Tunjangan kesehatan
  otherAllowances: OtherAllowance[]; // Tunjangan tambahan lainnya
  taxSetting: 'gross' | 'gross_up' | 'netto'; // Metode pajak
  employeeType: 'tetap' | 'kontrak' | 'magang';
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  effectiveDate: string;           // YYYY-MM-DD, sejak kapan berlaku
  updatedAt: string;
}

export type PayrollPeriodStatus = 'draft' | 'processing' | 'approved' | 'paid';

export interface PayrollPeriod {
  id: string;
  month: number;   // 1-12
  year: number;
  periodLabel: string;  // e.g. "September 2026"
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  status: PayrollPeriodStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalOvertimePay: number;
  createdAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
}

export type PayrollSlipStatus = 'draft' | 'approved' | 'paid';

export interface PayrollSlip {
  id: string;
  periodId: string;
  periodLabel: string;
  userId: string;
  userName: string;
  userNip: string;
  divisionId?: string;
  divisionName?: string;
  employeeType: 'tetap' | 'kontrak' | 'magang';
  bankName: string;
  bankAccount: string;
  bankAccountName: string;

  // === PENGHASILAN ===
  baseSalary: number;
  positionAllowance: number;
  transportAllowance: number;
  mealAllowance: number;
  housingAllowance: number;
  healthAllowance: number;
  otherAllowances: OtherAllowance[];
  overtimePay: number;             // Dari OvertimeRecord approved+unpaid
  overtimeHours: number;
  grossIncome: number;             // Total bruto

  // === POTONGAN ===
  lateDeduction: number;           // totalLateMinutes × tarif/menit
  absenceDeduction: number;        // hari alfa × tarif/hari
  bpjsKesehatan: number;           // % dari baseSalary
  bpjsKetenagakerjaan: number;     // % dari baseSalary
  pph21: number;                   // Pajak penghasilan
  otherDeductions: OtherAllowance[]; // Potongan lain-lain
  totalDeductions: number;

  // === HASIL ===
  netSalary: number;               // Take home pay

  // === DETAIL KEHADIRAN PERIODE INI ===
  workingDays: number;             // Standar hari kerja bulan ini
  presentDays: number;             // Hari hadir (hadir + terlambat)
  lateCount: number;               // Jumlah hari terlambat
  totalLateMinutes: number;
  absentCount: number;             // Hari alfa (tidak hadir tanpa keterangan)
  leaveCount: number;              // Hari cuti/izin/sakit approved
  overtimeRecordIds: string[];     // IDs of linked OT records

  status: PayrollSlipStatus;
  approvedBy?: string;
  approvedByName?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

// ─── OVERTIME SYSTEM MODELS ───────────────────────────────────────────────────
export interface OvertimeSettings {
  hourlyRate: number;              // Tarif dasar uang lembur per jam (misal Rp 25.000)
  weekendRateMultiplier: number;   // Pengali hari libur / akhir pekan (misal 2.0x)
  minDurationMinutes: number;      // Durasi minimum agar terhitung lembur (misal 30 menit)
  roundingMinutes: number;         // Pembulatan menit (misal per 30 menit)
  maxDailyHours: number;           // Batas maksimal jam lembur per hari (misal 4 jam)
  autoDetectFromClockOut: boolean; // Deteksi otomatis dari presensi pulang
  requireApproval: boolean;        // Wajib persetujuan atasan/HRD sebelum cair
}

export type OvertimeStatus = 'pending' | 'approved' | 'rejected';
export type OvertimePaymentStatus = 'unpaid' | 'paid' | 'included_in_payroll';

export interface OvertimeRecord {
  id: string;
  userId: string;
  userName: string;
  userNip: string;
  divisionId?: string;
  divisionName?: string;
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:mm
  endTime: string;            // HH:mm
  durationMinutes: number;    // Durasi total menit
  durationHours: number;      // Durasi dalam jam
  requestedHours?: number;    // Jam lembur yang diajukan oleh karyawan
  approvedHours?: number;     // Jam lembur resmi yang disetujui Admin
  assignedByAdmin?: boolean;  // Apakah lembur ini diaktifkan langsung oleh Admin
  isWeekendHoliday: boolean;  // Apakah hari libur/akhir pekan
  hourlyRate: number;         // Tarif per jam yang diterapkan
  rateMultiplier: number;     // Nilai pengali (1.0 atau 2.0)
  totalPay: number;           // Total uang lembur (Rp)
  taskDescription: string;    // Rincian tugas/pekerjaan lembur
  status: OvertimeStatus;
  paymentStatus: OvertimePaymentStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvalNotes?: string;
  supervisorName?: string;
  supervisorSignature?: string;
  overtimePhase?: 'requested' | 'in_progress' | 'completed' | 'cancelled';
  startedAt?: string;
  scheduledEndTime?: string;
  actualEndTime?: string;
  completionNotes?: string;
  completionPhotos?: string[];
  createdAt: string;
}

// ─── HRM IN-APP NOTIFICATIONS ───────────────────────────────────────────────
export interface HrmNotification {
  id: string;
  userId?: string;             // Penerima (bisa 'all_admin' atau userId karyawan)
  recipientRole?: string;     // 'superadmin' | 'pimpinan' | 'hrd' | 'admin' | 'karyawan' | 'all'
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'transfer' | 'overtime' | 'leave' | 'swap' | string;
  createdAt: string;
  timestamp?: string;
  isRead: boolean;
  link?: string;
  metadata?: {
    employeeId?: string;
    employeeName?: string;
    divisionId?: string;
    divisionName?: string;
    previousDivisionName?: string;
    overtimeHours?: number;
    actionByAdminName?: string;
    [key: string]: any;
  };
}

// ─── SHIFT SWAP & VACANCY WORKFLOW (DANRU -> KORLAP) ───────────────────────
export type ShiftSwapStatus = 'pending_danru' | 'pending_korlap' | 'approved' | 'rejected' | 'pending';

export interface CandidateMetrics {
  cuti_days: number;
  izin_count: number;
  sakit_count: number;
  ot_hours_total: number;
  ot_hours_month: number;
  ot_count: number;
  swap_substitute_count: number;
  swap_requester_count: number;
  // Leave quota fields (sinkron dari database)
  annual_leave_quota?: number;   // default: 14 (12+2)
  used_leave_days?: number;
  remaining_leave_days?: number; // computed: annual_leave_quota - cuti_days
}

export interface SmartSubstituteCandidate {
  id: string;
  name: string;
  nip: string;
  division_name: string;
  placement_location?: string;
  job_title?: string;
  hourly_overtime_rate?: number;
  score: number;
  badge: string;
  badge_color?: string;
  reasons: string[];
  metrics: CandidateMetrics;
  fairness_badge?: string;
  rest_interval_status?: 'SAFE' | 'WARNING';
}

export interface ShiftSwapRecord {
  id: string;
  requester_id: string;
  requester_name?: string;
  requester_nip?: string;
  requester_division?: string;
  requester_avatar?: string;
  substitute_id?: string;
  substitute_name?: string;
  substitute_nip?: string;
  substitute_division?: string;
  substitute_avatar?: string;
  swap_date: string;
  original_shift: string;
  target_shift?: string;
  reason: string;
  status: ShiftSwapStatus;
  danru_id?: string;
  danru_name?: string;
  danru_substitute_id?: string;
  danru_recommended_name?: string;
  danru_notes?: string;
  danru_status?: string;
  danru_at?: string;
  korlap_id?: string;
  korlap_name?: string;
  korlap_notes?: string;
  korlap_status?: string;
  korlap_at?: string;
  approved_by?: string;
  approver_name?: string;
  system_recommendations?: SmartSubstituteCandidate[];
  notes?: string;
  created_at: string;
}
