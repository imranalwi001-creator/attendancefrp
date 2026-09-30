const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'hrm_user',
  password: process.env.DB_PASSWORD || 'hrm_secure_password_2026',
  database: process.env.DB_NAME || 'hrm_db',
});

// Master data 22 Karyawan Riil dari foto Lampiran User (No. 1 s/d 22)
const realData1To22 = [
  { no: 1, nip: 'FR07001', name: 'Hasri. S', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 2, nip: 'FR07002', name: 'Riza Usalli, SE', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 3, nip: 'FR07003', name: 'Musliadi', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 4, nip: 'FR07004', name: 'Muliana', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 5, nip: 'FR07005', name: 'Arianti', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 6, nip: 'FR07006', name: 'M. Sulpan A', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 7, nip: 'FR07007', name: 'Misran', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 8, nip: 'FR07008', name: 'Hasrul. J', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 9, nip: 'FR07009', name: 'Eri Subara', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 10, nip: 'FR07010', name: 'Irfan Ibrahim', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 11, nip: 'FR07011', name: 'Irman', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06 },
  { no: 12, nip: 'FR07012', name: 'Reza Syahputra', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 13, nip: 'FR07013', name: 'Irnawati', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 14, nip: 'FR07014', name: 'Harlina', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 15, nip: 'FR07015', name: 'Muh. Aksa', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA MAKASSAR', shiftPattern: 'DAYSIFT', salary: 4181940, otRate: 24173.06 },
  { no: 16, nip: 'FR07016', name: 'Ita Purnamasari', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 17, nip: 'FR07017', name: 'Serianti', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 18, nip: 'FR07018', name: 'Hasraty Thalib', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 19, nip: 'FR07019', name: 'Hasriani', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 20, nip: 'FR07020', name: 'Sitti Rahmah', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 21, nip: 'FR07021', name: 'Arnilam Tsyania', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 22, nip: 'FR07022', name: 'Bonang', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
];

async function main() {
  try {
    console.log('🚀 Memulai injeksi data riil 22 karyawan pertama (No. 1 s/d 22)...');

    const deptRows = (await pool.query('SELECT id, code, name FROM hrm_divisions')).rows;
    const deptMap = {};
    for (const d of deptRows) {
      deptMap[d.code] = { id: d.id, name: d.name };
    }

    const roleKaryawanId = (await pool.query("SELECT id FROM hrm_roles WHERE name = 'karyawan' LIMIT 1")).rows[0].id;
    const shiftPagiId = (await pool.query("SELECT id FROM hrm_shifts WHERE name LIKE '%Shift I%' LIMIT 1")).rows[0]?.id;

    let updatedCount = 0;

    for (const emp of realData1To22) {
      const dept = deptMap[emp.deptCode] || deptMap['HCG'];
      const severanceScheme = 'tabungan'; // No 1 s/d 22 adalah TABUNGAN
      const email = `${emp.nip.toLowerCase()}@fawwazreski.co.id`;

      // 1. Upsert Profile
      const profQ = `
        INSERT INTO hrm_profiles (
          id, nip, full_name, email, role_id, division_id, shift_id,
          job_title, placement_location, employee_sequence_no, role_name, division_name,
          is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          $7, $8, $9, 'Karyawan', $10,
          true, NOW(), NOW()
        )
        ON CONFLICT (nip) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          division_id = EXCLUDED.division_id,
          division_name = EXCLUDED.division_name,
          job_title = EXCLUDED.job_title,
          placement_location = EXCLUDED.placement_location,
          employee_sequence_no = EXCLUDED.employee_sequence_no,
          updated_at = NOW()
        RETURNING id;
      `;
      const pRes = await pool.query(profQ, [
        emp.nip, emp.name, email, roleKaryawanId, dept.id, shiftPagiId,
        emp.job, emp.location, emp.no, dept.name
      ]);
      const userId = pRes.rows[0].id;

      // 2. Upsert Salary Profile
      const salQ = `
        INSERT INTO hrm_payroll_salary_profiles (
          user_id, base_salary, position_allowance, meal_allowance, transport_allowance,
          other_allowances, bank_name, bank_account_number, bank_account_holder,
          employee_sequence_no, severance_scheme, hourly_overtime_rate, updated_at
        ) VALUES (
          $1, $2, 0, 0, 0,
          '[]'::jsonb, 'Bank Central Asia (BCA)', $3, $4,
          $5, $6, $7, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          base_salary = EXCLUDED.base_salary,
          bank_account_holder = EXCLUDED.bank_account_holder,
          employee_sequence_no = EXCLUDED.employee_sequence_no,
          severance_scheme = EXCLUDED.severance_scheme,
          hourly_overtime_rate = EXCLUDED.hourly_overtime_rate,
          updated_at = NOW();
      `;
      await pool.query(salQ, [
        userId, emp.salary, emp.nip, emp.name, emp.no, severanceScheme, emp.otRate
      ]);

      updatedCount++;
    }

    console.log(`✅ Berhasil memperbarui ${updatedCount} karyawan riil No. 1 s/d 22!`);
    console.log('   - Seluruh No. 1 s/d 22 (Dept. of Human Capital & General) -> Skema TABUNGAN');

    // 3. Tulis ulang template CSV lengkap (No 1 s/d 80)
    const allEmpsRes = await pool.query(`
      SELECT 
        p.employee_sequence_no as no,
        p.nip,
        p.full_name,
        d.name as dept_name,
        p.job_title,
        p.placement_location,
        sp.base_salary,
        sp.hourly_overtime_rate,
        sp.severance_scheme
      FROM hrm_profiles p
      JOIN hrm_divisions d ON p.division_id = d.id
      JOIN hrm_payroll_salary_profiles sp ON sp.user_id = p.id
      WHERE p.employee_sequence_no BETWEEN 1 AND 80
      ORDER BY p.employee_sequence_no ASC;
    `);

    const csvLines = ['No,NIP,Nama Lengkap,Departemen,Jabatan,Penempatan,Gaji Pokok,Tarif Lembur/Jam,Skema Pesangon'];
    for (const r of allEmpsRes.rows) {
      csvLines.push(`${r.no},${r.nip},"${r.full_name}","${r.dept_name}","${r.job_title}","${r.placement_location}",${r.base_salary},${r.hourly_overtime_rate},${r.severance_scheme}`);
    }

    const csvPath = '/public/templates/template_80_karyawan_frp.csv';
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log(`📁 CSV 80 KARYAWAN 100% DATA RIIL disimpan di: ${csvPath}`);

  } catch (err) {
    console.error('❌ Gagal injeksi data:', err);
  } finally {
    await pool.end();
  }
}

main();
