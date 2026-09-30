CREATE OR REPLACE FUNCTION public.trg_sync_tp_status_on_sesi_selesai()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_should_sync boolean := false;
  v_old_tp jsonb;
  v_new_tp jsonb;
  v_old_materi text;
  v_new_materi text;
BEGIN
  -- Hanya pertimbangkan sesi yang sudah selesai
  IF NEW.status <> 'selesai' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Sesi baru langsung selesai → sync
    v_should_sync := true;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Transisi status menjadi selesai → sync
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_should_sync := true;
    ELSE
      -- Status tetap selesai → hanya sync jika field metadata yang relevan berubah
      v_old_tp := COALESCE(OLD.metadata->'tujuan_tercapai_ids', '[]'::jsonb);
      v_new_tp := COALESCE(NEW.metadata->'tujuan_tercapai_ids', '[]'::jsonb);
      v_old_materi := OLD.metadata->>'materi_id';
      v_new_materi := NEW.metadata->>'materi_id';

      IF v_old_tp IS DISTINCT FROM v_new_tp
         OR v_old_materi IS DISTINCT FROM v_new_materi THEN
        v_should_sync := true;
      END IF;
    END IF;
  END IF;

  IF v_should_sync THEN
    PERFORM public.sync_tp_status_from_sesi(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;