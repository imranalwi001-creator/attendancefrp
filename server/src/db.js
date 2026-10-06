import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'hrm-database',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'hrm_user',
  password: process.env.DB_PASSWORD || 'hrm_secure_password_2026',
  database: process.env.DB_NAME || 'hrm_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    console.log('[Database] Connected successfully to PostgreSQL.');

    // Ensure password and helper columns exist in hrm_profiles
    await client.query(`
      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT 'password123';
      
      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS role_name VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS division_name VARCHAR(100);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS city VARCHAR(100);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS province VARCHAR(100);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS nik VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS npwp VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS religion VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS education VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS emergency_relation VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS bpjs_kesehatan VARCHAR(50);

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS bpjs_ketenagakerjaan VARCHAR(50);

      -- Biometric Face Recognition Master Template Columns
      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS is_face_enrolled BOOLEAN DEFAULT false;

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS face_descriptor TEXT;

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS face_enrolled_photo TEXT;

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS face_enrolled_at TIMESTAMP WITH TIME ZONE;

      -- Attendance Biometric 1:1 Verification Score Columns
      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS biometric_score NUMERIC(5,2);

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS biometric_match BOOLEAN;

      -- Geofence & Anti-Spoofing Verification Columns
      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS geofence_distance_meters NUMERIC(8,1);

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS geofence_valid BOOLEAN;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS is_mock_location BOOLEAN DEFAULT false;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS security_flags JSONB DEFAULT '[]'::jsonb;

      -- Division Polygon Coordinates & Allowed Post Points for Arbitrary Geofencing
      ALTER TABLE hrm_divisions 
      ADD COLUMN IF NOT EXISTS polygon_coords JSONB;

      ALTER TABLE hrm_divisions 
      ADD COLUMN IF NOT EXISTS allowed_posts JSONB DEFAULT '[]'::jsonb;

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS allowed_posts JSONB DEFAULT '[]'::jsonb;

      ALTER TABLE hrm_profiles 
      ADD COLUMN IF NOT EXISTS allow_ogs_clock_out BOOLEAN DEFAULT true;

      -- Attendance Perimeter Breach Columns
      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS is_perimeter_breached BOOLEAN DEFAULT false;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS perimeter_breach_count INTEGER DEFAULT 0;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS time_outside_minutes INTEGER DEFAULT 0;

      -- Early Leave & Remote Unlock Columns
      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS is_early_leave BOOLEAN DEFAULT false;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS early_leave_reason TEXT;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS early_leave_category VARCHAR(50);

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS is_remote_unlocked BOOLEAN DEFAULT false;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS remote_unlocked_by VARCHAR(100);

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS remote_unlocked_at TIMESTAMP WITH TIME ZONE;

      -- Break Time (1 Hour Allowance) Columns
      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS is_on_break BOOLEAN DEFAULT false;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS break_start_time TIMESTAMP WITH TIME ZONE;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS break_end_time TIMESTAMP WITH TIME ZONE;

      ALTER TABLE hrm_attendances 
      ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0;

      -- Perimeter Disciplinary Violations Table (Tracking leaving office without permit)
      CREATE TABLE IF NOT EXISTS hrm_perimeter_violations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        attendance_id UUID REFERENCES hrm_attendances(id) ON DELETE SET NULL,
        division_id UUID REFERENCES hrm_divisions(id) ON DELETE SET NULL,
        violation_date DATE NOT NULL,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        distance_meters NUMERIC(8,1),
        exit_latitude NUMERIC(10,8),
        exit_longitude NUMERIC(11,8),
        duration_outside_minutes INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'active', -- active, resolved, penalized
        notes TEXT,
        resolution_notes TEXT,
        resolved_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_violations_user_date ON hrm_perimeter_violations(user_id, violation_date);
      CREATE INDEX IF NOT EXISTS idx_violations_status ON hrm_perimeter_violations(status);

      -- 14. Tabel Shift Swaps (Tukar Shift Antar Karyawan)
      CREATE TABLE IF NOT EXISTS hrm_shift_swaps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        requester_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        substitute_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        swap_date DATE NOT NULL,
        original_shift VARCHAR(100) DEFAULT 'Reguler',
        target_shift VARCHAR(100) DEFAULT 'Shift Pengganti',
        reason TEXT,
        peer_status VARCHAR(30) DEFAULT 'pending', -- pending, accepted, rejected
        supervisor_status VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected
        approved_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
        approval_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_shift_swaps_requester ON hrm_shift_swaps(requester_id);
      CREATE INDEX IF NOT EXISTS idx_shift_swaps_substitute ON hrm_shift_swaps(substitute_id);

      -- Ensure hrm_notifications has recipient_role and metadata
      ALTER TABLE hrm_notifications
      ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(50);

      ALTER TABLE hrm_notifications
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

      ALTER TABLE hrm_notifications
      ALTER COLUMN user_id DROP NOT NULL;

      -- ─── MANDATORY SHIFT RELIEF / BACKFILL (ZERO UNMANNED POST) ───
      CREATE TABLE IF NOT EXISTS hrm_shift_substitutions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        original_user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        relief_user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        shift_id UUID NOT NULL REFERENCES hrm_shifts(id),
        duty_date DATE NOT NULL,
        reason_type VARCHAR(50) NOT NULL,
        reference_id UUID,
        compensation_type VARCHAR(50) DEFAULT 'overtime',
        overtime_hours NUMERIC(4,2) DEFAULT 8.0,
        overtime_rate NUMERIC(12,2) NOT NULL DEFAULT 23381.79,
        overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 187054.32,
        status VARCHAR(30) DEFAULT 'approved',
        notes TEXT,
        approved_by UUID REFERENCES hrm_profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_shift_subs_date ON hrm_shift_substitutions (duty_date, shift_id);
      CREATE INDEX IF NOT EXISTS idx_shift_subs_relief ON hrm_shift_substitutions (relief_user_id, duty_date);
      CREATE INDEX IF NOT EXISTS idx_shift_subs_original ON hrm_shift_substitutions (original_user_id, duty_date);

      -- ─── Kepala Regu Assignment (each employee assigned to a kepala_regu) ───
      ALTER TABLE hrm_profiles
      ADD COLUMN IF NOT EXISTS kepala_regu_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_profiles_kepala_regu ON hrm_profiles(kepala_regu_id);

      -- ─── Fix hrm_shift_swaps: substitute_id nullable (smart system picks) ───
      ALTER TABLE hrm_shift_swaps
      ALTER COLUMN substitute_id DROP NOT NULL;

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS danru_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS danru_substitute_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS korlap_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS danru_status VARCHAR(30) DEFAULT 'pending';

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS korlap_status VARCHAR(30) DEFAULT 'pending';

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS danru_notes TEXT;

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS korlap_notes TEXT;

      ALTER TABLE hrm_shift_swaps
      ADD COLUMN IF NOT EXISTS system_recommendations JSONB DEFAULT '[]'::jsonb;

      -- ─── Notifications: add division_id for division-filtered delivery ───
      ALTER TABLE hrm_notifications
      ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES hrm_divisions(id) ON DELETE SET NULL;

      ALTER TABLE hrm_notifications
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

      -- ─── EXTENDED OVERTIME WORKFLOW (PARAF KEPALA REGU, BUKTI SELESAI LEMBUR) ───
      CREATE TABLE IF NOT EXISTS hrm_overtime_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time VARCHAR(10) DEFAULT '17:00',
        end_time VARCHAR(10) DEFAULT '19:00',
        duration_minutes INTEGER DEFAULT 120,
        duration_hours NUMERIC(4,2) DEFAULT 2.0,
        requested_hours NUMERIC(4,2) DEFAULT 2.0,
        approved_hours NUMERIC(4,2) DEFAULT 2.0,
        task_description TEXT,
        status VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected, in_progress, completed
        payment_status VARCHAR(30) DEFAULT 'unpaid',
        approved_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
        approved_by_name VARCHAR(150),
        approval_notes TEXT,
        supervisor_name VARCHAR(150),
        supervisor_signature TEXT,
        overtime_phase VARCHAR(30) DEFAULT 'requested', -- requested, in_progress, completed
        started_at TIMESTAMP WITH TIME ZONE,
        scheduled_end_time VARCHAR(10),
        actual_end_time VARCHAR(10),
        completion_notes TEXT,
        completion_photos JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(150);

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS supervisor_signature TEXT;

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS overtime_phase VARCHAR(30) DEFAULT 'requested';

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS scheduled_end_time VARCHAR(10);

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS actual_end_time VARCHAR(10);

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS completion_notes TEXT;

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS completion_photos JSONB DEFAULT '[]'::jsonb;

      -- ─── SALARY PROFILES COMPLIANCE ───
      CREATE TABLE IF NOT EXISTS hrm_payroll_salary_profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID UNIQUE NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        base_salary BIGINT NOT NULL DEFAULT 4045050,
        position_allowance BIGINT NOT NULL DEFAULT 0,
        meal_allowance BIGINT NOT NULL DEFAULT 0,
        transport_allowance BIGINT NOT NULL DEFAULT 0,
        hourly_overtime_rate NUMERIC(12,2) DEFAULT 23381.79,
        severance_scheme VARCHAR(50) DEFAULT 'tabungan',
        bank_name VARCHAR(100),
        bank_account_number VARCHAR(100),
        bank_account_holder VARCHAR(150),
        other_allowances JSONB DEFAULT '[]'::jsonb,
        effective_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE hrm_payroll_salary_profiles
      ADD COLUMN IF NOT EXISTS hourly_overtime_rate NUMERIC(12,2) DEFAULT 23381.79;

      ALTER TABLE hrm_payroll_salary_profiles
      ADD COLUMN IF NOT EXISTS severance_scheme VARCHAR(50) DEFAULT 'tabungan';

      ALTER TABLE hrm_profiles
      ADD COLUMN IF NOT EXISTS employee_sequence_no INT DEFAULT 0;

      ALTER TABLE hrm_payroll_salary_profiles
      ADD COLUMN IF NOT EXISTS employee_sequence_no INT DEFAULT 0;

      -- Ensure default active profile for imranalwi8@gmail.com exists
      INSERT INTO hrm_profiles (
        nip, full_name, email, password, role_id, is_active, created_at, updated_at
      )
      SELECT 
        'FR001', 'Imran Alwi', 'imranalwi8@gmail.com', 'password123', 
        (SELECT id FROM hrm_roles WHERE name = 'superadmin' LIMIT 1), true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM hrm_profiles WHERE LOWER(email) = 'imranalwi8@gmail.com');

      UPDATE hrm_profiles 
      SET password = 'password123', is_active = true 
      WHERE LOWER(email) = 'imranalwi8@gmail.com';

      -- ─── EMPLOYEE SCHEDULES / SHIFT ROSTER PERSISTENCE ───
      CREATE TABLE IF NOT EXISTS hrm_employee_schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        schedule_date DATE NOT NULL,
        shift_id UUID REFERENCES hrm_shifts(id) ON DELETE SET NULL,
        shift_code VARCHAR(20) NOT NULL, -- 'P', 'S', 'M', 'OFF'
        shift_name VARCHAR(100),
        start_time VARCHAR(10) DEFAULT '07:30',
        end_time VARCHAR(10) DEFAULT '15:30',
        duration_hours NUMERIC(4,1) DEFAULT 8.0,
        is_night_shift BOOLEAN DEFAULT false,
        is_off BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_user_schedule_date UNIQUE (user_id, schedule_date)
      );

      CREATE INDEX IF NOT EXISTS idx_emp_schedules_user_date ON hrm_employee_schedules(user_id, schedule_date);
      CREATE INDEX IF NOT EXISTS idx_emp_schedules_date ON hrm_employee_schedules(schedule_date);

      -- ─── MASTER SHIFTS SYNCHRONIZATION (SESUAI SURAT KEPUTUSAN JAM KERJA) ───
      -- Day Shift: Senin s/d Jumat (07:30 - 16:30 WITA)
      UPDATE hrm_shifts 
      SET name = 'Day Shift (07:30 - 16:30 WITA)', start_time = '07:30:00', end_time = '16:30:00', is_default = true 
      WHERE name ILIKE '%Reguler%' OR name ILIKE '%Day Shift%';

      -- Shift I: 07:30 - 15:30 WITA
      UPDATE hrm_shifts 
      SET name = 'Shift I (07:30 - 15:30 WITA)', start_time = '07:30:00', end_time = '15:30:00', is_default = false 
      WHERE name ILIKE '%Shift 1%' OR name ILIKE '%Shift I %' OR name ILIKE '%Shift I(%' OR name ILIKE '%Shift Pagi%';

      -- Shift II: 15:30 - 22:30 WITA
      UPDATE hrm_shifts 
      SET name = 'Shift II (15:30 - 22:30 WITA)', start_time = '15:30:00', end_time = '22:30:00', is_default = false 
      WHERE name ILIKE '%Shift 2%' OR name ILIKE '%Shift II%' OR name ILIKE '%Shift Siang%';

      -- Shift III: 22:30 - 07:30 WITA
      UPDATE hrm_shifts 
      SET name = 'Shift III (22:30 - 07:30 WITA)', start_time = '22:30:00', end_time = '07:30:00', is_default = false 
      WHERE name ILIKE '%Shift 3%' OR name ILIKE '%Shift III%' OR name ILIKE '%Shift Malam%';

      -- Pastikan keempat shift master terdaftar di database
      INSERT INTO hrm_shifts (name, start_time, end_time, late_tolerance_minutes, is_default)
      SELECT 'Day Shift (07:30 - 16:30 WITA)', '07:30:00', '16:30:00', 15, true
      WHERE NOT EXISTS (SELECT 1 FROM hrm_shifts WHERE name ILIKE '%Day Shift%');

      INSERT INTO hrm_shifts (name, start_time, end_time, late_tolerance_minutes, is_default)
      SELECT 'Shift I (07:30 - 15:30 WITA)', '07:30:00', '15:30:00', 15, false
      WHERE NOT EXISTS (SELECT 1 FROM hrm_shifts WHERE name ILIKE '%Shift I %' OR name ILIKE '%Shift I(%');

      INSERT INTO hrm_shifts (name, start_time, end_time, late_tolerance_minutes, is_default)
      SELECT 'Shift II (15:30 - 22:30 WITA)', '15:30:00', '22:30:00', 15, false
      WHERE NOT EXISTS (SELECT 1 FROM hrm_shifts WHERE name ILIKE '%Shift II%');

      INSERT INTO hrm_shifts (name, start_time, end_time, late_tolerance_minutes, is_default)
      SELECT 'Shift III (22:30 - 07:30 WITA)', '22:30:00', '07:30:00', 15, false
      WHERE NOT EXISTS (SELECT 1 FROM hrm_shifts WHERE name ILIKE '%Shift III%' OR name ILIKE '%Shift 3%');

      -- ─── 15. BANK POS TUGAS LAPANGAN & GEOFENCE MULTI-TITIK ───
      CREATE TABLE IF NOT EXISTS hrm_field_assigned_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
        post_code VARCHAR(50) NOT NULL,
        post_name VARCHAR(255) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        radius_meters INTEGER NOT NULL DEFAULT 150,
        description TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_hrm_field_assigned_posts_user ON hrm_field_assigned_posts(user_id, is_active);

      ALTER TABLE hrm_profiles
      ADD COLUMN IF NOT EXISTS current_active_post_id UUID,
      ADD COLUMN IF NOT EXISTS current_active_post_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS current_active_post_entered_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS custom_start_time VARCHAR(10) DEFAULT '07:30',
      ADD COLUMN IF NOT EXISTS custom_end_time VARCHAR(10) DEFAULT '16:30',
      ADD COLUMN IF NOT EXISTS late_tolerance_minutes INTEGER DEFAULT 15;

      CREATE TABLE IF NOT EXISTS hrm_system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO hrm_system_settings (key, value)
      VALUES 
        ('wa_gateway_endpoint', 'https://api.mpwa.id/v1/send-message'),
        ('wa_gateway_api_key', ''),
        ('wa_gateway_sender', ''),
        ('wa_superadmin_phone', '081355904897'),
        ('wa_pimpinan_phone', '082192755755'),
        ('break_policy_enabled', 'true'),
        ('break_duration_minutes', '60'),
        ('break_allow_outside', 'true'),
        ('field_officer_start_time', '07:30'),
        ('field_officer_end_time', '16:30'),
        ('field_officer_late_tolerance', '15')
      ON CONFLICT (key) DO NOTHING;

      -- ─── 16. DIVISI K3 & ROLE K3 (KESELAMATAN & KESEHATAN KERJA) ───
      INSERT INTO hrm_divisions (code, name, description)
      SELECT 'K3', 'Keselamatan & Kesehatan Kerja (K3 & HSE)', 'Keselamatan, Kesehatan Kerja dan Lingkungan Lapangan'
      WHERE NOT EXISTS (SELECT 1 FROM hrm_divisions WHERE code = 'K3' OR name ILIKE '%K3%');

      INSERT INTO hrm_roles (name, label, description, is_system, permissions)
      SELECT 'k3', 'Petugas / Divisi K3', 'Pengawasan Keselamatan Kerja, K3, dan Persetujuan Izin Operasional', false, '["read", "write", "approval"]'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM hrm_roles WHERE name = 'k3');

      -- Break late minutes & early leave approved
      ALTER TABLE hrm_attendances
      ADD COLUMN IF NOT EXISTS break_late_minutes INTEGER DEFAULT 0;

      ALTER TABLE hrm_attendances
      ADD COLUMN IF NOT EXISTS early_leave_approved BOOLEAN DEFAULT false;

      -- Leave requests proof photo, substitute, and Pimpinan forwarding
      ALTER TABLE hrm_leave_requests
      ADD COLUMN IF NOT EXISTS attachment_url TEXT;

      ALTER TABLE hrm_leave_requests
      ADD COLUMN IF NOT EXISTS forwarded_to_pimpinan BOOLEAN DEFAULT false;

      ALTER TABLE hrm_leave_requests
      ADD COLUMN IF NOT EXISTS substitute_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL;

      ALTER TABLE hrm_leave_requests
      ADD COLUMN IF NOT EXISTS substitute_name VARCHAR(150);

      ALTER TABLE hrm_leave_requests
      ADD COLUMN IF NOT EXISTS substitute_nip VARCHAR(50);

      -- Overtime proof photo and Pimpinan forwarding
      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS task_photo_url TEXT;

      ALTER TABLE hrm_overtime_records
      ADD COLUMN IF NOT EXISTS forwarded_to_pimpinan BOOLEAN DEFAULT false;
    `);

    console.log('[Database] Schema verification, Biometric, Geofence, Field Sentinel Multi-Posts & Notifications extensions completed.');
  } catch (err) {
    console.error('[Database] Initialization error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
