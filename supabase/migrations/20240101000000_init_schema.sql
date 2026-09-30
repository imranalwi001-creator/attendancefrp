create extension if not exists pgcrypto;

do $$ begin create type public."user_status" as enum ('aktif', 'nonaktif', 'cuti', 'alumni'); exception when duplicate_object then null; end $$;
do $$ begin create type public."forum_post_type" as enum ('announcement', 'qna', 'resource'); exception when duplicate_object then null; end $$;
do $$ begin create type public."app_role" as enum ('admin', 'guru', 'walikelas', 'santri', 'orangtua', 'Pembina', 'staff', 'guru_ekskul'); exception when duplicate_object then null; end $$;
do $$ begin create type public."status_izin" as enum ('pending', 'approved', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public."jenis_izin" as enum ('sakit', 'izin', 'cuti', 'dinas_luar', 'lainnya'); exception when duplicate_object then null; end $$;
do $$ begin create type public."mapel_status" as enum ('aktif', 'nonaktif'); exception when duplicate_object then null; end $$;
do $$ begin create type public."mapel_kategori" as enum ('wajib', 'pilihan', 'ekstrakurikuler', 'asrama'); exception when duplicate_object then null; end $$;

create table if not exists public."academic_years" (
  "created_at" timestamptz default now() not null,
  "even_semester_end" date not null,
  "even_semester_model" text default 'normal' not null,
  "even_semester_start" date not null,
  "id" uuid default gen_random_uuid() not null,
  "is_active" boolean not null,
  "name" text not null,
  "odd_semester_end" date not null,
  "odd_semester_model" text default 'normal' not null,
  "odd_semester_start" date not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."activity_logs" (
  "action" text not null,
  "category" text not null,
  "created_at" timestamptz default now() not null,
  "description" text not null,
  "id" uuid default gen_random_uuid() not null,
  "metadata" jsonb,
  "user_id" uuid not null,
  "user_name" text not null,
  "user_role" text not null,
  primary key ("id")
);

create table if not exists public."affective_categories" (
  "color" text,
  "created_at" timestamptz default now(),
  "description" text,
  "icon" text,
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "order_index" integer,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."affective_finalization" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean not null,
  "kelas_id" uuid not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."affective_indicators" (
  "category_id" uuid not null,
  "created_at" timestamptz default now(),
  "description" text,
  "id" uuid default gen_random_uuid() not null,
  "is_active" boolean,
  "name" text not null,
  "order_index" integer,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."affective_scores" (
  "academic_year_id" uuid not null,
  "assessed_by" uuid,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "indicator_id" uuid not null,
  "notes" text,
  "santri_id" uuid not null,
  "score" integer not null,
  "semester" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."asesmen_formatif" (
  "created_at" timestamptz default now(),
  "deskripsi_terendah" text,
  "deskripsi_tertinggi" text,
  "id" uuid default gen_random_uuid() not null,
  "mapel_id" uuid not null,
  "santri_id" uuid not null,
  "semester" text not null,
  "tp_assessments" jsonb not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."asesmen_sumatif" (
  "created_at" timestamptz default now(),
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean,
  "mapel_id" uuid not null,
  "na_lingkup" integer,
  "na_semester" integer,
  "nilai_rapor" integer,
  "non_tes" integer,
  "santri_id" uuid not null,
  "semester" text not null,
  "sumatif" jsonb not null,
  "tes" integer,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."aturan_waktu_kerja" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "jabatan" text not null,
  "toleransi_terlambat" integer not null,
  "updated_at" timestamptz default now() not null,
  "waktu_masuk" text not null,
  "waktu_pulang" text not null,
  primary key ("id")
);

create table if not exists public."bahan_belajar" (
  "created_at" timestamptz default now() not null,
  "created_by" uuid,
  "deskripsi" text,
  "drive_url" text not null,
  "embed_url" text not null,
  "file_id" uuid not null,
  "file_type" text not null,
  "id" uuid default gen_random_uuid() not null,
  "judul" text not null,
  "kategori" text,
  "kelas_id" uuid,
  "mapel_id" uuid,
  "sampul_url" text,
  "status" text not null,
  "updated_at" timestamptz default now() not null,
  "urutan" integer,
  primary key ("id")
);

create table if not exists public."bank_soal" (
  "bobot" integer not null,
  "cp_ringkasan" text,
  "created_at" timestamptz default now() not null,
  "created_by" uuid,
  "gambar_opsi_a" text,
  "gambar_opsi_b" text,
  "gambar_opsi_c" text,
  "gambar_opsi_d" text,
  "gambar_opsi_e" text,
  "gambar_pembahasan" text,
  "gambar_pertanyaan" text,
  "id" uuid default gen_random_uuid() not null,
  "jenis_soal" text not null,
  "kelas" text not null,
  "kunci_jawaban" text not null,
  "level_kognitif" text,
  "mata_pelajaran" text not null,
  "materi" text,
  "opsi_a" text,
  "opsi_b" text,
  "opsi_c" text,
  "opsi_d" text,
  "opsi_e" text,
  "pembahasan" text,
  "pertanyaan" text not null,
  "tp_list" text,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."banners" (
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "deskripsi" text,
  "gambar_url" text,
  "id" uuid default gen_random_uuid() not null,
  "is_permanent" boolean,
  "judul" text not null,
  "status" text not null,
  "tanggal_berakhir" text not null,
  "tanggal_mulai" text not null,
  "target_audience" text not null,
  "tautan_aksi" text,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."buku" (
  "cover_url" text,
  "created_at" timestamptz default now() not null,
  "created_by" uuid,
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "isbn" text,
  "judul" text not null,
  "kategori" text,
  "kode_buku" text not null,
  "lokasi_rak" text,
  "penerbit" text,
  "penulis" text,
  "status" text not null,
  "tahun_terbit" integer,
  "tersedia" integer not null,
  "total_eksemplar" integer not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."buku_kategori" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "nama" text not null,
  "updated_at" timestamptz default now() not null,
  "warna" text not null,
  primary key ("id")
);

create table if not exists public."cambridge_documents" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "document_name" text,
  "document_url" text,
  "id" uuid default gen_random_uuid() not null,
  "kelas_id" uuid not null,
  "santri_id" uuid not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  "uploaded_at" timestamptz,
  "uploaded_by" uuid,
  primary key ("id")
);

create table if not exists public."cambridge_finalization" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean not null,
  "kelas_id" uuid not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."guru_pengganti" (
  "alasan" text,
  "created_at" timestamptz default now(),
  "guru_asli_id" uuid not null,
  "guru_pengganti_id" uuid not null,
  "id" uuid default gen_random_uuid() not null,
  "jadwal_id" uuid,
  "status" text,
  "tanggal" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."hafalan_finalization" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."jadwal" (
  "block_id" uuid,
  "created_at" timestamptz default now(),
  "hari" text not null,
  "id" uuid default gen_random_uuid() not null,
  "jam_mulai" text not null,
  "jam_selesai" text not null,
  "kategori" text not null,
  "kelas_id" uuid not null,
  "label" text,
  "mapel_id" uuid,
  "pengampu_id" uuid,
  "ruangan" text,
  "semester" text not null,
  "status" text not null,
  "tipe" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."kalender_events" (
  "academic_year_id" uuid,
  "created_at" timestamptz default now() not null,
  "created_by" uuid,
  "deskripsi" text,
  "document_name" text,
  "document_url" text,
  "id" uuid default gen_random_uuid() not null,
  "is_recurring" boolean not null,
  "judul" text not null,
  "kategori_id" uuid,
  "pic_id" uuid,
  "recurrence_end_date" text,
  "recurrence_type" text,
  "status" text not null,
  "tanggal_mulai" text not null,
  "tanggal_selesai" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."kalender_kategori" (
  "created_at" timestamptz default now() not null,
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "nama" text not null,
  "updated_at" timestamptz default now() not null,
  "warna" text not null,
  primary key ("id")
);

create table if not exists public."kehadiran_santri" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "santri_id" uuid not null,
  "sesi_id" uuid,
  "status" text not null,
  primary key ("id")
);

create table if not exists public."kehadiran_staff" (
  "created_at" timestamptz default now(),
  "foto_masuk_url" text,
  "foto_pulang_url" text,
  "id" uuid default gen_random_uuid() not null,
  "jam_masuk" text,
  "jam_pulang" text,
  "latitude_masuk" integer,
  "latitude_pulang" integer,
  "longitude_masuk" integer,
  "longitude_pulang" integer,
  "staff_id" uuid not null,
  "status" text,
  "status_lokasi_masuk" text,
  "status_lokasi_pulang" text,
  "tanggal" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."kelas" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "jumlah_santri" integer,
  "nama" text not null,
  "status" public."user_status",
  "tahun_ajaran" text not null,
  "tingkat" text not null,
  "updated_at" timestamptz default now(),
  "walikelas_id" uuid,
  primary key ("id")
);

create table if not exists public."konseling_kategori" (
  "created_at" timestamptz default now(),
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "nama" text not null,
  "poin" integer not null,
  "status" text not null,
  "tipe" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."konseling_records" (
  "academic_year_id" uuid,
  "created_at" timestamptz default now(),
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "kategori" text not null,
  "kategori_id" uuid,
  "poin" integer not null,
  "recorded_by" uuid,
  "santri_id" uuid not null,
  "semester" text not null,
  "tanggal" text not null,
  "tipe" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."learning_blocks" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "end_date" text not null,
  "fase" integer not null,
  "id" uuid default gen_random_uuid() not null,
  "selected_dates" text,
  "semester" text not null,
  "start_date" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."liburan_activities" (
  "category" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "target_daily" integer not null,
  "title" text not null,
  primary key ("id")
);

create table if not exists public."liburan_config" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "is_active" boolean not null,
  "nama" text not null,
  "tanggal_mulai" text not null,
  "tanggal_selesai" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."liburan_daily_logs" (
  "activity_id" uuid not null,
  "date" text not null,
  "day_number" integer,
  "excuse_reason" text,
  "id" uuid default gen_random_uuid() not null,
  "is_completed" boolean not null,
  "santri_id" uuid not null,
  "timestamp" text not null,
  primary key ("id")
);

create table if not exists public."liburan_mood" (
  "created_at" timestamptz default now() not null,
  "date" text not null,
  "id" uuid default gen_random_uuid() not null,
  "mood" text not null,
  "santri_id" uuid not null,
  primary key ("id")
);

create table if not exists public."lokasi_absen" (
  "alamat" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "latitude" integer not null,
  "longitude" integer not null,
  "nama" text not null,
  "radius" integer not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."mapel" (
  "created_at" timestamptz default now(),
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "kategori" public."mapel_kategori",
  "kelas_id" uuid not null,
  "kkm" integer,
  "kode_mapel" text,
  "nama" text not null,
  "pengampu_id" uuid not null,
  "status" public."mapel_status",
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."mapel_info" (
  "capaian_pembelajaran" jsonb,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "mapel_id" uuid not null,
  "tujuan_pembelajaran" jsonb,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."master_mapel" (
  "created_at" timestamptz default now(),
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "kategori" public."mapel_kategori" not null,
  "nama" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."materi" (
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "judul" text not null,
  "konten" text not null,
  "mapel_id" uuid not null,
  "semester" text not null,
  "status" text,
  "tipe_konten" text not null,
  "tujuan_pembelajaran_ids" integer,
  "updated_at" timestamptz default now(),
  "urutan" integer,
  primary key ("id")
);

create table if not exists public."materi_reads" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "materi_id" uuid not null,
  "santri_id" uuid not null,
  primary key ("id")
);

create table if not exists public."metode_pembayaran" (
  "atas_nama" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "is_active" boolean not null,
  "nama_bank" text not null,
  "nomor_rekening" text not null,
  "petunjuk" text,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."notifications" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "is_read" boolean not null,
  "message" text not null,
  "title" text not null,
  "user_id" uuid not null,
  primary key ("id")
);

create table if not exists public."orangtua" (
  "created_at" timestamptz default now(),
  "id" uuid not null,
  "notes" text,
  "occupation" text,
  "relationship" text,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."parent_children" (
  "child_id" uuid not null,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "parent_id" uuid not null,
  primary key ("id")
);

create table if not exists public."pembayaran" (
  "bukti_url" text not null,
  "catatan" text,
  "catatan_verifikasi" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "jumlah_bayar" integer not null,
  "metode_pembayaran_id" uuid not null,
  "status" text not null,
  "submitted_by" uuid,
  "tagihan_id" uuid not null,
  "tagihan_santri_id" uuid,
  "updated_at" timestamptz default now() not null,
  "verified_at" timestamptz,
  "verified_by" uuid,
  primary key ("id")
);

create table if not exists public."peminjaman_buku" (
  "bukti_pengembalian_url" text,
  "buku_id" uuid not null,
  "catatan" text,
  "created_at" timestamptz default now() not null,
  "denda" integer not null,
  "dikembalikan_oleh_santri" boolean,
  "id" uuid default gen_random_uuid() not null,
  "petugas_kembali_id" uuid,
  "petugas_pinjam_id" uuid,
  "santri_id" uuid not null,
  "status" text not null,
  "tanggal_jatuh_tempo" text not null,
  "tanggal_kembali" text,
  "tanggal_pinjam" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."pengajuan_izin_santri" (
  "approved_at" timestamptz,
  "approved_by" uuid,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "jenis_izin" public."jenis_izin" not null,
  "keterangan" text,
  "lampiran_url" text,
  "santri_id" uuid not null,
  "status" public."status_izin" not null,
  "tanggal_mulai" text not null,
  "tanggal_selesai" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."pengajuan_izin_staff" (
  "approved_at" timestamptz,
  "approved_by" uuid,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "jenis_izin" public."jenis_izin" not null,
  "keterangan" text,
  "lampiran_url" text,
  "staff_id" uuid not null,
  "status" public."status_izin" not null,
  "tanggal_mulai" text not null,
  "tanggal_selesai" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."pengajuan_peminjaman" (
  "alasan_penolakan" text,
  "buku_id" uuid not null,
  "catatan" text,
  "created_at" timestamptz default now() not null,
  "diproses_at" timestamptz,
  "diproses_oleh" text,
  "id" uuid default gen_random_uuid() not null,
  "santri_id" uuid not null,
  "status" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."pengumpulan_tugas" (
  "catatan_nilai" text,
  "created_at" timestamptz default now(),
  "feedback_santri" text,
  "file_url" text,
  "id" uuid default gen_random_uuid() not null,
  "jawaban_teks" text,
  "nilai" integer,
  "santri_id" uuid not null,
  "status" text,
  "tanggal_submit" text,
  "tugas_id" uuid not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."profiles" (
  "avatar_url" text,
  "created_at" timestamptz default now(),
  "email" text,
  "id" uuid not null,
  "name" text not null,
  "phone" text,
  "status" public."user_status",
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."psikologi_finalization" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean not null,
  "kelas_id" uuid not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."push_subscriptions" (
  "auth" text not null,
  "created_at" timestamptz default now(),
  "endpoint" text not null,
  "id" uuid default gen_random_uuid() not null,
  "p256dh" text not null,
  "updated_at" timestamptz default now(),
  "user_id" uuid not null,
  primary key ("id")
);

create table if not exists public."ramadhan_activities" (
  "category" text not null,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "target_daily" integer not null,
  "title" text not null,
  primary key ("id")
);

create table if not exists public."ramadhan_config" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "is_active" boolean not null,
  "tahun_hijriah" text not null,
  "tanggal_mulai" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."ramadhan_daily_logs" (
  "activity_id" uuid not null,
  "date" text not null,
  "excuse_reason" text,
  "hijri_day" integer,
  "id" uuid default gen_random_uuid() not null,
  "is_completed" boolean not null,
  "santri_id" uuid not null,
  "timestamp" text,
  primary key ("id")
);

create table if not exists public."ramadhan_mood" (
  "created_at" timestamptz default now() not null,
  "date" text not null,
  "id" uuid default gen_random_uuid() not null,
  "mood" text not null,
  "santri_id" uuid not null,
  "tilawah_surah_akhir" text,
  "tilawah_surah_awal" text,
  primary key ("id")
);

create table if not exists public."raport" (
  "catatan_guru" text,
  "catatan_ortu" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "is_published" boolean not null,
  "kelas_id" uuid not null,
  "published_at" timestamptz,
  "santri_id" uuid not null,
  "semester" text not null,
  "status" text not null,
  "tahun_ajaran" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."raport_finalization" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean not null,
  "kelas_id" uuid not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."santri" (
  "achievement_cert_url" text,
  "address" text,
  "allergy_history" text,
  "asesmen_awal_url" jsonb,
  "birth_date" text,
  "blood_type" text,
  "child_order" text,
  "created_at" timestamptz default now(),
  "family_card_url" text,
  "height" text,
  "id" uuid not null,
  "kelas_id" uuid,
  "medical_history" text,
  "nis" text,
  "nisn" text,
  "peer_reaction" text,
  "photo_url" text,
  "previous_school" text,
  "social_type" text,
  "stifin_url" text,
  "updated_at" timestamptz default now(),
  "weight" text,
  primary key ("id")
);

create table if not exists public."santri_family_children" (
  "catatan" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "kategori_potensi" text not null,
  "nama" text not null,
  "santri_id" uuid not null,
  "tanggal_lahir" text,
  "usia_perkiraan" integer,
  primary key ("id")
);

create table if not exists public."santri_family_insights" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "santri_id" uuid not null,
  "source" text not null,
  "total_anak" integer not null,
  "total_anak_potensi_smp" integer not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."santri_psikologi_reports" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "created_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "language_style" text not null,
  "santri_id" uuid not null,
  "semester" text not null,
  "summary" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."santri_psikologi_results" (
  "analisis" text,
  "created_at" timestamptz default now() not null,
  "extracted_at" timestamptz,
  "id" uuid default gen_random_uuid() not null,
  "pemeriksa" text,
  "profil_psikologis" jsonb,
  "rekomendasi" text,
  "santri_id" uuid not null,
  "source_url" text,
  "tanggal_pemeriksaan" text,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."santri_stifin_results" (
  "created_at" timestamptz default now() not null,
  "deskripsi" text,
  "extracted_at" timestamptz,
  "gaya_belajar" text,
  "id" uuid default gen_random_uuid() not null,
  "karir_cocok" text,
  "kecerdasan_dominan" text,
  "kekuatan" text,
  "kelemahan" text,
  "pemeriksa" text,
  "santri_id" uuid not null,
  "source_url" text,
  "tanggal_pemeriksaan" text,
  "tipe_stifin" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."semester_grades" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz not null,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "predikat" text,
  "rata_rata_nilai" integer,
  "semester" text not null,
  "total_belum_lancar" integer not null,
  "total_lancar" integer not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."sesi_pembelajaran" (
  "created_at" timestamptz default now(),
  "foto_guru_selesai_url" text,
  "foto_guru_url" text,
  "hari" text,
  "id" uuid default gen_random_uuid() not null,
  "jadwal_id" uuid,
  "jadwal_pengampu_id" uuid,
  "jam_mulai" text,
  "jam_selesai" text,
  "kelas_id" uuid,
  "mapel_id" uuid,
  "metadata" jsonb,
  "pengampu_id" uuid not null,
  "status" text not null,
  "tanggal" text not null,
  "updated_at" timestamptz default now(),
  "waktu_mulai" text,
  "waktu_selesai" text,
  primary key ("id")
);

create table if not exists public."setoran_hafalan" (
  "audio_type" text,
  "audio_url" text,
  "catatan" text,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "judul" text not null,
  "kategori" text not null,
  "nilai" integer,
  "pembina_external" text,
  "penguji_id" uuid not null,
  "santri_id" uuid not null,
  "semester" text,
  "status" text not null,
  "tahun_ajaran_id" uuid,
  "tanggal" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."staff" (
  "alamat" text,
  "created_at" timestamptz default now(),
  "employee_id" uuid,
  "id" uuid not null,
  "jenis_kelamin" text,
  "join_date" text,
  "kelas_id" uuid,
  "nik" text,
  "position" text,
  "tanggal_lahir" text,
  "tempat_lahir" text,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."subject_forum_comments" (
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "post_id" uuid not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null,
  primary key ("id")
);

create table if not exists public."subject_forum_posts" (
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "is_pinned" boolean not null,
  "is_solved" boolean not null,
  "materi_id" uuid,
  "post_type" public."forum_post_type" not null,
  "resource_url" text,
  "subject_id" uuid not null,
  "ujian_id" uuid,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null,
  primary key ("id")
);

create table if not exists public."tagihan" (
  "catatan_admin" text,
  "created_at" timestamptz default now() not null,
  "created_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_split" boolean not null,
  "jatuh_tempo" text not null,
  "jumlah" integer not null,
  "kelas_id" uuid,
  "nama_tagihan" text not null,
  "semester" text not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."tagihan_items" (
  "created_at" timestamptz default now() not null,
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "is_active" boolean not null,
  "kategori" text not null,
  "nama" text not null,
  "nominal" integer not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."tagihan_line_items" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "jumlah" integer not null,
  "nama" text not null,
  "tagihan_id" uuid not null,
  primary key ("id")
);

create table if not exists public."tagihan_santri" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() not null,
  "santri_id" uuid,
  "status" text not null,
  "tagihan_id" uuid not null,
  "updated_at" timestamptz default now() not null,
  primary key ("id")
);

create table if not exists public."tahfidz_finalization" (
  "academic_year_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "finalized_at" timestamptz,
  "finalized_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "is_finalized" boolean not null,
  "murojaah_avg_score" integer,
  "murojaah_total_records" integer,
  "semester" text not null,
  "tahsin_total_pages" integer,
  "tahsin_total_records" integer,
  "updated_at" timestamptz default now() not null,
  "ziyadah_total_pages" integer,
  "ziyadah_total_records" integer,
  primary key ("id")
);

create table if not exists public."tahfidz_tahsin" (
  "audio_type" text,
  "audio_url" text,
  "ayat_akhir" integer,
  "ayat_awal" integer,
  "catatan" text,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "juz" integer,
  "kelancaran" integer,
  "makhraj" integer,
  "materi_tahsin" text,
  "mode" text,
  "nilai" integer,
  "pembina_external" text,
  "penguji_id" uuid not null,
  "santri_id" uuid not null,
  "semester" text,
  "status" text not null,
  "surah" text,
  "tahun_ajaran_id" uuid,
  "tajwid" integer,
  "tanggal" text not null,
  "tipe" text not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."target_hafalan" (
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "id" uuid default gen_random_uuid() not null,
  "jenis_hafalan" text not null,
  "kategori_sumber" text not null,
  "kelas_id" uuid,
  "keterangan" text,
  "satuan" text not null,
  "semester" text not null,
  "tahun_ajaran_id" uuid,
  "target_jumlah" integer not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."teacher_mapel" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "mapel_id" uuid not null,
  "teacher_id" uuid not null,
  primary key ("id")
);

create table if not exists public."tugas" (
  "bab" text,
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "deskripsi" text,
  "id" uuid default gen_random_uuid() not null,
  "judul" text not null,
  "mapel_id" uuid not null,
  "nilai_maksimal" integer,
  "semester" text not null,
  "status" text,
  "tanggal_deadline" text not null,
  "tanggal_mulai" text not null,
  "tipe_jawaban" text,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."tujuan_pembelajaran_status" (
  "academic_year_id" uuid,
  "achieved_at" timestamptz,
  "achieved_in_sesi_id" uuid,
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "mapel_id" uuid not null,
  "semester" text not null,
  "status" text not null,
  "tp_index" integer not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."ujian" (
  "ai_grading_enabled" boolean not null,
  "created_at" timestamptz default now(),
  "durasi_menit" integer,
  "id" uuid default gen_random_uuid() not null,
  "jenis" text not null,
  "mapel_id" uuid not null,
  "pengawas_id" uuid,
  "ruangan" text,
  "status" text,
  "tanggal_pelaksanaan" text not null,
  "updated_at" timestamptz default now(),
  "waktu_mulai" text,
  primary key ("id")
);

create table if not exists public."ujian_jawaban" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "is_benar" boolean,
  "is_manual_graded" boolean,
  "is_ragu" boolean,
  "jawaban" text,
  "nilai" integer,
  "peserta_id" uuid not null,
  "soal_id" uuid not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."ujian_peserta" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "nilai_total" integer,
  "santri_id" uuid not null,
  "status_kehadiran" text,
  "ujian_id" uuid not null,
  "waktu_mulai" text,
  "waktu_selesai" text,
  primary key ("id")
);

create table if not exists public."ujian_soal" (
  "bobot_nilai" integer,
  "created_at" timestamptz default now(),
  "gambar_pembahasan" text,
  "gambar_pertanyaan" text,
  "id" uuid default gen_random_uuid() not null,
  "jenis_soal" text not null,
  "kunci_jawaban" text,
  "nomor_urut" integer not null,
  "pembahasan" text,
  "pertanyaan" text not null,
  "ujian_id" uuid not null,
  "updated_at" timestamptz default now(),
  primary key ("id")
);

create table if not exists public."ujian_soal_opsi" (
  "created_at" timestamptz default now(),
  "gambar" text,
  "id" uuid default gen_random_uuid() not null,
  "is_kunci" boolean,
  "label" text not null,
  "soal_id" uuid not null,
  "teks" text not null,
  primary key ("id")
);

create table if not exists public."user_roles" (
  "created_at" timestamptz default now(),
  "id" uuid default gen_random_uuid() not null,
  "role" public."app_role" not null,
  "user_id" uuid not null,
  primary key ("id")
);

do $$ begin alter table public."academic_years" add constraint "academic_years_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."profiles" add constraint "profiles_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kelas" add constraint "kelas_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_categories" add constraint "affective_categories_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_indicators" add constraint "affective_indicators_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri" add constraint "santri_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."mapel" add constraint "mapel_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."staff" add constraint "staff_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."jadwal" add constraint "jadwal_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."learning_blocks" add constraint "learning_blocks_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kalender_kategori" add constraint "kalender_kategori_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."sesi_pembelajaran" add constraint "sesi_pembelajaran_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."academic_years" add constraint "academic_years_name_key" unique ("name"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."konseling_kategori" add constraint "konseling_kategori_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."liburan_activities" add constraint "liburan_activities_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."materi" add constraint "materi_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."metode_pembayaran" add constraint "metode_pembayaran_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tagihan" add constraint "tagihan_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tagihan_santri" add constraint "tagihan_santri_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."buku" add constraint "buku_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tugas" add constraint "tugas_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ramadhan_activities" add constraint "ramadhan_activities_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_posts" add constraint "subject_forum_posts_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian" add constraint "ujian_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_peserta" add constraint "ujian_peserta_id_key" unique ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_soal" add constraint "ujian_soal_id_key" unique ("id"); exception when duplicate_object then null; end $$;

do $$ begin alter table public."affective_finalization" add constraint "affective_finalization_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_finalization" add constraint "affective_finalization_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_finalization" add constraint "affective_finalization_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_indicators" add constraint "affective_indicators_category_id_fkey" foreign key ("category_id") references public."affective_categories" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_scores" add constraint "affective_scores_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_scores" add constraint "affective_scores_assessed_by_fkey" foreign key ("assessed_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_scores" add constraint "affective_scores_indicator_id_fkey" foreign key ("indicator_id") references public."affective_indicators" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."affective_scores" add constraint "affective_scores_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."asesmen_formatif" add constraint "asesmen_formatif_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."asesmen_formatif" add constraint "asesmen_formatif_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."asesmen_sumatif" add constraint "asesmen_sumatif_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."asesmen_sumatif" add constraint "asesmen_sumatif_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."asesmen_sumatif" add constraint "asesmen_sumatif_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."bahan_belajar" add constraint "bahan_belajar_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."bahan_belajar" add constraint "bahan_belajar_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."bahan_belajar" add constraint "bahan_belajar_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."bank_soal" add constraint "bank_soal_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."banners" add constraint "banners_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."buku" add constraint "buku_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_documents" add constraint "cambridge_documents_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_documents" add constraint "cambridge_documents_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_documents" add constraint "cambridge_documents_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_documents" add constraint "cambridge_documents_uploaded_by_fkey" foreign key ("uploaded_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_finalization" add constraint "cambridge_finalization_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_finalization" add constraint "cambridge_finalization_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."cambridge_finalization" add constraint "cambridge_finalization_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."guru_pengganti" add constraint "guru_pengganti_guru_asli_id_fkey" foreign key ("guru_asli_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."guru_pengganti" add constraint "guru_pengganti_guru_pengganti_id_fkey" foreign key ("guru_pengganti_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."guru_pengganti" add constraint "guru_pengganti_jadwal_id_fkey" foreign key ("jadwal_id") references public."jadwal" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."hafalan_finalization" add constraint "hafalan_finalization_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."hafalan_finalization" add constraint "hafalan_finalization_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."jadwal" add constraint "jadwal_block_id_fkey" foreign key ("block_id") references public."learning_blocks" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."jadwal" add constraint "jadwal_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."jadwal" add constraint "jadwal_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."jadwal" add constraint "jadwal_pengampu_id_fkey" foreign key ("pengampu_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kalender_events" add constraint "kalender_events_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kalender_events" add constraint "kalender_events_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kalender_events" add constraint "kalender_events_kategori_id_fkey" foreign key ("kategori_id") references public."kalender_kategori" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kalender_events" add constraint "kalender_events_pic_id_fkey" foreign key ("pic_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kehadiran_santri" add constraint "kehadiran_santri_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kehadiran_santri" add constraint "kehadiran_santri_sesi_id_fkey" foreign key ("sesi_id") references public."sesi_pembelajaran" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kehadiran_staff" add constraint "kehadiran_staff_staff_id_fkey" foreign key ("staff_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kelas" add constraint "kelas_tahun_ajaran_fkey" foreign key ("tahun_ajaran") references public."academic_years" ("name"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."kelas" add constraint "kelas_walikelas_id_fkey" foreign key ("walikelas_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."konseling_records" add constraint "konseling_records_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."konseling_records" add constraint "konseling_records_kategori_id_fkey" foreign key ("kategori_id") references public."konseling_kategori" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."konseling_records" add constraint "konseling_records_recorded_by_fkey" foreign key ("recorded_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."konseling_records" add constraint "konseling_records_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."learning_blocks" add constraint "learning_blocks_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."liburan_daily_logs" add constraint "liburan_daily_logs_activity_id_fkey" foreign key ("activity_id") references public."liburan_activities" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."liburan_daily_logs" add constraint "liburan_daily_logs_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."liburan_mood" add constraint "liburan_mood_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."mapel" add constraint "mapel_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."mapel" add constraint "mapel_pengampu_id_fkey" foreign key ("pengampu_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."mapel_info" add constraint "mapel_info_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."materi" add constraint "materi_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."materi" add constraint "materi_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."materi_reads" add constraint "materi_reads_materi_id_fkey" foreign key ("materi_id") references public."materi" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."materi_reads" add constraint "materi_reads_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."orangtua" add constraint "orangtua_id_fkey" foreign key ("id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."parent_children" add constraint "parent_children_child_id_fkey" foreign key ("child_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."parent_children" add constraint "parent_children_parent_id_fkey" foreign key ("parent_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pembayaran" add constraint "pembayaran_metode_pembayaran_id_fkey" foreign key ("metode_pembayaran_id") references public."metode_pembayaran" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pembayaran" add constraint "pembayaran_tagihan_id_fkey" foreign key ("tagihan_id") references public."tagihan" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pembayaran" add constraint "pembayaran_tagihan_santri_id_fkey" foreign key ("tagihan_santri_id") references public."tagihan_santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."peminjaman_buku" add constraint "peminjaman_buku_buku_id_fkey" foreign key ("buku_id") references public."buku" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."peminjaman_buku" add constraint "peminjaman_buku_petugas_kembali_id_fkey" foreign key ("petugas_kembali_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."peminjaman_buku" add constraint "peminjaman_buku_petugas_pinjam_id_fkey" foreign key ("petugas_pinjam_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."peminjaman_buku" add constraint "peminjaman_buku_santri_id_fkey" foreign key ("santri_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengajuan_izin_santri" add constraint "pengajuan_izin_santri_approved_by_fkey" foreign key ("approved_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengajuan_izin_santri" add constraint "pengajuan_izin_santri_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengajuan_izin_staff" add constraint "pengajuan_izin_staff_approved_by_fkey" foreign key ("approved_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengajuan_izin_staff" add constraint "pengajuan_izin_staff_staff_id_fkey" foreign key ("staff_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengajuan_peminjaman" add constraint "pengajuan_peminjaman_buku_id_fkey" foreign key ("buku_id") references public."buku" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengumpulan_tugas" add constraint "pengumpulan_tugas_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."pengumpulan_tugas" add constraint "pengumpulan_tugas_tugas_id_fkey" foreign key ("tugas_id") references public."tugas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."psikologi_finalization" add constraint "psikologi_finalization_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."psikologi_finalization" add constraint "psikologi_finalization_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."psikologi_finalization" add constraint "psikologi_finalization_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ramadhan_daily_logs" add constraint "ramadhan_daily_logs_activity_id_fkey" foreign key ("activity_id") references public."ramadhan_activities" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ramadhan_daily_logs" add constraint "ramadhan_daily_logs_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."raport" add constraint "raport_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."raport" add constraint "raport_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."raport_finalization" add constraint "raport_finalization_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."raport_finalization" add constraint "raport_finalization_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."raport_finalization" add constraint "raport_finalization_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri" add constraint "santri_id_fkey" foreign key ("id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri" add constraint "santri_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_family_children" add constraint "santri_family_children_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_family_insights" add constraint "santri_family_insights_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_psikologi_reports" add constraint "santri_psikologi_reports_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_psikologi_reports" add constraint "santri_psikologi_reports_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_psikologi_reports" add constraint "santri_psikologi_reports_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_psikologi_results" add constraint "santri_psikologi_results_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."santri_stifin_results" add constraint "santri_stifin_results_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."semester_grades" add constraint "semester_grades_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."semester_grades" add constraint "semester_grades_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."sesi_pembelajaran" add constraint "sesi_pembelajaran_jadwal_id_fkey" foreign key ("jadwal_id") references public."jadwal" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."sesi_pembelajaran" add constraint "sesi_pembelajaran_jadwal_pengampu_id_fkey" foreign key ("jadwal_pengampu_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."sesi_pembelajaran" add constraint "sesi_pembelajaran_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."sesi_pembelajaran" add constraint "sesi_pembelajaran_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."sesi_pembelajaran" add constraint "sesi_pembelajaran_pengampu_id_fkey" foreign key ("pengampu_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."setoran_hafalan" add constraint "setoran_hafalan_penguji_id_fkey" foreign key ("penguji_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."setoran_hafalan" add constraint "setoran_hafalan_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."setoran_hafalan" add constraint "setoran_hafalan_tahun_ajaran_id_fkey" foreign key ("tahun_ajaran_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."staff" add constraint "staff_id_fkey" foreign key ("id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."staff" add constraint "staff_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_comments" add constraint "subject_forum_comments_post_id_fkey" foreign key ("post_id") references public."subject_forum_posts" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_comments" add constraint "subject_forum_comments_user_id_fkey" foreign key ("user_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_posts" add constraint "subject_forum_posts_materi_id_fkey" foreign key ("materi_id") references public."materi" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_posts" add constraint "subject_forum_posts_subject_id_fkey" foreign key ("subject_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_posts" add constraint "subject_forum_posts_ujian_id_fkey" foreign key ("ujian_id") references public."ujian" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."subject_forum_posts" add constraint "subject_forum_posts_user_id_fkey" foreign key ("user_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tagihan" add constraint "tagihan_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tagihan_line_items" add constraint "tagihan_line_items_tagihan_id_fkey" foreign key ("tagihan_id") references public."tagihan" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tagihan_santri" add constraint "tagihan_santri_santri_id_fkey" foreign key ("santri_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tagihan_santri" add constraint "tagihan_santri_tagihan_id_fkey" foreign key ("tagihan_id") references public."tagihan" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tahfidz_finalization" add constraint "tahfidz_finalization_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tahfidz_finalization" add constraint "tahfidz_finalization_finalized_by_fkey" foreign key ("finalized_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tahfidz_tahsin" add constraint "tahfidz_tahsin_penguji_id_fkey" foreign key ("penguji_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tahfidz_tahsin" add constraint "tahfidz_tahsin_santri_id_fkey" foreign key ("santri_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tahfidz_tahsin" add constraint "tahfidz_tahsin_tahun_ajaran_id_fkey" foreign key ("tahun_ajaran_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."target_hafalan" add constraint "target_hafalan_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."target_hafalan" add constraint "target_hafalan_kelas_id_fkey" foreign key ("kelas_id") references public."kelas" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."target_hafalan" add constraint "target_hafalan_tahun_ajaran_id_fkey" foreign key ("tahun_ajaran_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."teacher_mapel" add constraint "teacher_mapel_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."teacher_mapel" add constraint "teacher_mapel_teacher_id_fkey" foreign key ("teacher_id") references public."staff" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tugas" add constraint "tugas_created_by_fkey" foreign key ("created_by") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tugas" add constraint "tugas_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tujuan_pembelajaran_status" add constraint "tujuan_pembelajaran_status_academic_year_id_fkey" foreign key ("academic_year_id") references public."academic_years" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tujuan_pembelajaran_status" add constraint "tujuan_pembelajaran_status_achieved_in_sesi_id_fkey" foreign key ("achieved_in_sesi_id") references public."sesi_pembelajaran" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."tujuan_pembelajaran_status" add constraint "tujuan_pembelajaran_status_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian" add constraint "ujian_mapel_id_fkey" foreign key ("mapel_id") references public."mapel" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian" add constraint "ujian_pengawas_id_fkey" foreign key ("pengawas_id") references public."profiles" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_jawaban" add constraint "ujian_jawaban_peserta_id_fkey" foreign key ("peserta_id") references public."ujian_peserta" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_jawaban" add constraint "ujian_jawaban_soal_id_fkey" foreign key ("soal_id") references public."ujian_soal" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_peserta" add constraint "ujian_peserta_santri_id_fkey" foreign key ("santri_id") references public."santri" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_peserta" add constraint "ujian_peserta_ujian_id_fkey" foreign key ("ujian_id") references public."ujian" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_soal" add constraint "ujian_soal_ujian_id_fkey" foreign key ("ujian_id") references public."ujian" ("id"); exception when duplicate_object then null; end $$;
do $$ begin alter table public."ujian_soal_opsi" add constraint "ujian_soal_opsi_soal_id_fkey" foreign key ("soal_id") references public."ujian_soal" ("id"); exception when duplicate_object then null; end $$;

create or replace function public.has_role(_user_id uuid, _role public."app_role") returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
