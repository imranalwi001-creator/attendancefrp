-- 07_payroll_slip_pwa_access.sql
-- Menambahkan kontrol akses slip gaji di PWA Karyawan
-- Slip gaji hanya muncul di PWA jika diaktifkan oleh Superadmin atau diminta oleh karyawan

ALTER TABLE hrm_payroll_slips 
ADD COLUMN IF NOT EXISTS published_to_employee boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requested_by_employee boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS request_reason text,
ADD COLUMN IF NOT EXISTS requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS request_status character varying(30) DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_hrm_payroll_slips_published ON hrm_payroll_slips (published_to_employee);
CREATE INDEX IF NOT EXISTS idx_hrm_payroll_slips_requested ON hrm_payroll_slips (requested_by_employee);
