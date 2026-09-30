-- Fix: Tagihan should NOT be cascade-deleted when santri or kelas is removed
-- Change ON DELETE CASCADE to ON DELETE SET NULL for santri_id
ALTER TABLE public.tagihan DROP CONSTRAINT IF EXISTS tagihan_santri_id_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'santri_id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tagihan'
        AND a.attname = 'santri_id'
        AND a.attnotnull
    ) THEN
      ALTER TABLE public.tagihan ALTER COLUMN santri_id DROP NOT NULL;
    END IF;

    BEGIN
      ALTER TABLE public.tagihan ADD CONSTRAINT tagihan_santri_id_fkey 
        FOREIGN KEY (santri_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Change ON DELETE CASCADE to ON DELETE SET NULL for kelas_id  
ALTER TABLE public.tagihan DROP CONSTRAINT IF EXISTS tagihan_kelas_id_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'kelas_id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tagihan'
        AND a.attname = 'kelas_id'
        AND a.attnotnull
    ) THEN
      ALTER TABLE public.tagihan ALTER COLUMN kelas_id DROP NOT NULL;
    END IF;

    BEGIN
      ALTER TABLE public.tagihan ADD CONSTRAINT tagihan_kelas_id_fkey 
        FOREIGN KEY (kelas_id) REFERENCES public.kelas(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Also fix pembayaran_submitted_by from CASCADE to SET NULL
ALTER TABLE public.pembayaran DROP CONSTRAINT IF EXISTS pembayaran_submitted_by_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pembayaran'
      AND column_name = 'submitted_by'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'pembayaran'
        AND a.attname = 'submitted_by'
        AND a.attnotnull
    ) THEN
      ALTER TABLE public.pembayaran ALTER COLUMN submitted_by DROP NOT NULL;
    END IF;

    BEGIN
      ALTER TABLE public.pembayaran ADD CONSTRAINT pembayaran_submitted_by_fkey 
        FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Also update delete_user_cascade to nullify tagihan instead of letting cascade delete them
CREATE OR REPLACE FUNCTION public.delete_user_cascade(user_id_to_delete uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1) Handle NO ACTION references to profiles (nullable columns -> set null)
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

  -- Nullify tagihan references instead of cascade deleting
  UPDATE public.tagihan SET santri_id = NULL WHERE santri_id = user_id_to_delete;
  UPDATE public.pembayaran SET submitted_by = NULL WHERE submitted_by = user_id_to_delete;

  -- 2) Handle NO ACTION references that are NOT NULL (must delete dependents)
  DELETE FROM public.guru_pengganti
  WHERE guru_asli_id = user_id_to_delete OR guru_pengganti_id = user_id_to_delete;

  DELETE FROM public.setoran_hafalan WHERE penguji_id = user_id_to_delete;
  DELETE FROM public.tahfidz_tahsin WHERE penguji_id = user_id_to_delete;

  -- 3) Optional historical/null-safe cleanup
  UPDATE public.materi SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.tugas SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.banners SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.kalender_events SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.bahan_belajar SET created_by = NULL WHERE created_by = user_id_to_delete;
  UPDATE public.asesmen_sumatif SET finalized_by = NULL WHERE finalized_by = user_id_to_delete;
  UPDATE public.kelas SET walikelas_id = NULL WHERE walikelas_id = user_id_to_delete;
  UPDATE public.kalender_events SET pic_id = NULL WHERE pic_id = user_id_to_delete;

  -- 4) Cleanup app tables that may not have FK cascade
  DELETE FROM public.subject_forum_comments WHERE user_id = user_id_to_delete;
  DELETE FROM public.subject_forum_posts WHERE user_id = user_id_to_delete;
  DELETE FROM public.notifications WHERE user_id = user_id_to_delete;
  DELETE FROM public.push_subscriptions WHERE user_id = user_id_to_delete;
  DELETE FROM public.activity_logs WHERE user_id = user_id_to_delete;

  -- 5) Remove role-specific entities (their FK cascades clean dependent rows)
  DELETE FROM public.orangtua WHERE id = user_id_to_delete;
  DELETE FROM public.santri WHERE id = user_id_to_delete;
  DELETE FROM public.staff WHERE id = user_id_to_delete;

  -- 6) Remove identity records
  DELETE FROM public.user_roles WHERE user_id = user_id_to_delete;
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$function$;
