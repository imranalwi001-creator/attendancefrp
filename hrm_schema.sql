-- ==============================================================================
-- HRM ATTENDANCE SYSTEM - INDEPENDENT DATABASE SCHEMA
-- Skema Database Relasional Lengkap untuk PostgreSQL (15 Tabel Terisolasi)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL ROLES (Mendukung Role Dinamis & Hak Akses JSONB)
CREATE TABLE IF NOT EXISTS hrm_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL DIVISI / DEPARTEMEN (Dengan Geofence GPS per Divisi)
CREATE TABLE IF NOT EXISTS hrm_divisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location_name VARCHAR(150),
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius_meters INT DEFAULT 150,
    bssid_whitelist TEXT,
    wifi_ssid VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABEL SHIFT KERJA
CREATE TABLE IF NOT EXISTS hrm_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_tolerance_minutes INT DEFAULT 15,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABEL LOKASI KANTOR PUSAT / GEOFENCE FALLBACK
CREATE TABLE IF NOT EXISTS hrm_office_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    bssid_whitelist TEXT,
    wifi_ssid VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABEL USER PROFILES (Karyawan & Staff)
CREATE TABLE IF NOT EXISTS hrm_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nip VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role_id UUID REFERENCES hrm_roles(id) ON DELETE SET NULL,
    division_id UUID REFERENCES hrm_divisions(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES hrm_shifts(id) ON DELETE SET NULL,
    avatar_url TEXT,
    gender VARCHAR(20),
    birth_place VARCHAR(100),
    birth_date DATE,
    address TEXT,
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    employment_status VARCHAR(30) DEFAULT 'permanent', -- permanent, contract, probation, intern
    join_date DATE,
    contract_end_date DATE,
    annual_leave_quota INT DEFAULT 12,
    used_leave_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABEL PRESENSI (ATTENDANCE LOGS DENGAN WATERMARK & GPS)
CREATE TABLE IF NOT EXISTS hrm_attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    lat_in DECIMAL(10, 8),
    long_in DECIMAL(11, 8),
    photo_in TEXT,
    lat_out DECIMAL(10, 8),
    long_out DECIMAL(11, 8),
    photo_out TEXT,
    status VARCHAR(30) DEFAULT 'hadir', -- hadir, terlambat, izin, sakit, cuti, alfa
    late_minutes INT DEFAULT 0,
    early_leaving_minutes INT DEFAULT 0,
    work_duration_minutes INT DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_date UNIQUE (user_id, attendance_date)
);

-- 8. TABEL PENGAJUAN IZIN / CUTI / SAKIT (LEAVE REQUESTS)
CREATE TABLE IF NOT EXISTS hrm_leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    leave_type VARCHAR(30) NOT NULL, -- cuti_tahunan, sakit, izin, tugas_luar
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
    approval_notes TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TABEL PROFIL PERUSAHAAN (LEGALITAS & INFORMASI RESMI)
