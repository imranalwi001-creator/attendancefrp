-- ============ KATEGORI BUKU ============
CREATE TABLE IF NOT EXISTS public.buku_kategori (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL UNIQUE,
  warna TEXT NOT NULL DEFAULT 'bg-violet-500',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.buku_kategori ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Authenticated can view kategori"
    ON public.buku_kategori FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin manage kategori"
    ON public.buku_kategori FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER trg_buku_kategori_updated
    BEFORE UPDATE ON public.buku_kategori
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============ BUKU ============
CREATE TABLE IF NOT EXISTS public.buku (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_buku TEXT UNIQUE NOT NULL,
  judul TEXT NOT NULL,
  penulis TEXT,
  penerbit TEXT,
  tahun_terbit INT,
  kategori TEXT,
  lokasi_rak TEXT,
  isbn TEXT,
  cover_url TEXT,
  deskripsi TEXT,
  total_eksemplar INT NOT NULL DEFAULT 1 CHECK (total_eksemplar >= 0),
  tersedia INT NOT NULL DEFAULT 1 CHECK (tersedia >= 0),
  status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia','habis','arsip')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buku_kategori ON public.buku(kategori);
CREATE INDEX IF NOT EXISTS idx_buku_status ON public.buku(status);
CREATE INDEX IF NOT EXISTS idx_buku_judul ON public.buku USING gin(to_tsvector('simple', judul));

ALTER TABLE public.buku ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Authenticated can view buku"
    ON public.buku FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin manage buku"
    ON public.buku FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER trg_buku_updated
    BEFORE UPDATE ON public.buku
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Auto-generate kode_buku
CREATE OR REPLACE FUNCTION public.generate_kode_buku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.kode_buku IS NULL OR NEW.kode_buku = '' THEN
    LOOP
      new_code := 'LIB-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.buku WHERE kode_buku = new_code);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        new_code := 'LIB-' || LPAD(EXTRACT(EPOCH FROM now())::BIGINT::TEXT, 6, '0');
        EXIT;
      END IF;
    END LOOP;
    NEW.kode_buku := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER trg_buku_generate_kode
    BEFORE INSERT ON public.buku
    FOR EACH ROW EXECUTE FUNCTION public.generate_kode_buku();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Auto-update status berdasarkan tersedia
CREATE OR REPLACE FUNCTION public.sync_buku_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != 'arsip' THEN
    IF NEW.tersedia <= 0 THEN
      NEW.status := 'habis';
    ELSE
      NEW.status := 'tersedia';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER trg_buku_sync_status
    BEFORE INSERT OR UPDATE OF tersedia ON public.buku
    FOR EACH ROW EXECUTE FUNCTION public.sync_buku_status();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============ PEMINJAMAN BUKU ============
CREATE TABLE IF NOT EXISTS public.peminjaman_buku (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buku_id UUID NOT NULL REFERENCES public.buku(id) ON DELETE CASCADE,
  santri_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tanggal_pinjam DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_jatuh_tempo DATE NOT NULL,
  tanggal_kembali DATE,
  status TEXT NOT NULL DEFAULT 'dipinjam' CHECK (status IN ('dipinjam','dikembalikan','terlambat','hilang')),
  denda NUMERIC(12,2) NOT NULL DEFAULT 0,
  petugas_pinjam_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  petugas_kembali_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peminjaman_buku ON public.peminjaman_buku(buku_id);
CREATE INDEX IF NOT EXISTS idx_peminjaman_santri ON public.peminjaman_buku(santri_id);
CREATE INDEX IF NOT EXISTS idx_peminjaman_status ON public.peminjaman_buku(status);
CREATE INDEX IF NOT EXISTS idx_peminjaman_jatuh_tempo ON public.peminjaman_buku(tanggal_jatuh_tempo);

ALTER TABLE public.peminjaman_buku ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Santri view own peminjaman"
    ON public.peminjaman_buku FOR SELECT TO authenticated
    USING (
      santri_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.is_parent_of(auth.uid(), santri_id)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin manage peminjaman"
    ON public.peminjaman_buku FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER trg_peminjaman_updated
    BEFORE UPDATE ON public.peminjaman_buku
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Auto-decrement / increment buku.tersedia
CREATE OR REPLACE FUNCTION public.sync_buku_tersedia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('dipinjam','terlambat') THEN
      UPDATE public.buku SET tersedia = GREATEST(tersedia - 1, 0), updated_at = now() WHERE id = NEW.buku_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Aktif -> selesai (kembali/hilang)
    IF OLD.status IN ('dipinjam','terlambat') AND NEW.status IN ('dikembalikan','hilang') THEN
      IF NEW.status = 'dikembalikan' THEN
        UPDATE public.buku SET tersedia = LEAST(tersedia + 1, total_eksemplar), updated_at = now() WHERE id = NEW.buku_id;
      ELSE
        -- hilang: kurangi total_eksemplar juga
        UPDATE public.buku SET total_eksemplar = GREATEST(total_eksemplar - 1, 0), updated_at = now() WHERE id = NEW.buku_id;
      END IF;
    -- Selesai -> aktif (revert)
    ELSIF OLD.status IN ('dikembalikan','hilang') AND NEW.status IN ('dipinjam','terlambat') THEN
      UPDATE public.buku SET tersedia = GREATEST(tersedia - 1, 0), updated_at = now() WHERE id = NEW.buku_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('dipinjam','terlambat') THEN
      UPDATE public.buku SET tersedia = LEAST(tersedia + 1, total_eksemplar), updated_at = now() WHERE id = OLD.buku_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER trg_peminjaman_sync_buku
    AFTER INSERT OR UPDATE OR DELETE ON public.peminjaman_buku
    FOR EACH ROW EXECUTE FUNCTION public.sync_buku_tersedia();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Auto-mark terlambat (cron)
CREATE OR REPLACE FUNCTION public.mark_peminjaman_terlambat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.peminjaman_buku
  SET status = 'terlambat', updated_at = now()
  WHERE status = 'dipinjam'
    AND tanggal_jatuh_tempo < CURRENT_DATE;
END;
$$;

-- Schedule cron (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mark-peminjaman-terlambat-daily') 
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-peminjaman-terlambat-daily');
    PERFORM cron.schedule(
      'mark-peminjaman-terlambat-daily',
      '5 0 * * *',
      $cron$ SELECT public.mark_peminjaman_terlambat(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Seed kategori default
INSERT INTO public.buku_kategori (nama, warna)
SELECT v.nama, v.warna
FROM (
  VALUES
    ('Fiksi', 'bg-blue-500'),
    ('Non-Fiksi', 'bg-emerald-500'),
    ('Pelajaran', 'bg-amber-500'),
    ('Agama', 'bg-violet-500'),
    ('Referensi', 'bg-rose-500'),
    ('Majalah', 'bg-cyan-500')
) AS v(nama, warna)
WHERE NOT EXISTS (
  SELECT 1 FROM public.buku_kategori bk WHERE bk.nama = v.nama
);
