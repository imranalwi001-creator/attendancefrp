-- ==============================================================================
-- 06_payroll_slips.sql
-- Alignment with PT. FAWWAZ RESKI PERWIRA Official Salary Slip Template
-- PENDAPATAN (Upah, Lembur, Pesangon) vs POTONGAN (BPJS TK 3%, BPJS Kes 1%, Alpa)
-- ==============================================================================

-- 1. Ensure required columns exist on hrm_payroll_slips
ALTER TABLE hrm_payroll_slips 
  ADD COLUMN IF NOT EXISTS pesangon_label VARCHAR(100) DEFAULT 'Pesangon',
  ADD COLUMN IF NOT EXISTS pesangon_amount BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alpa_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alpa_rate BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS printed_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Populate slips for active employees for the approved September 2026 period
DO $$
DECLARE
  v_period_id UUID;
  v_period_label VARCHAR(100);
BEGIN
  SELECT id, period_label INTO v_period_id, v_period_label 
  FROM hrm_payroll_periods 
  WHERE year = 2026 AND month = 9 
  LIMIT 1;

  IF v_period_id IS NOT NULL THEN
    INSERT INTO hrm_payroll_slips (
      period_id,
      user_id,
      period_label,
      base_salary,
      position_allowance,
      meal_allowance,
      transport_allowance,
      other_allowances,
      total_overtime_pay,
      pesangon_label,
      pesangon_amount,
      gross_income,
      late_deduction,
      absence_deduction,
      alpa_days,
      alpa_rate,
      bpjs_kesehatan_deduction,
      bpjs_ketenagakerjaan_deduction,
      tax_deduction,
      total_deductions,
      net_salary,
      status,
      printed_date,
      paid_at
    )
    SELECT
      v_period_id,
      p.id,
      v_period_label,
      4045050,                      -- Upah Pokok Resmi
      0,
      0,
      0,
      '[]'::jsonb,
      0,                            -- Lembur
      'Pesangon September',
      0,                            -- Pesangon / Penyesuaian
      4045050,                      -- Total Pendapatan
      0,                            -- Terlambat
      0,                            -- Alpa
      0,                            -- Jumlah Hari Alpa
      155000,                       -- Tarif Alpa per hari
      40450,                        -- BPJS Kesehatan 1%
      121351,                       -- BPJS Ketenagakerjaan 3%
      0,                            -- Pajak
      161802,                       -- Total Potongan (121.351 + 40.450)
      3883248,                      -- Jumlah Gaji / Net Salary (4.045.050 - 161.802)
      'paid',
      CURRENT_DATE,
      NOW()
    FROM hrm_profiles p
    WHERE p.is_active = true
    ON CONFLICT (period_id, user_id) DO UPDATE SET
      base_salary = EXCLUDED.base_salary,
      gross_income = EXCLUDED.gross_income,
      bpjs_kesehatan_deduction = EXCLUDED.bpjs_kesehatan_deduction,
      bpjs_ketenagakerjaan_deduction = EXCLUDED.bpjs_ketenagakerjaan_deduction,
      total_deductions = EXCLUDED.total_deductions,
      net_salary = EXCLUDED.net_salary,
      status = 'paid',
      updated_at = NOW();

    -- Update summary on period
    UPDATE hrm_payroll_periods
    SET total_gross = (SELECT COALESCE(SUM(gross_income), 0) FROM hrm_payroll_slips WHERE period_id = v_period_id),
        total_deductions = (SELECT COALESCE(SUM(total_deductions), 0) FROM hrm_payroll_slips WHERE period_id = v_period_id),
        total_net = (SELECT COALESCE(SUM(net_salary), 0) FROM hrm_payroll_slips WHERE period_id = v_period_id),
        total_employees = (SELECT COUNT(*) FROM hrm_payroll_slips WHERE period_id = v_period_id),
        updated_at = NOW()
    WHERE id = v_period_id;
  END IF;
END $$;
