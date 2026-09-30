CREATE TABLE IF NOT EXISTS public.pengajuan_peminjaman (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buku_id uuid NOT NULL REFERENCES public.buku(id) ON DELETE CASCADE,
  santri_id uuid NOT NULL,
  catatan text,
  status text NOT NULL DEFAULT 'menunggu',
  alasan_penolakan text,
  diproses_oleh uuid,
  diproses_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pengajuan_peminjaman_santri ON public.pengajuan_peminjaman(santri_id);
CREATE INDEX IF NOT EXISTS idx_pengajuan_peminjaman_status ON public.pengajuan_peminjaman(status);

ALTER TABLE public.pengajuan_peminjaman ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Santri bisa lihat pengajuan sendiri"
  ON public.pengajuan_peminjaman FOR SELECT
  TO authenticated
  USING (santri_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri bisa membuat pengajuan untuk dirinya"
  ON public.pengajuan_peminjaman FOR INSERT
  TO authenticated
  WITH CHECK (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin bisa update pengajuan"
  ON public.pengajuan_peminjaman FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri bisa batalkan pengajuan menunggu sendiri"
  ON public.pengajuan_peminjaman FOR DELETE
  TO authenticated
  USING (santri_id = auth.uid() AND status = 'menunggu');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_pengajuan_peminjaman_updated_at
  BEFORE UPDATE ON public.pengajuan_peminjaman
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
