/**
 * Query Constants for Supabase Queries
 * Explicit column definitions to reduce PostgREST egress
 * 
 * RULES:
 * 1. Always use explicit columns instead of select('*')
 * 2. Avoid text/jsonb columns in list views
 * 3. Include only columns needed for the specific use case
 */

// ===========================================
// PROFILES TABLE
// ===========================================
export const PROFILE_LIST_COLUMNS = 'id, name, email, status, avatar_url' as const;
export const PROFILE_DETAIL_COLUMNS = 'id, name, email, status, avatar_url, phone, created_at, updated_at' as const;
export const PROFILE_MINIMAL_COLUMNS = 'id, name' as const;
export const PROFILE_AUTH_COLUMNS = 'id, name, email, avatar_url' as const;

// ===========================================
// USER_ROLES TABLE
// ===========================================
export const USER_ROLES_COLUMNS = 'user_id, role' as const;

// ===========================================
// SANTRI TABLE
// ===========================================
export const SANTRI_LIST_COLUMNS = 'id, kelas_id, nis, birth_date' as const;
export const SANTRI_DETAIL_COLUMNS = 'id, kelas_id, nis, nisn, birth_date, address, blood_type, height, weight, previous_school, child_order, medical_history, allergy_history, social_type, peer_reaction, photo_url' as const;
export const SANTRI_MINIMAL_COLUMNS = 'id, kelas_id' as const;

// ===========================================
// STAFF TABLE
// ===========================================
export const STAFF_LIST_COLUMNS = 'id, kelas_id, employee_id' as const;
export const STAFF_DETAIL_COLUMNS = 'id, kelas_id, employee_id, created_at, updated_at' as const;

// ===========================================
// ORANGTUA TABLE
// ===========================================
export const ORANGTUA_LIST_COLUMNS = 'id, relationship' as const;
export const ORANGTUA_DETAIL_COLUMNS = 'id, relationship, occupation, notes, created_at, updated_at' as const;

// ===========================================
// PARENT_CHILDREN TABLE
// ===========================================
export const PARENT_CHILDREN_COLUMNS = 'id, parent_id, child_id' as const;

// ===========================================
// KELAS TABLE
// ===========================================
export const KELAS_LIST_COLUMNS = 'id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id' as const;
export const KELAS_DETAIL_COLUMNS = 'id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id, created_at, updated_at' as const;
export const KELAS_MINIMAL_COLUMNS = 'id, nama, tingkat' as const;

// ===========================================
// MAPEL TABLE
// ===========================================
export const MAPEL_LIST_COLUMNS = 'id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, kkm' as const;
export const MAPEL_DETAIL_COLUMNS = 'id, nama, kode_mapel, kategori, status, kelas_id, pengampu_id, kkm, deskripsi, created_at, updated_at' as const;
export const MAPEL_MINIMAL_COLUMNS = 'id, nama, kode_mapel' as const;

// ===========================================
// MATERI TABLE (avoid deskripsi in list)
// ===========================================
export const MATERI_LIST_COLUMNS = 'id, judul, mapel_id, semester, status, tipe_konten, urutan, created_at, tujuan_pembelajaran_ids' as const;
export const MATERI_DETAIL_COLUMNS = 'id, judul, mapel_id, semester, status, tipe_konten, urutan, konten, deskripsi, created_at, updated_at, created_by, tujuan_pembelajaran_ids' as const;

// ===========================================
// TUGAS TABLE (avoid deskripsi in list)
// ===========================================
export const TUGAS_LIST_COLUMNS = 'id, judul, mapel_id, tipe, tanggal_deadline, status, created_at' as const;
export const TUGAS_DETAIL_COLUMNS = 'id, judul, mapel_id, tipe, tanggal_deadline, status, deskripsi, file_url, allow_late_submission, created_at, updated_at, created_by' as const;

// ===========================================
// PENGUMPULAN_TUGAS TABLE
// ===========================================
export const PENGUMPULAN_LIST_COLUMNS = 'id, tugas_id, santri_id, status, tanggal_submit, nilai' as const;
export const PENGUMPULAN_DETAIL_COLUMNS = 'id, tugas_id, santri_id, status, tanggal_submit, nilai, file_url, jawaban_teks, catatan_nilai, created_at, updated_at' as const;

// ===========================================
// JADWAL TABLE
// ===========================================
export const JADWAL_LIST_COLUMNS = 'id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, pengampu_id, semester, status, block_id, kategori, tipe, ruangan, label' as const;
export const JADWAL_MINIMAL_COLUMNS = 'id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id' as const;

// ===========================================
// SESI_PEMBELAJARAN TABLE
// ===========================================
export const SESI_LIST_COLUMNS = 'id, jadwal_id, tanggal, jam_mulai, jam_selesai, status, pengampu_id' as const;
export const SESI_DETAIL_COLUMNS = 'id, jadwal_id, tanggal, jam_mulai, jam_selesai, status, pengampu_id, catatan, materi_url, created_at' as const;

// ===========================================
// KEHADIRAN_SANTRI TABLE
// ===========================================
export const KEHADIRAN_SANTRI_COLUMNS = 'id, sesi_id, santri_id, status, created_at' as const;

