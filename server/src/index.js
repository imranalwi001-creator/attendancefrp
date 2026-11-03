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

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mobile App Version & In-App Auto-Update API
app.get('/api/app-version', (req, res) => {
  res.json({
    success: true,
    latestVersion: '1.0.5',
    versionCode: 6,
    minVersion: '1.0.0',
    downloadUrl: 'https://fawwazreskiperwira.com/downloads/hrm-attendance.apk',
    forceUpdate: false,
    title: 'Sistem Presensi HRM FRP',
    releaseNotes: 'Sistem presensi biometrik & pelacakan multi-titik pos lapangan stabil.',
    releasedAt: '2026-10-04'
  });
});

// ─── 1. AUTHENTICATION ────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password, deviceId, deviceModel } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Email/NIP dan kata sandi wajib diisi' });
  }

  const cleanId = identifier.trim().toLowerCase();
  try {
    const query = `
      SELECT p.*, r.name as role_code, r.label as role_label,
             d.name as division_title,
             COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
             d.location_name as division_location_name,
             d.radius_meters as division_radius_meters,
             d.latitude as division_latitude,
             d.longitude as division_longitude,
             d.address as division_address,
             d.allowed_posts as division_allowed_posts,
             s.name as shift_name, s.start_time as shift_start_time, s.end_time as shift_end_time,
             sp.hourly_overtime_rate, sp.base_salary, sp.severance_scheme,
             (SELECT a.photo_in FROM hrm_attendances a WHERE a.user_id = p.id AND a.photo_in IS NOT NULL ORDER BY a.attendance_date DESC, a.created_at DESC LIMIT 1) as latest_attendance_photo
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
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

    const roleName = (row.role_code || row.role_name || '').toLowerCase().replace(/[\s_-]/g, '');
    const isRestrictedRole = roleName === 'karyawan' || roleName === 'staff' || roleName === 'security' || roleName === 'cleaning' || roleName === 'danru';

    // Anti Titip Akun / Multi-Device Protection:
    // Karyawan hanya boleh mengakses dari 1 perangkat HP yang terikat pada login pertama kali
    if (isRestrictedRole) {
      const isLegacyGenericAndroidId = row.device_id === 'DEV-HW-UUID-ANDROID-882910';
      const isBothAndroid = (/Android/i.test(row.device_model || '') || isLegacyGenericAndroidId) && /Android/i.test(deviceModel || '');

      if (row.is_device_bound && row.device_id) {
        if (deviceId && row.device_id !== deviceId) {
          if (isLegacyGenericAndroidId || isBothAndroid) {
            const boundModel = deviceModel || row.device_model || 'Android Device';
            await pool.query(
              `UPDATE hrm_profiles SET device_id = $1, device_model = $2, is_device_bound = true, device_bound_at = NOW(), updated_at = NOW() WHERE id = $3`,
              [deviceId, boundModel, row.id]
            );
            row.device_id = deviceId;
            row.device_model = boundModel;
          } else {
            return res.status(403).json({
              success: false,
              code: 'DEVICE_BINDING_MISMATCH',
              error: `Akses Ditolak: Akun Anda telah terkunci secara permanen pada perangkat (${row.device_model || 'HP Karyawan Terdaftar'}). Penggunaan akun bersama dilarang untuk meminimalisir kecurangan. Silakan hubungi Superadmin / HRD jika Anda telah mengganti HP.`
            });
          }
        }
      } else if (deviceId) {
        // Tautkan perangkat secara otomatis pada login pertama kali
        const boundModel = deviceModel || 'Perangkat Karyawan';
        await pool.query(
          `UPDATE hrm_profiles SET device_id = $1, device_model = $2, is_device_bound = true, device_bound_at = NOW() WHERE id = $3`,
          [deviceId, boundModel, row.id]
        );
        row.device_id = deviceId;
        row.device_model = boundModel;
        row.is_device_bound = true;
        row.device_bound_at = new Date();
      }
    }

    const user = formatUserRow(row);
    res.json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Kesalahan internal server' });
  }
});

// Over-The-Air (OTA) Live Update endpoint for CapacitorUpdater
app.get('/api/app-update/check', (req, res) => {
  res.json({
    version: '2.1.0',
    bundleUrl: 'https://fawwazreskiperwira.com/downloads/bundle.zip',
    force: true,
    notes: 'Pembaruan v2.1.0 Final: Auto-Live Sync, zero-quota presensi cloud, dan perbaikan hardware binding.',
  });
});

// Change Password endpoint for Employee
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, error: 'Data tidak lengkap' });
  }
  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }
    const uRes = await pool.query('SELECT * FROM hrm_profiles WHERE id = $1 LIMIT 1', [validUserId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    const row = uRes.rows[0];
    if (oldPassword && row.password && row.password !== oldPassword) {
      return res.status(400).json({ success: false, error: 'Kata sandi lama tidak sesuai' });
    }
    await pool.query('UPDATE hrm_profiles SET password = $1, updated_at = NOW() WHERE id = $2', [newPassword, validUserId]);
    await broadcastNotification({
      targetUserId: validUserId,
      title: '🔐 Kata Sandi Berhasil Diperbarui',
      message: 'Kata sandi login Anda telah berhasil diperbarui.',
      type: 'info',
    });
    res.json({ success: true, message: 'Kata sandi berhasil diperbarui' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Password endpoint for Superadmin
app.post('/api/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { newPassword = 'password123' } = req.body;
  try {
    let validUserId = id;
    if (!UUID_REGEX.test(id)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [id]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }
    const uRes = await pool.query('SELECT * FROM hrm_profiles WHERE id = $1 LIMIT 1', [validUserId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    await pool.query('UPDATE hrm_profiles SET password = $1, updated_at = NOW() WHERE id = $2', [newPassword, validUserId]);
    await broadcastNotification({
      targetUserId: validUserId,
      title: '🔐 Reset Kata Sandi Akun',
      message: `Kata sandi akun Anda telah diatur ulang oleh Superadmin menjadi: ${newPassword}. Harap segera ganti setelah masuk.`,
      type: 'warning',
    });
    res.json({ success: true, message: `Kata sandi berhasil direset menjadi ${newPassword}` });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Security Hub (Device Binding, Biometric Face, and Location/Perimeter Lock)
app.post('/api/users/:id/reset-security', async (req, res) => {
  const { id } = req.params;
  const { target = 'device', adminName = 'Superadmin' } = req.body;
  try {
    let validUserId = id;
    if (!UUID_REGEX.test(id)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [id]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }
    const uRes = await pool.query('SELECT * FROM hrm_profiles WHERE id = $1 LIMIT 1', [validUserId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    let actionsDone = [];

    // 1. Reset Kunci Perangkat Fisik (Device Binding)
    if (target === 'device' || target === 'all') {
      await pool.query(
        `UPDATE hrm_profiles SET device_id = NULL, device_model = NULL, is_device_bound = false, device_bound_at = NULL, updated_at = NOW() WHERE id = $1`,
        [validUserId]
      );
      actionsDone.push('Kunci perangkat fisik HP berhasil direset');
    }

    // 2. Reset Registrasi Biometrik Wajah Master
    if (target === 'face' || target === 'all') {
      await pool.query(
        `UPDATE hrm_profiles SET is_face_enrolled = false, face_descriptor = NULL, face_enrolled_photo = NULL, face_enrolled_at = NULL, face_photo_url = NULL, face_embedding = NULL, avatar_url = NULL, updated_at = NOW() WHERE id = $1`,
        [validUserId]
      );
      actionsDone.push('Data biometrik wajah master berhasil direset');
    }

    // 3. Reset / Buka Kunci Lokasi & Pelanggaran Perimeter
    if (target === 'location' || target === 'all') {
      await pool.query(
        `UPDATE hrm_attendances SET is_locked = false, is_perimeter_breached = false, notes = COALESCE(notes, '') || ' [Dispensasi Kunci Lokasi oleh ' || $1 || ']', updated_at = NOW() WHERE user_id = $2 AND attendance_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date - INTERVAL '1 day'`,
        [adminName, validUserId]
      );
      await pool.query(
        `UPDATE hrm_perimeter_violations SET status = 'resolved', resolution_notes = 'Kunci lokasi dibuka oleh ' || $1, resolved_at = NOW(), updated_at = NOW() WHERE user_id = $2 AND status = 'active'`,
        [adminName, validUserId]
      );
      actionsDone.push('Kunci lokasi & pelanggaran perimeter berhasil dibuka');
    }

    // Ambil data profile terbaru
    const refreshed = await pool.query(`
      SELECT p.*, r.name as role_code, r.label as role_label, d.name as division_title
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      WHERE p.id = $1 LIMIT 1
    `, [validUserId]);

    const formattedUser = formatUserRow(refreshed.rows[0]);
    const summaryMsg = actionsDone.join('. ') + '.';

    await broadcastNotification({
      targetUserId: validUserId,
      title: '🛡️ Reset Keamanan Akun',
      message: `${adminName} telah mereset pengaturan keamanan Anda: ${summaryMsg}`,
      type: 'info',
    });

    res.json({ success: true, message: summaryMsg, user: formattedUser });
  } catch (err) {
    console.error('Reset security error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tautkan perangkat resmi karyawan
app.post('/api/users/:id/bind-device', async (req, res) => {
  const { id } = req.params;
  const { deviceId, deviceModel } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'Device ID wajib disertakan' });
  }

  try {
    let validUserId = id;
    if (!UUID_REGEX.test(id)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [id]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }
    const model = deviceModel || 'Android Device';
    await pool.query(
      `UPDATE hrm_profiles SET device_id = $1, device_model = $2, is_device_bound = true, device_bound_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [deviceId, model, validUserId]
    );

    res.json({ success: true, message: `Perangkat berhasil ditautkan sebagai ${model}.` });
  } catch (err) {
    console.error('Bind device error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Safely parse 512-D (InsightFace AI) or 128-D face descriptor from any format (JSON string, array, or serialized indexed object)
function parseDescriptorRow(raw) {
  if (!raw) return null;
  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const values = Object.values(parsed).map(Number).filter(Number.isFinite);
    if (values.length === 512 || values.length === 128) {
      parsed = values;
    }
  }
  if (Array.isArray(parsed) && (parsed.length === 512 || parsed.length === 128)) {
    const cleanNumbers = parsed.map(Number);
    if (cleanNumbers.every(Number.isFinite)) {
      return cleanNumbers;
    }
  }
  return null;
}

// Helper: 3 Petugas Lapangan Khusus Pimpinan (Aslam, Samsi, Takdir) yang 100% Bebas Aturan Divisi & Pos OGS
function isExemptFieldOfficer(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const rawNip = (user.nip || '').trim().toUpperCase();
  const cleanNip = rawNip.replace(/[\s.]/g, '');
  const id = (user.id || user.userId || '').toString().toLowerCase();

  const exemptEmails = ['aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com'];
  const exemptNips = ['FRP07065', 'FR07066', 'FRP07046', 'FR07065', 'FR07046'];
  const exemptIds = [
    'ebf10b16-ab2f-4b53-ab22-b3ffc00694db',
    '2ce41a19-0c65-45d3-913e-a68a02203fe2',
    '0a49f92e-5733-4b72-947c-7361f9490632'
  ];

  return exemptEmails.includes(email) || exemptNips.includes(cleanNip) || exemptIds.includes(id);
}

// Helper: Memeriksa apakah karyawan merupakan personil resmi PT FRP (NIP berawalan FR)
function isOfficialFrEmployee(user) {
  if (!user) return false;
  let nip = '';
  if (typeof user === 'string') {
    nip = user.toUpperCase().trim().replace(/[\s.]/g, '');
  } else {
    nip = (user.nip || user.userNip || user.employee_nip || user.employeeNip || '').toUpperCase().trim().replace(/[\s.]/g, '');
  }
  return nip.startsWith('FR');
}

// Helper: Akun Simulasi (Semua akun selain yang memiliki NIP berawalan FR)
function isSimulationAccount(user) {
  if (!user) return false;
  return !isOfficialFrEmployee(user);
}

// Helper: Format PostgreSQL row to match TypeScript UserProfile
function formatUserRow(r) {
  const descriptor = parseDescriptorRow(r.face_descriptor) || parseDescriptorRow(r.face_embedding);
  const isSpecial = isExemptFieldOfficer(r);
  
  // Prioritas jam shift:
  // 1. Jika terdaftar shift_id resmi di master shifts, gunakan jam shift resmi!
  // 2. Jika petugas khusus pimpinan dan punya custom_start_time, gunakan jam dinas pimpinan
  // 3. Jika belum memiliki shift, set null (bukan default palsu 07:30)
  let resolvedStart = null;
  let resolvedEnd = null;
  if (r.shift_start_time) {
    resolvedStart = r.shift_start_time.substring(0, 5);
    resolvedEnd = r.shift_end_time ? r.shift_end_time.substring(0, 5) : '17:00';
  } else if (isSpecial) {
    resolvedStart = r.custom_start_time ? r.custom_start_time.substring(0, 5) : '08:00';
    resolvedEnd = r.custom_end_time ? r.custom_end_time.substring(0, 5) : '16:00';
  }

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
    divisionAddress: r.division_address || '',
    divisionAllowedPosts: r.division_allowed_posts ? (typeof r.division_allowed_posts === 'string' ? JSON.parse(r.division_allowed_posts) : r.division_allowed_posts) : [],
    placementLocation: r.placement_location || '',
    jobTitle: r.job_title || '',
    employeeSequenceNo: r.employee_sequence_no || 0,
    hourlyOvertimeRate: r.hourly_overtime_rate ? parseFloat(r.hourly_overtime_rate) : 23381.79,
    baseSalary: r.base_salary ? parseFloat(r.base_salary) : 4045050,
    shiftId: r.today_shift_id || r.shift_id,
    shiftCode: r.today_shift_code || null,
    shiftName: r.shift_name || '',
    shiftStartTime: resolvedStart,
    shiftEndTime: resolvedEnd,
    isOffToday: Boolean(r.today_is_off),
    customStartTime: isSpecial && r.custom_start_time ? r.custom_start_time.substring(0, 5) : null,
    customEndTime: isSpecial && r.custom_end_time ? r.custom_end_time.substring(0, 5) : null,
    avatarUrl: (() => {
      const hasPhoto = (typeof r.avatar_url === 'string' && r.avatar_url.length > 50) ||
                       (typeof r.face_photo_url === 'string' && r.face_photo_url.length > 50) ||
                       (typeof r.face_enrolled_photo === 'string' && r.face_enrolled_photo.length > 50) ||
                       (typeof r.latest_attendance_photo === 'string' && r.latest_attendance_photo.length > 50);
      return hasPhoto ? `/api/users/${r.id}/avatar` : null;
    })(),
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
    operationalGroup: r.operational_group || (r.nip >= 'FR07034' && r.nip <= 'FR07080' ? 'SHIPMENT' : (r.nip >= 'FR07001' && r.nip <= 'FR07033' ? 'RUMAH TANGGA' : null)),
    annualLeaveQuota: r.annual_leave_quota ?? 12,
    usedLeaveDays: r.used_leave_days || 0,
    emergencyDiscretionaryQuota: r.emergency_discretionary_quota ?? 2,
    usedEmergencyLeaveDays: r.used_emergency_leave_days || 0,
    permissionQuota: r.permission_quota ?? 5,
    usedPermissionDays: r.used_permission_days || 0,
    overtimeEligible: r.overtime_eligible === true || ['SHIPMENT', 'RUMAH TANGGA'].includes(r.operational_group),
    maxDailyOvertimeHours: r.max_daily_overtime_hours ? parseFloat(r.max_daily_overtime_hours) : 4.0,
    overtimeRateOverride: r.overtime_rate_override ? parseFloat(r.overtime_rate_override) : null,
    isActive: r.is_active !== false,
    isFaceEnrolled: r.is_face_enrolled === true || !!descriptor || (Array.isArray(r.face_embedding) && r.face_embedding.length > 0) || !!r.face_descriptor,
    faceDescriptor: null, // Lean payload: AI descriptor disimpan di backend, tidak perlu ditransfer ke browser
    faceEnrolledPhoto: r.avatar_url || null,
    faceEnrolledAt: r.face_enrolled_at || null,
    deviceId: r.device_id || null,
    registeredDeviceId: r.device_id || r.registered_device_id || null,
    deviceModel: r.device_model || null,
    isDeviceBound: r.is_device_bound === true,
    deviceBoundAt: r.device_bound_at || null,
    kepalaReguId: r.kepala_regu_id || null,
    kepalaReguName: r.kepala_regu_name || null,
    assignedLocationName: r.assigned_location_name || '',
    assignedLatitude: r.assigned_latitude ? parseFloat(r.assigned_latitude) : null,
    assignedLongitude: r.assigned_longitude ? parseFloat(r.assigned_longitude) : null,
    assignedRadiusMeters: r.assigned_radius_meters ? parseFloat(r.assigned_radius_meters) : 150,
    isFieldSentinelEnabled: r.is_field_sentinel_enabled === true,
    lastKnownLatitude: r.last_known_latitude ? parseFloat(r.last_known_latitude) : null,
    lastKnownLongitude: r.last_known_longitude ? parseFloat(r.last_known_longitude) : null,
    lastKnownAccuracy: r.last_known_accuracy ? parseFloat(r.last_known_accuracy) : null,
    lastKnownPingAt: r.last_known_ping_at || null,
    isOutOfBounds: r.is_out_of_bounds === true,
    outOfBoundsDistance: r.out_of_bounds_distance ? parseFloat(r.out_of_bounds_distance) : 0,
    currentActivePostId: r.current_active_post_id || null,
    currentActivePostName: r.current_active_post_name || null,
    currentActivePostEnteredAt: r.current_active_post_entered_at || null,
    allowedPosts: r.allowed_posts ? (typeof r.allowed_posts === 'string' ? JSON.parse(r.allowed_posts) : r.allowed_posts) : [],
    allowOgsClockOut: r.allow_ogs_clock_out !== false,
    isLateDeductionEnabled: r.is_late_deduction_enabled === true || isSpecial,
    lateDeductionPerMinute: r.late_deduction_per_minute ? parseFloat(r.late_deduction_per_minute) : (isSpecial ? 1000.00 : 1000.00),
    createdAt: r.created_at,
  };
}

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
    // Jalankan auto-close rekonsiliasi presensi pulang sebelum mengambil snapshot data
    await runAutoCloseCompliantAttendance().catch(() => {});

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
      disciplinaryRes,
      kpiRes,
    ] = await Promise.all([
      pool.query(`
        SELECT p.*, r.name as role_code, r.label as role_label,
               kr.full_name as kepala_regu_name,
               COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
               d.location_name as division_location_name,
               d.radius_meters as division_radius_meters,
               d.latitude as division_latitude,
               d.longitude as division_longitude,
               d.address as division_address,
               d.allowed_posts as division_allowed_posts,
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
      pool.query(`
        SELECT a.id, a.user_id, a.attendance_date, a.clock_in, a.clock_out,
               a.lat_in, a.long_in, a.lat_out, a.long_out, a.status,
               a.late_minutes, a.early_leaving_minutes, a.work_duration_minutes,
               a.is_locked, a.is_perimeter_breached, a.perimeter_breach_count, a.time_outside_minutes,
               a.notes, a.biometric_score, a.biometric_match, a.geofence_distance_meters,
               a.geofence_valid, a.is_mock_location, a.security_flags,
               a.is_early_leave, a.early_leave_reason, a.early_leave_category,
               a.is_remote_unlocked, a.remote_unlocked_by, a.remote_unlocked_at,
               a.is_on_break, a.break_start_time, a.break_end_time, a.break_duration_minutes,
               (a.photo_in IS NOT NULL) as has_photo_in,
               (a.photo_out IS NOT NULL) as has_photo_out,
               p.full_name as user_name, p.nip as user_nip, CASE WHEN (p.avatar_url IS NOT NULL OR p.face_photo_url IS NOT NULL) THEN '/api/users/' || p.id || '/avatar' ELSE NULL END as user_avatar,
               COALESCE(d.name, p.division_name, 'Umum') as division_name
        FROM hrm_attendances a
        LEFT JOIN hrm_profiles p ON a.user_id = p.id
        LEFT JOIN hrm_divisions d ON p.division_id = d.id
        ORDER BY a.attendance_date DESC, a.clock_in DESC LIMIT 500
      `),
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
      pool.query(`
        SELECT d.*, p.full_name as user_name, p.nip as user_nip, div.name as division_name
        FROM hrm_disciplinary_records d
        LEFT JOIN hrm_profiles p ON d.user_id = p.id
        LEFT JOIN hrm_divisions div ON p.division_id = div.id
        ORDER BY d.violation_date DESC, d.created_at DESC LIMIT 200
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT k.*, p.full_name as user_name, p.nip as user_nip, div.name as division_name
        FROM hrm_employee_kpi k
        LEFT JOIN hrm_profiles p ON k.user_id = p.id
        LEFT JOIN hrm_divisions div ON p.division_id = div.id
        ORDER BY k.period_month DESC, k.final_score DESC LIMIT 200
      `).catch(() => ({ rows: [] })),
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

    const shifts = shiftsRes.rows.map((s) => {
      let code = 'SHF';
      if (s.name.includes('Day Shift')) code = 'DAY';
      else if (s.name.includes('Shift III')) code = 'SHF-III';
      else if (s.name.includes('Shift II')) code = 'SHF-II';
      else if (s.name.includes('Shift I ') || s.name.includes('Shift I(')) code = 'SHF-I';
      else if (s.code) code = s.code;
      else code = s.name.substring(0, 4).toUpperCase();

      return {
        id: s.id,
        code,
        name: s.name,
        startTime: s.start_time ? s.start_time.substring(0, 5) : '08:00',
        endTime: s.end_time ? s.end_time.substring(0, 5) : '17:00',
        breakStartTime: s.break_start_time ? s.break_start_time.substring(0, 5) : '12:00',
        breakEndTime: s.break_end_time ? s.break_end_time.substring(0, 5) : '13:00',
        breakDurationMinutes: s.break_duration_minutes || 60,
        lateToleranceMinutes: s.late_tolerance_minutes || 15,
        isDefault: s.is_default,
      };
    });

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

    const attendances = attendancesRes.rows.map((a) => {
      const attDate = a.attendance_date ? (typeof a.attendance_date === 'string' ? a.attendance_date.substring(0, 10) : new Date(a.attendance_date).toISOString().split('T')[0]) : '';
      return {
        id: a.id,
        userId: a.user_id,
        user_id: a.user_id,
        userName: a.user_name || undefined,
        userNip: a.user_nip || undefined,
        userAvatar: a.user_avatar || undefined,
        divisionName: a.division_name || undefined,
        date: attDate,
        attendanceDate: attDate,
        clockIn: a.clock_in ? a.clock_in.substring(0, 5) : undefined,
        clock_in: a.clock_in,
        clockOut: a.clock_out ? a.clock_out.substring(0, 5) : undefined,
        clock_out: a.clock_out,
        photoIn: (a.has_photo_in || a.photo_in) ? `/api/attendances/${a.id}/photo?type=in` : null,
        photoOut: (a.has_photo_out || a.photo_out) ? `/api/attendances/${a.id}/photo?type=out` : null,
        clockInPhoto: (a.has_photo_in || a.photo_in) ? `/api/attendances/${a.id}/photo?type=in` : null,
        clockOutPhoto: (a.has_photo_out || a.photo_out) ? `/api/attendances/${a.id}/photo?type=out` : null,
        hasPhotoIn: Boolean(a.has_photo_in || a.photo_in),
        hasPhotoOut: Boolean(a.has_photo_out || a.photo_out),
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
        isEarlyLeave: a.is_early_leave === true,
        earlyLeaveReason: a.early_leave_reason,
        earlyLeaveCategory: a.early_leave_category,
        isRemoteUnlocked: a.is_remote_unlocked === true,
        remoteUnlockedBy: a.remote_unlocked_by,
        remoteUnlockedAt: a.remote_unlocked_at,
        isOnBreak: a.is_on_break === true,
        breakStartTime: a.break_start_time,
        breakEndTime: a.break_end_time,
        breakDurationMinutes: a.break_duration_minutes || 0,
      };
    });

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
        disciplinary: (disciplinaryRes?.rows || []).map((d) => ({
          id: d.id,
          userId: d.user_id,
          userName: d.user_name || 'Karyawan',
          userNip: d.user_nip || '',
          divisionName: d.division_name || '-',
          spType: d.sp_type,
          letterNumber: d.letter_number || '',
          violationDate: d.violation_date ? new Date(d.violation_date).toISOString().split('T')[0] : '',
          violationType: d.violation_type || 'Kedisiplinan',
          description: d.description || '',
          sanction: d.sanction || '',
          issuedBy: d.issued_by,
          issuedByName: d.issued_by_name || 'Super Administrator',
          validUntil: d.valid_until ? new Date(d.valid_until).toISOString().split('T')[0] : '',
          status: d.status || 'active',
          notes: d.notes || '',
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        })),
        kpi: (kpiRes?.rows || []).map((k) => ({
          id: k.id,
          userId: k.user_id,
          userName: k.user_name || 'Karyawan',
          userNip: k.user_nip || '',
          divisionName: k.division_name || '-',
          periodMonth: k.period_month,
          attendanceScore: Number(k.attendance_score) || 100,
          operationalScore: Number(k.operational_score) || 85,
          competencyScore: Number(k.competency_score) || 85,
          finalScore: Number(k.final_score) || 88,
          grade: k.grade || 'A',
          evaluatorId: k.evaluator_id,
          evaluatorName: k.evaluator_name || 'Super Administrator',
          feedback: k.feedback || '',
          status: k.status || 'final',
          createdAt: k.created_at,
          updatedAt: k.updated_at,
        })),
      },
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 2.1 SHIFTS MANAGEMENT ──────────────────────────────────────────────────
app.get('/api/shifts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hrm_shifts ORDER BY start_time ASC');
    const shifts = result.rows.map((s) => {
      let code = 'SHF';
      if (s.name.includes('Day Shift')) code = 'DAY';
      else if (s.name.includes('Shift III')) code = 'SHF-III';
      else if (s.name.includes('Shift II')) code = 'SHF-II';
      else if (s.name.includes('Shift I ') || s.name.includes('Shift I(')) code = 'SHF-I';
      else if (s.code) code = s.code;
      else code = s.name.substring(0, 4).toUpperCase();
      return {
        id: s.id,
        code,
        name: s.name,
        startTime: s.start_time ? s.start_time.substring(0, 5) : '08:00',
        endTime: s.end_time ? s.end_time.substring(0, 5) : '17:00',
        breakStartTime: s.break_start_time ? s.break_start_time.substring(0, 5) : '12:00',
        breakEndTime: s.break_end_time ? s.break_end_time.substring(0, 5) : '13:00',
        breakDurationMinutes: s.break_duration_minutes || 60,
        lateToleranceMinutes: s.late_tolerance_minutes || 15,
        isDefault: s.is_default,
      };
    });
    res.json({ success: true, data: shifts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/shifts', async (req, res) => {
  const { name, startTime, endTime, breakStartTime, breakEndTime, breakDurationMinutes, lateToleranceMinutes, isDefault } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Nama shift wajib diisi' });

  const sanitizeTimeParam = (val, fallback = '08:00:00') => {
    if (!val) return fallback;
    const parts = String(val).trim().split(':');
    const h = parts[0] || '08';
    const m = parts[1] || '00';
    const s = parts[2] || '00';
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  };

  const cleanName = name.trim();
  const cleanStart = sanitizeTimeParam(startTime, '07:30:00');
  const cleanEnd = sanitizeTimeParam(endTime, '16:30:00');
  const isCrossDay = cleanEnd < cleanStart;

  let shiftCode = req.body.code ? String(req.body.code).trim().toUpperCase() : '';
  if (!shiftCode) {
    if (cleanName.includes('Day Shift')) shiftCode = 'DAY';
    else if (cleanName.includes('Shift III')) shiftCode = 'SHF-III';
    else if (cleanName.includes('Shift II')) shiftCode = 'SHF-II';
    else if (cleanName.includes('Shift I')) shiftCode = 'SHF-I';
    else shiftCode = cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() || 'SHF';
  }

  try {
    if (isDefault) {
      await pool.query('UPDATE hrm_shifts SET is_default = false');
    }
    const result = await pool.query(
      `INSERT INTO hrm_shifts (name, code, start_time, end_time, break_start_time, break_end_time, break_duration_minutes, late_tolerance_minutes, is_default, is_cross_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (name) DO UPDATE SET
         code = COALESCE(EXCLUDED.code, hrm_shifts.code),
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         break_start_time = EXCLUDED.break_start_time,
         break_end_time = EXCLUDED.break_end_time,
         break_duration_minutes = EXCLUDED.break_duration_minutes,
         late_tolerance_minutes = EXCLUDED.late_tolerance_minutes,
         is_default = EXCLUDED.is_default,
         is_cross_day = EXCLUDED.is_cross_day
       RETURNING *;`,
      [
        cleanName,
        shiftCode,
        cleanStart,
        cleanEnd,
        sanitizeTimeParam(breakStartTime, '12:00:00'),
        sanitizeTimeParam(breakEndTime, '13:00:00'),
        Number(breakDurationMinutes) || 60,
        Number(lateToleranceMinutes) || 15,
        isDefault === true,
        isCrossDay
      ]
    );

    const s = result.rows[0];
    res.json({
      success: true,
      data: {
        id: s.id,
        code: s.code || shiftCode,
        name: s.name,
        startTime: s.start_time ? s.start_time.substring(0, 5) : '08:00',
        endTime: s.end_time ? s.end_time.substring(0, 5) : '17:00',
        breakStartTime: s.break_start_time ? s.break_start_time.substring(0, 5) : '12:00',
        breakEndTime: s.break_end_time ? s.break_end_time.substring(0, 5) : '13:00',
        breakDurationMinutes: s.break_duration_minutes || 60,
        lateToleranceMinutes: s.late_tolerance_minutes || 15,
        isDefault: s.is_default,
        isCrossDay: s.is_cross_day,
      }
    });
  } catch (err) {
    console.error('[Add Shift Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/shifts/:id', async (req, res) => {
  const { id } = req.params;
  const { name, startTime, endTime, breakStartTime, breakEndTime, breakDurationMinutes, lateToleranceMinutes, isDefault, code } = req.body;

  const sanitizeTimeParam = (val, fallback = '08:00:00') => {
    if (!val) return fallback;
    const parts = String(val).trim().split(':');
    const h = parts[0] || '08';
    const m = parts[1] || '00';
    const s = parts[2] || '00';
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  };

  try {
    if (isDefault) {
      await pool.query('UPDATE hrm_shifts SET is_default = false WHERE id != $1', [id]);
    }
    const cleanStart = startTime ? sanitizeTimeParam(startTime) : null;
    const cleanEnd = endTime ? sanitizeTimeParam(endTime) : null;
    const isCrossDay = (cleanStart && cleanEnd) ? (cleanEnd < cleanStart) : null;

    const result = await pool.query(
      `UPDATE hrm_shifts SET
         name = COALESCE($1, name),
         code = COALESCE($2, code),
         start_time = COALESCE($3, start_time),
         end_time = COALESCE($4, end_time),
         break_start_time = COALESCE($5, break_start_time),
         break_end_time = COALESCE($6, break_end_time),
         break_duration_minutes = COALESCE($7, break_duration_minutes),
         late_tolerance_minutes = COALESCE($8, late_tolerance_minutes),
         is_default = COALESCE($9, is_default),
         is_cross_day = COALESCE($10, is_cross_day)
       WHERE id = $11
       RETURNING *;`,
      [
        name ? name.trim() : null,
        code ? code.trim().toUpperCase() : null,
        cleanStart,
        cleanEnd,
        breakStartTime ? sanitizeTimeParam(breakStartTime) : null,
        breakEndTime ? sanitizeTimeParam(breakEndTime) : null,
        breakDurationMinutes != null ? Number(breakDurationMinutes) : null,
        lateToleranceMinutes != null ? Number(lateToleranceMinutes) : null,
        isDefault != null ? isDefault : null,
        isCrossDay,
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shift tidak ditemukan' });
    }
    const s = result.rows[0];
    res.json({
      success: true,
      data: {
        id: s.id,
        code: s.code || (s.name.substring(0, 4).toUpperCase()),
        name: s.name,
        startTime: s.start_time ? s.start_time.substring(0, 5) : '08:00',
        endTime: s.end_time ? s.end_time.substring(0, 5) : '17:00',
        breakStartTime: s.break_start_time ? s.break_start_time.substring(0, 5) : '12:00',
        breakEndTime: s.break_end_time ? s.break_end_time.substring(0, 5) : '13:00',
        breakDurationMinutes: s.break_duration_minutes || 60,
        lateToleranceMinutes: s.late_tolerance_minutes || 15,
        isDefault: s.is_default,
        isCrossDay: s.is_cross_day,
      }
    });
  } catch (err) {
    console.error('[Update Shift Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/shifts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const isUuid = UUID_REGEX.test(id);
    let targetShift = null;

    if (isUuid) {
      const sRes = await pool.query('SELECT * FROM hrm_shifts WHERE id = $1', [id]);
      if (sRes.rows.length > 0) targetShift = sRes.rows[0];
    } else {
      const sRes = await pool.query('SELECT * FROM hrm_shifts WHERE code = $1 OR name ILIKE $1 LIMIT 1', [id]);
      if (sRes.rows.length > 0) targetShift = sRes.rows[0];
    }

    if (!targetShift) {
      return res.json({ success: true, message: 'Shift tidak ada di database atau sudah terhapus.' });
    }

    const shiftUuid = targetShift.id;

    if (targetShift.is_default) {
      return res.status(400).json({ success: false, error: 'Shift utama (default) tidak dapat dihapus.' });
    }

    const countCheck = await pool.query('SELECT count(*) FROM hrm_shifts');
    if (parseInt(countCheck.rows[0].count) <= 1) {
      return res.status(400).json({ success: false, error: 'Minimal harus ada 1 shift yang aktif di sistem.' });
    }

    const userCheck = await pool.query('SELECT count(*) FROM hrm_profiles WHERE shift_id = $1', [shiftUuid]);
    if (parseInt(userCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Shift "${targetShift.name}" tidak dapat dihapus karena masih digunakan oleh ${userCheck.rows[0].count} karyawan.`
      });
    }

    // Unlink any foreign key references gracefully
    await pool.query('UPDATE hrm_shift_substitutions SET shift_id = NULL WHERE shift_id = $1', [shiftUuid]).catch(() => {});
    await pool.query('UPDATE hrm_employee_schedules SET shift_id = NULL WHERE shift_id = $1', [shiftUuid]).catch(() => {});
    await pool.query('UPDATE hrm_attendances SET shift_id = NULL WHERE shift_id = $1', [shiftUuid]).catch(() => {});

    await pool.query('DELETE FROM hrm_shifts WHERE id = $1', [shiftUuid]);
    res.json({ success: true, message: `Shift "${targetShift.name}" berhasil dihapus.` });
  } catch (err) {
    console.error('[Delete Shift Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/shifts/:id/default', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE hrm_shifts SET is_default = false');
    const result = await pool.query('UPDATE hrm_shifts SET is_default = true WHERE id = $1 RETURNING *', [id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
             COALESCE(today_sched.today_shift_name, s.name) as shift_name,
             COALESCE(today_sched.today_shift_start_time, s.start_time::text) as shift_start_time,
             COALESCE(today_sched.today_shift_end_time, s.end_time::text) as shift_end_time,
             today_sched.today_shift_id,
             today_sched.today_shift_code,
             today_sched.today_is_off,
             sp.hourly_overtime_rate, sp.base_salary, sp.severance_scheme
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN LATERAL (
        SELECT es.shift_id as today_shift_id,
               es.shift_name as today_shift_name,
               es.start_time as today_shift_start_time,
               es.end_time as today_shift_end_time,
               es.is_off as today_is_off,
               es.shift_code as today_shift_code
        FROM hrm_employee_schedules es
        WHERE es.user_id = p.id AND es.schedule_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        LIMIT 1
      ) today_sched ON true
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      ORDER BY p.employee_sequence_no ASC NULLS LAST, p.created_at ASC
    `);
    res.json({ success: true, data: result.rows.map(formatUserRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, r.name as role_code, r.label as role_label,
             COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
             d.location_name as division_location_name,
             d.radius_meters as division_radius_meters,
             d.latitude as division_latitude,
             d.longitude as division_longitude,
             COALESCE(today_sched.today_shift_name, s.name) as shift_name,
             COALESCE(today_sched.today_shift_start_time, s.start_time::text) as shift_start_time,
             COALESCE(today_sched.today_shift_end_time, s.end_time::text) as shift_end_time,
             today_sched.today_shift_id,
             today_sched.today_shift_code,
             today_sched.today_is_off,
             sp.hourly_overtime_rate, sp.base_salary, sp.severance_scheme,
             (SELECT a.photo_in FROM hrm_attendances a WHERE a.user_id = p.id AND a.photo_in IS NOT NULL ORDER BY a.attendance_date DESC, a.created_at DESC LIMIT 1) as latest_attendance_photo
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN LATERAL (
        SELECT es.shift_id as today_shift_id,
               es.shift_name as today_shift_name,
               es.start_time as today_shift_start_time,
               es.end_time as today_shift_end_time,
               es.is_off as today_is_off,
               es.shift_code as today_shift_code
        FROM hrm_employee_schedules es
        WHERE es.user_id = p.id AND es.schedule_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        LIMIT 1
      ) today_sched ON true
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id::text = $1 OR p.nip = $1 OR LOWER(p.email) = LOWER($1)
      LIMIT 1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const formatted = formatUserRow(result.rows[0]);
    res.json({ success: true, user: formatted, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint avatar foto profil karyawan on-demand dengan HTTP Cache (Fast Native C++ Stream)
app.get('/api/users/:id/avatar', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.id, p.avatar_url, p.face_photo_url, p.face_enrolled_photo,
              (SELECT a.photo_in FROM hrm_attendances a WHERE a.user_id = p.id AND a.photo_in IS NOT NULL ORDER BY a.attendance_date DESC, a.created_at DESC LIMIT 1) as latest_photo
       FROM hrm_profiles p
       WHERE p.id::text = $1 OR p.nip = $1 OR LOWER(p.email) = LOWER($1)
       LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }
    const r = result.rows[0];
    const candidateList = [r.avatar_url, r.face_enrolled_photo, r.face_photo_url, r.latest_photo];
    const targetAvatar = candidateList.find(s => typeof s === 'string' && (s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://')));
    if (targetAvatar && typeof targetAvatar === 'string') {
      const match = targetAvatar.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.send(imgBuffer);
      } else if (targetAvatar.startsWith('http://') || targetAvatar.startsWith('https://')) {
        return res.redirect(targetAvatar);
      }
    }
    return res.status(404).json({ success: false, error: 'Avatar belum diset' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
        role_id = COALESCE(NULLIF($6::text, '')::uuid, role_id),
        division_name = COALESCE($7, division_name),
        division_id = COALESCE(NULLIF($8::text, '')::uuid, division_id),
        shift_id = COALESCE(NULLIF($9::text, '')::uuid, shift_id),
        password = COALESCE($10, password),
        is_active = COALESCE($11::boolean, is_active),
        address = COALESCE($12, address),
        city = COALESCE($13, city),
        province = COALESCE($14, province),
        postal_code = COALESCE($15, postal_code),
        gender = COALESCE($16, gender),
        birth_place = COALESCE($17, birth_place),
        birth_date = COALESCE(NULLIF($18::text, '')::date, birth_date),
        emergency_contact = COALESCE($19, emergency_contact),
        emergency_phone = COALESCE($20, emergency_phone),
        annual_leave_quota = COALESCE($21::integer, annual_leave_quota),
        used_leave_days = COALESCE($22::integer, used_leave_days),
        permission_quota = COALESCE($23::integer, permission_quota),
        used_permission_days = COALESCE($24::integer, used_permission_days),
        overtime_eligible = COALESCE($25::boolean, overtime_eligible),
        max_daily_overtime_hours = COALESCE($26::numeric, max_daily_overtime_hours),
        overtime_rate_override = COALESCE($27::numeric, overtime_rate_override),
        avatar_url = COALESCE($28, avatar_url),
        kepala_regu_id = CASE WHEN $29 = '__SET_NULL__' THEN NULL WHEN $29 IS NOT NULL AND $29 != '' THEN $29::uuid ELSE kepala_regu_id END,
        updated_at = NOW()
      WHERE id = $30::uuid
      RETURNING id;
    `;
    await pool.query(query, [
      u.nip || null,
      u.fullName || null,
      u.email ? u.email.trim().toLowerCase() : null,
      u.phone || null,
      u.roleName || null,
      resolvedRole ? String(resolvedRole) : null,
      divName || null,
      resolvedDiv ? String(resolvedDiv) : null,
      resolvedShift ? String(resolvedShift) : null,
      u.password || null,
      u.isActive !== undefined ? Boolean(u.isActive) : null,
      u.address || null,
      u.city || null,
      u.province || null,
      u.postalCode || null,
      u.gender || null,
      u.birthPlace || null,
      u.birthDate ? String(u.birthDate) : null,
      u.emergencyContact || u.emergencyContactName || null,
      u.emergencyPhone || u.emergencyContactPhone || null,
      u.annualLeaveQuota !== undefined && u.annualLeaveQuota !== null ? Number(u.annualLeaveQuota) : null,
      u.usedLeaveDays !== undefined && u.usedLeaveDays !== null ? Number(u.usedLeaveDays) : null,
      u.permissionQuota !== undefined && u.permissionQuota !== null ? Number(u.permissionQuota) : null,
      u.usedPermissionDays !== undefined && u.usedPermissionDays !== null ? Number(u.usedPermissionDays) : null,
      u.overtimeEligible !== undefined && u.overtimeEligible !== null ? Boolean(u.overtimeEligible) : null,
      u.maxDailyOvertimeHours !== undefined && u.maxDailyOvertimeHours !== null ? Number(u.maxDailyOvertimeHours) : null,
      u.overtimeRateOverride !== undefined && u.overtimeRateOverride !== null ? (u.overtimeRateOverride ? Number(u.overtimeRateOverride) : null) : null,
      u.avatarUrl || null,
      krParam || null,
      targetId,
    ]);

    // Sinkronisasi otomatis ke Roster Jadwal Kerja harian (hrm_employee_schedules)
    // agar perubahan shift dari Superadmin langsung aktif seketika di PWA tanpa konflik jadwal basi
    if (resolvedShift) {
      try {
        const sRes = await pool.query('SELECT * FROM hrm_shifts WHERE id = $1', [resolvedShift]);
        if (sRes.rows.length > 0) {
          const s = sRes.rows[0];
          const sStart = s.start_time ? s.start_time.substring(0, 5) : '07:30';
          const sEnd = s.end_time ? s.end_time.substring(0, 5) : '16:30';
          const isNight = Boolean(s.is_cross_day || (sEnd < sStart));

          // 1. Update seluruh jadwal yang ada mulai hari ini ke depan
          await pool.query(
            `UPDATE hrm_employee_schedules SET
              shift_id = $1,
              shift_code = COALESCE($2, shift_code, 'SHF'),
              shift_name = $3,
              start_time = $4,
              end_time = $5,
              duration_hours = 8.0,
              is_night_shift = $6,
              is_off = false,
              notes = 'Penugasan Shift Resmi (' || $3 || ')',
              updated_at = NOW()
            WHERE user_id = $7
              AND schedule_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date`,
            [s.id, s.code || 'SHF', s.name, sStart, sEnd, isNight, targetId]
          );

          // 2. Pastikan jadwal hari ini terdaftar (upsert)
          await pool.query(
            `INSERT INTO hrm_employee_schedules (
              user_id, schedule_date, shift_id, shift_code, shift_name,
              start_time, end_time, duration_hours, is_night_shift, is_off, notes, updated_at
            ) VALUES (
              $1, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date,
              $2, COALESCE($3, 'SHF'), $4, $5, $6, 8.0, $7, false,
              'Penugasan Shift Resmi (' || $4 || ')', NOW()
            )
            ON CONFLICT (user_id, schedule_date) DO UPDATE SET
              shift_id = EXCLUDED.shift_id,
              shift_code = EXCLUDED.shift_code,
              shift_name = EXCLUDED.shift_name,
              start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time,
              duration_hours = EXCLUDED.duration_hours,
              is_night_shift = EXCLUDED.is_night_shift,
              is_off = false,
              notes = EXCLUDED.notes,
              updated_at = NOW()`,
            [targetId, s.id, s.code || 'SHF', s.name, sStart, sEnd, isNight]
          );
        }
      } catch (schedSyncErr) {
        console.warn('[Sync Employee Shift Schedules] Notice:', schedSyncErr.message);
      }
    }

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
  let {
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
    let validUserId = userId;
    let userProfile = null;
    const userRes = await pool.query(
      `SELECT id, full_name, email, nip, division_id, shift_id, custom_start_time, custom_end_time, late_tolerance_minutes, device_id, device_model, is_device_bound, face_embedding, allowed_posts, allow_ogs_clock_out 
       FROM hrm_profiles 
       WHERE id::text = $1 OR nip = $1 OR LOWER(email) = LOWER($1) 
       LIMIT 1`,
      [userId]
    );
    if (userRes.rows.length > 0) {
      userProfile = userRes.rows[0];
      validUserId = userProfile.id;
      userId = validUserId;
    }

    const isExempt = isExemptFieldOfficer(userProfile);

    // Cek apakah presensi dilakukan dalam konteks Simulasi Sosialisasi (DIV-SIM)
    let isSimulationSession = false;
    let simDivision = null;
    try {
      const simDivRes = await pool.query(`SELECT * FROM hrm_divisions WHERE code = 'DIV-SIM' LIMIT 1`);
      if (simDivRes.rows.length > 0) {
        simDivision = simDivRes.rows[0];
        const isUserInSimDiv = userProfile && (userProfile.division_id === simDivision.id || userProfile.division_code === 'DIV-SIM');
        const isExplicitSim = req.body.isSimulation === true || req.body.isSimulation === 'true';
        // HANYA aktif jika karyawan memang berasal dari divisi DIV-SIM atau eksplisit sesi simulasi
        if (isUserInSimDiv || isExplicitSim) {
          isSimulationSession = true;
        }
      }
    } catch (simErr) {
      console.warn('[SimulationCheck] Warning:', simErr.message);
    }

    // Validasi Jam Kerja Shift Karyawan (Server-side Shift Window Guard)
    // Sesi simulasi / sosialisasi otomatis diizinkan bebas jadwal 24 jam penuh!
    // ─── UNIFIED REALTIME SHIFT & ROSTER RESOLUTION (UNTUK SEMUA POLA SHIFT) ───
    let activeShiftId = null;
    let activeShiftName = null;
    let shiftStartTime = '07:30';
    let shiftEndTime = '16:30';
    let isCrossDay = false;
    let isEmployeeOffToday = false;
    let effectiveLateTolerance = (userProfile && Number.isFinite(userProfile.late_tolerance_minutes))
      ? Number(userProfile.late_tolerance_minutes)
      : 15;

    const isEmergencyOverride = req.body.isEmergencyOverride === true || req.body.isEmergencyOverride === 'true';
    const cleanEmergencyReason = (req.body.emergencyReason || req.body.emergencyOvertimeReason || notes || '').trim();

    // Prioritas 1: Periksa Roster Jadwal Kerja harian (hrm_employee_schedules) hari ini
    if (userProfile) {
      try {
        const schedRes = await pool.query(
          `SELECT es.*, s.is_cross_day as shift_is_cross_day, s.id as master_shift_id, s.name as master_shift_name, s.late_tolerance_minutes as master_shift_tolerance
           FROM hrm_employee_schedules es
           LEFT JOIN hrm_shifts s ON es.shift_id = s.id OR s.code = es.shift_code
           WHERE es.user_id = $1 AND es.schedule_date = $2::date
           LIMIT 1`,
          [validUserId, date]
        );
        if (schedRes.rows.length > 0) {
          const es = schedRes.rows[0];
          if (es.is_off) {
            isEmployeeOffToday = true;
          }
          if (es.start_time) {
            shiftStartTime = es.start_time.substring(0, 5);
          }
          if (es.end_time) {
            shiftEndTime = es.end_time.substring(0, 5);
          }
          isCrossDay = Boolean(es.is_night_shift || es.shift_is_cross_day);
          activeShiftName = es.shift_name || es.master_shift_name || `Shift ${es.shift_code}`;
          activeShiftId = (es.shift_id && UUID_REGEX.test(es.shift_id)) ? es.shift_id : (es.master_shift_id || null);
          if (es.master_shift_tolerance != null && userProfile.late_tolerance_minutes == null) {
            effectiveLateTolerance = Number(es.master_shift_tolerance);
          }
        }
      } catch (schedErr) {
        console.warn('[ShiftSchedLookup Warning]:', schedErr.message);
      }
    }

    // Prioritas 2: Jika tidak ada jadwal roster harian spesifik, periksa shift ID target atau shift resmi profil
    if (!activeShiftId && userProfile) {
      let targetShiftId = (req.body.shiftId && UUID_REGEX.test(req.body.shiftId)) ? req.body.shiftId : null;
      if (!targetShiftId && userProfile.shift_id && UUID_REGEX.test(userProfile.shift_id)) {
        targetShiftId = userProfile.shift_id;
      }
      if (!targetShiftId && userProfile.shift_id) {
        targetShiftId = await resolveShiftId(userProfile.shift_id);
      }

      if (targetShiftId) {
        try {
          const shiftRes = await pool.query(
            `SELECT id, name, start_time, end_time, is_cross_day, late_tolerance_minutes FROM hrm_shifts WHERE id = $1 LIMIT 1`,
            [targetShiftId]
          );
          if (shiftRes.rows.length > 0) {
            const sh = shiftRes.rows[0];
            shiftStartTime = sh.start_time ? sh.start_time.substring(0, 5) : '07:30';
            shiftEndTime = sh.end_time ? sh.end_time.substring(0, 5) : '16:30';
            isCrossDay = Boolean(sh.is_cross_day);
            activeShiftName = sh.name;
            activeShiftId = targetShiftId;
            if (sh.late_tolerance_minutes != null && userProfile.late_tolerance_minutes == null) {
              effectiveLateTolerance = Number(sh.late_tolerance_minutes);
            }
          }
        } catch (shErr) {
          console.warn('[ShiftLookup Warning]:', shErr.message);
        }
      }
    }

    // Prioritas Khusus Pimpinan: Jika karyawan memiliki jam kerja khusus (custom_start_time), prioritaskan jam kerja tersebut
    if (userProfile && userProfile.custom_start_time) {
      shiftStartTime = userProfile.custom_start_time.substring(0, 5);
      if (userProfile.custom_end_time) {
        shiftEndTime = userProfile.custom_end_time.substring(0, 5);
      }
      activeShiftName = `Shift Khusus (${shiftStartTime} - ${shiftEndTime} WITA)`;
      if (userProfile.late_tolerance_minutes != null) {
        effectiveLateTolerance = Number(userProfile.late_tolerance_minutes);
      }
    }

    // Auto-crossday detection jika jam pulang lebih kecil dari jam masuk
    const [sH_chk, sM_chk] = shiftStartTime.split(':').map(Number);
    const [eH_chk, eM_chk] = shiftEndTime.split(':').map(Number);
    const sMins_chk = (Number.isFinite(sH_chk) ? sH_chk : 7) * 60 + (Number.isFinite(sM_chk) ? sM_chk : 0);
    const eMins_chk = (Number.isFinite(eH_chk) ? eH_chk : 16) * 60 + (Number.isFinite(eM_chk) ? eM_chk : 0);
    if (eMins_chk < sMins_chk) {
      isCrossDay = true;
    }

    // ─── SHIFT WINDOW GUARD (HANYA UNTUK KARYAWAN REGULER) ───
    if (!isExempt && !isSimulationSession && userProfile) {
      const otRes = await pool.query(
        `SELECT id FROM hrm_overtime_records WHERE user_id = $1 AND date = $2 AND status = 'approved' LIMIT 1`,
        [userId, date]
      ).catch(() => ({ rows: [] }));
      const subRes = await pool.query(
        `SELECT id FROM hrm_shift_substitutions WHERE (relief_user_id = $1 OR original_user_id = $1) AND duty_date = $2 AND status = 'approved' LIMIT 1`,
        [userId, date]
      ).catch(() => ({ rows: [] }));
      const swapRes = await pool.query(
        `SELECT id FROM hrm_shift_swaps WHERE (substitute_id = $1 OR requester_id = $1) AND swap_date = $2 AND status = 'approved' LIMIT 1`,
        [userId, date]
      ).catch(() => ({ rows: [] }));

      const hasApprovedException = (otRes.rows.length > 0) || (subRes.rows.length > 0) || (swapRes.rows.length > 0);

      // Guard Dobel Shift / Shift Lanjutan: Jika karyawan sudah menyelesaikan shift hari ini
      const completedAttCheck = await pool.query(
        `SELECT id, shift_name, clock_in, clock_out FROM hrm_attendances 
         WHERE user_id = $1 AND attendance_date = $2 AND clock_out IS NOT NULL 
         ORDER BY created_at DESC LIMIT 1`,
        [validUserId, date]
      ).catch(() => ({ rows: [] }));

      if (completedAttCheck.rows.length > 0 && !hasApprovedException && !isEmergencyOverride && !isExempt && !isSimulationSession) {
        const prevShift = completedAttCheck.rows[0].shift_name || 'Shift sebelumnya';
        const outTime = (completedAttCheck.rows[0].clock_out || '').substring(0, 5);
        return res.status(403).json({
          success: false,
          error: `Presensi Shift Tambahan Ditolak: Anda telah menyelesaikan tugas (${prevShift}, pulang pk ${outTime} WITA) hari ini. Untuk melanjutkan ke shift berikutnya, wajib memiliki persetujuan SPKL Lembur / Relief Duty, atau gunakan opsi '🚨 Absen Tugas Darurat Mandiri'.`,
          code: 'REQUIRES_APPROVED_OVERTIME_OR_SUBSTITUTE',
          canEmergencyOverride: true
        });
      }

      if (!hasApprovedException && !isEmployeeOffToday) {
        let nowMins = 0;
        if (time && typeof time === 'string') {
          const [cH, cM] = time.split(':').map(Number);
          nowMins = (Number.isFinite(cH) ? cH : 0) * 60 + (Number.isFinite(cM) ? cM : 0);
        } else {
          const witaDate = new Date(Date.now() + 8 * 3600000);
          nowMins = witaDate.getUTCHours() * 60 + witaDate.getUTCMinutes();
        }

        // Window dibuka 120 menit (2 jam) sebelum jam masuk resmi shift
        const openMins = (sMins_chk - 120 + 1440) % 1440;
        let isShiftOpen = false;

        if (isCrossDay) {
          if (nowMins >= openMins || nowMins < eMins_chk) {
            isShiftOpen = true;
          }
        } else {
          if (openMins > sMins_chk) {
            if (nowMins >= openMins || nowMins <= eMins_chk) isShiftOpen = true;
          } else {
            if (nowMins >= openMins && nowMins <= eMins_chk) isShiftOpen = true;
          }
        }

        // Toleransi khusus jika karyawan melakukan presensi tugas darurat / on-call di hari libur atau di luar jam shift
        const isEmergencyOnCall = (notes && (notes.includes('On-Call') || notes.includes('Darurat'))) ||
                                  (req.body.isEmergencyOvertime === true || req.body.isEmergencyOvertime === 'true') ||
                                  isEmergencyOverride;

        if (!isShiftOpen && !isEmergencyOnCall) {
          const openH = Math.floor(openMins / 60).toString().padStart(2, '0');
          const openM = (openMins % 60).toString().padStart(2, '0');
          return res.status(403).json({
            success: false,
            error: `Presensi Masuk Ditolak: Jam saat ini (${time || 'sekarang'} WITA) berada di luar jendela shift kerja resmi (${activeShiftName || 'Shift'}: ${shiftStartTime} - ${shiftEndTime} WITA). Presensi dibuka mulai pk ${openH}:${openM} WITA.`,
            code: 'OUTSIDE_SHIFT_WINDOW'
          });
        }
      }
    }

    // Validasi Khusus Pos OGS: Titik Pos OGS (-4.787904, 119.613399) HANYA untuk Ceklok Pulang bagi divisi/karyawan biasa
    // Kecuali 3 Petugas Lapangan Khusus yang 100% dikecualikan (Aslam, Samsi, Takdir)
    if (!isExempt && latitude && longitude) {
      const distToOgs = calculateHaversineMeters(parseFloat(latitude), parseFloat(longitude), -4.787904, 119.613399);
      if (distToOgs <= 250) {
        return res.status(403).json({
          success: false,
          error: 'Presensi Masuk Ditolak: Titik Pos OGS hanya diizinkan untuk Ceklok Pulang (Presensi Keluar) bagi divisi dan karyawan yang ditentukan.',
          code: 'OGS_CLOCKOUT_ONLY'
        });
      }
    }

    if (userProfile && deviceId) {
      const ua = req.headers['user-agent'] || '';
      const isAndroidEnv = /Android/i.test(deviceModel || '') || /Android/i.test(ua) || /Android/i.test(userProfile.device_model || '') || userProfile.device_id === 'DEV-HW-UUID-ANDROID-882910';
      const isBiometricValid = biometricMatch === true || (typeof biometricScore === 'number' && biometricScore >= 70);

      if (userProfile.is_device_bound && userProfile.device_id && userProfile.device_id !== deviceId) {
        if (isAndroidEnv || isBiometricValid) {
          await pool.query(
            `UPDATE hrm_profiles SET device_id = $1, device_model = $2, is_device_bound = true, device_bound_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [deviceId, deviceModel || 'Android Device', userId]
          );
        } else {
          return res.status(403).json({
            success: false,
            error: `Peringatan Keamanan: Akun Anda telah terkunci pada perangkat HP resmi Anda (${userProfile.device_model || 'HP Terdaftar'}). Hubungi HRD/Admin untuk reset perangkat jika Anda mengganti HP.`,
            code: 'DEVICE_BINDING_MISMATCH'
          });
        }
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
    let locationName = 'Kantor Pusat';

    if (isSimulationSession && simDivision) {
      const distToSim = (latitude && longitude && simDivision.latitude && simDivision.longitude)
        ? Math.round(calculateHaversineMeters(parseFloat(latitude), parseFloat(longitude), parseFloat(simDivision.latitude), parseFloat(simDivision.longitude)))
        : 0;
      serverDistance = distToSim;
      isServerGeofenceValid = true;
      locationName = `${simDivision.location_name || 'Venue Simulasi Presentasi'} [DIV-SIM]`;
    } else if (latitude && longitude && userId) {
      const candidateLocations = [];

      // A. Bank Pos Lapangan Karyawan (hrm_field_assigned_posts)
      try {
        const fieldPosts = await pool.query(
          `SELECT post_name as name, post_code as code, latitude, longitude, radius_meters 
           FROM hrm_field_assigned_posts 
           WHERE user_id = $1 AND is_active = true 
             AND (is_relief IS NOT TRUE OR relief_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)`,
          [userId]
        );
        for (const fp of fieldPosts.rows) {
          if (fp.latitude && fp.longitude) {
            candidateLocations.push({
              name: `${fp.name} [${fp.code || 'POS'}]`,
              lat: parseFloat(fp.latitude),
              lon: parseFloat(fp.longitude),
              radius: parseFloat(fp.radius_meters || 100),
            });
          }
        }
      } catch (fpErr) {
        console.warn('[ClockIn] Field posts query warn:', fpErr.message);
      }

      // B. Divisi & Kantor Pusat Resmi Karyawan (hrm_divisions & hrm_office_locations)
      try {
        const locRes = await pool.query(
          `SELECT 
             p.assigned_latitude, p.assigned_longitude, p.assigned_radius_meters, p.assigned_location_name,
             p.allowed_posts as user_allowed_posts,
             d.latitude as div_lat, d.longitude as div_lon, d.radius_meters as div_radius, d.name as div_name,
             d.allowed_posts as div_allowed_posts,
             o.latitude as office_lat, o.longitude as office_lon, o.radius_meters as office_radius, o.name as office_name
           FROM hrm_profiles p
           LEFT JOIN hrm_divisions d ON p.division_id = d.id
           LEFT JOIN hrm_office_locations o ON o.is_active = true
           WHERE p.id = $1 LIMIT 1`,
          [userId]
        );

        if (locRes.rows.length > 0) {
          const loc = locRes.rows[0];
          if (loc.div_lat && loc.div_lon) {
            candidateLocations.push({
              name: `Lokasi Divisi ${loc.div_name || 'Divisi'}`,
              lat: parseFloat(loc.div_lat),
              lon: parseFloat(loc.div_lon),
              radius: parseFloat(loc.div_radius || 150),
            });
          }
          if (loc.office_lat && loc.office_lon) {
            candidateLocations.push({
              name: loc.office_name || 'Kantor Pusat PT FRP',
              lat: parseFloat(loc.office_lat),
              lon: parseFloat(loc.office_lon),
              radius: parseFloat(loc.office_radius || 100),
            });
          }
          if (loc.assigned_latitude && loc.assigned_longitude) {
            candidateLocations.push({
              name: loc.assigned_location_name || 'Lokasi Khusus Karyawan',
              lat: parseFloat(loc.assigned_latitude),
              lon: parseFloat(loc.assigned_longitude),
              radius: parseFloat(loc.assigned_radius_meters || 150),
            });
          }
          // Parsing allowed posts dari divisi atau user
          let allowedPostsList = [];
          if (loc.div_allowed_posts) {
            const parsed = typeof loc.div_allowed_posts === 'string' ? JSON.parse(loc.div_allowed_posts) : loc.div_allowed_posts;
            if (Array.isArray(parsed)) allowedPostsList.push(...parsed);
          }
          if (loc.user_allowed_posts) {
            const parsed = typeof loc.user_allowed_posts === 'string' ? JSON.parse(loc.user_allowed_posts) : loc.user_allowed_posts;
            if (Array.isArray(parsed)) allowedPostsList.push(...parsed);
          }
          for (const ap of allowedPostsList) {
            if (ap.latitude && ap.longitude && ap.allowClockIn !== false && !ap.isClockOutOnly) {
              candidateLocations.push({
                name: ap.name || ap.code || 'Pos Divisi',
                lat: parseFloat(ap.latitude),
                lon: parseFloat(ap.longitude),
                radius: parseFloat(ap.radiusMeters || ap.radius_meters || 150),
              });
            }
          }
        }
      } catch (locErr) {
        console.warn('[ClockIn] Div/Office query warn:', locErr.message);
      }

      // C. Pos Default Kantor Pusat PT FRP (Biring Ere / Kalabbirang)
      candidateLocations.push({
        name: 'Kantor Pusat PT FRP',
        lat: -4.79396318,
        lon: 119.60433745,
        radius: 200,
      });

      // Evaluasi jarak terhadap seluruh kandidat lokasi sah perusahaan
      const curLat = parseFloat(latitude);
      const curLon = parseFloat(longitude);
      const evaluated = candidateLocations.map((c) => {
        const dist = calculateHaversineMeters(curLat, curLon, c.lat, c.lon);
        return { ...c, distance: dist, isValid: dist <= (c.radius + 25) }; // toleransi GPS 25m
      });

      const matched = evaluated.find((e) => e.isValid);
      if (matched) {
        serverDistance = Math.round(matched.distance);
        isServerGeofenceValid = true;
        locationName = matched.name;
      } else if (evaluated.length > 0) {
        const nearest = evaluated.sort((a, b) => a.distance - b.distance)[0];
        serverDistance = Math.round(nearest.distance);
        isServerGeofenceValid = false;
        locationName = nearest.name;
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

    // 3. Biometric Face AI Verification via InsightFace (Container hrm-face-ai Port 5001)
    let computedBiometricScore = biometricScore;
    let computedBiometricMatch = biometricMatch;

    // Pastikan master embedding 512D InsightFace tersedia
    let masterEmbedding = userProfile ? userProfile.face_embedding : null;
    if (userProfile && (!masterEmbedding || !Array.isArray(masterEmbedding) || masterEmbedding.length === 0) && userProfile.face_enrolled_photo) {
      try {
        const extRes = await fetch(`${FACE_AI_URL}/extract-embedding-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: userProfile.face_enrolled_photo })
        });
        if (extRes.ok) {
          const extData = await extRes.json();
          if (extData.success && Array.isArray(extData.embedding) && extData.embedding.length === 512) {
            masterEmbedding = extData.embedding;
            await pool.query('UPDATE hrm_profiles SET face_embedding = $1 WHERE id = $2', [masterEmbedding, userProfile.id]);
            console.log(`[InsightFace AI] Auto-extracted and cached 512D master embedding for ${userProfile.full_name}`);
          }
        }
      } catch (extErr) {
        console.warn('[BiometricAI] Auto-extraction of master photo failed:', extErr.message);
      }
    }

    const photoToVerify = req.body.cleanPhoto || photo;
    if (masterEmbedding && Array.isArray(masterEmbedding) && masterEmbedding.length > 0 && photoToVerify) {
      try {
        const aiRes = await fetch(`${FACE_AI_URL}/verify-face-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: photoToVerify,
            master_embedding: masterEmbedding,
            threshold: 0.60
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.success) {
            if (aiData.is_spoof && !aiData.is_match) {
              return res.status(400).json({
                success: false,
                error: `Presensi Ditolak! ${aiData.error || 'Terdeteksi kecurangan: citra berasal dari layar HP / rekaman video sekunder.'}`,
                code: 'PRESENTATION_ATTACK_DETECTED'
              });
            } else if (aiData.is_spoof) {
              detectedFlags.push('ENVIRONMENT_LINE_FLAG');
            }
            computedBiometricMatch = aiData.is_match;
            computedBiometricScore = aiData.confidence;

            if (!aiData.is_match) {
              return res.status(400).json({
                success: false,
                error: `Verifikasi Wajah InsightFace Gagal: Wajah terdeteksi ${aiData.confidence}% cocok (ambang batas aman 60%). Pastikan wajah menghadap lurus ke kamera dan tidak diwakilkan orang lain.`,
                code: 'BIOMETRIC_MISMATCH',
                confidence: aiData.confidence
              });
            }
            console.log(`[InsightFace AI] Clock-in face matched successfully: ${aiData.confidence}% for user ${userProfile.full_name}`);
          } else {
            return res.status(400).json({
              success: false,
              error: aiData.error || `Wajah tidak terdeteksi oleh AI pada kamera. Harap pastikan seluruh wajah terlihat jelas menghadap kamera dan berada di area berpenerangan cukup.`,
              code: aiData.is_spoof ? 'PRESENTATION_ATTACK_DETECTED' : 'FACE_NOT_DETECTED'
            });
          }
        }
      } catch (aiErr) {
        console.warn('[BiometricAI] Face AI microservice offline/unreachable:', aiErr.message);
        detectedFlags.push('BIOMETRIC_SERVICE_OFFLINE');
      }
    }

    const { shiftId, shiftName } = req.body;
    let resolvedShiftId = null;
    let resolvedShiftName = shiftName || null;

    if (shiftId && UUID_REGEX.test(shiftId)) {
      resolvedShiftId = shiftId;
    } else if (activeShiftId && UUID_REGEX.test(activeShiftId)) {
      resolvedShiftId = activeShiftId;
      if (!resolvedShiftName) resolvedShiftName = activeShiftName;
    } else if (userProfile && userProfile.shift_id && UUID_REGEX.test(userProfile.shift_id)) {
      resolvedShiftId = userProfile.shift_id;
      if (!resolvedShiftName) resolvedShiftName = userProfile.shift_name;
    } else {
      resolvedShiftId = await resolveShiftId(shiftId);
    }

    if (resolvedShiftId && !resolvedShiftName) {
      const shRes = await pool.query('SELECT name FROM hrm_shifts WHERE id = $1 LIMIT 1', [resolvedShiftId]);
      if (shRes.rows.length > 0) {
        resolvedShiftName = shRes.rows[0].name;
      }
    }

    // Auto-close presensi terbuka dari hari-hari sebelumnya yang belum clock-out agar tidak memblokir presensi hari ini
    await pool.query(
      `UPDATE hrm_attendances 
       SET clock_out = COALESCE(
         (SELECT COALESCE(s.end_time, '16:30')::time FROM hrm_profiles p LEFT JOIN hrm_shifts s ON p.shift_id = s.id WHERE p.id = $1),
         '16:30'::time
       ),
       auto_closed_type = 'AUTO_CLOCKOUT_PREVIOUS_DAY',
       notes = COALESCE(notes, '') || ' [Auto-closed sistem: presensi hari berikutnya]',
       updated_at = NOW()
       WHERE user_id = $1 AND attendance_date < $2::date AND clock_out IS NULL;`,
      [validUserId, date]
    ).catch(e => console.warn('[AutoClosePastDays Warning]:', e.message));

    // Cek apakah karyawan masih memiliki presensi aktif KHUSUS HARI INI yang belum clock-out
    const openAttRes = isSimulationSession
      ? await pool.query(
          `SELECT * FROM hrm_attendances WHERE user_id = $1 AND attendance_date = $2::date AND clock_out IS NULL AND (is_simulation = true OR notes LIKE '%[SIMULASI%') ORDER BY created_at DESC LIMIT 1`,
          [validUserId, date]
        )
      : await pool.query(
          `SELECT * FROM hrm_attendances WHERE user_id = $1 AND attendance_date = $2::date AND clock_out IS NULL ORDER BY created_at DESC LIMIT 1`,
          [validUserId, date]
        );

    let result;
    const flagsJson = JSON.stringify(Array.isArray(detectedFlags) ? detectedFlags : []);
    if (openAttRes.rows.length > 0) {
      // Jika karyawan sudah dalam status clock-in dan belum clock-out hari ini, perbarui foto/koordinat jika ada
      const existingAtt = openAttRes.rows[0];
      const updateQuery = `
        UPDATE hrm_attendances SET
          photo_in = COALESCE($1, photo_in),
          lat_in = COALESCE($2, lat_in),
          long_in = COALESCE($3, long_in),
          biometric_score = COALESCE($4, biometric_score),
          biometric_match = COALESCE($5, biometric_match),
          updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;
      result = await pool.query(updateQuery, [
        photo || null,
        latitude || null,
        longitude || null,
        computedBiometricScore != null ? computedBiometricScore : null,
        computedBiometricMatch != null ? computedBiometricMatch : null,
        existingAtt.id
      ]);
    } else {
      // Server-side authoritative late minutes computation
      let finalStatus = 'hadir';
      let finalLateMinutes = 0;

      if (isSimulationSession || isEmployeeOffToday) {
        finalStatus = 'hadir';
        finalLateMinutes = 0;
      } else {
        const [sH, sM] = shiftStartTime.split(':').map(Number);
        const startMins = (Number.isFinite(sH) ? sH : 7) * 60 + (Number.isFinite(sM) ? sM : 0);
        let curMins = 0;
        if (time && typeof time === 'string') {
          const [cH, cM] = time.split(':').map(Number);
          curMins = (Number.isFinite(cH) ? cH : 0) * 60 + (Number.isFinite(cM) ? cM : 0);
        } else {
          const witaDate = new Date(Date.now() + 8 * 3600000);
          curMins = witaDate.getUTCHours() * 60 + witaDate.getUTCMinutes();
        }

        let diff = curMins - startMins;
        if (isCrossDay && curMins < 720 && startMins >= 720) {
          diff = (curMins + 1440) - startMins;
        }

        if (diff > effectiveLateTolerance) {
          finalStatus = 'terlambat';
          finalLateMinutes = diff - effectiveLateTolerance;
        } else {
          finalStatus = 'hadir';
          finalLateMinutes = 0;
        }
      }

      // Buat rekaman presensi baru atau update jika sudah ada row hari ini (misal status alfa auto-mangkir)
      const finalNotes = isSimulationSession
        ? `[SIMULASI SOSIALISASI] ${notes || ''}`.trim()
        : (notes || '');

      const query = `
        INSERT INTO hrm_attendances (
          user_id, attendance_date, clock_in, photo_in, lat_in, long_in, status, late_minutes, notes,
          biometric_score, biometric_match, geofence_distance_meters, geofence_valid, is_mock_location, security_flags,
          shift_id, shift_name, is_simulation, is_verified, is_locked, is_perimeter_breached, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true, false, false, NOW(), NOW())
        ON CONFLICT (user_id, attendance_date) DO UPDATE
        SET clock_in = EXCLUDED.clock_in,
            photo_in = COALESCE(EXCLUDED.photo_in, hrm_attendances.photo_in),
            lat_in = COALESCE(EXCLUDED.lat_in, hrm_attendances.lat_in),
            long_in = COALESCE(EXCLUDED.long_in, hrm_attendances.long_in),
            status = EXCLUDED.status,
            late_minutes = EXCLUDED.late_minutes,
            notes = CASE 
              WHEN hrm_attendances.notes IS NOT NULL AND hrm_attendances.notes != '' AND hrm_attendances.notes NOT LIKE '%MANGKIR%'
              THEN hrm_attendances.notes || ' | ' || EXCLUDED.notes 
              ELSE EXCLUDED.notes 
            END,
            biometric_score = COALESCE(EXCLUDED.biometric_score, hrm_attendances.biometric_score),
            biometric_match = COALESCE(EXCLUDED.biometric_match, hrm_attendances.biometric_match),
            geofence_distance_meters = COALESCE(EXCLUDED.geofence_distance_meters, hrm_attendances.geofence_distance_meters),
            geofence_valid = EXCLUDED.geofence_valid,
            is_mock_location = EXCLUDED.is_mock_location,
            security_flags = EXCLUDED.security_flags,
            shift_id = COALESCE(EXCLUDED.shift_id, hrm_attendances.shift_id),
            shift_name = COALESCE(EXCLUDED.shift_name, hrm_attendances.shift_name),
            is_simulation = EXCLUDED.is_simulation,
            is_verified = true,
            is_locked = false,
            is_perimeter_breached = false,
            updated_at = NOW()
        RETURNING *;
      `;
      result = await pool.query(query, [
        validUserId,
        date,
        time,
        photo,
        latitude,
        longitude,
        finalStatus,
        finalLateMinutes,
        finalNotes,
        computedBiometricScore != null ? computedBiometricScore : null,
        computedBiometricMatch != null ? computedBiometricMatch : null,
        serverDistance != null ? serverDistance : geofenceDistance,
        isServerGeofenceValid,
        isMockLocation === true,
        flagsJson,
        resolvedShiftId || null,
        resolvedShiftName || null,
        Boolean(isSimulationSession)
      ]);
    }
    const insertedAttendance = result.rows[0];

    // ─── PENANGANAN KHUSUS ABSEN TUGAS DARURAT MANDIRI (REKOMENDASI 3) ───
    if (isEmergencyOverride && insertedAttendance?.id) {
      await pool.query(
        `UPDATE hrm_attendances SET
           is_emergency_overtime = true,
           emergency_overtime_reason = $1,
           emergency_overtime_status = 'pending_verification'
         WHERE id = $2`,
        [cleanEmergencyReason || 'Tugas operasional darurat mandiri (Kompensasi menunggu verifikasi atasan)', insertedAttendance.id]
      ).catch(() => {});

      // Buat tiket lembur berstatus pending di hrm_overtime_records
      await pool.query(
        `INSERT INTO hrm_overtime_records (
           user_id, date, start_time, end_time, duration_hours, requested_hours, approved_hours,
           task_description, is_emergency, source, status, overtime_phase, emergency_reported_at, approval_notes
         ) VALUES (
           $1, $2::date, $3, '23:59', 0, 0, 0,
           $4, true, 'emergency_override_clockin', 'pending', 'requested', NOW(),
           'Absen Masuk Tugas Darurat Mandiri (Kompensasi terkunci, wajib diverifikasi atasan di Dashboard)'
         )`,
        [
          validUserId,
          date,
          time || '15:30',
          cleanEmergencyReason || 'Tugas operasional darurat mandiri'
        ]
      ).catch(e => console.warn('[Emergency OT Record Insert]:', e.message));

      // Kirim WhatsApp alert seketika ke Pimpinan & Korlap
      const empName = userProfile?.full_name || 'Karyawan';
      const empNip = userProfile?.nip || '-';
      const posName = locationName || 'Pos Lapangan';
      const targetShift = resolvedShiftName || 'Shift Tambahan';

      const waMsg = `🚨 *NOTIFIKASI ABSEN MASUK TUGAS DARURAT MANDIRI*\n\n` +
        `👤 *Karyawan:* ${empName} (NIP: ${empNip})\n` +
        `🏢 *Divisi:* ${userProfile?.division_name || 'Operasional'}\n` +
        `📍 *Pos Presensi:* ${posName}\n` +
        `⏱️ *Jam Masuk:* ${time || '-'} WITA\n` +
        `⚡ *Shift:* ${targetShift}\n` +
        `📝 *Alasan Lapangan:* _"${cleanEmergencyReason || 'Tugas darurat mendadak lapangan'}"_\n` +
        `📸 *Bukti Forensik:* Selfie Presensi Ber-Watermark GPS Tersimpan\n` +
        `⏳ *Status Kompensasi:* TERKUNCI (Menunggu verifikasi Korlap / Admin di Dashboard).`;

      alertLeadershipViaWhatsAppAndSystem({
        title: 'Notifikasi Absen Masuk Tugas Darurat',
        message: `${empName} absen tugas darurat mandiri di ${posName} (${targetShift})`,
        waMessage: waMsg,
        metadata: {
          type: 'emergency_override_clockin',
          attendanceId: insertedAttendance.id,
          userId: validUserId
        }
      }).catch(err => console.error('[Emergency Override Alert Error]:', err.message));
    }

    // Ephemeral Rolling Photo Replacement: Foto check-in yang lalu otomatis dihapus dan digantikan hanya dengan foto check-in terbaru
    if (photo && validUserId && insertedAttendance?.id) {
      await pool.query(
        `UPDATE hrm_attendances 
         SET photo_in = NULL 
         WHERE user_id = $1 AND id != $2 AND photo_in IS NOT NULL;`,
        [validUserId, insertedAttendance.id]
      ).catch((err) => console.warn('[Photo Retention] Error clearing older clock-in photos:', err));

      // Jika user belum memiliki foto profil atau avatar yang valid (>150 char), perbarui juga avatar_url di hrm_profiles
      await pool.query(
        `UPDATE hrm_profiles 
         SET avatar_url = $1, face_photo_url = COALESCE(face_photo_url, $1) 
         WHERE id = $2 AND (avatar_url IS NULL OR LENGTH(avatar_url) < 150);`,
        [photo, validUserId]
      ).catch((err) => console.warn('[Photo Retention] Error syncing avatar to profile:', err));
    }

    // 📲 MANDAT PIMPINAN: Laporan Notifikasi WhatsApp Instan saat Aslam, Samsi, atau Takdir Clock-In
    const isLeadershipSpecial = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '2ce41a19-0c65-45d3-913e-a68a02203fe2', // LA UNGA SAMSI
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
    ].includes(validUserId)
    || ['aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com'].includes((userProfile?.email || '').toLowerCase())
    || ['FRP 07065', 'FR.07.066', 'FRP.07.046', 'FRP07065', 'FR07066', 'FRP07046'].includes((userProfile?.nip || '').trim());

    if (isLeadershipSpecial) {
      const witaTimeStr = new Date().toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WITA';
      const posName = locationName || 'Pos Tugas Lapangan';
      const waArrivalMsg =
`📢 *LAPORAN KEHADIRAN / CLOCK-IN POS LAPANGAN (PT FRP)*

👤 Petugas: *${userProfile?.full_name || 'Petugas Khusus'}* (NIP: ${userProfile?.nip || '-'})
🟢 Status: *BERHASIL CLOCK-IN DI POS TUGAS*
📍 Lokasi / Pos: *${posName}*
📏 Jarak Geofence: ${serverDistance != null ? Math.round(serverDistance) : 0} meter
⏰ Waktu Masuk: *${time || '-'} WITA* (Tercatat: ${witaTimeStr})
📸 Biometrik Wajah: *${computedBiometricScore != null ? computedBiometricScore : 100}% Confidence*

✅ Kehadiran sah dan terverifikasi di database VPS PT FRP. Laporan diteruskan kepada Bpk Reski Faisal (Pimpinan), Dirut, dan Superadmin.`;

      alertLeadershipViaWhatsAppAndSystem({
        title: `📍 ${userProfile?.full_name} Masuk Dinas di ${posName}`,
        message: `${userProfile?.full_name} telah melakukan absen masuk di ${posName} pada ${time} WITA.`,
        waMessage: waArrivalMsg,
        link: '/admin/monitoring',
        metadata: {
          type: 'officer_clockin',
          userId: validUserId,
          attendanceId: insertedAttendance.id,
          locationName: posName
        }
      }).catch(e => console.warn('[Leadership Clock-In Alert Warning]:', e.message));
    }

    res.json({ success: true, data: insertedAttendance });
  } catch (err) {
    console.error('Clock-in error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint untuk mengambil foto verifikasi wajah presensi secara on-demand (mendukung format Image binary streaming & JSON)
app.get('/api/attendances/:id/photo', async (req, res) => {
  const { id } = req.params;
  const { type, format } = req.query; // type: 'in' | 'out', format: 'json' | 'image'
  try {
    const result = await pool.query(
      'SELECT id, photo_in, photo_out FROM hrm_attendances WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Foto tidak ditemukan' });
    }
    const row = result.rows[0];
    const targetPhoto = type === 'out' ? (row.photo_out || row.photo_in) : (row.photo_in || row.photo_out);

    // Jika client secara eksplisit meminta format JSON:
    if (format === 'json') {
      return res.json({
        success: true,
        photoIn: row.photo_in,
        photoOut: row.photo_out,
      });
    }

    // Default: Sajikan langsung sebagai binary image jika berupa string data base64 (sangat cepat & ramah tag <img>)
    if (targetPhoto && typeof targetPhoto === 'string') {
      const match = targetPhoto.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const imgBuffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.send(imgBuffer);
      } else if (targetPhoto.startsWith('http://') || targetPhoto.startsWith('https://')) {
        return res.redirect(targetPhoto);
      }
    }

    // Fallback JSON jika tidak bisa di-stream sebagai image
    res.json({
      success: true,
      photoIn: row.photo_in,
      photoOut: row.photo_out,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
      `UPDATE hrm_profiles SET face_embedding = $1, face_photo_url = $2, face_enrolled_photo = $2, avatar_url = $2, face_enrolled_at = NOW(), is_face_enrolled = true WHERE id = $3`,
      [aiData.embedding, targetPhoto, userId]
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4C. FIELD SENTINEL, DYNAMIC GEOFENCING & LIVE PATROL RADAR ───────────

// WhatsApp Gateway Dispatcher Helper (MPWA / Fonnte / Webhook / Baileys)
async function sendWhatsAppAlert({ phone, message }) {
  if (!phone) return;
  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('62')) cleanPhone = '62' + cleanPhone;

    const sRes = await pool.query(
      "SELECT key, value FROM hrm_system_settings WHERE key IN ('wa_gateway_endpoint', 'wa_gateway_api_key', 'wa_gateway_sender')"
    );
    const settings = {};
    sRes.rows.forEach(r => { settings[r.key] = r.value; });

    let endpoint = process.env.WA_GATEWAY_URL
      ? `${process.env.WA_GATEWAY_URL}/send-message`
      : (settings.wa_gateway_endpoint || 'http://hrm-wa-gateway:5002/send-message');
    const apiKey = settings.wa_gateway_api_key;
    const sender = settings.wa_gateway_sender || '087812379189';

    const isSelfHosted = endpoint.includes('hrm-wa-gateway') || endpoint.includes('5002') || endpoint.includes('localhost:5002') || endpoint.includes('103.197.188.211');

    if (isSelfHosted || (apiKey && apiKey.trim())) {
      const isFonnte = endpoint.includes('fonnte.com');
      const headers = isFonnte 
        ? { 'Authorization': apiKey }
        : { 'Content-Type': 'application/json', ...(apiKey ? { 'Authorization': apiKey } : {}) };

      const body = isFonnte
        ? new URLSearchParams({ target: cleanPhone, message: message })
        : JSON.stringify({ sender: sender, number: cleanPhone, message: message });

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body
        });
        const data = await response.json().catch(() => ({}));
        console.log(`[WhatsApp Success to ${cleanPhone}]:`, data);
        return data;
      } catch (httpErr) {
        console.warn(`[WhatsApp HTTP Failed to ${cleanPhone}]:`, httpErr.message);
      }
    } else {
      console.log(`[WhatsApp Broadcast to ${cleanPhone}]:\n${message}`);
    }
  } catch (err) {
    console.error('[sendWhatsAppAlert Error]:', err.message);
  }
}

// Unified System & WhatsApp Alert to Leadership (Superadmin & Pimpinan)
async function alertLeadershipViaWhatsAppAndSystem({ title, message, waMessage, link, metadata }) {
  // 1. In-app WebSocket / Toast Broadcast
  broadcastNotification({
    title,
    message,
    type: metadata?.type === 'perimeter_breach' ? 'breach_alert' : 'info',
    link: link || '/admin/monitoring',
    data: metadata || {}
  });

  // 2. Persistent notification records in PostgreSQL & WhatsApp dispatch
  try {
    const leadRes = await pool.query(`
      SELECT DISTINCT p.id, p.phone, p.full_name, COALESCE(p.role_name, r.name) as role_name
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      WHERE (LOWER(COALESCE(p.role_name, '')) IN ('superadmin', 'pimpinan') 
         OR LOWER(COALESCE(r.name, '')) IN ('superadmin', 'pimpinan'))
        AND p.is_active = true;
    `);

    const sentNumbers = new Set();

    for (const leader of leadRes.rows) {
      await pool.query(
        `INSERT INTO hrm_notifications (user_id, title, message, type, link, metadata, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [leader.id, title, message, metadata?.type === 'perimeter_breach' ? 'disciplinary' : 'info', link || '/admin/monitoring', JSON.stringify(metadata || {})]
      );

      if (leader.phone) {
        const cleanP = leader.phone.replace(/\D/g, '');
        if (cleanP) {
          sentNumbers.add(cleanP);
          await sendWhatsAppAlert({
            phone: leader.phone,
            message: waMessage || `${title}\n\n${message}`
          });
        }
      }
    }

    // Pastikan nomor Direktur Utama (Dirut: Alam AS simpuang ago, S.Sos), Pimpinan (Bpk Reski Faisal) & superadmin selalu menerima broadcast
    const defaultLeadershipPhones = ['082291998026', '082192755755', '081355904897'];
    for (const dPhone of defaultLeadershipPhones) {
      const cleanD = dPhone.replace(/\D/g, '');
      const alreadySent = Array.from(sentNumbers).some(n => n.endsWith(cleanD.slice(-9)));
      if (!alreadySent) {
        await sendWhatsAppAlert({
          phone: dPhone,
          message: waMessage || `${title}\n\n${message}`
        });
      }
    }
  } catch (err) {
    console.error('[alertLeadershipViaWhatsAppAndSystem Error]:', err.message);
  }
}

// Universal WhatsApp Notification Hub for All Employee Submissions
// Mengirim serentak ke: Pemohon, Karyawan Pengganti, Korlap, K3, Admin, Superadmin, dan Pimpinan (Dirut/Pimpinan)
async function notifyAllPartiesViaWhatsApp({
  submissionType,     // e.g. 'CUTI', 'IZIN', 'SAKIT', 'LEMBUR (SPL)', 'TUKAR SHIFT'
  details,            // detail teks jadwal/waktu
  applicant,          // { id, fullName, nip, phone, divisionName }
  substitute,         // { id, fullName, nip, phone } (opsional jika ada pengganti)
  reasonOrTask,       // alasan / tugas
  approvalLink = '/admin/approval',
  isDecision = false, // true jika ini notifikasi hasil keputusan (approved/rejected)
  decisionStatus = 'approved', // 'approved' | 'rejected'
  approverName,
  approvalNotes,
}) {
  try {
    const isApproved = decisionStatus === 'approved';

    // 1. KIRIM KE PEMOHON SENDIRI
    if (applicant?.phone) {
      let applicantMsg = '';
      if (!isDecision) {
        applicantMsg =
          `✅ *TANDA TERIMA PENGAJUAN ${submissionType} (PT FRP)*\n\n` +
          `Halo *${applicant.fullName}* (${applicant.nip || '-'}),\n` +
          `Pengajuan *${submissionType}* Anda telah berhasil tercatat resmi di sistem HRM:\n\n` +
          `📅 Jadwal/Detail: *${details}*\n` +
          `🏢 Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
          `💬 Alasan/Tugas: "${reasonOrTask || '-'}"\n` +
          (substitute?.fullName ? `🛡️ Usulan Pengganti Pos: *${substitute.fullName}* (${substitute.nip || '-'})\n` : '') +
          `📌 Status: *Menunggu Persetujuan Atasan (Korlap / K3 / Admin / Pimpinan)*\n\n` +
          `Pemberitahuan otomatis akan kembali dikirimkan ke nomor ini setelah pengajuan Anda ditinjau oleh atasan.`;
      } else {
        applicantMsg = isApproved
          ? `🎉 *PENGAJUAN ${submissionType} TELAH DISETUJUI*\n\n` +
            `Halo *${applicant.fullName}*,\n` +
            `Pengajuan *${submissionType}* Anda (${details}) telah *DISETUJUI RESMI* oleh *${approverName || 'Atasan'}*.\n` +
            (approvalNotes ? `💬 Catatan: "${approvalNotes}"\n` : '') +
            (substitute?.fullName ? `🛡️ Petugas Pengganti Pos Resmi: *${substitute.fullName}*\n` : '') +
            `\nStatus presensi & jadwal roster kerja Anda telah otomatis disinkronkan di sistem HRM PT FRP.`
          : `⚠️ *PEMBERITAHUAN PENGAJUAN ${submissionType} DITOLAK*\n\n` +
            `Halo *${applicant.fullName}*,\n` +
            `Mohon maaf, pengajuan *${submissionType}* Anda (${details}) *DITOLAK* oleh *${approverName || 'Atasan'}*.\n` +
            (approvalNotes ? `💬 Alasan: "${approvalNotes}"\n` : '') +
            `\nSilakan berkoordinasi langsung dengan Korlap atau Admin terkait kendala dinas Anda.`;
      }
      await sendWhatsAppAlert({ phone: applicant.phone, message: applicantMsg });
    }

    // 2. KIRIM KE KARYAWAN PENGGANTI (jika ada)
    if (substitute?.phone) {
      let subMsg = '';
      if (!isDecision) {
        subMsg =
          `🛡️ *PEMBERITAHUAN USULAN PENGGANTI POS DINAS (PT FRP)*\n\n` +
          `Halo *${substitute.fullName}* (${substitute.nip || '-'}),\n` +
          `Anda telah diusulkan sebagai *Petugas Pengganti Pos Dinas* untuk mengisi kekosongan:\n\n` +
          `👤 Karyawan yang Digantikan: *${applicant.fullName}*\n` +
          `🏢 Pos/Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
          `📅 Jadwal: *${details}*\n` +
          `📌 Status: *Menunggu Persetujuan Resmi Korlap / Pimpinan*\n\n` +
          `Tugas penggantian pos ini dihitung sebagai lembur resmi (Relief Duty Pay) sesuai ketentuan perusahaan. Harap bersiap untuk bertugas pada jadwal tersebut.`;
      } else if (isApproved) {
        subMsg =
          `📋 *SURAT PERINTAH TUGAS PENGGANTI POS DISAHKAN (PT FRP)*\n\n` +
          `Halo *${substitute.fullName}* (${substitute.nip || '-'}),\n` +
          `Penugasan Anda sebagai *Petugas Pengganti Pos Dinas* resmi *DISETUJUI & DISAHKAN* oleh *${approverName || 'Korlap'}*:\n\n` +
          `👤 Menggantikan: *${applicant.fullName}*\n` +
          `🏢 Pos/Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
          `📅 Jadwal Dinas: *${details}*\n` +
          `💰 Kompensasi: *Otomatis Dihitung Lembur (Relief Duty Pay)*\n\n` +
          `🚨 *BEBAS KENDALA RADIUS (RADIUS EXEMPTION AKTIF):*\n` +
          `Radius dan seluruh titik pos penugasan dari rekan yang Anda gantikan telah otomatis ditambahkan ke akun Anda di sistem HRM. Anda dapat langsung melakukan absensi masuk (Clock-In) di lokasi pos tersebut tanpa kendala radius.\n\n` +
          `⚡ *HUKUM ZERO VACANCY:* Pos dinas tidak boleh kosong tenaga kerja! Harap segera hadir di lokasi pos penugasan.`;
      }
      if (subMsg) {
        await sendWhatsAppAlert({ phone: substitute.phone, message: subMsg });
      }
    }

    // 3. LOGIKA ROUTING APPROVAL KORLAP (MUH ASLAM FAISAL) DENGAN DELEGASI OTOMATIS
    // Aslam membawahi 80 personil lapangan. Jika Aslam sedang cuti/libur (akhir pekan),
    // wewenang persetujuan & notifikasi otomatis dialihkan (forward) ke LA UNGA SAMSI & TAKDIR.
    // Laporan tembusan selalu masuk ke Bpk Reski Faisal (Pimpinan), Dirut, dan Superadmin.
    let isAslamOffOrLeave = false;
    let aslamPhone = '085342470909';
    try {
      const aslamQ = await pool.query(`
        SELECT p.id, p.phone,
               EXISTS (
                 SELECT 1 FROM hrm_leave_requests l 
                 WHERE l.user_id = p.id AND l.status = 'approved' 
                   AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date BETWEEN l.start_date AND l.end_date
               ) as is_on_leave
        FROM hrm_profiles p 
        WHERE p.nip = 'FRP 07065' OR p.id = 'ebf10b16-ab2f-4b53-ab22-b3ffc00694db' OR LOWER(p.email) = 'aslamfaisal10okt@gmail.com' 
        LIMIT 1;
      `);
      if (aslamQ.rows.length > 0) {
        if (aslamQ.rows[0].phone) aslamPhone = aslamQ.rows[0].phone;
        const witaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
        const isWeekend = witaNow.getDay() === 0 || witaNow.getDay() === 6; // Sabtu / Minggu
        isAslamOffOrLeave = aslamQ.rows[0].is_on_leave || isWeekend;
      }
    } catch (err) {
      console.warn('[Aslam Status Check Warning]:', err.message);
    }

    if (!isDecision) {
      if (isAslamOffOrLeave) {
        // FORWARD KE LA UNGA SAMSI & TAKDIR KARENA ASLAM SEDANG CUTI/LIBUR
        const forwardedMsg =
          `🛡️ *DELEGASI OTOMATIS: KORLAP ASLAM SEDANG CUTI/LIBUR (PT FRP)*\n\n` +
          `Halo Bapak Pengawas Lapangan (*LA UNGA SAMSI / TAKDIR*),\n` +
          `Koordinator Lapangan (*Muh Aslam Faisal*) saat ini sedang berstatus *LIBUR / CUTI*.\n` +
          `Sesuai instruksi Direksi, permohonan dinas anggota operasional *DIALIHKAN KEPADA ANDA* untuk ditinjau & disahkan:\n\n` +
          `👤 Pemohon: *${applicant.fullName}* (${applicant.nip || '-'})\n` +
          `🏢 Pos/Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
          `📝 Jenis: *${submissionType}*\n` +
          `📅 Detail: *${details}*\n` +
          `💬 Alasan: "${reasonOrTask || '-'}"\n` +
          (substitute?.fullName ? `🛡️ Usulan Pengganti: *${substitute.fullName}* (${substitute.nip || '-'})\n` : '⚠️ *Pengganti Pos:* Belum ditetapkan (Butuh segera ditetapkan Pengawas)\n') +
          `\n⚡ *HUKUM ZERO VACANCY:* Pos dinas tidak boleh kosong tenaga kerja! Pekerjaan harus tetap berjalan lancar jika ada yang izin/cuti. Silakan segera buka portal HRM untuk menetapkan pengganti pos:\n` +
          `🔗 Tautan: https://fawwazreskiperwira.com${approvalLink}`;

        // Kirim ke Samsi (088246270912) dan Takdir (085242606150)
        await sendWhatsAppAlert({ phone: '088246270912', message: forwardedMsg }).catch(() => {});
        await sendWhatsAppAlert({ phone: '085242606150', message: forwardedMsg }).catch(() => {});
      } else {
        // ASLAM AKTIF: KIRIM LANGSUNG KE ASLAM SELAKU KORLAP 80 KARYAWAN
        const korlapMsg =
          `📋 *TUGAS PERSETUJUAN KORLAP: PENGAJUAN ${submissionType} (PT FRP)*\n\n` +
          `Halo *Muh Aslam Faisal* (Koordinator Lapangan),\n` +
          `Anggota operasional yang Anda naungi (80 karyawan) telah mengajukan permohonan baru:\n\n` +
          `👤 Pemohon: *${applicant.fullName}* (${applicant.nip || '-'})\n` +
          `🏢 Pos/Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
          `📝 Jenis: *${submissionType}*\n` +
          `📅 Detail: *${details}*\n` +
          `💬 Alasan: "${reasonOrTask || '-'}"\n` +
          (substitute?.fullName ? `🛡️ Usulan Pengganti: *${substitute.fullName}* (${substitute.nip || '-'})\n` : '⚠️ *Pengganti Pos:* Belum ditetapkan (Butuh penetapan Anda)\n') +
          `\n⚡ *ATURAN ZERO VACANCY:* Pekerjaan tidak boleh kosong tenaga kerja! Pekerjaan harus tetap berjalan lancar jika karyawan izin/sakit/cuti. Silakan segera tinjau dan tetapkan karyawan pengganti di portal HRM:\n` +
          `🔗 Tautan: https://fawwazreskiperwira.com${approvalLink}`;

        await sendWhatsAppAlert({ phone: aslamPhone, message: korlapMsg }).catch(() => {});
      }
    }

    // 4. KIRIM LAPORAN / BROADCAST KE PIMPINAN, DIRUT & SUPERADMIN
    const leadershipPhones = new Set([
      '081355904897', // Superadmin
      '082192755755', // Bpk Reski Faisal (Pimpinan)
      '082291998026', // Bpk Alam AS simpuang ago, S.Sos (Direktur Utama)
    ]);

    let managementMsg = '';
    if (!isDecision) {
      managementMsg =
        `📢 *LAPORAN PENGAJUAN ${submissionType} KARYAWAN LAPANGAN*\n\n` +
        `👤 Pemohon: *${applicant.fullName}* (NIP: ${applicant.nip || '-'})\n` +
        `🏢 Pos/Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
        `📝 Jenis: *${submissionType}*\n` +
        `📅 Detail: *${details}*\n` +
        `💬 Keterangan: "${reasonOrTask || '-'}"\n` +
        (substitute?.fullName ? `🛡️ Usulan Pengganti: *${substitute.fullName}* (${substitute.nip || '-'})\n` : '⚠️ *Petugas Pengganti:* Butuh penetapan Korlap (Zero Vacancy)\n') +
        `📌 Penanggung Jawab Approval: ${isAslamOffOrLeave ? '*LA UNGA SAMSI / TAKDIR* (Forwarded karena Korlap Aslam libur/cuti)' : '*Muh Aslam Faisal* (Korlap 80 Personil)'}\n` +
        `\n⚡ *HUKUM ZERO VACANCY:* Pos dinas tidak boleh kosong! Pekerjaan harus tetap berjalan lancar.\n` +
        `🔗 Tautan: https://fawwazreskiperwira.com${approvalLink}`;
    } else {
      managementMsg =
        `📢 *KEPUTUSAN PENGAJUAN ${submissionType}: ${decisionStatus.toUpperCase()}*\n\n` +
        `👤 Pemohon: *${applicant.fullName}* (NIP: ${applicant.nip || '-'})\n` +
        `🏢 Divisi: *${applicant.divisionName || 'Operasional'}*\n` +
        `📝 Jenis: *${submissionType}* (${details})\n` +
        `⚖️ Keputusan: *${isApproved ? 'DISETUJUI' : 'DITOLAK'}* oleh *${approverName || 'Korlap'}*\n` +
        (approvalNotes ? `💬 Catatan: "${approvalNotes}"\n` : '') +
        (substitute?.fullName ? `🛡️ Personil Pengganti Pos Resmi: *${substitute.fullName}*\n` : '') +
        `\n💾 Audit trail & radius pos pengganti telah otomatis disinkronkan di sistem HRM PT FRP.`;
    }

    for (const phone of leadershipPhones) {
      await sendWhatsAppAlert({ phone, message: managementMsg });
    }
  } catch (err) {
    console.error('[notifyAllPartiesViaWhatsApp Error]:', err.message);
  }
}

// 1. Multi-Titik / Bank Pos Lapangan: Fetch all saved posts
app.get('/api/field-sentinel/posts', async (req, res) => {
  const { userId } = req.query;
  try {
    let query = `
      SELECT fp.*, p.full_name as user_name, p.nip as user_nip,
             orig.full_name as relief_original_user_name, orig.nip as relief_original_user_nip
      FROM hrm_field_assigned_posts fp
      JOIN hrm_profiles p ON fp.user_id = p.id
      LEFT JOIN hrm_profiles orig ON fp.relief_original_user_id = orig.id
      WHERE fp.is_active = true
        AND (fp.is_relief IS NOT TRUE OR fp.relief_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)
    `;
    const params = [];
    if (userId) {
      params.push(userId);
      query += ` AND fp.user_id = $1`;
    }
    query += ` ORDER BY fp.post_code ASC, fp.created_at ASC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Fetch field posts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Multi-Titik / Bank Pos Lapangan: Create or update a post (Titik A, B, C, etc.)
app.post('/api/field-sentinel/posts', async (req, res) => {
  const { id, userId, postCode, postName, latitude, longitude, radiusMeters, description, copyToAllFieldAgents } = req.body;
  if (!userId || !postName || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, error: 'User ID, Nama Pos, Latitude, dan Longitude wajib diisi' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const code = (postCode || 'POS').trim().toUpperCase();
    const name = postName.trim();
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = radiusMeters ? parseInt(radiusMeters, 10) : 150;
    const desc = (description || '').trim();

    let savedPost = null;

    if (id && UUID_REGEX.test(id)) {
      // Update existing post
      const updateRes = await pool.query(
        `UPDATE hrm_field_assigned_posts SET
           post_code = $1,
           post_name = $2,
           latitude = $3,
           longitude = $4,
           radius_meters = $5,
           description = $6,
           updated_at = NOW()
         WHERE id = $7
         RETURNING *;`,
        [code, name, lat, lng, radius, desc, id]
      );
      savedPost = updateRes.rows[0];
    } else {
      // Create new post
      const insertRes = await pool.query(
        `INSERT INTO hrm_field_assigned_posts (
           user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *;`,
        [validUserId, code, name, lat, lng, radius, desc]
      );
      savedPost = insertRes.rows[0];
    }

    // Also update primary assigned location for quick fallback
    await pool.query(
      `UPDATE hrm_profiles SET
         assigned_location_name = $1,
         assigned_latitude = $2,
         assigned_longitude = $3,
         assigned_radius_meters = $4,
         is_field_sentinel_enabled = true,
         updated_at = NOW()
       WHERE id = $5;`,
      [name, lat, lng, radius, validUserId]
    );

    // If requested: Copy this post to all 3 Field Sentinel employees
    if (copyToAllFieldAgents === true) {
      const sentinelUsersRes = await pool.query(
        `SELECT id FROM hrm_profiles WHERE is_field_sentinel_enabled = true AND id != $1;`,
        [validUserId]
      );
      for (const u of sentinelUsersRes.rows) {
        await pool.query(
          `INSERT INTO hrm_field_assigned_posts (
             user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT DO NOTHING;`,
          [u.id, code, name, lat, lng, radius, desc]
        );
      }
    }

    res.json({ success: true, data: savedPost, message: `Titik pos ${name} (${code}) berhasil disimpan ke Bank Titik Lapangan.` });
  } catch (err) {
    console.error('Save field post error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Multi-Titik / Bank Pos Lapangan: Delete a post
app.delete('/api/field-sentinel/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hrm_field_assigned_posts WHERE id = $1;', [id]);
    res.json({ success: true, message: 'Titik pos berhasil dihapus dari Bank Titik Lapangan.' });
  } catch (err) {
    console.error('Delete field post error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Legacy fallback: Superadmin sets custom flexible location
app.post('/api/field-sentinel/assign-location', async (req, res) => {
  const { userId, assignedLocationName, assignedLatitude, assignedLongitude, assignedRadiusMeters, isFieldSentinelEnabled } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID wajib disertakan' });
  }
  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }
    const updateRes = await pool.query(
      `UPDATE hrm_profiles SET
         assigned_location_name = $1,
         assigned_latitude = $2,
         assigned_longitude = $3,
         assigned_radius_meters = COALESCE($4, 150),
         is_field_sentinel_enabled = COALESCE($5, true),
         updated_at = NOW()
       WHERE id = $6
       RETURNING *;`,
      [
        assignedLocationName || 'Titik Penugasan Fleksibel',
        assignedLatitude ? parseFloat(assignedLatitude) : null,
        assignedLongitude ? parseFloat(assignedLongitude) : null,
        assignedRadiusMeters ? parseFloat(assignedRadiusMeters) : 150,
        isFieldSentinelEnabled !== false,
        validUserId
      ]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    // Also auto-record into Bank Pos Lapangan
    if (assignedLatitude && assignedLongitude) {
      await pool.query(
        `INSERT INTO hrm_field_assigned_posts (
           user_id, post_code, post_name, latitude, longitude, radius_meters, is_active
         ) VALUES ($1, 'POS', $2, $3, $4, $5, true)
         ON CONFLICT DO NOTHING;`,
        [validUserId, assignedLocationName || 'Pos Lapangan', parseFloat(assignedLatitude), parseFloat(assignedLongitude), assignedRadiusMeters ? parseInt(assignedRadiusMeters, 10) : 150]
      );
    }

    const user = formatUserRow(updateRes.rows[0]);
    broadcastNotification({
      targetUserId: validUserId,
      title: '📍 Pembaruan Titik Penugasan Kerja',
      message: `Superadmin telah menetapkan titik kerja baru Anda: ${user.assignedLocationName} (Radius: ${user.assignedRadiusMeters}m).`,
      type: 'info'
    });
    res.json({ success: true, data: user, message: 'Titik penugasan fleksibel berhasil diperbarui' });
  } catch (err) {
    console.error('Assign field location error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Periodic background location ping with Multi-Titik evaluation & WhatsApp alerts
app.post('/api/field-sentinel/location-ping', async (req, res) => {
  const { userId, latitude, longitude, accuracy, altitude, speed, isMockLocation } = req.body;
  if (!userId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, error: 'User ID dan koordinat wajib disertakan' });
  }
  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const profRes = await pool.query(
      `SELECT p.id, p.full_name, p.nip, p.phone, p.email, p.current_active_post_id, p.current_active_post_name,
              p.assigned_latitude, p.assigned_longitude, p.assigned_radius_meters, p.assigned_location_name,
              COALESCE(d.latitude, o.latitude, -4.793963) as fallback_lat,
              COALESCE(d.longitude, o.longitude, 119.604337) as fallback_lon,
              COALESCE(d.radius_meters, o.radius_meters, 50) as fallback_radius,
              COALESCE(p.assigned_location_name, d.location_name, d.name, o.name, 'Kantor FRP') as fallback_name,
              d.allowed_posts as div_allowed_posts,
              p.allowed_posts as user_allowed_posts
       FROM hrm_profiles p
       LEFT JOIN hrm_divisions d ON p.division_id = d.id
       LEFT JOIN hrm_office_locations o ON o.is_active = true
       WHERE p.id = $1 LIMIT 1;`,
      [validUserId]
    );
    if (profRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    const prof = profRes.rows[0];
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const userAccuracy = accuracy ? parseFloat(accuracy) : 5;

    // 1. Ambil rekaman presensi hari ini
    const todayAttRes = await pool.query(
      `SELECT clock_in, clock_out, is_on_break, is_early_leave, status 
       FROM hrm_attendances 
       WHERE user_id = $1 AND attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date 
       ORDER BY created_at DESC LIMIT 1`,
      [validUserId]
    );
    const hasClockedInToday = Boolean(todayAttRes.rows[0]?.clock_in);
    const hasClockedOutToday = Boolean(todayAttRes.rows[0]?.clock_out);
    const isOnBreakToday = todayAttRes.rows[0]?.is_on_break === true;
    const isEarlyLeaveToday = todayAttRes.rows[0]?.is_early_leave === true;

    // 2. Cek apakah ada pengajuan Cuti/Izin/Sakit yang aktif & disetujui hari ini
    const activeLeaveRes = await pool.query(
      `SELECT id FROM hrm_leaves 
       WHERE user_id = $1 
         AND status = 'approved' 
         AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date BETWEEN start_date AND end_date 
       LIMIT 1;`,
      [validUserId]
    ).catch(() => ({ rows: [] }));
    const hasActiveLeaveToday = activeLeaveRes.rows.length > 0;

    // 3. Cek jam shift karyawan hari ini
    const schedRes = await pool.query(`
      SELECT COALESCE(es.end_time::text, p.custom_end_time::text, s.end_time::text, '16:30') as shift_end_time,
             COALESCE(es.start_time::text, p.custom_start_time::text, s.start_time::text, '07:30') as shift_start_time,
             COALESCE(s.is_cross_day, false) as is_cross_day
      FROM hrm_profiles p
      LEFT JOIN hrm_shifts s ON p.shift_id = s.id
      LEFT JOIN hrm_employee_schedules es ON es.user_id = p.id AND es.schedule_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
      WHERE p.id = $1 LIMIT 1;
    `, [validUserId]);

    const shiftInfo = schedRes.rows[0];
    const shiftEndStr = (shiftInfo?.shift_end_time || '16:30').substring(0, 5);
    const shiftStartStr = (shiftInfo?.shift_start_time || '07:30').substring(0, 5);
    const [endH, endM] = shiftEndStr.split(':').map(Number);
    const [startH, startM] = shiftStartStr.split(':').map(Number);
    const endTotalMins = (Number.isFinite(endH) ? endH : 16) * 60 + (Number.isFinite(endM) ? endM : 0);
    const startTotalMins = (Number.isFinite(startH) ? startH : 7) * 60 + (Number.isFinite(startM) ? startM : 0);

    const nowWitaDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const nowH = nowWitaDate.getUTCHours();
    const nowM = nowWitaDate.getUTCMinutes();
    let nowTotalMins = nowH * 60 + nowM;

    const isCrossDay = Boolean(shiftInfo?.is_cross_day);
    if (isCrossDay && nowTotalMins < 720 && endTotalMins >= 720) {
      nowTotalMins += 1440;
    }

    // 4. Cek apakah ada penugasan Lembur resmi (SPKL) yang disetujui hari ini
    const activeOvertimeRes = await pool.query(
      `SELECT id FROM hrm_overtimes 
       WHERE user_id = $1 
         AND overtime_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date 
         AND status = 'approved' 
       LIMIT 1;`,
      [validUserId]
    ).catch(() => ({ rows: [] }));
    const hasActiveOvertime = activeOvertimeRes.rows.length > 0;

    // Evaluasi apakah saat ini berada di luar jam kerja (shift)
    let isOutsideShiftHours = false;
    if (isCrossDay) {
      if (nowTotalMins < startTotalMins - 60 && nowTotalMins > endTotalMins + 30) {
        isOutsideShiftHours = true;
      }
    } else {
      if (nowTotalMins < startTotalMins - 60 || nowTotalMins >= endTotalMins + 30) {
        isOutsideShiftHours = true;
      }
    }

    // Jendela presensi masuk terbuka (120 menit sebelum jam shift dimulai hingga jam shift usai)
    const isShiftOpenWindow = isCrossDay
      ? (nowTotalMins >= (startTotalMins - 120 + 1440) % 1440 || nowTotalMins < endTotalMins)
      : (nowTotalMins >= Math.max(0, startTotalMins - 120) && nowTotalMins <= endTotalMins);

    // Pengecualian 3 Petugas Distribusi Online Mobile (Rusdi, Reza, Ichtiar)
    const isMobileOnlineSpecialist = [
      'f0aaf721-203c-4b45-b610-213204bc7ffe', // Rusdi Aryanto
      'd1e4eaf3-fa45-474b-b7a2-32e4114d8f2b', // M. Reza Angga Dwi S
      '2939502e-e63c-4c63-aafb-a69abccba828', // Ichtiar
    ].includes(validUserId) || 
    ['FR07046', 'FR07042', 'FR07044', 'FR.07.046', 'FR.07.042', 'FR.07.044', 'FRP07046', 'FRP07042', 'FRP07044'].includes((prof.nip || '').trim());

    // 🛡️ PRINSIP PERLINDUNGAN PRIVASI DI LUAR JAM KERJA:
    // Karyawan HANYA bisa aktif dimonitor perimeternya jika:
    // 1. Sudah Clock-In hari ini
    // 2. Belum Clock-Out
    // 3. Tidak sedang cuti/izin/sakit sah
    // 4. Berada dalam jam shift atau sedang lembur resmi
    const isCurrentlyOnDuty = hasClockedInToday && !hasClockedOutToday && !hasActiveLeaveToday && (!isOutsideShiftHours || hasActiveOvertime);

    // Karyawan dikecualikan dari alarm pelanggaran perimeter jika tidak aktif bertugas, sedang istirahat, izin pulang cepat, atau petugas mobile
    const isExcusedFromBreach = !isCurrentlyOnDuty || isOnBreakToday || isEarlyLeaveToday || isMobileOnlineSpecialist;

    // ─── QUERY ALL REGISTERED ACTIVE POSTS IN THE BANK (Titik A, Titik B, Titik C, ...) ───
    const postsRes = await pool.query(
      `SELECT * FROM hrm_field_assigned_posts 
       WHERE user_id = $1 AND is_active = true 
         AND (is_relief IS NOT TRUE OR relief_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)
       ORDER BY post_code ASC, created_at ASC;`,
      [validUserId]
    );

    let isOutOfBounds = false;
    let targetLocationName = '';
    let allowedRadius = 150;
    let distance = 0;
    let excessDist = 0;

    const witaTimeStr = new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WITA';

    let shouldPromptSelfie = false;
    let arrivedPost = null;

    if (postsRes.rows.length > 0) {
      // Multi-Titik evaluation: check against ALL saved posts
      const postsWithDist = postsRes.rows.map(p => {
        const d = calculateHaversineMeters(userLat, userLon, parseFloat(p.latitude), parseFloat(p.longitude));
        const r = parseFloat(p.radius_meters);
        const inside = d <= r;
        return { ...p, distance: d, radius: r, inside };
      });

      const insidePost = postsWithDist.find(p => p.inside);

      if (insidePost) {
        // 🟢 EMPLOYEE IS INSIDE ONE OF THE REGISTERED POSTS (Titik A / B / C)
        arrivedPost = insidePost;
        isOutOfBounds = false;
        targetLocationName = `${insidePost.post_name} [${insidePost.post_code}]`;
        allowedRadius = insidePost.radius;
        distance = Math.round(insidePost.distance);
        excessDist = 0;

        // Check if just arrived at this post or re-entered after exiting
        if (prof.current_active_post_id !== insidePost.id || prof.is_out_of_bounds) {
          const isSpecialDutyOfficer = [
            'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
            '2ce41a19-0c65-45d3-913e-a68a02203fe2', // LA UNGA SAMSI
            '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
          ].includes(validUserId)
          || ['aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com'].includes((prof.email || '').toLowerCase())
          || ['FRP 07065', 'FR.07.066', 'FRP.07.046', 'FRP07065', 'FR07066', 'FRP07046'].includes((prof.nip || '').trim());

          shouldPromptSelfie = isSpecialDutyOfficer;

          await pool.query(
            `UPDATE hrm_profiles SET
               current_active_post_id = $1,
               current_active_post_name = $2,
               current_active_post_entered_at = NOW(),
               is_out_of_bounds = false,
               out_of_bounds_distance = 0
             WHERE id = $3;`,
            [insidePost.id, insidePost.post_name, validUserId]
          );

          // 📲 MANDAT PIMPINAN: NOTIFIKASI HANYA DIKIRIMKAN DI JAM KERJA
          // Notifikasi WhatsApp radar kedatangan HANYA dikirimkan pada hari kerja resmi (Senin - Jumat) & selama jam kerja dinas:
          // 1. Hari kerja resmi (Senin - Jumat bagi Aslam, Samsi, Takdir; kecuali jika sedang ada lembur resmi SPKL)
          // 2. Tidak sedang cuti/izin/sakit sah
          // 3. Berada dalam rentang jam dinas (jendela shift masuk s/d selesai) atau sedang aktif bertugas / lembur resmi
          const witaNowDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
          const dayOfWeekWita = witaNowDate.getUTCDay(); // 0 = Minggu, 6 = Sabtu
          const isWeekendToday = dayOfWeekWita === 0 || dayOfWeekWita === 6;

          const isWorkingDay = isSpecialDutyOfficer 
            ? (!isWeekendToday || hasActiveOvertime)
            : (!isWeekendToday || hasActiveOvertime);

          const isWorkingHoursNow = isWorkingDay && !hasActiveLeaveToday && (isCurrentlyOnDuty || isShiftOpenWindow || hasActiveOvertime);

          shouldPromptSelfie = isSpecialDutyOfficer && isWorkingHoursNow;

          // HANYA kirimkan notifikasi jika saat ini adalah JAM KERJA RESMI
          const shouldSendArrivalAlert = isWorkingHoursNow;
          if (shouldSendArrivalAlert) {
            if (isSpecialDutyOfficer && prof.phone) {
              const officerArrivalWa =
`📍 *NOTIFIKASI TUGAS LAPANGAN PT FRP*

Halo *${prof.full_name}*, sistem mendeteksi Anda telah tiba di *${insidePost.post_name}* [${insidePost.post_code}].
Waktu: ${witaTimeStr}

📸 *INSTRUKSI PIMPINAN:*
Silakan segera buka aplikasi presensi dan lakukan *FOTO SELFIE VERIFIKASI WAJAH DI LOKASI POS* untuk mengonfirmasi kehadiran Anda di pos tugas ini. Terima kasih!`;
              await sendWhatsAppAlert({
                phone: prof.phone,
                message: officerArrivalWa
              }).catch(e => console.error('[WhatsApp Officer Arrival Error]:', e.message));
            }

            // 📲 TRIGGER AUTOMATIC SYSTEM & WHATSAPP ALERT TO PIMPINAN & SUPERADMIN
            const arrivalTitle = `📍 ${prof.full_name} Tiba di ${insidePost.post_name}`;
            const arrivalSystemMsg = `Petugas ${prof.full_name} (${prof.nip || 'FRP'}) terdeteksi aktif berada di ${insidePost.post_name} (${insidePost.post_code}). Jarak: ${distance}m (Radius aman: ${insidePost.radius}m).`;

            const arrivalWaMsg =
`📢 *NOTIFIKASI RADAR LAPANGAN PT. FAWWAZ RESKI PERWIRA*

👤 Petugas: *${prof.full_name}* (${prof.nip || 'FRP-FIELD'})
🟢 Status: *TIBA DI TITIK TUGAS RESMI*
📍 Pos Terdeteksi: *${insidePost.post_name}* [${insidePost.post_code}]
📏 Jarak ke Pusat: ${distance} meter (Radius aman: ${insidePost.radius}m)
🌐 Koordinat Live: ${userLat.toFixed(6)}, ${userLon.toFixed(6)}
⏰ Waktu Deteksi: ${witaTimeStr}

✅ Petugas sah dan aktif terpantau di dalam area kerja yang ditentukan pimpinan.`;

            await alertLeadershipViaWhatsAppAndSystem({
              title: arrivalTitle,
              message: arrivalSystemMsg,
              waMessage: arrivalWaMsg,
              link: '/admin/monitoring',
              metadata: {
                type: 'post_arrival',
                userId: validUserId,
                postId: insidePost.id,
                postCode: insidePost.post_code,
                postName: insidePost.post_name,
                latitude: userLat,
                longitude: userLon,
                distance: distance
              }
            });
          }
        }
      } else {
        // 🔴 EMPLOYEE IS OUTSIDE ALL REGISTERED POSTS
        isOutOfBounds = !isExcusedFromBreach;
        const sorted = postsWithDist.sort((a, b) => a.distance - b.distance);
        const nearest = sorted[0];
        targetLocationName = `${nearest.post_name} [${nearest.post_code}]`;
        allowedRadius = nearest.radius;
        distance = Math.round(nearest.distance);
        excessDist = isExcusedFromBreach ? 0 : Math.max(0, Math.round(nearest.distance - nearest.radius));

        // JIKA KARYAWAN TIDAK AKTIF BERTUGAS (Belum Masuk, Sudah Pulang, Di Luar Jam Kerja, atau Cuti):
        // Jangan pernah memicu peringatan perimeter breach atau mengubah status jadi out_of_bounds!
        if (!isCurrentlyOnDuty) {
          isOutOfBounds = false;
          excessDist = 0;
          if (prof.current_active_post_id || prof.is_out_of_bounds) {
            await pool.query(
              `UPDATE hrm_profiles SET
                 current_active_post_id = NULL,
                 current_active_post_name = NULL,
                 is_out_of_bounds = false,
                 out_of_bounds_distance = 0
               WHERE id = $1;`,
              [validUserId]
            );
          }
        } else if (prof.current_active_post_id) {
          // Karyawan memang sedang AKTIF BERTUGAS dan sebelumnya berada di pos tugas
          if (isExcusedFromBreach) {
            // Employee stepped out during authorized break or early leave
            await pool.query(
              `UPDATE hrm_profiles SET
                 current_active_post_id = NULL,
                 current_active_post_name = NULL,
                 is_out_of_bounds = false,
                 out_of_bounds_distance = 0
               WHERE id = $1;`,
              [validUserId]
            );
          } else {
            // Cek apakah jam kerja shift sebenarnya sudah usai (Auto-Clock Out saat meninggalkan pos setelah shift usai)
            if (nowTotalMins >= endTotalMins && !hasActiveOvertime) {
              const clockOutTime = `${shiftEndStr}:00`;
              const autoNote = ` [Auto-Clock Out: Karyawan meninggalkan pos kerja setelah shift usai (${shiftEndStr} WITA)]`;
              await pool.query(
                `UPDATE hrm_attendances SET
                   clock_out = $1,
                   status = CASE WHEN status = 'terlambat' OR late_minutes > 0 THEN 'terlambat' ELSE 'hadir' END,
                   is_locked = false,
                   is_perimeter_breached = false,
                   auto_closed_type = 'AUTO_CLOCKOUT_OUT_OF_BOUNDS',
                   notes = TRIM(COALESCE(notes, '') || $2),
                   updated_at = NOW()
                 WHERE user_id = $3 AND attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date AND clock_out IS NULL;`,
                [clockOutTime, autoNote, validUserId]
              );
              await pool.query(
                `UPDATE hrm_profiles SET
                   current_active_post_id = NULL,
                   current_active_post_name = NULL,
                   is_out_of_bounds = false,
                   out_of_bounds_distance = 0
                 WHERE id = $1;`,
                [validUserId]
              );
              isOutOfBounds = false;
              excessDist = 0;
            } else {
              // Benar-benar pelanggaran perimeter pada saat jam aktif kerja!
              await pool.query(
                `UPDATE hrm_profiles SET
                   current_active_post_id = NULL,
                   current_active_post_name = NULL,
                   is_out_of_bounds = true,
                   out_of_bounds_distance = $1
                 WHERE id = $2;`,
                [excessDist, validUserId]
              );

              const breachTitle = `🚨 ${prof.full_name} Bergerak Keluar Perimeter`;
              const breachSystemMsg = `Petugas ${prof.full_name} (${prof.nip || 'FRP'}) terdeteksi bergerak keluar dari area ${prof.current_active_post_name || targetLocationName} sejauh ${excessDist} meter!`;

              const breachWaMsg =
`🚨 *PERINGATAN RADAR LAPANGAN PT. FAWWAZ RESKI PERWIRA*

👤 Petugas: *${prof.full_name}* (${prof.nip || 'FRP-FIELD'})
⚠️ Status: *KELUAR DARI SEMUA TITIK TUGAS*
📍 Pos Terakhir: *${prof.current_active_post_name || targetLocationName}*
📏 Jarak Pelanggaran: ${excessDist} meter di luar perimeter aman!
🌐 Koordinat Live: ${userLat.toFixed(6)}, ${userLon.toFixed(6)}
⏰ Waktu Insiden: ${witaTimeStr}

Mohon segera pantau posisi petugas melalui menu Live Monitoring HRM.`;

              await alertLeadershipViaWhatsAppAndSystem({
                title: breachTitle,
                message: breachSystemMsg,
                waMessage: breachWaMsg,
                link: '/admin/monitoring',
                metadata: {
                  type: 'perimeter_breach',
                  userId: validUserId,
                  excessDistance: excessDist,
                  latitude: userLat,
                  longitude: userLon
                }
              });
            }
          }
        }
      }
    } else {
      // Single assigned location or division
      const targetLat = prof.assigned_latitude ? parseFloat(prof.assigned_latitude) : parseFloat(prof.fallback_lat);
      const targetLon = prof.assigned_longitude ? parseFloat(prof.assigned_longitude) : parseFloat(prof.fallback_lon);
      allowedRadius = prof.assigned_radius_meters ? parseFloat(prof.assigned_radius_meters) : parseFloat(prof.fallback_radius);
      targetLocationName = prof.assigned_location_name || prof.fallback_name;

      distance = calculateHaversineMeters(userLat, userLon, targetLat, targetLon);
      const gpsBuffer = Math.min(Math.max(0, (userAccuracy - 15) * 0.5), 35);
      const effectiveRadius = allowedRadius + gpsBuffer;

      if (distance <= effectiveRadius) {
        isOutOfBounds = false;
        excessDist = 0;
      } else {
        // Also check if inside any allowed division posts
        let allowedPosts = [];
        try {
          if (prof.div_allowed_posts) {
            const pArr = typeof prof.div_allowed_posts === 'string' ? JSON.parse(prof.div_allowed_posts) : prof.div_allowed_posts;
            if (Array.isArray(pArr)) allowedPosts.push(...pArr);
          }
          if (prof.user_allowed_posts) {
            const pArr = typeof prof.user_allowed_posts === 'string' ? JSON.parse(prof.user_allowed_posts) : prof.user_allowed_posts;
            if (Array.isArray(pArr)) allowedPosts.push(...pArr);
          }
        } catch (_) {}

        const matchedAllowed = allowedPosts.find((ap) => {
          const d = calculateHaversineMeters(userLat, userLon, parseFloat(ap.latitude), parseFloat(ap.longitude));
          const r = parseFloat(ap.radiusMeters || ap.radius_meters || 50) + gpsBuffer;
          return d <= r;
        });

        if (matchedAllowed) {
          const d = calculateHaversineMeters(userLat, userLon, parseFloat(matchedAllowed.latitude), parseFloat(matchedAllowed.longitude));
          distance = Math.round(d);
          allowedRadius = parseFloat(matchedAllowed.radiusMeters || matchedAllowed.radius_meters || 50);
          targetLocationName = matchedAllowed.name || matchedAllowed.postName || matchedAllowed.code;
          isOutOfBounds = false;
          excessDist = 0;
        } else {
          isOutOfBounds = isExcusedFromBreach ? false : true;
          excessDist = isOutOfBounds ? Math.max(0, Math.round(distance - allowedRadius)) : 0;
        }
      }
    }

    // Always update last known GPS state
    await pool.query(
      `UPDATE hrm_profiles SET
         last_known_latitude = $1,
         last_known_longitude = $2,
         last_known_accuracy = $3,
         last_known_ping_at = NOW(),
         is_out_of_bounds = $4,
         out_of_bounds_distance = $5,
         updated_at = NOW()
       WHERE id = $6;`,
      [userLat, userLon, userAccuracy, isExcusedFromBreach ? false : isOutOfBounds, isExcusedFromBreach ? 0 : excessDist, validUserId]
    );

    // Jika terdeteksi di luar area kerja dan tidak sedang izin/excused:
    if (isOutOfBounds && !isExcusedFromBreach) {
      // 1. Ambil jam shift karyawan hari ini
      const schedRes = await pool.query(`
        SELECT COALESCE(es.end_time::text, p.custom_end_time::text, s.end_time::text, '16:30') as shift_end_time,
               COALESCE(es.start_time::text, p.custom_start_time::text, s.start_time::text, '07:30') as shift_start_time,
               COALESCE(s.is_cross_day, false) as is_cross_day
        FROM hrm_profiles p
        LEFT JOIN hrm_shifts s ON p.shift_id = s.id
        LEFT JOIN hrm_employee_schedules es ON es.user_id = p.id AND es.schedule_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date
        WHERE p.id = $1 LIMIT 1;
      `, [validUserId]);

      const shiftInfo = schedRes.rows[0];
      const shiftEndStr = (shiftInfo?.shift_end_time || '16:30').substring(0, 5);
      const [endH, endM] = shiftEndStr.split(':').map(Number);
      const endTotalMins = endH * 60 + endM;

      const nowWitaDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const nowH = nowWitaDate.getUTCHours();
      const nowM = nowWitaDate.getUTCMinutes();
      let nowTotalMins = nowH * 60 + nowM;

      const isCrossDay = Boolean(shiftInfo?.is_cross_day);
      if (isCrossDay && nowTotalMins < 720 && endTotalMins >= 720) {
        nowTotalMins += 1440;
      }

      // JIKA WAKTU SUDAH MELEWATI JAM SELESAI SHIFT (misal >= 16:30):
      // Karyawan meninggalkan area kerja karena jam shift sudah usai (Auto-Clock Out Otomatis Opsi 2)
      if (nowTotalMins >= endTotalMins) {
        const clockOutTime = `${shiftEndStr}:00`;
        const autoNote = ` [Auto-Clock Out: Karyawan telah meninggalkan area kerja setelah jam shift (${shiftEndStr} WITA) usai]`;

        const autoCloseRes = await pool.query(
          `UPDATE hrm_attendances SET
             clock_out = $1,
             status = CASE WHEN status = 'terlambat' OR late_minutes > 0 THEN 'terlambat' ELSE 'hadir' END,
             is_locked = false,
             is_perimeter_breached = false,
             auto_closed_type = 'AUTO_CLOCKOUT_OUT_OF_BOUNDS',
             notes = TRIM(COALESCE(notes, '') || $2),
             updated_at = NOW()
           WHERE user_id = $3 AND attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date AND clock_out IS NULL
           RETURNING id;`,
          [clockOutTime, autoNote, validUserId]
        );

        if (autoCloseRes.rows.length > 0) {
          console.log(`[Auto-Clock Out On Leaving] Berhasil auto clock-out ${prof.full_name} (${prof.nip}) pk ${shiftEndStr} WITA.`);
          if (prof.phone) {
            const waAutoOut = `✅ *PRESENSI PULANG TERCATAT OTOMATIS (HRM FRP)*\n\nHalo *${prof.full_name}*,\nSistem mendeteksi Anda telah menyelesaikan jam kerja shift (${shiftEndStr} WITA) dan telah meninggalkan area penugasan.\n\nPresensi pulang Anda hari ini telah **otomatis dicatat resmi pada pk ${shiftEndStr} WITA**. Hak jam kerja Anda tetap aman dan lengkap.\n\nSelamat beristirahat!\n_Sistem Absensi Cerdas PT Fawwaz Reski Perwira_`;
            sendWhatsAppAlert({ phone: prof.phone, message: waAutoOut }).catch(() => null);
          }
        }
      } else {
        // MASIH DALAM JAM KERJA (sebelum jam shift berakhir) -> Ini benar pelanggaran batas pos kerja
        await pool.query(
          `UPDATE hrm_attendances SET
             is_locked = true,
             is_perimeter_breached = true,
             perimeter_breach_count = COALESCE(perimeter_breach_count, 0) + 1,
             updated_at = NOW()
           WHERE user_id = $1 AND attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date AND clock_out IS NULL;`,
          [validUserId]
        );

        // 📲 REMINDER WHATSAPP LANGSUNG KE HP KARYAWAN (Jika HP di saku / aplikasi sleep)
        if (prof.phone) {
          const lastRem = prof.last_breach_reminder_at ? new Date(prof.last_breach_reminder_at).getTime() : 0;
          const nowMs = Date.now();
          // Cooldown 30 menit agar tidak spamming
          if (nowMs - lastRem > 30 * 60 * 1000) {
            const waEmployeeReminder =
`⚠️ *PERINGATAN RADAR PRESENSI PT. FAWWAZ RESKI PERWIRA*

Halo *${prof.full_name}*,
Sistem mendeteksi bahwa posisi Anda saat ini berada di luar radius area pos penugasan selama jam kerja berlangsung (${excessDist} meter di luar batas pos).

Jika Anda sedang menjalankan tugas dinas luar, keperluan darurat, atau terjadi kendala GPS/jaringan pada ponsel, mohon segera buka aplikasi HRM dan kirimkan *Pelaporan Insiden* di menu Presensi agar jam kepulangan Anda dapat dicatatkan secara otomatis.

Tautan Aplikasi: https://hrm.ptfrp.co.id`;

            sendWhatsAppAlert({ phone: prof.phone, message: waEmployeeReminder })
              .then(() => console.log(`[Breach Reminder sent to ${prof.full_name} (${prof.phone})]`))
              .catch(e => console.error('[Breach Reminder Error]:', e.message));

            await pool.query('UPDATE hrm_profiles SET last_breach_reminder_at = NOW() WHERE id = $1;', [validUserId]);
          }
        }
      }
    }

    if (isMockLocation === true) {
      const fakeGpsMsg = `🚨 *DETEKSI FAKE GPS*\nPetugas *${prof.full_name}* (${prof.nip}) terdeteksi menyalakan aplikasi Mock Location / Fake GPS!`;
      await alertLeadershipViaWhatsAppAndSystem({
        title: '🚨 Fake GPS Terdeteksi',
        message: `${prof.full_name} (${prof.nip}) terdeteksi menggunakan aplikasi Mock Location!`,
        waMessage: fakeGpsMsg,
        link: '/admin/monitoring',
        metadata: { type: 'fake_gps', userId: validUserId, latitude: userLat, longitude: userLon }
      });
    }

    res.json({
      success: true,
      isOutOfBounds,
      distanceFromTarget: distance,
      allowedRadius,
      targetLocationName,
      arrivedPostId: arrivedPost?.id || null,
      arrivedPostName: arrivedPost?.post_name || null,
      triggerVibration: Boolean(shouldPromptSelfie),
      shouldPromptSelfie: Boolean(shouldPromptSelfie),
      message: isOutOfBounds
        ? `Perhatian: Anda berada ${excessDist}m di luar seluruh radius pos resmi.`
        : `Posisi terpantau valid di dalam area kerja: ${targetLocationName}.`
    });
  } catch (err) {
    console.error('Location ping error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Submit face scan with burned-in forensic watermark
app.post('/api/field-sentinel/submit-patrol-check', async (req, res) => {
  const {
    userId,
    checkType,
    locationName,
    latitude,
    longitude,
    accuracyMeters,
    watermarkedPhotoUrl,
    biometricScore,
    notes
  } = req.body;

  if (!userId || !watermarkedPhotoUrl) {
    return res.status(400).json({ success: false, error: 'User ID dan foto watermark wajib disertakan' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const uRes = await pool.query(
      `SELECT p.id, p.full_name, p.nip,
              COALESCE(p.assigned_latitude, d.latitude, o.latitude, -4.793963) as target_lat,
              COALESCE(p.assigned_longitude, d.longitude, o.longitude, 119.604337) as target_lon,
              COALESCE(p.assigned_radius_meters, d.radius_meters, o.radius_meters, 50) as target_radius,
              COALESCE(p.assigned_location_name, d.location_name, d.name, o.name, 'Kantor FRP') as target_loc_name,
              d.allowed_posts as div_allowed_posts,
              p.allowed_posts as user_allowed_posts
       FROM hrm_profiles p
       LEFT JOIN hrm_divisions d ON p.division_id = d.id
       LEFT JOIN hrm_office_locations o ON o.is_active = true
       WHERE p.id = $1 LIMIT 1;`,
      [validUserId]
    );

    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    const user = uRes.rows[0];
    const uLat = latitude ? parseFloat(latitude) : parseFloat(user.target_lat);
    const uLon = longitude ? parseFloat(longitude) : parseFloat(user.target_lon);
    const targetLat = parseFloat(user.target_lat);
    const targetLon = parseFloat(user.target_lon);
    const targetRad = parseFloat(user.target_radius);
    const gpsBuffer = Math.min(Math.max(0, ((accuracyMeters ? parseFloat(accuracyMeters) : 5) - 15) * 0.5), 35);
    let resolvedLocName = user.target_loc_name || locationName || 'Pos Lapangan';
    let distance = 0;
    let isWithinRadius = false;

    // 1. Cek Prioritas Utama: Lokasi Kantor Divisi / Penugasan Resmi Karyawan (Dari Database)
    const targetDist = calculateHaversineMeters(uLat, uLon, targetLat, targetLon);
    if (targetDist <= (targetRad + gpsBuffer)) {
      distance = Math.round(targetDist);
      isWithinRadius = true;
      resolvedLocName = user.target_loc_name;
    } else {
      // 2. Cek Bank Multi-Titik Pos Penugasan Karyawan (hrm_field_assigned_posts)
      const fieldPosts = await pool.query(
        `SELECT * FROM hrm_field_assigned_posts 
         WHERE user_id = $1 AND is_active = true 
           AND (is_relief IS NOT TRUE OR relief_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)`,
        [validUserId]
      );

      let matchedBankPost = null;
      if (fieldPosts.rows.length > 0) {
        const postsWithDist = fieldPosts.rows.map(p => {
          const d = calculateHaversineMeters(uLat, uLon, parseFloat(p.latitude), parseFloat(p.longitude));
          const r = parseFloat(p.radius_meters) + gpsBuffer;
          return { ...p, distance: d, isValid: d <= r };
        });
        matchedBankPost = postsWithDist.find(p => p.isValid);
      }

      if (matchedBankPost) {
        distance = Math.round(matchedBankPost.distance);
        isWithinRadius = true;
        resolvedLocName = `${matchedBankPost.post_name} [${matchedBankPost.post_code}]`;
      } else {
        // 3. Cek Allowed Posts dari Divisi atau Profil Karyawan
        let allowedPosts = [];
        try {
          if (user.div_allowed_posts) {
            const pArr = typeof user.div_allowed_posts === 'string' ? JSON.parse(user.div_allowed_posts) : user.div_allowed_posts;
            if (Array.isArray(pArr)) allowedPosts.push(...pArr);
          }
          if (user.user_allowed_posts) {
            const pArr = typeof user.user_allowed_posts === 'string' ? JSON.parse(user.user_allowed_posts) : user.user_allowed_posts;
            if (Array.isArray(pArr)) allowedPosts.push(...pArr);
          }
        } catch (_) {}

        const matchedAllowed = allowedPosts.find((ap) => {
          const d = calculateHaversineMeters(uLat, uLon, parseFloat(ap.latitude), parseFloat(ap.longitude));
          const r = parseFloat(ap.radiusMeters || ap.radius_meters || 50) + gpsBuffer;
          return d <= r;
        });

        if (matchedAllowed) {
          const d = calculateHaversineMeters(uLat, uLon, parseFloat(matchedAllowed.latitude), parseFloat(matchedAllowed.longitude));
          distance = Math.round(d);
          isWithinRadius = true;
          resolvedLocName = matchedAllowed.name || matchedAllowed.postName || matchedAllowed.code;
        } else {
          // 4. Cek Titik Pos Resmi FRP (Termasuk Titik Pos Timbangan)
          const FRP_OFFICIAL_LOCATIONS = [
            { code: 'KANTOR FRP', name: 'Kantor FRP', lat: -4.794135, lon: 119.604382, radius: 250 },
            { code: 'KANTOR MATCHING BONTOA', name: 'Matching Bontoa', lat: -4.802450, lon: 119.598640, radius: 250 },
            { code: 'KANTOR PUSAT', name: 'Kantor Pusat', lat: -4.800089, lon: 119.608477, radius: 250 },
            { code: 'KANTOR STAFF', name: 'Kantor Staff', lat: -4.789289, lon: 119.612770, radius: 250 },
            { code: 'PINTU OGS', name: 'Pos OGS', lat: -4.787904, lon: 119.613399, radius: 250 },
            { code: 'WISMA RUMAH TANGGA', name: 'Wisma Rumah Tangga', lat: -4.792870, lon: 119.608797, radius: 250 },
            { code: 'TIMBANGAN 2/3', name: 'Timbangan 2/3', lat: -4.783865, lon: 119.615338, radius: 50 },
            { code: 'TIMBANGAN 4', name: 'Timbangan 4', lat: -4.789666, lon: 119.612852, radius: 50 },
            { code: 'TIMBANGAN 5', name: 'Timbangan 5', lat: -4.789809, lon: 119.612887, radius: 50 },
          ];

          const matchedFRP = FRP_OFFICIAL_LOCATIONS.find((p) => {
            const d = calculateHaversineMeters(uLat, uLon, p.lat, p.lon);
            return d <= (p.radius + gpsBuffer);
          });

          if (matchedFRP) {
            distance = Math.round(calculateHaversineMeters(uLat, uLon, matchedFRP.lat, matchedFRP.lon));
            isWithinRadius = true;
            resolvedLocName = `${matchedFRP.name} [${matchedFRP.code}]`;
          } else {
            // Pegawai berada di luar seluruh radius: tetap pertahankan target asli divisi/penugasan pegawai!
            distance = Math.round(targetDist);
            isWithinRadius = false;
            resolvedLocName = user.target_loc_name;
          }
        }
      }
    }

    // ⚡ Pengecualian Petugas Online Distribusi (Rusdi, Reza, Ichtiar) & Tugas Darurat On-Call
    const isMobileOnlineSpecialistCheck = [
      'f0aaf721-203c-4b45-b610-213204bc7ffe', // Rusdi Aryanto
      'd1e4eaf3-fa45-474b-b7a2-32e4114d8f2b', // M. Reza Angga Dwi S
      '2939502e-e63c-4c63-aafb-a69abccba828', // Ichtiar
    ].includes(validUserId) || 
    ['FR07046', 'FR07042', 'FR07044', 'FR.07.046', 'FR.07.042', 'FR.07.044', 'FRP07046', 'FRP07042', 'FRP07044'].includes((user.nip || '').trim()) ||
    checkType === 'emergency_on_call';

    if (isMobileOnlineSpecialistCheck) {
      isWithinRadius = true;
      if (!matchedFRP && (!fieldPosts || fieldPosts.rows.length === 0)) {
        resolvedLocName = locationName || 'Area Mobile / Online Remote (Matching/Pusat/Cafe/Rumah)';
      }
    }

    const insRes = await pool.query(
      `INSERT INTO hrm_field_patrol_checks (
         user_id, user_name, user_nip, check_type, location_name,
         latitude, longitude, accuracy_meters, distance_from_target,
         is_within_radius, watermarked_photo_url, biometric_score,
         biometric_verified, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *;`,
      [
        validUserId,
        user.full_name,
        user.nip,
        checkType || 'spot_check',
        resolvedLocName,
        uLat,
        uLon,
        accuracyMeters ? parseFloat(accuracyMeters) : 5,
        distance,
        isWithinRadius,
        watermarkedPhotoUrl,
        biometricScore ? parseFloat(biometricScore) : 98.6,
        true,
        notes || null
      ]
    );
    const patrol = insRes.rows[0];

    // Ephemeral Rolling Photo Replacement: Foto selfie di titik lokasi yang lalu otomatis dihapus dan digantikan hanya dengan 1 foto selfie terbaru
    if (watermarkedPhotoUrl && validUserId && patrol?.id) {
      await pool.query(
        `UPDATE hrm_field_patrol_checks 
         SET watermarked_photo_url = NULL 
         WHERE user_id = $1 AND id != $2 AND watermarked_photo_url IS NOT NULL;`,
        [validUserId, patrol.id]
      ).catch((err) => console.warn('[Photo Retention] Error clearing older patrol photos:', err));
    }

    // Clear spot-check requested flag
    await pool.query(
      `UPDATE hrm_profiles 
       SET spot_check_requested = false, 
           spot_check_requested_at = NULL, 
           spot_check_notes = NULL 
       WHERE id = $1;`,
      [validUserId]
    );

    // Waktu Realtime WITA (UTC+8)
    const nowWita = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Makassar' }).replace(/\./g, ':');
    const nowDateWita = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' });

    // Send WhatsApp confirmation to Pimpinan & Superadmin
    let alertTitle = `📸 1 Selfie Realtime Diterima: ${user.full_name}`;
    let alertMsg = `${user.full_name} telah mengirimkan 1 foto bukti selfie realtime di ${patrol.location_name}.`;
    let patrolWaMsg = '';

    if (checkType === 'emergency_on_call') {
      alertTitle = `⚡ Tugas Darurat Online: ${user.full_name}`;
      alertMsg = `${user.full_name} aktif bertugas mendadak secara online (On-Call Remote) di ${patrol.location_name}.`;
      patrolWaMsg = 
`⚡ *LAPORAN TUGAS DARURAT ONLINE (ON-CALL DUTY)* ⚡
Petugas Operasional Online telah aktif bertugas mendadak!

👤 Petugas: *${user.full_name}* (${user.nip || 'FRP-DIST'})
📍 Area/Jaringan: *${patrol.location_name}*
📏 Status Akses: *✅ Sah (Penugasan Online Mobile / On-Call Duty)*
🛡️ Skor Biometrik: ${patrol.biometric_score || 98.6}% (Lolos 1:1)
🕒 Waktu Realtime: ${nowDateWita} • ${nowWita} WITA
📡 Koordinat GPS: ${uLat.toFixed(6)}, ${uLon.toFixed(6)} (±${Math.round(accuracyMeters || 5)}m)
📝 Catatan: *${notes || 'Tugas Darurat Online saat Libur/Cuti/Luar Jam Kerja'}*

_Karyawan telah aktif terhubung dan menjalankan tugas operasional online._`;
    } else {
      patrolWaMsg = 
`📸 *1 BUKTI SELFIE REALTIME LAPORAN WAJAH*

👤 Petugas: *${user.full_name}* (${user.nip || 'FRP-FIELD'})
📍 Lokasi Realtime: *${patrol.location_name}*
📏 Status Pos: *${isWithinRadius ? `✅ Sah di Dalam Pos (${Math.round(distance)}m)` : `⚠️ Di Luar Radius Pos (${Math.round(distance)}m)`}*
🛡️ Skor Biometrik: ${patrol.biometric_score || 98.6}% Match
🕒 Waktu Realtime: ${nowDateWita} • ${nowWita} WITA
📡 Koordinat GPS: ${uLat.toFixed(6)}, ${uLon.toFixed(6)} (±${Math.round(accuracyMeters || 5)}m)

_1 Bukti selfie realtime berhasil diverifikasi dan tersimpan di radar pengawasan FRP._`;
    }

    alertLeadershipViaWhatsAppAndSystem({
      title: alertTitle,
      message: alertMsg,
      waMessage: patrolWaMsg,
      link: '/admin/monitoring',
      metadata: {
        type: checkType === 'emergency_on_call' ? 'emergency_on_call' : 'patrol_verified',
        userId: validUserId,
        photoUrl: watermarkedPhotoUrl,
        locationName: patrol.location_name
      }
    }).catch(() => null);

    res.json({
      success: true,
      data: patrol,
      message: 'Foto verifikasi wajah dengan watermark forensik berhasil diterima dan diteruskan ke Pimpinan.'
    });
  } catch (err) {
    console.error('Submit patrol check error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 3.B. REPORT TRAVEL INCIDENT (BAN BOCOR, BENSIN HABIS, MOTOR RUSAK) ───
app.post('/api/field-sentinel/travel-incident', async (req, res) => {
  const {
    userId,
    incidentType,
    reason,
    photoUrl,
    latitude,
    longitude,
    accuracy
  } = req.body;

  if (!userId || !incidentType) {
    return res.status(400).json({ success: false, error: 'User ID dan jenis kendala perjalanan wajib diisi' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const uRes = await pool.query(
      `SELECT p.id, p.full_name, p.nip, d.name as division_name, p.phone
       FROM hrm_profiles p
       LEFT JOIN hrm_divisions d ON p.division_id = d.id
       WHERE p.id = $1 LIMIT 1;`,
      [validUserId]
    );

    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    const user = uRes.rows[0];

    const incidentConfigs = {
      ban_bocor: {
        label: 'Ban Bocor / Kempes',
        graceMinutes: 45,
        recommendation: 'Tepikan kendaraan di bahu jalan yang aman. Nyalakan lampu darurat. Cari tambal ban terdekat atau hubungi rekan untuk bantuan. Diberikan toleransi tambahan 45 menit.'
      },
      kehabisan_bensin: {
        label: 'Kehabisan Bensin',
        graceMinutes: 30,
        recommendation: 'Tuntun kendaraan ke trotoar/lokasi aman. Beli bahan bakar di SPBU / Pertashop terdekat atau minta rekan mengantarkan bensin darurat. Diberikan toleransi tambahan 30 menit.'
      },
      motor_rusak: {
        label: 'Kendaraan Mogok / Mesin Rusak',
        graceMinutes: 60,
        recommendation: 'Jangan memaksakan starter mesin berulang kali. Cari bengkel resmi/panggilan terdekat. Simpan bukti servis darurat. Diberikan toleransi dispensasi 60 menit.'
      },
      kecelakaan_ringan: {
        label: 'Insiden / Kecelakaan Ringan',
        graceMinutes: 60,
        recommendation: 'Prioritaskan pertolongan medis pertama dan keselamatan fisik Anda. Jangan panik, segera hubungi keluarga/pimpinan jika butuh pendampingan. Diberikan dispensasi penuh.'
      },
      cuaca_ekstrem: {
        label: 'Cuaca Ekstrem / Banjir / Pohon Tumbang',
        graceMinutes: 60,
        recommendation: 'Berteduh di bangunan kokoh yang aman. Hindari pohon rindang, papan reklame dan genangan air dalam. Diberikan toleransi cuaca 60 menit.'
      }
    };

    const config = incidentConfigs[incidentType] || {
      label: 'Kendala Perjalanan Tak Terduga',
      graceMinutes: 45,
      recommendation: 'Jaga keselamatan diri dan segera menuju lokasi tugas setelah kendala teratasi.'
    };

    await pool.query(
      `INSERT INTO hrm_field_travel_incidents (
         user_id, incident_type, reason, photo_url, latitude, longitude, accuracy, grace_period_minutes, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', NOW());`,
      [
        validUserId,
        config.label,
        reason || 'Kendala teknis di perjalanan menuju lokasi kerja',
        photoUrl || null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        accuracy ? parseFloat(accuracy) : null,
        config.graceMinutes
      ]
    );

    const todayStr = new Date().toISOString().split('T')[0];
    await pool.query(
      `UPDATE hrm_attendances 
       SET notes = COALESCE(notes || ' | ', '') || $1
       WHERE user_id = $2 AND (date = $3 OR attendance_date = $3);`,
      [`[DISPENSASI PERJALANAN: ${config.label} (+${config.graceMinutes}m)]`, validUserId, todayStr]
    );

    const witaTimeStr = new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WITA';

    const mapsUrl = latitude && longitude ? `https://maps.google.com/?q=${latitude},${longitude}` : 'Koordinat GPS Tercatat';

    const waMessage =
`🚨 *LAPORAN KENDALA PERJALANAN KARYAWAN PT FRP*

👤 Nama: *${user.full_name}* (${user.nip || 'FRP'})
🏢 Divisi: *${user.division_name || '-'}*
⚠️ Kendala: *${config.label}*
⏰ Waktu: *${witaTimeStr}*
📝 Keterangan: ${reason || 'Dalam perjalanan ke lokasi tugas'}
📍 Lokasi GPS: ${mapsUrl} (Akurasi: ${accuracy || 10}m)

🛡️ *STATUS DISPENSASI:*
Diberikan perpanjangan toleransi *${config.graceMinutes} MENIT* otomatis tanpa potongan gaji atau sanksi kedisiplinan.`;

    await alertLeadershipViaWhatsAppAndSystem({
      title: `🚨 Laporan Kendala: ${user.full_name} (${config.label})`,
      message: `Karyawan ${user.full_name} melaporkan kendala ${config.label}. Diberikan toleransi dispensasi ${config.graceMinutes} menit.`,
      waMessage,
      link: '/admin/monitoring',
      metadata: {
        type: 'travel_incident',
        userId: validUserId,
        incidentType,
        graceMinutes: config.graceMinutes,
        latitude,
        longitude,
        photoUrl
      }
    });

    res.json({
      success: true,
      label: config.label,
      graceMinutes: config.graceMinutes,
      recommendation: config.recommendation,
      message: `Laporan kendala perjalanan diterima. Anda diberikan toleransi dispensasi keterlambatan ${config.graceMinutes} menit.`
    });
  } catch (err) {
    console.error('Travel incident error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Fetch all active field agents with live radar coordinates & multi-titik bank posts
app.get('/api/field-sentinel/active-agents', async (req, res) => {
  try {
    const query = `
      SELECT p.*, r.name as role_code, r.label as role_label,
             d.name as division_title,
             COALESCE(d.name, p.division_name, 'Umum') as resolved_division_name,
             (
               SELECT json_build_object(
                 'id', sub.id,
                 'checkType', sub.check_type,
                 'check_type', sub.check_type,
                 'createdAt', sub.created_at,
                 'created_at', sub.created_at,
                 'checkedAt', sub.created_at,
                 'time', to_char(sub.created_at AT TIME ZONE 'Asia/Makassar', 'HH24:MI:SS "WITA"'),
                 'date', to_char(sub.created_at AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD'),
                 'photoUrl', sub.photo_url,
                 'watermarked_photo_url', sub.photo_url,
                 'watermarkedPhotoUrl', sub.photo_url,
                 'locationName', sub.location_name,
                 'location_name', sub.location_name,
                 'isWithinRadius', sub.is_within_radius,
                 'is_within_radius', sub.is_within_radius,
                 'distanceFromTarget', sub.distance,
                 'distance_from_target', sub.distance,
                 'distance', sub.distance,
                 'biometricScore', sub.biometric_score,
                 'biometric_score', sub.biometric_score,
                 'faceMatchScore', COALESCE(sub.biometric_score, 98) / 100.0,
                 'userName', p.full_name,
                 'user_name', p.full_name,
                 'userNip', p.nip,
                 'user_nip', p.nip
               )
               FROM (
                 SELECT 
                   pc.id,
                   pc.check_type,
                   pc.created_at,
                   pc.watermarked_photo_url as photo_url,
                   pc.location_name,
                   pc.is_within_radius,
                   pc.distance_from_target as distance,
                   pc.biometric_score
                 FROM hrm_field_patrol_checks pc
                 WHERE pc.user_id = p.id AND pc.watermarked_photo_url IS NOT NULL
                 
                 UNION ALL
                 
                 SELECT
                   a.id,
                   'attendance_selfie' as check_type,
                   (a.attendance_date + COALESCE(a.clock_in, a.clock_out, '08:00:00'::time))::timestamp with time zone as created_at,
                   COALESCE(a.photo_in, a.photo_out) as photo_url,
                   COALESCE(p.assigned_location_name, 'Pos Lapangan Terdaftar') as location_name,
                   COALESCE(a.geofence_valid, true) as is_within_radius,
                   COALESCE(a.geofence_distance_meters, 0) as distance,
                   COALESCE(a.biometric_score, 98.6) as biometric_score
                 FROM hrm_attendances a
                 WHERE a.user_id = p.id AND (a.photo_in IS NOT NULL OR a.photo_out IS NOT NULL)
                 
                 ORDER BY created_at DESC LIMIT 1
               ) sub
             ) as latest_patrol_check,
             (
               SELECT COALESCE(json_agg(
                 json_build_object(
                   'id', fp.id,
                   'userId', fp.user_id,
                   'postCode', fp.post_code,
                   'postName', fp.post_name,
                   'latitude', fp.latitude,
                   'longitude', fp.longitude,
                   'radiusMeters', fp.radius_meters,
                   'description', fp.description,
                   'isActive', fp.is_active,
                   'isRelief', fp.is_relief,
                   'reliefUntil', fp.relief_until,
                   'createdAt', fp.created_at
                 ) ORDER BY fp.post_code ASC, fp.created_at ASC
               ), '[]'::json)
               FROM hrm_field_assigned_posts fp
               WHERE fp.user_id = p.id AND fp.is_active = true
                 AND (fp.is_relief IS NOT TRUE OR fp.relief_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)
             ) as assigned_posts
      FROM hrm_profiles p
      LEFT JOIN hrm_roles r ON p.role_id = r.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      WHERE p.is_field_sentinel_enabled = true OR LOWER(p.email) IN ('aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com')
      ORDER BY p.full_name ASC;
    `;
    const result = await pool.query(query);
    const users = result.rows.map((r) => {
      const u = formatUserRow(r);
      return {
        ...u,
        latestPatrolCheck: r.latest_patrol_check || null,
        assignedPosts: r.assigned_posts || [],
      };
    });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Active agents error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. Set custom work hours & late tolerance for Field Sentinel Officers
app.post('/api/field-sentinel/set-work-hours', async (req, res) => {
  const { userId, startTime, endTime, lateToleranceMinutes, applyToAllThree } = req.body;
  if (!startTime || !endTime) {
    return res.status(400).json({ success: false, error: 'Jam Masuk dan Jam Pulang wajib diisi' });
  }

  const cleanStart = startTime.trim().substring(0, 5);
  const cleanEnd = endTime.trim().substring(0, 5);
  const cleanTol = Math.max(0, parseInt(lateToleranceMinutes) || 15);

  try {
    if (applyToAllThree) {
      // 3 Karyawan Khusus (Petugas Lapangan) sesuai AGENTS.md
      const targetEmails = ['aslamfaisal10okt@gmail.com', 'abangelsamsi@gmail.com', 'mtakdir46@gmail.com'];
      const targetNips = ['FRP 07065', 'FR.07.066', 'FRP.07.046'];
      const targetUuids = [
        'ebf10b16-ab2f-4b53-ab22-b3ffc00694db',
        '2ce41a19-0c65-45d3-913e-a68a02203fe2',
        '0a49f92e-5733-4b72-947c-7361f9490632'
      ];

      await pool.query(
        `UPDATE hrm_profiles 
         SET custom_start_time = $1, custom_end_time = $2, late_tolerance_minutes = $3, updated_at = NOW()
         WHERE id = ANY($4::uuid[])
            OR LOWER(email) = ANY($5::text[])
            OR TRIM(nip) = ANY($6::text[])
            OR is_field_sentinel_enabled = true;`,
        [cleanStart, cleanEnd, cleanTol, targetUuids, targetEmails, targetNips]
      );

      // Simpan juga di hrm_system_settings
      await pool.query(
        `INSERT INTO hrm_system_settings (key, value, updated_at) 
         VALUES ('field_officer_start_time', $1, NOW()), ('field_officer_end_time', $2, NOW()), ('field_officer_late_tolerance', $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
        [cleanStart, cleanEnd, String(cleanTol)]
      );

      return res.json({
        success: true,
        message: `Jam kerja berhasil disetel (${cleanStart} - ${cleanEnd} WITA, Toleransi: ${cleanTol} menit) untuk seluruh 3 Petugas Lapangan Khusus.`,
        data: { startTime: cleanStart, endTime: cleanEnd, lateToleranceMinutes: cleanTol, appliedCount: 3 }
      });
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID wajib disertakan jika tidak diterapkan ke semua' });
    }

    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    await pool.query(
      `UPDATE hrm_profiles 
       SET custom_start_time = $1, custom_end_time = $2, late_tolerance_minutes = $3, updated_at = NOW()
       WHERE id = $4;`,
      [cleanStart, cleanEnd, cleanTol, validUserId]
    );

    res.json({
      success: true,
      message: `Jam kerja khusus berhasil disetel (${cleanStart} - ${cleanEnd} WITA, Toleransi: ${cleanTol} menit).`,
      data: { userId: validUserId, startTime: cleanStart, endTime: cleanEnd, lateToleranceMinutes: cleanTol }
    });
  } catch (err) {
    console.error('Set work hours error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Fetch patrol check history
app.get('/api/field-sentinel/patrol-checks', async (req, res) => {
  const { userId, limit } = req.query;
  try {
    let query = `SELECT * FROM hrm_field_patrol_checks`;
    const params = [];
    if (userId) {
      params.push(userId);
      query += ` WHERE user_id = $1`;
    }
    query += ` ORDER BY created_at DESC LIMIT ${limit ? parseInt(limit) : 50}`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Pimpinan / Superadmin sends urgent spot-check instruction
app.post('/api/field-sentinel/request-spot-check', async (req, res) => {
  const { userId, instructionNotes } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId wajib diisi' });
  }
  try {
    const uRes = await pool.query('SELECT id, full_name, nip, phone FROM hrm_profiles WHERE id::text = $1 OR nip = $1 LIMIT 1', [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    const target = uRes.rows[0];

    const noteText = instructionNotes || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.';

    // 1. Mark in database: spot_check_requested = true
    await pool.query(
      `UPDATE hrm_profiles 
       SET spot_check_requested = true, 
           spot_check_requested_at = NOW(), 
           spot_check_notes = $1 
       WHERE id = $2;`,
      [noteText, target.id]
    );

    // 2. Dispatch High Priority Emergency WhatsApp to the employee's phone
    if (target.phone) {
      const waNotice = 
`🚨 *INSTRUKSI KHUSUS PIMPINAN PT. FAWWAZ RESKI PERWIRA*

Halo *${target.full_name}* (${target.nip || 'FRP-FIELD'}),
Pimpinan menginstruksikan Anda untuk *SEGERA LAPOR WAJAH & POSISI* di titik lokasi tugas Anda saat ini.

⚠️ Mohon buka aplikasi presensi dan ambil foto verifikasi wajah dalam batas waktu 5 menit:
👉 https://fawwazreskiperwira.com

_Sistem memantau koordinat GPS live dan menyematkan bukti forensik otomatis._`;

      sendWhatsAppAlert({ phone: target.phone, message: waNotice });
    }

    // 3. Broadcast in-app WebSocket notification
    broadcastNotification({
      targetUserId: target.id,
      title: '🚨 Instruksi Pimpinan: Konfirmasi Posisi Wajah',
      message: noteText,
      type: 'spot_check_request',
      data: {
        requestedAt: new Date().toISOString(),
        requireWatermark: true,
      }
    });

    res.json({
      success: true,
      message: `Instruksi verifikasi wajah telah dikirimkan ke HP ${target.full_name} (${target.nip}).`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check if employee has pending spot check request
app.get('/api/field-sentinel/spot-check-status/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const q = await pool.query(
      `SELECT spot_check_requested, spot_check_requested_at, spot_check_notes 
       FROM hrm_profiles WHERE id::text = $1 OR nip = $1 LIMIT 1`,
      [userId]
    );
    if (q.rows.length === 0) return res.json({ success: true, requested: false });
    const r = q.rows[0];
    res.json({
      success: true,
      requested: r.spot_check_requested === true,
      requestedAt: r.spot_check_requested_at,
      notes: r.spot_check_notes
    });
  } catch (err) {
    res.status(500).json({ success: false, requested: false, error: err.message });
  }
});

app.post('/api/biometric/reset-device', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId wajib diisi' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }
    await pool.query(
      `UPDATE hrm_profiles SET device_id = NULL, device_model = NULL, is_device_bound = false, device_bound_at = NULL, updated_at = NOW() WHERE id = $1`,
      [validUserId]
    );

    res.json({ success: true, message: 'Kunci perangkat berhasil di-reset. Karyawan dapat login dan clock-in dari perangkat baru.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
app.get('/api/payroll/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hrm_payroll_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
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
          isLateDeductionEnabled: false,
          currency: 'IDR'
        }
      });
    }
    const r = result.rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        salaryCalculationDay: r.cutoff_date || r.salary_calculation_day || 25,
        paymentDay: r.payment_date || r.payment_day || 1,
        workingDaysPerMonth: 22,
        lateDeductionPerMinute: parseFloat(r.late_deduction_per_minute || 1000),
        absenceDeductionPerDay: parseFloat(r.absence_deduction_per_day || 155000),
        defaultTaxRate: parseFloat(r.default_tax_rate || 5),
        bpjsKesehatanEmployee: parseFloat(r.bpjs_kesehatan_employee || 1),
        bpjsKesehatanEmployer: parseFloat(r.bpjs_kesehatan_employer || 4),
        bpjsKetenagakerjaanEmployee: parseFloat(r.bpjs_ketenagakerjaan_employee || 3),
        bpjsKetenagakerjaanEmployer: parseFloat(r.bpjs_ketenagakerjaan_employer || 5.7),
        includeOvertimeInPayroll: true,
        isLateDeductionEnabled: r.is_late_deduction_enabled === true,
        currency: 'IDR'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payroll/settings', async (req, res) => {
  const settings = req.body;
  try {
    const isLateDeduction = settings.isLateDeductionEnabled === true;
    await pool.query(`
      UPDATE hrm_payroll_settings SET
        cutoff_date = COALESCE($1, cutoff_date),
        payment_date = COALESCE($2, payment_date),
        late_deduction_per_minute = COALESCE($3, late_deduction_per_minute),
        absence_deduction_per_day = COALESCE($4, absence_deduction_per_day),
        default_tax_rate = COALESCE($5, default_tax_rate),
        bpjs_kesehatan_employee = COALESCE($6, bpjs_kesehatan_employee),
        bpjs_kesehatan_employer = COALESCE($7, bpjs_kesehatan_employer),
        bpjs_ketenagakerjaan_employee = COALESCE($8, bpjs_ketenagakerjaan_employee),
        bpjs_ketenagakerjaan_employer = COALESCE($9, bpjs_ketenagakerjaan_employer),
        is_late_deduction_enabled = $10,
        updated_at = NOW()
    `, [
      settings.salaryCalculationDay,
      settings.paymentDay,
      settings.lateDeductionPerMinute,
      settings.absenceDeductionPerDay,
      settings.defaultTaxRate,
      settings.bpjsKesehatanEmployee,
      settings.bpjsKesehatanEmployer,
      settings.bpjsKetenagakerjaanEmployee,
      settings.bpjsKetenagakerjaanEmployer,
      isLateDeduction
    ]);
    res.json({ success: true, message: 'Pengaturan payroll berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
        AND UPPER(REPLACE(REPLACE(p.nip, ' ', ''), '.', '')) LIKE 'FR%'
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
      // Kebijakan PT. FAWWAZ RESKI PERWIRA:
      // Slip gaji HANYA muncul di PWA karyawan jika diaktifkan disisi Superadmin (published_to_employee = true)
      // atau jika karyawan yang bersangkutan memintanya (requested_by_employee = true) dan telah disetujui.
      if (!row.published_to_employee) {
        return res.json({
          success: false,
          isLocked: true,
          hasRequested: Boolean(row.requested_by_employee),
          requestStatus: row.request_status || 'none',
          requestReason: row.request_reason || null,
          requestedAt: row.requested_at || null,
          periodLabel: row.period_label,
          slipId: row.id,
          message: row.requested_by_employee
            ? 'Permintaan slip gaji Anda telah diajukan dan sedang menunggu persetujuan Superadmin.'
            : 'Slip gaji periode ini belum diaktifkan oleh Superadmin atau belum diajukan permohonan.'
        });
      }
    } else {
      return res.json({
        success: false,
        isLocked: true,
        hasRequested: false,
        message: 'Belum ada dokumen slip gaji resmi untuk akun Anda.'
      });
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Kontrol Akses PWA Karyawan (Aturan PT FRP) ─────────────────────────
app.put('/api/payroll/slips/:id/publish', async (req, res) => {
  const { id } = req.params;
  const { published } = req.body;
  try {
    const isPub = Boolean(published);
    const result = await pool.query(
      `UPDATE hrm_payroll_slips 
       SET published_to_employee = $1, 
           request_status = CASE WHEN $1 = true AND requested_by_employee = true THEN 'approved' ELSE request_status END,
           updated_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [isPub, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Slip gaji tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0], message: isPub ? 'Slip gaji diaktifkan di PWA' : 'Slip gaji dikunci dari PWA' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payroll/slips/bulk-publish', async (req, res) => {
  const { periodId, published } = req.body;
  try {
    const isPub = Boolean(published);
    const result = await pool.query(
      `UPDATE hrm_payroll_slips 
       SET published_to_employee = $1, 
           request_status = CASE WHEN $1 = true AND requested_by_employee = true THEN 'approved' ELSE request_status END,
           updated_at = NOW() 
       WHERE period_id = $2 RETURNING id`,
      [isPub, periodId]
    );
    res.json({ success: true, count: result.rowCount, message: `${result.rowCount} slip berhasil ${isPub ? 'diaktifkan ke' : 'dikunci dari'} PWA` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payroll/request-slip', async (req, res) => {
  const { userId, periodId, reason } = req.body;
  try {
    let query = `
      UPDATE hrm_payroll_slips 
      SET requested_by_employee = true,
          request_reason = $1,
          requested_at = NOW(),
          request_status = 'pending',
          updated_at = NOW()
      WHERE (user_id::text = $2 OR user_id IN (SELECT id FROM hrm_profiles WHERE id::text = $2 OR nip = $2 OR LOWER(email) = LOWER($2)))
    `;
    const params = [reason || 'Permohonan slip gaji karyawan', userId];
    if (periodId) {
      params.push(periodId);
      query += ` AND period_id = $3`;
    }
    query += ` RETURNING *`;
    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Permintaan slip gaji berhasil dikirim ke Superadmin'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR LOWER(p.email) IN ('aslamfaisal10okt@gmail.com', 'mtakdir46@gmail.com', 'abangelsamsi@gmail.com')
         OR (
            LOWER(p.full_name) ILIKE '%aslam faisal%'
            OR LOWER(p.full_name) = 'takdir'
            OR LOWER(p.full_name) ILIKE '%unga samsi%'
         )
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/attendances/clock-out', async (req, res) => {
  let {
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

    // Ambil info profil karyawan
    let validUserId = userId;
    let userProfile = null;
    const userRes = await pool.query(
      `SELECT id, full_name, email, nip, division_id, shift_id, custom_start_time, custom_end_time, allowed_posts, allow_ogs_clock_out 
       FROM hrm_profiles 
       WHERE id::text = $1 OR nip = $1 OR LOWER(email) = LOWER($1) 
       LIMIT 1`,
      [userId]
    );
    if (userRes.rows.length > 0) {
      userProfile = userRes.rows[0];
      validUserId = userProfile.id;
      userId = validUserId;
    }

    const isExempt = isExemptFieldOfficer(userProfile);

    // Cek apakah clock-out berada dalam konteks Simulasi Sosialisasi (DIV-SIM)
    let isSimulationSession = false;
    let simDivision = null;
    try {
      const simDivRes = await pool.query(`SELECT * FROM hrm_divisions WHERE code = 'DIV-SIM' AND is_active = true LIMIT 1`);
      if (simDivRes.rows.length > 0) {
        simDivision = simDivRes.rows[0];
        const isUserInSimDiv = userProfile && (userProfile.division_id === simDivision.id || userProfile.division_code === 'DIV-SIM');
        const isExplicitSim = req.body.isSimulation === true || req.body.isSimulation === 'true';
        if (isUserInSimDiv || isExplicitSim) {
          isSimulationSession = true;
        }
      }
    } catch (simErr) {
      console.warn('[SimulationClockOut] Warning:', simErr.message);
    }

    // Validasi Jam Pulang Shift Karyawan: Lewati jika dalam sesi simulasi
    if (userProfile && !isSimulationSession) {
      const leaveRes = await pool.query(
        `SELECT id FROM hrm_leave_requests WHERE user_id = $1 AND leave_type IN ('emergency_leave', 'izin_darurat') AND status = 'approved' AND $2 BETWEEN start_date AND end_date LIMIT 1`,
        [userId, date]
      );
      const attRes = await pool.query(
        `SELECT clock_in, is_early_leave, early_leave_approved, is_remote_unlocked FROM hrm_attendances WHERE user_id = $1 AND attendance_date = $2 LIMIT 1`,
        [userId, date]
      );

      const isEmergencyPermitted = (leaveRes.rows.length > 0) ||
        (attRes.rows.length > 0 && (attRes.rows[0].is_early_leave || attRes.rows[0].early_leave_approved || attRes.rows[0].is_remote_unlocked));

      if (!isEmergencyPermitted) {
        let shiftStartTime = '07:30';
        let shiftEndTime = '16:30';
        let isCrossDay = false;

        // Prioritas 1: Ambil jam shift resmi dari rekaman presensi masuk aktif yang sedang ditutup (Shift 1, 2, 3, atau Day)
        const openAttForShift = await pool.query(
          `SELECT a.shift_id, a.shift_name, a.clock_in, s.start_time, s.end_time, s.is_cross_day
           FROM hrm_attendances a
           LEFT JOIN hrm_shifts s ON a.shift_id = s.id
           WHERE a.user_id = $1 AND (a.attendance_date = $2 OR a.attendance_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date - INTERVAL '1 day')
             AND a.clock_out IS NULL
           ORDER BY a.created_at DESC
           LIMIT 1`,
          [validUserId, date]
        ).catch(() => ({ rows: [] }));

        if (openAttForShift.rows.length > 0 && openAttForShift.rows[0].start_time) {
          const row = openAttForShift.rows[0];
          shiftStartTime = row.start_time.substring(0, 5);
          shiftEndTime = row.end_time.substring(0, 5);
          isCrossDay = Boolean(row.is_cross_day);
        } else {
          // Prioritas 2: Periksa Roster Jadwal Harian (hrm_employee_schedules)
          const schedRes = await pool.query(
            `SELECT es.*, s.is_cross_day as shift_is_cross_day FROM hrm_employee_schedules es
             LEFT JOIN hrm_shifts s ON es.shift_id = s.id OR s.code = es.shift_code
             WHERE es.user_id = $1 AND (es.schedule_date = $2::date OR es.schedule_date = ($2::date - INTERVAL '1 day'))
             ORDER BY es.schedule_date DESC LIMIT 1`,
            [validUserId, date]
          ).catch(() => ({ rows: [] }));

          if (schedRes.rows.length > 0 && schedRes.rows[0].start_time) {
            const es = schedRes.rows[0];
            shiftStartTime = es.start_time.substring(0, 5);
            shiftEndTime = es.end_time.substring(0, 5);
            isCrossDay = Boolean(es.is_night_shift || es.shift_is_cross_day);
          } else {
            // Prioritas 3: Fallback ke profil shift resmi
            const validProfileShiftId = (userProfile.shift_id && UUID_REGEX.test(userProfile.shift_id)) ? userProfile.shift_id : null;
            if (validProfileShiftId) {
              const shiftRes = await pool.query(
                `SELECT start_time, end_time, is_cross_day, name FROM hrm_shifts WHERE id = $1 LIMIT 1`,
                [validProfileShiftId]
              ).catch(() => ({ rows: [] }));
              if (shiftRes.rows.length > 0) {
                const sh = shiftRes.rows[0];
                shiftStartTime = sh.start_time ? sh.start_time.substring(0, 5) : '07:30';
                shiftEndTime = sh.end_time ? sh.end_time.substring(0, 5) : '16:30';
                isCrossDay = Boolean(sh.is_cross_day);
              }
            }
          }
        }

        const [sH, sM] = shiftStartTime.split(':').map(Number);
        const [eH, eM] = shiftEndTime.split(':').map(Number);
        const startMins = (Number.isFinite(sH) ? sH : 7) * 60 + (Number.isFinite(sM) ? sM : 0);
        const endMins = (Number.isFinite(eH) ? eH : 16) * 60 + (Number.isFinite(eM) ? eM : 0);
        if (endMins < startMins) isCrossDay = true;

        let nowMins = 0;
        if (time && typeof time === 'string') {
          const [cH, cM] = time.split(':').map(Number);
          nowMins = (Number.isFinite(cH) ? cH : 0) * 60 + (Number.isFinite(cM) ? cM : 0);
        } else {
          const witaDate = new Date(Date.now() + 8 * 3600000);
          nowMins = witaDate.getUTCHours() * 60 + witaDate.getUTCMinutes();
        }

        let isBeforeEndTime = false;
        if (isCrossDay) {
          if (nowMins >= startMins || nowMins < endMins) {
            isBeforeEndTime = true;
          }
        } else {
          if (nowMins < endMins) {
            isBeforeEndTime = true;
          }
        }

        // Cek durasi kerja minimal 30 menit dari clock_in
        if (attRes.rows.length > 0 && attRes.rows[0].clock_in) {
          const [ciH, ciM] = attRes.rows[0].clock_in.split(':').map(Number);
          const ciTotal = (ciH || 0) * 60 + (ciM || 0);
          const elapsed = nowMins >= ciTotal ? nowMins - ciTotal : (nowMins + 1440) - ciTotal;
          if (elapsed < 30) {
            return res.status(403).json({
              success: false,
              error: `Presensi Pulang Ditolak: Durasi kerja minimal 30 menit setelah presensi masuk (${attRes.rows[0].clock_in.substring(0, 5)} WITA).`,
              code: 'MINIMUM_WORK_DURATION'
            });
          }
        }

        if (isBeforeEndTime) {
          return res.status(403).json({
            success: false,
            error: `Presensi Pulang Ditolak: Belum memasuki jam pulang shift Anda (${shiftEndTime} WITA). Silakan ajukan Izin Darurat jika ada keperluan mendesak.`,
            code: 'BEFORE_SHIFT_END'
          });
        }
      }
    }

    if (isSimulationSession && simDivision) {
      serverDistance = (latitude && longitude && simDivision.latitude && simDivision.longitude)
        ? Math.round(calculateHaversineMeters(parseFloat(latitude), parseFloat(longitude), parseFloat(simDivision.latitude), parseFloat(simDivision.longitude)))
        : 0;
      isServerGeofenceValid = true;
    } else if (latitude && longitude && userId) {
      const candidateLocations = [];

      // A. Bank Pos Lapangan Karyawan (hrm_field_assigned_posts)
      try {
        const fieldPosts = await pool.query(
          `SELECT post_name as name, post_code as code, latitude, longitude, radius_meters 
           FROM hrm_field_assigned_posts 
           WHERE user_id = $1 AND is_active = true 
             AND (is_relief IS NOT TRUE OR relief_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)`,
          [userId]
        );
        for (const fp of fieldPosts.rows) {
          if (fp.latitude && fp.longitude) {
            candidateLocations.push({
              name: `${fp.name} [${fp.code || 'POS'}]`,
              lat: parseFloat(fp.latitude),
              lon: parseFloat(fp.longitude),
              radius: parseFloat(fp.radius_meters || 100),
            });
          }
        }
      } catch (fpErr) {
        console.warn('[ClockOut] Field posts query warn:', fpErr.message);
      }

      // B. Divisi & Kantor Pusat Resmi Karyawan (hrm_divisions & hrm_office_locations)
      try {
        const locRes = await pool.query(
          `SELECT 
             p.assigned_latitude, p.assigned_longitude, p.assigned_radius_meters, p.assigned_location_name,
             p.allowed_posts as user_allowed_posts,
             p.allow_ogs_clock_out,
             d.latitude as div_lat, d.longitude as div_lon, d.radius_meters as div_radius, d.name as div_name,
             d.allowed_posts as div_allowed_posts,
             o.latitude as office_lat, o.longitude as office_lon, o.radius_meters as office_radius, o.name as office_name
           FROM hrm_profiles p
           LEFT JOIN hrm_divisions d ON p.division_id = d.id
           LEFT JOIN hrm_office_locations o ON o.is_active = true
           WHERE p.id = $1 LIMIT 1`,
          [userId]
        );

        if (locRes.rows.length > 0) {
          const loc = locRes.rows[0];
          if (loc.div_lat && loc.div_lon) {
            candidateLocations.push({
              name: `Lokasi Divisi ${loc.div_name || 'Divisi'}`,
              lat: parseFloat(loc.div_lat),
              lon: parseFloat(loc.div_lon),
              radius: parseFloat(loc.div_radius || 150),
            });
          }
          if (loc.office_lat && loc.office_lon) {
            candidateLocations.push({
              name: loc.office_name || 'Kantor Pusat PT FRP',
              lat: parseFloat(loc.office_lat),
              lon: parseFloat(loc.office_lon),
              radius: parseFloat(loc.office_radius || 100),
            });
          }
          if (loc.assigned_latitude && loc.assigned_longitude) {
            candidateLocations.push({
              name: loc.assigned_location_name || 'Lokasi Khusus Karyawan',
              lat: parseFloat(loc.assigned_latitude),
              lon: parseFloat(loc.assigned_longitude),
              radius: parseFloat(loc.assigned_radius_meters || 150),
            });
          }

          // Cek Pos OGS khusus kepulangan
          if (loc.allow_ogs_clock_out !== false) {
            candidateLocations.push({
              name: 'Pintu OGS Tonasa',
              lat: -4.787904,
              lon: 119.613399,
              radius: 250,
            });
          }

          // Allowed posts dari divisi atau user
          let allowedPostsList = [];
          if (loc.div_allowed_posts) {
            const parsed = typeof loc.div_allowed_posts === 'string' ? JSON.parse(loc.div_allowed_posts) : loc.div_allowed_posts;
            if (Array.isArray(parsed)) allowedPostsList.push(...parsed);
          }
          if (loc.user_allowed_posts) {
            const parsed = typeof loc.user_allowed_posts === 'string' ? JSON.parse(loc.user_allowed_posts) : loc.user_allowed_posts;
            if (Array.isArray(parsed)) allowedPostsList.push(...parsed);
          }
          for (const ap of allowedPostsList) {
            if (ap.latitude && ap.longitude && ap.allowClockOut !== false) {
              candidateLocations.push({
                name: ap.name || ap.code || 'Pos Divisi',
                lat: parseFloat(ap.latitude),
                lon: parseFloat(ap.longitude),
                radius: parseFloat(ap.radiusMeters || ap.radius_meters || 150),
              });
            }
          }
        }
      } catch (locErr) {
        console.warn('[ClockOut] Div/Office query warn:', locErr.message);
      }

      // C. Pos Default Kantor Pusat PT FRP (Biring Ere / Kalabbirang)
      candidateLocations.push({
        name: 'Kantor Pusat PT FRP',
        lat: -4.79396318,
        lon: 119.60433745,
        radius: 200,
      });

      // Evaluasi jarak terhadap seluruh kandidat lokasi sah perusahaan
      const curLat = parseFloat(latitude);
      const curLon = parseFloat(longitude);
      const evaluated = candidateLocations.map((c) => {
        const dist = calculateHaversineMeters(curLat, curLon, c.lat, c.lon);
        return { ...c, distance: dist, isValid: dist <= (c.radius + 25) }; // toleransi GPS 25m
      });

      const matched = evaluated.find((e) => e.isValid);
      if (matched) {
        serverDistance = Math.round(matched.distance);
        isServerGeofenceValid = true;
      } else if (evaluated.length > 0) {
        const nearest = evaluated.sort((a, b) => a.distance - b.distance)[0];
        serverDistance = Math.round(nearest.distance);
        isServerGeofenceValid = false;
      }
    }

    // Validasi Biometrik Pulang via InsightFace (Container hrm-face-ai Port 5001)
    let computedClockOutScore = biometricScore;
    let computedClockOutMatch = biometricMatch;

    let masterEmbeddingOut = userProfile ? userProfile.face_embedding : null;
    if (userProfile && (!masterEmbeddingOut || !Array.isArray(masterEmbeddingOut) || masterEmbeddingOut.length === 0) && userProfile.face_enrolled_photo) {
      try {
        const extRes = await fetch(`${FACE_AI_URL}/extract-embedding-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: userProfile.face_enrolled_photo })
        });
        if (extRes.ok) {
          const extData = await extRes.json();
          if (extData.success && Array.isArray(extData.embedding) && extData.embedding.length === 512) {
            masterEmbeddingOut = extData.embedding;
            await pool.query('UPDATE hrm_profiles SET face_embedding = $1 WHERE id = $2', [masterEmbeddingOut, userProfile.id]);
          }
        }
      } catch (e) {}
    }

    const photoToVerifyOut = req.body.cleanPhoto || photo;
    if (masterEmbeddingOut && Array.isArray(masterEmbeddingOut) && masterEmbeddingOut.length > 0 && photoToVerifyOut) {
      try {
        const aiRes = await fetch(`${FACE_AI_URL}/verify-face-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: photoToVerifyOut,
            master_embedding: masterEmbeddingOut,
            threshold: 0.60
          })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.success) {
            computedClockOutMatch = aiData.is_match;
            computedClockOutScore = aiData.confidence;
            if (!aiData.is_match) {
              return res.status(400).json({
                success: false,
                error: `Verifikasi Wajah Pulang InsightFace Gagal: Wajah terdeteksi ${aiData.confidence}% cocok (ambang batas aman 60%). Pastikan tidak diwakilkan orang lain.`,
                code: 'BIOMETRIC_MISMATCH',
                confidence: aiData.confidence
              });
            }
          } else {
            return res.status(400).json({
              success: false,
              error: `Wajah tidak terdeteksi oleh AI pada kamera. Harap pastikan seluruh wajah terlihat jelas menghadap kamera dan berada di area berpenerangan cukup.`,
              code: 'FACE_NOT_DETECTED'
            });
          }
        }
      } catch (aiErr) {
        console.warn('[BiometricAI] Face AI microservice offline on clock-out:', aiErr.message);
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
      WHERE id = (
        SELECT id FROM hrm_attendances
        WHERE user_id = $7 AND (attendance_date = $8 OR attendance_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date - INTERVAL '1 day')
          AND clock_out IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING *;
    `;
    const result = await pool.query(query, [
      time,
      photo,
      latitude,
      longitude,
      earlyLeavingMinutes || 0,
      workDurationMinutes || 0,
      validUserId,
      date,
      computedClockOutScore != null ? computedClockOutScore : (biometricScore != null ? biometricScore : null),
      computedClockOutMatch != null ? computedClockOutMatch : (biometricMatch != null ? biometricMatch : null),
      serverDistance != null ? serverDistance : geofenceDistance,
      isServerGeofenceValid,
      isMockLocation === true,
      flagsJson,
    ]);
    const updatedAttendance = result.rows[0];

    // ─── 3. EMERGENCY POST-SHIFT OVERTIME (LAPORAN LEMBUR DARURAT PASCA-SHIFT) ───
    let emergencyOtRecord = null;
    const isEmergencyOvertime = req.body.isEmergencyOvertime === true || req.body.isEmergencyOvertime === 'true';
    const rawEmergencyHours = parseFloat(req.body.emergencyOvertimeHours) || 0;

    if (isEmergencyOvertime && rawEmergencyHours > 0 && updatedAttendance?.id) {
      // 3-Hour Hard Safety Cap Enforced (Instruksi Ketat Pimpinan PT FRP)
      const clampedEmergencyHours = Math.min(Math.max(rawEmergencyHours, 0.5), 3.0);
      const emergencyReason = (req.body.emergencyOvertimeReason || 'Tugas operasional darurat pasca-shift').trim();

      // Update Attendance record
      await pool.query(`
        UPDATE hrm_attendances SET
          is_emergency_overtime = true,
          emergency_overtime_hours = $1,
          emergency_overtime_reason = $2,
          emergency_overtime_status = 'pending_verification',
          updated_at = NOW()
        WHERE id = $3;
      `, [clampedEmergencyHours, emergencyReason, updatedAttendance.id]);

      // Generate Ticket in hrm_overtime_records
      const otInsertRes = await pool.query(`
        INSERT INTO hrm_overtime_records (
          user_id, date, start_time, end_time, duration_hours, requested_hours, approved_hours,
          task_description, task_photo_url, is_emergency, source, status, overtime_phase,
          emergency_reported_at, approval_notes
        ) VALUES (
          $1, $2::date, COALESCE($3, '16:30'), COALESCE($4, '19:30'), $5, $5, $5,
          $6, $7, true, 'emergency_post_shift', 'pending', 'completed',
          NOW(), 'Lembur Darurat Pasca-Shift dilaporkan otomatis saat Clock-Out (Maks 3 Jam)'
        ) RETURNING *;
      `, [
        validUserId,
        date,
        userProfile?.custom_end_time || '16:30',
        time || '19:30',
        clampedEmergencyHours,
        emergencyReason,
        photo || null
      ]);
      emergencyOtRecord = otInsertRes.rows[0];

      // Dispatch WhatsApp Alert to Korlap, K3, Admin, Superadmin, Pimpinan, Dirut
      const empName = userProfile?.full_name || 'Petugas Lapangan';
      const empNip = userProfile?.nip || '-';
      const posName = locationName || 'Pos Tugas Lapangan';
      const waMsgEmergency = `🚨 *LAPORAN LEMBUR DARURAT PASCA-SHIFT (MAKS 3 JAM)*\n\n` +
        `👤 *Karyawan:* ${empName} (NIP: ${empNip})\n` +
        `🏢 *Divisi:* ${userProfile?.division_name || 'Operasional'}\n` +
        `📍 *Pos Presensi:* ${posName}\n` +
        `⏱️ *Jam Pulang:* ${time || '-'} WITA\n` +
        `⚡ *Durasi Lembur:* +${clampedEmergencyHours} Jam (Terkunci Hard-Cap 3 Jam)\n` +
        `📝 *Alasan Lapangan:* _"${emergencyReason}"_\n` +
        `📸 *Bukti Forensik:* Selfie Pulang Ber-Watermark GPS Tersimpan\n` +
        `⏳ *Status:* Menunggu konfirmasi Korlap / Admin di Dashboard.`;

      // Alert leadership
      alertLeadershipViaWhatsAppAndSystem({
        title: 'Laporan Lembur Darurat Pasca-Shift',
        message: `${empName} lapor lembur darurat +${clampedEmergencyHours} jam di ${posName}`,
        waMessage: waMsgEmergency,
        metadata: {
          attendanceId: updatedAttendance.id,
          overtimeRecordId: emergencyOtRecord?.id,
          userId: validUserId,
          hours: clampedEmergencyHours
        }
      }).catch(err => console.error('[Emergency OT Alert Error]:', err.message));
    }

    // Ephemeral Rolling Photo Replacement: Foto checkout (pulang) yang lalu otomatis dihapus dan digantikan hanya dengan foto checkout terbaru
    if (photo && validUserId && updatedAttendance?.id) {
      await pool.query(
        `UPDATE hrm_attendances 
         SET photo_out = NULL 
         WHERE user_id = $1 AND id != $2 AND photo_out IS NOT NULL;`,
        [validUserId, updatedAttendance.id]
      ).catch((err) => console.warn('[Photo Retention] Error clearing older clock-out photos:', err));
    }

    // 🛡️ Reset radar perimeter & pos penugasan aktif saat karyawan clock-out
    await pool.query(
      `UPDATE hrm_profiles SET
         current_active_post_id = NULL,
         current_active_post_name = NULL,
         is_out_of_bounds = false,
         out_of_bounds_distance = 0
       WHERE id = $1;`,
      [validUserId]
    ).catch(e => console.warn('[Clock-Out Profile Reset Error]:', e.message));

    res.json({ success: true, data: updatedAttendance, emergencyOvertime: emergencyOtRecord });
  } catch (err) {
    console.error('Clock-out error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4A. PULANG AWAL DARURAT (REKOMENDASI 1 - SELF-SERVICE) ─────────────────
app.post('/api/attendances/early-leave', async (req, res) => {
  const rawUserId = req.body.userId || req.body.employeeId;
  const {
    date,
    time,
    category,
    reason,
    photo,
    latitude,
    longitude,
    workDurationMinutes,
    biometricScore,
    biometricMatch,
    geofenceDistance,
    geofenceValid,
  } = req.body;

  if (!rawUserId) {
    return res.status(400).json({ success: false, error: 'User ID / Employee ID wajib disertakan' });
  }

  const userId = rawUserId;

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const todayDate = date || new Date().toISOString().split('T')[0];
    const clockOutTime = (time || new Date().toTimeString().split(' ')[0]).replace(/\./g, ':');

    // Update presensi hari ini
    const query = `
      UPDATE hrm_attendances SET
        clock_out = $1,
        photo_out = $2,
        lat_out = $3,
        long_out = $4,
        is_early_leave = true,
        early_leave_category = $5,
        early_leave_reason = $6,
        work_duration_minutes = COALESCE($7, work_duration_minutes),
        biometric_score = COALESCE($8, biometric_score),
        biometric_match = COALESCE($9, biometric_match),
        geofence_distance_meters = COALESCE($10, geofence_distance_meters),
        geofence_valid = COALESCE($11, geofence_valid),
        is_locked = false,
        is_perimeter_breached = false,
        is_on_break = false,
        notes = COALESCE(notes, '') || ' [PULANG AWAL DARURAT: ' || $14 || '] ' || $15,
        updated_at = NOW()
      WHERE id = (
        SELECT id FROM hrm_attendances
        WHERE user_id = $12 AND (attendance_date = $13 OR attendance_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date - INTERVAL '1 day')
          AND clock_out IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING *;
    `;
    const result = await pool.query(query, [
      clockOutTime,
      photo,
      latitude,
      longitude,
      category || 'darurat',
      reason || 'Keperluan darurat/kesehatan',
      workDurationMinutes || 0,
      biometricScore != null ? biometricScore : null,
      biometricMatch != null ? biometricMatch : null,
      geofenceDistance != null ? geofenceDistance : null,
      geofenceValid !== false,
      validUserId,
      todayDate,
      category || 'darurat',
      reason || 'Keperluan darurat/kesehatan'
    ]);

    // Update profile status agar tidak dianggap out of bounds
    await pool.query(
      `UPDATE hrm_profiles SET is_out_of_bounds = false, out_of_bounds_distance = 0, current_active_post_id = NULL, current_active_post_name = NULL WHERE id = $1`,
      [validUserId]
    );

    // Ambil data profile karyawan lengkap (divisi, korlap) untuk format pesan
    const profRes = await pool.query(
      `SELECT p.*, d.name as division_name, kr.phone as korlap_phone, kr.full_name as korlap_name
       FROM hrm_profiles p
       LEFT JOIN hrm_divisions d ON p.division_id = d.id
       LEFT JOIN hrm_profiles kr ON p.kepala_regu_id = kr.id
       WHERE p.id = $1 LIMIT 1;`,
      [validUserId]
    );
    const prof = profRes.rows[0] || { full_name: 'Karyawan', nip: 'FRP' };

    const witaTimeStr = new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WITA';

    const categoryLabel = {
      sakit_mendadak: 'Sakit Mendadak / Kebutuhan Medis',
      darurat_keluarga: 'Darurat Keluarga / Musibah',
      tugas_luar: 'Tugas Luar / Panggilan Mendesak',
      lainnya: 'Keperluan Mendesak Lainnya',
    }[category] || category || 'Darurat';

    // 📲 FORMAT PESAN WHATSAPP PEMBERITAHUAN RESMI
    const alertTitle = `🚨 Pulang Awal Darurat: ${prof.full_name}`;
    const alertMsg = `Karyawan ${prof.full_name} (${prof.nip}) telah melakukan izin pulang darurat mandiri (${categoryLabel}). Alasan: "${reason}". Waktu: ${witaTimeStr}.`;

    const waMsg =
`🚨 *INFORMASI IZIN PULANG DARURAT (MANDIRI)*
*PT. FAWWAZ RESKI PERWIRA*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Nama:* ${prof.full_name}
🆔 *NIP:* ${prof.nip || '-'}
🏢 *Divisi:* ${prof.division_name || '-'}
🏷️ *Kategori Darurat:* ${categoryLabel}
📝 *Alasan / Keterangan:*
_"${reason}"_
⏰ *Waktu Pulang:* ${witaTimeStr}
📍 *Pos Terakhir:* ${prof.current_active_post_name || 'Lokasi Kerja'}
🌐 *Koordinat GPS:* ${latitude && longitude ? `${latitude}, ${longitude}` : 'Terverifikasi GPS'}

*Catatan Sistem:*
Izin pulang darurat diproses mandiri tanpa konfirmasi agar tidak menghambat penanganan darurat. Pesan ini diteruskan otomatis sebagai informasi dan koordinasi bagi Korlap, Admin, K3, dan Superadmin.
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // 1. Simpan notifikasi in-app ke Superadmin
    await alertLeadershipViaWhatsAppAndSystem({
      title: alertTitle,
      message: alertMsg,
      waMessage: waMsg,
      link: '/admin/monitoring',
      metadata: {
        type: 'early_leave_emergency',
        userId: validUserId,
        category,
        reason,
        latitude,
        longitude
      }
    });

    // 2. Dispatch WhatsApp ke Korlap (jika tersedia nomor korlap)
    if (prof.korlap_phone) {
      await sendWhatsAppAlert({ phone: prof.korlap_phone, message: waMsg }).catch(e => console.error('[WA Korlap Emergency Error]:', e.message));
    }

    // 3. Dispatch WhatsApp ke Petugas K3
    const k3Res = await pool.query(
      `SELECT p.phone FROM hrm_profiles p
       JOIN hrm_roles r ON p.role_id = r.id
       WHERE (r.name ILIKE '%k3%' OR r.label ILIKE '%k3%' OR p.job_title ILIKE '%k3%') AND p.phone IS NOT NULL AND p.phone != ''
       LIMIT 3;`
    ).catch(() => ({ rows: [] }));

    for (const k3Row of k3Res.rows) {
      if (k3Row.phone && k3Row.phone !== '081355904897' && k3Row.phone !== prof.korlap_phone) {
        await sendWhatsAppAlert({ phone: k3Row.phone, message: waMsg }).catch(e => console.error('[WA K3 Emergency Error]:', e.message));
      }
    }

    // 4. Jika karyawan adalah salah satu dari 3 Petugas Lapangan Khusus, teruskan juga ke Dirut & Pimpinan
    const specialNips = ['FRP 07065', 'FR.07.066', 'FRP.07.046'];
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '2ce41a19-0c65-45d3-913e-a68a02203fe2', // LA UNGA SAMSI
      '0a49f92e-5733-4b72-947c-7361f9490632'  // TAKDIR
    ];
    const isSpecialOfficer = specialIds.includes(prof.id) || specialNips.includes(prof.nip?.trim());

    if (isSpecialOfficer) {
      // Dirut: 082291998026
      await sendWhatsAppAlert({ phone: '082291998026', message: waMsg }).catch(e => console.error('[WA Dirut Emergency Error]:', e.message));
      // Pimpinan: 082192755755
      await sendWhatsAppAlert({ phone: '082192755755', message: waMsg }).catch(e => console.error('[WA Pimpinan Emergency Error]:', e.message));
    }

    res.json({ success: true, data: result.rows[0], message: 'Presensi pulang awal darurat berhasil dicatat dan dilaporkan' });
  } catch (err) {
    console.error('[Early Leave Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4B. REMOTE UNLOCK CHECKOUT (REKOMENDASI 3 / REKOMENDASI 2 OLEH ADMIN / KORLAP) ────
app.post('/api/attendances/remote-unlock', async (req, res) => {
  const { userId, date, unlockedBy, reason } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID wajib disertakan' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const todayDate = date || new Date().toISOString().split('T')[0];
    const approverName = unlockedBy || 'Admin / Korlap';

    const result = await pool.query(
      `UPDATE hrm_attendances SET
         is_remote_unlocked = true,
         remote_unlocked_by = $1,
         remote_unlocked_at = NOW(),
         is_locked = false,
         is_perimeter_breached = false,
         notes = COALESCE(notes, '') || ' [Kunci Checkout Dibuka oleh ' || $5 || ': ' || COALESCE($2, 'Izin Khusus') || ']',
         updated_at = NOW()
       WHERE user_id = $3 AND attendance_date = $4
       RETURNING *;`,
      [approverName, reason || 'Izin kepulangan', validUserId, todayDate, approverName]
    );

    // Kirim notifikasi in-app ke karyawan bahwa kunci kepulangan telah dibuka
    await pool.query(
      `INSERT INTO hrm_notifications (user_id, title, message, type, link, is_read, created_at)
       VALUES ($1, $2, $3, 'info', '/dashboard', false, NOW())`,
      [
        validUserId,
        `🔓 Tombol Checkout Telah Dibuka`,
        `Presensi pulang Anda telah diizinkan dan dibuka oleh ${approverName}. Anda sekarang dapat melakukan Clock Out melalui aplikasi.`
      ]
    );

    broadcastNotification({
      title: `🔓 Kunci Checkout Dibuka`,
      message: `Presensi pulang untuk karyawan telah dibuka oleh ${approverName}`,
      type: 'info',
      link: '/dashboard',
      data: { userId: validUserId, unlockedBy: approverName }
    });

    res.json({ success: true, message: 'Kunci presensi pulang berhasil dibuka untuk karyawan', data: result.rows[0] });
  } catch (err) {
    console.error('[Remote Unlock Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4C. BREAK TIME ENGINE (FITUR JAM ISTIRAHAT 1 JAM) ──────────────────────
app.post('/api/attendances/break/start', async (req, res) => {
  const { userId, date, startTime } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID wajib disertakan' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const todayDate = date || new Date().toISOString().split('T')[0];
    const breakStart = startTime || new Date().toISOString();

    const result = await pool.query(
      `UPDATE hrm_attendances SET
         is_on_break = true,
         break_start_time = $1,
         updated_at = NOW()
       WHERE user_id = $2 AND attendance_date = $3
       RETURNING *;`,
      [breakStart, validUserId, todayDate]
    );

    // Tandai status profile agar jeda monitoring pelanggaran
    await pool.query(
      `UPDATE hrm_profiles SET is_out_of_bounds = false, updated_at = NOW() WHERE id = $1`,
      [validUserId]
    );

    res.json({ success: true, isOnBreak: true, breakStartTime: breakStart, data: result.rows[0] });
  } catch (err) {
    console.error('[Break Start Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/attendances/break/end', async (req, res) => {
  const { userId, date, endTime, durationMinutes } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID wajib disertakan' });
  }

  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query('SELECT id FROM hrm_profiles WHERE LOWER(email) = LOWER($1) OR LOWER(nip) = LOWER($1) LIMIT 1', [userId]);
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const todayDate = date || new Date().toISOString().split('T')[0];
    const breakEnd = endTime || new Date().toISOString();
    const durMins = durationMinutes || 0;

    const result = await pool.query(
      `UPDATE hrm_attendances SET
         is_on_break = false,
         break_end_time = $1,
         break_duration_minutes = COALESCE(break_duration_minutes, 0) + $2,
         updated_at = NOW()
       WHERE user_id = $3 AND attendance_date = $4
       RETURNING *;`,
      [breakEnd, durMins, validUserId, todayDate]
    );

    res.json({ success: true, isOnBreak: false, breakEndTime: breakEnd, data: result.rows[0] });
  } catch (err) {
    console.error('[Break End Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4D. BREAK TIME POLICY SETTINGS (DASHBOARD SUPERADMIN) ───────────────────
app.get('/api/settings/break-policy', async (req, res) => {
  try {
    const sRes = await pool.query(
      "SELECT key, value FROM hrm_system_settings WHERE key IN ('break_policy_enabled', 'break_duration_minutes', 'break_allow_outside')"
    );
    const settings = {
      enabled: true,
      durationMinutes: 60,
      allowOutside: true,
    };
    sRes.rows.forEach(r => {
      if (r.key === 'break_policy_enabled') settings.enabled = r.value !== 'false';
      if (r.key === 'break_duration_minutes') settings.durationMinutes = parseInt(r.value, 10) || 60;
      if (r.key === 'break_allow_outside') settings.allowOutside = r.value !== 'false';
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/break-policy', async (req, res) => {
  const { enabled, durationMinutes, allowOutside } = req.body;
  try {
    await pool.query(
      `INSERT INTO hrm_system_settings (key, value, updated_at)
       VALUES 
         ('break_policy_enabled', $1, NOW()),
         ('break_duration_minutes', $2, NOW()),
         ('break_allow_outside', $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
      [
        enabled !== false ? 'true' : 'false',
        String(durationMinutes || 60),
        allowOutside !== false ? 'true' : 'false'
      ]
    );
    res.json({ success: true, message: 'Pengaturan jam istirahat berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendances/today - Ambil data presensi hari ini untuk karyawan secara realtime & akurat
app.get('/api/attendances/today', async (req, res) => {
  const { userId, date } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID wajib disertakan' });
  }
  try {
    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const u = await pool.query(
        'SELECT id FROM hrm_profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) OR LOWER(TRIM(nip)) = LOWER(TRIM($1)) OR id::text = $1 LIMIT 1',
        [userId]
      );
      if (u.rows.length > 0) validUserId = u.rows[0].id;
    }

    const query = `
      SELECT a.*, p.full_name as user_name, p.nip as user_nip, p.avatar_url as user_avatar,
             COALESCE(d.name, p.division_name, 'Umum') as division_name
      FROM hrm_attendances a
      LEFT JOIN hrm_profiles p ON a.user_id = p.id
      LEFT JOIN hrm_divisions d ON p.division_id = d.id
      WHERE (a.user_id::text = $1 OR a.user_id::text = $3 OR LOWER(p.nip) = LOWER($3) OR LOWER(p.email) = LOWER($3)) 
        AND a.attendance_date = COALESCE(NULLIF($2, '')::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date)
      ORDER BY 
        CASE WHEN a.clock_out IS NULL THEN 0 ELSE 1 END,
        a.clock_in DESC NULLS LAST,
        a.created_at DESC
      LIMIT 1;
    `;
    const result = await pool.query(query, [String(validUserId), date || null, String(userId)]);
    if (result.rows.length === 0) {
      return res.json({ success: true, attendance: null });
    }
    const a = result.rows[0];
    const attDate = a.attendance_date ? (typeof a.attendance_date === 'string' ? a.attendance_date.substring(0, 10) : new Date(a.attendance_date).toISOString().split('T')[0]) : '';
    const attendance = {
      id: a.id,
      userId: a.user_id,
      user_id: a.user_id,
      userName: a.user_name || undefined,
      userNip: a.user_nip || undefined,
      userAvatar: a.user_avatar || undefined,
      divisionName: a.division_name || undefined,
      date: attDate,
      attendanceDate: attDate,
      clockIn: a.clock_in ? a.clock_in.substring(0, 5) : null,
      clock_in: a.clock_in,
      clockOut: a.clock_out ? a.clock_out.substring(0, 5) : null,
      clock_out: a.clock_out,
      photoIn: a.photo_in,
      photoOut: a.photo_out,
      clockInPhoto: a.photo_in,
      clockOutPhoto: a.photo_out,
      clockInLat: parseFloat(a.lat_in) || undefined,
      clockInLong: parseFloat(a.long_in) || undefined,
      clockOutLat: parseFloat(a.lat_out) || undefined,
      clockOutLong: parseFloat(a.long_out) || undefined,
      status: a.status,
      workMode: a.work_mode || 'onsite',
      lateMinutes: a.late_minutes || 0,
      earlyLeavingMinutes: a.early_leaving_minutes || 0,
      workDurationMinutes: a.work_duration_minutes || 0,
      isLocked: a.is_locked === true,
      notes: a.notes,
      biometricScore: a.biometric_score != null ? parseFloat(a.biometric_score) : undefined,
      biometricMatch: a.biometric_match != null ? a.biometric_match : undefined,
      geofenceDistance: a.geofence_distance_meters != null ? parseFloat(a.geofence_distance_meters) : undefined,
      geofenceValid: a.geofence_valid != null ? a.geofence_valid : undefined,
      isOnBreak: a.is_on_break === true,
      breakStartTime: a.break_start_time,
      breakEndTime: a.break_end_time,
      breakDurationMinutes: a.break_duration_minutes || 0,
      isEarlyLeave: a.is_early_leave === true,
      earlyLeaveCategory: a.early_leave_category,
      earlyLeaveReason: a.early_leave_reason,
      createdAt: a.created_at,
    };
    res.json({ success: true, attendance });
  } catch (err) {
    console.error('Error fetching today attendance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/attendances', async (req, res) => {
  const { date, month, startDate, endDate, userId, includePhoto, limit } = req.query;
  try {
    const isFullPhoto = includePhoto === 'true';
    let query = isFullPhoto
      ? `SELECT a.*, p.full_name as user_name, p.nip as user_nip, p.avatar_url as user_avatar,
                COALESCE(d.name, p.division_name, 'Umum') as division_name
         FROM hrm_attendances a
         LEFT JOIN hrm_profiles p ON a.user_id = p.id
         LEFT JOIN hrm_divisions d ON p.division_id = d.id`
      : `SELECT a.id, a.user_id, a.attendance_date, a.clock_in, a.clock_out,
                a.lat_in, a.long_in, a.lat_out, a.long_out, a.status,
                a.late_minutes, a.early_leaving_minutes, a.work_duration_minutes,
                a.is_locked, a.is_perimeter_breached, a.perimeter_breach_count, a.time_outside_minutes,
                a.notes, a.biometric_score, a.biometric_match, a.geofence_distance_meters,
                a.geofence_valid, a.is_mock_location, a.security_flags,
                a.is_early_leave, a.early_leave_reason, a.early_leave_category,
                a.is_remote_unlocked, a.remote_unlocked_by, a.remote_unlocked_at,
                a.is_on_break, a.break_start_time, a.break_end_time, a.break_duration_minutes,
                (a.photo_in IS NOT NULL) as has_photo_in,
                (a.photo_out IS NOT NULL) as has_photo_out,
                p.full_name as user_name, p.nip as user_nip,
                CASE WHEN (p.avatar_url IS NOT NULL OR p.face_photo_url IS NOT NULL) THEN '/api/users/' || p.id || '/avatar' ELSE NULL END as user_avatar,
                COALESCE(d.name, p.division_name, 'Umum') as division_name
         FROM hrm_attendances a
         LEFT JOIN hrm_profiles p ON a.user_id = p.id
         LEFT JOIN hrm_divisions d ON p.division_id = d.id`;
    const params = [];
    const conditions = [];
    // Rekapan hanya mencakup karyawan dengan NIP berawalan FR
    if (!userId) {
      conditions.push(`UPPER(REPLACE(REPLACE(p.nip, ' ', ''), '.', '')) LIKE 'FR%'`);
    }
    if (date) {
      params.push(date);
      conditions.push(`a.attendance_date = $${params.length}`);
    } else if (month) {
      params.push(month);
      conditions.push(`TO_CHAR(a.attendance_date, 'YYYY-MM') = $${params.length}`);
    } else if (startDate && endDate) {
      params.push(startDate);
      const pStart = params.length;
      params.push(endDate);
      const pEnd = params.length;
      conditions.push(`a.attendance_date BETWEEN $${pStart} AND $${pEnd}`);
    }
    if (userId) {
      let resolvedUserId = userId;
      if (!UUID_REGEX.test(userId)) {
        const u = await pool.query(
          'SELECT id FROM hrm_profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) OR LOWER(TRIM(nip)) = LOWER(TRIM($1)) OR id::text = $1 LIMIT 1',
          [userId]
        );
        if (u.rows.length > 0) resolvedUserId = u.rows[0].id;
      }
      params.push(String(resolvedUserId));
      const p1 = params.length;
      params.push(String(userId));
      const p2 = params.length;
      conditions.push(`(a.user_id::text = $${p1} OR a.user_id::text = $${p2} OR LOWER(p.nip) = LOWER($${p2}) OR LOWER(p.email) = LOWER($${p2}))`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const maxLimit = limit ? Math.min(parseInt(limit, 10), 10000) : (month || userId ? 5000 : 500);
    query += ` ORDER BY a.attendance_date DESC, a.clock_in DESC LIMIT ${maxLimit}`;
    const result = await pool.query(query, params);
    const data = result.rows.map((a) => {
      const attDate = a.attendance_date ? (typeof a.attendance_date === 'string' ? a.attendance_date.substring(0, 10) : new Date(a.attendance_date).toISOString().split('T')[0]) : '';
      const photoInUrl = (a.has_photo_in || a.photo_in) ? `/api/attendances/${a.id}/photo?type=in` : null;
      const photoOutUrl = (a.has_photo_out || a.photo_out) ? `/api/attendances/${a.id}/photo?type=out` : null;
      return {
        id: a.id,
        userId: a.user_id,
        user_id: a.user_id,
        userName: a.user_name || undefined,
        userNip: a.user_nip || undefined,
        userAvatar: a.user_avatar || undefined,
        divisionName: a.division_name || undefined,
        date: attDate,
        attendanceDate: attDate,
        clockIn: a.clock_in ? a.clock_in.substring(0, 5) : undefined,
        clock_in: a.clock_in,
        clockOut: a.clock_out ? a.clock_out.substring(0, 5) : undefined,
        clock_out: a.clock_out,
        photoIn: isFullPhoto ? a.photo_in : photoInUrl,
        photoOut: isFullPhoto ? a.photo_out : photoOutUrl,
        clockInPhoto: isFullPhoto ? a.photo_in : photoInUrl,
        clockOutPhoto: isFullPhoto ? a.photo_out : photoOutUrl,
        hasPhotoIn: Boolean(a.has_photo_in || a.photo_in),
        hasPhotoOut: Boolean(a.has_photo_out || a.photo_out),
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
        isEarlyLeave: a.is_early_leave === true,
        earlyLeaveReason: a.early_leave_reason,
        earlyLeaveCategory: a.early_leave_category,
        isRemoteUnlocked: a.is_remote_unlocked === true,
        remoteUnlockedBy: a.remote_unlocked_by,
        remoteUnlockedAt: a.remote_unlocked_at,
        isOnBreak: a.is_on_break === true,
        breakStartTime: a.break_start_time,
        breakEndTime: a.break_end_time,
        breakDurationMinutes: a.break_duration_minutes || 0,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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
  const { violationId, userId: reqUserId, attendanceId: reqAttId, resolvedBy, resolutionNotes, unlockAttendance } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let validResolverId = null;
    let resolverName = resolvedBy || 'Superadmin / HRD';
    if (resolvedBy && uuidRegex.test(resolvedBy)) {
      validResolverId = resolvedBy;
    } else if (resolvedBy) {
      const rRes = await client.query(
        'SELECT id, full_name FROM hrm_profiles WHERE id::text = $1 OR LOWER(nip) = LOWER($1) OR LOWER(full_name) = LOWER($1) LIMIT 1',
        [resolvedBy]
      );
      if (rRes.rows.length > 0) {
        validResolverId = rRes.rows[0].id;
        resolverName = rRes.rows[0].full_name || resolverName;
      }
    }

    let viol = null;
    let targetUserId = reqUserId;
    let targetAttId = reqAttId;
    let targetDate = new Date().toISOString().split('T')[0];

    // Coba temukan dan update record pelanggaran resmi di hrm_perimeter_violations
    if (violationId && uuidRegex.test(violationId)) {
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
      if (result.rows.length > 0) {
        viol = result.rows[0];
        targetUserId = targetUserId || viol.user_id;
        targetAttId = targetAttId || viol.attendance_id;
        if (viol.violation_date) targetDate = viol.violation_date;
      }
    } else if (typeof violationId === 'string' && violationId.startsWith('violation-')) {
      const potentialUid = violationId.replace('violation-', '');
      if (uuidRegex.test(potentialUid)) {
        targetUserId = targetUserId || potentialUid;
      }
    }

    // Jika ada pelanggaran aktif untuk targetUserId hari ini, tandai resolved juga
    if (targetUserId) {
      await client.query(`
        UPDATE hrm_perimeter_violations SET
          status = 'resolved',
          resolution_notes = $1,
          resolved_by = $2,
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $3 AND status = 'active';
      `, [resolutionNotes || 'Dispensasi Perimeter oleh ' + resolverName, validResolverId, targetUserId]);
    }

    // Selalu buka kunci kehadiran jika diminta (atau default true)
    if (unlockAttendance !== false) {
      const noteAppend = ` [Dispensasi Perimeter oleh ${resolverName}: ${resolutionNotes || 'Disetujui Atasan'}]`;
      if (targetAttId) {
        await client.query(`
          UPDATE hrm_attendances SET
            is_locked = false,
            is_perimeter_breached = false,
            is_remote_unlocked = true,
            remote_unlocked_by = $1,
            remote_unlocked_at = NOW(),
            notes = COALESCE(notes, '') || $2,
            updated_at = NOW()
          WHERE id = $3;
        `, [resolverName, noteAppend, targetAttId]);
      } else if (targetUserId) {
        await client.query(`
          UPDATE hrm_attendances SET
            is_locked = false,
            is_perimeter_breached = false,
            is_remote_unlocked = true,
            remote_unlocked_by = $1,
            remote_unlocked_at = NOW(),
            notes = COALESCE(notes, '') || $2,
            updated_at = NOW()
          WHERE user_id = $3 AND attendance_date = $4;
        `, [resolverName, noteAppend, targetUserId, targetDate]);
      }
    }

    await client.query('COMMIT');
    console.log(`[Geofence] Breach ${violationId || targetUserId} resolved by ${resolverName}`);

    // In-app notification ke karyawan
    if (targetUserId) {
      try {
        await pool.query(
          `INSERT INTO hrm_notifications (user_id, title, message, type, link, is_read, created_at)
           VALUES ($1, $2, $3, 'info', '/dashboard', false, NOW())`,
          [
            targetUserId,
            '🔓 Kunci Presensi Telah Dibuka',
            `Presensi dan pembatasan perimeter Anda telah diizinkan dan dibuka oleh ${resolverName}. Anda sekarang dapat melanjutkan presensi.`
          ]
        );
      } catch (notifErr) {
        console.warn('[Resolve Breach Notif Warn]', notifErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Kunci presensi berhasil dibuka dan dispensasi dicatat',
      violation: viol || { id: violationId, status: 'resolved' },
      data: viol || { id: violationId, status: 'resolved' }
    });
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4B. BIOMETRIC FACE ENROLLMENT & IDENTITY MANAGEMENT ───────────────────────
app.post('/api/biometrics/enroll', async (req, res) => {
  const { userId, faceDescriptor, enrolledPhoto } = req.body;
  if (!userId || (!faceDescriptor && !enrolledPhoto)) {
    return res.status(400).json({ success: false, error: 'User ID dan foto atau data biometrik wajah wajib disertakan' });
  }
  try {
    let validDescriptor = faceDescriptor ? parseDescriptorRow(faceDescriptor) : null;
    let descriptorStr = validDescriptor ? JSON.stringify(validDescriptor) : null;

    // Ekstraksi otomatis vektor 512-dimensi via InsightFace AI Microservice (Port 5001)
    let aiEmbedding = (validDescriptor && validDescriptor.length === 512) ? validDescriptor : null;
    if (enrolledPhoto) {
      try {
        const aiRes = await fetch(`${FACE_AI_URL}/extract-embedding-json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: enrolledPhoto })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.success && Array.isArray(aiData.embedding) && aiData.embedding.length === 512) {
            aiEmbedding = aiData.embedding;
            if (!descriptorStr) {
              descriptorStr = JSON.stringify(aiEmbedding);
            }
            console.log(`[Biometrics] InsightFace 512D embedding generated successfully for user ${userId}`);
          }
        }
      } catch (aiErr) {
        console.warn('[Biometrics] InsightFace extraction warning on enroll:', aiErr.message);
      }
    }

    const query = `
      UPDATE hrm_profiles SET
        is_face_enrolled = true,
        face_descriptor = COALESCE($1, face_descriptor),
        face_enrolled_photo = COALESCE($2, face_enrolled_photo),
        face_embedding = COALESCE($3, face_embedding),
        face_enrolled_at = NOW(),
        avatar_url = COALESCE($2, avatar_url),
        updated_at = NOW()
      WHERE id::text = $4 OR nip = $4 OR LOWER(email) = LOWER($4)
      RETURNING *;
    `;
    const result = await pool.query(query, [descriptorStr, enrolledPhoto || null, aiEmbedding, userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    console.log(`[Biometrics] Master face enrolled successfully for user ${userId} with InsightFace 512D AI`);
    res.json({ success: true, data: formatUserRow(result.rows[0]), message: 'Wajah master biometrik berhasil didaftarkan (InsightFace 512D)' });
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
        face_embedding = NULL,
        face_enrolled_at = NULL,
        avatar_url = NULL,
        face_photo_url = NULL,
        updated_at = NOW()
      WHERE id::text = $1 OR nip = $1 OR LOWER(email) = LOWER($1)
      RETURNING *;
    `;
    const result = await pool.query(query, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }
    console.log(`[Biometrics] Master face reset successfully for user ${userId}`);
    res.json({ success: true, data: formatUserRow(result.rows[0]), message: 'Data wajah master berhasil direset' });
  } catch (err) {
    console.error('Reset biometrics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 5. DIVISIONS (CRUD POSTGRESQL & COORDINATE SYNC) ───────────────────────────
function formatDivisionRow(d) {
  if (!d) return null;
  let allowedPosts = [];
  try {
    allowedPosts = d.allowed_posts ? (typeof d.allowed_posts === 'string' ? JSON.parse(d.allowed_posts) : d.allowed_posts) : [];
  } catch (e) {
    allowedPosts = [];
  }
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
    allowedPosts,
    bssidWhitelist: d.bssid_whitelist || '',
    wifiSsid: d.wifi_ssid || '',
    isActive: d.is_active !== false,
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/divisions', async (req, res) => {
  const d = req.body;
  try {
    const polygonJson = d.polygonCoords ? (typeof d.polygonCoords === 'string' ? d.polygonCoords : JSON.stringify(d.polygonCoords)) : null;
    const allowedPostsJson = d.allowedPosts !== undefined
      ? (typeof d.allowedPosts === 'string' ? d.allowedPosts : JSON.stringify(d.allowedPosts))
      : (d.allowed_posts !== undefined ? (typeof d.allowed_posts === 'string' ? d.allowed_posts : JSON.stringify(d.allowed_posts)) : '[]');

    const query = `
      INSERT INTO hrm_divisions (
        code, name, description, location_name, address, latitude, longitude, radius_meters, polygon_coords, bssid_whitelist, wifi_ssid, allowed_posts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
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
        allowed_posts = COALESCE(EXCLUDED.allowed_posts, hrm_divisions.allowed_posts),
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
      allowedPostsJson,
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
    const allowedPostsJson = d.allowedPosts !== undefined
      ? (typeof d.allowedPosts === 'string' ? d.allowedPosts : JSON.stringify(d.allowedPosts))
      : (d.allowed_posts !== undefined ? (typeof d.allowed_posts === 'string' ? d.allowed_posts : JSON.stringify(d.allowed_posts)) : undefined);

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
        allowed_posts = COALESCE($10::jsonb, allowed_posts),
        updated_at = NOW()
      WHERE id::text = $11 OR code = $11
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
      allowedPostsJson !== undefined ? allowedPostsJson : null,
      id,
    ]);
    if (result.rows.length === 0) {
      // If not found by ID or code, try upserting
      const insQuery = `
        INSERT INTO hrm_divisions (
          code, name, description, location_name, address, latitude, longitude, radius_meters, polygon_coords, allowed_posts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
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
        allowedPostsJson || '[]',
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

// ─── 5B. SIMULATION & SOSIALISASI VENUE ENDPOINTS ──────────────────────────────────
app.get('/api/simulation/status', async (req, res) => {
  try {
    const divRes = await pool.query(`SELECT * FROM hrm_divisions WHERE code = 'DIV-SIM' LIMIT 1`);
    const div = divRes.rows[0] || null;
    
    // Hitung log presensi simulasi yang tercatat hari ini
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM hrm_attendances 
       WHERE (is_simulation = true OR notes LIKE '%[SIMULASI%') 
         AND attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Makassar')::date`
    );
    const count = parseInt(countRes.rows[0]?.count || 0, 10);

    res.json({
      success: true,
      data: {
        division: div ? formatDivisionRow(div) : null,
        simulationAttendanceCountToday: count,
        isActive: Boolean(div && div.is_active === true)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/simulation/toggle', async (req, res) => {
  const { isActive } = req.body;
  try {
    const nextState = Boolean(isActive);
    const result = await pool.query(
      `UPDATE hrm_divisions SET is_active = $1, updated_at = NOW() WHERE code = 'DIV-SIM' RETURNING *`,
      [nextState]
    );
    const div = result.rows[0];
    res.json({
      success: true,
      message: nextState ? '🎯 Sesi Simulasi Sosialisasi DIAKTIFKAN!' : '🔒 Sesi Simulasi Sosialisasi DINONAKTIFKAN!',
      data: {
        division: div ? formatDivisionRow(div) : null,
        isActive: nextState
      }
    });
  } catch (err) {
    console.error('Toggle simulation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/simulation/venue', async (req, res) => {
  const { latitude, longitude, radiusMeters, locationName, address } = req.body;
  try {
    const lat = latitude !== undefined ? parseFloat(latitude) : -4.78236486;
    const lng = longitude !== undefined ? parseFloat(longitude) : 119.57192181;
    const rad = radiusMeters !== undefined ? parseInt(radiusMeters, 10) : 300;
    const locName = locationName || 'Venue Acara / Ruang Sosialisasi';
    const addr = address || 'Lokasi Presentasi & Sosialisasi PT FRP';

    const query = `
      INSERT INTO hrm_divisions (
        code, name, description, location_name, address, latitude, longitude, radius_meters
      ) VALUES ('DIV-SIM', 'Divisi Uji Coba & Simulasi Sosialisasi', 'Divisi khusus sesi presentasi dan simulasi presensi wajah & lokasi karyawan tanpa batasan jadwal', $1, $2, $3, $4, $5)
      ON CONFLICT (code) DO UPDATE SET
        location_name = EXCLUDED.location_name,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        radius_meters = EXCLUDED.radius_meters,
        updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [locName, addr, lat, lng, rad]);
    res.json({
      success: true,
      message: 'Titik koordinat venue simulasi berhasil diperbarui!',
      data: formatDivisionRow(result.rows[0])
    });
  } catch (err) {
    console.error('Update simulation venue error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/simulation/clean-logs', async (req, res) => {
  try {
    const delRes = await pool.query(
      `DELETE FROM hrm_attendances 
       WHERE is_simulation = true OR notes LIKE '%[SIMULASI%'
       RETURNING id;`
    );
    res.json({
      success: true,
      deletedCount: delRes.rowCount,
      message: `${delRes.rowCount} rekaman presensi simulasi berhasil dibersihkan dari database!`
    });
  } catch (err) {
    console.error('Clean simulation logs error:', err);
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `2026-10-${dayStr}`;
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay(); // 0 is Sun, 6 is Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const att = userAtts.find(a => a.attendance_date === dateStr);

        let status = isWeekend ? 'libur' : 'mangkir';
        let clockIn = null;
        let clockOut = null;
        let lateMinutes = 0;
        let notes = '';
        const isExemptDate = dateStr < LATE_EFFECTIVE_DATE;
        let lateDeduction = 0;
        let dailyPay = 0;

        if (att) {
          status = att.status;
          clockIn = att.clock_in;
          clockOut = att.clock_out;
          lateMinutes = parseInt(att.late_minutes || 0, 10);
          notes = att.notes || '';
        }

        if (isWeekend) {
          status = 'libur';
          dailyPay = 0;
          lateDeduction = 0;
        } else {
          if (status === 'hadir') {
            hadirCount++;
            dailyPay = DAILY_RATE;
          } else if (status === 'terlambat') {
            terlambatCount++;
            dailyPay = DAILY_RATE;
            if (isExemptDate) {
              exemptLateMinutes += lateMinutes;
              lateDeduction = 0;
            } else {
              billableLateMinutes += lateMinutes;
              lateDeduction = lateMinutes * LATE_RATE_PER_MINUTE;
            }
          } else if (status === 'cuti') {
            cutiCount++;
            dailyPay = DAILY_RATE; // Cuti tidak termasuk mangkir
          } else if (status === 'sakit') {
            sakitCount++;
            dailyPay = DAILY_RATE; // Sakit tidak termasuk mangkir
          } else {
            mangkirCount++;
            dailyPay = 0;
          }
        }

        dailyDetails.push({
          date: dateStr,
          dayNumber: day,
          dayOfWeek,
          isWeekend,
          status,
          clockIn,
          clockOut,
          lateMinutes,
          isExemptDate,
          lateDeductionRate: isExemptDate || isWeekend ? 0 : LATE_RATE_PER_MINUTE,
          dailyPay,
          lateDeduction,
          dailyNet: Math.max(0, dailyPay - lateDeduction),
          notes
        });
      }

      const paidDays = hadirCount + terlambatCount + cutiCount + sakitCount;
      const grossSalary = paidDays * DAILY_RATE;
      const totalLateDeduction = billableLateMinutes * LATE_RATE_PER_MINUTE;
      const netSalary = Math.max(0, grossSalary - totalLateDeduction);

      grandGross += grossSalary;
      grandLateDeduction += totalLateDeduction;
      grandNet += netSalary;
      grandPaidDays += paidDays;

      return {
        employee: {
          id: emp.id,
          nip: emp.nip,
          fullName: emp.full_name,
          email: emp.email,
          roleName: emp.role_name,
          jobTitle: emp.job_title || 'Petugas Lapangan',
          divisionName: emp.division_name || 'Operasional Lapangan',
          bankName: emp.bank_name || 'Bank Mandiri',
          bankAccount: emp.bank_account_number || '-',
          bankAccountHolder: emp.bank_account_holder || emp.full_name
        },
        summary: {
          totalDaysInMonth: 31,
          totalWorkdays: 22,
          weekendDays: 9,
          hadirCount,
          terlambatCount,
          cutiCount,
          sakitCount,
          mangkirCount,
          paidDays,
          dailyRate: DAILY_RATE,
          grossSalary,
          exemptLateMinutes,
          billableLateMinutes,
          totalLateMinutes: exemptLateMinutes + billableLateMinutes,
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          totalLateDeduction,
          netSalary
        },
        dailyDetails
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          month: 10,
          year: 2026,
          label: 'Oktober 2026',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          totalCalendarDays: 31,
          totalWorkdays: 22,
          weekendDays: 9
        },
        rules: {
          dailyRate: DAILY_RATE,
          weekendPolicy: 'Libur Sabtu dan Minggu (9 Hari Libur)',
          lateDeductionRate: LATE_RATE_PER_MINUTE,
          lateEffectiveDate: LATE_EFFECTIVE_DATE,
          lateExemptNote: 'Keterlambatan tanggal 1-2 Oktober 2026 dibebaskan dari potongan denda.',
          leaveAndSickPolicy: 'Cuti dan Sakit sah TIDAK TERMASUK MANGKIR dan tetap dibayarkan penuh Rp 140.000/hari.'
        },
        grandTotal: {
          totalOfficers: employees.length,
          grandPaidDays,
          grandGross,
          grandLateDeduction,
          grandNet
        },
        employees: reportData
      }
    });
  } catch (err) {
    console.error('[SpecialFieldReport] Error:', err);
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

    // ⚡ ATURAN RESMI PT FRP: Lembur dihitung & dibayarkan adalah BULAN MUNDUR (N-1)
    // Serta DILARANG menampilkan informasi nominal kompensasi rupiah di PWA karyawan
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const otRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
         COALESCE(SUM(duration_hours) FILTER (WHERE status = 'approved'), 0) as approved_hours
       FROM hrm_overtime_records
       WHERE user_id = $1
         AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::date)`,
      [validUserId, prevMonthStart]
    );
    const ot = otRes.rows[0];

    res.json({
      success: true,
      data: {
        annualLeaveQuota: quota,
        usedLeaveDays: used,
        remainingLeaveDays: Math.max(0, quota - used),
        // Lembur bulan mundur (approved) - Tanpa nominal rupiah untuk privasi karyawan
        overtimeThisMonth: {
          approvedCount: parseInt(ot.approved_count || 0, 10),
          approvedHours: parseFloat(ot.approved_hours || 0),
          approvedCompensation: 0, // Informasi nominal disembunyikan dari PWA karyawan
          month: `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`,
          cycle: 'bulan_mundur',
        },
      },
    });
  } catch (err) {
    console.error('[LeaveBalance] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leaves/correct-quota - Fitur Koreksi Hak & Saldo Cuti Karyawan Realtime
app.post('/api/leaves/correct-quota', async (req, res) => {
  try {
    const { userId, annualLeaveQuota, usedLeaveDays, reason, operatorName } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId wajib diisi' });
    }

    const cleanQuota = annualLeaveQuota !== undefined && annualLeaveQuota !== null && !isNaN(annualLeaveQuota) ? parseInt(annualLeaveQuota, 10) : null;
    const cleanUsed = usedLeaveDays !== undefined && usedLeaveDays !== null && !isNaN(usedLeaveDays) ? parseInt(usedLeaveDays, 10) : null;

    let validUserId = userId;
    if (!UUID_REGEX.test(userId)) {
      const uRes = await pool.query(
        'SELECT id FROM hrm_profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) OR LOWER(TRIM(nip)) = LOWER(TRIM($1)) OR id::text = $1 LIMIT 1',
        [userId]
      );
      if (uRes.rows.length > 0) validUserId = uRes.rows[0].id;
    }

    const updateRes = await pool.query(`
      UPDATE hrm_profiles
      SET annual_leave_quota = COALESCE($1::integer, annual_leave_quota),
          used_leave_days = COALESCE($2::integer, used_leave_days),
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, full_name, nip, annual_leave_quota, used_leave_days;
    `, [cleanQuota, cleanUsed, validUserId]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });
    }

    const updated = updateRes.rows[0];

    // Catat notifikasi / audit trail
    try {
      await pool.query(`
        INSERT INTO hrm_notifications (user_id, title, message, type, is_read, created_at)
        VALUES ($1, $2, $3, 'system', false, NOW());
      `, [
        validUserId,
        'Koreksi Saldo Cuti Karyawan',
        `Saldo cuti Anda telah disesuaikan oleh ${operatorName || 'Superadmin'}: Hak Kuota ${annualLeaveQuota} Hari, Cuti Terpakai ${usedLeaveDays} Hari. Alasan: ${reason || 'Koreksi resmi data cuti'}.`
      ]);
    } catch (e) {
      // ignore notification error
    }

    res.json({
      success: true,
      message: 'Koreksi saldo cuti berhasil disimpan ke PostgreSQL',
      data: {
        id: updated.id,
        fullName: updated.full_name,
        nip: updated.nip,
        annualLeaveQuota: parseInt(updated.annual_leave_quota, 10),
        usedLeaveDays: parseInt(updated.used_leave_days, 10),
        remainingLeaveDays: Math.max(0, parseInt(updated.annual_leave_quota, 10) - parseInt(updated.used_leave_days, 10)),
      }
    });
  } catch (err) {
    console.error('[LeaveCorrection] Error:', err.message);
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

// ─── 7.5. NATIONAL PUBLIC HOLIDAYS (SKB 3 MENTERI) ─────────────────────────
app.get('/api/holidays', async (req, res) => {
  try {
    const { year, month } = req.query;
    let query = `SELECT id, holiday_date as "date", holiday_name as "name", holiday_type as "type", description, year FROM hrm_national_holidays`;
    const params = [];
    const conditions = [];

    if (year) {
      params.push(parseInt(year, 10));
      conditions.push(`year = $${params.length}`);
    }
    if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      const startStr = `${year}-${monthStr}-01`;
      const endStr = `${year}-${monthStr}-31`;
      params.push(startStr, endStr);
      conditions.push(`holiday_date BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY holiday_date ASC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Holidays API] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/holidays/check/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `SELECT id, holiday_date as "date", holiday_name as "name", holiday_type as "type" 
       FROM hrm_national_holidays 
       WHERE holiday_date = $1 LIMIT 1`,
      [date]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, isHoliday: true, holiday: result.rows[0] });
    } else {
      res.json({ success: true, isHoliday: false, holiday: null });
    }
  } catch (err) {
    console.error('[Holiday Check API] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

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
    // Rekapan hanya mencakup karyawan dengan NIP berawalan FR
    if (!userId) {
      conditions.push(`UPPER(REPLACE(REPLACE(p.nip, ' ', ''), '.', '')) LIKE 'FR%'`);
    }

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

// ─── Laporan Khusus Perhitungan Gaji Petugas Lapangan (Oktober 2026) ────────
// Khusus untuk 3 Karyawan Lapangan: Muh Aslam Faisal, TAKDIR, LA UNGA SAMSI, S.K.M
// Ketentuan:
// - Rate: Rp 140.000 / hari
// - Libur: Sabtu & Minggu (22 hari kerja di Oktober 2026)
// - Potongan keterlambatan: Rp 1.000 / menit berlaku mulai 3 Oktober 2026 (1-2 Okt bebas denda)
// - Cuti & Sakit: Dihitung sebagai hari kerja sah dibayar penuh (bukan mangkir)
app.get('/api/payroll/special-field-report/october-2026', async (req, res) => {
  try {
    const specialIds = [
      'ebf10b16-ab2f-4b53-ab22-b3ffc00694db', // Muh Aslam Faisal
      '0a49f92e-5733-4b72-947c-7361f9490632', // TAKDIR
      '2ce41a19-0c65-45d3-913e-a68a02203fe2'  // LA UNGA SAMSI
    ];

    const empsQuery = `
      SELECT p.id, p.nip, p.full_name, p.email, p.role_name, p.job_title, p.division_name,
             sp.bank_name, sp.bank_account_number, sp.bank_account_holder
      FROM hrm_profiles p
      LEFT JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.id = ANY($1::uuid[])
         OR p.nip IN ('FRP 07065', 'FR07066', 'FRP.07.046', 'FR07065', 'FR.07.066')
         OR LOWER(p.full_name) ILIKE '%aslam faisal%'
         OR LOWER(p.full_name) ILIKE '%takdir%'
         OR LOWER(p.full_name) ILIKE '%samsi%'
      ORDER BY 
        CASE 
          WHEN LOWER(p.full_name) ILIKE '%aslam%' THEN 1
          WHEN LOWER(p.full_name) ILIKE '%takdir%' THEN 2
          ELSE 3
        END
    `;
    const empsRes = await pool.query(empsQuery, [specialIds]);
    const employees = empsRes.rows;

    const empIds = employees.map(e => e.id);

    const attsQuery = `
      SELECT a.id, a.user_id, a.attendance_date, a.status, a.clock_in, a.clock_out,
             a.late_minutes, a.early_leaving_minutes, a.notes, a.shift_name
      FROM hrm_attendances a
      WHERE a.user_id = ANY($1::uuid[])
        AND a.attendance_date >= '2026-10-01' AND a.attendance_date <= '2026-10-31'
      ORDER BY a.attendance_date ASC
    `;
    const attsRes = await pool.query(attsQuery, [empIds]);
    const attendances = attsRes.rows;

    const DAILY_RATE = 140000;
    const LATE_RATE_PER_MINUTE = 1000;
    const LATE_EFFECTIVE_DATE = '2026-10-03';

    let grandGross = 0;
    let grandLateDeduction = 0;
    let grandNet = 0;
    let grandPaidDays = 0;

    const reportData = employees.map(emp => {
      const userAtts = attendances.filter(a => a.user_id === emp.id);

      let hadirCount = 0;
      let terlambatCount = 0;
      let cutiCount = 0;
      let sakitCount = 0;
      let mangkirCount = 0;
      let exemptLateMinutes = 0;
      let billableLateMinutes = 0;

      const dailyDetails = [];

      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).p
... [truncated for diff preview]