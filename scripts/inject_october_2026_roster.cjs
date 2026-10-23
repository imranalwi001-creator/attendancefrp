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

// Master Shift Definitions
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

function parseCsvLine(line) {
  let validTokens = line.split(',').map(p => p.trim()).filter(p => p !== '');
  if (validTokens.length < 34) return null;
  const shiftMalam = validTokens.pop();
  const hariKerja = validTokens.pop();
  const totalJam = validTokens.pop();
  const shiftsOct = validTokens.splice(validTokens.length - 31, 31);
  const fullName = validTokens.join(', ').replace(/^\"|\"$/g, '');
  return { name: fullName, shiftsOct };
}

async function injectOctoberRoster() {
  const client = await pool.connect();
  try {
    console.log('🚀 Memulai Injeksi Jadwal Resmi Bulan Oktober 2026 ke PostgreSQL...');
    await client.query('BEGIN');

    // 1. Cari path file master CSV Oktober 2026
    const possiblePaths = [
      '/home/ubuntu/roster_shift_10_2026 (1) fixx.csv',
      '/tmp/roster_shift_10_2026.csv',
      '/app/roster_shift_10_2026.csv',
      path.join(__dirname, '../roster_shift_10_2026 (1) fixx.csv'),
      path.join(__dirname, 'roster_shift_10_2026 (1) fixx.csv')
    ];
    let csvContent = null;
    let foundPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        csvContent = fs.readFileSync(p, 'utf8');
        foundPath = p;
        console.log(`📖 Membaca master pola shift dari: ${p}`);
        break;
      }
    }
    if (!csvContent) throw new Error('File master roster Oktober 2026 tidak ditemukan!');

    const lines = csvContent.trim().split(/\r?\n/);

    // 2. Ambil seluruh data profil karyawan dari PostgreSQL
    const profRes = await client.query(`
      SELECT id, nip, full_name, employee_sequence_no, division_id, shift_id
      FROM hrm_profiles;
    `);

    const profMap = new Map();
    const profSeqMap = new Map();
    for (const p of profRes.rows) {
      const cleanName = p.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      profMap.set(cleanName, p);
      if (p.employee_sequence_no) {
        profSeqMap.set(Number(p.employee_sequence_no), p);
      }
    }

    const matchedUsers = new Set();
    let totalScheduleRows = 0;
    let matchedCount = 0;

    // 3. Loop CSV lines
    for (let i = 1; i < lines.length; i++) {
      const parsed = parseCsvLine(lines[i]);
      if (!parsed) continue;

      const { name, shiftsOct } = parsed;
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Cari user berdasarkan cleanName atau sequence nomor atau partial match
      let user = profMap.get(cleanName);
      if (!user) {
        for (const [key, val] of profMap.entries()) {
          if (cleanName.includes(key) || key.includes(cleanName)) {
            user = val;
            break;
          }
        }
      }
      if (!user && profSeqMap.has(i)) {
        user = profSeqMap.get(i);
      }

      if (!user) {
        console.warn(`⚠️ Baris ${i}: Karyawan "${name}" tidak ditemukan di hrm_profiles, dilewati.`);
        continue;
      }

      matchedCount++;
      matchedUsers.add(user.id);

      // Injeksi jadwal 31 hari Oktober 2026
      for (let day = 1; day <= 31; day++) {
        const rawCode = (shiftsOct[day - 1] || 'DAY').toUpperCase().trim();
        const shiftInfo = SHIFT_MAP[rawCode] || SHIFT_MAP.DAY;
        const dateStr = `2026-10-${String(day).padStart(2, '0')}`;

        await client.query(`
          INSERT INTO hrm_employee_schedules (
            user_id, schedule_date, shift_id, shift_code, shift_name,
            start_time, end_time, duration_hours, is_night_shift, is_off, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (user_id, schedule_date) DO UPDATE SET
            shift_id = EXCLUDED.shift_id,
            shift_code = EXCLUDED.shift_code,
            shift_name = EXCLUDED.shift_name,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            duration_hours = EXCLUDED.duration_hours,
            is_night_shift = EXCLUDED.is_night_shift,
            is_off = EXCLUDED.is_off,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        `, [
          user.id,
          dateStr,
          shiftInfo.id,
          shiftInfo.code,
          shiftInfo.name,
          shiftInfo.start,
          shiftInfo.end,
          shiftInfo.duration,
          shiftInfo.isNight,
          shiftInfo.isOff,
          shiftInfo.isOff ? 'Libur Sesuai Roster Resmi' : `Jadwal Kerja Resmi (${shiftInfo.name})`
        ]);

        totalScheduleRows++;
      }
    }

    console.log(`✅ Berhasil mencocokkan ${matchedCount} karyawan dari CSV.`);

    // 4. Untuk sisa karyawan di hrm_profiles yang tidak ada di CSV (staf IT, pimpinan, kantor pusat, dsb)
    let nonCsvCount = 0;
    for (const p of profRes.rows) {
      if (matchedUsers.has(p.id)) continue;

      // Berikan jadwal Day Shift (Senin-Sabtu) atau custom work hours mereka, Minggu OFF
      for (let day = 1; day <= 31; day++) {
        const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(Date.UTC(2026, 9, day)).getUTCDay(); // 0 = Minggu

        const isSunday = (dayOfWeek === 0);
        const shiftInfo = isSunday ? SHIFT_MAP.OFF : SHIFT_MAP.DAY;

        await client.query(`
          INSERT INTO hrm_employee_schedules (
            user_id, schedule_date, shift_id, shift_code, shift_name,
            start_time, end_time, duration_hours, is_night_shift, is_off, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (user_id, schedule_date) DO UPDATE SET
            shift_id = EXCLUDED.shift_id,
            shift_code = EXCLUDED.shift_code,
            shift_name = EXCLUDED.shift_name,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            duration_hours = EXCLUDED.duration_hours,
            is_night_shift = EXCLUDED.is_night_shift,
            is_off = EXCLUDED.is_off,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        `, [
          p.id,
          dateStr,
          shiftInfo.id,
          shiftInfo.code,
          shiftInfo.name,
          shiftInfo.start,
          shiftInfo.end,
          shiftInfo.duration,
          shiftInfo.isNight,
          shiftInfo.isOff,
          isSunday ? 'Libur Mingguan (Non-Shift)' : 'Jadwal Reguler Kantor'
        ]);

        totalScheduleRows++;
      }
      nonCsvCount++;
    }

    console.log(`✅ Berhasil melengkapi ${nonCsvCount} karyawan kantor/non-CSV dengan jadwal reguler.`);
    console.log(`🎉 TOTAL INJEKSI OKTOBER 2026: ${totalScheduleRows} baris jadwal berhasil disimpan.`);

    await client.query('COMMIT');
    console.log('🌟 SELESAI: Database hrm_employee_schedules Oktober 2026 siap 100%!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal injeksi jadwal Oktober 2026:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

injectOctoberRoster().catch(() => process.exit(1));
