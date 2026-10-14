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

async function runSeamlessRoster() {
  const client = await pool.connect();
  try {
    console.log('🚀 Memulai Penyusunan Jadwal November 2026 Bersambung Presisi dari Master Oktober...');
    await client.query('BEGIN');

    // 1. Baca master file Oktober 2026
    const possiblePaths = [
      '/tmp/roster_shift_10_2026.csv',
      '/app/roster_shift_10_2026.csv',
      path.join(__dirname, '../roster_shift_10_2026 (1) fixx.csv')
    ];
    let csvContent = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        csvContent = fs.readFileSync(p, 'utf8');
        console.log(`📖 Membaca master file dari: ${p}`);
        break;
      }
    }
    if (!csvContent) throw new Error('File master roster Oktober tidak ditemukan!');
    const lines = csvContent.trim().split(/\r?\n/);

    // 2. Ambil data profil dari database (nama, id, nip)
    const profRes = await client.query(`SELECT id, nip, full_name, employee_sequence_no FROM hrm_profiles;`);
    const profMap = new Map();
    for (const p of profRes.rows) {
      const cleanName = p.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      profMap.set(cleanName, p);
    }

    // 3. Bersihkan tabel jadwal bulan November 2026
    await client.query(`
      DELETE FROM hrm_employee_schedules
      WHERE schedule_date >= '2026-11-01' AND schedule_date <= '2026-11-30';
    `);

    const novCsvHeader = ['Nama Karyawan'];
    for (let d = 1; d <= 30; d++) {
      novCsvHeader.push(`Tgl ${d}`);
    }
    novCsvHeader.push('Total Jam', 'Hari Kerja', 'Shift Malam');
    const novCsvLines = [novCsvHeader.join(',')];

    let matchedCount = 0;
    let totalScheduleRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const parsed = parseCsvLine(lines[i]);
      if (!parsed) continue;

      const { name, shiftsOct } = parsed;
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Temukan profil di database
      let user = profMap.get(cleanName);
      if (!user) {
        // Cari partial match
        for (const [key, val] of profMap.entries()) {
          if (cleanName.includes(key) || key.includes(cleanName)) {
            user = val;
            break;
          }
        }
      }

      // Deteksi pola Day Office (Senin-Jumat DAY, Sabtu-Minggu OFF)
      const isDayOffice = shiftsOct.every((s, idx) => {
        const dayOfWeek = (4 + idx) % 7; // 1 Okt = Kamis (4)
        if (dayOfWeek === 6 || dayOfWeek === 0) return s === 'OFF';
        return s === 'DAY';
      });

      const shiftsNov = [];
      let totalJam = 0;
      let hariKerja = 0;
      let shiftMalamCount = 0;

      if (isDayOffice) {
        // Pola kantor November 2026: Senin s/d Jumat = DAY, Sabtu & Minggu = OFF
        for (let day = 1; day <= 30; day++) {
          const dayOfWeek = new Date(Date.UTC(2026, 10, day)).getUTCDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            shiftsNov.push('OFF');
          } else {
            shiftsNov.push('DAY');
            totalJam += 9;
            hariKerja += 1;
          }
        }
      } else {
        // Pola shift: Bersambung dari siklus Oktober
        let period = 8;
        for (let p = 2; p <= 16; p++) {
          let match = true;
          for (let k = 0; k < shiftsOct.length - p; k++) {
            if (shiftsOct[k] !== shiftsOct[k + p]) {
              match = false;
              break;
            }
          }
          if (match) {
            period = p;
            break;
          }
        }

        for (let day = 1; day <= 30; day++) {
          const globalIdx = 31 + (day - 1);
          const refIdx = globalIdx % period;
          const code = shiftsOct[refIdx];
          shiftsNov.push(code);

          const sInfo = SHIFT_MAP[code] || SHIFT_MAP.OFF;
          totalJam += sInfo.duration;
          if (code !== 'OFF') hariKerja += 1;
          if (code === 'M') shiftMalamCount += 1;
        }
      }

      // Jika user ada di database, simpan jadwal ke PostgreSQL
      if (user) {
        matchedCount++;
        for (let day = 1; day <= 30; day++) {
          const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
          const code = shiftsNov[day - 1];
          const sInfo = SHIFT_MAP[code] || SHIFT_MAP.OFF;

          await client.query(`
            INSERT INTO hrm_employee_schedules (
              user_id, schedule_date, shift_id, shift_code, shift_name,
              start_time, end_time, duration_hours, is_night_shift, is_off, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          `, [
            user.id,
            dateStr,
            sInfo.id,
            sInfo.code,
            sInfo.name,
            sInfo.start,
            sInfo.end,
            sInfo.duration,
            sInfo.isNight,
            sInfo.isOff,
            sInfo.isOff ? 'Hari Libur Terjadwal' : `Shift Kerja ${sInfo.code}`
          ]);
          totalScheduleRows++;
        }
      }

      // Tambahkan baris ke file CSV November
      novCsvLines.push(`"${name}",${shiftsNov.join(',')},${totalJam},${hariKerja},${shiftMalamCount}`);
    }

    await client.query('COMMIT');

    // Tulis berkas CSV November 2026 di disk
    const novCsvPath = path.join(__dirname, '../roster_shift_11_2026_fixx.csv');
    fs.writeFileSync(novCsvPath, novCsvLines.join('\n'), 'utf8');

    console.log(`✅ BERHASIL MENYUSUN JADWAL NOVEMBER 2026 KONTINU!`);
    console.log(`   - Karyawan Cocok dengan DB: ${matchedCount} Karyawan`);
    console.log(`   - Total Entri Database: ${totalScheduleRows} Baris Jadwal`);
    console.log(`   - Berkas CSV November Tersimpan di: ${novCsvPath}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal sinkronisasi:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeamlessRoster();
