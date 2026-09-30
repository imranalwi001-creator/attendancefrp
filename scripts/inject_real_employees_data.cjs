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

// Master data 58 Karyawan Riil dari foto Lampiran User (No. 23 s/d 80)
const realData = [
  // --- Lampiran 5: No 23 s/d 33 (Dept. of Human Capital & General) -> DITABUNGKAN ---
  { no: 23, nip: 'FR07023', name: 'Haidir', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 24, nip: 'FR07024', name: 'Achmad Hariyono', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 25, nip: 'FR07025', name: 'Kamaruddin', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 26, nip: 'FR07026', name: 'Sofyan', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06 },
  { no: 27, nip: 'FR07027', name: 'Rusli', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06 },
  { no: 28, nip: 'FR07028', name: 'Nur Afiah Ali', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79 },
  { no: 29, nip: 'FR07029', name: 'Ishaq Zulkarnain', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 30, nip: 'FR07030', name: 'Muh. Yusuf', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 31, nip: 'FR07031', name: 'Dahrial', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 32, nip: 'FR07032', name: 'Risdianto', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06 },
  { no: 33, nip: 'FR07033', name: 'Ishak HN', deptCode: 'HCG', job: 'Staff of Sec. of Household', location: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },

  // --- Lampiran 4: No 34 s/d 44 (Dept. of Distribution Management) -> DIBAYARKAN BERSAMAAN GAJI ---
  { no: 34, nip: 'FR07034', name: 'Yusran Idris', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 35, nip: 'FR07035', name: 'Armin Amir', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 36, nip: 'FR07036', name: 'Afdal Amal Hidayat', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 37, nip: 'FR07037', name: 'Daniel Rantika', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 38, nip: 'FR07038', name: 'Muhammad Dahlan Caddi', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 39, nip: 'FR07039', name: 'Muh. Nawir', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 40, nip: 'FR07040', name: 'Suhardi', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 41, nip: 'FR07041', name: 'Sahrul', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 42, nip: 'FR07042', name: 'M. Reza Angga Dwi S', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING BONTOA', shiftPattern: 'DAYSIFT', salary: 4148050, otRate: 23977.17 },
  { no: 43, nip: 'FR07043', name: 'A. Firri Makkaraka', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 44, nip: 'FR07044', name: 'Ichtiar', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4148050, otRate: 23977.17 },

  // --- Lampiran 3: No 45 s/d 55 (Dept. of Distribution Management) -> DIBAYARKAN BERSAMAAN GAJI ---
  { no: 45, nip: 'FR07045', name: 'Rudini Hanupe', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 46, nip: 'FR07046', name: 'Rusdi Aryanto', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING BONTOA', shiftPattern: 'DAYSIFT', salary: 4148050, otRate: 23977.17 },
  { no: 47, nip: 'FR07047', name: 'Tedi Harianto', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 48, nip: 'FR07048', name: 'Lukman. K', deptCode: 'DIST', job: 'Tech of Shipment Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 49, nip: 'FR07049', name: 'Ardi Rizal', deptCode: 'DIST', job: 'Tech of Shipment Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 50, nip: 'FR07050', name: 'Arwan', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 51, nip: 'FR07051', name: 'Muh Yunus', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 52, nip: 'FR07052', name: 'Zulkifli Syafruddin', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 53, nip: 'FR07053', name: 'Fakrul Islam', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 54, nip: 'FR07054', name: 'Ruslan', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 55, nip: 'FR07055', name: 'Ramli', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },

  // --- Lampiran 2: No 56 s/d 66 (Distribution & Transportation) -> DIBAYARKAN BERSAMAAN GAJI ---
  { no: 56, nip: 'FR07056', name: 'Muh Yunus', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 57, nip: 'FR07057', name: 'Herman', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 58, nip: 'FR07058', name: 'Muhammad Rizky Mahendra', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 59, nip: 'FR07059', name: 'Selgi Salpatur Ramadan', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 60, nip: 'FR07060', name: 'Sunardi', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 61, nip: 'FR07061', name: 'Agus Reynaldi', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 62, nip: 'FR07062', name: 'Andri Cahyono', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 63, nip: 'FR07063', name: 'Dini Ramadhan', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 64, nip: 'FR07064', name: 'Sahrul Hidayat', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'SEGEL 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4117150, otRate: 23798.55 },
  { no: 65, nip: 'FR07065', name: 'Honnes Amos Daud', deptCode: 'TRANS', job: 'Operational Transprtation IX', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 66, nip: 'FR07066', name: 'Rusli', deptCode: 'TRANS', job: 'Operational Transprtation IX', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },

  // --- Lampiran 1: No 67 s/d 77 (Transportation & Distribution) -> DIBAYARKAN BERSAMAAN GAJI ---
  { no: 67, nip: 'FR07067', name: 'Yoga Junsrianto Saputra', deptCode: 'TRANS', job: 'Operational Transprtation IX', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 68, nip: 'FR07068', name: 'Fadly Ardiansyah', deptCode: 'TRANS', job: 'Operational Transprtation IX', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 69, nip: 'FR07069', name: 'Amrin Amir', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 70, nip: 'FR07070', name: 'Muhammad Afdhal Wahid', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 71, nip: 'FR07071', name: 'Juanda Fatahillah Manaf', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 72, nip: 'FR07072', name: 'Muhammad Khaeril Amri', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING BONTOA', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 73, nip: 'FR07073', name: 'Irfan Dg Ronrong', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING MACCINI BAJI', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 74, nip: 'FR07074', name: 'Muh Ikram', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING MACCINI BAJI', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 75, nip: 'FR07075', name: 'Rahmatan', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING MACCINI BAJI', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 76, nip: 'FR07076', name: 'Muh. Adam', deptCode: 'DIST', job: 'Tech of Inventory Management 2', location: 'MATCHING MACCINI BAJI', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79 },
  { no: 77, nip: 'FR07077', name: 'Zulkifli Nasir', deptCode: 'DIST', job: 'Tech of Shipment Management 2', location: 'MATCHING PP MAKASSAR', shiftPattern: 'SHIFT 1/2', salary: 4181940, otRate: 24173.06 },

  // --- Data Sebelumnya: No 78, 79, 80 ---
  { no: 78, nip: 'FR07078', name: 'Wahyudi', deptCode: 'DIST', job: 'Tech of Shipment Management 2', location: 'MATCHING PP MAKASSAR', shiftPattern: 'SHIFT 1/2', salary: 4181940, otRate: 24173.06 },
  { no: 79, nip: 'FR07079', name: 'Wahyu', deptCode: 'DIST', job: 'Tech of Shipment Management 2', location: 'MATCHING PAOTERE', shiftPattern: 'SHIFT 1/2', salary: 4181940, otRate: 24173.06 },
  { no: 80, nip: 'FR07080', name: 'Andi Muh Raihan Ramadhan', deptCode: 'DIST', job: 'Tech of Shipment Management 2', location: 'MATCHING PAOTERE', shiftPattern: 'SHIFT 1/2', salary: 4181940, otRate: 24173.06 },
];

async function main() {
  try {
    console.log('🚀 Memulai injeksi data riil 58 karyawan (No. 23 s/d 80)...');

    // Ambil mapping departemen
    const deptRows = (await pool.query('SELECT id, code, name FROM hrm_divisions')).rows;
    const deptMap = {};
    for (const d of deptRows) {
      deptMap[d.code] = { id: d.id, name: d.name };
    }

    const roleKaryawanId = (await pool.query("SELECT id FROM hrm_roles WHERE name = 'karyawan' LIMIT 1")).rows[0].id;
    const shiftPagiId = (await pool.query("SELECT id FROM hrm_shifts WHERE name LIKE '%Shift I%' LIMIT 1")).rows[0]?.id;

    let updatedCount = 0;

    for (const emp of realData) {
      const dept = deptMap[emp.deptCode] || deptMap['DIST'];
      const severanceScheme = emp.no <= 33 ? 'tabungan' : 'cash_with_salary';
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

    console.log(`✅ Berhasil memperbarui ${updatedCount} karyawan riil dari foto dokumen!`);
    console.log('   - No. 23 s/d 33 (Dept. of Human Capital & General) -> Skema TABUNGAN');
    console.log('   - No. 34 s/d 80 (Dept. of Distribution & Transportation) -> Skema DIBAYARKAN BERSAMAAN GAJI');

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
      csvLines.push(`${r.no},${r.nip},${r.full_name},${r.dept_name},${r.job_title},${r.placement_location},${r.base_salary},${r.hourly_overtime_rate},${r.severance_scheme}`);
    }

    const csvPath = '/public/templates/template_80_karyawan_frp.csv';
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log(`📁 CSV diperbarui dengan data riil di: ${csvPath}`);

  } catch (err) {
    console.error('❌ Gagal injeksi data:', err);
  } finally {
    await pool.end();
  }
}

main();
