const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'hrm_user',
  password: process.env.DB_PASSWORD || 'hrm_secure_password_2026',
  database: process.env.DB_NAME || 'hrm_db',
});

async function main() {
  try {
    console.log('🚀 Memulai inisialisasi master data 80 karyawan & skema pesangon dinamis...');

    // 1. Ambil ID Departemen Distribusi dan Role Karyawan
    const distDeptRes = await pool.query("SELECT id FROM hrm_divisions WHERE code = 'DIST' LIMIT 1");
    if (distDeptRes.rows.length === 0) {
      throw new Error("Divisi DIST belum terdaftar!");
    }
    const distDeptId = distDeptRes.rows[0].id;

    const roleRes = await pool.query("SELECT id FROM hrm_roles WHERE name = 'karyawan' LIMIT 1");
    if (roleRes.rows.length === 0) {
      throw new Error("Role karyawan belum terdaftar!");
    }
    const karyawanRoleId = roleRes.rows[0].id;

    const shiftRes = await pool.query("SELECT id, name FROM hrm_shifts WHERE name LIKE '%Shift I%' LIMIT 1");
    const shift1Id = shiftRes.rows.length > 0 ? shiftRes.rows[0].id : null;

    // 2. Data khusus yang sudah diketahui (No. 78, 79, 80)
    const knownEmployees = {
      78: { name: 'Wahyudi', nip: 'FR07078', location: 'MATCHING PP MAKASSAR' },
      79: { name: 'Wahyu', nip: 'FR07079', location: 'MATCHING PAOTERE' },
      80: { name: 'Andi Muh Raihan Ramadhan', nip: 'FR07080', location: 'MATCHING PAOTERE' },
    };

    const BASE_SALARY = 4181940;
    const HOURLY_OT_RATE = 24173.06;

    const csvRows = [
      'No,NIP,Nama Lengkap,Departemen,Jabatan,Penempatan,Tipe Shift,Gaji Pokok,Tarif Lembur/Jam,Skema Pesangon'
    ];

    let insertedProfilesCount = 0;
    let insertedSalariesCount = 0;

    for (let seq = 1; seq <= 80; seq++) {
      const nipNumStr = String(seq).padStart(3, '0');
      const nip = `FR07${nipNumStr}`;
      
      const isKnown = Boolean(knownEmployees[seq]);
      const fullName = isKnown ? knownEmployees[seq].name : `Karyawan FR ${nipNumStr}`;
      const location = isKnown ? knownEmployees[seq].location : (seq % 2 === 0 ? 'MATCHING PAOTERE' : 'MATCHING PP MAKASSAR');
      
      // Skema Pesangon: 1 s/d 33 ditabungkan, 34 s/d 80 dibayarkan bersamaan gaji
      const severanceScheme = seq <= 33 ? 'tabungan' : 'cash_with_salary';

      csvRows.push(`${seq},${nip},${fullName},Dept. of Distribution Management,Tech of Shipment Management 2,${location},SHIFT 1/2,${BASE_SALARY},${HOURLY_OT_RATE},${severanceScheme}`);

      // Insert/Upsert ke hrm_profiles
      const email = `${nip.toLowerCase()}@fawwazreski.co.id`;
      const profQ = `
        INSERT INTO hrm_profiles (
          id, nip, full_name, email, role_id, division_id, shift_id,
          job_title, placement_location, employee_sequence_no, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          'Tech of Shipment Management 2', $7, $8, true, NOW(), NOW()
        )
        ON CONFLICT (nip) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          division_id = EXCLUDED.division_id,
          placement_location = EXCLUDED.placement_location,
          employee_sequence_no = EXCLUDED.employee_sequence_no,
          updated_at = NOW()
        RETURNING id, nip, full_name;
      `;
      const profRes = await pool.query(profQ, [
        nip, fullName, email, karyawanRoleId, distDeptId, shift1Id, location, seq
      ]);
      const profileId = profRes.rows[0].id;
      insertedProfilesCount++;

      // Insert/Upsert ke hrm_payroll_salary_profiles
      const salQ = `
        INSERT INTO hrm_payroll_salary_profiles (
          user_id, base_salary, position_allowance, meal_allowance, transport_allowance,
          other_allowances, bank_name, bank_account_number,
          bank_account_holder, employee_sequence_no, severance_scheme, hourly_overtime_rate, updated_at
        ) VALUES (
          $1, $2, 0, 0, 0, '[]'::jsonb,
          'Bank Central Asia (BCA)', $3, $4, $5, $6, $7, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          base_salary = EXCLUDED.base_salary,
          employee_sequence_no = EXCLUDED.employee_sequence_no,
          severance_scheme = EXCLUDED.severance_scheme,
          hourly_overtime_rate = EXCLUDED.hourly_overtime_rate,
          updated_at = NOW();
      `;
      await pool.query(salQ, [
        profileId, BASE_SALARY, nip, fullName, seq, severanceScheme, HOURLY_OT_RATE
      ]);
      insertedSalariesCount++;
    }

    console.log(`✅ Sukses mendaftarkan 80 profil karyawan (${insertedProfilesCount} profiles)`);
    console.log(`✅ Sukses mengonfigurasi 80 profil gaji (${insertedSalariesCount} salary profiles)`);
    console.log(`   - Karyawan No. 01 s/d 33 : Skema PESANGON DITABUNGKAN (Accrued Reserve)`);
    console.log(`   - Karyawan No. 34 s/d 80 : Skema PESANGON DIBAYARKAN BERSAMAAN DENGAN GAJI`);
    console.log(`   - Gaji Pokok             : Rp ${BASE_SALARY.toLocaleString('id-ID')}`);
    console.log(`   - Tarif Lembur per Jam   : Rp ${HOURLY_OT_RATE.toLocaleString('id-ID')}`);

    // 3. Tulis file CSV template untuk kemudahan ekspor/impor pengguna
    const targetDir = path.join(__dirname, '../public/templates');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const csvPath = path.join(targetDir, 'template_80_karyawan_frp.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
    console.log(`📁 File template CSV berhasil disimpan di: ${csvPath}`);

  } catch (err) {
    console.error('❌ Gagal setup batch karyawan:', err);
  } finally {
    await pool.end();
  }
}

main();
