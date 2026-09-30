-- 1. Function: sync TP status from a sesi_pembelajaran row
CREATE OR REPLACE FUNCTION public.sync_tp_status_from_sesi(_sesi_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metadata jsonb;
  v_materi_id uuid;
  v_mapel_id uuid;
  v_semester text;
  v_academic_year_id uuid;
  v_achieved_at timestamptz;
  v_tp_ids int[];
  v_tp_id int;
  v_existing record;
BEGIN
  SELECT s.metadata, s.waktu_selesai, j.mapel_id, j.semester
    INTO v_metadata, v_achieved_at, v_mapel_id, v_semester
  FROM public.sesi_pembelajaran s
  JOIN public.jadwal j ON j.id = s.jadwal_id
  WHERE s.id = _sesi_id AND s.status = 'selesai';

  IF v_metadata IS NULL OR v_mapel_id IS NULL THEN RETURN; END IF;

  v_materi_id := NULLIF(v_metadata->>'materi_id','')::uuid;
  IF v_materi_id IS NULL THEN RETURN; END IF;

  -- parse tujuan_tercapai_ids
  IF jsonb_typeof(v_metadata->'tujuan_tercapai_ids') = 'array' THEN
    SELECT array_agg((value)::int)
      INTO v_tp_ids
    FROM jsonb_array_elements_text(v_metadata->'tujuan_tercapai_ids') AS value;
  END IF;

  IF v_tp_ids IS NULL OR array_length(v_tp_ids, 1) IS NULL THEN RETURN; END IF;

  -- pick active academic year if not on jadwal
  SELECT id INTO v_academic_year_id FROM public.academic_years WHERE is_active = true LIMIT 1;
  IF v_semester IS NULL THEN v_semester := 'ganjil'; END IF;
  v_achieved_at := COALESCE(v_achieved_at, now());

  FOREACH v_tp_id IN ARRAY v_tp_ids LOOP
    SELECT id, status INTO v_existing
    FROM public.tujuan_pembelajaran_status
    WHERE mapel_id = v_mapel_id
      AND tp_index = v_tp_id
      AND semester = v_semester
      AND academic_year_id = v_academic_year_id;

    IF FOUND THEN
      IF v_existing.status IS DISTINCT FROM 'tercapai' THEN
        UPDATE public.tujuan_pembelajaran_status
        SET status = 'tercapai',
            achieved_in_sesi_id = _sesi_id,
            achieved_at = v_achieved_at
        WHERE id = v_existing.id;
      END IF;
    ELSE
      INSERT INTO public.tujuan_pembelajaran_status
        (mapel_id, tp_index, status, achieved_in_sesi_id, achieved_at, semester, academic_year_id)
      VALUES
        (v_mapel_id, v_tp_id, 'tercapai', _sesi_id, v_achieved_at, v_semester, v_academic_year_id);
    END IF;
  END LOOP;
END;
$$;

-- 2. Trigger function on sesi_pembelajaran
CREATE OR REPLACE FUNCTION public.trg_sync_tp_status_on_sesi_selesai()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'selesai'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.metadata IS DISTINCT FROM NEW.metadata)
  THEN
    PERFORM public.sync_tp_status_from_sesi(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_tp_status_on_sesi_selesai ON public.sesi_pembelajaran;
CREATE TRIGGER sync_tp_status_on_sesi_selesai
AFTER INSERT OR UPDATE OF status, metadata ON public.sesi_pembelajaran
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_tp_status_on_sesi_selesai();

-- 3. Backfill: replay all completed sessions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.sesi_pembelajaran
    WHERE status = 'selesai'
      AND metadata ? 'tujuan_tercapai_ids'
  LOOP
    PERFORM public.sync_tp_status_from_sesi(r.id);
  END LOOP;
END $$;