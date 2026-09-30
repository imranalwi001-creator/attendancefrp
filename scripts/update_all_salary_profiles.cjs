const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'hrm_user',
  password: process.env.DB_PASSWORD || 'hrm_secure_password_2026',
  database: process.env.DB_NAME || 'hrm_db',
});

async function main() {
  try {
    const q = `
      INSERT INTO hrm_payroll_salary_profiles (
        user_id, base_salary, position_allowance, meal_allowance, transport_allowance,
        housing_allowance, health_allowance, other_allowances, bank_name, bank_account_number, bank_account_holder, updated_at
      )
      SELECT 
        p.id, 4045050, 0, 0, 0, 0, 0, '[]'::jsonb,
        'Bank Central Asia (BCA)', COALESCE(p.nip, '7140294812'), p.full_name, NOW()
      FROM hrm_profiles p
      WHERE p.is_active = true
      ON CONFLICT (user_id) DO UPDATE SET
        base_salary = 4045050,
        position_allowance = 0,
        meal_allowance = 0,
        transport_allowance = 0,
        housing_allowance = 0,
        health_allowance = 0,
        other_allowances = '[]'::jsonb,
        updated_at = NOW()
      RETURNING user_id, base_salary;
    `;
    const res = await pool.query(q);
    console.log('Successfully updated/synced all salary profiles to 4,045,050. Count:', res.rowCount);

    // Also update all existing slips in hrm_payroll_slips to official figures
    const slipUpdate = `
      UPDATE hrm_payroll_slips
      SET base_salary = 4045050,
          position_allowance = 0,
          meal_allowance = 0,
          transport_allowance = 0,
          gross_income = 4045050 + COALESCE(total_overtime_pay, 0) + COALESCE(pesangon_amount, 0),
          bpjs_ketenagakerjaan_deduction = 121351,
          bpjs_kesehatan_deduction = 40450,
          total_deductions = 121351 + 40450 + COALESCE(absence_deduction, 0),
          net_salary = (4045050 + COALESCE(total_overtime_pay, 0) + COALESCE(pesangon_amount, 0)) - (121351 + 40450 + COALESCE(absence_deduction, 0)),
          updated_at = NOW();
    `;
    const sRes = await pool.query(slipUpdate);
    console.log('Successfully synchronized all payroll slips. Count:', sRes.rowCount);
  } catch (err) {
    console.error('Update error:', err);
  } finally {
    await pool.end();
  }
}

main();
