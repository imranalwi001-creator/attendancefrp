
-- ============================================
-- TAHAP 1: Tagihan SPP - Database Foundation
-- ============================================

-- 1. Tabel metode_pembayaran
CREATE TABLE IF NOT EXISTS public.metode_pembayaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_bank text NOT NULL,
  nomor_rekening text NOT NULL,
  atas_nama text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabel tagihan
CREATE TABLE IF NOT EXISTS public.tagihan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kelas_id uuid NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  jenis text NOT NULL DEFAULT 'SPP',
  periode text NOT NULL,
  jumlah numeric NOT NULL,
  jatuh_tempo date NOT NULL,
  status text NOT NULL DEFAULT 'belum_bayar',
  catatan_admin text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabel pembayaran
CREATE TABLE IF NOT EXISTS public.pembayaran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id uuid NOT NULL REFERENCES public.tagihan(id) ON DELETE CASCADE,
  metode_pembayaran_id uuid NOT NULL REFERENCES public.metode_pembayaran(id) ON DELETE RESTRICT,
  bukti_url text NOT NULL,
  jumlah_bayar numeric NOT NULL,
  catatan text,
  status text NOT NULL DEFAULT 'pending',
  catatan_verifikasi text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Triggers update_updated_at
DO $$
BEGIN
  CREATE TRIGGER update_metode_pembayaran_updated_at
    BEFORE UPDATE ON public.metode_pembayaran
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_tagihan_updated_at
    BEFORE UPDATE ON public.tagihan
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_pembayaran_updated_at
    BEFORE UPDATE ON public.pembayaran
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bukti-pembayaran', 'bukti-pembayaran', false)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS - Enable
ALTER TABLE public.metode_pembayaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - metode_pembayaran
DO $$
BEGIN
  CREATE POLICY "Admin full access metode_pembayaran"
    ON public.metode_pembayaran FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated read active metode_pembayaran"
    ON public.metode_pembayaran FOR SELECT TO authenticated
    USING (is_active = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 8. RLS Policies - tagihan
DO $$
BEGIN
  CREATE POLICY "Admin full access tagihan"
    ON public.tagihan FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'santri_id'
  ) THEN
    CREATE POLICY "Orangtua read tagihan anak"
      ON public.tagihan FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), 'orangtua')
        AND public.is_parent_of(auth.uid(), santri_id)
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 9. RLS Policies - pembayaran
DO $$
BEGIN
  CREATE POLICY "Admin full access pembayaran"
    ON public.pembayaran FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Orangtua insert pembayaran"
    ON public.pembayaran FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'orangtua')
      AND submitted_by = auth.uid()
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Orangtua read own pembayaran"
    ON public.pembayaran FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'orangtua')
      AND submitted_by = auth.uid()
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 10. Storage RLS - bukti-pembayaran
DO $$
BEGIN
  CREATE POLICY "Admin full access bukti-pembayaran"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'bukti-pembayaran' AND public.has_role(auth.uid(), 'admin'))
    WITH CHECK (bucket_id = 'bukti-pembayaran' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Orangtua upload bukti-pembayaran"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bukti-pembayaran'
      AND public.has_role(auth.uid(), 'orangtua')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Orangtua read own bukti-pembayaran"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'bukti-pembayaran'
      AND public.has_role(auth.uid(), 'orangtua')
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
