-- Tabel utama ujian
CREATE TABLE IF NOT EXISTS public.ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapel_id UUID REFERENCES public.mapel(id) ON DELETE CASCADE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('harian', 'uts', 'uas', 'uas_sekolah')),
  tanggal_pelaksanaan DATE NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  ruangan TEXT,
  pengawas_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'terjadwal' CHECK (status IN ('terjadwal', 'berlangsung', 'selesai')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel soal ujian
CREATE TABLE IF NOT EXISTS public.ujian_soal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID REFERENCES public.ujian(id) ON DELETE CASCADE NOT NULL,
  nomor_urut INTEGER NOT NULL,
  jenis_soal TEXT NOT NULL CHECK (jenis_soal IN ('pilihan_ganda', 'essai', 'true_false')),
  pertanyaan TEXT NOT NULL,
  gambar_pertanyaan TEXT,
  pembahasan TEXT,
  gambar_pembahasan TEXT,
  bobot_nilai NUMERIC(5,2) DEFAULT 1,
  kunci_jawaban TEXT, -- untuk true_false ('benar'/'salah') dan essai (poin penting)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel opsi jawaban (untuk pilihan ganda)
CREATE TABLE IF NOT EXISTS public.ujian_soal_opsi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soal_id UUID REFERENCES public.ujian_soal(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL, -- A, B, C, D, E
  teks TEXT NOT NULL,
  gambar TEXT,
  is_kunci BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel peserta ujian
CREATE TABLE IF NOT EXISTS public.ujian_peserta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID REFERENCES public.ujian(id) ON DELETE CASCADE NOT NULL,
  santri_id UUID REFERENCES public.santri(id) ON DELETE CASCADE NOT NULL,
  status_kehadiran TEXT DEFAULT 'belum' CHECK (status_kehadiran IN ('belum', 'hadir', 'tidak_hadir')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ujian_id, santri_id)
);

-- Tabel jawaban santri
CREATE TABLE IF NOT EXISTS public.ujian_jawaban (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id UUID REFERENCES public.ujian_peserta(id) ON DELETE CASCADE NOT NULL,
  soal_id UUID REFERENCES public.ujian_soal(id) ON DELETE CASCADE NOT NULL,
  jawaban TEXT,
  is_benar BOOLEAN,
  nilai NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_soal_opsi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_jawaban ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ujian
DO $$
BEGIN
  CREATE POLICY "Authenticated users can view ujian"
    ON public.ujian FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert ujian"
    ON public.ujian FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update ujian"
    ON public.ujian FOR UPDATE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete ujian"
    ON public.ujian FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for ujian_soal
DO $$
BEGIN
  CREATE POLICY "Authenticated users can view ujian_soal"
    ON public.ujian_soal FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert ujian_soal"
    ON public.ujian_soal FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update ujian_soal"
    ON public.ujian_soal FOR UPDATE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete ujian_soal"
    ON public.ujian_soal FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for ujian_soal_opsi
DO $$
BEGIN
  CREATE POLICY "Authenticated users can view ujian_soal_opsi"
    ON public.ujian_soal_opsi FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert ujian_soal_opsi"
    ON public.ujian_soal_opsi FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update ujian_soal_opsi"
    ON public.ujian_soal_opsi FOR UPDATE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete ujian_soal_opsi"
    ON public.ujian_soal_opsi FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for ujian_peserta
DO $$
BEGIN
  CREATE POLICY "Authenticated users can view ujian_peserta"
    ON public.ujian_peserta FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert ujian_peserta"
    ON public.ujian_peserta FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update ujian_peserta"
    ON public.ujian_peserta FOR UPDATE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete ujian_peserta"
    ON public.ujian_peserta FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for ujian_jawaban
DO $$
BEGIN
  CREATE POLICY "Authenticated users can view ujian_jawaban"
    ON public.ujian_jawaban FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert ujian_jawaban"
    ON public.ujian_jawaban FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update ujian_jawaban"
    ON public.ujian_jawaban FOR UPDATE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete ujian_jawaban"
    ON public.ujian_jawaban FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger untuk update timestamp
DO $$
BEGIN
  CREATE TRIGGER update_ujian_updated_at
    BEFORE UPDATE ON public.ujian
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_ujian_soal_updated_at
    BEFORE UPDATE ON public.ujian_soal
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_ujian_jawaban_updated_at
    BEFORE UPDATE ON public.ujian_jawaban
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
