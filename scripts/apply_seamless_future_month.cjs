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

async function generateFutureMonth(targetYear = 2026, targetMonth = 12) {
  const client = await pool.connect();
  try {
    console.log(`🚀 Memulai Penyusunan Jadwal Bulan ${targetMonth}/${targetYear} Bersambung Presisi...`);
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
        console.log(`📖 Membaca master pola shift dari: ${p}`);
        break;
      }
    }
    if (!csvContent) throw new Error('File master roster Oktober tidak ditemukan!');
    const lines = csvContent.trim().split(/\r?\n/);

    // 2. Ambil seluruh data profil karyawan dari PostgreSQL terurut berdasarkan NIP
    const profRes = await client.query(`
      SELECT id, nip, full_name, employee_sequence_no, division_id
      FROM hrm_profiles
      ORDER BY CASE WHEN nip LIKE 'FR%' THEN 0 ELSE 1 END, nip ASC, full_name ASC;
    `);

    const profMap = new Map();
    for (const p of profRes.rows) {
      const cleanName = p.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      profMap.set(cleanName, p);
    }

    // 3. Hitung jumlah hari dalam target bulan dan cumulative days dari 1 Oktober 2026
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const startDate = new Date(Date.UTC(2026, 9, 1)); // 1 Okt 2026
    const targetStartDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const daysFromOct1 = Math.round((targetStartDate - startDate) / (1000 * 60 * 60 * 24));

    console.log(`📅 Target: Bulan ${targetMonth}/${targetYear} (${daysInTargetMonth} hari)`);
    console.log(`⏳ Hari berlalu sejak 1 Okt 2026: ${daysFromOct1} hari`);

    const monthStr = String(targetMonth).padStart(2, '0');
    const startStr = `${targetYear}-${monthStr}-01`;
    const endStr = `${targetYear}-${monthStr}-${String(daysInTargetMonth).padStart(2, '0')}`;

    // Bersihkan jadwal lama untuk bulan ini jika ada
    await client.query(`
      DELETE FROM hrm_employee_schedules
      WHERE schedule_date >= $1 AND schedule_date <= $2;
    `, [startStr, endStr]);

    // Format header CSV
    const csvHeader = ['Nama Karyawan'];
    for (let d = 1; d <= daysInTargetMonth; d++) {
      csvHeader.push(`Tgl ${d}`);
    }
    csvHeader.push('Total Jam', 'Hari Kerja', 'Shift Malam');
    const csvLines = [csvHeader.join(',')];

    // Proses semua baris di file Oktober dan pasangkan dengan profil
    const employeeRotations = [];

    for (let i = 1; i < lines.length; i++) {
      const parsed = parseCsvLine(lines[i]);
      if (!parsed) continue;

      const { name, shiftsOct } = parsed;
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      let user = profMap.get(cleanName);
      if (!user) {
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

      const shiftsTarget = [];
      let totalJam = 0;
      let hariKerja = 0;
      let shiftMalamCount = 0;

      if (isDayOffice) {
        // Pola kantor: Senin - Jumat = DAY, Sabtu & Minggu = OFF
        for (let day = 1; day <= daysInTargetMonth; day++) {
          const dayOfWeek = new Date(Date.UTC(targetYear, targetMonth - 1, day)).getUTCDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            shiftsTarget.push('OFF');
          } else {
            shiftsTarget.push('DAY');
            totalJam += 9;
            hariKerja += 1;
          }
        }
      } else {
        // Deteksi periode perulangan dari Oktober
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

        // Hitung shift kontinu mulai dari hari berlalu sejak 1 Okt
        for (let day = 1; day <= daysInTargetMonth; day++) {
          const globalIdx = daysFromOct1 + (day - 1);
          const refIdx = globalIdx % period;
          const code = shiftsOct[refIdx];
          shiftsTarget.push(code);

          const sInfo = SHIFT_MAP[code] || SHIFT_MAP.OFF;
          totalJam += sInfo.duration;
          if (code !== 'OFF') hariKerja += 1;
          if (code === 'M') shiftMalamCount += 1;
        }
      }

      employeeRotations.push({
        user,
        name: user ? user.full_name : name,
        nip: user ? user.nip : 'FR99999',
        seq: user ? (user.employee_sequence_no || 999) : 999,
        shifts: shiftsTarget,
        totalJam,
        hariKerja,
        shiftMalamCount
      });
    }

    // Urutkan seluruh karyawan secara berurutan berdasarkan NIP!
    employeeRotations.sort((a, b) => {
      const isFrA = a.nip.startsWith('FR');
      const isFrB = b.nip.startsWith('FR');
      if (isFrA && !isFrB) return -1;
      if (!isFrA && isFrB) return 1;
      return a.nip.localeCompare(b.nip, undefined, { numeric: true, sensitivity: 'base' });
    });

    let insertedRows = 0;
    let matchedEmployees = 0;

    for (const item of employeeRotations) {
      if (item.user) {
        matchedEmployees++;
        for (let day = 1; day <= daysInTargetMonth; day++) {
          const dateStr = `${targetYear}-${monthStr}-${String(day).padStart(2, '0')}`;
          const code = item.shifts[day - 1];
          const sInfo = SHIFT_MAP[code] || SHIFT_MAP.OFF;

          await client.query(`
            INSERT INTO hrm_employee_schedules (
              user_id, schedule_date, shift_id, shift_code, shift_name,
              start_time, end_time, duration_hours, is_night_shift, is_off, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          `, [
            item.user.id,
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
          insertedRows++;
        }
      }

      csvLines.push(`"${item.name}",${item.shifts.join(',')},${item.totalJam},${item.hariKerja},${item.shiftMalamCount}`);
    }

    await client.query('COMMIT');

    // Simpan file CSV hasil rotasi
    const outputFileName = `roster_shift_${targetMonth}_${targetYear}_fixx.csv`;
    const outputPath = path.join(__dirname, outputFileName);
    fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');

    const templateDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });
    const templatePath = path.join(templateDir, outputFileName);
    fs.writeFileSync(templatePath, csvLines.join('\n'), 'utf8');

    console.log(`✅ BERHASIL MENERAPKAN JADWAL BULAN ${targetMonth}/${targetYear}!`);
    console.log(`   - Karyawan Terdaftar (Urut NIP): ${matchedEmployees}`);
    console.log(`   - Total Entri Database: ${insertedRows} Baris Jadwal`);
    console.log(`   - File CSV Disimpan ke: ${outputPath}`);
    console.log(`   - File Template Disimpan ke: ${templatePath}`);

    return { success: true, count: insertedRows, employees: matchedEmployees };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal menyusun jadwal kontinu:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Jika dijalankan langsung dari terminal:
const targetYear = parseInt(process.argv[2] || '2026', 10);
const targetMonth = parseInt(process.argv[3] || '12', 10);

generateFutureMonth(targetYear, targetMonth)
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
