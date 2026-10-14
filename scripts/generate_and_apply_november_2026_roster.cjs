const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'hrm_user',
  password: process.env.DB_PASSWORD || 'hrm_secure_password_2026',
  database: process.env.DB_NAME || 'hrm_db',
});

// Master Shift UUIDs
const SHIFT_MAP = {
  DAY: {
    id: '717c4613-c2fc-4216-814f-dacdac502181',
    name: 'Day Shift (07:30 - 16:30 WITA)',
    code: 'DAY',
    start: '07:30',
    end: '16:30',
    duration: 9.0,
    isNight: false,
    isOff: false
  },
  P: {
    id: '6203b9f0-b42d-40e2-8e8d-fd5767e0ef4b',
    name: 'Shift I (07:30 - 15:30 WITA)',
    code: 'P',
    start: '07:30',
    end: '15:30',
    duration: 8.0,
    isNight: false,
    isOff: false
  },
  S: {
    id: 'd61c9fd6-d93e-406e-8781-0bfe8189dbfa',
    name: 'Shift II (15:30 - 22:30 WITA)',
    code: 'S',
    start: '15:30',
    end: '22:30',
    duration: 7.0,
    isNight: false,
    isOff: false
  },
  M: {
    id: 'c394c927-d6b1-4376-9739-84c78aa8477d',
    name: 'Shift III (22:30 - 07:30 WITA)',
    code: 'M',
    start: '22:30',
    end: '07:30',
    duration: 9.0,
    isNight: true,
    isOff: false
  },
  OFF: {
    id: null,
    name: 'Libur / Off',
    code: 'OFF',
    start: '00:00',
    end: '00:00',
    duration: 0.0,
    isNight: false,
    isOff: true
  }
};

// Pola shift resmi dari 80 data karyawan:
// 20 Karyawan Day Shift
const DAY_SHIFT_NIPS = new Set([
  'FR07001', 'FR07002', 'FR07003', 'FR07004', 'FR07005',
  'FR07007',
  'FR07013', 'FR07014', 'FR07015', 'FR07016', 'FR07017', 'FR07018', 'FR07019', 'FR07020', 'FR07021', 'FR07022',
  'FR07028',
  'FR07042', 'FR07044', 'FR07046'
]);

// 4 Karyawan Pola SHIFT 1/2 di Makassar
const SHIFT_12_NIPS = new Set(['FR07077', 'FR07078', 'FR07079', 'FR07080']);

