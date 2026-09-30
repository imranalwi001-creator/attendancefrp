// Role type
export type Role = 'admin' | 'guru' | 'walikelas' | 'santri' | 'orangtua' | 'Pembina' | 'staff' | 'guru_ekskul';

// User types - includes both snake_case (DB) and camelCase (legacy) for compatibility
export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  avatar?: string;
  status?: 'aktif' | 'nonaktif' | 'cuti' | 'alumni';
  role?: 'admin' | 'guru' | 'walikelas' | 'santri' | 'orangtua' | 'Pembina' | 'staff' | 'guru_ekskul';
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  // Extended fields for santri
  nis?: string;
  kelasId?: string;
  kelas_id?: string;
  birthDate?: string;
  address?: string;
  previousSchool?: string;
  childOrder?: string;
  bloodType?: string;
  medicalHistory?: string;
  allergyHistory?: string;
  height?: string;
  weight?: string;
  socialType?: 'periang' | 'minder' | 'tenang';
  peerReaction?: 'aktif' | 'pasif';
  // Extended fields for orangtua
  relationship?: 'ayah' | 'ibu' | 'wali';
  notes?: string;
  childrenIds?: string[];
  // Extended fields for staff
  employeeId?: string;
  // Document fields for santri
  photoChild?: string;
  familyCard?: string;
  achievementCertificate?: string;
}

// Kelas types - includes both snake_case (DB) and camelCase (legacy)
export interface Kelas {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran: string;
  tahunAjaran?: string;
  walikelas_id?: string;
  waliKelasId?: string;
  kapasitas?: number;
  jumlah_santri?: number;
  jumlahSantri?: number;
  status?: 'aktif' | 'nonaktif' | 'cuti' | 'alumni';
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

// Mapel (Mata Pelajaran) types
export interface Mapel {
  id: string;
  nama: string;
  kode_mapel?: string;
  deskripsi?: string;
  pengampu_id: string;
  kelas_id: string;
  kkm?: number;
  kategori?: 'wajib' | 'pilihan' | 'ekstrakurikuler' | 'asrama';
  status?: 'aktif' | 'nonaktif';
  created_at?: string;
  updated_at?: string;
}

// Materi types
export interface Materi {
  id: string;
  mapelId?: string;
  mapel_id?: string;
  bab?: string;
  judul: string;
  deskripsi?: string;
  tipe_konten?: string;
  konten?: string | { tipe: 'text' | 'image' | 'video' | 'link'; value: string }[];
  status: 'draft' | 'aktif' | 'arsip';
  urutan?: number;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
}

// Tugas types
export interface Tugas {
  id: string;
  mapelId?: string;
  mapel_id?: string;
  judul: string;
  deskripsi?: string;
  bab?: string;
  tipeJawaban?: 'file' | 'teks' | 'link' | 'semua';
  tipe_jawaban?: 'file' | 'teks' | 'link' | 'semua';
  deadline?: string;
  tanggal_deadline?: string;
  tanggal_mulai?: string;
  status: string;
  nilai_maksimal?: number;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
}

// Pengumpulan Tugas types
export interface PengumpulanTugas {
  id: string;
  tugasId?: string;
  tugas_id?: string;
  santriId?: string;
  santri_id?: string;
  santriName?: string;
  jawaban: {
    tipe: 'file' | 'teks' | 'link';
    value: string;
  };
  jawaban_teks?: string;
  file_url?: string;
  status: string;
  nilai?: number;
  komentarGuru?: string;
  catatan_nilai?: string;
  feedbackSantri?: string;
  feedback_santri?: string;
  submittedAt?: string;
  tanggal_submit?: string;
  created_at?: string;
  updated_at?: string;
}

// Jadwal tipe (schedule type)
export type JadwalTipe = 'pelajaran' | 'istirahat' | 'tidur_siang' | 'break' | 'lainnya';

// Jadwal types - includes both snake_case (DB) and camelCase (legacy)
export interface Jadwal {
  id: string;
  tipe: JadwalTipe; // Schedule type
  label?: string; // Custom label for non-pelajaran types
  mapel_id?: string; // Nullable for non-pelajaran types
  kelas_id: string;
  pengampu_id?: string; // Nullable for non-pelajaran types
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';
  jam_mulai: string;
  jam_selesai: string;
  ruangan?: string;
  status: 'aktif' | 'nonaktif';
  block_id?: string; // Nullable - required only if semester model is 'sistem_blok'
  created_at?: string;
  updated_at?: string;
  // CamelCase aliases
  mapelId?: string;
  kelasId?: string;
  pengampuId?: string;
  jamMulai?: string;
  jamSelesai?: string;
}

// Sesi Pembelajaran types
export interface SesiPembelajaran {
  id: string;
  jadwal_id: string;
  pengampu_id: string;
  tanggal: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  foto_guru_url?: string;
  foto_guru_selesai_url?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

// Kehadiran Santri types
export interface KehadiranSantri {
  id: string;
  sesi_id: string;
  santri_id: string;
  status: 'hadir' | 'sakit' | 'izin' | 'alpha';
  created_at?: string;
}

// Santri types
export interface Santri {
  id: string;
  nis?: string;
  kelas_id?: string;
  birth_date?: string;
  address?: string;
  photo_url?: string;
  blood_type?: string;
  medical_history?: string;
  allergy_history?: string;
  height?: string;
  weight?: string;
  social_type?: string;
  peer_reaction?: string;
  previous_school?: string;
  child_order?: string;
  family_card_url?: string;
  achievement_cert_url?: string;
  created_at?: string;
  updated_at?: string;
  profiles?: User;
}

// Staff types
export interface Staff {
  id: string;
  employee_id?: string;
  position?: string;
  join_date?: string;
  kelas_id?: string;
  created_at?: string;
  updated_at?: string;
  profiles?: User;
}

// Raport types
export interface Raport {
  id: string;
  santri_id: string;
  kelas_id: string;
  tahun_ajaran: string;
  semester: string;
  status: string;
  is_published: boolean;
  published_at?: string;
  catatan_guru?: string;
  catatan_ortu?: string;
  created_at?: string;
  updated_at?: string;
}

// Asesmen Formatif types
export interface AsesmenFormatif {
  id: string;
  mapel_id: string;
  santri_id: string;
  tp_assessments: any[];
  deskripsi_tertinggi?: string;
  deskripsi_terendah?: string;
  created_at?: string;
  updated_at?: string;
}

// Asesmen Sumatif types
export interface AsesmenSumatif {
  id: string;
  mapel_id: string;
  santri_id: string;
  sumatif: any[];
  tes?: number;
  non_tes?: number;
  na_lingkup?: number;
  na_semester?: number;
  nilai_rapor?: number;
  is_finalized?: boolean;
  finalized_by?: string;
  finalized_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Banner types
export interface Banner {
  id: string;
  judul: string;
  deskripsi?: string;
  gambar_url?: string;
  tautan_aksi?: string;
  tanggal_mulai: string;
  tanggal_berakhir: string;
  target_audience: string[];
  status: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