CREATE TABLE IF NOT EXISTS hrm_company_profile (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'company-main',
    company_name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    legal_type VARCHAR(20) DEFAULT 'PT',
    business_sector VARCHAR(100),
    founded_date DATE,
    npwp VARCHAR(50),
    nib VARCHAR(50),
    siup_number VARCHAR(50),
    deed_number VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(150),
    director_name VARCHAR(150),
    director_title VARCHAR(100) DEFAULT 'Direktur Utama',
    hr_manager_name VARCHAR(150),
    logo_url TEXT,
    director_signature_url TEXT,
    company_stamp_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. TABEL ARSIP DOKUMEN PERUSAHAAN
CREATE TABLE IF NOT EXISTS hrm_company_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type VARCHAR(50) NOT NULL, -- legalitas, sertifikasi, sop, perizinan, aset, kontrak_induk, lainnya
    title VARCHAR(200) NOT NULL,
    document_number VARCHAR(100),
    issuer VARCHAR(150),
    issued_date DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. TABEL ARSIP BERKAS KARYAWAN
CREATE TABLE IF NOT EXISTS hrm_employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- ktp, kk, ijazah, kontrak_kerja, npwp, cv, sertifikat, skck, lainnya
    title VARCHAR(200) NOT NULL,
    document_number VARCHAR(100),
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    verified_status VARCHAR(30) DEFAULT 'unverified', -- verified, unverified, rejected
    verified_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. TABEL PENGATURAN & REKAP LEMBUR (OVERTIME)
CREATE TABLE IF NOT EXISTS hrm_overtime_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'overtime-settings-main',
    rate_per_hour INT DEFAULT 30000,
    holiday_multiplier DECIMAL(3, 2) DEFAULT 2.0,
    max_hours_per_day INT DEFAULT 4,
    auto_approve_threshold_hours INT DEFAULT 0,
    require_reason BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrm_overtime_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours DECIMAL(4, 2) NOT NULL,
    task_description TEXT NOT NULL,
    rate_applied INT NOT NULL DEFAULT 30000,
    compensation_amount INT NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected
    payment_status VARCHAR(30) DEFAULT 'unpaid', -- unpaid, included_in_payroll, paid
    approved_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. TABEL PENGATURAN GAJI & PROFIL GAJI KARYAWAN
CREATE TABLE IF NOT EXISTS hrm_payroll_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'payroll-settings-main',
    cutoff_date INT DEFAULT 25,
    payment_date INT DEFAULT 1,
    bpjs_kesehatan_employee DECIMAL(4, 2) DEFAULT 1.0,
    bpjs_kesehatan_employer DECIMAL(4, 2) DEFAULT 4.0,
    bpjs_ketenagakerjaan_employee DECIMAL(4, 2) DEFAULT 2.0,
    bpjs_ketenagakerjaan_employer DECIMAL(4, 2) DEFAULT 5.7,
    late_deduction_per_minute INT DEFAULT 1000,
    absence_deduction_per_day INT DEFAULT 100000,
    default_tax_rate DECIMAL(4, 2) DEFAULT 5.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrm_payroll_salary_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    base_salary BIGINT NOT NULL DEFAULT 0,
    position_allowance BIGINT NOT NULL DEFAULT 0,
    meal_allowance BIGINT NOT NULL DEFAULT 0,
    transport_allowance BIGINT NOT NULL DEFAULT 0,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(100),
    bank_account_holder VARCHAR(150),
    other_allowances JSONB DEFAULT '[]'::jsonb,
    effective_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. TABEL PERIODE PENGGAJIAN & SLIP GAJI RESMI
CREATE TABLE IF NOT EXISTS hrm_payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_label VARCHAR(100) NOT NULL, -- e.g. "September 2026"
    month INT NOT NULL,
    year INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'draft', -- draft, processing, approved, paid
    total_gross BIGINT DEFAULT 0,
    total_deductions BIGINT DEFAULT 0,
    total_net BIGINT DEFAULT 0,
    total_employees INT DEFAULT 0,
    created_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrm_payroll_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id UUID NOT NULL REFERENCES hrm_payroll_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    period_label VARCHAR(100) NOT NULL,
    base_salary BIGINT NOT NULL,
    position_allowance BIGINT DEFAULT 0,
    meal_allowance BIGINT DEFAULT 0,
    transport_allowance BIGINT DEFAULT 0,
    other_allowances JSONB DEFAULT '[]'::jsonb,
    total_overtime_pay BIGINT DEFAULT 0,
    gross_income BIGINT NOT NULL,
    late_deduction BIGINT DEFAULT 0,
    absence_deduction BIGINT DEFAULT 0,
    bpjs_kesehatan_deduction BIGINT DEFAULT 0,
    bpjs_ketenagakerjaan_deduction BIGINT DEFAULT 0,
    tax_deduction BIGINT DEFAULT 0,
    total_deductions BIGINT NOT NULL,
    net_salary BIGINT NOT NULL,
    status VARCHAR(30) DEFAULT 'draft', -- draft, pending_payment, paid
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_period_user UNIQUE (period_id, user_id)
);

-- 15. TABEL NOTIFIKASI SISTEM
CREATE TABLE IF NOT EXISTS hrm_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, success, warning, overtime, leave, payroll
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- INITIAL SEED DATA (DATA AWAL SISTEM)
-- ==============================================================================

