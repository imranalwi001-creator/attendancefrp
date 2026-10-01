import express from 'express';
import cors from 'cors';
import { pool, initDb } from './db.js';
import { seedInitialUsers } from './seed.js';

const app = express();
const PORT = process.env.PORT || 5000;
const FACE_AI_URL = process.env.FACE_AI_URL || 'http://hrm-face-ai:5001';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDir = path.join(__dirname, '../public/downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/downloads', express.static(downloadsDir));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── 1. AUTHENTICATION ────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Email/NIP dan kata sandi wajib diisi' });
  }

  const cleanId = identifier.trim().toLowerCase();
  try {
    const query = `
      SELECT p.*, r.name as role_code, r.label as role_label, d.name as division_title,
             sp.hourly_overtime_rate, sp.base_salary, sp.severance_scheme
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE (LOWER(p.email) = $1 OR LOWER(p.nip) = $1) AND p.is_active = true
      LIMIT 1;
    `;
    const result = await pool.query(query, [cleanId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Email atau NIP tidak terdaftar dalam sistem' });
    }

    const row = result.rows[0];
    if (row.password && row.password !== password) {
      return res.status(401).json({ success: false, error: 'Kata sandi tidak sesuai' });
    }

    const user = formatUserRow(row);
    res.json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Kesalahan internal server' });
  }
});

