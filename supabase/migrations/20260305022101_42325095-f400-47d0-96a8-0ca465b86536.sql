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