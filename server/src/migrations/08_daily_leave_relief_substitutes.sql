-- ─── MIGRATION 08: MULTI-DAY LEAVE DAILY RELIEF SUBSTITUTES (1 SUBSTITUTE = 1 DAY MAX) ───
-- Sesuai standar operasional PT Fawwaz Reski Perwira:
-- Karyawan pengganti cuti hanya berlaku untuk 1 hari kerja saja.
-- Untuk hari berikutnya harus menugaskan karyawan lain (anti-kelelahan & pemerataan lembur).

CREATE TABLE IF NOT EXISTS hrm_leave_daily_substitutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES hrm_leave_requests(id) ON DELETE CASCADE,
  duty_date DATE NOT NULL,
  day_sequence INTEGER NOT NULL DEFAULT 1,
  substitute_id UUID NOT NULL REFERENCES hrm_profiles(id) ON DELETE CASCADE,
  substitute_name VARCHAR(150),
  substitute_nip VARCHAR(50),
  substitute_phone VARCHAR(50),
  compensation_amount NUMERIC(12,2) DEFAULT 187054.32,
  confirmation_status VARCHAR(30) DEFAULT 'confirmed', -- 'unconfirmed', 'pending_wa', 'confirmed', 'declined'
  confirm_token VARCHAR(100),
  confirmed_at TIMESTAMPTZ,
  overtime_record_id UUID REFERENCES hrm_overtime_records(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_leave_daily_sub_date UNIQUE (leave_request_id, duty_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_daily_sub_leave ON hrm_leave_daily_substitutes(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_daily_sub_user_date ON hrm_leave_daily_substitutes(substitute_id, duty_date);
CREATE INDEX IF NOT EXISTS idx_leave_daily_sub_token ON hrm_leave_daily_substitutes(confirm_token);

