export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          even_semester_end: string
          even_semester_model: string
          even_semester_start: string
          id: string
          is_active: boolean
          name: string
          odd_semester_end: string
          odd_semester_model: string
          odd_semester_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          even_semester_end: string
          even_semester_model?: string
          even_semester_start: string
          id?: string
          is_active?: boolean
          name: string
          odd_semester_end: string
          odd_semester_model?: string
          odd_semester_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          even_semester_end?: string
          even_semester_model?: string
          even_semester_start?: string
          id?: string
          is_active?: boolean
          name?: string
          odd_semester_end?: string
          odd_semester_model?: string
          odd_semester_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action: string
          category: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          user_id: string
          user_name: string
          user_role: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: []
      }
      affective_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      affective_finalization: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean
          kelas_id: string
          semester: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id: string
          semester?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id?: string
          semester?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affective_finalization_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affective_finalization_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affective_finalization_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      affective_indicators: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affective_indicators_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "affective_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      affective_scores: {
        Row: {
          academic_year_id: string
          assessed_by: string | null
          created_at: string | null
          id: string
          indicator_id: string
          notes: string | null
          santri_id: string
          score: number
          semester: string
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          assessed_by?: string | null
          created_at?: string | null
          id?: string
          indicator_id: string
          notes?: string | null
          santri_id: string
          score: number
          semester?: string
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          assessed_by?: string | null
          created_at?: string | null
          id?: string
          indicator_id?: string
          notes?: string | null
          santri_id?: string
          score?: number
          semester?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affective_scores_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affective_scores_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affective_scores_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "affective_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affective_scores_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      asesmen_formatif: {
        Row: {
          created_at: string | null
          deskripsi_terendah: string | null
          deskripsi_tertinggi: string | null
          id: string
          mapel_id: string
          santri_id: string
          semester: string
          tp_assessments: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deskripsi_terendah?: string | null
          deskripsi_tertinggi?: string | null
          id?: string
          mapel_id: string
          santri_id: string
          semester?: string
          tp_assessments?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deskripsi_terendah?: string | null
          deskripsi_tertinggi?: string | null
          id?: string
          mapel_id?: string
          santri_id?: string
          semester?: string
          tp_assessments?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asesmen_formatif_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesmen_formatif_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      asesmen_sumatif: {
        Row: {
          created_at: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean | null
          mapel_id: string
          na_lingkup: number | null
          na_semester: number | null
          nilai_rapor: number | null
          non_tes: number | null
          santri_id: string
          semester: string
          sumatif: Json
          tes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean | null
          mapel_id: string
          na_lingkup?: number | null
          na_semester?: number | null
          nilai_rapor?: number | null
          non_tes?: number | null
          santri_id: string
          semester?: string
          sumatif?: Json
          tes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean | null
          mapel_id?: string
          na_lingkup?: number | null
          na_semester?: number | null
          nilai_rapor?: number | null
          non_tes?: number | null
          santri_id?: string
          semester?: string
          sumatif?: Json
          tes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asesmen_sumatif_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesmen_sumatif_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asesmen_sumatif_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      aturan_waktu_kerja: {
        Row: {
          created_at: string
          id: string
          jabatan: string
          toleransi_terlambat: number
          updated_at: string
          waktu_masuk: string
          waktu_pulang: string
        }
        Insert: {
          created_at?: string
          id?: string
          jabatan: string
          toleransi_terlambat?: number
          updated_at?: string
          waktu_masuk: string
          waktu_pulang: string
        }
        Update: {
          created_at?: string
          id?: string
          jabatan?: string
          toleransi_terlambat?: number
          updated_at?: string
          waktu_masuk?: string
          waktu_pulang?: string
        }
        Relationships: []
      }
      bahan_belajar: {
        Row: {
          created_at: string
          created_by: string | null
          deskripsi: string | null
          drive_url: string
          embed_url: string
          file_id: string
          file_type: string
          id: string
          judul: string
          kategori: string | null
          kelas_id: string | null
          mapel_id: string | null
          sampul_url: string | null
          status: string
          updated_at: string
          urutan: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          drive_url: string
          embed_url: string
          file_id: string
          file_type: string
          id?: string
          judul: string
          kategori?: string | null
          kelas_id?: string | null
          mapel_id?: string | null
          sampul_url?: string | null
          status?: string
          updated_at?: string
          urutan?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          drive_url?: string
          embed_url?: string
          file_id?: string
          file_type?: string
          id?: string
          judul?: string
          kategori?: string | null
          kelas_id?: string | null
          mapel_id?: string | null
          sampul_url?: string | null
          status?: string
          updated_at?: string
          urutan?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bahan_belajar_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bahan_belajar_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bahan_belajar_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_soal: {
        Row: {
          bobot: number
          cp_ringkasan: string | null
          created_at: string
          created_by: string | null
          gambar_opsi_a: string | null
          gambar_opsi_b: string | null
          gambar_opsi_c: string | null
          gambar_opsi_d: string | null
          gambar_opsi_e: string | null
          gambar_pembahasan: string | null
          gambar_pertanyaan: string | null
          id: string
          jenis_soal: string
          kelas: string
          kunci_jawaban: string
          level_kognitif: string | null
          mata_pelajaran: string
          materi: string | null
          opsi_a: string | null
          opsi_b: string | null
          opsi_c: string | null
          opsi_d: string | null
          opsi_e: string | null
          pembahasan: string | null
          pertanyaan: string
          tp_list: string[] | null
          updated_at: string
        }
        Insert: {
          bobot?: number
          cp_ringkasan?: string | null
          created_at?: string
          created_by?: string | null
          gambar_opsi_a?: string | null
          gambar_opsi_b?: string | null
          gambar_opsi_c?: string | null
          gambar_opsi_d?: string | null
          gambar_opsi_e?: string | null
          gambar_pembahasan?: string | null
          gambar_pertanyaan?: string | null
          id?: string
          jenis_soal: string
          kelas: string
          kunci_jawaban: string
          level_kognitif?: string | null
          mata_pelajaran: string
          materi?: string | null
          opsi_a?: string | null
          opsi_b?: string | null
          opsi_c?: string | null
          opsi_d?: string | null
          opsi_e?: string | null
          pembahasan?: string | null
          pertanyaan: string
          tp_list?: string[] | null
          updated_at?: string
        }
        Update: {
          bobot?: number
          cp_ringkasan?: string | null
          created_at?: string
          created_by?: string | null
          gambar_opsi_a?: string | null
          gambar_opsi_b?: string | null
          gambar_opsi_c?: string | null
          gambar_opsi_d?: string | null
          gambar_opsi_e?: string | null
          gambar_pembahasan?: string | null
          gambar_pertanyaan?: string | null
          id?: string
          jenis_soal?: string
          kelas?: string
          kunci_jawaban?: string
          level_kognitif?: string | null
          mata_pelajaran?: string
          materi?: string | null
          opsi_a?: string | null
          opsi_b?: string | null
          opsi_c?: string | null
          opsi_d?: string | null
          opsi_e?: string | null
          pembahasan?: string | null
          pertanyaan?: string
          tp_list?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_soal_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string | null
          created_by: string | null
          deskripsi: string | null
          gambar_url: string | null
          id: string
          is_permanent: boolean | null
          judul: string
          status: string
          tanggal_berakhir: string
          tanggal_mulai: string
          target_audience: string[]
          tautan_aksi: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deskripsi?: string | null
          gambar_url?: string | null
          id?: string
          is_permanent?: boolean | null
          judul: string
          status?: string
          tanggal_berakhir: string
          tanggal_mulai: string
          target_audience?: string[]
          tautan_aksi?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deskripsi?: string | null
          gambar_url?: string | null
          id?: string
          is_permanent?: boolean | null
          judul?: string
          status?: string
          tanggal_berakhir?: string
          tanggal_mulai?: string
          target_audience?: string[]
          tautan_aksi?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buku: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          deskripsi: string | null
          id: string
          isbn: string | null
          judul: string
          kategori: string | null
          kode_buku: string
          lokasi_rak: string | null
          penerbit: string | null
          penulis: string | null
          status: string
          tahun_terbit: number | null
          tersedia: number
          total_eksemplar: number
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          isbn?: string | null
          judul: string
          kategori?: string | null
          kode_buku: string
          lokasi_rak?: string | null
          penerbit?: string | null
          penulis?: string | null
          status?: string
          tahun_terbit?: number | null
          tersedia?: number
          total_eksemplar?: number
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          isbn?: string | null
          judul?: string
          kategori?: string | null
          kode_buku?: string
          lokasi_rak?: string | null
          penerbit?: string | null
          penulis?: string | null
          status?: string
          tahun_terbit?: number | null
          tersedia?: number
          total_eksemplar?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buku_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buku_kategori: {
        Row: {
          created_at: string
          id: string
          nama: string
          updated_at: string
          warna: string
        }
        Insert: {
          created_at?: string
          id?: string
          nama: string
          updated_at?: string
          warna?: string
        }
        Update: {
          created_at?: string
          id?: string
          nama?: string
          updated_at?: string
          warna?: string
        }
        Relationships: []
      }
      cambridge_documents: {
        Row: {
          academic_year_id: string
          created_at: string
          document_name: string | null
          document_url: string | null
          id: string
          kelas_id: string
          santri_id: string
          semester: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          kelas_id: string
          santri_id: string
          semester?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          kelas_id?: string
          santri_id?: string
          semester?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cambridge_documents_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambridge_documents_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambridge_documents_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambridge_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cambridge_finalization: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean
          kelas_id: string
          semester: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id: string
          semester?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id?: string
          semester?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cambridge_finalization_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambridge_finalization_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambridge_finalization_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      guru_pengganti: {
        Row: {
          alasan: string | null
          created_at: string | null
          guru_asli_id: string
          guru_pengganti_id: string
          id: string
          jadwal_id: string | null
          status: string | null
          tanggal: string
          updated_at: string | null
        }
        Insert: {
          alasan?: string | null
          created_at?: string | null
          guru_asli_id: string
          guru_pengganti_id: string
          id?: string
          jadwal_id?: string | null
          status?: string | null
          tanggal: string
          updated_at?: string | null
        }
        Update: {
          alasan?: string | null
          created_at?: string | null
          guru_asli_id?: string
          guru_pengganti_id?: string
          id?: string
          jadwal_id?: string | null
          status?: string | null
          tanggal?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guru_pengganti_guru_asli_id_fkey"
            columns: ["guru_asli_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guru_pengganti_guru_pengganti_id_fkey"
            columns: ["guru_pengganti_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guru_pengganti_jadwal_id_fkey"
            columns: ["jadwal_id"]
            isOneToOne: false
            referencedRelation: "jadwal"
            referencedColumns: ["id"]
          },
        ]
      }
      hafalan_finalization: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean
          semester: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          semester?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          semester?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hafalan_finalization_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hafalan_finalization_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jadwal: {
        Row: {
          block_id: string | null
          created_at: string | null
          hari: string
          id: string
          jam_mulai: string
          jam_selesai: string
          kategori: string
          kelas_id: string
          label: string | null
          mapel_id: string | null
          pengampu_id: string | null
          ruangan: string | null
          semester: string
          status: string
          tipe: string
          updated_at: string | null
        }
        Insert: {
          block_id?: string | null
          created_at?: string | null
          hari: string
          id?: string
          jam_mulai: string
          jam_selesai: string
          kategori?: string
          kelas_id: string
          label?: string | null
          mapel_id?: string | null
          pengampu_id?: string | null
          ruangan?: string | null
          semester?: string
          status?: string
          tipe?: string
          updated_at?: string | null
        }
        Update: {
          block_id?: string | null
          created_at?: string | null
          hari?: string
          id?: string
          jam_mulai?: string
          jam_selesai?: string
          kategori?: string
          kelas_id?: string
          label?: string | null
          mapel_id?: string | null
          pengampu_id?: string | null
          ruangan?: string | null
          semester?: string
          status?: string
          tipe?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jadwal_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "learning_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jadwal_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jadwal_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jadwal_pengampu_id_fkey"
            columns: ["pengampu_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      kalender_events: {
        Row: {
          academic_year_id: string | null
          created_at: string
          created_by: string | null
          deskripsi: string | null
          document_name: string | null
          document_url: string | null
          id: string
          is_recurring: boolean
          judul: string
          kategori_id: string | null
          pic_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          status: string
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          is_recurring?: boolean
          judul: string
          kategori_id?: string | null
          pic_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          status?: string
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          created_by?: string | null
          deskripsi?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          is_recurring?: boolean
          judul?: string
          kategori_id?: string | null
          pic_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          status?: string
          tanggal_mulai?: string
          tanggal_selesai?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kalender_events_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalender_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalender_events_kategori_id_fkey"
            columns: ["kategori_id"]
            isOneToOne: false
            referencedRelation: "kalender_kategori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalender_events_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      kalender_kategori: {
        Row: {
          created_at: string
          deskripsi: string | null
          id: string
          nama: string
          updated_at: string
          warna: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string | null
          id?: string
          nama: string
          updated_at?: string
          warna?: string
        }
        Update: {
          created_at?: string
          deskripsi?: string | null
          id?: string
          nama?: string
          updated_at?: string
          warna?: string
        }
        Relationships: []
      }
      kehadiran_santri: {
        Row: {
          created_at: string | null
          id: string
          santri_id: string
          sesi_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          santri_id: string
          sesi_id?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          id?: string
          santri_id?: string
          sesi_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kehadiran_santri_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kehadiran_santri_sesi_id_fkey"
            columns: ["sesi_id"]
            isOneToOne: false
            referencedRelation: "sesi_pembelajaran"
            referencedColumns: ["id"]
          },
        ]
      }
      kehadiran_staff: {
        Row: {
          created_at: string | null
          foto_masuk_url: string | null
          foto_pulang_url: string | null
          id: string
          jam_masuk: string | null
          jam_pulang: string | null
          latitude_masuk: number | null
          latitude_pulang: number | null
          longitude_masuk: number | null
          longitude_pulang: number | null
          staff_id: string
          status: string | null
          status_lokasi_masuk: string | null
          status_lokasi_pulang: string | null
          tanggal: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          foto_masuk_url?: string | null
          foto_pulang_url?: string | null
          id?: string
          jam_masuk?: string | null
          jam_pulang?: string | null
          latitude_masuk?: number | null
          latitude_pulang?: number | null
          longitude_masuk?: number | null
          longitude_pulang?: number | null
          staff_id: string
          status?: string | null
          status_lokasi_masuk?: string | null
          status_lokasi_pulang?: string | null
          tanggal?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          foto_masuk_url?: string | null
          foto_pulang_url?: string | null
          id?: string
          jam_masuk?: string | null
          jam_pulang?: string | null
          latitude_masuk?: number | null
          latitude_pulang?: number | null
          longitude_masuk?: number | null
          longitude_pulang?: number | null
          staff_id?: string
          status?: string | null
          status_lokasi_masuk?: string | null
          status_lokasi_pulang?: string | null
          tanggal?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kehadiran_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      kelas: {
        Row: {
          created_at: string | null
          id: string
          jumlah_santri: number | null
          nama: string
          status: Database["public"]["Enums"]["user_status"] | null
          tahun_ajaran: string
          tingkat: string
          updated_at: string | null
          walikelas_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          jumlah_santri?: number | null
          nama: string
          status?: Database["public"]["Enums"]["user_status"] | null
          tahun_ajaran: string
          tingkat: string
          updated_at?: string | null
          walikelas_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          jumlah_santri?: number | null
          nama?: string
          status?: Database["public"]["Enums"]["user_status"] | null
          tahun_ajaran?: string
          tingkat?: string
          updated_at?: string | null
          walikelas_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kelas_tahun_ajaran_fkey"
            columns: ["tahun_ajaran"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "kelas_walikelas_id_fkey"
            columns: ["walikelas_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      konseling_kategori: {
        Row: {
          created_at: string | null
          deskripsi: string | null
          id: string
          nama: string
          poin: number
          status: string
          tipe: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          nama: string
          poin?: number
          status?: string
          tipe: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          nama?: string
          poin?: number
          status?: string
          tipe?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      konseling_records: {
        Row: {
          academic_year_id: string | null
          created_at: string | null
          deskripsi: string | null
          id: string
          kategori: string
          kategori_id: string | null
          poin: number
          recorded_by: string | null
          santri_id: string
          semester: string
          tanggal: string
          tipe: string
          updated_at: string | null
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          kategori: string
          kategori_id?: string | null
          poin?: number
          recorded_by?: string | null
          santri_id: string
          semester?: string
          tanggal?: string
          tipe: string
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          kategori?: string
          kategori_id?: string | null
          poin?: number
          recorded_by?: string | null
          santri_id?: string
          semester?: string
          tanggal?: string
          tipe?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "konseling_records_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "konseling_records_kategori_id_fkey"
            columns: ["kategori_id"]
            isOneToOne: false
            referencedRelation: "konseling_kategori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "konseling_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "konseling_records_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_blocks: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string
          fase: number
          id: string
          selected_dates: string[] | null
          semester: string
          start_date: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date: string
          fase: number
          id?: string
          selected_dates?: string[] | null
          semester: string
          start_date: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string
          fase?: number
          id?: string
          selected_dates?: string[] | null
          semester?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_blocks_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      liburan_activities: {
        Row: {
          category: string
          created_at: string
          id: string
          target_daily: number
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          target_daily?: number
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          target_daily?: number
          title?: string
        }
        Relationships: []
      }
      liburan_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nama: string
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nama: string
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nama?: string
          tanggal_mulai?: string
          tanggal_selesai?: string
          updated_at?: string
        }
        Relationships: []
      }
      liburan_daily_logs: {
        Row: {
          activity_id: string
          date: string
          day_number: number | null
          excuse_reason: string | null
          id: string
          is_completed: boolean
          santri_id: string
          timestamp: string
        }
        Insert: {
          activity_id: string
          date: string
          day_number?: number | null
          excuse_reason?: string | null
          id?: string
          is_completed?: boolean
          santri_id: string
          timestamp?: string
        }
        Update: {
          activity_id?: string
          date?: string
          day_number?: number | null
          excuse_reason?: string | null
          id?: string
          is_completed?: boolean
          santri_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "liburan_daily_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "liburan_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liburan_daily_logs_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      liburan_mood: {
        Row: {
          created_at: string
          date: string
          id: string
          mood: string
          santri_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          mood: string
          santri_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mood?: string
          santri_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liburan_mood_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      lokasi_absen: {
        Row: {
          alamat: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          nama: string
          radius: number
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          nama: string
          radius?: number
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          nama?: string
          radius?: number
          updated_at?: string
        }
        Relationships: []
      }
      mapel: {
        Row: {
          created_at: string | null
          deskripsi: string | null
          id: string
          kategori: Database["public"]["Enums"]["mapel_kategori"] | null
          kelas_id: string
          kkm: number | null
          kode_mapel: string | null
          nama: string
          pengampu_id: string
          status: Database["public"]["Enums"]["mapel_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          kategori?: Database["public"]["Enums"]["mapel_kategori"] | null
          kelas_id: string
          kkm?: number | null
          kode_mapel?: string | null
          nama: string
          pengampu_id: string
          status?: Database["public"]["Enums"]["mapel_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          kategori?: Database["public"]["Enums"]["mapel_kategori"] | null
          kelas_id?: string
          kkm?: number | null
          kode_mapel?: string | null
          nama?: string
          pengampu_id?: string
          status?: Database["public"]["Enums"]["mapel_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapel_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapel_pengampu_id_fkey"
            columns: ["pengampu_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      mapel_info: {
        Row: {
          capaian_pembelajaran: Json | null
          created_at: string | null
          id: string
          mapel_id: string
          tujuan_pembelajaran: Json | null
          updated_at: string | null
        }
        Insert: {
          capaian_pembelajaran?: Json | null
          created_at?: string | null
          id?: string
          mapel_id: string
          tujuan_pembelajaran?: Json | null
          updated_at?: string | null
        }
        Update: {
          capaian_pembelajaran?: Json | null
          created_at?: string | null
          id?: string
          mapel_id?: string
          tujuan_pembelajaran?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapel_info_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      master_mapel: {
        Row: {
          created_at: string | null
          deskripsi: string | null
          id: string
          kategori: Database["public"]["Enums"]["mapel_kategori"]
          nama: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          kategori?: Database["public"]["Enums"]["mapel_kategori"]
          nama: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deskripsi?: string | null
          id?: string
          kategori?: Database["public"]["Enums"]["mapel_kategori"]
          nama?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      materi: {
        Row: {
          created_at: string | null
          created_by: string | null
          deskripsi: string | null
          id: string
          judul: string
          konten: string
          mapel_id: string
          semester: string
          status: string | null
          tipe_konten: string
          tujuan_pembelajaran_ids: number[] | null
          updated_at: string | null
          urutan: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          judul: string
          konten: string
          mapel_id: string
          semester?: string
          status?: string | null
          tipe_konten: string
          tujuan_pembelajaran_ids?: number[] | null
          updated_at?: string | null
          urutan?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          judul?: string
          konten?: string
          mapel_id?: string
          semester?: string
          status?: string | null
          tipe_konten?: string
          tujuan_pembelajaran_ids?: number[] | null
          updated_at?: string | null
          urutan?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materi_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      materi_reads: {
        Row: {
          created_at: string
          id: string
          materi_id: string
          santri_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          materi_id: string
          santri_id: string
        }
        Update: {
          created_at?: string
          id?: string
          materi_id?: string
          santri_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materi_reads_materi_id_fkey"
            columns: ["materi_id"]
            isOneToOne: false
            referencedRelation: "materi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materi_reads_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      metode_pembayaran: {
        Row: {
          atas_nama: string
          created_at: string
          id: string
          is_active: boolean
          nama_bank: string
          nomor_rekening: string
          petunjuk: string | null
          updated_at: string
        }
        Insert: {
          atas_nama: string
          created_at?: string
          id?: string
          is_active?: boolean
          nama_bank: string
          nomor_rekening: string
          petunjuk?: string | null
          updated_at?: string
        }
        Update: {
          atas_nama?: string
          created_at?: string
          id?: string
          is_active?: boolean
          nama_bank?: string
          nomor_rekening?: string
          petunjuk?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orangtua: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          occupation: string | null
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          notes?: string | null
          occupation?: string | null
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          occupation?: string | null
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orangtua_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_children: {
        Row: {
          child_id: string
          created_at: string | null
          id: string
          parent_id: string
        }
        Insert: {
          child_id: string
          created_at?: string | null
          id?: string
          parent_id: string
        }
        Update: {
          child_id?: string
          created_at?: string | null
          id?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pembayaran: {
        Row: {
          bukti_url: string
          catatan: string | null
          catatan_verifikasi: string | null
          created_at: string
          id: string
          jumlah_bayar: number
          metode_pembayaran_id: string
          status: string
          submitted_by: string | null
          tagihan_id: string
          tagihan_santri_id: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bukti_url: string
          catatan?: string | null
          catatan_verifikasi?: string | null
          created_at?: string
          id?: string
          jumlah_bayar: number
          metode_pembayaran_id: string
          status?: string
          submitted_by?: string | null
          tagihan_id: string
          tagihan_santri_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bukti_url?: string
          catatan?: string | null
          catatan_verifikasi?: string | null
          created_at?: string
          id?: string
          jumlah_bayar?: number
          metode_pembayaran_id?: string
          status?: string
          submitted_by?: string | null
          tagihan_id?: string
          tagihan_santri_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pembayaran_metode_pembayaran_id_fkey"
            columns: ["metode_pembayaran_id"]
            isOneToOne: false
            referencedRelation: "metode_pembayaran"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_tagihan_id_fkey"
            columns: ["tagihan_id"]
            isOneToOne: false
            referencedRelation: "tagihan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_tagihan_santri_id_fkey"
            columns: ["tagihan_santri_id"]
            isOneToOne: false
            referencedRelation: "tagihan_santri"
            referencedColumns: ["id"]
          },
        ]
      }
      peminjaman_buku: {
        Row: {
          bukti_pengembalian_url: string | null
          buku_id: string
          catatan: string | null
          created_at: string
          denda: number
          dikembalikan_oleh_santri: boolean | null
          id: string
          petugas_kembali_id: string | null
          petugas_pinjam_id: string | null
          santri_id: string
          status: string
          tanggal_jatuh_tempo: string
          tanggal_kembali: string | null
          tanggal_pinjam: string
          updated_at: string
        }
        Insert: {
          bukti_pengembalian_url?: string | null
          buku_id: string
          catatan?: string | null
          created_at?: string
          denda?: number
          dikembalikan_oleh_santri?: boolean | null
          id?: string
          petugas_kembali_id?: string | null
          petugas_pinjam_id?: string | null
          santri_id: string
          status?: string
          tanggal_jatuh_tempo: string
          tanggal_kembali?: string | null
          tanggal_pinjam?: string
          updated_at?: string
        }
        Update: {
          bukti_pengembalian_url?: string | null
          buku_id?: string
          catatan?: string | null
          created_at?: string
          denda?: number
          dikembalikan_oleh_santri?: boolean | null
          id?: string
          petugas_kembali_id?: string | null
          petugas_pinjam_id?: string | null
          santri_id?: string
          status?: string
          tanggal_jatuh_tempo?: string
          tanggal_kembali?: string | null
          tanggal_pinjam?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peminjaman_buku_buku_id_fkey"
            columns: ["buku_id"]
            isOneToOne: false
            referencedRelation: "buku"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peminjaman_buku_petugas_kembali_id_fkey"
            columns: ["petugas_kembali_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peminjaman_buku_petugas_pinjam_id_fkey"
            columns: ["petugas_pinjam_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peminjaman_buku_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pengajuan_izin_santri: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          jenis_izin: Database["public"]["Enums"]["jenis_izin"]
          keterangan: string | null
          lampiran_url: string | null
          santri_id: string
          status: Database["public"]["Enums"]["status_izin"]
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          jenis_izin: Database["public"]["Enums"]["jenis_izin"]
          keterangan?: string | null
          lampiran_url?: string | null
          santri_id: string
          status?: Database["public"]["Enums"]["status_izin"]
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          jenis_izin?: Database["public"]["Enums"]["jenis_izin"]
          keterangan?: string | null
          lampiran_url?: string | null
          santri_id?: string
          status?: Database["public"]["Enums"]["status_izin"]
          tanggal_mulai?: string
          tanggal_selesai?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pengajuan_izin_santri_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pengajuan_izin_santri_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      pengajuan_izin_staff: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          jenis_izin: Database["public"]["Enums"]["jenis_izin"]
          keterangan: string | null
          lampiran_url: string | null
          staff_id: string
          status: Database["public"]["Enums"]["status_izin"]
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          jenis_izin: Database["public"]["Enums"]["jenis_izin"]
          keterangan?: string | null
          lampiran_url?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["status_izin"]
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          jenis_izin?: Database["public"]["Enums"]["jenis_izin"]
          keterangan?: string | null
          lampiran_url?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["status_izin"]
          tanggal_mulai?: string
          tanggal_selesai?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pengajuan_izin_staff_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pengajuan_izin_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      pengajuan_peminjaman: {
        Row: {
          alasan_penolakan: string | null
          buku_id: string
          catatan: string | null
          created_at: string
          diproses_at: string | null
          diproses_oleh: string | null
          id: string
          santri_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alasan_penolakan?: string | null
          buku_id: string
          catatan?: string | null
          created_at?: string
          diproses_at?: string | null
          diproses_oleh?: string | null
          id?: string
          santri_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alasan_penolakan?: string | null
          buku_id?: string
          catatan?: string | null
          created_at?: string
          diproses_at?: string | null
          diproses_oleh?: string | null
          id?: string
          santri_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pengajuan_peminjaman_buku_id_fkey"
            columns: ["buku_id"]
            isOneToOne: false
            referencedRelation: "buku"
            referencedColumns: ["id"]
          },
        ]
      }
      pengumpulan_tugas: {
        Row: {
          catatan_nilai: string | null
          created_at: string | null
          feedback_santri: string | null
          file_url: string | null
          id: string
          jawaban_teks: string | null
          nilai: number | null
          santri_id: string
          status: string | null
          tanggal_submit: string | null
          tugas_id: string
          updated_at: string | null
        }
        Insert: {
          catatan_nilai?: string | null
          created_at?: string | null
          feedback_santri?: string | null
          file_url?: string | null
          id?: string
          jawaban_teks?: string | null
          nilai?: number | null
          santri_id: string
          status?: string | null
          tanggal_submit?: string | null
          tugas_id: string
          updated_at?: string | null
        }
        Update: {
          catatan_nilai?: string | null
          created_at?: string | null
          feedback_santri?: string | null
          file_url?: string | null
          id?: string
          jawaban_teks?: string | null
          nilai?: number | null
          santri_id?: string
          status?: string | null
          tanggal_submit?: string | null
          tugas_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pengumpulan_tugas_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pengumpulan_tugas_tugas_id_fkey"
            columns: ["tugas_id"]
            isOneToOne: false
            referencedRelation: "tugas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      psikologi_finalization: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean
          kelas_id: string
          semester: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id: string
          semester?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id?: string
          semester?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "psikologi_finalization_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psikologi_finalization_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psikologi_finalization_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ramadhan_activities: {
        Row: {
          category: string
          created_at: string | null
          id: string
          target_daily: number
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          target_daily?: number
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          target_daily?: number
          title?: string
        }
        Relationships: []
      }
      ramadhan_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          tahun_hijriah: string
          tanggal_mulai: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          tahun_hijriah: string
          tanggal_mulai: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          tahun_hijriah?: string
          tanggal_mulai?: string
          updated_at?: string
        }
        Relationships: []
      }
      ramadhan_daily_logs: {
        Row: {
          activity_id: string
          date: string
          excuse_reason: string | null
          hijri_day: number | null
          id: string
          is_completed: boolean
          santri_id: string
          timestamp: string | null
        }
        Insert: {
          activity_id: string
          date: string
          excuse_reason?: string | null
          hijri_day?: number | null
          id?: string
          is_completed?: boolean
          santri_id: string
          timestamp?: string | null
        }
        Update: {
          activity_id?: string
          date?: string
          excuse_reason?: string | null
          hijri_day?: number | null
          id?: string
          is_completed?: boolean
          santri_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ramadhan_daily_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "ramadhan_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ramadhan_daily_logs_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      ramadhan_mood: {
        Row: {
          created_at: string
          date: string
          id: string
          mood: string
          santri_id: string
          tilawah_surah_akhir: string | null
          tilawah_surah_awal: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          mood: string
          santri_id: string
          tilawah_surah_akhir?: string | null
          tilawah_surah_awal?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          mood?: string
          santri_id?: string
          tilawah_surah_akhir?: string | null
          tilawah_surah_awal?: string | null
        }
        Relationships: []
      }
      raport: {
        Row: {
          catatan_guru: string | null
          catatan_ortu: string | null
          created_at: string
          id: string
          is_published: boolean
          kelas_id: string
          published_at: string | null
          santri_id: string
          semester: string
          status: string
          tahun_ajaran: string
          updated_at: string
        }
        Insert: {
          catatan_guru?: string | null
          catatan_ortu?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          kelas_id: string
          published_at?: string | null
          santri_id: string
          semester?: string
          status?: string
          tahun_ajaran: string
          updated_at?: string
        }
        Update: {
          catatan_guru?: string | null
          catatan_ortu?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          kelas_id?: string
          published_at?: string | null
          santri_id?: string
          semester?: string
          status?: string
          tahun_ajaran?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raport_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raport_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      raport_finalization: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean
          kelas_id: string
          semester: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id: string
          semester?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          kelas_id?: string
          semester?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raport_finalization_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raport_finalization_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raport_finalization_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      santri: {
        Row: {
          achievement_cert_url: string | null
          address: string | null
          allergy_history: string | null
          asesmen_awal_url: Json | null
          birth_date: string | null
          blood_type: string | null
          child_order: string | null
          created_at: string | null
          family_card_url: string | null
          height: string | null
          id: string
          kelas_id: string | null
          medical_history: string | null
          nis: string | null
          nisn: string | null
          peer_reaction: string | null
          photo_url: string | null
          previous_school: string | null
          social_type: string | null
          stifin_url: string | null
          updated_at: string | null
          weight: string | null
        }
        Insert: {
          achievement_cert_url?: string | null
          address?: string | null
          allergy_history?: string | null
          asesmen_awal_url?: Json | null
          birth_date?: string | null
          blood_type?: string | null
          child_order?: string | null
          created_at?: string | null
          family_card_url?: string | null
          height?: string | null
          id: string
          kelas_id?: string | null
          medical_history?: string | null
          nis?: string | null
          nisn?: string | null
          peer_reaction?: string | null
          photo_url?: string | null
          previous_school?: string | null
          social_type?: string | null
          stifin_url?: string | null
          updated_at?: string | null
          weight?: string | null
        }
        Update: {
          achievement_cert_url?: string | null
          address?: string | null
          allergy_history?: string | null
          asesmen_awal_url?: Json | null
          birth_date?: string | null
          blood_type?: string | null
          child_order?: string | null
          created_at?: string | null
          family_card_url?: string | null
          height?: string | null
          id?: string
          kelas_id?: string | null
          medical_history?: string | null
          nis?: string | null
          nisn?: string | null
          peer_reaction?: string | null
          photo_url?: string | null
          previous_school?: string | null
          social_type?: string | null
          stifin_url?: string | null
          updated_at?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "santri_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "santri_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      santri_family_children: {
        Row: {
          catatan: string | null
          created_at: string
          id: string
          kategori_potensi: string
          nama: string
          santri_id: string
          tanggal_lahir: string | null
          usia_perkiraan: number | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          id?: string
          kategori_potensi: string
          nama: string
          santri_id: string
          tanggal_lahir?: string | null
          usia_perkiraan?: number | null
        }
        Update: {
          catatan?: string | null
          created_at?: string
          id?: string
          kategori_potensi?: string
          nama?: string
          santri_id?: string
          tanggal_lahir?: string | null
          usia_perkiraan?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "santri_family_children_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      santri_family_insights: {
        Row: {
          created_at: string
          id: string
          santri_id: string
          source: string
          total_anak: number
          total_anak_potensi_smp: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          santri_id: string
          source?: string
          total_anak?: number
          total_anak_potensi_smp?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          santri_id?: string
          source?: string
          total_anak?: number
          total_anak_potensi_smp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "santri_family_insights_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: true
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      santri_psikologi_reports: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by: string | null
          id: string
          language_style: string
          santri_id: string
          semester: string
          summary: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          language_style?: string
          santri_id: string
          semester?: string
          summary: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language_style?: string
          santri_id?: string
          semester?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "santri_psikologi_reports_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "santri_psikologi_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "santri_psikologi_reports_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      santri_psikologi_results: {
        Row: {
          analisis: string | null
          created_at: string
          extracted_at: string | null
          id: string
          pemeriksa: string | null
          profil_psikologis: Json | null
          rekomendasi: string[] | null
          santri_id: string
          source_url: string | null
          tanggal_pemeriksaan: string | null
          updated_at: string
        }
        Insert: {
          analisis?: string | null
          created_at?: string
          extracted_at?: string | null
          id?: string
          pemeriksa?: string | null
          profil_psikologis?: Json | null
          rekomendasi?: string[] | null
          santri_id: string
          source_url?: string | null
          tanggal_pemeriksaan?: string | null
          updated_at?: string
        }
        Update: {
          analisis?: string | null
          created_at?: string
          extracted_at?: string | null
          id?: string
          pemeriksa?: string | null
          profil_psikologis?: Json | null
          rekomendasi?: string[] | null
          santri_id?: string
          source_url?: string | null
          tanggal_pemeriksaan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "santri_psikologi_results_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: true
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      santri_stifin_results: {
        Row: {
          created_at: string
          deskripsi: string | null
          extracted_at: string | null
          gaya_belajar: string | null
          id: string
          karir_cocok: string[] | null
          kecerdasan_dominan: string | null
          kekuatan: string[] | null
          kelemahan: string[] | null
          pemeriksa: string | null
          santri_id: string
          source_url: string | null
          tanggal_pemeriksaan: string | null
          tipe_stifin: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string | null
          extracted_at?: string | null
          gaya_belajar?: string | null
          id?: string
          karir_cocok?: string[] | null
          kecerdasan_dominan?: string | null
          kekuatan?: string[] | null
          kelemahan?: string[] | null
          pemeriksa?: string | null
          santri_id: string
          source_url?: string | null
          tanggal_pemeriksaan?: string | null
          tipe_stifin: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deskripsi?: string | null
          extracted_at?: string | null
          gaya_belajar?: string | null
          id?: string
          karir_cocok?: string[] | null
          kecerdasan_dominan?: string | null
          kekuatan?: string[] | null
          kelemahan?: string[] | null
          pemeriksa?: string | null
          santri_id?: string
          source_url?: string | null
          tanggal_pemeriksaan?: string | null
          tipe_stifin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "santri_stifin_results_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: true
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_grades: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string
          finalized_by: string | null
          id: string
          predikat: string | null
          rata_rata_nilai: number | null
          semester: string
          total_belum_lancar: number
          total_lancar: number
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string
          finalized_by?: string | null
          id?: string
          predikat?: string | null
          rata_rata_nilai?: number | null
          semester?: string
          total_belum_lancar?: number
          total_lancar?: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string
          finalized_by?: string | null
          id?: string
          predikat?: string | null
          rata_rata_nilai?: number | null
          semester?: string
          total_belum_lancar?: number
          total_lancar?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_grades_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_grades_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sesi_pembelajaran: {
        Row: {
          created_at: string | null
          foto_guru_selesai_url: string | null
          foto_guru_url: string | null
          hari: string | null
          id: string
          jadwal_id: string | null
          jadwal_pengampu_id: string | null
          jam_mulai: string | null
          jam_selesai: string | null
          kelas_id: string | null
          mapel_id: string | null
          metadata: Json | null
          pengampu_id: string
          status: string
          tanggal: string
          updated_at: string | null
          waktu_mulai: string | null
          waktu_selesai: string | null
        }
        Insert: {
          created_at?: string | null
          foto_guru_selesai_url?: string | null
          foto_guru_url?: string | null
          hari?: string | null
          id?: string
          jadwal_id?: string | null
          jadwal_pengampu_id?: string | null
          jam_mulai?: string | null
          jam_selesai?: string | null
          kelas_id?: string | null
          mapel_id?: string | null
          metadata?: Json | null
          pengampu_id: string
          status?: string
          tanggal?: string
          updated_at?: string | null
          waktu_mulai?: string | null
          waktu_selesai?: string | null
        }
        Update: {
          created_at?: string | null
          foto_guru_selesai_url?: string | null
          foto_guru_url?: string | null
          hari?: string | null
          id?: string
          jadwal_id?: string | null
          jadwal_pengampu_id?: string | null
          jam_mulai?: string | null
          jam_selesai?: string | null
          kelas_id?: string | null
          mapel_id?: string | null
          metadata?: Json | null
          pengampu_id?: string
          status?: string
          tanggal?: string
          updated_at?: string | null
          waktu_mulai?: string | null
          waktu_selesai?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sesi_pembelajaran_jadwal_id_fkey"
            columns: ["jadwal_id"]
            isOneToOne: false
            referencedRelation: "jadwal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesi_pembelajaran_jadwal_pengampu_id_fkey"
            columns: ["jadwal_pengampu_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesi_pembelajaran_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesi_pembelajaran_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesi_pembelajaran_pengampu_id_fkey"
            columns: ["pengampu_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      setoran_hafalan: {
        Row: {
          audio_type: string | null
          audio_url: string | null
          catatan: string | null
          created_at: string | null
          id: string
          judul: string
          kategori: string
          nilai: number | null
          pembina_external: string | null
          penguji_id: string
          santri_id: string
          semester: string | null
          status: string
          tahun_ajaran_id: string | null
          tanggal: string
          updated_at: string | null
        }
        Insert: {
          audio_type?: string | null
          audio_url?: string | null
          catatan?: string | null
          created_at?: string | null
          id?: string
          judul: string
          kategori: string
          nilai?: number | null
          pembina_external?: string | null
          penguji_id: string
          santri_id: string
          semester?: string | null
          status?: string
          tahun_ajaran_id?: string | null
          tanggal?: string
          updated_at?: string | null
        }
        Update: {
          audio_type?: string | null
          audio_url?: string | null
          catatan?: string | null
          created_at?: string | null
          id?: string
          judul?: string
          kategori?: string
          nilai?: number | null
          pembina_external?: string | null
          penguji_id?: string
          santri_id?: string
          semester?: string | null
          status?: string
          tahun_ajaran_id?: string | null
          tanggal?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setoran_hafalan_penguji_id_fkey"
            columns: ["penguji_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setoran_hafalan_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setoran_hafalan_tahun_ajaran_id_fkey"
            columns: ["tahun_ajaran_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          alamat: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          jenis_kelamin: string | null
          join_date: string | null
          kelas_id: string | null
          nik: string | null
          position: string | null
          tanggal_lahir: string | null
          tempat_lahir: string | null
          updated_at: string | null
        }
        Insert: {
          alamat?: string | null
          created_at?: string | null
          employee_id?: string | null
          id: string
          jenis_kelamin?: string | null
          join_date?: string | null
          kelas_id?: string | null
          nik?: string | null
          position?: string | null
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string | null
        }
        Update: {
          alamat?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          jenis_kelamin?: string | null
          join_date?: string | null
          kelas_id?: string | null
          nik?: string | null
          position?: string | null
          tanggal_lahir?: string | null
          tempat_lahir?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_forum_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "subject_forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_forum_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_forum_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          is_solved: boolean
          materi_id: string | null
          post_type: Database["public"]["Enums"]["forum_post_type"]
          resource_url: string | null
          subject_id: string
          ujian_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_solved?: boolean
          materi_id?: string | null
          post_type?: Database["public"]["Enums"]["forum_post_type"]
          resource_url?: string | null
          subject_id: string
          ujian_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_solved?: boolean
          materi_id?: string | null
          post_type?: Database["public"]["Enums"]["forum_post_type"]
          resource_url?: string | null
          subject_id?: string
          ujian_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_forum_posts_materi_id_fkey"
            columns: ["materi_id"]
            isOneToOne: false
            referencedRelation: "materi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_forum_posts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_forum_posts_ujian_id_fkey"
            columns: ["ujian_id"]
            isOneToOne: false
            referencedRelation: "ujian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_forum_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tagihan: {
        Row: {
          catatan_admin: string | null
          created_at: string
          created_by: string | null
          id: string
          is_split: boolean
          jatuh_tempo: string
          jumlah: number
          kelas_id: string | null
          nama_tagihan: string
          semester: string
          updated_at: string
        }
        Insert: {
          catatan_admin?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_split?: boolean
          jatuh_tempo: string
          jumlah: number
          kelas_id?: string | null
          nama_tagihan?: string
          semester: string
          updated_at?: string
        }
        Update: {
          catatan_admin?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_split?: boolean
          jatuh_tempo?: string
          jumlah?: number
          kelas_id?: string | null
          nama_tagihan?: string
          semester?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tagihan_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
        ]
      }
      tagihan_items: {
        Row: {
          created_at: string
          deskripsi: string | null
          id: string
          is_active: boolean
          kategori: string
          nama: string
          nominal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string | null
          id?: string
          is_active?: boolean
          kategori?: string
          nama: string
          nominal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deskripsi?: string | null
          id?: string
          is_active?: boolean
          kategori?: string
          nama?: string
          nominal?: number
          updated_at?: string
        }
        Relationships: []
      }
      tagihan_line_items: {
        Row: {
          created_at: string | null
          id: string
          jumlah: number
          nama: string
          tagihan_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          jumlah?: number
          nama: string
          tagihan_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          jumlah?: number
          nama?: string
          tagihan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tagihan_line_items_tagihan_id_fkey"
            columns: ["tagihan_id"]
            isOneToOne: false
            referencedRelation: "tagihan"
            referencedColumns: ["id"]
          },
        ]
      }
      tagihan_santri: {
        Row: {
          created_at: string
          id: string
          santri_id: string | null
          status: string
          tagihan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          santri_id?: string | null
          status?: string
          tagihan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          santri_id?: string | null
          status?: string
          tagihan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tagihan_santri_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tagihan_santri_tagihan_id_fkey"
            columns: ["tagihan_id"]
            isOneToOne: false
            referencedRelation: "tagihan"
            referencedColumns: ["id"]
          },
        ]
      }
      tahfidz_finalization: {
        Row: {
          academic_year_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean
          murojaah_avg_score: number | null
          murojaah_total_records: number | null
          semester: string
          tahsin_total_pages: number | null
          tahsin_total_records: number | null
          updated_at: string
          ziyadah_total_pages: number | null
          ziyadah_total_records: number | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          murojaah_avg_score?: number | null
          murojaah_total_records?: number | null
          semester?: string
          tahsin_total_pages?: number | null
          tahsin_total_records?: number | null
          updated_at?: string
          ziyadah_total_pages?: number | null
          ziyadah_total_records?: number | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean
          murojaah_avg_score?: number | null
          murojaah_total_records?: number | null
          semester?: string
          tahsin_total_pages?: number | null
          tahsin_total_records?: number | null
          updated_at?: string
          ziyadah_total_pages?: number | null
          ziyadah_total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tahfidz_finalization_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tahfidz_finalization_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tahfidz_tahsin: {
        Row: {
          audio_type: string | null
          audio_url: string | null
          ayat_akhir: number | null
          ayat_awal: number | null
          catatan: string | null
          created_at: string | null
          id: string
          juz: number | null
          kelancaran: number | null
          makhraj: number | null
          materi_tahsin: string | null
          mode: string | null
          nilai: number | null
          pembina_external: string | null
          penguji_id: string
          santri_id: string
          semester: string | null
          status: string
          surah: string | null
          tahun_ajaran_id: string | null
          tajwid: number | null
          tanggal: string
          tipe: string
          updated_at: string | null
        }
        Insert: {
          audio_type?: string | null
          audio_url?: string | null
          ayat_akhir?: number | null
          ayat_awal?: number | null
          catatan?: string | null
          created_at?: string | null
          id?: string
          juz?: number | null
          kelancaran?: number | null
          makhraj?: number | null
          materi_tahsin?: string | null
          mode?: string | null
          nilai?: number | null
          pembina_external?: string | null
          penguji_id: string
          santri_id: string
          semester?: string | null
          status: string
          surah?: string | null
          tahun_ajaran_id?: string | null
          tajwid?: number | null
          tanggal?: string
          tipe: string
          updated_at?: string | null
        }
        Update: {
          audio_type?: string | null
          audio_url?: string | null
          ayat_akhir?: number | null
          ayat_awal?: number | null
          catatan?: string | null
          created_at?: string | null
          id?: string
          juz?: number | null
          kelancaran?: number | null
          makhraj?: number | null
          materi_tahsin?: string | null
          mode?: string | null
          nilai?: number | null
          pembina_external?: string | null
          penguji_id?: string
          santri_id?: string
          semester?: string | null
          status?: string
          surah?: string | null
          tahun_ajaran_id?: string | null
          tajwid?: number | null
          tanggal?: string
          tipe?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tahfidz_tahsin_penguji_id_fkey"
            columns: ["penguji_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tahfidz_tahsin_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tahfidz_tahsin_tahun_ajaran_id_fkey"
            columns: ["tahun_ajaran_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      target_hafalan: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          jenis_hafalan: string
          kategori_sumber: string
          kelas_id: string | null
          keterangan: string | null
          satuan: string
          semester: string
          tahun_ajaran_id: string | null
          target_jumlah: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          jenis_hafalan: string
          kategori_sumber: string
          kelas_id?: string | null
          keterangan?: string | null
          satuan: string
          semester?: string
          tahun_ajaran_id?: string | null
          target_jumlah: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          jenis_hafalan?: string
          kategori_sumber?: string
          kelas_id?: string | null
          keterangan?: string | null
          satuan?: string
          semester?: string
          tahun_ajaran_id?: string | null
          target_jumlah?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "target_hafalan_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_hafalan_kelas_id_fkey"
            columns: ["kelas_id"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_hafalan_tahun_ajaran_id_fkey"
            columns: ["tahun_ajaran_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_mapel: {
        Row: {
          created_at: string | null
          id: string
          mapel_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mapel_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mapel_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_mapel_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_mapel_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tugas: {
        Row: {
          bab: string | null
          created_at: string | null
          created_by: string | null
          deskripsi: string | null
          id: string
          judul: string
          mapel_id: string
          nilai_maksimal: number | null
          semester: string
          status: string | null
          tanggal_deadline: string
          tanggal_mulai: string
          tipe_jawaban: string | null
          updated_at: string | null
        }
        Insert: {
          bab?: string | null
          created_at?: string | null
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          judul: string
          mapel_id: string
          nilai_maksimal?: number | null
          semester?: string
          status?: string | null
          tanggal_deadline: string
          tanggal_mulai: string
          tipe_jawaban?: string | null
          updated_at?: string | null
        }
        Update: {
          bab?: string | null
          created_at?: string | null
          created_by?: string | null
          deskripsi?: string | null
          id?: string
          judul?: string
          mapel_id?: string
          nilai_maksimal?: number | null
          semester?: string
          status?: string | null
          tanggal_deadline?: string
          tanggal_mulai?: string
          tipe_jawaban?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tugas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tugas_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      tujuan_pembelajaran_status: {
        Row: {
          academic_year_id: string | null
          achieved_at: string | null
          achieved_in_sesi_id: string | null
          created_at: string | null
          id: string
          mapel_id: string
          semester: string
          status: string
          tp_index: number
          updated_at: string | null
        }
        Insert: {
          academic_year_id?: string | null
          achieved_at?: string | null
          achieved_in_sesi_id?: string | null
          created_at?: string | null
          id?: string
          mapel_id: string
          semester?: string
          status?: string
          tp_index: number
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string | null
          achieved_at?: string | null
          achieved_in_sesi_id?: string | null
          created_at?: string | null
          id?: string
          mapel_id?: string
          semester?: string
          status?: string
          tp_index?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tujuan_pembelajaran_status_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tujuan_pembelajaran_status_achieved_in_sesi_id_fkey"
            columns: ["achieved_in_sesi_id"]
            isOneToOne: false
            referencedRelation: "sesi_pembelajaran"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tujuan_pembelajaran_status_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
        ]
      }
      ujian: {
        Row: {
          ai_grading_enabled: boolean
          created_at: string | null
          durasi_menit: number | null
          id: string
          jenis: string
          mapel_id: string
          pengawas_id: string | null
          ruangan: string | null
          status: string | null
          tanggal_pelaksanaan: string
          updated_at: string | null
          waktu_mulai: string | null
        }
        Insert: {
          ai_grading_enabled?: boolean
          created_at?: string | null
          durasi_menit?: number | null
          id?: string
          jenis: string
          mapel_id: string
          pengawas_id?: string | null
          ruangan?: string | null
          status?: string | null
          tanggal_pelaksanaan: string
          updated_at?: string | null
          waktu_mulai?: string | null
        }
        Update: {
          ai_grading_enabled?: boolean
          created_at?: string | null
          durasi_menit?: number | null
          id?: string
          jenis?: string
          mapel_id?: string
          pengawas_id?: string | null
          ruangan?: string | null
          status?: string | null
          tanggal_pelaksanaan?: string
          updated_at?: string | null
          waktu_mulai?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ujian_mapel_id_fkey"
            columns: ["mapel_id"]
            isOneToOne: false
            referencedRelation: "mapel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ujian_pengawas_id_fkey"
            columns: ["pengawas_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ujian_jawaban: {
        Row: {
          created_at: string | null
          id: string
          is_benar: boolean | null
          is_manual_graded: boolean | null
          is_ragu: boolean | null
          jawaban: string | null
          nilai: number | null
          peserta_id: string
          soal_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_benar?: boolean | null
          is_manual_graded?: boolean | null
          is_ragu?: boolean | null
          jawaban?: string | null
          nilai?: number | null
          peserta_id: string
          soal_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_benar?: boolean | null
          is_manual_graded?: boolean | null
          is_ragu?: boolean | null
          jawaban?: string | null
          nilai?: number | null
          peserta_id?: string
          soal_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ujian_jawaban_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "ujian_peserta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ujian_jawaban_soal_id_fkey"
            columns: ["soal_id"]
            isOneToOne: false
            referencedRelation: "ujian_soal"
            referencedColumns: ["id"]
          },
        ]
      }
      ujian_peserta: {
        Row: {
          created_at: string | null
          id: string
          nilai_total: number | null
          santri_id: string
          status_kehadiran: string | null
          ujian_id: string
          waktu_mulai: string | null
          waktu_selesai: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nilai_total?: number | null
          santri_id: string
          status_kehadiran?: string | null
          ujian_id: string
          waktu_mulai?: string | null
          waktu_selesai?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nilai_total?: number | null
          santri_id?: string
          status_kehadiran?: string | null
          ujian_id?: string
          waktu_mulai?: string | null
          waktu_selesai?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ujian_peserta_santri_id_fkey"
            columns: ["santri_id"]
            isOneToOne: false
            referencedRelation: "santri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ujian_peserta_ujian_id_fkey"
            columns: ["ujian_id"]
            isOneToOne: false
            referencedRelation: "ujian"
            referencedColumns: ["id"]
          },
        ]
      }
      ujian_soal: {
        Row: {
          bobot_nilai: number | null
          created_at: string | null
          gambar_pembahasan: string | null
          gambar_pertanyaan: string | null
          id: string
          jenis_soal: string
          kunci_jawaban: string | null
          nomor_urut: number
          pembahasan: string | null
          pertanyaan: string
          ujian_id: string
          updated_at: string | null
        }
        Insert: {
          bobot_nilai?: number | null
          created_at?: string | null
          gambar_pembahasan?: string | null
          gambar_pertanyaan?: string | null
          id?: string
          jenis_soal: string
          kunci_jawaban?: string | null
          nomor_urut: number
          pembahasan?: string | null
          pertanyaan: string
          ujian_id: string
          updated_at?: string | null
        }
        Update: {
          bobot_nilai?: number | null
          created_at?: string | null
          gambar_pembahasan?: string | null
          gambar_pertanyaan?: string | null
          id?: string
          jenis_soal?: string
          kunci_jawaban?: string | null
          nomor_urut?: number
          pembahasan?: string | null
          pertanyaan?: string
          ujian_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ujian_soal_ujian_id_fkey"
            columns: ["ujian_id"]
            isOneToOne: false
            referencedRelation: "ujian"
            referencedColumns: ["id"]
          },
        ]
      }
      ujian_soal_opsi: {
        Row: {
          created_at: string | null
          gambar: string | null
          id: string
          is_kunci: boolean | null
          label: string
          soal_id: string
          teks: string
        }
        Insert: {
          created_at?: string | null
          gambar?: string | null
          id?: string
          is_kunci?: boolean | null
          label: string
          soal_id: string
          teks: string
        }
        Update: {
          created_at?: string | null
          gambar?: string | null
          id?: string
          is_kunci?: boolean | null
          label?: string
          soal_id?: string
          teks?: string
        }
        Relationships: [
          {
            foreignKeyName: "ujian_soal_opsi_soal_id_fkey"
            columns: ["soal_id"]
            isOneToOne: false
            referencedRelation: "ujian_soal"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_end_expired_exams: { Args: never; Returns: undefined }
      check_tagihan_jatuh_tempo: { Args: never; Returns: undefined }
      create_notification: {
        Args: { _message: string; _title: string; _user_id: string }
        Returns: string
      }
      delete_user_cascade: {
        Args: { user_id_to_delete: string }
        Returns: undefined
      }
      get_profile_names: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_parent_of: {
        Args: { _child_id: string; _parent_id: string }
        Returns: boolean
      }
      mark_peminjaman_terlambat: { Args: never; Returns: undefined }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      sync_tp_status_from_sesi: {
        Args: { _sesi_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "guru"
        | "walikelas"
        | "santri"
        | "orangtua"
        | "Pembina"
        | "staff"
        | "guru_ekskul"
      forum_post_type: "announcement" | "qna" | "resource"
      jenis_izin: "sakit" | "izin" | "cuti" | "dinas_luar" | "lainnya"
      mapel_kategori: "wajib" | "pilihan" | "ekstrakurikuler" | "asrama"
      mapel_status: "aktif" | "nonaktif"
      status_izin: "pending" | "approved" | "rejected"
      user_status: "aktif" | "nonaktif" | "cuti" | "alumni"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "guru",
        "walikelas",
        "santri",
        "orangtua",
        "Pembina",
        "staff",
        "guru_ekskul",
      ],
      forum_post_type: ["announcement", "qna", "resource"],
      jenis_izin: ["sakit", "izin", "cuti", "dinas_luar", "lainnya"],
      mapel_kategori: ["wajib", "pilihan", "ekstrakurikuler", "asrama"],
      mapel_status: ["aktif", "nonaktif"],
      status_izin: ["pending", "approved", "rejected"],
      user_status: ["aktif", "nonaktif", "cuti", "alumni"],
    },
  },
} as const
