
-- 1. Create tagihan_santri junction table
CREATE TABLE IF NOT EXISTS public.tagihan_santri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id uuid NOT NULL REFERENCES public.tagihan(id) ON DELETE CASCADE,
  santri_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'belum_bayar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Migrate existing tagihan → tagihan_santri
DO $$
BEGIN
  IF to_regclass('public.tagihan_santri') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tagihan' AND column_name = 'santri_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tagihan' AND column_name = 'status'
    )
  THEN
    INSERT INTO public.tagihan_santri (tagihan_id, santri_id, status)
    SELECT t.id, t.santri_id, t.status
    FROM public.tagihan t
    WHERE t.santri_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tagihan_santri ts
        WHERE ts.tagihan_id = t.id AND ts.santri_id IS NOT DISTINCT FROM t.santri_id
      );
  END IF;
END $$;

-- 3. Add tagihan_santri_id to pembayaran
ALTER TABLE public.pembayaran
ADD COLUMN IF NOT EXISTS tagihan_santri_id uuid REFERENCES public.tagihan_santri(id) ON DELETE SET NULL;

-- 4. Link existing pembayaran to tagihan_santri
DO $$
BEGIN
  IF to_regclass('public.pembayaran') IS NOT NULL
    AND to_regclass('public.tagihan_santri') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pembayaran' AND column_name = 'tagihan_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pembayaran' AND column_name = 'tagihan_santri_id'
    )
  THEN
    UPDATE public.pembayaran p
    SET tagihan_santri_id = (
      SELECT ts.id FROM public.tagihan_santri ts
      WHERE ts.tagihan_id = p.tagihan_id
      LIMIT 1
    )
    WHERE p.tagihan_santri_id IS NULL;
  END IF;
END $$;

-- 5. Drop old trigger and create new one
DROP TRIGGER IF EXISTS trg_update_tagihan_on_pembayaran ON public.pembayaran;
DROP FUNCTION IF EXISTS public.update_tagihan_on_pembayaran();

CREATE OR REPLACE FUNCTION public.update_tagihan_santri_on_pembayaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tagihan_santri_id IS NOT NULL THEN
    UPDATE public.tagihan_santri
    SET status = 'menunggu_verifikasi', updated_at = now()
    WHERE id = NEW.tagihan_santri_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_tagihan_santri_on_pembayaran
  AFTER INSERT ON public.pembayaran
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tagihan_santri_on_pembayaran();

-- 6. Drop dependent RLS policies BEFORE dropping columns
DROP POLICY IF EXISTS "Orangtua read tagihan anak" ON public.tagihan;
DROP POLICY IF EXISTS "Santri read own tagihan" ON public.tagihan;
DROP POLICY IF EXISTS "Parents can view their children tagihan line items" ON public.tagihan_line_items;
DROP POLICY IF EXISTS "Santri can view own tagihan line items" ON public.tagihan_line_items;

-- 7. Now safely remove columns from tagihan
ALTER TABLE public.tagihan DROP COLUMN IF EXISTS status;
ALTER TABLE public.tagihan DROP COLUMN IF EXISTS santri_id;

-- 8. Enable RLS on tagihan_santri
ALTER TABLE public.tagihan_santri ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Admin full access tagihan_santri" ON public.tagihan_santri
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents view children tagihan_santri" ON public.tagihan_santri
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.parent_children pc
        WHERE pc.parent_id = auth.uid() AND pc.child_id = tagihan_santri.santri_id
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri view own tagihan_santri" ON public.tagihan_santri
    FOR SELECT TO authenticated
    USING (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 9. Recreate RLS policies for tagihan via tagihan_santri
DO $$
BEGIN
  CREATE POLICY "Parents view children tagihan" ON public.tagihan
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.tagihan_santri ts
        JOIN public.parent_children pc ON pc.child_id = ts.santri_id
        WHERE ts.tagihan_id = tagihan.id AND pc.parent_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri view own tagihan" ON public.tagihan
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.tagihan_santri ts
        WHERE ts.tagihan_id = tagihan.id AND ts.santri_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 10. Recreate RLS policies for tagihan_line_items via tagihan_santri
DO $$
BEGIN
  CREATE POLICY "Parents view children tagihan line items" ON public.tagihan_line_items
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.tagihan_santri ts
        JOIN public.parent_children pc ON pc.child_id = ts.santri_id
        WHERE ts.tagihan_id = tagihan_line_items.tagihan_id AND pc.parent_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri view own tagihan line items" ON public.tagihan_line_items
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.tagihan_santri ts
        WHERE ts.tagihan_id = tagihan_line_items.tagihan_id AND ts.santri_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 11. Updated_at trigger for tagihan_santri
DO $$
BEGIN
  CREATE TRIGGER set_tagihan_santri_updated_at
    BEFORE UPDATE ON public.tagihan_santri
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 12. Update delete_user_cascade
CREATE OR REPLACE FUNCTION public.delete_user_cascade(user_id_to_delete uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.affective_finalization SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.affective_scores SET assessed_by = NULL WHERE assessed_by = user_id_to_delete;
  UPDATE public.bank_soal SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.cambridge_documents SET uploaded_by = NULL WHERE uploaded_by = user_id_to_delete;
  UPDATE public.cambridge_finalization SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.hafalan_finalization SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.konseling_records SET recorded_by = NULL WHERE recorded_by = user_id_to_delete;
  UPDATE public.pengajuan_izin_staff SET approved_by = NULL WHERE approved_by = user_id_to_delete;
  UPDATE public.pengajuan_izin_santri SET approved_by = NULL WHERE approved_by = user_id_to_delete;
  UPDATE public.psikologi_finalization SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.raport_finalization SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.santri_psikologi_reports SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.semester_grades SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.tahfidz_finalization SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.target_hafalan SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.tagihan_santri SET santri_id = NULL WHERE santri_id = user_id_to_delete;
  UPDATE public.pembayaran SET submitted_by = NULL WHERE submitted_by = user_id_to_delete;
  DELETE FROM public.guru_pengganti WHERE guru_asli_id = user_id_to_delete OR guru_pengganti_id = user_id_to_delete;
  DELETE FROM public.setoran_hafalan WHERE penguji_id = user_id_to_delete;
  DELETE FROM public.tahfidz_tahsin WHERE penguji_id = user_id_to_delete;
  UPDATE public.materi SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.tugas SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.banners SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.kalender_events SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.bahan_belajar SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.asesmen_sumatif SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.kelas SET walikelas_id = NULL WHERE walikelas_id = user_id_to_delete;
  UPDATE public.kalender_events SET pic_id = NULL WHERE pic_id = user_id_to_delete;
  DELETE FROM public.subject_forum_comments WHERE user_id = user_id_to_delete;
  DELETE FROM public.subject_forum_posts WHERE user_id = user_id_to_delete;
  DELETE FROM public.notifications WHERE user_id = user_id_to_delete;
  DELETE FROM public.push_subscriptions WHERE user_id = user_id_to_delete;
  DELETE FROM public.activity_logs WHERE user_id = user_id_to_delete;
  DELETE FROM public.orangtua WHERE id = user_id_to_delete;
  DELETE FROM public.santri WHERE id = user_id_to_delete;
  DELETE FROM public.staff WHERE id = user_id_to_delete;
  DELETE FROM public.user_roles WHERE user_id = user_id_to_delete;
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$function$;
