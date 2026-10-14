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

// Master Data 55 Karyawan Riil dari Lampiran User (No. 1 s/d 55)
const masterEmployees = [
  // --- HALAMAN 1 (No 1 s/d 11) ---
  { no: 1, nip: 'FR07001', name: 'Hasri. S', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 2, nip: 'FR07002', name: 'Riza Usalli, SE', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 3, nip: 'FR07003', name: 'Musliadi', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 4, nip: 'FR07004', name: 'Muliana', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 5, nip: 'FR07005', name: 'Arianti', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 6, nip: 'FR07006', name: 'M. Sulpan A', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 7, nip: 'FR07007', name: 'Misran', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 8, nip: 'FR07008', name: 'Hasrul. J', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 9, nip: 'FR07009', name: 'Eri Subara', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 10, nip: 'FR07010', name: 'Irfan Ibrahim', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 11, nip: 'FR07011', name: 'Irman', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06, severance: 'tabungan' },

  // --- HALAMAN 2 (No 12 s/d 22) ---
  { no: 12, nip: 'FR07012', name: 'Reza Syahputra', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 13, nip: 'FR07013', name: 'Irnawati', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 14, nip: 'FR07014', name: 'Harlina', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 15, nip: 'FR07015', name: 'Muh. Aksa', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA MAKASSAR', shiftPattern: 'DAYSIFT', salary: 4181940, otRate: 24173.06, severance: 'tabungan' },
  { no: 16, nip: 'FR07016', name: 'Ita Purnamasari', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 17, nip: 'FR07017', name: 'Serianti', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 18, nip: 'FR07018', name: 'Hasraty Thalib', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 19, nip: 'FR07019', name: 'Hasriani', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 20, nip: 'FR07020', name: 'Sitti Rahmah', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 21, nip: 'FR07021', name: 'Arnilam Tsyania', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 22, nip: 'FR07022', name: 'Bonang', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },

  // --- HALAMAN 3 (No 23 s/d 33) ---
  { no: 23, nip: 'FR07023', name: 'Haidir', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 24, nip: 'FR07024', name: 'Achmad Hariyono', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 25, nip: 'FR07025', name: 'Kamaruddin', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 26, nip: 'FR07026', name: 'Sofyan', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06, severance: 'tabungan' },
  { no: 27, nip: 'FR07027', name: 'Rusli', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06, severance: 'tabungan' },
  { no: 28, nip: 'FR07028', name: 'Nur Afiah Ali', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'DAYSIFT', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 29, nip: 'FR07029', name: 'Ishaq Zulkarnain', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 30, nip: 'FR07030', name: 'Muh. Yusuf', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 31, nip: 'FR07031', name: 'Dahrial', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },
  { no: 32, nip: 'FR07032', name: 'Risdianto', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA MAKASSAR', shiftPattern: 'SHIFT 2/1/3', salary: 4181940, otRate: 24173.06, severance: 'tabungan' },
  { no: 33, nip: 'FR07033', name: 'Ishak HN', dept: 'Dept. of Human Capital & General', job: 'Staff of Sec. of Household', area: 'WISMA BIRING ERE', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'tabungan' },

  // --- HALAMAN 4 (No 34 s/d 44) ---
  { no: 34, nip: 'FR07034', name: 'Yusran Idris', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 35, nip: 'FR07035', name: 'Armin Amir', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 36, nip: 'FR07036', name: 'Afdal Amal Hidayat', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 37, nip: 'FR07037', name: 'Daniel Rantika', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 38, nip: 'FR07038', name: 'Muhammad Dahlan Caddi', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 39, nip: 'FR07039', name: 'Muh. Nawir', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 40, nip: 'FR07040', name: 'Suhardi', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 41, nip: 'FR07041', name: 'Sahrul', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 42, nip: 'FR07042', name: 'M. Reza Angga Dwi S', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'MATCHING BONTOA', shiftPattern: 'DAYSIFT', salary: 4148050, otRate: 23977.17, severance: 'cash_with_salary' },
  { no: 43, nip: 'FR07043', name: 'A. Firri Makkaraka', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 44, nip: 'FR07044', name: 'Ichtiar', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'KANTOR PUSAT SEMEN TONASA', shiftPattern: 'DAYSIFT', salary: 4148050, otRate: 23977.17, severance: 'cash_with_salary' },

  // --- HALAMAN 5 (No 45 s/d 55) ---
  { no: 45, nip: 'FR07045', name: 'Rudini Hanupe', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 46, nip: 'FR07046', name: 'Rusdi Aryanto', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'MATCHING BONTOA', shiftPattern: 'DAYSIFT', salary: 4148050, otRate: 23977.17, severance: 'cash_with_salary' },
  { no: 47, nip: 'FR07047', name: 'Tedi Harianto', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 48, nip: 'FR07048', name: 'Lukman. K', dept: 'Dept. of Distribution Management', job: 'Tech of Shipment Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 49, nip: 'FR07049', name: 'Ardi Rizal', dept: 'Dept. of Distribution Management', job: 'Tech of Shipment Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 50, nip: 'FR07050', name: 'Arwan', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 51, nip: 'FR07051', name: 'Muh Yunus', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 52, nip: 'FR07052', name: 'Zulkifli Syafruddin', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 53, nip: 'FR07053', name: 'Fakrul Islam', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 54, nip: 'FR07054', name: 'Ruslan', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 4/5', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' },
  { no: 55, nip: 'FR07055', name: 'Ramli', dept: 'Dept. of Distribution Management', job: 'Tech of Inventory Management 2', area: 'TIMBANGAN 2/3', shiftPattern: 'SHIFT 2/1/3', salary: 4045050, otRate: 23381.79, severance: 'cash_with_salary' }
];

// Master Geofence Pos Koordinat Resmi Sesuai Area Kerja
const AREA_COORDINATES = {
  'KANTOR PUSAT SEMEN TONASA': {
    code: 'KP-TONASA',
    name: 'Kantor Pusat Semen Tonasa',
    lat: -4.800089,
    lon: 119.608477,
    radius: 250,
    desc: 'Area Kantor Pusat PT Semen Tonasa Bontoa'
  },
  'WISMA BIRING ERE': {
    code: 'WISMA-BIRINGERE',
    name: 'Wisma Biring Ere',
    lat: -4.792870,
    lon: 119.608797,
    radius: 250,
    desc: 'Area Wisma Biring Ere PT FRP / Semen Tonasa'
  },
  'WISMA MAKASSAR': {
    code: 'WISMA-MKS',
    name: 'Wisma Makassar',
    lat: -5.147700,
    lon: 119.432700,
    radius: 250,
    desc: 'Area Wisma & Kantor Perwakilan Makassar'
  },
  'TIMBANGAN 2/3': {
    code: 'TIMB-23',
    name: 'Timbangan 2/3',
    lat: -4.783865,
    lon: 119.615338,
    radius: 100,
    desc: 'Pos Timbangan 2 & 3 Operasional Tonasa'
  },
  'TIMBANGAN 4/5': {
    code: 'TIMB-45',
    name: 'Timbangan 4/5',
    lat: -4.789738,
    lon: 119.612870,
    radius: 100,
    desc: 'Pos Timbangan 4 & 5 Operasional Tonasa'
  },
  'MATCHING BONTOA': {
    code: 'MATCH-BONTOA',
    name: 'Matching Bontoa',
    lat: -4.802450,
    lon: 119.598640,
    radius: 250,
    desc: 'Area Matching Plant Bontoa'
  }
};

async function syncAll() {
  const client = await pool.connect();
  try {
    console.log('🚀 Memulai Sinkronisasi 55 Karyawan ke Database & Sistem...');
    await client.query('BEGIN');

    // 1. Ambil Divisi Map
    const divRes = await client.query('SELECT id, name FROM hrm_divisions');
    const divMap = {};
    for (const d of divRes.rows) {
      divMap[d.name] = d.id;
    }

    // 2. Ambil Shift Map
    const shiftRes = await client.query('SELECT id, name FROM hrm_shifts');
    let dayShiftId = null;
    let shift1Id = null;
    for (const s of shiftRes.rows) {
      if (s.name.toLowerCase().includes('day shift')) dayShiftId = s.id;
      if (s.name.includes('Shift I (') || s.name.startsWith('Shift I ')) shift1Id = s.id;
    }

    if (!dayShiftId || !shift1Id) {
      throw new Error('Shift ID tidak ditemukan di database.');
    }

    console.log(`ℹ️ Day Shift ID: ${dayShiftId}`);
    console.log(`ℹ️ Shift I (Pola 2/1/3) ID: ${shift1Id}`);

    let updatedProfiles = 0;
    let updatedSalaries = 0;
    let updatedPosts = 0;

    for (const emp of masterEmployees) {
      const divId = divMap[emp.dept] || divMap['Dept. of Human Capital & General'];
      const targetShiftId = (emp.shiftPattern === 'DAYSIFT') ? dayShiftId : shift1Id;
      const areaGeo = AREA_COORDINATES[emp.area] || AREA_COORDINATES['KANTOR PUSAT SEMEN TONASA'];

      // Pos penugasan JSONB untuk allowed_posts
      const allowedPostObj = [{
        code: areaGeo.code,
        name: areaGeo.name,
        latitude: areaGeo.lat,
        longitude: areaGeo.lon,
        radiusMeters: areaGeo.radius,
        description: areaGeo.desc,
        allowClockIn: true,
        allowClockOut: true,
        isClockOutOnly: false
      }];

      // A. Update Profile Karyawan (Pertahankan face_embedding, password, dsb)
      const updateProfQ = `
        UPDATE hrm_profiles SET
          full_name = $1,
          division_id = $2,
          division_name = $3,
          job_title = $4,
          placement_location = $5,
          shift_id = $6,
          assigned_location_name = $7,
          assigned_latitude = $8,
          assigned_longitude = $9,
          assigned_radius_meters = $10,
          allowed_posts = $11::jsonb,
          employee_sequence_no = $12,
          updated_at = NOW()
        WHERE nip = $13
        RETURNING id;
      `;

      let pRes = await client.query(updateProfQ, [
        emp.name,
        divId,
        emp.dept,
        emp.job,
        emp.area,
        targetShiftId,
        areaGeo.name,
        areaGeo.lat,
        areaGeo.lon,
        areaGeo.radius,
        JSON.stringify(allowedPostObj),
        emp.no,
        emp.nip
      ]);

      let userId;
      if (pRes.rows.length === 0) {
        // Jika belum ada, lakukan INSERT
        const insertProfQ = `
          INSERT INTO hrm_profiles (
            id, nip, full_name, email, division_id, division_name, job_title,
            placement_location, shift_id, assigned_location_name, assigned_latitude,
            assigned_longitude, assigned_radius_meters, allowed_posts, employee_sequence_no,
            role_name, is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13::jsonb, $14,
            'Karyawan', true, NOW(), NOW()
          ) RETURNING id;
        `;
        const email = `${emp.nip.toLowerCase()}@fawwazreski.co.id`;
        const insRes = await client.query(insertProfQ, [
          emp.nip, emp.name, email, divId, emp.dept, emp.job,
          emp.area, targetShiftId, areaGeo.name, areaGeo.lat,
          areaGeo.lon, areaGeo.radius, JSON.stringify(allowedPostObj), emp.no
        ]);
        userId = insRes.rows[0].id;
      } else {
        userId = pRes.rows[0].id;
      }
      updatedProfiles++;

      // B. Upsert Salary Profile
      const upsertSalaryQ = `
        INSERT INTO hrm_payroll_salary_profiles (
          user_id, base_salary, hourly_overtime_rate, severance_scheme,
          employee_sequence_no, bank_name, bank_account_number, bank_account_holder, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'Bank Mandiri / BCA', $6, $7, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          base_salary = EXCLUDED.base_salary,
          hourly_overtime_rate = EXCLUDED.hourly_overtime_rate,
          severance_scheme = EXCLUDED.severance_scheme,
          employee_sequence_no = EXCLUDED.employee_sequence_no,
          bank_account_holder = EXCLUDED.bank_account_holder,
          updated_at = NOW();
      `;

      await client.query(upsertSalaryQ, [
        userId,
        emp.salary,
        emp.otRate,
        emp.severance,
        emp.no,
        emp.nip,
        emp.name
      ]);
      updatedSalaries++;

      // C. Sinkronkan Titik Bank Pos Multi-Titik (hrm_field_assigned_posts)
      // Cek apakah pos sudah ada di bank pos karyawan
      const checkPostQ = `
        SELECT id FROM hrm_field_assigned_posts 
        WHERE user_id = $1 AND post_name = $2 LIMIT 1;
      `;
      const postExists = await client.query(checkPostQ, [userId, areaGeo.name]);
      if (postExists.rows.length === 0) {
        await client.query(`
          INSERT INTO hrm_field_assigned_posts (
            user_id, post_code, post_name, latitude, longitude, radius_meters, description, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true);
        `, [
          userId,
          areaGeo.code,
          areaGeo.name,
          areaGeo.lat,
          areaGeo.lon,
          areaGeo.radius,
          areaGeo.desc
        ]);
        updatedPosts++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ SUKSES! Berhasil menyinkronkan:`);
    console.log(`   - ${updatedProfiles} Data Profil Karyawan (NIP FR07001 - FR07055)`);
    console.log(`   - ${updatedSalaries} Data Gaji Pokok & Tarif Lembur Resmi`);
    console.log(`   - ${updatedPosts} Titik Pos Geofence Ditambahkan ke Bank Pos`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal sinkronisasi:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

syncAll();