async function generateNovemberRoster() {
  const client = await pool.connect();
  try {
    console.log('🚀 Memulai Penyusunan Jadwal Resmi Bulan November 2026...');
    await client.query('BEGIN');

    // 1. Ambil seluruh 80 karyawan riil
    const empsRes = await client.query(`
      SELECT id, nip, full_name, placement_location, shift_id, employee_sequence_no
      FROM hrm_profiles
      WHERE employee_sequence_no BETWEEN 1 AND 80
      ORDER BY employee_sequence_no ASC;
    `);

    const employees = empsRes.rows;
    console.log(`📋 Total Karyawan Terdaftar: ${employees.length} Karyawan`);

    // 2. Bersihkan jadwal bulan November 2026 yang lama jika ada
    await client.query(`
      DELETE FROM hrm_employee_schedules
      WHERE schedule_date >= '2026-11-01' AND schedule_date <= '2026-11-30';
    `);
    console.log('🧹 Berhasil membersihkan draf jadwal November 2026 sebelumnya.');

    // 3. Kelompokkan karyawan per area penempatan / pos untuk rotasi adil
    const areaGroups = {};
    for (const emp of employees) {
      const area = emp.placement_location || 'KANTOR PUSAT SEMEN TONASA';
      if (!areaGroups[area]) areaGroups[area] = [];
      areaGroups[area].push(emp);
    }

    // Pola rotasi shift standar 3 regu
    const ROTATION_3 = ['P', 'S', 'M', 'OFF'];
    const ROTATION_2 = ['P', 'S', 'OFF'];

    let totalSchedules = 0;
    let dayShiftCount = 0;
    let shiftCount = 0;

    // Loop setiap area dan setiap karyawan
    for (const [area, group] of Object.entries(areaGroups)) {
      // Pisahkan Day Shift vs Shift Bergilir di area ini
      const dayShiftGroup = group.filter(e => DAY_SHIFT_NIPS.has(e.nip));
      const shiftGroup = group.filter(e => !DAY_SHIFT_NIPS.has(e.nip));

      // A. Jadwalkan Karyawan DAYSIFT
      for (const emp of dayShiftGroup) {
        for (let day = 1; day <= 30; day++) {
          const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
          const dayOfWeek = new Date(Date.UTC(2026, 10, day)).getUTCDay(); // 0 = Minggu

          // Hari Minggu (1, 8, 15, 22, 29 Nov) = OFF (Libur Mingguan), Senin - Sabtu = DAY SHIFT
          const shiftInfo = (dayOfWeek === 0) ? SHIFT_MAP.OFF : SHIFT_MAP.DAY;

          await client.query(`
            INSERT INTO hrm_employee_schedules (
              user_id, schedule_date, shift_id, shift_code, shift_name,
              start_time, end_time, duration_hours, is_night_shift, is_off, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          `, [
            emp.id,
            dateStr,
            shiftInfo.id,
            shiftInfo.code,
            shiftInfo.name,
            shiftInfo.start,
            shiftInfo.end,
            shiftInfo.duration,
            shiftInfo.isNight,
            shiftInfo.isOff,
            shiftInfo.isOff ? 'Libur Mingguan (Non-Shift)' : 'Jadwal Reguler Day Shift'
          ]);

          totalSchedules++;
          dayShiftCount++;
        }
      }

      // B. Jadwalkan Karyawan SHIFT BERGILIR (Rotasi Adil & Teratur)
      for (let empIdx = 0; empIdx < shiftGroup.length; empIdx++) {
        const emp = shiftGroup[empIdx];
        const isShift12 = SHIFT_12_NIPS.has(emp.nip);
        const rotationCycle = isShift12 ? ROTATION_2 : ROTATION_3;
        const cycleLen = rotationCycle.length;

        // Berikan offset agar regu-regu saling melengkapi (ada pagi, siang, malam tiap hari)
        const offset = empIdx % cycleLen;

        for (let day = 1; day <= 30; day++) {
          const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
          const dayOfWeek = new Date(Date.UTC(2026, 10, day)).getUTCDay();

          // Hitung index rotasi
          const cycleIdx = (day - 1 + offset) % cycleLen;
          const shiftCode = rotationCycle[cycleIdx];
          const shiftInfo = SHIFT_MAP[shiftCode];

          await client.query(`
            INSERT INTO hrm_employee_schedules (
              user_id, schedule_date, shift_id, shift_code, shift_name,
              start_time, end_time, duration_hours, is_night_shift, is_off, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          `, [
            emp.id,
            dateStr,
            shiftInfo.id,
            shiftInfo.code,
            shiftInfo.name,
            shiftInfo.start,
            shiftInfo.end,
            shiftInfo.duration,
            shiftInfo.isNight,
            shiftInfo.isOff,
            shiftInfo.isOff ? 'Hari Libur Rotasi Shift' : `Jadwal Rotasi Shift ${shiftInfo.code}`
          ]);

          totalSchedules++;
          shiftCount++;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ SUKSES BESAR! Jadwal Bulan November 2026 Berhasil Diterapkan ke Database:`);
    console.log(`   - Total Entri Jadwal: ${totalSchedules} jadwal (80 karyawan x 30 hari)`);
    console.log(`   - 20 Karyawan Day Shift: Kerja Senin-Sabtu (07:30-16:30), Libur Minggu`);
    console.log(`   - 60 Karyawan Shift Bergilir: Rotasi Pagi (Shift I) -> Siang (Shift II) -> Malam (Shift III) -> Libur`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal menyusun jadwal:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

generateNovemberRoster();