// ===========================================
// KEHADIRAN_STAFF TABLE
// ===========================================
export const KEHADIRAN_STAFF_LIST_COLUMNS = 'id, staff_id, tanggal, jam_masuk, jam_pulang, status' as const;
export const KEHADIRAN_STAFF_DETAIL_COLUMNS = 'id, staff_id, tanggal, jam_masuk, jam_pulang, status, latitude_masuk, longitude_masuk, latitude_pulang, longitude_pulang, status_lokasi_masuk, status_lokasi_pulang, foto_masuk_url, foto_pulang_url' as const;

// ===========================================
// KALENDER_EVENTS TABLE
// ===========================================
export const KALENDER_EVENTS_LIST_COLUMNS = 'id, judul, tanggal_mulai, tanggal_selesai, kategori_id, status, is_recurring, recurrence_type, recurrence_end_date, academic_year_id' as const;
export const KALENDER_EVENTS_DETAIL_COLUMNS = 'id, judul, deskripsi, tanggal_mulai, tanggal_selesai, kategori_id, status, is_recurring, recurrence_type, recurrence_end_date, academic_year_id, pic_id, document_url, document_name, created_by, created_at' as const;

// ===========================================
// KALENDER_KATEGORI TABLE
// ===========================================
export const KALENDER_KATEGORI_COLUMNS = 'id, nama, warna, deskripsi' as const;

// ===========================================
// ACADEMIC_YEARS TABLE
// ===========================================
export const ACADEMIC_YEARS_LIST_COLUMNS = 'id, name, is_active, odd_semester_start, odd_semester_end, even_semester_start, even_semester_end, odd_semester_model, even_semester_model' as const;
export const ACADEMIC_YEARS_MINIMAL_COLUMNS = 'id, name, is_active' as const;

// ===========================================
// NOTIFICATIONS TABLE
// ===========================================
export const NOTIFICATIONS_LIST_COLUMNS = 'id, user_id, title, message, is_read, created_at' as const;

// ===========================================
// LEARNING_BLOCKS TABLE
// ===========================================
export const LEARNING_BLOCKS_COLUMNS = 'id, academic_year_id, semester, fase, start_date, end_date, selected_dates' as const;

// ===========================================
// ASESMEN_FORMATIF TABLE
// ===========================================
export const ASESMEN_FORMATIF_LIST_COLUMNS = 'id, mapel_id, santri_id, semester, tp_assessments' as const;
export const ASESMEN_FORMATIF_DETAIL_COLUMNS = 'id, mapel_id, santri_id, semester, tp_assessments, deskripsi_tertinggi, deskripsi_terendah, created_at, updated_at' as const;

// ===========================================
// ASESMEN_SUMATIF TABLE
// ===========================================
export const ASESMEN_SUMATIF_LIST_COLUMNS = 'id, mapel_id, santri_id, semester, na_lingkup, na_semester, nilai_rapor, is_finalized' as const;
export const ASESMEN_SUMATIF_DETAIL_COLUMNS = 'id, mapel_id, santri_id, semester, sumatif, non_tes, tes, na_lingkup, na_semester, nilai_rapor, is_finalized, finalized_at, finalized_by, created_at, updated_at' as const;

// ===========================================
// KONSELING_RECORDS TABLE
// ===========================================
export const KONSELING_RECORDS_LIST_COLUMNS = 'id, santri_id, tanggal, tipe, kategori, poin, semester' as const;
export const KONSELING_RECORDS_DETAIL_COLUMNS = 'id, santri_id, tanggal, tipe, kategori, kategori_id, poin, semester, deskripsi, recorded_by, academic_year_id, created_at, updated_at' as const;

// ===========================================
// LOKASI_ABSEN TABLE
// ===========================================
export const LOKASI_ABSEN_COLUMNS = 'id, nama, alamat, latitude, longitude, radius' as const;

// ===========================================
// MAPEL_INFO TABLE
// ===========================================
export const MAPEL_INFO_COLUMNS = 'id, mapel_id, capaian_pembelajaran, tujuan_pembelajaran, created_at, updated_at' as const;

// ===========================================
// MASTER_MAPEL TABLE
// ===========================================
export const MASTER_MAPEL_LIST_COLUMNS = 'id, nama, kategori' as const;
export const MASTER_MAPEL_DETAIL_COLUMNS = 'id, nama, kategori, deskripsi, created_at, updated_at' as const;

// ===========================================
// BANNERS TABLE
// ===========================================
export const BANNERS_LIST_COLUMNS = 'id, judul, status, tanggal_mulai, tanggal_berakhir, target_audience, gambar_url' as const;
export const BANNERS_DETAIL_COLUMNS = 'id, judul, deskripsi, status, tanggal_mulai, tanggal_berakhir, target_audience, gambar_url, tautan_aksi, created_by, created_at, updated_at' as const;

// ===========================================
// DEFAULT LIMITS
// ===========================================
export const DEFAULT_LIST_LIMIT = 50;
export const DEFAULT_DASHBOARD_LIMIT = 10;
export const DEFAULT_DROPDOWN_LIMIT = 100;
export const DEFAULT_PAGINATION_LIMIT = 20;

// ===========================================
// INFINITE SCROLL PAGINATION
// ===========================================
export const INFINITE_SCROLL_PAGE_SIZE = 10;
