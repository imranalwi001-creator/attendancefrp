-- ─── MIGRATION 07: RELIEF DUTY GEOFENCE INHERITANCE & EMERGENCY POST-SHIFT OVERTIME ───
-- Sesuai standar operasional PT Fawwaz Reski Perwira

-- 1. Penambahan Kolom di Bank Pos Lapangan untuk Penugasan Pengganti Sementara
ALTER TABLE hrm_field_assigned_posts
ADD COLUMN IF NOT EXISTS is_relief BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS relief_until DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS relief_original_user_id UUID REFERENCES hrm_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS relief_leave_request_id UUID REFERENCES hrm_leave_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_assigned_posts_relief ON hrm_field_assigned_posts(user_id, is_relief, relief_until);

-- 2. Penambahan Kolom di Tabel Presensi untuk Lembur Darurat Pasca-Shift
ALTER TABLE hrm_attendances
ADD COLUMN IF NOT EXISTS is_emergency_overtime BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_overtime_hours NUMERIC(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emergency_overtime_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS emergency_overtime_status VARCHAR(30) DEFAULT NULL;

-- 3. Penambahan Kolom di Tabel Lembur untuk Sumber Darurat & Pengganti Shift
ALTER TABLE hrm_overtime_records
ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_reported_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'planned',
ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES hrm_leave_requests(id) ON DELETE SET NULL;

-- 4. Penambahan Kolom di Pengajuan Cuti/Izin untuk Penugasan Pengganti
ALTER TABLE hrm_leave_requests
ADD COLUMN IF NOT EXISTS relief_duty_assigned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS substitute_role_type VARCHAR(50) DEFAULT NULL;