-- Default Roles
INSERT INTO hrm_roles (name, label, description, is_system, permissions) VALUES
('superadmin', 'Super Admin', 'Akses kontrol penuh ke seluruh sistem, peran, divisi, dan pengguna', true, '["all"]'::jsonb),
('admin', 'Admin HRD', 'Manajemen presensi harian, pendaftaran karyawan, dan rekapitulasi', true, '["manage_attendance", "manage_employees", "approve_leave", "view_reports"]'::jsonb),
('hrd', 'HRD Staff', 'Operasional HR, monitoring absensi, dan approval izin', false, '["manage_attendance", "approve_leave", "view_reports"]'::jsonb),
('pimpinan', 'Pimpinan / Direksi', 'Monitoring analitik kehadiran tim dan approval tingkat eksekutif', false, '["view_analytics", "approve_leave", "view_reports"]'::jsonb),
('keuangan', 'Keuangan & Payroll', 'Rekapitulasi jam kerja, lembur, dan potongan keterlambatan untuk penggajian', false, '["view_payroll_reports", "export_reports"]'::jsonb),
('karyawan', 'Karyawan', 'Presensi mandiri (GPS & Foto), pengajuan cuti/izin, dan riwayat presensi pribadi', true, '["self_attendance", "apply_leave", "view_own_history"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Default Divisi
INSERT INTO hrm_divisions (code, name, description, location_name, address, latitude, longitude, radius_meters) VALUES
('IT', 'Teknologi Informasi', 'Divisi rekayasa perangkat lunak, infrastruktur IT & sistem', 'Gedung IT Center', 'Lt. 3 Gedung Graha', -6.2088, 106.8456, 150),
('FIN', 'Keuangan & Akuntansi', 'Divisi pengelolaan keuangan, akuntansi, dan penggajian', 'Ruang Finansial', 'Lt. 2 Gedung Graha', -6.2088, 106.8456, 150),
('HRD', 'Sumber Daya Manusia', 'Divisi pengembangan SDM, rekrutmen, dan tata kelola karyawan', 'Ruang HR', 'Lt. 2 Gedung Graha', -6.2088, 106.8456, 150),
('OPS', 'Operasional & Umum', 'Divisi kelancaran operasional harian dan fasilitas', 'Ruang Operasional', 'Lt. 1 Gedung Graha', -6.2088, 106.8456, 150),
('MKT', 'Pemasaran & Bisnis', 'Divisi penjualan, kemitraan, dan promosi perusahaan', 'Ruang Bisnis', 'Lt. 4 Gedung Graha', -6.2088, 106.8456, 150)
ON CONFLICT (code) DO NOTHING;

-- Default Shift
INSERT INTO hrm_shifts (name, start_time, end_time, late_tolerance_minutes, is_default) VALUES
('Reguler (Senin - Jumat)', '08:00:00', '17:00:00', 15, true),
('Shift Pagi', '07:00:00', '15:00:00', 15, false),
('Shift Siang', '14:00:00', '22:00:00', 15, false);

-- Default Lokasi Kantor
INSERT INTO hrm_office_locations (name, address, latitude, longitude, radius_meters, is_active) VALUES
('Kantor Pusat', 'Gedung Graha HRM, Lantai 5', -6.2088, 106.8456, 100, true);

-- Default Profil Perusahaan
INSERT INTO hrm_company_profile (id, company_name, short_name, legal_type, business_sector, founded_date, npwp, nib, siup_number, deed_number, address, city, province, postal_code, phone, email, website, director_name, hr_manager_name) VALUES
('company-main', 'PT. FAWWAZ RESKI PERWIRA', 'FRP', 'PT', 'Teknologi Informasi & Jasa Konsultasi', '2015-03-15', '12.345.678.9-000.001', '1234567890123', 'SIUP-2015-001234', 'No. 001/Akta/2015', 'Gedung Graha Perwira, Lantai 5, Kav. 12', 'Jakarta Selatan', 'DKI Jakarta', '12930', '+62 21 555-0199', 'info@fawwazreski.co.id', 'https://fawwazreski.co.id', 'H. Fawwaz Reski, S.T., M.Kom', 'Siti Rahmawati, S.Psi., M.M.')
ON CONFLICT (id) DO NOTHING;

-- Default Pengaturan Lembur
INSERT INTO hrm_overtime_settings (id, rate_per_hour, holiday_multiplier, max_hours_per_day, require_reason) VALUES
('overtime-settings-main', 30000, 2.0, 4, true)
ON CONFLICT (id) DO NOTHING;

-- Default Pengaturan Payroll
INSERT INTO hrm_payroll_settings (id, cutoff_date, payment_date, bpjs_kesehatan_employee, bpjs_kesehatan_employer, bpjs_ketenagakerjaan_employee, bpjs_ketenagakerjaan_employer, late_deduction_per_minute, absence_deduction_per_day, default_tax_rate) VALUES
('payroll-settings-main', 25, 1, 1.0, 4.0, 2.0, 5.7, 1000, 100000, 5.0)
ON CONFLICT (id) DO NOTHING;