// Helper: Format PostgreSQL row to match TypeScript UserProfile
function formatUserRow(r) {
  return {
    id: r.id,
    nip: r.nip,
    fullName: r.full_name,
    email: r.email,
    password: r.password,
    phone: r.phone || '',
    roleId: r.role_id,
    roleName: (r.role_code || r.role_name || 'karyawan').toLowerCase().replace(/\s+/g, ''),
    roleLabel: r.role_label || r.role_name || 'Karyawan',
    divisionId: r.division_id,
    divisionName: r.resolved_division_name || r.division_title || (r.division_name && r.division_name.trim() ? r.division_name : 'Umum'),
    divisionLocationName: r.division_location_name || '',
    divisionRadiusMeters: r.division_radius_meters ? parseFloat(r.division_radius_meters) : 150,
    divisionLatitude: r.division_latitude ? parseFloat(r.division_latitude) : null,
    divisionLongitude: r.division_longitude ? parseFloat(r.division_longitude) : null,
    placementLocation: r.placement_location || '',
    jobTitle: r.job_title || '',
    employeeSequenceNo: r.employee_sequence_no || 0,
    hourlyOvertimeRate: r.hourly_overtime_rate ? parseFloat(r.hourly_overtime_rate) : 23381.79,
    baseSalary: r.base_salary ? parseFloat(r.base_salary) : 4045050,
    severanceScheme: r.severance_scheme || 'tabungan',
    shiftId: r.shift_id,
    shiftName: r.shift_name || '',
    shiftStartTime: r.shift_start_time ? r.shift_start_time.substring(0, 5) : '08:00',
    shiftEndTime: r.shift_end_time ? r.shift_end_time.substring(0, 5) : '17:00',
    avatarUrl: r.avatar_url,
    gender: r.gender,
    birthPlace: r.birth_place,
    birthDate: r.birth_date,
    address: r.address,
    city: r.city || '',
    province: r.province || '',
    postalCode: r.postal_code || '',
    nickname: r.nickname || '',
    nik: r.nik || '',
    npwpPersonal: r.npwp || '',
    religion: r.religion || '',
    maritalStatus: r.marital_status || '',
    bloodType: r.blood_type || '',
    education: r.education || '',
    emergencyContact: r.emergency_contact,
    emergencyPhone: r.emergency_phone,
    emergencyContactRelation: r.emergency_relation || '',
    employmentStatus: r.employment_status || 'permanent',
    joinDate: r.join_date,
    contractType: r.contract_type || '',
    contractEndDate: r.contract_end_date,
    bpjsKesehatan: r.bpjs_kesehatan || '',
    bpjsKetenagakerjaan: r.bpjs_ketenagakerjaan || '',
    annualLeaveQuota: r.annual_leave_quota || 14,
    usedLeaveDays: r.used_leave_days || 0,
    isActive: r.is_active !== false,
    isFaceEnrolled: r.is_face_enrolled === true || (Array.isArray(r.face_embedding) && r.face_embedding.length > 0) || !!r.face_descriptor,
    faceDescriptor: r.face_descriptor ? (typeof r.face_descriptor === 'string' ? JSON.parse(r.face_descriptor) : r.face_descriptor) : null,
    faceEnrolledPhoto: r.face_photo_url || r.face_enrolled_photo || null,
    faceEnrolledAt: r.face_enrolled_at || null,
    deviceId: r.device_id || null,
    deviceModel: r.device_model || null,
    isDeviceBound: r.is_device_bound === true,
    deviceBoundAt: r.device_bound_at || null,
    kepalaReguId: r.kepala_regu_id || null,
    kepalaReguName: r.kepala_regu_name || null,
    createdAt: r.created_at,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveRoleId(roleId, roleName) {
  if (roleId && UUID_REGEX.test(roleId)) return roleId;
  const target = roleName || (typeof roleId === 'string' ? roleId.replace(/^role-/, '') : null);
  if (target) {
    const res = await pool.query('SELECT id FROM hrm_roles WHERE LOWER(name) = LOWER($1) LIMIT 1', [target]);
    if (res.rows.length > 0) return res.rows[0].id;
  }
  const fallback = await pool.query("SELECT id FROM hrm_roles WHERE name = 'karyawan' LIMIT 1");
  return fallback.rows[0]?.id || null;
}

async function resolveDivisionId(divisionId, divisionName) {
  if (divisionId && UUID_REGEX.test(divisionId)) return divisionId;
  const target = divisionName || (typeof divisionId === 'string' ? divisionId.replace(/^div-/, '') : null);
  if (target) {
    const res = await pool.query(
      'SELECT id FROM hrm_divisions WHERE LOWER(code) = LOWER($1) OR LOWER(name) LIKE LOWER($2) LIMIT 1',
      [target, `%${target}%`]
    );
    if (res.rows.length > 0) return res.rows[0].id;
  }
  const fallback = await pool.query('SELECT id FROM hrm_divisions LIMIT 1');
  return fallback.rows[0]?.id || null;
}

async function resolveShiftId(shiftId) {
  if (shiftId && UUID_REGEX.test(shiftId)) return shiftId;
  const fallback = await pool.query('SELECT id FROM hrm_shifts WHERE is_default = true LIMIT 1');
  if (fallback.rows.length > 0) return fallback.rows[0].id;
  const anyShift = await pool.query('SELECT id FROM hrm_shifts LIMIT 1');
  return anyShift.rows[0]?.id || null;
}

// ─── 2. BOOTSTRAP INITIAL SYNC ───────────────────────────────────────────────
app.get('/api/sync/bootstrap', async (req, res) => {
  try {
    const [
      usersRes,
      rolesRes,
      divisionsRes,
      shiftsRes,
      officeRes,
      companyRes,
      attendancesRes,
      leavesRes,
      overtimeSettingsRes,
      overtimeRecordsRes,
      payrollSettingsRes,
      violationsRes,
      notificationsRes,
      shiftSwapsRes,
      salaryProfilesRes,
      payrollPeriodsRes,
    ] = await Promise.all([
      pool.query(`
        SELECT p.*, r.name as role_code, r.label as role_label,
               kr.full_name as kepala_regu_name,
               COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
               d.location_name as division_location_name,
               d.radius_meters as division_radius_meters,
               d.latitude as division_latitude,
               d.longitude as division_longitude,
               s.name as shift_name,
               s.start_time as shift_start_time,
               s.end_time as shift_end_time,
               sp.hourly_overtime_rate, sp.base_salary, sp.severance_scheme
        FROM hrm_profiles p
        LEFT JOIN hrm_roles r ON p.role_id = r.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_shifts s ON p.shift_id = s.id
        LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
        LEFT JOIN hrm_profiles kr ON p.kepala_regu_id = kr.id
        ORDER BY p.employee_sequence_no ASC NULLS LAST, p.created_at ASC
      `),
      pool.query('SELECT * FROM hrm_roles ORDER BY created_at ASC'),
      pool.query('SELECT * FROM hrm_divisions ORDER BY code ASC'),
      pool.query('SELECT * FROM hrm_shifts ORDER BY created_at ASC'),
      pool.query('SELECT * FROM hrm_office_locations WHERE is_active = true LIMIT 1'),
      pool.query('SELECT * FROM hrm_company_profile LIMIT 1'),
      pool.query('SELECT * FROM hrm_attendances ORDER BY attendance_date DESC, clock_in DESC LIMIT 500'),
      pool.query(`
        SELECT l.*, 
               p.full_name as user_name, 
               p.nip as user_nip, 
               d.name as division_name,
               ap.full_name as approver_name
        FROM hrm_leave_requests l
        LEFT JOIN hrm_profiles p ON l.user_id = p.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_profiles ap ON l.approved_by = ap.id
        ORDER BY l.created_at DESC LIMIT 200
      `),
      pool.query('SELECT * FROM hrm_overtime_settings LIMIT 1'),
      pool.query(`
        SELECT o.*, 
               p.full_name as user_name, 
               p.nip as user_nip, 
               d.name as division_name,
               ap.full_name as approver_name
        FROM hrm_overtime_records o
        LEFT JOIN hrm_profiles p ON o.user_id = p.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_profiles ap ON o.approved_by = ap.id
        ORDER BY o.date DESC, o.created_at DESC LIMIT 200
      `),
      pool.query('SELECT * FROM hrm_payroll_settings LIMIT 1'),
      pool.query(`
        SELECT v.*, p.full_name as user_name, p.nip as user_nip, d.name as division_name, r.full_name as resolved_by_name
        FROM hrm_perimeter_violations v
        LEFT JOIN hrm_profiles p ON v.user_id = p.id
        LEFT JOIN hrm_divisions d ON v.division_id = d.id
        LEFT JOIN hrm_profiles r ON v.resolved_by = r.id
        ORDER BY v.detected_at DESC LIMIT 200
      `),
      pool.query('SELECT * FROM hrm_notifications ORDER BY created_at DESC LIMIT 100'),
      pool.query(`
        SELECT s.*, 
               rp.full_name as requester_name, rp.nip as requester_nip,
               sp.full_name as substitute_name, sp.nip as substitute_nip
        FROM hrm_shift_swaps s
        JOIN hrm_profiles rp ON s.requester_id = rp.id
        JOIN hrm_profiles sp ON s.substitute_id = sp.id
        ORDER BY s.created_at DESC LIMIT 100
      `),
      pool.query(`
        SELECT sp.*, p.full_name as user_name, p.nip as user_nip, d.name as division_name
        FROM hrm_payroll_salary_profiles sp
        JOIN hrm_profiles p ON sp.user_id = p.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        ORDER BY p.full_name ASC
      `),
      pool.query('SELECT * FROM hrm_payroll_periods ORDER BY year DESC, month DESC LIMIT 24'),
    ]);

    const users = usersRes.rows.map(formatUserRow);

    const roles = rolesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.is_system,
    }));

    const divisions = divisionsRes.rows.map(formatDivisionRow);

    const shifts = shiftsRes.rows.map((s) => ({
      id: s.id,
      code: s.name.substring(0, 4).toUpperCase(),
      name: s.name,
      startTime: s.start_time ? s.start_time.substring(0, 5) : '08:00',
      endTime: s.end_time ? s.end_time.substring(0, 5) : '17:00',
      lateToleranceMinutes: s.late_tolerance_minutes || 15,
      isDefault: s.is_default,
    }));

    const office = formatOfficeRow(officeRes.rows[0]);

    const company = companyRes.rows[0]
      ? {
          id: companyRes.rows[0].id,
          companyName: companyRes.rows[0].company_name,
          shortName: companyRes.rows[0].short_name,
          legalType: companyRes.rows[0].legal_type,
          businessSector: companyRes.rows[0].business_sector,
          foundedDate: companyRes.rows[0].founded_date,
          npwp: companyRes.rows[0].npwp,
          nib: companyRes.rows[0].nib,
          siupNumber: companyRes.rows[0].siup_number,
          deedNumber: companyRes.rows[0].deed_number,
          address: companyRes.rows[0].address,
          city: companyRes.rows[0].city,
          province: companyRes.rows[0].province,
          postalCode: companyRes.rows[0].postal_code,
          phone: companyRes.rows[0].phone,
          email: companyRes.rows[0].email,
          website: companyRes.rows[0].website,
          directorName: companyRes.rows[0].director_name,
          hrManagerName: companyRes.rows[0].hr_manager_name,
          logoUrl: companyRes.rows[0].logo_url,
        }
      : null;

    const attendances = attendancesRes.rows.map((a) => ({
      id: a.id,
      userId: a.user_id,
      date: a.attendance_date ? new Date(a.attendance_date).toISOString().split('T')[0] : '',
      clockIn: a.clock_in ? a.clock_in.substring(0, 5) : undefined,
      clockOut: a.clock_out ? a.clock_out.substring(0, 5) : undefined,
      clockInPhoto: a.photo_in,
      clockOutPhoto: a.photo_out,
      clockInLat: parseFloat(a.lat_in) || undefined,
      clockInLong: parseFloat(a.long_in) || undefined,
      clockOutLat: parseFloat(a.lat_out) || undefined,
      clockOutLong: parseFloat(a.long_out) || undefined,
      status: a.status,
      lateMinutes: a.late_minutes || 0,
      earlyLeavingMinutes: a.early_leaving_minutes || 0,
      workDurationMinutes: a.work_duration_minutes || 0,
      isLocked: a.is_locked === true,
      isPerimeterBreached: a.is_perimeter_breached === true,
      perimeterBreachCount: a.perimeter_breach_count || 0,
      timeOutsideMinutes: a.time_outside_minutes || 0,
      notes: a.notes,
      biometricScore: a.biometric_score != null ? parseFloat(a.biometric_score) : undefined,
      biometricMatch: a.biometric_match != null ? a.biometric_match : undefined,
      geofenceDistance: a.geofence_distance_meters != null ? parseFloat(a.geofence_distance_meters) : undefined,
      geofenceValid: a.geofence_valid != null ? a.geofence_valid : undefined,
      isMockLocation: a.is_mock_location === true,
      securityFlags: Array.isArray(a.security_flags) ? a.security_flags : (typeof a.security_flags === 'string' ? JSON.parse(a.security_flags) : []),
    }));

    const perimeterViolations = violationsRes.rows.map((v) => ({
      id: v.id,
      userId: v.user_id,
      userName: v.user_name || 'Karyawan',
      userNip: v.user_nip || '',
      attendanceId: v.attendance_id,
      divisionId: v.division_id,
      divisionName: v.division_name || '',
      violationDate: v.violation_date ? new Date(v.violation_date).toISOString().split('T')[0] : '',
      detectedAt: v.detected_at,
      distanceMeters: v.distance_meters != null ? parseFloat(v.distance_meters) : 0,
      exitLatitude: v.exit_latitude != null ? parseFloat(v.exit_latitude) : undefined,
      exitLongitude: v.exit_longitude != null ? parseFloat(v.exit_longitude) : undefined,
      durationOutsideMinutes: v.duration_outside_minutes || 0,
      status: v.status || 'active',
      notes: v.notes || '',
      resolutionNotes: v.resolution_notes || '',
      resolvedBy: v.resolved_by,
      resolvedByName: v.resolved_by_name || '',
      resolvedAt: v.resolved_at,
      createdAt: v.created_at,
    }));

    res.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        users,
        roles,
        divisions,
        shifts,
        office,
        company,
        attendances,
        perimeterViolations,
        leaves: leavesRes.rows,
        overtimeSettings: overtimeSettingsRes.rows[0] || null,
        overtimeRecords: overtimeRecordsRes.rows,
        payrollSettings: payrollSettingsRes.rows[0] || null,
        notifications: notificationsRes.rows,
        shiftSwaps: shiftSwapsRes.rows,
        salaryProfiles: salaryProfilesRes.rows,
        payrollPeriods: payrollPeriodsRes.rows,
      },
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 3. USERS MANAGEMENT ──────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, r.name as role_code, r.label as role_label,
             COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
             d.location_name as division_location_name,
             d.radius_meters as division_radius_meters,
             d.latitude as division_latitude,
             d.longitude as division_longitude,
             s.name as shift_name,
             s.start_time as shift_start_time,
             s.end_time as shift_end_time,
             sp.hourly_overtime_rate, sp.base_salary, sp.severance_scheme
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      ORDER BY p.employee_sequence_no ASC NULLS LAST, p.created_at ASC
    `);
    res.json({ success: true, data: result.rows.map(formatUserRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const u = req.body;
  if (!u.nip || !u.fullName || !u.email) {
    return res.status(400).json({ success: false, error: 'NIP, nama lengkap, dan email wajib diisi' });
  }

  // Enforce: Hanya Superadmin yang bisa menentukan role Superadmin
  const operatorRole = req.headers['x-user-role'] || req.body.operatorRole || req.body.currentOperatorRole;
  if ((u.roleName === 'superadmin' || u.roleId === 'role-superadmin') && operatorRole && operatorRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Hanya Superadmin yang berhak menetapkan role Superadmin.' });
  }

  try {
    const resolvedRole = await resolveRoleId(u.roleId, u.roleName);
    const resolvedDiv = await resolveDivisionId(u.divisionId, u.divisionName);
    const resolvedShift = await resolveShiftId(u.shiftId);
    const resolvedKrId = u.kepalaReguId && UUID_REGEX.test(u.kepalaReguId) ? u.kepalaReguId : null;

    const query = `
      INSERT INTO hrm_profiles (
        nip, full_name, email, password, phone, role_name, role_id,
        division_name, division_id, shift_id, employment_status,
        annual_leave_quota, used_leave_days, is_active,
        address, city, province, postal_code,
        gender, birth_place, birth_date,
        emergency_contact, emergency_phone, emergency_relation,
        nickname, nik, npwp, religion, marital_status, blood_type, education,
        join_date, contract_type, contract_end_date,
        bpjs_kesehatan, bpjs_ketenagakerjaan, avatar_url, kepala_regu_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34,
        $35, $36, $37, $38
      )
      ON CONFLICT (email) DO UPDATE SET
        nip = EXCLUDED.nip,
        full_name = EXCLUDED.full_name,
        password = COALESCE(EXCLUDED.password, hrm_profiles.password),
        phone = EXCLUDED.phone,
        role_name = EXCLUDED.role_name,
        role_id = EXCLUDED.role_id,
        division_name = EXCLUDED.division_name,
        division_id = EXCLUDED.division_id,
        shift_id = EXCLUDED.shift_id,
        employment_status = EXCLUDED.employment_status,
        annual_leave_quota = EXCLUDED.annual_leave_quota,
        is_active = EXCLUDED.is_active,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        province = EXCLUDED.province,
        postal_code = EXCLUDED.postal_code,
        gender = EXCLUDED.gender,
        birth_place = EXCLUDED.birth_place,
        birth_date = EXCLUDED.birth_date,
        emergency_contact = EXCLUDED.emergency_contact,
        emergency_phone = EXCLUDED.emergency_phone,
        emergency_relation = EXCLUDED.emergency_relation,
        nickname = EXCLUDED.nickname,
        nik = EXCLUDED.nik,
        npwp = EXCLUDED.npwp,
        religion = EXCLUDED.religion,
        marital_status = EXCLUDED.marital_status,
        blood_type = EXCLUDED.blood_type,
        education = EXCLUDED.education,
        join_date = EXCLUDED.join_date,
        contract_type = EXCLUDED.contract_type,
        contract_end_date = EXCLUDED.contract_end_date,
        bpjs_kesehatan = EXCLUDED.bpjs_kesehatan,
        bpjs_ketenagakerjaan = EXCLUDED.bpjs_ketenagakerjaan,
        avatar_url = COALESCE(EXCLUDED.avatar_url, hrm_profiles.avatar_url),
        kepala_regu_id = COALESCE(EXCLUDED.kepala_regu_id, hrm_profiles.kepala_regu_id),
        updated_at = NOW()
      RETURNING *;
    `;
    let divName = u.divisionName;
    if (!divName && resolvedDiv) {
      const dRes = await pool.query('SELECT name FROM hrm_divisions WHERE id = $1', [resolvedDiv]);
      if (dRes.rows.length > 0) divName = dRes.rows[0].name;
    }

    const result = await pool.query(query, [
      u.nip,
      u.fullName,
      u.email.trim().toLowerCase(),
      u.password || 'password123',
      u.phone || '',
      u.roleName || 'karyawan',
      resolvedRole,
      divName || '',
      resolvedDiv,
      resolvedShift,
      u.employmentStatus || 'permanent',
      u.annualLeaveQuota || 12,
      u.usedLeaveDays || 0,
      u.isActive !== false,
      u.address || null,
      u.city || null,
      u.province || null,
      u.postalCode || null,
      u.gender || null,
      u.birthPlace || null,
      u.birthDate || null,
      u.emergencyContact || u.emergencyContactName || null,
      u.emergencyPhone || u.emergencyContactPhone || null,
      u.emergencyRelation || u.emergencyContactRelation || null,
      u.nickname || null,
      u.nik || null,
      u.npwp || u.npwpPersonal || null,
      u.religion || null,
      u.maritalStatus || null,
      u.bloodType || null,
      u.education || null,
      u.joinDate || null,
      u.contractType || null,
      u.contractEndDate || null,
      u.bpjsKesehatan || null,
      u.bpjsKetenagakerjaan || null,
      u.avatarUrl || null,
      resolvedKrId,
    ]);

    const createdId = result.rows[0].id;
    const fullUserRes = await pool.query(`
      SELECT p.*, r.name as role_code, r.label as role_label,
             kr.full_name as kepala_regu_name,
             COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
             d.location_name as division_location_name,
             d.radius_meters as division_radius_meters,
             d.latitude as division_latitude,
             d.longitude as division_longitude,
             s.name as shift_name,
             s.start_time as shift_start_time,
             s.end_time as shift_end_time
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN hrm_profiles kr ON p.kepala_regu_id = kr.id
      WHERE p.id = $1
      LIMIT 1
    `, [createdId]);

    res.json({ success: true, data: formatUserRow(fullUserRes.rows[0]) });
  } catch (err) {
    console.error('Add user error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const u = req.body;

  // Enforce: Hanya Superadmin yang bisa menentukan role Superadmin
  const operatorRole = req.headers['x-user-role'] || req.body.operatorRole || req.body.currentOperatorRole;
  if ((u.roleName === 'superadmin' || u.roleId === 'role-superadmin') && operatorRole && operatorRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Hanya Superadmin yang berhak menetapkan role Superadmin.' });
  }

  try {
    const isUuid = UUID_REGEX.test(id);
    let resolvedRole = undefined;
    let resolvedDiv = undefined;
    let resolvedShift = undefined;

    if (u.roleId || u.roleName) resolvedRole = await resolveRoleId(u.roleId, u.roleName);
    if (u.divisionId || u.divisionName) resolvedDiv = await resolveDivisionId(u.divisionId, u.divisionName);
    if (u.shiftId) resolvedShift = await resolveShiftId(u.shiftId);

    // If id is not a valid UUID, search by email or NIP
    let existing;
    if (isUuid) {
      existing = await pool.query('SELECT * FROM hrm_profiles WHERE id = $1', [id]);
    } else {
      existing = await pool.query(
        'SELECT * FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($2)',
        [u.email || '', u.nip || '']
      );
    }

    if (existing.rows.length === 0) {
      // If not found, forward to create/upsert
      const insertRes = await pool.query(
        `INSERT INTO hrm_profiles (
          nip, full_name, email, password, phone, role_name, role_id,
          division_name, division_id, shift_id, address, city, province, postal_code, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
        RETURNING *;`,
        [
          u.nip || `EMP${Date.now().toString().slice(-4)}`,
          u.fullName || 'Karyawan',
          (u.email || '').trim().toLowerCase(),
          u.password || 'password123',
          u.phone || '',
          u.roleName || 'karyawan',
          resolvedRole || null,
          u.divisionName || '',
          resolvedDiv || null,
          resolvedShift || null,
          u.address || '',
          u.city || '',
          u.province || '',
          u.postalCode || '',
        ]
      );
      return res.json({ success: true, data: formatUserRow(insertRes.rows[0]) });
    }

    let divName = u.divisionName;
    if (!divName && resolvedDiv) {
      const dRes = await pool.query('SELECT name FROM hrm_divisions WHERE id = $1', [resolvedDiv]);
      if (dRes.rows.length > 0) divName = dRes.rows[0].name;
    }

    const targetId = existing.rows[0].id;
    const krParam = u.kepalaReguId === null || u.kepalaReguId === '' ? '__SET_NULL__' : (u.kepalaReguId && UUID_REGEX.test(u.kepalaReguId) ? u.kepalaReguId : undefined);

    const query = `
      UPDATE hrm_profiles SET
        nip = COALESCE($1, nip),
        full_name = COALESCE($2, full_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        role_name = COALESCE($5, role_name),
        role_id = COALESCE($6, role_id),
        division_name = COALESCE($7, division_name),
        division_id = COALESCE($8, division_id),
        shift_id = COALESCE($9, shift_id),
        password = COALESCE($10, password),
        is_active = COALESCE($11, is_active),
        address = COALESCE($12, address),
        city = COALESCE($13, city),
        province = COALESCE($14, province),
        postal_code = COALESCE($15, postal_code),
        gender = COALESCE($16, gender),
        birth_place = COALESCE($17, birth_place),
        birth_date = COALESCE($18, birth_date),
        emergency_contact = COALESCE($19, emergency_contact),
        emergency_phone = COALESCE($20, emergency_phone),
        annual_leave_quota = COALESCE($21, annual_leave_quota),
        avatar_url = COALESCE($22, avatar_url),
        kepala_regu_id = CASE WHEN $23 = '__SET_NULL__' THEN NULL WHEN $23 IS NOT NULL THEN $23::uuid ELSE kepala_regu_id END,
        updated_at = NOW()
      WHERE id = $24
      RETURNING id;
    `;
    await pool.query(query, [
      u.nip,
      u.fullName,
      u.email ? u.email.trim().toLowerCase() : undefined,
      u.phone,
      u.roleName,
      resolvedRole,
      divName,
      resolvedDiv,
      resolvedShift,
      u.password,
      u.isActive,
      u.address,
      u.city,
      u.province,
      u.postalCode,
      u.gender,
      u.birthPlace,
      u.birthDate,
      u.emergencyContact || u.emergencyContactName,
      u.emergencyPhone || u.emergencyContactPhone,
      u.annualLeaveQuota,
      u.avatarUrl,
      krParam,
      targetId,
    ]);

    const fullUserRes = await pool.query(`
      SELECT p.*, r.name as role_code, r.label as role_label,
             kr.full_name as kepala_regu_name,
             COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
             d.location_name as division_location_name,
             d.radius_meters as division_radius_meters,
             d.latitude as division_latitude,
             d.longitude as division_longitude,
             s.name as shift_name,
             s.start_time as shift_start_time,
             s.end_time as shift_end_time
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN hrm_profiles kr ON p.kepala_regu_id = kr.id
      WHERE p.id = $1
      LIMIT 1
    `, [targetId]);

    res.json({ success: true, data: formatUserRow(fullUserRes.rows[0]) });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const isUuid = UUID_REGEX.test(id);
    if (isUuid) {
      await pool.query('DELETE FROM hrm_profiles WHERE id = $1', [id]);
    } else {
      await pool.query('DELETE FROM hrm_profiles WHERE LOWER(nip) = LOWER($1) OR LOWER(email) = LOWER($1)', [id]);
    }
    res.json({ success: true, message: 'Karyawan berhasil dihapus' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── 4. ATTENDANCES (PRESENSI DENGAN SERVER-SIDE ANTI-FRAUD) ──────────────────

// Helper: Haversine Spherical Distance (Meters)
function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

app.post('/api/attendances/clock-in', async (req, res) => {
  const {
    userId,
    date,
    time,
    photo,
    latitude,
    longitude,
    status,
    lateMinutes,
    notes,
    biometricScore,
    biometricMatch,
    geofenceDistance,
    geofenceValid,
    isMockLocation,
    securityFlags,
    deviceId,
    deviceModel,
  } = req.body;
  try {
    // 0. Profile & Device Binding Check (1 Karyawan = 1 HP Terdaftar)
    let userProfile = null;
    const userRes = await pool.query(
      `SELECT id, full_name, device_id, device_model, is_device_bound, face_embedding FROM hrm_profiles WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length > 0) {
      userProfile = userRes.rows[0];
    }

    if (userProfile && deviceId) {
      if (userProfile.is_device_bound && userProfile.device_id && userProfile.device_id !== deviceId) {
        return res.status(403).json({
          success: false,
          error: `Peringatan Keamanan: Akun Anda telah terkunci pada perangkat HP resmi Anda (${userProfile.device_model || 'HP Terdaftar'}). Hubungi HRD/Admin untuk reset perangkat jika Anda mengganti HP.`,
          code: 'DEVICE_BINDING_MISMATCH'
        });
      }

      // Auto-bind on first clock-in if not bound yet
      if (!userProfile.is_device_bound) {
        await pool.query(
          `UPDATE hrm_profiles SET device_id = $1, device_model = $2, is_device_bound = true, device_bound_at = NOW() WHERE id = $3`,
          [deviceId, deviceModel || 'Android Phone', userId]
        );
      }
    }

    // 1. Validasi Server-Side Geofencing
    let serverDistance = geofenceDistance;
    let isServerGeofenceValid = geofenceValid !== false;

    if (latitude && longitude && userId) {
      const locRes = await pool.query(
        `SELECT 
           COALESCE(d.latitude, o.latitude, -6.2088) as office_lat,
           COALESCE(d.longitude, o.longitude, 106.8456) as office_lon,
           COALESCE(d.radius_meters, o.radius_meters, 150) as allowed_radius,
           COALESCE(d.name, o.name, 'Kantor Pusat') as location_name
         FROM hrm_profiles p
         LEFT JOIN hrm_divisions d ON p.division_id = d.id
         LEFT JOIN hrm_office_locations o ON o.is_active = true
         WHERE p.id = $1 LIMIT 1`,
        [userId]
      );

      if (locRes.rows.length > 0) {
        const loc = locRes.rows[0];
        serverDistance = calculateHaversineMeters(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(loc.office_lat),
          parseFloat(loc.office_lon)
        );
        isServerGeofenceValid = serverDistance <= parseFloat(loc.allowed_radius);
      }
    }

    // 2. Audit Trail & Fraud Violation Logging (Anti-Fake GPS / Out of Bounds)
    const detectedFlags = Array.isArray(securityFlags) ? [...securityFlags] : [];
    if (isMockLocation === true) {
      detectedFlags.push('MOCK_LOCATION_DETECTED');
      try {
        await pool.query(
          `INSERT INTO hrm_perimeter_violations (
             user_id, violation_date, distance_meters, exit_latitude, exit_longitude, notes, status
           ) VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
          [
            userId,
            date || new Date().toISOString().split('T')[0],
            serverDistance || 0,
            latitude || 0,
            longitude || 0,
            'FRAUD DETECTED: Aplikasi Fake GPS / Lokasi Tiruan Terdeteksi saat Clock-In',
          ]
        );
      } catch (logErr) {
        console.error('Error logging perimeter violation:', logErr);
      }
    }

    // 3. Biometric Face AI Verification via InsightFace
    let computedBiometricScore = biometricScore;
    let computedBiometricMatch = biometricMatch;

    if (userProfile && Array.isArray(userProfile.face_embedding) && userProfile.face_embedding.length > 0 && photo) {
      try {
        const aiRes = await fetch(`${FACE_AI_URL}/verify-face-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: photo,
            master_embedding: userProfile.face_embedding,
            threshold: 0.70
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.success) {
            computedBiometricMatch = aiData.is_match;
            computedBiometricScore = aiData.confidence;

            if (!aiData.is_match) {
              return res.status(400).json({
                success: false,
                error: `Verifikasi Wajah Gagal: Wajah terdeteksi ${aiData.confidence}% cocok (batas aman min. 70%). Pastikan tidak diwakilkan oleh orang lain dan posisi wajah terang.`,
                code: 'BIOMETRIC_MISMATCH',
                confidence: aiData.confidence
              });
            }
          }
        }
      } catch (aiErr) {
        console.warn('[BiometricAI] Face AI microservice offline/unreachable:', aiErr.message);
        detectedFlags.push('BIOMETRIC_SERVICE_OFFLINE');
      }
    }

    const flagsJson = JSON.stringify(detectedFlags);
    const query = `
      INSERT INTO hrm_attendances (
        user_id, attendance_date, clock_in, photo_in, lat_in, long_in, status, late_minutes, notes,
        biometric_score, biometric_match, geofence_distance_meters, geofence_valid, is_mock_location, security_flags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, attendance_date) DO UPDATE SET
        clock_in = EXCLUDED.clock_in,
        photo_in = EXCLUDED.photo_in,
        lat_in = EXCLUDED.lat_in,
        long_in = EXCLUDED.long_in,
        status = EXCLUDED.status,
        late_minutes = EXCLUDED.late_minutes,
        notes = EXCLUDED.notes,
        biometric_score = COALESCE(EXCLUDED.biometric_score, hrm_attendances.biometric_score),
        biometric_match = COALESCE(EXCLUDED.biometric_match, hrm_attendances.biometric_match),
        geofence_distance_meters = COALESCE($12, EXCLUDED.geofence_distance_meters, hrm_attendances.geofence_distance_meters),
        geofence_valid = COALESCE($13, EXCLUDED.geofence_valid, hrm_attendances.geofence_valid),
        is_mock_location = COALESCE(EXCLUDED.is_mock_location, hrm_attendances.is_mock_location),
        security_flags = COALESCE(EXCLUDED.security_flags, hrm_attendances.security_flags)
      RETURNING *;
    `;
    const result = await pool.query(query, [
      userId,
      date,
      time,
      photo,
      latitude,
      longitude,
      status || 'hadir',
      lateMinutes || 0,
      notes || '',
      computedBiometricScore != null ? computedBiometricScore : null,
      computedBiometricMatch != null ? computedBiometricMatch : null,
      serverDistance != null ? serverDistance : geofenceDistance,
      isServerGeofenceValid,
      isMockLocation === true,
      flagsJson,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Clock-in error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── BIOMETRIC MASTER FACE ENROLLMENT & DEVICE RESET ──────────────────────────
app.post('/api/biometric/enroll-master', async (req, res) => {
  const { userId, photo, imageBase64 } = req.body;
  const targetPhoto = photo || imageBase64;
  if (!userId || !targetPhoto) {
    return res.status(400).json({ success: false, error: 'userId dan foto master wajib dikirim' });
  }

  try {
    const aiRes = await fetch(`${FACE_AI_URL}/extract-embedding-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: targetPhoto })
    });

    const aiData = await aiRes.json();
    if (!aiData.success) {
      return res.status(400).json({ success: false, error: aiData.error || 'Gagal mengekstrak fitur wajah master' });
    }

    await pool.query(
      `UPDATE hrm_profiles SET face_embedding = $1, face_photo_url = $2, face_enrolled_at = NOW(), is_face_enrolled = true WHERE id = $3`,
      [aiData.embedding, targetPhoto.startsWith('data:') ? targetPhoto.slice(0, 100) : targetPhoto, userId]
    );

    res.json({
      success: true,
      message: 'Template biometrik wajah master 512-dimensi berhasil didaftarkan!',
      dimension: aiData.dimension,
      det_score: aiData.det_score
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/biometric/reset-device', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId wajib diisi' });
  }

  try {
    await pool.query(
      `UPDATE hrm_profiles SET device_id = NULL, device_model = NULL, is_device_bound = false, device_bound_at = NULL WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Kunci perangkat berhasil di-reset. Karyawan dapat login dan clock-in dari perangkat baru.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/apk/latest-info', (req, res) => {
  res.json({
    version: '1.0.0+1',
    apkName: 'hrm_attendance_app.apk',
    downloadUrl: '/downloads/hrm_attendance_app.apk',
    releaseNotes: 'HRM Mobile APK Resmi - On-Device Face Recognition, GPS Geofencing, & Shift Swaps'
  });
});

// ─── 13. PAYROLL & SLIP GAJI RESMI PT. FAWWAZ RESKI PERWIRA ───────────────────
app.get('/api/payroll/periods', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
        COUNT(s.id) as actual_slip_count
      FROM hrm_payroll_periods p
      LEFT JOIN hrm_payroll_slips s ON s.period_id = p.id
      GROUP BY p.id
      ORDER BY p.year DESC, p.month DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/payroll/slips', async (req, res) => {
  const { periodId, userId, search } = req.query;
  try {
    let query = `
      SELECT 
        s.*,
        p.full_name as employee_name,
        p.nip as employee_nip,
        p.email as employee_email,
        d.name as division_name,
        COALESCE(sp.bank_name, 'Bank Mandiri') as bank_name,
        COALESCE(sp.bank_account_number, '-') as bank_account_number,
        COALESCE(sp.bank_account_holder, p.full_name) as bank_account_holder
      FROM hrm_payroll_slips s
      JOIN hrm_profiles p ON s.user_id = p.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (periodId) {
      params.push(periodId);
      query += ` AND s.period_id = $${params.length}`;
    }
    if (userId) {
      params.push(userId);
      query += ` AND (s.user_id::text = $${params.length} OR p.email = $${params.length} OR p.nip = $${params.length})`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.full_name ILIKE $${params.length} OR p.nip ILIKE $${params.length})`;
    }

    query += ` ORDER BY s.created_at DESC, p.full_name ASC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/payroll/my-slip', async (req, res) => {
  const { userId, periodId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Parameter userId wajib disertakan' });
  }

  try {
    let query = `
      SELECT 
        s.*,
        p.full_name as employee_name,
        p.nip as employee_nip,
        p.email as employee_email,
        p.placement_location,
        COALESCE(sp.employee_sequence_no, p.employee_sequence_no, 0) as employee_sequence_no,
        COALESCE(sp.severance_scheme, 'tabungan') as severance_scheme,
        COALESCE(sp.saved_severance_balance, 0) as saved_severance_balance,
        r.name as role_name,
        d.name as division_name,
        COALESCE(sp.bank_name, 'Bank Central Asia (BCA)') as bank_name,
        COALESCE(sp.bank_account_number, '-') as bank_account_number,
        COALESCE(sp.bank_account_holder, p.full_name) as bank_account_holder
      FROM hrm_payroll_slips s
      JOIN hrm_profiles p ON s.user_id = p.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE (s.user_id::text = $1 OR LOWER(p.email) = LOWER($1) OR p.nip = $1)
    `;
    const params = [userId];

    if (periodId) {
      params.push(periodId);
      query += ` AND s.period_id = $2`;
    }

    query += ` ORDER BY s.created_at DESC LIMIT 1`;

    let result = await pool.query(query, params);
    let row;

    if (result.rows.length > 0) {
      row = result.rows[0];
    } else {
      // Fallback query directly from profile
      const profRes = await pool.query(`
        SELECT p.*, r.name as role_name, d.name as division_name,
               COALESCE(sp.employee_sequence_no, p.employee_sequence_no, 0) as employee_sequence_no,
               COALESCE(sp.severance_scheme, 'tabungan') as severance_scheme,
               COALESCE(sp.saved_severance_balance, 0) as saved_severance_balance,
               COALESCE(sp.hourly_overtime_rate, 24173.06) as hourly_overtime_rate,
               COALESCE(sp.base_salary, 4045050) as base_salary,
               COALESCE(sp.bank_name, 'Bank Central Asia (BCA)') as bank_name,
               COALESCE(sp.bank_account_number, '-') as bank_account_number
        FROM hrm_profiles p
        LEFT JOIN hrm_roles r ON p.role_id = r.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
        WHERE p.id::text = $1 OR LOWER(p.email) = LOWER($1) OR p.nip = $1
        LIMIT 1
      `, [userId]);

      if (profRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Belum ada dokumen slip gaji untuk karyawan ini.' });
      }

      const prof = profRes.rows[0];
      row = {
        id: `SLIP-2026-09-${prof.nip || 'EMP008'}`,
        user_id: prof.id,
        employee_name: prof.full_name,
        employee_nip: prof.nip,
        employee_sequence_no: prof.employee_sequence_no,
        severance_scheme: prof.severance_scheme,
        placement_location: prof.placement_location,
        division_name: prof.division_name,
        role_name: prof.role_name,
        bank_name: prof.bank_name,
        bank_account_number: prof.bank_account_number,
        period_label: 'September 2026',
        printed_date: new Date().toISOString(),
        status: 'paid',
        base_salary: prof.base_salary || '4045050',
        total_overtime_pay: '0',
        pesangon_label: 'Pesangon September',
        pesangon_amount: '0',
        gross_income: String(prof.base_salary || '4045050'),
        bpjs_ketenagakerjaan_deduction: '121351',
        bpjs_kesehatan_deduction: '40450',
        alpa_days: 0,
        alpa_rate: '155000',
        absence_deduction: '0',
        total_deductions: '161802',
        net_salary: '3883248',
        notes: 'Slip gaji resmi PT. FAWWAZ RESKI PERWIRA',
      };
    }

    // Dynamic month calculation
    const INDO_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    let activeMonth = INDO_MONTHS[new Date().getMonth()];
    if (row.period_label) {
      for (const m of INDO_MONTHS) {
        if (row.period_label.toLowerCase().includes(m.toLowerCase())) {
          activeMonth = m;
          break;
        }
      }
    }
    const dynamicPesangonLabel = `Pesangon ${activeMonth}`;

    // Dual severance scheme determination
    const seqNo = Number(row.employee_sequence_no || 0);
    const severanceScheme = row.severance_scheme || (seqNo > 0 && seqNo <= 33 ? 'tabungan' : 'cash_with_salary');
    const rawPesangon = Number(row.pesangon_amount || 0);

    let pesangonAmount = 0;
    let savedPesangonAmount = 0;
    let isSeveranceSaved = false;

    if (severanceScheme === 'tabungan' || (seqNo > 0 && seqNo <= 33)) {
      pesangonAmount = 0;
      savedPesangonAmount = rawPesangon;
      isSeveranceSaved = true;
    } else {
      pesangonAmount = rawPesangon;
      savedPesangonAmount = 0;
      isSeveranceSaved = false;
    }

    const upah = Number(row.base_salary || 4045050);
    const lembur = Number(row.total_overtime_pay || 0);
    const calculatedGross = upah + lembur + pesangonAmount;

    let bpjsTk = Number(row.bpjs_ketenagakerjaan_deduction);
    let bpjsKes = Number(row.bpjs_kesehatan_deduction);
    if (!bpjsTk || bpjsTk === 121351) bpjsTk = Math.round(upah * 0.03);
    if (!bpjsKes || bpjsKes === 40450) bpjsKes = Math.round(upah * 0.01);

    const alpaAmount = Number(row.absence_deduction || 0);
    const totalDeductions = bpjsTk + bpjsKes + alpaAmount;
    const netSalary = calculatedGross - totalDeductions;

    // Structured format matching the official template + Flutter mobile SalarySlipModal
    const formattedSlip = {
      id: row.id,
      period: row.period_label || 'September 2026',
      printedDate: row.printed_date ? new Date(row.printed_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID'),
      status: (row.status || 'paid').toUpperCase(),
      employee: {
        id: row.user_id,
        name: row.employee_name,
        nip: row.employee_nip,
        sequenceNo: seqNo,
        severanceScheme: severanceScheme,
        savedSeveranceBalance: Number(row.saved_severance_balance || 0),
        placementLocation: row.placement_location || '-',
        division: row.division_name || 'Umum',
        role: row.role_name || 'karyawan',
        bankName: row.bank_name || 'Bank Central Asia (BCA)',
        bankAccount: row.bank_account_number || '-'
      },
      // PENDAPATAN
      upah: upah,
      lembur: lembur,
      pesangonLabel: dynamicPesangonLabel,
      pesangonAmount: pesangonAmount,
      savedPesangonAmount: savedPesangonAmount,
      isSeveranceSaved: isSeveranceSaved,
      grossEarnings: calculatedGross,
      earnings: [
        { label: 'Upah', amount: upah },
        { label: 'Lembur', amount: lembur },
        { label: dynamicPesangonLabel, amount: pesangonAmount }
      ],
      // POTONGAN
      bpjsTkLabel: 'BPJS Ketenagakerjaan 3%',
      bpjsTkAmount: bpjsTk,
      bpjsKesLabel: 'BPJS Kesehatan 1%',
      bpjsKesAmount: bpjsKes,
      alpaDays: Number(row.alpa_days || 0),
      alpaRate: Number(row.alpa_rate || 0),
      alpaAmount: alpaAmount,
      totalDeductions: totalDeductions,
      deductions: [
        { label: 'BPJS Ketenagakerjaan 3%', amount: bpjsTk },
        { label: 'BPJS Kesehatan 1%', amount: bpjsKes },
        { label: `Presensi / Alpa (${row.alpa_days || 0} Hari)`, amount: alpaAmount }
      ],
      // HASIL
      netSalary: netSalary,
      notes: row.notes || 'Slip gaji resmi PT. FAWWAZ RESKI PERWIRA'
    };

    res.json({
      success: true,
      slip: formattedSlip,
      raw: row
    });
  } catch (err) {
    console.error('Error fetching salary slip:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/payroll/slips/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE hrm_payroll_slips SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Slip gaji tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/attendances/clock-out', async (req, res) => {
  const {
    userId,
    date,
    time,
    photo,
    latitude,
    longitude,
    earlyLeavingMinutes,
    workDurationMinutes,
    biometricScore,
    biometricMatch,
    geofenceDistance,
    geofenceValid,
    isMockLocation,
    securityFlags,
  } = req.body;
  try {
    let serverDistance = geofenceDistance;
    let isServerGeofenceValid = geofenceValid !== false;

    if (latitude && longitude && userId) {
      const locRes = await pool.query(
        `SELECT 
           COALESCE(d.latitude, o.latitude, -6.2088) as office_lat,
           COALESCE(d.longitude, o.longitude, 106.8456) as office_lon,
           COALESCE(d.radius_meters, o.radius_meters, 150) as allowed_radius
         FROM hrm_profiles p
         LEFT JOIN hrm_divisions d ON p.division_id = d.id
         LEFT JOIN hrm_office_locations o ON o.is_active = true
         WHERE p.id = $1 LIMIT 1`,
        [userId]
      );
      if (locRes.rows.length > 0) {
        const loc = locRes.rows[0];
        serverDistance = calculateHaversineMeters(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(loc.office_lat),
          parseFloat(loc.office_lon)
        );
        isServerGeofenceValid = serverDistance <= parseFloat(loc.allowed_radius);
      }
    }

    const flagsJson = JSON.stringify(Array.isArray(securityFlags) ? securityFlags : []);
    const query = `
      UPDATE hrm_attendances SET
        clock_out = $1,
        photo_out = $2,
        lat_out = $3,
        long_out = $4,
        early_leaving_minutes = $5,
        work_duration_minutes = $6,
        biometric_score = COALESCE($9, biometric_score),
        biometric_match = COALESCE($10, biometric_match),
        geofence_distance_meters = COALESCE($11, geofence_distance_meters),
        geofence_valid = COALESCE($12, geofence_valid),
        is_mock_location = COALESCE($13, is_mock_location),
        security_flags = COALESCE($14, security_flags),
        updated_at = NOW()
      WHERE user_id = $7 AND attendance_date = $8
      RETURNING *;
    `;
    const result = await pool.query(query, [
      time,
      photo,
      latitude,
      longitude,
      earlyLeavingMinutes || 0,
      workDurationMinutes || 0,
      userId,
      date,
      biometricScore != null ? biometricScore : null,
      biometricMatch != null ? biometricMatch : null,
      serverDistance != null ? serverDistance : geofenceDistance,
      isServerGeofenceValid,
      isMockLocation === true,
      flagsJson,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Clock-out error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/attendances', async (req, res) => {
  const { date } = req.query;
  try {
    let query = 'SELECT * FROM hrm_attendances';
    const params = [];
    if (date) {
      query += ' WHERE attendance_date = $1';
      params.push(date);
    }
    query += ' ORDER BY attendance_date DESC, clock_in DESC LIMIT 500';
    const result = await pool.query(query, params);
    const data = result.rows.map((a) => ({
      id: a.id,
      userId: a.user_id,
      date: a.attendance_date ? new Date(a.attendance_date).toISOString().split('T')[0] : '',
      clockIn: a.clock_in ? a.clock_in.substring(0, 5) : undefined,
      clockOut: a.clock_out ? a.clock_out.substring(0, 5) : undefined,
      clockInPhoto: a.photo_in,
      clockOutPhoto: a.photo_out,
      clockInLat: parseFloat(a.lat_in) || undefined,
      clockInLong: parseFloat(a.long_in) || undefined,
      clockOutLat: parseFloat(a.lat_out) || undefined,
      clockOutLong: parseFloat(a.long_out) || undefined,
      status: a.status,
      lateMinutes: a.late_minutes || 0,
      earlyLeavingMinutes: a.early_leaving_minutes || 0,
      workDurationMinutes: a.work_duration_minutes || 0,
      isLocked: a.is_locked === true,
      isPerimeterBreached: a.is_perimeter_breached === true,
      perimeterBreachCount: a.perimeter_breach_count || 0,
      timeOutsideMinutes: a.time_outside_minutes || 0,
      notes: a.notes,
      biometricScore: a.biometric_score != null ? parseFloat(a.biometric_score) : undefined,
      biometricMatch: a.biometric_match != null ? a.biometric_match : undefined,
      geofenceDistance: a.geofence_distance_meters != null ? parseFloat(a.geofence_distance_meters) : undefined,
      geofenceValid: a.geofence_valid != null ? a.geofence_valid : undefined,
      isMockLocation: a.is_mock_location === true,
      securityFlags: Array.isArray(a.security_flags) ? a.security_flags : (typeof a.security_flags === 'string' ? JSON.parse(a.security_flags) : []),
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4A-1. GEOFENCE PERIMETER BREACH & DISCIPLINARY ENGINE ──────────────────────
app.post('/api/geofence/report-breach', async (req, res) => {
  const {
    userId,
    attendanceId,
    divisionId,
    distanceMeters,
    latitude,
    longitude,
    durationOutsideMinutes,
    notes,
  } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID wajib disertakan' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const today = new Date().toISOString().split('T')[0];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Resolve valid user UUID
    let validUserId = userId;
    if (!uuidRegex.test(validUserId)) {
      const pRes = await client.query(
        'SELECT id, division_id FROM hrm_profiles WHERE id::text = $1 OR LOWER(nip) = LOWER($1) OR LOWER(full_name) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (pRes.rows.length > 0) {
        validUserId = pRes.rows[0].id;
      } else {
        const fallback = await client.query('SELECT id FROM hrm_profiles ORDER BY created_at ASC LIMIT 1');
        validUserId = fallback.rows[0]?.id;
      }
    }

    // Resolve valid attendance UUID
    let validAttendanceId = null;
    if (attendanceId && uuidRegex.test(attendanceId)) {
      validAttendanceId = attendanceId;
    } else {
      const attRes = await client.query(
        'SELECT id FROM hrm_attendances WHERE user_id = $1 AND attendance_date = $2 LIMIT 1',
        [validUserId, today]
      );
      if (attRes.rows.length > 0) {
        validAttendanceId = attRes.rows[0].id;
      }
    }

    // Resolve valid division UUID
    let validDivisionId = null;
    if (divisionId && uuidRegex.test(divisionId)) {
      validDivisionId = divisionId;
    } else {
      const divRes = await client.query('SELECT division_id FROM hrm_profiles WHERE id = $1', [validUserId]);
      if (divRes.rows.length > 0) {
        validDivisionId = divRes.rows[0].division_id;
      }
    }

    // 1. Insert disciplinary breach record
    const insViol = `
      INSERT INTO hrm_perimeter_violations (
        user_id, attendance_id, division_id, violation_date, distance_meters,
        exit_latitude, exit_longitude, duration_outside_minutes, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      RETURNING *;
    `;
    const violResult = await client.query(insViol, [
      validUserId,
      validAttendanceId,
      validDivisionId,
      today,
      distanceMeters != null ? distanceMeters : null,
      latitude != null ? latitude : null,
      longitude != null ? longitude : null,
      durationOutsideMinutes || 1,
      notes || 'Meninggalkan area kantor tanpa izin dinas luar aktif saat jam kerja',
    ]);

    // 2. Lock employee attendance and mark perimeter breached
    if (validAttendanceId) {
      await client.query(`
        UPDATE hrm_attendances SET
          is_locked = true,
          is_perimeter_breached = true,
          perimeter_breach_count = COALESCE(perimeter_breach_count, 0) + 1,
          time_outside_minutes = COALESCE(time_outside_minutes, 0) + $1,
          updated_at = NOW()
        WHERE id = $2;
      `, [durationOutsideMinutes || 1, validAttendanceId]);
    } else {
      await client.query(`
        UPDATE hrm_attendances SET
          is_locked = true,
          is_perimeter_breached = true,
          perimeter_breach_count = COALESCE(perimeter_breach_count, 0) + 1,
          time_outside_minutes = COALESCE(time_outside_minutes, 0) + $1,
          updated_at = NOW()
        WHERE user_id = $2 AND attendance_date = $3 AND clock_out IS NULL;
      `, [durationOutsideMinutes || 1, validUserId, today]);
    }

    // 3. Create high-priority disciplinary notification
    await client.query(`
      INSERT INTO hrm_notifications (
        user_id, title, message, type, is_read, created_at
      ) VALUES (
        $1,
        'PERINGATAN DISIPLIN: Pelanggaran Perimeter Terdeteksi',
        $2,
        'alert',
        false,
        NOW()
      );
    `, [
      validUserId,
      `Anda terdeteksi meninggalkan lokasi kantor (${Math.round(distanceMeters || 0)}m) pada jam kerja aktif tanpa surat izin resmi. Presensi checkout dinonaktifkan otomatis demi integritas sistem.`,
    ]);

    await client.query('COMMIT');
    console.log(`[Geofence] Disciplinary perimeter breach recorded for user ${validUserId} at ${distanceMeters}m`);
    res.json({ success: true, violation: violResult.rows[0], data: violResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Report breach error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/geofence/resolve-breach', async (req, res) => {
  const { violationId, resolvedBy, resolutionNotes, unlockAttendance } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let validResolverId = null;
    if (resolvedBy && uuidRegex.test(resolvedBy)) {
      validResolverId = resolvedBy;
    } else if (resolvedBy) {
      const rRes = await client.query(
        'SELECT id FROM hrm_profiles WHERE id::text = $1 OR LOWER(nip) = LOWER($1) OR LOWER(full_name) = LOWER($1) LIMIT 1',
        [resolvedBy]
      );
      if (rRes.rows.length > 0) validResolverId = rRes.rows[0].id;
    }

    const query = `
      UPDATE hrm_perimeter_violations SET
        status = 'resolved',
        resolution_notes = $1,
        resolved_by = $2,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id::text = $3
      RETURNING *;
    `;
    const result = await client.query(query, [resolutionNotes || 'Disetujui oleh atasan / HRD', validResolverId, violationId]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Pelanggaran tidak ditemukan' });
    }

    const viol = result.rows[0];
    if (unlockAttendance) {
      if (viol.attendance_id) {
        await client.query(`
          UPDATE hrm_attendances SET
            is_locked = false,
            notes = COALESCE(notes, '') || ' [Dispensasi Perimeter oleh Atasan: ' || $1 || ']',
            updated_at = NOW()
          WHERE id = $2;
        `, [resolutionNotes || 'Dispensasi HR', viol.attendance_id]);
      } else {
        await client.query(`
          UPDATE hrm_attendances SET
            is_locked = false,
            notes = COALESCE(notes, '') || ' [Dispensasi Perimeter oleh Atasan: ' || $1 || ']',
            updated_at = NOW()
          WHERE user_id = $2 AND attendance_date = $3;
        `, [resolutionNotes || 'Dispensasi HR', viol.user_id, viol.violation_date]);
      }
    }

    await client.query('COMMIT');
    console.log(`[Geofence] Breach ${violationId} resolved by user ${resolvedBy}`);
    res.json({ success: true, violation: viol, data: viol });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Resolve breach error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/geofence/violations', async (req, res) => {
  try {
    const query = `
      SELECT v.*, p.full_name as user_name, p.nip as user_nip, d.name as division_name, r.full_name as resolved_by_name
      FROM hrm_perimeter_violations v
      LEFT JOIN hrm_profiles p ON v.user_id = p.id
      LEFT JOIN hrm_divisions d ON v.division_id = d.id
      LEFT JOIN hrm_profiles r ON v.resolved_by = r.id
      ORDER BY v.detected_at DESC LIMIT 200;
    `;
    const result = await pool.query(query);
    const violations = result.rows.map((v) => ({
      id: v.id,
      userId: v.user_id,
      userName: v.user_name || '',
      nip: v.user_nip || '',
      attendanceId: v.attendance_id,
      divisionId: v.division_id,
      divisionName: v.division_name || '',
      violationDate: v.violation_date ? new Date(v.violation_date).toISOString().split('T')[0] : '',
      detectedAt: v.detected_at,
      distanceMeters: parseFloat(v.distance_meters) || 0,
      exitLatitude: v.exit_latitude ? parseFloat(v.exit_latitude) : null,
      exitLongitude: v.exit_longitude ? parseFloat(v.exit_longitude) : null,
      durationOutsideMinutes: v.duration_outside_minutes || 0,
      status: v.status,
      notes: v.notes || '',
      resolutionNotes: v.resolution_notes || '',
      resolvedBy: v.resolved_by,
      resolvedByName: v.resolved_by_name || '',
      resolvedAt: v.resolved_at,
      createdAt: v.created_at,
    }));
    res.json({ success: true, violations, data: violations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4B. BIOMETRIC FACE ENROLLMENT & IDENTITY MANAGEMENT ───────────────────────
app.post('/api/biometrics/enroll', async (req, res) => {
  const { userId, faceDescriptor, enrolledPhoto } = req.body;
  if (!userId || !faceDescriptor) {
    return res.status(400).json({ success: false, error: 'User ID dan data biometrik wajah wajib disertakan' });
  }
  try {
    const descriptorStr = Array.isArray(faceDescriptor) ? JSON.stringify(faceDescriptor) : String(faceDescriptor);
    const query = `
      UPDATE hrm_profiles SET
        is_face_enrolled = true,
        face_descriptor = $1,
        face_enrolled_photo = COALESCE($2, face_enrolled_photo),
        face_enrolled_at = NOW(),
        avatar_url = COALESCE($2, avatar_url),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await pool.query(query, [descriptorStr, enrolledPhoto || null, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    console.log(`[Biometrics] Master face enrolled successfully for user ${userId}`);
    res.json({ success: true, data: formatUserRow(result.rows[0]) });
  } catch (err) {
    console.error('Enroll biometrics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/biometrics/reset/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const query = `
      UPDATE hrm_profiles SET
        is_face_enrolled = false,
        face_descriptor = NULL,
        face_enrolled_photo = NULL,
        face_enrolled_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    console.log(`[Biometrics] Master face reset successfully for user ${userId}`);
    res.json({ success: true, data: formatUserRow(result.rows[0]) });
  } catch (err) {
    console.error('Reset biometrics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 5. DIVISIONS (CRUD POSTGRESQL & COORDINATE SYNC) ───────────────────────────
function formatDivisionRow(d) {
  if (!d) return null;
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description || '',
    locationName: d.location_name || '',
    address: d.address || '',
    latitude: d.latitude !== null && d.latitude !== undefined ? parseFloat(d.latitude) : -6.2088,
    longitude: d.longitude !== null && d.longitude !== undefined ? parseFloat(d.longitude) : 106.8456,
    radiusMeters: d.radius_meters || 150,
    polygonCoords: d.polygon_coords ? (typeof d.polygon_coords === 'string' ? JSON.parse(d.polygon_coords) : d.polygon_coords) : null,
    bssidWhitelist: d.bssid_whitelist || '',
    wifiSsid: d.wifi_ssid || '',
  };
}

app.get('/api/divisions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hrm_divisions ORDER BY code ASC');
    res.json({ success: true, data: result.rows.map(formatDivisionRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/divisions', async (req, res) => {
  const d = req.body;
  try {
    const polygonJson = d.polygonCoords ? (typeof d.polygonCoords === 'string' ? d.polygonCoords : JSON.stringify(d.polygonCoords)) : null;
    const query = `
      INSERT INTO hrm_divisions (
        code, name, description, location_name, address, latitude, longitude, radius_meters, polygon_coords, bssid_whitelist, wifi_ssid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        location_name = EXCLUDED.location_name,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        radius_meters = EXCLUDED.radius_meters,
        polygon_coords = COALESCE(EXCLUDED.polygon_coords, hrm_divisions.polygon_coords),
        bssid_whitelist = COALESCE(EXCLUDED.bssid_whitelist, hrm_divisions.bssid_whitelist),
        wifi_ssid = COALESCE(EXCLUDED.wifi_ssid, hrm_divisions.wifi_ssid),
        updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [
      d.code ? d.code.trim().toUpperCase() : 'DIV',
      d.name || '',
      d.description || '',
      d.locationName || d.location_name || '',
      d.address || '',
      d.latitude !== undefined ? Number(d.latitude) : -6.2088,
      d.longitude !== undefined ? Number(d.longitude) : 106.8456,
      d.radiusMeters || d.radius_meters || 150,
      polygonJson,
      d.bssidWhitelist || null,
      d.wifiSsid || null,
    ]);
    res.json({ success: true, data: formatDivisionRow(result.rows[0]) });
  } catch (err) {
    console.error('Add division error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/divisions/:id', async (req, res) => {
  const { id } = req.params;
  const d = req.body;
  try {
    const polygonJson = d.polygonCoords !== undefined ? (d.polygonCoords ? (typeof d.polygonCoords === 'string' ? d.polygonCoords : JSON.stringify(d.polygonCoords)) : null) : undefined;
    const query = `
      UPDATE hrm_divisions SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        location_name = COALESCE($4, location_name),
        address = COALESCE($5, address),
        latitude = COALESCE($6, latitude),
        longitude = COALESCE($7, longitude),
        radius_meters = COALESCE($8, radius_meters),
        polygon_coords = COALESCE($9, polygon_coords),
        updated_at = NOW()
      WHERE id::text = $10 OR code = $10
      RETURNING *;
    `;
    const result = await pool.query(query, [
      d.code ? d.code.trim().toUpperCase() : null,
      d.name,
      d.description,
      d.locationName !== undefined ? d.locationName : d.location_name,
      d.address,
      d.latitude !== undefined ? Number(d.latitude) : null,
      d.longitude !== undefined ? Number(d.longitude) : null,
      d.radiusMeters !== undefined ? Number(d.radiusMeters) : (d.radius_meters !== undefined ? Number(d.radius_meters) : null),
      polygonJson !== undefined ? polygonJson : null,
      id,
    ]);
    if (result.rows.length === 0) {
      // If not found by ID or code, try upserting
      const insQuery = `
        INSERT INTO hrm_divisions (
          code, name, description, location_name, address, latitude, longitude, radius_meters, polygon_coords
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const insRes = await pool.query(insQuery, [
        d.code || 'DIV',
        d.name || 'Divisi',
        d.description || '',
        d.locationName || d.location_name || '',
        d.address || '',
        d.latitude !== undefined ? Number(d.latitude) : -6.2088,
        d.longitude !== undefined ? Number(d.longitude) : 106.8456,
        d.radiusMeters || d.radius_meters || 150,
        polygonJson || null,
      ]);
      return res.json({ success: true, data: formatDivisionRow(insRes.rows[0]) });
    }
    res.json({ success: true, data: formatDivisionRow(result.rows[0]) });
  } catch (err) {
    console.error('Update division error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/divisions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hrm_divisions WHERE id::text = $1 OR code = $1', [id]);
    res.json({ success: true, message: 'Divisi berhasil dihapus dari database' });
  } catch (err) {
    console.error('Delete division error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 6. OFFICE LOCATION (GEOFENCE PUSAT) ─────────────────────────────────────────
function formatOfficeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude !== null && row.latitude !== undefined ? parseFloat(row.latitude) : -6.2088,
    longitude: row.longitude !== null && row.longitude !== undefined ? parseFloat(row.longitude) : 106.8456,
    radiusMeters: row.radius_meters || 100,
    isActive: row.is_active,
    bssidWhitelist: row.bssid_whitelist || '',
    wifiSsid: row.wifi_ssid || '',
  };
}

app.get('/api/office', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hrm_office_locations WHERE is_active = true LIMIT 1');
    res.json({ success: true, data: formatOfficeRow(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/office', async (req, res) => {
  const { name, address, latitude, longitude, radiusMeters, bssidWhitelist, wifiSsid } = req.body;
  try {
    const query = `
      UPDATE hrm_office_locations SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        latitude = COALESCE($3, latitude),
        longitude = COALESCE($4, longitude),
        radius_meters = COALESCE($5, radius_meters),
        bssid_whitelist = COALESCE($6, bssid_whitelist),
        wifi_ssid = COALESCE($7, wifi_ssid)
      WHERE is_active = true
      RETURNING *;
    `;
    let result = await pool.query(query, [
      name,
      address,
      latitude !== undefined ? Number(latitude) : null,
      longitude !== undefined ? Number(longitude) : null,
      radiusMeters !== undefined ? Number(radiusMeters) : null,
      bssidWhitelist !== undefined ? bssidWhitelist : null,
      wifiSsid !== undefined ? wifiSsid : null,
    ]);
    if (result.rows.length === 0) {
      const insRes = await pool.query(
        `INSERT INTO hrm_office_locations (name, address, latitude, longitude, radius_meters, is_active, bssid_whitelist, wifi_ssid)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7) RETURNING *;`,
        [name || 'Kantor Pusat', address || '', latitude || -6.2088, longitude || 106.8456, radiusMeters || 100, bssidWhitelist || '', wifiSsid || '']
      );
      result = insRes;
    }
    res.json({ success: true, data: formatOfficeRow(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 7. COMPANY PROFILE ────────────────────────────────────────────────────────
app.put('/api/company', async (req, res) => {
  const c = req.body;
  try {
    const query = `
      UPDATE hrm_company_profile SET
        company_name = COALESCE($1, company_name),
        short_name = COALESCE($2, short_name),
        legal_type = COALESCE($3, legal_type),
        business_sector = COALESCE($4, business_sector),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        province = COALESCE($7, province),
        postal_code = COALESCE($8, postal_code),
        phone = COALESCE($9, phone),
        email = COALESCE($10, email),
        website = COALESCE($11, website),
        director_name = COALESCE($12, director_name),
        hr_manager_name = COALESCE($13, hr_manager_name),
        updated_at = NOW()
      WHERE id = 'company-main' OR id IS NOT NULL
      RETURNING *;
    `;
    const result = await pool.query(query, [
      c.companyName,
      c.shortName,
      c.legalType,
      c.businessSector,
      c.address,
      c.city,
      c.province,
      c.postalCode,
      c.phone,
      c.email,
      c.website,
      c.directorName,
      c.hrManagerName,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 8. LEAVE REQUESTS (PENGAJUAN IZIN & CUTI) ────────────────────────────────
// NOTE: Duplicate route removed — definitive route with quota data is below at /api/leaves.

// ─── LEAVE BALANCE ENDPOINT — Flutter fetches fresh quota per karyawan ─────────
app.get('/api/leaves/balance', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId wajib diisi' });
  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const uRes = await pool.query(
        'SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
    }
    const profileRes = await pool.query(
      'SELECT annual_leave_quota, used_leave_days FROM hrm_profiles WHERE id = $1 LIMIT 1',
      [validUserId]
    );
    if (profileRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    const p = profileRes.rows[0];
    const quota = parseInt(p.annual_leave_quota || 12, 10);
    const used = parseInt(p.used_leave_days || 0, 10);

    // Also fetch approved overtime hours this month for lembur summary
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const otRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
         COALESCE(SUM(duration_hours) FILTER (WHERE status = 'approved'), 0) as approved_hours,
         COALESCE(SUM(compensation_amount) FILTER (WHERE status = 'approved'), 0) as approved_compensation
       FROM hrm_overtime_records
       WHERE user_id = $1
         AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::date)`,
      [validUserId, monthStart]
    );
    const ot = otRes.rows[0];

    res.json({
      success: true,
      data: {
        annualLeaveQuota: quota,
        usedLeaveDays: used,
        remainingLeaveDays: Math.max(0, quota - used),
        // Lembur bulan berjalan (approved)
        overtimeThisMonth: {
          approvedCount: parseInt(ot.approved_count || 0, 10),
          approvedHours: parseFloat(ot.approved_hours || 0),
          approvedCompensation: parseFloat(ot.approved_compensation || 0),
          month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        },
      },
    });
  } catch (err) {
    console.error('[LeaveBalance] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── HELPER: BROADCAST SYSTEM & ROLE NOTIFICATIONS ─────────────────────────
async function broadcastNotification({
  title,
  message,
  type = 'info',
  recipientRoles = [],
  targetUserId = null,
  link = null,
  metadata = {},
  divisionId = null,   // if set, kepala_regu notifications are scoped to this division
}) {
  try {
    // 1. Send to specific user if provided
    if (targetUserId) {
      let validTargetId = targetUserId;
      if (!UUID_REGEX.test(targetUserId)) {
        const uRes = await pool.query(
          'SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1',
          [targetUserId]
        );
        if (uRes.rows.length > 0) validTargetId = uRes.rows[0].id;
      }
      if (UUID_REGEX.test(validTargetId)) {
        await pool.query(
          `INSERT INTO hrm_notifications (user_id, title, message, type, link, metadata, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, false, NOW());`,
          [validTargetId, title, message, type, link, JSON.stringify(metadata)]
        );
      }
    }

    // 2. Broadcast to roles
    if (recipientRoles && recipientRoles.length > 0) {
      for (const role of recipientRoles) {
        const normalizedRole = role.toLowerCase().replace(/\s+/g, '_');

        // Special handling for kepala_regu: if divisionId provided,
        // send to the SPECIFIC kepala_regu(s) responsible for that division
        if ((normalizedRole === 'kepala_regu' || normalizedRole === 'kepalaregu') && divisionId) {
          // Find kepala_regu users who are assigned to employees in this division
          const krRes = await pool.query(`
            SELECT DISTINCT p.id FROM hrm_profiles p
            LEFT JOIN hrm_roles r ON p.role_id = r.id
            WHERE (LOWER(r.name) = 'kepala_regu' OR LOWER(r.name) = 'kepalaregu')
              AND p.is_active = true
              AND (
                p.division_id = $1
                OR EXISTS (
                  SELECT 1 FROM hrm_profiles emp
                  WHERE emp.kepala_regu_id = p.id AND emp.division_id = $1
                )
              )
          `, [divisionId]);

          for (const kr of krRes.rows) {
            await pool.query(
              `INSERT INTO hrm_notifications (user_id, title, message, type, link, metadata, is_read, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, false, NOW());`,
              [kr.id, title, message, type, link, JSON.stringify(metadata)]
            );
          }
          // Also insert a role-wide notification for division context
          await pool.query(
            `INSERT INTO hrm_notifications (recipient_role, division_id, title, message, type, link, metadata, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW());`,
            [normalizedRole, divisionId, title, message, type, link, JSON.stringify(metadata)]
          );
        } else {
          // Standard role broadcast (global — no division filter)
          await pool.query(
            `INSERT INTO hrm_notifications (recipient_role, title, message, type, link, metadata, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, false, NOW());`,
            [normalizedRole, title, message, type, link, JSON.stringify(metadata)]
          );
        }
      }
    }
  } catch (err) {
    console.error('[Notification] Error broadcasting notification:', err.message);
  }
}

// ─── 8. LEAVE REQUESTS (PENGAJUAN IZIN / CUTI / SAKIT) ───────────────────────
app.get('/api/leaves', async (req, res) => {
  const { userId, status, divisionId } = req.query;
  try {
    let query = `
      SELECT l.*, p.full_name as user_name, p.nip as user_nip, d.name as division_name,
             p.annual_leave_quota, p.used_leave_days, p.division_id as user_division_id,
             ap.full_name as approver_name
      FROM hrm_leave_requests l
      JOIN hrm_profiles p ON l.user_id = p.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_profiles ap ON l.approved_by = ap.id
    `;
    const params = [];
    const conditions = [];

    if (userId) {
      params.push(userId);
      conditions.push(`(l.user_id::text = $${params.length} OR LOWER(p.email) = LOWER($${params.length}) OR LOWER(p.nip) = LOWER($${params.length}))`);
    }
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    if (divisionId) {
      params.push(divisionId);
      conditions.push(`p.division_id::text = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY l.created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/leaves', async (req, res) => {
  const { userId, leaveType, startDate, endDate, totalDays, reason, attachmentUrl } = req.body;
  if (!userId || !startDate || !endDate || !reason) {
    return res.status(400).json({ success: false, error: 'Data pengajuan cuti tidak lengkap (userId, tanggal, alasan wajib diisi)' });
  }

  try {
    let validUserId = userId;
    let userProfile = null;
    if (UUID_REGEX.test(userId)) {
      const uRes = await pool.query('SELECT p.*, d.name as division_name FROM hrm_profiles p LEFT JOIN hrm_divisions d ON p.division_id = d.id WHERE p.id = $1 LIMIT 1', [userId]);
      userProfile = uRes.rows[0];
    } else {
      const uRes = await pool.query('SELECT p.*, d.name as division_name FROM hrm_profiles p LEFT JOIN hrm_divisions d ON p.division_id = d.id WHERE LOWER(p.email) = LOWER($1) OR LOWER(p.nip) = LOWER($1) LIMIT 1', [userId]);
      userProfile = uRes.rows[0];
      if (userProfile) validUserId = userProfile.id;
    }

    if (!userProfile) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak terdaftar dalam sistem' });
    }

    const requestedDays = totalDays ? parseInt(totalDays, 10) : 1;
    const type = leaveType || 'cuti_tahunan';

    // ── Aturan Operasional Lapangan 1: Cuti Tahunan wajib H-3 ──
    if (type === 'cuti_tahunan') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDt = new Date(startDate);
      startDt.setHours(0, 0, 0, 0);
      const diffDays = Math.round((startDt - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 3) {
        return res.status(400).json({
          success: false,
          error: 'Sesuai regulasi perusahaan, permohonan Cuti Tahunan wajib diajukan minimal 3 hari sebelum pelaksanaan (H-3). Untuk kondisi mendesak/sakit silakan pilih jenis Izin atau Sakit.',
        });
      }

      // ── Aturan Operasional Lapangan 2: Sisa Hak Cuti Wajib Mencukupi (12 + 2 = 14 Hari) ──
      const annualQuota = userProfile.annual_leave_quota || 14;
      const usedDays = userProfile.used_leave_days || 0;
      const remainingQuota = annualQuota - usedDays;
      if (requestedDays > remainingQuota) {
        return res.status(400).json({
          success: false,
          error: `Sisa hak cuti tahunan Anda tidak mencukupi. Kuota tersisa: ${remainingQuota} hari (dari total hak 14 hari), namun Anda mengajukan ${requestedDays} hari.`,
        });
      }
    }

    // ── Aturan Operasional Lapangan 3: Semua Pengajuan Wajib Dokumen Pendukung ──
    if (!attachmentUrl || !attachmentUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Semua permohonan izin/cuti/sakit wajib melampirkan foto atau dokumen pendukung (surat dokter, surat tugas, atau berkas bukti) untuk ditinjau oleh Kepala Regu dan Korlap.',
      });
    }

    const query = `
      INSERT INTO hrm_leave_requests (
        user_id, leave_type, start_date, end_date, total_days, reason, attachment_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [
      validUserId,
      type,
      startDate,
      endDate,
      requestedDays,
      reason,
      attachmentUrl || null,
    ]);

    const leaveRow = result.rows[0];
    const typeLabel = type.replace(/_/g, ' ').toUpperCase();

    const submitterRole = (userProfile.role_name || userProfile.role_code || '').toLowerCase();
    let recipientRoles = ['pimpinan', 'superadmin', 'hrd', 'pengawas', 'admin', 'korlap', 'kepala_regu', 'keuangan'];
    if (submitterRole === 'kepala_regu' || submitterRole === 'kepalaregu') {
      recipientRoles = ['korlap', 'pimpinan', 'superadmin', 'hrd', 'admin', 'keuangan'];
    } else if (submitterRole === 'korlap') {
      recipientRoles = ['pimpinan', 'superadmin', 'hrd', 'admin', 'keuangan'];
    }

    // Broadcast Notifikasi ke semua pihak relevan — division-scoped untuk kepala_regu
    await broadcastNotification({
      recipientRoles,
      title: `📋 Pengajuan ${typeLabel} Baru`,
      message: `${userProfile.full_name} (${userProfile.division_name || 'Operasional'}) mengajukan ${typeLabel} ${requestedDays} hari (${startDate} s/d ${endDate}): "${reason}". Membutuhkan persetujuan segera.`,
      type: 'leave',
      link: '/admin/approval',
      metadata: { leaveId: leaveRow.id, userId: validUserId, type, totalDays: requestedDays },
      divisionId: userProfile.division_id || null,
    });

    res.json({
      success: true,
      data: leaveRow,
      message: 'Pengajuan cuti berhasil dikirim dan menunggu verifikasi atasan.',
    });
  } catch (err) {
    console.error('Leave submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Status Cuti (Approval / Rejection oleh Superadmin, HRD, Pimpinan)
app.put('/api/leaves/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, approverId, approverName, notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status tidak valid (hanya approved / rejected)' });
  }

  try {
    const lRes = await pool.query('SELECT * FROM hrm_leave_requests WHERE id = $1 LIMIT 1', [id]);
    if (lRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengajuan cuti tidak ditemukan' });
    }
    const leave = lRes.rows[0];

    let validApproverId = approverId;
    if (approverId && !UUID_REGEX.test(approverId)) {
      const aRes = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [approverId]);
      if (aRes.rows.length > 0) validApproverId = aRes.rows[0].id;
    }

    const updateRes = await pool.query(`
      UPDATE hrm_leave_requests SET
        status = $1,
        approved_by = $2,
        approval_notes = $3,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `, [status, validApproverId || null, notes || null, id]);

    // Jika disetujui dan cuti tahunan, otomatis kurangi sisa cuti di profil karyawan!
    if (status === 'approved' && leave.leave_type === 'cuti_tahunan') {
      await pool.query(`
        UPDATE hrm_profiles SET
          used_leave_days = COALESCE(used_leave_days, 0) + $1,
          updated_at = NOW()
        WHERE id = $2;
      `, [leave.total_days, leave.user_id]);
    }

    // Teruskan notifikasi langsung ke karyawan
    const statusText = status === 'approved' ? 'DISETUJUI' : 'DITOLAK';
    await broadcastNotification({
      targetUserId: leave.user_id,
      title: `Pengajuan Izin/Cuti ${statusText}`,
      message: `Permohonan cuti Anda untuk tanggal ${leave.start_date} s/d ${leave.end_date} (${leave.total_days} hari) telah ${statusText} oleh ${approverName || 'Atasan/HRD'}.${notes ? ' Catatan: ' + notes : ''}`,
      type: status === 'approved' ? 'success' : 'warning',
      metadata: { leaveId: id, status, approverName },
    });

    res.json({
      success: true,
      data: updateRes.rows[0],
      message: `Pengajuan cuti berhasil di-${status}`,
    });
  } catch (err) {
    console.error('Update leave error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 9. OVERTIME REQUESTS (SURAT PERINTAH LEMBUR) ─────────────────────────────
app.get('/api/overtime', async (req, res) => {
  const { userId, status, divisionId } = req.query;
  try {
    let query = `
      SELECT o.*, p.full_name as user_name, p.nip as user_nip, d.name as division_name,
             p.division_id as user_division_id,
             ap.full_name as approver_name
      FROM hrm_overtime_records o
      JOIN hrm_profiles p ON o.user_id = p.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_profiles ap ON o.approved_by = ap.id
    `;
    const params = [];
    const conditions = [];

    if (userId) {
      params.push(userId);
      conditions.push(`(o.user_id::text = $${params.length} OR LOWER(p.email) = LOWER($${params.length}) OR LOWER(p.nip) = LOWER($${params.length}))`);
    }
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (divisionId) {
      params.push(divisionId);
      conditions.push(`p.division_id::text = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY o.created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/overtime', async (req, res) => {
  const { userId, date, startTime, endTime, durationHours, taskDescription, compensationAmount } = req.body;
  if (!userId || !date || !startTime || !endTime) {
    return res.status(400).json({ success: false, error: 'Data pengajuan lembur tidak lengkap (userId, tanggal, jam mulai & selesai wajib diisi)' });
  }

  // Uraian tugas wajib diisi
  if (!taskDescription || !taskDescription.trim()) {
    return res.status(400).json({ success: false, error: 'Uraian tugas/pekerjaan lembur wajib diisi sebelum mengajukan SPL.' });
  }

  try {
    let validUserId = userId;
    let userProfile = null;
    if (UUID_REGEX.test(userId)) {
      const uRes = await pool.query(`
        SELECT p.*, d.name as division_name, COALESCE(sp.hourly_overtime_rate, 23381.79) as hourly_overtime_rate
        FROM hrm_profiles p
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
        WHERE p.id = $1 LIMIT 1`, [userId]);
      userProfile = uRes.rows[0];
    } else {
      const uRes = await pool.query(`
        SELECT p.*, d.name as division_name, COALESCE(sp.hourly_overtime_rate, 23381.79) as hourly_overtime_rate
        FROM hrm_profiles p
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
        WHERE LOWER(p.email) = LOWER($1) OR LOWER(p.nip) = LOWER($1) LIMIT 1`, [userId]);
      userProfile = uRes.rows[0];
      if (userProfile) validUserId = userProfile.id;
    }

    if (!userProfile) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan dalam sistem' });
    }

    // ── KUNCI: Tarif Lembur Resmi Per-Karyawan dari Database (bukan dari request body) ──
    // Setiap karyawan memiliki tarif lembur yang berbeda sesuai haknya:
    // Rp 23.381,79/jam atau Rp 24.173,06/jam (atau tarif lainnya per data master)
    const officialRate = parseFloat(userProfile.hourly_overtime_rate) || 23381.79;

    const hours = durationHours !== undefined ? parseFloat(durationHours) : 2.0;
    // Gunakan officialRate dari database, bukan dari request body
    const comp = Math.round(hours * officialRate);

    const query = `
      INSERT INTO hrm_overtime_records (
        user_id, date, start_time, end_time, duration_hours, task_description, rate_applied, compensation_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *;
    `;
    const result = await pool.query(query, [
      validUserId,
      date,
      startTime,
      endTime,
      hours,
      taskDescription.trim(),
      officialRate,   // ← tarif resmi per karyawan dari hrm_payroll_salary_profiles
      comp,
    ]);

    const otRow = result.rows[0];

    const submitterRole = (userProfile.role_name || userProfile.role_code || '').toLowerCase();
    let recipientRoles = ['pimpinan', 'superadmin', 'hrd', 'pengawas', 'admin', 'korlap', 'kepala_regu', 'keuangan'];
    if (submitterRole === 'kepala_regu' || submitterRole === 'kepalaregu') {
      recipientRoles = ['korlap', 'pimpinan', 'superadmin', 'hrd', 'admin', 'keuangan'];
    } else if (submitterRole === 'korlap') {
      recipientRoles = ['pimpinan', 'superadmin', 'hrd', 'admin', 'keuangan'];
    }

    // Broadcast Notifikasi ke Pimpinan, Superadmin, HRD, Korlap, Kepala Regu, Keuangan
    await broadcastNotification({
      recipientRoles,
      title: '⏱️ Pengajuan Surat Perintah Lembur (SPL)',
      message: `${userProfile.full_name} (${userProfile.division_name || 'Operasional'}) mengajukan lembur pada ${date} (${startTime} - ${endTime}, ${hours} Jam): "${taskDescription || 'Operasional'}". Estimasi kompensasi: Rp ${comp.toLocaleString('id-ID')}. Perlu verifikasi segera.`,
      type: 'overtime',
      link: '/admin/approval',
      metadata: { overtimeId: otRow.id, userId: validUserId, date, hours, compensation: comp },
      divisionId: userProfile.division_id || null,
    });

    res.json({
      success: true,
      data: otRow,
      message: 'Surat Perintah Lembur berhasil diajukan dan diteruskan ke supervisor/HRD.',
    });
  } catch (err) {
    console.error('Overtime error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Status Lembur (Approval / Rejection oleh Atasan / HRD)
app.put('/api/overtime/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, approvedHours, approverId, approverName, notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status tidak valid (hanya approved / rejected)' });
  }

  try {
    const oRes = await pool.query('SELECT * FROM hrm_overtime_records WHERE id = $1 LIMIT 1', [id]);
    if (oRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pengajuan lembur tidak ditemukan' });
    }
    const ot = oRes.rows[0];

    let validApproverId = approverId;
    if (approverId && !UUID_REGEX.test(approverId)) {
      const aRes = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [approverId]);
      if (aRes.rows.length > 0) validApproverId = aRes.rows[0].id;
    }

    const finalHours = approvedHours !== undefined ? Number(approvedHours) : Number(ot.duration_hours);
    const compensation = Math.round(finalHours * Number(ot.rate_applied || 30000));

    const updateRes = await pool.query(`
      UPDATE hrm_overtime_records SET
        status = $1,
        duration_hours = $2,
        compensation_amount = $3,
        approved_by = $4,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *;
    `, [status, finalHours, compensation, validApproverId || null, id]);

    // Send notification to employee
    const statusText = status === 'approved' ? 'DISETUJUI' : 'DITOLAK';
    await broadcastNotification({
      targetUserId: ot.user_id,
      title: `Surat Perintah Lembur (SPL) ${statusText}`,
      message: `Permohonan lembur Anda pada tanggal ${ot.date} (${finalHours} Jam kerja) telah ${statusText} oleh ${approverName || 'Atasan/HRD'}. Kompensasi resmi: Rp ${compensation.toLocaleString('id-ID')}.${notes ? ' Catatan: ' + notes : ''}`,
      type: status === 'approved' ? 'success' : 'warning',
      metadata: { overtimeId: id, status, compensation, approverName },
    });

    res.json({
      success: true,
      data: updateRes.rows[0],
      message: `Pengajuan lembur berhasil di-${status}`,
    });
  } catch (err) {
    console.error('Update overtime error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 10. SMART SUBSTITUTE ENGINE & DANRU-KORLAP WORKFLOW ────────────────────

// Helper: Smart Substitute Candidate Recommendation Algorithm
async function generateSmartSubstituteRecommendations(requesterId, swapDate, originalShift) {
  try {
    const reqRes = await pool.query(`
      SELECT p.id, p.full_name, p.nip, p.division_id, d.name as division_name, p.shift_id,
             p.placement_location, p.job_title
      FROM hrm_profiles p
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      WHERE p.id = $1
    `, [requesterId]);

    if (reqRes.rows.length === 0) return [];
    const requester = reqRes.rows[0];

    const employeesRes = await pool.query(`
      SELECT p.id, p.full_name, p.nip, p.avatar_url, p.division_id, 
             p.placement_location, p.job_title,
             COALESCE(d.name, 'Operasional') as division_name,
             s.name as regular_shift_name,
             r.name as role_code, r.label as role_label,
             COALESCE(sp.hourly_overtime_rate, 23381.79) as hourly_overtime_rate,
             -- Dynamic Real-time Leave Metrics
             COALESCE((SELECT SUM(l.total_days) FROM hrm_leave_requests l 
                       WHERE l.user_id = p.id AND l.leave_type = 'cuti_tahunan' AND l.status = 'approved'), 0) as cuti_days,
             COALESCE((SELECT COUNT(*) FROM hrm_leave_requests l 
                       WHERE l.user_id = p.id AND l.leave_type = 'izin' AND l.status = 'approved'), 0) as izin_count,
             COALESCE((SELECT COUNT(*) FROM hrm_leave_requests l 
                       WHERE l.user_id = p.id AND l.leave_type = 'sakit' AND l.status = 'approved'), 0) as sakit_count,
             -- Dynamic Real-time Overtime Metrics
             COALESCE((SELECT SUM(o.duration_hours) FROM hrm_overtime_records o 
                       WHERE o.user_id = p.id AND o.status = 'approved'), 0) as ot_hours_total,
             COALESCE((SELECT SUM(o.duration_hours) FROM hrm_overtime_records o 
                       WHERE o.user_id = p.id AND o.status = 'approved' 
                       AND DATE_TRUNC('month', o.date) = DATE_TRUNC('month', $2::date)), 0) as ot_hours_month,
             COALESCE((SELECT COUNT(*) FROM hrm_overtime_records o 
                       WHERE o.user_id = p.id AND o.status = 'approved'), 0) as ot_count,
             -- Dynamic Real-time Shift Relief / Swap Metrics
             COALESCE((SELECT COUNT(*) FROM hrm_shift_swaps sw 
                       WHERE sw.substitute_id = p.id AND sw.status = 'approved'), 0)
               + COALESCE((SELECT COUNT(*) FROM hrm_shift_substitutions sub 
                           WHERE sub.relief_user_id = p.id AND sub.status = 'approved'), 0) as swap_substitute_count,
             COALESCE((SELECT COUNT(*) FROM hrm_shift_swaps sw 
                       WHERE sw.requester_id = p.id AND sw.status = 'approved'), 0) as swap_requester_count,
             -- Availability on Target Date
             (SELECT COUNT(*) FROM hrm_attendances a
              WHERE a.user_id = p.id AND a.attendance_date = $2::date) as date_attendance_count,
             (SELECT COUNT(*) FROM hrm_shift_swaps sw
              WHERE sw.substitute_id = p.id AND sw.swap_date = $2::date AND sw.status = 'approved') as date_swap_count,
             -- Leave Quota Info
             COALESCE(p.annual_leave_quota, 14) as annual_leave_quota,
             COALESCE(p.used_leave_days, 0) as used_leave_days
      FROM hrm_profiles p
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id != $1 AND p.is_active = true
      ORDER BY (p.placement_location = $4) DESC, (p.division_id = $3) DESC, p.full_name ASC
    `, [requesterId, swapDate, requester.division_id, requester.placement_location || '']);

    const candidates = employeesRes.rows.map((emp) => {
      let score = 50;
      const reasons = [];

      // 1. Lokasi Penempatan (Sangat Krusial untuk Pos Timbangan / Segel / Wisma)
      const isSameLocation = emp.placement_location && requester.placement_location && 
        emp.placement_location.toLowerCase() === requester.placement_location.toLowerCase();
      if (isSameLocation) {
        score += 25;
        reasons.push(`Pos sama: ${emp.placement_location}`);
      } else if (emp.placement_location) {
        score += 5;
        reasons.push(`Pos: ${emp.placement_location}`);
      }

      // 2. Divisi / Departemen
      const isSameDivision = emp.division_id && requester.division_id && emp.division_id === requester.division_id;
      if (isSameDivision) {
        score += 20;
        reasons.push(`Departemen sama (${emp.division_name})`);
      } else {
        score += 5;
        reasons.push(`Lintas dept (${emp.division_name})`);
      }

      // 3. Status Kehadiran / Jadwal pada Hari H
      const hasAttendanceOnDate = parseInt(emp.date_attendance_count || 0) > 0;
      const hasSwapOnDate = parseInt(emp.date_swap_count || 0) > 0;

      if (!hasAttendanceOnDate && !hasSwapOnDate) {
        score += 25;
        reasons.push('Hari Libur / Tidak Bertugas di tanggal ini (Bisa Masuk)');
      } else {
        score -= 30;
        reasons.push('Terjadwal pada tanggal ini (Potensi jadwal ganda)');
      }

      // 4. Keadilan Alokasi Lembur (Fairness Index & PP 35/2021)
      const otMonth = parseFloat(emp.ot_hours_month || 0);
      let fairnessBadge = 'Pemerataan Lembur Terjaga';
      let restIntervalStatus = 'SAFE';

      if (otMonth === 0) {
        score += 15;
        fairnessBadge = 'Prioritas Utama (0 Jam Lembur)';
        reasons.push('Lembur bulan ini masih 0 jam (Pemerataan Prioritas)');
      } else if (otMonth <= 8) {
        score += 10;
        fairnessBadge = 'Beban Wajar';
        reasons.push(`Lembur bulan ini: ${otMonth} jam`);
      } else if (otMonth <= 14) {
        score -= 5;
        fairnessBadge = 'Beban Sedang';
        reasons.push(`Lembur bulan ini: ${otMonth} jam`);
      } else {
        score -= 20;
        fairnessBadge = 'Beban Tinggi / Mendekati Batas PP 35';
        restIntervalStatus = 'WARNING';
        reasons.push(`Lembur tinggi (${otMonth} jam bulan ini)`);
      }

      score = Math.max(15, Math.min(99, score));

      let badge = 'Alternatif Cadangan';
      let badgeColor = '#64748B';
      if (score >= 85) {
        badge = 'Sangat Direkomendasikan';
        badgeColor = '#059669';
      } else if (score >= 70) {
        badge = 'Memenuhi Syarat';
        badgeColor = '#2563EB';
      }

      const metrics = {
        cuti_days: Number(emp.cuti_days || 0),
        izin_count: Number(emp.izin_count || 0),
        sakit_count: Number(emp.sakit_count || 0),
        ot_hours_total: Number(emp.ot_hours_total || 0),
        ot_hours_month: Number(emp.ot_hours_month || 0),
        ot_count: Number(emp.ot_count || 0),
        swap_substitute_count: Number(emp.swap_substitute_count || 0),
        swap_requester_count: Number(emp.swap_requester_count || 0),
        annual_leave_quota: Number(emp.annual_leave_quota || 14),
        used_leave_days: Number(emp.used_leave_days || 0),
        remaining_leave_days: Number(emp.annual_leave_quota || 14) - Number(emp.used_leave_days || 0),
      };

      return {
        id: emp.id,
        name: emp.full_name,
        nip: emp.nip,
        division: emp.division_name,
        division_name: emp.division_name,
        placement_location: emp.placement_location || '-',
        job_title: emp.job_title || 'Operasional',
        hourly_overtime_rate: Number(emp.hourly_overtime_rate || 23381.79),
        avatarUrl: emp.avatar_url,
        regularShift: emp.regular_shift_name || 'Reguler',
        score,
        badge,
        badgeColor,
        badge_color: badgeColor,
        isSameDivision,
        isSameLocation,
        isAvailable: !hasAttendanceOnDate && !hasSwapOnDate,
        reasons: reasons,
        reasonSummary: reasons.join(' • '),
        metrics: metrics,
        fairness_badge: fairnessBadge,
        rest_interval_status: restIntervalStatus,
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 10);
  } catch (err) {
    console.error('Smart recommendation error:', err);
    return [];
  }
}

// 1. Get Smart Candidates Preview
app.get('/api/shift-swaps/smart-candidates', async (req, res) => {
  const { requesterId, swapDate, originalShift } = req.query;
  if (!requesterId || !swapDate) {
    return res.status(400).json({ success: false, error: 'requesterId dan swapDate wajib diisi' });
  }

  try {
    let validReqId = requesterId;
    if (!UUID_REGEX.test(requesterId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [requesterId]);
      if (u.rows.length > 0) validReqId = u.rows[0].id;
    }

    const candidates = await generateSmartSubstituteRecommendations(validReqId, swapDate, originalShift || 'Reguler');
    res.json({ success: true, data: candidates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Shift Swaps List
app.get(['/api/shift-swaps', '/api/shift-swaps/all'], async (req, res) => {
  const { userId, role, status, divisionId } = req.query;
  try {
    let query = `
      SELECT s.*, 
             rp.full_name as requester_name, rp.nip as requester_nip, rd.name as requester_division, rp.avatar_url as requester_avatar,
             sp.full_name as substitute_name, sp.nip as substitute_nip, sd.name as substitute_division, sp.avatar_url as substitute_avatar,
             dp.full_name as danru_name,
             dsp.full_name as danru_recommended_name,
             kp.full_name as korlap_name,
             ap.full_name as approver_name
      FROM hrm_shift_swaps s
      LEFT JOIN hrm_profiles rp ON s.requester_id = rp.id
      LEFT JOIN hrm_divisions rd ON rp.division_id = rd.id
      LEFT JOIN hrm_profiles sp ON s.substitute_id = sp.id
      LEFT JOIN hrm_divisions sd ON sp.division_id = sd.id
      LEFT JOIN hrm_profiles dp ON s.danru_id = dp.id
      LEFT JOIN hrm_profiles dsp ON s.danru_substitute_id = dsp.id
      LEFT JOIN hrm_profiles kp ON s.korlap_id = kp.id
      LEFT JOIN hrm_profiles ap ON s.approved_by = ap.id
    `;
    const conditions = [];
    const params = [];

    if (userId && !['superadmin', 'admin', 'hrd', 'pimpinan', 'korlap', 'kepala_regu', 'pengawas', 'keuangan'].includes((role || '').toLowerCase())) {
      params.push(userId);
      conditions.push(`(s.requester_id::text = $${params.length} OR s.substitute_id::text = $${params.length} 
                 OR LOWER(rp.email) = LOWER($${params.length}) OR LOWER(sp.email) = LOWER($${params.length})
                 OR LOWER(rp.nip) = LOWER($${params.length}) OR LOWER(sp.nip) = LOWER($${params.length}))`);
    }

    if (status) {
      if (status === 'pending') {
        conditions.push(`s.status IN ('pending', 'pending_danru', 'pending_korlap')`);
      } else {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
      }
    }

    if (divisionId) {
      params.push(divisionId);
      conditions.push(`(rp.division_id::text = $${params.length} OR rd.id::text = $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY s.created_at DESC LIMIT 150';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create Shift Swap Request (Karyawan tidak memilih pengganti sendiri)
app.post('/api/shift-swaps', async (req, res) => {
  const { requesterId, swapDate, originalShift, targetShift, reason } = req.body;
  if (!requesterId || !swapDate) {
    return res.status(400).json({ success: false, error: 'Data pengajuan tukar shift tidak lengkap' });
  }

  try {
    let validReqId = requesterId;
    if (!UUID_REGEX.test(requesterId)) {
      const u1 = await pool.query('SELECT id, full_name, division_id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [requesterId]);
      if (u1.rows.length > 0) validReqId = u1.rows[0].id;
    }

    const reqProfileRes = await pool.query(`
      SELECT p.id, p.full_name, p.nip, p.division_id, d.name as division_name, r.name as role_name
      FROM hrm_profiles p
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      WHERE p.id = $1
    `, [validReqId]);
    const reqProfile = reqProfileRes.rows[0];
    const requesterRole = (reqProfile?.role_name || '').toLowerCase();

    // Tentukan status awal & alur approval berdasarkan role pemohon:
    // - Kepala Regu mengajukan -> langsung ke Korlap (status: pending_korlap)
    // - Korlap mengajukan -> langsung ke Pimpinan/Admin/Keuangan (status: pending)
    // - Karyawan mengajukan -> ke Kepala Regu (checker) lalu Korlap (status: pending_danru)
    let initialStatus = 'pending_danru';
    let danruStatus = 'pending';
    let korlapStatus = 'pending';

    if (requesterRole === 'kepala_regu' || requesterRole === 'kepalaregu') {
      initialStatus = 'pending_korlap';
      danruStatus = 'auto_passed';
    } else if (requesterRole === 'korlap') {
      initialStatus = 'pending';
      danruStatus = 'auto_passed';
      korlapStatus = 'auto_passed';
    }

    // Sistem Pintar: generate rekomendasi kandidat secara otomatis
    const smartCandidates = await generateSmartSubstituteRecommendations(
      validReqId,
      swapDate,
      originalShift || 'Reguler'
    );

    const ins = await pool.query(`
      INSERT INTO hrm_shift_swaps (
        requester_id, substitute_id, swap_date, original_shift, target_shift, reason, 
        peer_status, supervisor_status, status, danru_status, korlap_status, system_recommendations
      ) VALUES ($1, NULL, $2, $3, $4, $5, 'pending', 'pending', $6, $7, $8, $9)
      RETURNING *;
    `, [
      validReqId,
      swapDate,
      originalShift || 'Reguler',
      targetShift || 'Shift Pengganti',
      reason || 'Permohonan pengisian kekosongan pos dinas',
      initialStatus,
      danruStatus,
      korlapStatus,
      JSON.stringify(smartCandidates),
    ]);

    const swapRow = ins.rows[0];

    // Broadcast Notifikasi Terstruktur Berdasarkan Hirarki Pengajuan
    if (requesterRole === 'kepala_regu' || requesterRole === 'kepalaregu') {
      // Kepala Regu mengajukan -> Diteruskan langsung ke Korlap & manajemen
      await broadcastNotification({
        recipientRoles: ['korlap', 'pimpinan', 'keuangan', 'superadmin', 'admin'],
        title: '🔁 Pengajuan Tukar Shift dari Kepala Regu',
        message: `Kepala Regu ${reqProfile?.full_name} (${reqProfile?.division_name || 'Operasional'}) mengajukan permohonan dinas pada ${swapDate}. Diteruskan langsung ke Korlap untuk penetapan personil.`,
        type: 'swap',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: swapRow.id, requesterId: validReqId, stage: 'korlap_review', swapDate },
      });
    } else if (requesterRole === 'korlap') {
      // Korlap mengajukan -> Diteruskan langsung ke Pimpinan, Keuangan, Admin
      await broadcastNotification({
        recipientRoles: ['pimpinan', 'keuangan', 'superadmin', 'admin'],
        title: '🔁 Pengajuan Tukar Shift dari Korlap',
        message: `Korlap ${reqProfile?.full_name} mengajukan permohonan dinas pada ${swapDate}. Menunggu keputusan Pimpinan, Admin & Keuangan.`,
        type: 'swap',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: swapRow.id, requesterId: validReqId, stage: 'pimpinan_review', swapDate },
      });
    } else {
      // Karyawan mengajukan:
      // 1. Notifikasi ke Kepala Regu (Danru) - ter-scope per divisi karyawan
      await broadcastNotification({
        recipientRoles: ['kepala_regu'],
        title: '🔁 Permohonan Tukar Shift Menunggu Telaah Danru',
        message: `${reqProfile?.full_name || 'Karyawan'} (${reqProfile?.division_name || 'Operasional'}) mengajukan tukar dinas pada ${swapDate}. Membutuhkan telaah awal Danru.`,
        type: 'swap',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: swapRow.id, requesterId: validReqId, stage: 'danru_review', swapDate },
        divisionId: reqProfile?.division_id || null,
      });

      // 2. Notifikasi ke Korlap, Pimpinan, Keuangan, Admin, Superadmin
      await broadcastNotification({
        recipientRoles: ['korlap', 'pimpinan', 'keuangan', 'superadmin', 'admin'],
        title: '🔁 Pengajuan Tukar Shift Masuk Antrean Danru',
        message: `${reqProfile?.full_name} (${reqProfile?.division_name || 'Operasional'}) mengajukan tukar dinas pada ${swapDate}. Menunggu telaah Danru -> penetapan Korlap.`,
        type: 'swap',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: swapRow.id, requesterId: validReqId, swapDate },
      });
    }

    // Notifikasi konfirmasi ke Pemohon
    await broadcastNotification({
      targetUserId: validReqId,
      title: 'Pengajuan Pengganti Pos Terkirim',
      message: `Permohonan dinas Anda untuk tanggal ${swapDate} berhasil dikirim ke Kepala Regu untuk dicarikan personil pengganti yang sesuai rekomendasi sistem pintar.`,
      type: 'success',
      link: '/pengajuan?tab=tukar',
      metadata: { swapId: swapRow.id },
    });

    res.json({
      success: true,
      data: { ...swapRow, system_recommendations: smartCandidates },
      message: 'Permohonan berhasil dikirim ke Kepala Regu & Korlap dengan rekomendasi personil otomatis.',
    });
  } catch (err) {
    console.error('Shift swap submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Rekomendasi Kepala Regu (Danru)
app.put(['/api/shift-swaps/:id/danru-recommend', '/api/shift-swaps/:id/danru-approve'], async (req, res) => {
  const { id } = req.params;
  const { danruId, danruName, recommendedSubstituteId, danruNotes, notes, action = 'recommended' } = req.body;
  const finalDanruNotes = danruNotes || notes || null;

  try {
    const sRes = await pool.query('SELECT * FROM hrm_shift_swaps WHERE id = $1 LIMIT 1', [id]);
    if (sRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Permohonan tukar shift tidak ditemukan' });
    }
    const swap = sRes.rows[0];

    let validDanruId = danruId;
    if (danruId && !UUID_REGEX.test(danruId)) {
      const d = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [danruId]);
      if (d.rows.length > 0) validDanruId = d.rows[0].id;
    }

    let validSubId = recommendedSubstituteId;
    if (recommendedSubstituteId && !UUID_REGEX.test(recommendedSubstituteId)) {
      const s = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) OR LOWER(full_name) LIKE LOWER($2) LIMIT 1', [recommendedSubstituteId, `%${recommendedSubstituteId}%`]);
      if (s.rows.length > 0) validSubId = s.rows[0].id;
    }

    const nextStatus = action === 'rejected' ? 'rejected_danru' : 'pending_korlap';

    const up = await pool.query(`
      UPDATE hrm_shift_swaps SET
        danru_id = $1,
        danru_substitute_id = $2,
        danru_notes = $3,
        danru_status = $4,
        danru_at = NOW(),
        status = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *;
    `, [validDanruId || null, validSubId || null, finalDanruNotes, action, nextStatus, id]);

    const reqProfile = (await pool.query('SELECT full_name FROM hrm_profiles WHERE id = $1', [swap.requester_id])).rows[0];
    const recProfile = validSubId ? (await pool.query('SELECT full_name FROM hrm_profiles WHERE id = $1', [validSubId])).rows[0] : null;

    if (action === 'recommended') {
      // Notifikasi ke Korlap untuk penetapan resmi
      await broadcastNotification({
        recipientRoles: ['korlap'],
        title: 'Rekomendasi Danru Masuk - Butuh Penetapan Korlap',
        message: `Danru (${danruName || 'Kepala Regu'}) merekomendasikan personil ${recProfile?.full_name || 'kandidat pilihan'} untuk pengajuan ${reqProfile?.full_name} (${swap.swap_date}). Mohon penetapan resmi Anda.`,
        type: 'info',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id, recommendedSubstituteId: validSubId, stage: 'korlap_decision' },
      });

      // Notifikasi update ke Pemohon
      await broadcastNotification({
        targetUserId: swap.requester_id,
        title: 'Rekomendasi Danru Selesai',
        message: `Kepala Regu telah menelaah pengajuan Anda dan merekomendasikan personil: ${recProfile?.full_name || '-'}. Berkas kini diteruskan ke Korlap untuk penetapan akhir.`,
        type: 'info',
        link: '/pengajuan?tab=tukar',
        metadata: { swapId: id },
      });

      // Notifikasi status update ke Admin, Keuangan, Pimpinan
      await broadcastNotification({
        recipientRoles: ['admin', 'keuangan', 'pimpinan', 'superadmin'],
        title: 'Update Alur Dinas: Menunggu Penetapan Korlap',
        message: `Danru merekomendasikan ${recProfile?.full_name || 'pengganti'} untuk pos dinas ${reqProfile?.full_name} pada ${swap.swap_date}. Menunggu persetujuan Korlap.`,
        type: 'info',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id },
      });
    } else {
      // Ditolak oleh Danru
      await broadcastNotification({
        targetUserId: swap.requester_id,
        title: 'Pengajuan Ditolak oleh Danru',
        message: `Permohonan dinas Anda untuk tanggal ${swap.swap_date} tidak dapat direkomendasikan oleh Kepala Regu.${danruNotes ? ' Catatan: ' + danruNotes : ''}`,
        type: 'warning',
        link: '/pengajuan?tab=tukar',
        metadata: { swapId: id },
      });
    }

    res.json({
      success: true,
      data: up.rows[0],
      message: action === 'recommended'
        ? 'Rekomendasi personil berhasil diteruskan ke Korlap untuk penetapan akhir.'
        : 'Permohonan dinas ditolak oleh Danru.',
    });
  } catch (err) {
    console.error('Danru recommend error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Penetapan & Persetujuan Koordinator Lapangan (Korlap - Satu-Satunya yang Berhak Setujui)
app.put(['/api/shift-swaps/:id/approval', '/api/shift-swaps/:id/korlap-approve'], async (req, res) => {
  const { id } = req.params;
  const status = req.body.status || req.body.action; // 'approved' | 'rejected'
  const approverId = req.body.approverId || req.body.korlapId;
  const approverName = req.body.approverName || req.body.korlapName;
  const assignedSubstituteId = req.body.assignedSubstituteId || req.body.substituteId;
  const notes = req.body.notes || req.body.korlapNotes;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status penetapan tidak valid (hanya approved / rejected)' });
  }

  try {
    const sRes = await pool.query('SELECT * FROM hrm_shift_swaps WHERE id = $1 LIMIT 1', [id]);
    if (sRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Permohonan tukar shift tidak ditemukan' });
    }
    const swap = sRes.rows[0];

    let validApproverId = approverId;
    if (approverId && !UUID_REGEX.test(approverId)) {
      const a = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [approverId]);
      if (a.rows.length > 0) validApproverId = a.rows[0].id;
    }

    // Resolve final substitute ID
    let finalSubId = assignedSubstituteId || swap.danru_substitute_id || swap.substitute_id;
    if (finalSubId && !UUID_REGEX.test(finalSubId)) {
      const s = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) OR LOWER(full_name) LIKE LOWER($2) LIMIT 1', [finalSubId, `%${finalSubId}%`]);
      if (s.rows.length > 0) finalSubId = s.rows[0].id;
    }

    // Auto-resolve substitute from system_recommendations if approving
    if (status === 'approved' && !finalSubId) {
      if (swap.system_recommendations) {
        try {
          const recs = Array.isArray(swap.system_recommendations)
            ? swap.system_recommendations
            : JSON.parse(swap.system_recommendations || '[]');
          if (recs.length > 0 && recs[0].id) {
            finalSubId = recs[0].id;
          }
        } catch (_) {}
      }
      if (!finalSubId && swap.requester_id) {
        const fallbackSub = await pool.query(`
          SELECT id FROM hrm_profiles
          WHERE division_id = (SELECT division_id FROM hrm_profiles WHERE id = $1)
            AND id != $1 AND is_active = true
          LIMIT 1
        `, [swap.requester_id]);
        if (fallbackSub.rows.length > 0) finalSubId = fallbackSub.rows[0].id;
      }
    }

    const up = await pool.query(`
      UPDATE hrm_shift_swaps SET
        substitute_id = $1,
        korlap_id = $2,
        korlap_status = $3,
        korlap_notes = $4,
        korlap_at = NOW(),
        status = $5,
        supervisor_status = $5,
        peer_status = 'accepted',
        approved_by = $2,
        approval_notes = $4,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *;
    `, [finalSubId || null, validApproverId || null, status, notes || null, status, id]);

    const reqProfile = (await pool.query('SELECT full_name FROM hrm_profiles WHERE id = $1', [swap.requester_id])).rows[0];
    const subProfile = finalSubId ? (await pool.query('SELECT full_name FROM hrm_profiles WHERE id = $1', [finalSubId])).rows[0] : null;

    if (status === 'approved') {
      // 1. Notifikasi Karyawan Pemohon (Beserta info pengganti resmi)
      await broadcastNotification({
        targetUserId: swap.requester_id,
        title: 'Pengajuan Pengganti Dinas DISETUJUI Korlap',
        message: `Permohonan dinas Anda untuk tanggal ${swap.swap_date} (${swap.original_shift}) telah DISETUJUI oleh Korlap. Pos dinas Anda resmi diisi oleh personil pengganti: ${subProfile?.full_name || 'Rekan Pengganti'}.${notes ? ' Catatan: ' + notes : ''}`,
        type: 'success',
        link: '/pengajuan?tab=tukar',
        metadata: { swapId: id, status: 'approved', substituteName: subProfile?.full_name, swapDate: swap.swap_date },
      });

      // 2. Notifikasi Otomatis ke Karyawan Pengganti (Penugasan Resmi Mengisi Kekosongan)
      if (finalSubId) {
        await broadcastNotification({
          targetUserId: finalSubId,
          title: 'Penugasan: Mengisi Kekosongan Pos Dinas',
          message: `Pemberitahuan Penugasan Resmi: Korlap (${approverName || 'Koordinator Lapangan'}) telah menugaskan Anda untuk mengisi kekosongan pos dinas (${swap.target_shift}) menggantikan ${reqProfile?.full_name} pada tanggal ${swap.swap_date}. Harap hadir tepat waktu sesuai jadwal.`,
          type: 'info',
          link: '/pengajuan?tab=tukar',
          metadata: { swapId: id, action: 'substitute_assignment', requesterName: reqProfile?.full_name, swapDate: swap.swap_date },
        });
      }

      // 3. Notifikasi ke Kepala Regu (Danru)
      await broadcastNotification({
        recipientRoles: ['kepala_regu', 'pengawas'],
        title: 'Penetapan Pengganti Selesai oleh Korlap',
        message: `Korlap telah menyetujui pengajuan ${reqProfile?.full_name} (${swap.swap_date}) dan menetapkan personil pengganti: ${subProfile?.full_name}.`,
        type: 'success',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id, substituteId: finalSubId },
      });

      // 4. Notifikasi ke Admin / HRD (Penyesuaian Jadwal & Roster)
      await broadcastNotification({
        recipientRoles: ['admin', 'hrd'],
        title: 'Roster Dinas Diperbarui: Pengganti Disahkan Korlap',
        message: `Korlap telah mengesahkan ${subProfile?.full_name} sebagai pengganti resmi ${reqProfile?.full_name} pada ${swap.swap_date} (${swap.target_shift}). Roster dinas dan presensi telah disesuaikan.`,
        type: 'info',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id },
      });

      // 5. Notifikasi ke Keuangan (Pencatatan Insentif / Premi Pengganti Payroll)
      await broadcastNotification({
        recipientRoles: ['keuangan'],
        title: 'Pencatatan Payroll: Penugasan Dinas Pengganti Disahkan',
        message: `Penugasan dinas pengganti oleh ${subProfile?.full_name} untuk ${reqProfile?.full_name} (${swap.swap_date}) telah disahkan Korlap. Masuk dalam catatan perhitungan kompensasi/premi shift.`,
        type: 'info',
        link: '/admin/payroll',
        metadata: { swapId: id, requesterId: swap.requester_id, substituteId: finalSubId },
      });

      // 6. Notifikasi ke Pimpinan & Superadmin (Laporan Operasional)
      await broadcastNotification({
        recipientRoles: ['pimpinan', 'superadmin'],
        title: 'Laporan Operasional: Penetapan Pengganti Dinas Disahkan',
        message: `Korlap (${approverName || 'Koordinator Lapangan'}) telah menyelesaikan penetapan pos dinas untuk ${reqProfile?.full_name} dengan menugaskan ${subProfile?.full_name} pada tanggal ${swap.swap_date}.`,
        type: 'info',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id },
      });
    } else {
      // Ditolak oleh Korlap
      const rejectMsg = `Permohonan dinas untuk tanggal ${swap.swap_date} (${swap.original_shift}) DITOLAK oleh Korlap (${approverName || 'Koordinator Lapangan'}).${notes ? ' Alasan: ' + notes : ''}`;

      await broadcastNotification({
        targetUserId: swap.requester_id,
        title: 'Pengajuan Dinas Ditolak Korlap',
        message: rejectMsg,
        type: 'warning',
        link: '/pengajuan?tab=tukar',
        metadata: { swapId: id, status: 'rejected' },
      });

      await broadcastNotification({
        recipientRoles: ['kepala_regu', 'pengawas', 'admin', 'pimpinan'],
        title: 'Pengajuan Dinas Ditolak Korlap',
        message: `Pengajuan dinas ${reqProfile?.full_name} (${swap.swap_date}) ditolak oleh Korlap.`,
        type: 'warning',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id },
      });
    }

    res.json({
      success: true,
      data: up.rows[0],
      message: status === 'approved'
        ? 'Penetapan pengganti pos dinas berhasil disetujui & notifikasi otomatis dikirimkan ke seluruh pihak terkait.'
        : 'Permohonan dinas berhasil ditolak oleh Korlap.',
    });
  } catch (err) {
    console.error('Korlap approval error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 11. NOTIFICATIONS API (TERPUSAT DESKTOP & MOBILE) ───────────────────────
app.get('/api/notifications', async (req, res) => {
  const { userId, role } = req.query;
  try {
    let query = `
      SELECT n.*, 
             p.full_name as user_name,
             p.avatar_url as user_avatar
      FROM hrm_notifications n
      LEFT JOIN hrm_profiles p ON n.user_id = p.id
    `;
    const conditions = [];
    const params = [];

    if (userId) {
      let validUserId = userId;
      if (!UUID_REGEX.test(userId)) {
        const uRes = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
        if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
      }
      params.push(validUserId);
      conditions.push(`n.user_id = $${params.length}`);
    }

    if (role) {
      const normRole = role.toLowerCase();
      let matchedRoles = [normRole, 'all_admin', 'all'];
      if (normRole === 'superadmin') {
        matchedRoles.push('admin', 'hrd', 'pimpinan', 'korlap', 'kepala_regu', 'pengawas');
      } else if (normRole === 'pimpinan') {
        matchedRoles.push('admin', 'korlap', 'kepala_regu');
      } else if (normRole === 'korlap') {
        matchedRoles.push('kepala_regu', 'pengawas');
      } else if (normRole === 'kepala_regu') {
        matchedRoles.push('pengawas');
      } else if (normRole === 'admin' || normRole === 'hrd') {
        matchedRoles.push('admin', 'hrd');
      }
      params.push(matchedRoles);
      conditions.push(`LOWER(n.recipient_role) = ANY($${params.length})`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' OR ');
    }
    query += ' ORDER BY n.created_at DESC LIMIT 60';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE hrm_notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const handleReadAllNotifications = async (req, res) => {
  const { userId, role } = req.body;
  try {
    if (userId) {
      let validUserId = userId;
      if (!UUID_REGEX.test(userId)) {
        const uRes = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
        if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
      }
      await pool.query('UPDATE hrm_notifications SET is_read = true WHERE user_id = $1', [validUserId]);
    }
    if (role) {
      await pool.query('UPDATE hrm_notifications SET is_read = true WHERE LOWER(recipient_role) = LOWER($1)', [role]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/notifications/read-all', handleReadAllNotifications);
app.patch('/api/notifications/read-all', handleReadAllNotifications);

// ─── 12. SALARY SLIP & PAYROLL MANAGEMENT (DATABASE STATUTORIS REAL) ─────────

function calculatePph21Ter(grossIncome) {
  if (grossIncome <= 5400000) return 0;
  if (grossIncome <= 5650000) return Math.round(grossIncome * 0.0025);
  if (grossIncome <= 5950000) return Math.round(grossIncome * 0.005);
  if (grossIncome <= 6300000) return Math.round(grossIncome * 0.0075);
  if (grossIncome <= 6750000) return Math.round(grossIncome * 0.01);
  if (grossIncome <= 7500000) return Math.round(grossIncome * 0.0125);
  if (grossIncome <= 8550000) return Math.round(grossIncome * 0.015);
  if (grossIncome <= 9650000) return Math.round(grossIncome * 0.0175);
  if (grossIncome <= 10050000) return Math.round(grossIncome * 0.02);
  if (grossIncome <= 10350000) return Math.round(grossIncome * 0.0225);
  if (grossIncome <= 10700000) return Math.round(grossIncome * 0.025);
  if (grossIncome <= 11050000) return Math.round(grossIncome * 0.03);
  if (grossIncome <= 11600000) return Math.round(grossIncome * 0.035);
  if (grossIncome <= 12500000) return Math.round(grossIncome * 0.04);
  if (grossIncome <= 13750000) return Math.round(grossIncome * 0.05);
  if (grossIncome <= 15100000) return Math.round(grossIncome * 0.06);
  if (grossIncome <= 16950000) return Math.round(grossIncome * 0.07);
  if (grossIncome <= 19750000) return Math.round(grossIncome * 0.08);
  if (grossIncome <= 24150000) return Math.round(grossIncome * 0.09);
  return Math.round(grossIncome * 0.10);
}

function toTerbilang(angka) {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const n = Math.floor(Math.abs(Number(angka) || 0));
  if (n < 12) return bilangan[n];
  if (n < 20) return toTerbilang(n - 10) + ' Belas';
  if (n < 100) return toTerbilang(Math.floor(n / 10)) + ' Puluh ' + toTerbilang(n % 10);
  if (n < 200) return 'Seratus ' + toTerbilang(n - 100);
  if (n < 1000) return toTerbilang(Math.floor(n / 100)) + ' Ratus ' + toTerbilang(n % 100);
  if (n < 2000) return 'Seribu ' + toTerbilang(n - 1000);
  if (n < 1000000) return toTerbilang(Math.floor(n / 1000)) + ' Ribu ' + toTerbilang(n % 1000);
  if (n < 1000000000) return toTerbilang(Math.floor(n / 1000000)) + ' Juta ' + toTerbilang(n % 1000000);
  return toTerbilang(Math.floor(n / 1000000000)) + ' Miliar ' + toTerbilang(n % 1000000000);
}

// REST Endpoints for Salary Profiles
app.get('/api/payroll/profiles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sp.*, p.full_name as user_name, p.nip as user_nip, d.name as division_name
      FROM hrm_payroll_salary_profiles sp
      JOIN hrm_profiles p ON sp.user_id = p.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      ORDER BY p.full_name ASC;
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payroll/profiles', async (req, res) => {
  const { userId, baseSalary, positionAllowance, mealAllowance, transportAllowance, bankName, bankAccount, bankAccountName } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId wajib diisi' });
  }
  try {
    const result = await pool.query(`
      INSERT INTO hrm_payroll_salary_profiles (
        user_id, base_salary, position_allowance, meal_allowance, transport_allowance,
        bank_name, bank_account_number, bank_account_holder, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        base_salary = EXCLUDED.base_salary,
        position_allowance = EXCLUDED.position_allowance,
        meal_allowance = EXCLUDED.meal_allowance,
        transport_allowance = EXCLUDED.transport_allowance,
        bank_name = EXCLUDED.bank_name,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_account_holder = EXCLUDED.bank_account_holder,
        updated_at = NOW()
      RETURNING *;
    `, [
      userId,
      baseSalary ? parseInt(baseSalary, 10) : 0,
      positionAllowance ? parseInt(positionAllowance, 10) : 0,
      mealAllowance ? parseInt(mealAllowance, 10) : 0,
      transportAllowance ? parseInt(transportAllowance, 10) : 0,
      bankName || 'Bank Mandiri',
      bankAccount || '-',
      bankAccountName || '-',
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/payroll/periods', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hrm_payroll_periods ORDER BY year DESC, month DESC LIMIT 24');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Electronic Official Salary Slip (Returns JSON for Mobile & Desktop)
app.get('/api/payroll/slip/:userId', async (req, res) => {
  const { userId } = req.params;
  const { periodId } = req.query;

  try {
    let query = `
      SELECT 
        s.*,
        p.full_name as employee_name,
        p.nip as employee_nip,
        p.email as employee_email,
        r.name as role_name,
        d.name as division_name,
        p.placement_location,
        COALESCE(sp.employee_sequence_no, p.employee_sequence_no, 0) as employee_sequence_no,
        COALESCE(sp.severance_scheme, 'tabungan') as severance_scheme,
        COALESCE(sp.saved_severance_balance, 0) as saved_severance_balance,
        COALESCE(sp.hourly_overtime_rate, 24173.06) as hourly_overtime_rate,
        COALESCE(sp.bank_name, 'Bank Central Asia (BCA)') as bank_name,
        COALESCE(sp.bank_account_number, '-') as bank_account_number,
        COALESCE(sp.bank_account_holder, p.full_name) as bank_account_holder
      FROM hrm_payroll_slips s
      JOIN hrm_profiles p ON s.user_id = p.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE (s.user_id::text = $1 OR LOWER(p.email) = LOWER($1) OR p.nip = $1)
    `;
    const params = [userId];
    if (periodId) {
      params.push(periodId);
      query += ` AND s.period_id = $2`;
    }
    query += ` ORDER BY s.created_at DESC LIMIT 1`;

    let result = await pool.query(query, params);
    let row;

    if (result.rows.length > 0) {
      row = result.rows[0];
    } else {
      // Fallback query profile
      const profRes = await pool.query(`
        SELECT p.*, r.name as role_name, d.name as division_name,
               COALESCE(sp.employee_sequence_no, p.employee_sequence_no, 0) as employee_sequence_no,
               COALESCE(sp.severance_scheme, 'tabungan') as severance_scheme,
               COALESCE(sp.saved_severance_balance, 0) as saved_severance_balance,
               COALESCE(sp.hourly_overtime_rate, 24173.06) as hourly_overtime_rate,
               COALESCE(sp.base_salary, 4045050) as base_salary,
               COALESCE(sp.bank_name, 'Bank Central Asia (BCA)') as bank_name,
               COALESCE(sp.bank_account_number, '-') as bank_account_number
        FROM hrm_profiles p
        LEFT JOIN hrm_roles r ON p.role_id = r.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
        WHERE p.id::text = $1 OR LOWER(p.email) = LOWER($1) OR p.nip = $1
        LIMIT 1
      `, [userId]);

      if (profRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
      }

      const prof = profRes.rows[0];
      row = {
        id: `SLIP-2026-09-${prof.nip || 'EMP008'}`,
        user_id: prof.id,
        employee_name: prof.full_name,
        employee_nip: prof.nip,
        employee_sequence_no: prof.employee_sequence_no,
        severance_scheme: prof.severance_scheme,
        placement_location: prof.placement_location,
        division_name: prof.division_name,
        role_name: prof.role_name,
        bank_name: prof.bank_name,
        bank_account_number: prof.bank_account_number,
        period_label: 'September 2026',
        printed_date: new Date().toISOString(),
        status: 'paid',
        base_salary: prof.base_salary || '4045050',
        total_overtime_pay: '0',
        pesangon_label: 'Pesangon September',
        pesangon_amount: '0',
        gross_income: String(prof.base_salary || '4045050'),
        bpjs_ketenagakerjaan_deduction: '121351',
        bpjs_kesehatan_deduction: '40450',
        alpa_days: 0,
        alpa_rate: '155000',
        absence_deduction: '0',
        total_deductions: '161802',
        net_salary: '3883248',
        notes: 'Slip gaji resmi PT. FAWWAZ RESKI PERWIRA',
      };
    }

    // Dynamic month calculation
    const INDO_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    let activeMonth = INDO_MONTHS[new Date().getMonth()];
    if (row.period_label) {
      for (const m of INDO_MONTHS) {
        if (row.period_label.toLowerCase().includes(m.toLowerCase())) {
          activeMonth = m;
          break;
        }
      }
    }
    const dynamicPesangonLabel = `Pesangon ${activeMonth}`;

    // Dual Severance Scheme:
    // No. 1 - 33: DITABUNGKAN (Accrued, not added to monthly cash THP)
    // No. 34 - 80: DIBAYARKAN BERSAMAAN DENGAN GAJI (Added to gross earnings and THP)
    const seqNo = Number(row.employee_sequence_no || 0);
    const isTabunganPesangon = row.severance_scheme === 'tabungan' || (seqNo > 0 && seqNo <= 33);
    const rawPesangon = Number(row.pesangon_amount || 0);
    const pesangonVal = isTabunganPesangon ? 0 : rawPesangon;
    const savedPesangonVal = isTabunganPesangon ? rawPesangon : 0;

    const upahVal = Number(row.base_salary || 4045050);
    const lemburVal = Number(row.total_overtime_pay || 0);
    const grossVal = upahVal + lemburVal + pesangonVal;

    // BPJS: If standard Rp 4.045.050, BPJS 3% = 121.351, 1% = 40.450, total = 161.802
    // If standard Rp 4.181.940, BPJS 3% = 125.458, 1% = 41.819, total = 167.277
    const bpjsTkVal = upahVal === 4045050 ? 121351 : Math.round(upahVal * 0.03);
    const bpjsKesVal = upahVal === 4045050 ? 40450 : Math.round(upahVal * 0.01);
    const alpaVal = Number(row.absence_deduction || 0);
    const totDeductVal = (upahVal === 4045050 ? 161802 : (bpjsTkVal + bpjsKesVal)) + alpaVal;
    const netVal = grossVal - totDeductVal;

    res.json({
      success: true,
      slip: {
        id: row.id,
        period: row.period_label || `${activeMonth} 2026`,
        printedDate: row.printed_date ? new Date(row.printed_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        status: (row.status || 'paid').toUpperCase(),
        employee: {
          id: row.user_id,
          name: row.employee_name,
          nip: row.employee_nip || '-',
          sequenceNo: seqNo,
          severanceScheme: isTabunganPesangon ? 'tabungan' : 'cash_with_salary',
          savedSeveranceBalance: Number(row.saved_severance_balance || 0),
          placementLocation: row.placement_location || '-',
          division: row.division_name || 'Dept. of Distribution Management',
          role: row.role_name || 'Karyawan',
          bankName: row.bank_name || 'Bank Central Asia (BCA)',
          bankAccount: row.bank_account_number || '-'
        },
        upah: upahVal,
        lembur: lemburVal,
        pesangonLabel: dynamicPesangonLabel,
        pesangonAmount: pesangonVal,
        savedPesangonAmount: savedPesangonVal,
        isSeveranceSaved: isTabunganPesangon,
        grossEarnings: grossVal,
        earnings: [
          { label: 'Upah', amount: upahVal },
          { label: 'Lembur', amount: lemburVal },
          { label: dynamicPesangonLabel, amount: pesangonVal }
        ],
        bpjsTkLabel: 'BPJS Ketenagakerjaan 3%',
        bpjsTkAmount: bpjsTkVal,
        bpjsKesLabel: 'BPJS Kesehatan 1%',
        bpjsKesAmount: bpjsKesVal,
        alpaDays: Number(row.alpa_days || 0),
        alpaRate: Number(row.alpa_rate || 155000),
        alpaAmount: alpaVal,
        totalDeductions: totDeductVal,
        deductions: [
          { label: 'BPJS Ketenagakerjaan 3%', amount: bpjsTkVal },
          { label: 'BPJS Kesehatan 1%', amount: bpjsKesVal },
          { label: `Presensi / Alpa (${row.alpa_days || 0} Hari)`, amount: alpaVal }
        ],
        netSalary: netVal,
        notes: row.notes || 'Slip gaji resmi PT. FAWWAZ RESKI PERWIRA'
      }
    });
  } catch (err) {
    console.error('Slip error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Printable HTML Slip Gaji (Format Resmi Boxed PT. Fawwaz Reski Perwira)
app.get('/api/payroll/slip/:userId/print', async (req, res) => {
  const { userId } = req.params;
  const { periodId } = req.query;

  try {
    let query = `
      SELECT 
        s.*,
        p.full_name as employee_name,
        p.nip as employee_nip,
        p.email as employee_email,
        r.name as role_name,
        d.name as division_name,
        COALESCE(sp.bank_name, 'Bank Central Asia (BCA)') as bank_name,
        COALESCE(sp.bank_account_number, '-') as bank_account_number
      FROM hrm_payroll_slips s
      JOIN hrm_profiles p ON s.user_id = p.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE (s.user_id::text = $1 OR LOWER(p.email) = LOWER($1) OR p.nip = $1)
    `;
    const params = [userId];
    if (periodId) {
      params.push(periodId);
      query += ` AND s.period_id = $2`;
    }
    query += ` ORDER BY s.created_at DESC LIMIT 1`;

    let result = await pool.query(query, params);
    let row;

    if (result.rows.length > 0) {
      row = result.rows[0];
    } else {
      const profRes = await pool.query(`
        SELECT p.*, r.name as role_name, d.name as division_name,
               COALESCE(sp.bank_name, 'Bank Central Asia (BCA)') as bank_name,
               COALESCE(sp.bank_account_number, '-') as bank_account_number
        FROM hrm_profiles p
        LEFT JOIN hrm_roles r ON p.role_id = r.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
        WHERE p.id::text = $1 OR LOWER(p.email) = LOWER($1) OR p.nip = $1
        LIMIT 1
      `, [userId]);

      if (profRes.rows.length === 0) {
        return res.status(404).send('<h3>Karyawan tidak ditemukan</h3>');
      }

      const prof = profRes.rows[0];
      row = {
        id: `SLIP-2026-09-${prof.nip || 'EMP008'}`,
        user_id: prof.id,
        employee_name: prof.full_name,
        employee_nip: prof.nip,
        division_name: prof.division_name,
        role_name: prof.role_name,
        period_label: 'September 2026',
        printed_date: new Date().toISOString(),
        base_salary: '4045050',
        total_overtime_pay: '0',
        pesangon_label: 'Pesangon Agustus',
        pesangon_amount: '0',
        gross_income: '4045050',
        bpjs_ketenagakerjaan_deduction: '121351',
        bpjs_kesehatan_deduction: '40450',
        alpa_days: 0,
        alpa_rate: '155000',
        absence_deduction: '0',
        total_deductions: '161802',
        net_salary: '3883248',
      };
    }

    const fmt = (num) => {
      const n = Number(num || 0);
      return n.toLocaleString('en-US');
    };

    const upah = Number(row.base_salary || 4045050);
    const lembur = Number(row.total_overtime_pay || 0);

    const activeMonthPrint = (function() {
      const INDO_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      if (row.period_label) {
        for (const m of INDO_MONTHS) {
          if (row.period_label.toLowerCase().includes(m.toLowerCase())) return m;
        }
      }
      return INDO_MONTHS[new Date().getMonth()];
    })();
    const pesangonLabel = `Pesangon ${activeMonthPrint}`;

    const seqNoPrint = Number(row.employee_sequence_no || 0);
    const isTabunganPesangonPrint = row.severance_scheme === 'tabungan' || (seqNoPrint > 0 && seqNoPrint <= 33);
    const rawPesangonPrint = Number(row.pesangon_amount || 0);
    const pesangonAmount = isTabunganPesangonPrint ? 0 : rawPesangonPrint;
    const grossEarnings = upah + lembur + pesangonAmount;

    const bpjsTk = upah === 4045050 ? 121351 : Math.round(upah * 0.03);
    const bpjsKes = upah === 4045050 ? 40450 : Math.round(upah * 0.01);
    const alpaDays = Number(row.alpa_days || 0);
    const alpaRate = Number(row.alpa_rate || 155000);
    const alpaAmount = Number(row.absence_deduction || 0);
    const totalDeductions = (upah === 4045050 ? 161802 : (bpjsTk + bpjsKes)) + alpaAmount;
    const netSalary = grossEarnings - totalDeductions;

    const printedDateStr = row.printed_date
      ? new Date(row.printed_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // Read Logo as base64 for instant offline rendering
    let logoDataUrl = '';
    const logoFile = path.join(__dirname, 'assets/logo.png');
    if (fs.existsSync(logoFile)) {
      const buf = fs.readFileSync(logoFile);
      logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    }

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Slip Gaji - ${row.employee_name} (${row.period_label || 'September 2026'})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 20mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #000;
    }
    body {
      background: #f1f5f9;
      padding: 24px 16px;
    }
    .print-actions {
      max-width: 820px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn-print {
      background: #059669;
      color: #fff;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
    }
    .slip-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      padding: 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
    
    /* 1. Header Box */
    .header-box {
      border: 2px solid #000;
      margin-bottom: 8px;
    }
    .header-top {
      display: flex;
      border-bottom: 2px solid #000;
    }
    .header-company {
      flex: 1.1;
      display: flex;
      align-items: center;
      padding: 8px 14px;
      border-right: 2px solid #000;
      gap: 12px;
    }
    .company-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .company-name {
      text-align: center;
      flex: 1;
      line-height: 1.25;
    }
    .company-name-underline {
      font-size: 17px;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
      letter-spacing: 0.5px;
    }
    .company-name-bold {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .header-title {
      flex: 1.2;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 8px 14px;
      text-align: center;
    }
    .slip-main-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .slip-period {
      font-size: 14px;
      font-weight: 700;
      margin-top: 6px;
    }
    .header-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 8px 14px;
      font-size: 13px;
      line-height: 1.6;
    }
    .meta-col-left {
      display: flex;
      flex-direction: column;
    }
    .meta-item {
      display: flex;
    }
    .meta-lbl {
      width: 60px;
      font-weight: 700;
    }
    .meta-sep {
      width: 14px;
      font-weight: 700;
    }
    .meta-val {
      font-weight: 700;
    }
    .meta-col-right {
      display: flex;
      align-items: flex-end;
      font-size: 12px;
      font-weight: 600;
    }

    /* 2. Columns: PENDAPATAN & POTONGAN */
    .columns-row {
      display: flex;
      gap: 10px;
      align-items: stretch;
    }
    .col-box {
      flex: 1;
      border: 2px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .col-header {
      text-align: center;
      font-size: 13.5px;
      font-weight: 800;
      padding: 6px 8px;
      border-bottom: 2px solid #000;
      letter-spacing: 0.5px;
    }
    .col-body {
      padding: 8px 10px;
      flex: 1;
      min-height: 100px;
    }
    .col-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      line-height: 1.75;
    }
    .col-label {
      flex: 1;
    }
    .col-sep {
      width: 14px;
      text-align: center;
    }
    .col-val {
      min-width: 110px;
      text-align: right;
      font-weight: 600;
    }
    .col-footer {
      border-top: 2px solid #000;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 800;
    }
    .footer-label {
      flex: 1;
    }
    .footer-sep {
      width: 14px;
      text-align: center;
    }
    .footer-val {
      min-width: 110px;
      text-align: right;
    }

    /* 3. Bottom: Jumlah Gaji */
    .total-thp-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .total-thp-box {
      width: calc(50% - 5px);
      border: 2px solid #000;
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 800;
    }
    .thp-label {
      font-weight: 800;
    }
    .thp-sep {
      width: 14px;
      text-align: center;
      font-weight: 800;
    }
    .thp-val {
      min-width: 120px;
      text-align: right;
      font-weight: 900;
      font-size: 15px;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .print-actions {
        display: none !important;
      }
      .slip-wrapper {
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="slip-wrapper">
    <!-- Header Box -->
    <div class="header-box">
      <div class="header-top">
        <div class="header-company">
          ${logoDataUrl ? `<img src="${logoDataUrl}" class="company-logo" alt="Logo FRP">` : ''}
          <div class="company-name">
            <div class="company-name-underline">PT. FAWWAZ RESKI</div>
            <div class="company-name-bold">PERWIRA</div>
          </div>
        </div>
        <div class="header-title">
          <div class="slip-main-title">SLIP GAJI KARYAWAN</div>
          <div class="slip-period">PERIODE : ${String(row.period_label || 'September 2026').toUpperCase()}</div>
        </div>
      </div>
      <div class="header-meta">
        <div class="meta-col-left">
          <div class="meta-item">
            <span class="meta-lbl">NAMA</span>
            <span class="meta-sep">:</span>
            <span class="meta-val">${row.employee_name || '-'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-lbl">ID</span>
            <span class="meta-sep">:</span>
            <span class="meta-val">${row.employee_nip || '-'}</span>
          </div>
        </div>
        <div class="meta-col-right">
          <span>Dicetak Tanggal : &nbsp;${printedDateStr}</span>
        </div>
      </div>
    </div>

    <!-- 2 Columns Box -->
    <div class="columns-row">
      <!-- PENDAPATAN -->
      <div class="col-box">
        <div class="col-header">PENDAPATAN :</div>
        <div class="col-body">
          <div class="col-row">
            <span class="col-label">Upah</span>
            <span class="col-sep">:</span>
            <span class="col-val">Rp ${fmt(upah)}</span>
          </div>
          <div class="col-row">
            <span class="col-label">Lembur</span>
            <span class="col-sep">:</span>
            <span class="col-val">${lembur > 0 ? 'Rp ' + fmt(lembur) : ''}</span>
          </div>
          <div class="col-row">
            <span class="col-label">${pesangonLabel}</span>
            <span class="col-sep">:</span>
            <span class="col-val">${pesangonAmount > 0 ? 'Rp ' + fmt(pesangonAmount) : ''}</span>
          </div>
        </div>
        <div class="col-footer">
          <span class="footer-label">Total Pendapatan</span>
          <span class="footer-sep">:</span>
          <span class="footer-val">Rp ${fmt(grossEarnings)}</span>
        </div>
      </div>

      <!-- POTONGAN -->
      <div class="col-box">
        <div class="col-header">POTONGAN :</div>
        <div class="col-body">
          <div class="col-row">
            <span class="col-label">BPJS Ketenagakerjaan 3%</span>
            <span class="col-sep">:</span>
            <span class="col-val">Rp ${fmt(bpjsTk)}</span>
          </div>
          <div class="col-row">
            <span class="col-label">BPJS Kesehatan 1%</span>
            <span class="col-sep">:</span>
            <span class="col-val">Rp ${fmt(bpjsKes)}</span>
          </div>
          <div class="col-row">
            <span class="col-label" style="display:flex; align-items:center; gap:6px;">
              <span>Presensi / Alpa</span>
              <span style="font-weight:bold;">:</span>
              <span style="font-weight:normal;">${alpaDays > 0 ? `${alpaDays} Hari @` : 'Hari @'}</span>
            </span>
            <span class="col-sep">:</span>
            <span class="col-val">${alpaAmount > 0 ? 'Rp ' + fmt(alpaAmount) : 'Rp &nbsp; &nbsp; &nbsp; -'}</span>
          </div>
          <div class="col-row">
            <span class="col-label"></span>
            <span class="col-sep">:</span>
            <span class="col-val"></span>
          </div>
        </div>
        <div class="col-footer">
          <span class="footer-label">Total Potongan</span>
          <span class="footer-sep">:</span>
          <span class="footer-val">Rp ${fmt(totalDeductions)}</span>
        </div>
      </div>
    </div>

    <!-- Jumlah Gaji Box -->
    <div class="total-thp-wrapper">
      <div class="total-thp-box">
        <span class="thp-label">Jumlah Gaji</span>
        <span class="thp-sep">:</span>
        <span class="thp-val">Rp ${fmt(netSalary)}</span>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      if (window.location.search.includes('autoprint=1')) {
        setTimeout(function() { window.print(); }, 400);
      }
    };
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Print slip error:', err);
    res.status(500).send('<h3>Gagal membuat slip gaji: ' + err.message + '</h3>');
  }
});

// ─── 11. BIOMETRIC FACE ENROLLMENT & HANDOFF ────────────────────────────────
app.post('/api/biometrics/enroll', async (req, res) => {
  const { userId, faceDescriptor, enrolledPhoto } = req.body;
  if (!userId || !faceDescriptor) {
    return res.status(400).json({ success: false, error: 'User ID dan vektor biometrik wajah wajib diisi' });
  }

  try {
    const descriptorJson = typeof faceDescriptor === 'string' ? faceDescriptor : JSON.stringify(faceDescriptor);
    const query = `
      UPDATE hrm_profiles SET
        is_face_enrolled = true,
        face_descriptor = $1,
        face_enrolled_photo = COALESCE($2, face_enrolled_photo),
        face_enrolled_at = NOW(),
        updated_at = NOW()
      WHERE id::text = $3 OR nip = $3 OR LOWER(email) = LOWER($3)
      RETURNING *;
    `;
    const result = await pool.query(query, [descriptorJson, enrolledPhoto || null, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    const user = formatUserRow(result.rows[0]);
    res.json({ success: true, data: user, message: 'Wajah master biometrik berhasil didaftarkan' });
  } catch (err) {
    console.error('Biometric enroll error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/biometrics/reset/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const query = `
      UPDATE hrm_profiles SET
        is_face_enrolled = false,
        face_descriptor = NULL,
        face_enrolled_photo = NULL,
        face_enrolled_at = NULL,
        updated_at = NOW()
      WHERE id::text = $1 OR nip = $1 OR LOWER(email) = LOWER($1)
      RETURNING *;
    `;
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    res.json({ success: true, message: 'Master wajah biometrik berhasil direset oleh HRD' });
  } catch (err) {
    console.error('Biometric reset error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/biometrics/status/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, nip, full_name, is_face_enrolled, face_enrolled_photo, face_enrolled_at FROM hrm_profiles WHERE id::text = $1 OR nip = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 14. ENTERPRISE NOTIFICATION SYSTEM (POSTGRESQL MULTI-ROLE & PUSH SYNC) ──

app.get('/api/notifications', async (req, res) => {
  const { userId, role } = req.query;
  try {
    let query;
    let params = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validUserId = null;

    if (userId && uuidRegex.test(userId)) {
      validUserId = userId;
    } else if (userId) {
      const uRes = await pool.query(
        'SELECT id FROM hrm_profiles WHERE nip = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
    }

    const cleanRole = (role || '').toLowerCase().replace(/[\s_-]/g, '');

    if (validUserId && cleanRole) {
      query = `
        SELECT * FROM hrm_notifications
        WHERE user_id = $1
           OR recipient_role = $2
           OR recipient_role = 'all'
           OR ($2 IN ('admin', 'hrd') AND recipient_role IN ('admin', 'hrd', 'all_admin'))
           OR ($2 = 'superadmin' AND recipient_role IN ('superadmin', 'admin', 'hrd', 'all_admin', 'pimpinan'))
           OR ($2 = 'pimpinan' AND recipient_role IN ('pimpinan', 'all_pimpinan', 'all_admin'))
        ORDER BY created_at DESC
        LIMIT 60;
      `;
      params = [validUserId, cleanRole];
    } else if (validUserId) {
      query = `
        SELECT * FROM hrm_notifications
        WHERE user_id = $1 OR recipient_role = 'all'
        ORDER BY created_at DESC
        LIMIT 60;
      `;
      params = [validUserId];
    } else if (cleanRole) {
      query = `
        SELECT * FROM hrm_notifications
        WHERE recipient_role = $1
           OR recipient_role = 'all'
           OR ($1 IN ('admin', 'hrd') AND recipient_role IN ('admin', 'hrd', 'all_admin'))
           OR ($1 = 'superadmin' AND recipient_role IN ('superadmin', 'admin', 'hrd', 'all_admin', 'pimpinan'))
           OR ($1 = 'pimpinan' AND recipient_role IN ('pimpinan', 'all_pimpinan', 'all_admin'))
        ORDER BY created_at DESC
        LIMIT 60;
      `;
      params = [cleanRole];
    } else {
      query = `SELECT * FROM hrm_notifications ORDER BY created_at DESC LIMIT 60;`;
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE hrm_notifications SET is_read = true WHERE id::text = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notifikasi tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  const { userId, role } = req.body;
  try {
    const cleanRole = (role || '').toLowerCase().replace(/[\s_-]/g, '');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validUserId = null;

    if (userId && uuidRegex.test(userId)) {
      validUserId = userId;
    } else if (userId) {
      const uRes = await pool.query(
        'SELECT id FROM hrm_profiles WHERE nip = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
    }

    if (validUserId && cleanRole) {
      await pool.query(`
        UPDATE hrm_notifications
        SET is_read = true
        WHERE user_id = $1
           OR recipient_role = $2
           OR recipient_role = 'all'
           OR ($2 IN ('admin', 'hrd') AND recipient_role IN ('admin', 'hrd', 'all_admin'))
           OR ($2 = 'superadmin' AND recipient_role IN ('superadmin', 'admin', 'hrd', 'all_admin', 'pimpinan'))
           OR ($2 = 'pimpinan' AND recipient_role IN ('pimpinan', 'all_pimpinan', 'all_admin'));
      `, [validUserId, cleanRole]);
    } else if (validUserId) {
      await pool.query('UPDATE hrm_notifications SET is_read = true WHERE user_id = $1', [validUserId]);
    } else if (cleanRole) {
      await pool.query(`
        UPDATE hrm_notifications
        SET is_read = true
        WHERE recipient_role = $1
           OR recipient_role = 'all'
           OR ($1 IN ('admin', 'hrd') AND recipient_role IN ('admin', 'hrd', 'all_admin'))
           OR ($1 = 'superadmin' AND recipient_role IN ('superadmin', 'admin', 'hrd', 'all_admin', 'pimpinan'))
           OR ($1 = 'pimpinan' AND recipient_role IN ('pimpinan', 'all_pimpinan', 'all_admin'));
      `, [cleanRole]);
    } else {
      await pool.query('UPDATE hrm_notifications SET is_read = true');
    }

    res.json({ success: true, message: 'Semua notifikasi berhasil ditandai sudah dibaca' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { userId, title, message, type, link, recipientRole, metadata } = req.body;
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validUserId = null;

    if (userId && uuidRegex.test(userId)) {
      validUserId = userId;
    } else if (userId && userId !== 'all' && userId !== 'all_admin') {
      const uRes = await pool.query(
        'SELECT id FROM hrm_profiles WHERE nip = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
    }

    const query = `
      INSERT INTO hrm_notifications (
        user_id, title, message, type, link, recipient_role, metadata, is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
      RETURNING *;
    `;
    const result = await pool.query(query, [
      validUserId,
      title || 'Pemberitahuan Sistem',
      message || '',
      type || 'info',
      link || null,
      recipientRole || null,
      JSON.stringify(metadata || {}),
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ANALYTICS ENDPOINTS (Pimpinan / Keuangan / Superadmin / Korlap) ────────

// GET /api/analytics/summary — KPI cards + weekly chart data + division breakdown
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];

    // KPI aggregations (parallel)
    const [empRes, hadirRes, pendingRes, avgRes, weeklyRes, divisionRes, submissionsRes] = await Promise.all([
      // Total active employees
      pool.query(`SELECT COUNT(*) as total FROM hrm_profiles WHERE is_active = true`),
      // Hadir today (biometric verified)
      pool.query(`SELECT COUNT(DISTINCT user_id) as total FROM hrm_attendances WHERE attendance_date = $1 AND status IN ('hadir','terlambat')`, [today]),
      // Pending approvals (cuti + lembur)
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM hrm_leave_requests WHERE status = 'pending') +
          (SELECT COUNT(*) FROM hrm_overtime_records WHERE status = 'pending') as total
      `),
      // Average monthly attendance %
      pool.query(`
        SELECT ROUND(
          COALESCE(
            (COUNT(DISTINCT a.user_id) FILTER (WHERE a.attendance_date >= $1)::float /
            NULLIF((SELECT COUNT(*) FROM hrm_profiles WHERE is_active = true), 0)) * 100, 0
          )::numeric, 1
        ) as avg_pct
        FROM hrm_attendances a
        WHERE a.attendance_date >= $1
      `, [monthStart]),
      // Weekly attendance (last 7 days, Sun=0 → Mon last week start)
      pool.query(`
        SELECT
          EXTRACT(DOW FROM attendance_date)::int as dow,
          attendance_date,
          COUNT(DISTINCT user_id) as hadir
        FROM hrm_attendances
        WHERE attendance_date >= (CURRENT_DATE - INTERVAL '6 days')
        GROUP BY attendance_date, EXTRACT(DOW FROM attendance_date)
        ORDER BY attendance_date
      `),
      // Division breakdown
      pool.query(`
        SELECT d.name, COUNT(p.id) as count
        FROM hrm_profiles p
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        WHERE p.is_active = true
        GROUP BY d.name
        ORDER BY count DESC
        LIMIT 8
      `),
      // Submissions status count (this month)
      pool.query(`
        SELECT
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM (
          SELECT status FROM hrm_leave_requests WHERE created_at >= $1
          UNION ALL
          SELECT status FROM hrm_overtime_records WHERE created_at >= $1
        ) combined
      `, [monthStart]),
    ]);

    // Build weekly array [Mon..Sun] — last 7 days
    const weeklyMap = {};
    weeklyRes.rows.forEach(r => { weeklyMap[r.attendance_date] = parseInt(r.hadir, 10); });
    const weeklyAttendance = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      weeklyAttendance.push(weeklyMap[key] || 0);
    }

    const sub = submissionsRes.rows[0] || {};

    res.json({
      success: true,
      data: {
        totalEmployees:       parseInt(empRes.rows[0]?.total || 0, 10),
        hadirToday:           parseInt(hadirRes.rows[0]?.total || 0, 10),
        pendingApprovals:     parseInt(pendingRes.rows[0]?.total || 0, 10),
        avgAttendancePct:     parseFloat(avgRes.rows[0]?.avg_pct || 0),
        weeklyAttendance,
        divisionBreakdown:    divisionRes.rows.map(r => ({ name: r.name || 'Umum', count: parseInt(r.count, 10) })),
        approvedSubmissions:  parseInt(sub.approved || 0, 10),
        pendingSubmissions:   parseInt(sub.pending  || 0, 10),
        rejectedSubmissions:  parseInt(sub.rejected || 0, 10),
      },
    });
  } catch (err) {
    console.error('[Analytics Summary] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/employees — individual employee metrics for progress chart
app.get('/api/analytics/employees', async (req, res) => {
  const { divisionId } = req.query;
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let whereClause = 'WHERE p.is_active = true';
    const params = [monthStart.toISOString().split('T')[0]];
    if (divisionId) {
      params.push(divisionId);
      whereClause += ` AND p.division_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT
        p.id,
        p.full_name,
        p.nip,
        p.avatar_url,
        d.name as division_name,
        r.label as role_label,
        -- Hadir this month
        COALESCE((
          SELECT COUNT(*)
          FROM hrm_attendances a
          WHERE a.user_id = p.id
            AND a.attendance_date >= $1
            AND a.status IN ('hadir', 'terlambat')
        ), 0) as hadir_count,
        -- Terlambat count
        COALESCE((
          SELECT COUNT(*)
          FROM hrm_attendances a
          WHERE a.user_id = p.id
            AND a.attendance_date >= $1
            AND a.status = 'terlambat'
        ), 0) as terlambat_count,
        -- Lembur hours approved
        COALESCE((
          SELECT SUM(duration_hours)
          FROM hrm_overtime_records o
          WHERE o.user_id = p.id
            AND o.status = 'approved'
            AND DATE_TRUNC('month', o.date) = DATE_TRUNC('month', $1::date)
        ), 0) as lembur_hours,
        -- Cuti used this year
        COALESCE(p.used_leave_days, 0) as used_leave_days,
        COALESCE(p.annual_leave_quota, 12) as annual_leave_quota,
        -- Working days in month (approximate)
        22 as target_days
      FROM hrm_profiles p
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      ${whereClause}
      ORDER BY p.full_name
      LIMIT 80
    `, params);

    // Compute attendance_pct server-side
    const employees = result.rows.map(r => ({
      ...r,
      hadir_count:    parseInt(r.hadir_count, 10),
      terlambat_count:parseInt(r.terlambat_count, 10),
      lembur_hours:   parseFloat(r.lembur_hours),
      used_leave_days:parseInt(r.used_leave_days, 10),
      target_days:    22,
      attendance_pct: Math.round((parseInt(r.hadir_count, 10) / 22) * 100),
    }));

    res.json({ success: true, data: employees });
  } catch (err) {
    console.error('[Analytics Employees] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── KEPALA REGU ASSIGNMENT MANAGEMENT ────────────────────────────────────────

// GET /api/kepala-regu/list — list all kepala_regu users with their assigned employees
app.get('/api/kepala-regu/list', async (req, res) => {
  try {
    const krRes = await pool.query(`
      SELECT p.id, p.full_name, p.nip, p.avatar_url, d.name as division_name, d.id as division_id,
        COALESCE(json_agg(
          json_build_object('id', emp.id, 'fullName', emp.full_name, 'nip', emp.nip, 'divisionName', ed.name)
        ) FILTER (WHERE emp.id IS NOT NULL), '[]') as assigned_employees
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_profiles emp ON emp.kepala_regu_id = p.id
      LEFT JOIN hrm_divisions ed ON emp.division_id = ed.id
      WHERE (LOWER(r.name) = 'kepala_regu' OR LOWER(r.name) = 'kepalaregu') AND p.is_active = true
      GROUP BY p.id, p.full_name, p.nip, p.avatar_url, d.name, d.id
      ORDER BY p.full_name
    `);
    res.json({ success: true, data: krRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/kepala-regu/employees — list all employees with their kepala_regu assignment
app.get('/api/kepala-regu/employees', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.full_name, p.nip, p.avatar_url,
             d.name as division_name, d.id as division_id,
             kr.id as kepala_regu_id, kr.full_name as kepala_regu_name
      FROM hrm_profiles p
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_profiles kr ON p.kepala_regu_id = kr.id
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      WHERE p.is_active = true
        AND (LOWER(r.name) = 'karyawan' OR r.id IS NULL)
      ORDER BY d.name, p.full_name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/kepala-regu/assign — assign / update employee's kepala_regu
app.put('/api/kepala-regu/assign', async (req, res) => {
  const { employeeId, kepalaReguId } = req.body;
  if (!employeeId) return res.status(400).json({ success: false, error: 'employeeId wajib diisi' });
  try {
    await pool.query(
      'UPDATE hrm_profiles SET kepala_regu_id = $1, updated_at = NOW() WHERE id = $2',
      [kepalaReguId || null, employeeId]
    );
    res.json({ success: true, message: 'Penugasan Kepala Regu berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/kepala-regu/bulk-assign — bulk assign division employees to a kepala_regu
app.put('/api/kepala-regu/bulk-assign', async (req, res) => {
  const { kepalaReguId, divisionId } = req.body;
  if (!kepalaReguId || !divisionId) return res.status(400).json({ success: false, error: 'kepalaReguId dan divisionId wajib diisi' });
  try {
    await pool.query(
      `UPDATE hrm_profiles SET kepala_regu_id = $1, updated_at = NOW()
       WHERE division_id = $2`,
      [kepalaReguId, divisionId]
    );
    res.json({ success: true, message: 'Semua karyawan divisi berhasil ditetapkan ke Kepala Regu' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SHIFT SWAP: ALL SUBMISSIONS (for Approval Panel) ─────────────────────────

// GET /api/shift-swaps/all — get all shift swaps for approval (korlap/kepala_regu)
app.get('/api/shift-swaps/all', async (req, res) => {
  const { status, role, userId, divisionId } = req.query;
  try {
    let params = [];
    let whereClauses = [];

    if (status && status !== 'all') {
      params.push(status);
      whereClauses.push(`s.status = $${params.length}`);
    }

    // For kepala_regu — only show swaps from their division
    if (divisionId) {
      params.push(divisionId);
      whereClauses.push(`rp.division_id = $${params.length}`);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await pool.query(`
      SELECT s.*,
        rp.full_name as requester_name, rp.nip as requester_nip,
        rd.name as requester_division, rd.id as requester_division_id,
        sp.full_name as substitute_name, sp.nip as substitute_nip,
        dp.full_name as danru_name,
        dsp.full_name as danru_substitute_name,
        kp.full_name as korlap_name,
        ap.full_name as approver_name
      FROM hrm_shift_swaps s
      LEFT JOIN hrm_profiles rp ON s.requester_id = rp.id
      LEFT JOIN hrm_divisions rd ON rp.division_id = rd.id
      LEFT JOIN hrm_profiles sp ON s.substitute_id = sp.id
      LEFT JOIN hrm_profiles dp ON s.danru_id = dp.id
      LEFT JOIN hrm_profiles dsp ON s.danru_substitute_id = dsp.id
      LEFT JOIN hrm_profiles kp ON s.korlap_id = kp.id
      LEFT JOIN hrm_profiles ap ON s.approved_by = ap.id
      ${whereStr}
      ORDER BY s.created_at DESC
      LIMIT 200
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[ShiftSwap All] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shift-swaps/:id/korlap-approve — Korlap final decision on shift swap
app.put('/api/shift-swaps/:id/korlap-approve', async (req, res) => {
  const { id } = req.params;
  const { korlapId, korlapName, action, substituteId, notes } = req.body;
  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ success: false, error: 'action harus approved atau rejected' });
  }
  try {
    const sRes = await pool.query('SELECT * FROM hrm_shift_swaps WHERE id = $1 LIMIT 1', [id]);
    if (sRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    const swap = sRes.rows[0];

    const finalStatus = action === 'approved' ? 'approved' : 'rejected';
    await pool.query(`
      UPDATE hrm_shift_swaps SET
        status = $1,
        korlap_status = $2,
        korlap_id = $3,
        korlap_notes = $4,
        substitute_id = COALESCE($5, substitute_id),
        approved_by = $3,
        approval_notes = $4,
        updated_at = NOW()
      WHERE id = $6
    `, [finalStatus, action, korlapId || null, notes || null, substituteId || null, id]);

    // Notify requester
    const statusText = action === 'approved' ? 'DISETUJUI' : 'DITOLAK';
    await broadcastNotification({
      targetUserId: swap.requester_id,
      title: `Pengajuan Tukar Shift ${statusText}`,
      message: `Permohonan pengisian pos dinas Anda untuk tanggal ${swap.swap_date} telah ${statusText} oleh Korlap ${korlapName || ''}.${notes ? ' Catatan: ' + notes : ''}`,
      type: action === 'approved' ? 'success' : 'warning',
      metadata: { swapId: id, action },
    });

    res.json({ success: true, message: `Permohonan berhasil ${statusText} oleh Korlap` });
  } catch (err) {
    console.error('[ShiftSwap Korlap] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/shift-swaps/:id/danru-approve — Kepala Regu (Danru) checker action
app.put('/api/shift-swaps/:id/danru-approve', async (req, res) => {
  const { id } = req.params;
  const { danruId, danruName, action, recommendedSubstituteId, notes } = req.body;
  try {
    const sRes = await pool.query('SELECT * FROM hrm_shift_swaps WHERE id = $1 LIMIT 1', [id]);
    if (sRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    const swap = sRes.rows[0];

    await pool.query(`
      UPDATE hrm_shift_swaps SET
        danru_status = $1,
        danru_id = $2,
        danru_notes = $3,
        danru_substitute_id = COALESCE($4, danru_substitute_id),
        status = CASE WHEN $1 = 'rejected' THEN 'rejected' ELSE 'pending_korlap' END,
        updated_at = NOW()
      WHERE id = $5
    `, [action, danruId || null, notes || null, recommendedSubstituteId || null, id]);

    // Notify Korlap for final decision if danru recommends
    if (action !== 'rejected') {
      await broadcastNotification({
        recipientRoles: ['korlap', 'admin', 'superadmin'],
        title: '🔁 Tukar Shift Siap Diputuskan Korlap',
        message: `Kepala Regu ${danruName || ''} telah menelaah permohonan dinas tanggal ${swap.swap_date} dan meneruskan ke Korlap untuk keputusan akhir.`,
        type: 'info',
        link: '/admin/approval?tab=tukar',
        metadata: { swapId: id, danruId, swapDate: swap.swap_date },
      });
    } else {
      // Notify requester of rejection by danru
      await broadcastNotification({
        targetUserId: swap.requester_id,
        title: 'Pengajuan Tukar Shift DITOLAK',
        message: `Permohonan dinas Anda untuk tanggal ${swap.swap_date} ditolak oleh Kepala Regu.${notes ? ' Catatan: ' + notes : ''}`,
        type: 'warning',
        metadata: { swapId: id },
      });
    }

    res.json({ success: true, message: action === 'rejected' ? 'Pengajuan ditolak oleh Danru' : 'Pengajuan diteruskan ke Korlap' });
  } catch (err) {
    console.error('[ShiftSwap Danru] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── EMPLOYEE SELF-PROGRESS API ────────────────────────────────────────────────

// GET /api/analytics/self — Self-progress for individual employee
app.get('/api/analytics/self', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId wajib' });

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const uRes = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const today = new Date().toISOString().split('T')[0];

    const [profileRes, attendanceRes, otRes, leaveRes, weeklyRes] = await Promise.all([
      pool.query('SELECT p.*, d.name as division_name FROM hrm_profiles p LEFT JOIN hrm_divisions d ON p.division_id = d.id WHERE p.id = $1', [validUserId]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('hadir','terlambat')) as hadir_count,
          COUNT(*) FILTER (WHERE status = 'terlambat') as terlambat_count,
          COUNT(*) FILTER (WHERE status = 'alpha') as alpha_count,
          ROUND(COALESCE(AVG(work_duration_minutes) / 60.0, 0)::numeric, 2) as avg_hours_per_day
        FROM hrm_attendances WHERE user_id = $1 AND attendance_date >= $2
      `, [validUserId, monthStartStr]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COALESCE(SUM(duration_hours) FILTER (WHERE status = 'approved'), 0) as total_hours,
          COALESCE(SUM(compensation_amount) FILTER (WHERE status = 'approved'), 0) as total_compensation
        FROM hrm_overtime_records WHERE user_id = $1 AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::date)
      `, [validUserId, monthStartStr]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'approved' AND leave_type = 'cuti_tahunan') as cuti_used,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
        FROM hrm_leave_requests WHERE user_id = $1 AND created_at >= $2
      `, [validUserId, yearStart]),
      // Last 14 days attendance
      pool.query(`
        SELECT attendance_date, status
        FROM hrm_attendances
        WHERE user_id = $1 AND attendance_date >= (CURRENT_DATE - INTERVAL '13 days')
        ORDER BY attendance_date DESC
        LIMIT 14
      `, [validUserId]),
    ]);

    const profile = profileRes.rows[0];
    const att = attendanceRes.rows[0];
    const ot = otRes.rows[0];
    const leave = leaveRes.rows[0];
    const quota = parseInt(profile?.annual_leave_quota || 12, 10);
    const used = parseInt(profile?.used_leave_days || 0, 10);

    const weeklyData = weeklyRes.rows.reduce((acc, r) => {
      let dateStr = '';
      if (r.attendance_date instanceof Date) {
        // Use local or ISO YYYY-MM-DD
        const year = r.attendance_date.getFullYear();
        const month = String(r.attendance_date.getMonth() + 1).padStart(2, '0');
        const day = String(r.attendance_date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof r.attendance_date === 'string') {
        dateStr = r.attendance_date.split('T')[0];
      } else {
        dateStr = String(r.attendance_date);
      }
      acc[dateStr] = r.status;
      return acc;
    }, {});

    const last14Days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      last14Days.push({ date: key, status: weeklyData[key] || 'libur' });
    }

    res.json({
      success: true,
      data: {
        employee: {
          fullName: profile?.full_name,
          nip: profile?.nip,
          divisionName: profile?.division_name,
          avatarUrl: profile?.avatar_url,
        },
        attendance: {
          hadirCount: parseInt(att?.hadir_count || 0, 10),
          terlambatCount: parseInt(att?.terlambat_count || 0, 10),
          alphaCount: parseInt(att?.alpha_count || 0, 10),
          targetDays: 22,
          attendancePct: Math.round((parseInt(att?.hadir_count || 0, 10) / 22) * 100),
          avgHoursPerDay: parseFloat(att?.avg_hours_per_day || 0),
        },
        overtime: {
          approvedCount: parseInt(ot?.approved_count || 0, 10),
          totalHours: parseFloat(ot?.total_hours || 0),
          totalCompensation: parseFloat(ot?.total_compensation || 0),
        },
        leave: {
          annualQuota: quota,
          usedDays: used,
          remainingDays: Math.max(0, quota - used),
          pendingRequests: parseInt(leave?.pending_count || 0, 10),
        },
        last14Days,
      },
    });
  } catch (err) {
    console.error('[Analytics Self] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update /api/analytics/summary to support divisionId scoping for kepala_regu
// Update /api/analytics/employees to support kepalaReguId for Kepala Regu scope
// (These override the previous implementations to add division scope)

// ─── EMPLOYEE SHIFT SCHEDULES API ─────────────────────────────────────────

// GET /api/employee-schedules - Retrieve scheduled shifts with optional filters
app.get('/api/employee-schedules', async (req, res) => {
  const { month, year, divisionId, userId, date } = req.query;
  try {
    let query = `
      SELECT 
        s.id,
        s.user_id as "userId",
        p.full_name as "userName",
        p.nip as "userNip",
        p.division_id as "divisionId",
        p.division_name as "divisionName",
        TO_CHAR(s.schedule_date, 'YYYY-MM-DD') as "scheduleDate",
        s.shift_id as "shiftId",
        s.shift_code as "shiftCode",
        s.shift_name as "shiftName",
        s.start_time as "startTime",
        s.end_time as "endTime",
        s.duration_hours as "durationHours",
        s.is_night_shift as "isNightShift",
        s.is_off as "isOff",
        s.notes,
        s.created_at as "createdAt",
        s.updated_at as "updatedAt"
      FROM hrm_employee_schedules s
      JOIN hrm_profiles p ON s.user_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      query += ` AND s.user_id = $${params.length}`;
    }
    if (divisionId && divisionId !== 'all') {
      params.push(divisionId);
      query += ` AND p.division_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND s.schedule_date = $${params.length}`;
    }
    if (month && year) {
      params.push(Number(month));
      query += ` AND EXTRACT(MONTH FROM s.schedule_date) = $${params.length}`;
      params.push(Number(year));
      query += ` AND EXTRACT(YEAR FROM s.schedule_date) = $${params.length}`;
    }

    query += ` ORDER BY s.schedule_date ASC, p.full_name ASC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Employee Schedules] Error fetching:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employee-schedules/today/:userId - Retrieve today's schedule for specific user
app.get('/api/employee-schedules/today/:userId', async (req, res) => {
  const { userId } = req.params;
  const today = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const query = `
      SELECT 
        s.id,
        s.user_id as "userId",
        p.full_name as "userName",
        p.nip as "userNip",
        TO_CHAR(s.schedule_date, 'YYYY-MM-DD') as "scheduleDate",
        s.shift_id as "shiftId",
        s.shift_code as "shiftCode",
        s.shift_name as "shiftName",
        s.start_time as "startTime",
        s.end_time as "endTime",
        s.duration_hours as "durationHours",
        s.is_night_shift as "isNightShift",
        s.is_off as "isOff",
        s.notes
      FROM hrm_employee_schedules s
      JOIN hrm_profiles p ON s.user_id = p.id
      WHERE s.user_id = $1 AND s.schedule_date = $2
      LIMIT 1
    `;
    const result = await pool.query(query, [userId, today]);
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    console.error('[Employee Schedules Today] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/employee-schedules/batch - Upsert multiple employee schedules
app.post('/api/employee-schedules/batch', async (req, res) => {
  const { schedules } = req.body;
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({ success: false, error: 'Daftar jadwal wajib disertakan' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let upsertedCount = 0;

    for (const item of schedules) {
      if (!item.userId || !item.scheduleDate) continue;
      await client.query(`
        INSERT INTO hrm_employee_schedules (
          user_id,
          schedule_date,
          shift_id,
          shift_code,
          shift_name,
          start_time,
          end_time,
          duration_hours,
          is_night_shift,
          is_off,
          notes,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (user_id, schedule_date) 
        DO UPDATE SET
          shift_id = EXCLUDED.shift_id,
          shift_code = EXCLUDED.shift_code,
          shift_name = EXCLUDED.shift_name,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          duration_hours = EXCLUDED.duration_hours,
          is_night_shift = EXCLUDED.is_night_shift,
          is_off = EXCLUDED.is_off,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `, [
        item.userId,
        item.scheduleDate,
        item.shiftId || null,
        item.shiftCode || 'OFF',
        item.shiftName || (item.shiftCode === 'OFF' ? 'Libur / Off' : `Shift ${item.shiftCode}`),
        item.startTime || (item.shiftCode === 'M' ? '22:30' : item.shiftCode === 'S' ? '15:30' : '07:30'),
        item.endTime || (item.shiftCode === 'M' ? '07:30' : item.shiftCode === 'S' ? '22:30' : '16:30'),
        item.durationHours ?? (item.shiftCode === 'OFF' ? 0 : item.shiftCode === 'M' ? 9 : item.shiftCode === 'S' ? 7 : 8),
        Boolean(item.isNightShift || item.shiftCode === 'M'),
        Boolean(item.isOff || item.shiftCode === 'OFF'),
        item.notes || 'Disusun via Smart Roster Scheduler'
      ]);
      upsertedCount++;
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      count: upsertedCount,
      message: `Berhasil menyimpan ${upsertedCount} jadwal shift ke database PostgreSQL`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Employee Schedules Batch] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Start Server
async function start() {
  try {
    await initDb();
    await seedInitialUsers();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[HRM-Backend] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[HRM-Backend] Startup fatal error:', err);
    process.exit(1);
  }
}

start();
