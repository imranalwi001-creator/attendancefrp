const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'hrm-database',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'hrm_db',
  user: process.env.DB_USER || 'hrm_user',
  password: process.env.DB_PASSWORD || 'hrm_secure_pass_2024',
});

const holidays = [
  // 2025 (SKB 3 Menteri)
  { date: '2025-01-01', name: 'Tahun Baru 2025 Masehi', type: 'national', year: 2025 },
  { date: '2025-01-27', name: "Isra Mi'raj Nabi Muhammad SAW", type: 'national', year: 2025 },
  { date: '2025-01-29', name: 'Tahun Baru Imlek 2576 Kongzili', type: 'national', year: 2025 },
  { date: '2025-03-29', name: 'Hari Suci Nyepi (Tahun Baru Saka 1947)', type: 'national', year: 2025 },
  { date: '2025-03-31', name: 'Hari Raya Idul Fitri 1446 H (Hari 1)', type: 'national', year: 2025 },
  { date: '2025-04-01', name: 'Hari Raya Idul Fitri 1446 H (Hari 2)', type: 'national', year: 2025 },
  { date: '2025-04-18', name: 'Wafat Yesus Kristus (Jumat Agung)', type: 'national', year: 2025 },
  { date: '2025-04-20', name: 'Hari Kebangkitan Yesus Kristus (Paskah)', type: 'national', year: 2025 },
  { date: '2025-05-01', name: 'Hari Buruh Internasional', type: 'national', year: 2025 },
  { date: '2025-05-12', name: 'Hari Raya Waisak 2569 BE', type: 'national', year: 2025 },
  { date: '2025-05-29', name: 'Kenaikan Yesus Kristus', type: 'national', year: 2025 },
  { date: '2025-06-01', name: 'Hari Lahir Pancasila', type: 'national', year: 2025 },
  { date: '2025-06-07', name: 'Hari Raya Idul Adha 1446 H', type: 'national', year: 2025 },
  { date: '2025-06-27', name: 'Tahun Baru Islam 1447 H', type: 'national', year: 2025 },
  { date: '2025-08-17', name: 'Proklamasi Kemerdekaan RI ke-80', type: 'national', year: 2025 },
  { date: '2025-09-05', name: 'Maulid Nabi Muhammad SAW', type: 'national', year: 2025 },
  { date: '2025-12-25', name: 'Hari Raya Natal', type: 'national', year: 2025 },

  // 2026 (SKB 3 Menteri)
  { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi', type: 'national', year: 2026 },
  { date: '2026-01-16', name: "Isra Mi'raj Nabi Muhammad SAW", type: 'national', year: 2026 },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', type: 'national', year: 2026 },
  { date: '2026-03-20', name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', type: 'national', year: 2026 },
  { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H (Hari 1)', type: 'national', year: 2026 },
  { date: '2026-03-22', name: 'Hari Raya Idul Fitri 1447 H (Hari 2)', type: 'national', year: 2026 },
  { date: '2026-04-03', name: 'Wafat Yesus Kristus (Jumat Agung)', type: 'national', year: 2026 },
  { date: '2026-04-05', name: 'Hari Kebangkitan Yesus Kristus (Paskah)', type: 'national', year: 2026 },
  { date: '2026-05-01', name: 'Hari Buruh Internasional', type: 'national', year: 2026 },
  { date: '2026-05-14', name: 'Kenaikan Yesus Kristus', type: 'national', year: 2026 },
  { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 H', type: 'national', year: 2026 },
  { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE', type: 'national', year: 2026 },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila', type: 'national', year: 2026 },
  { date: '2026-06-16', name: 'Tahun Baru Islam 1448 H', type: 'national', year: 2026 },
  { date: '2026-08-17', name: 'Hari Proklamasi Kemerdekaan RI ke-81', type: 'national', year: 2026 },
  { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW', type: 'national', year: 2026 },
  { date: '2026-12-25', name: 'Hari Raya Natal', type: 'national', year: 2026 },

  // 2027 (Kalender Nasional)
  { date: '2027-01-01', name: 'Tahun Baru 2027 Masehi', type: 'national', year: 2027 },
  { date: '2027-01-05', name: "Isra Mi'raj Nabi Muhammad SAW", type: 'national', year: 2027 },
  { date: '2027-02-06', name: 'Tahun Baru Imlek 2578 Kongzili', type: 'national', year: 2027 },
  { date: '2027-03-09', name: 'Hari Suci Nyepi (Tahun Baru Saka 1949)', type: 'national', year: 2027 },
  { date: '2027-03-10', name: 'Hari Raya Idul Fitri 1448 H (Hari 1)', type: 'national', year: 2027 },
  { date: '2027-03-11', name: 'Hari Raya Idul Fitri 1448 H (Hari 2)', type: 'national', year: 2027 },
  { date: '2027-03-26', name: 'Wafat Yesus Kristus (Jumat Agung)', type: 'national', year: 2027 },
  { date: '2027-03-28', name: 'Hari Kebangkitan Yesus Kristus (Paskah)', type: 'national', year: 2027 },
  { date: '2027-05-01', name: 'Hari Buruh Internasional', type: 'national', year: 2027 },
  { date: '2027-05-06', name: 'Kenaikan Yesus Kristus', type: 'national', year: 2027 },
  { date: '2027-05-16', name: 'Hari Raya Idul Adha 1448 H', type: 'national', year: 2027 },
  { date: '2027-05-20', name: 'Hari Raya Waisak 2571 BE', type: 'national', year: 2027 },
  { date: '2027-06-01', name: 'Hari Lahir Pancasila', type: 'national', year: 2027 },
  { date: '2027-06-06', name: 'Tahun Baru Islam 1449 H', type: 'national', year: 2027 },
  { date: '2027-08-15', name: 'Maulid Nabi Muhammad SAW', type: 'national', year: 2027 },
  { date: '2027-08-17', name: 'Hari Proklamasi Kemerdekaan RI ke-82', type: 'national', year: 2027 },
  { date: '2027-12-25', name: 'Hari Raya Natal', type: 'national', year: 2027 },
];

async function run() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    for (const h of holidays) {
      const res = await client.query(
        `INSERT INTO hrm_national_holidays (holiday_date, holiday_name, holiday_type, year)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (holiday_date) DO UPDATE SET holiday_name = EXCLUDED.holiday_name
         RETURNING id`,
        [h.date, h.name, h.type, h.year]
      );
      if (res.rows.length > 0) inserted++;
    }
    console.log(`[Seed Holidays] Successfully upserted ${inserted} national holidays for 2025, 2026, and 2027.`);
  } catch (err) {
    console.error('[Seed Holidays] Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();
