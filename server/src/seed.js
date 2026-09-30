import { pool } from './db.js';

export async function seedInitialUsers() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM hrm_profiles');
    const count = parseInt(existing.rows[0].count, 10);

    // Get default role IDs
    const rolesRes = await client.query('SELECT id, name FROM hrm_roles');
    const roleMap = {};
    rolesRes.rows.forEach((r) => {
      roleMap[r.name] = r.id;
    });

    // Get default division IDs
    const divRes = await client.query('SELECT id, code, name FROM hrm_divisions');
    const divMap = {};
    divRes.rows.forEach((d) => {
      divMap[d.code] = d.id;
    });

    // Get default shift
    const shiftRes = await client.query('SELECT id FROM hrm_shifts LIMIT 1');
    const defaultShiftId = shiftRes.rows[0]?.id || null;

    const defaultUsers = [
      {
        nip: 'SA001',
        fullName: 'Master Super Administrator',
        email: 'superadmin@hrm.local',
        password: 'password123',
        phone: '081234567890',
        role_name: 'superadmin',
        role_id: roleMap['superadmin'] || null,
        division_name: 'Teknologi Informasi',
        division_id: divMap['IT'] || null,
        annual_leave_quota: 12,
        used_leave_days: 0,
      },
      {
        nip: 'ADM001',
        fullName: 'Budi Prakoso (Admin HR)',
        email: 'admin@hrm.local',
        password: 'password123',
        phone: '081234567891',
        role_name: 'admin',
        role_id: roleMap['admin'] || null,
        division_name: 'Sumber Daya Manusia',
        division_id: divMap['HRD'] || null,
        annual_leave_quota: 12,
        used_leave_days: 2,
      },
      {
        nip: 'DIR001',
        fullName: 'Drs. Hendra Gunawan (Direktur)',
        email: 'pimpinan@hrm.local',
        password: 'password123',
        phone: '081234567892',
        role_name: 'pimpinan',
        role_id: roleMap['pimpinan'] || null,
        division_name: 'Operasional & Umum',
        division_id: divMap['OPS'] || null,
        annual_leave_quota: 12,
        used_leave_days: 1,
      },
      {
        nip: 'FIN001',
        fullName: 'Anisa Lestari (Payroll & Keuangan)',
        email: 'keuangan@hrm.local',
        password: 'password123',
        phone: '081234567893',
        role_name: 'keuangan',
        role_id: roleMap['keuangan'] || null,
        division_name: 'Keuangan & Akuntansi',
        division_id: divMap['FIN'] || null,
        annual_leave_quota: 12,
        used_leave_days: 0,
      },
      {
        nip: 'EMP001',
        fullName: 'Ahmad Fauzi',
        email: 'fauzi@hrm.local',
        password: 'password123',
        phone: '081234567894',
        role_name: 'karyawan',
        role_id: roleMap['karyawan'] || null,
        division_name: 'Teknologi Informasi',
        division_id: divMap['IT'] || null,
        annual_leave_quota: 12,
        used_leave_days: 1,
      },
      {
        nip: 'EMP002',
        fullName: 'Dewi Sartika',
        email: 'dewi@hrm.local',
        password: 'password123',
        phone: '081234567895',
        role_name: 'karyawan',
        role_id: roleMap['karyawan'] || null,
        division_name: 'Pemasaran & Bisnis',
        division_id: divMap['MKT'] || null,
        annual_leave_quota: 12,
        used_leave_days: 3,
      },
      {
        nip: 'EMP007',
        fullName: 'Karyawan EMP007',
        email: 'emp007@hrm.local',
        password: 'password123',
        phone: '081234567897',
        role_name: 'karyawan',
        role_id: roleMap['karyawan'] || null,
        division_name: 'Teknologi Informasi',
        division_id: divMap['IT'] || null,
        annual_leave_quota: 12,
        used_leave_days: 0,
      },
    ];

    for (const u of defaultUsers) {
      await client.query(
        `INSERT INTO hrm_profiles (
          nip, full_name, email, password, phone, role_name, role_id, 
          division_name, division_id, shift_id, annual_leave_quota, used_leave_days, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        ON CONFLICT (nip) DO UPDATE SET 
          password = EXCLUDED.password,
          role_name = EXCLUDED.role_name,
          division_name = EXCLUDED.division_name;`,
        [
          u.nip,
          u.fullName,
          u.email,
          u.password,
          u.phone,
          u.role_name,
          u.role_id,
          u.division_name,
          u.division_id,
          defaultShiftId,
          u.annual_leave_quota,
          u.used_leave_days,
        ]
      );
    }

    console.log('[Seed] Default profiles & EMP007 ensured in PostgreSQL.');
  } catch (err) {
    console.error('[Seed] Failed to seed profiles:', err.message);
  } finally {
    client.release();
  }
}
