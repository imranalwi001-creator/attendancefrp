
-- 1. notify_tagihan_baru: trigger on tagihan_santri INSERT
CREATE OR REPLACE FUNCTION public.notify_tagihan_baru()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tagihan_record RECORD;
  santri_name text;
  parent_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Get tagihan info
  SELECT t.nama, t.jatuh_tempo INTO tagihan_record
  FROM tagihan t
  JOIN tagihan_santri ts ON ts.tagihan_id = t.id
  WHERE ts.id = NEW.id;

  IF tagihan_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get santri name
  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = NEW.santri_id;

  notification_title := 'Tagihan Baru';
  notification_message := 'Tagihan baru telah ditambahkan: ' || COALESCE(tagihan_record.nama, 'Tagihan');

  -- In-app notification for santri
  IF NEW.santri_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.santri_id,
      notification_title,
      notification_message
    );

    -- In-app notification for parents
    FOR parent_record IN
      SELECT parent_id FROM parent_children WHERE child_id = NEW.santri_id
    LOOP
      PERFORM create_notification(
        parent_record.parent_id,
        notification_title,
        COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message
      );
    END LOOP;

    -- Push notification
    PERFORM net.http_post(
      url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
      body := jsonb_build_object(
        'type', 'tagihan_baru',
        'record', jsonb_build_object(
          'santri_id', NEW.santri_id,
          'santri_name', COALESCE(santri_name, 'Santri'),
          'tagihan_nama', COALESCE(tagihan_record.nama, 'Tagihan'),
          'jatuh_tempo', tagihan_record.jatuh_tempo
        )
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 5000
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_tagihan_baru
  AFTER INSERT ON public.tagihan_santri
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tagihan_baru();

-- 2. notify_pembayaran_ditolak: trigger on pembayaran UPDATE when status = 'ditolak'
CREATE OR REPLACE FUNCTION public.notify_pembayaran_ditolak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ts_record RECORD;
  tagihan_nama text;
  santri_name text;
  parent_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Only fire when status changes to 'ditolak'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status != 'ditolak' THEN
    RETURN NEW;
  END IF;

  -- Get tagihan_santri and tagihan info
  SELECT ts.santri_id, t.nama AS tagihan_nama
  INTO ts_record
  FROM tagihan_santri ts
  JOIN tagihan t ON t.id = ts.tagihan_id
  WHERE ts.id = NEW.tagihan_santri_id;

  IF ts_record IS NULL OR ts_record.santri_id IS NULL THEN
    RETURN NEW;
  END IF;

  tagihan_nama := COALESCE(ts_record.tagihan_nama, 'Tagihan');

  -- Get santri name
  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = ts_record.santri_id;

  notification_title := 'Pembayaran Ditolak';
  notification_message := 'Pembayaran untuk ' || tagihan_nama || ' telah ditolak. Silakan upload ulang bukti pembayaran.';

  -- Notify santri
  PERFORM create_notification(
    ts_record.santri_id,
    notification_title,
    notification_message
  );

  -- Notify parents
  FOR parent_record IN
    SELECT parent_id FROM parent_children WHERE child_id = ts_record.santri_id
  LOOP
    PERFORM create_notification(
      parent_record.parent_id,
      notification_title,
      COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message
    );
  END LOOP;

  -- Push notification
  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'pembayaran_ditolak',
      'record', jsonb_build_object(
        'santri_id', ts_record.santri_id,
        'santri_name', COALESCE(santri_name, 'Santri'),
        'tagihan_nama', tagihan_nama
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_pembayaran_ditolak
  AFTER UPDATE ON public.pembayaran
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pembayaran_ditolak();

-- 3. notify_pembayaran_pending: trigger on pembayaran INSERT
CREATE OR REPLACE FUNCTION public.notify_pembayaran_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ts_record RECORD;
  santri_name text;
  admin_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Get santri info from tagihan_santri
  SELECT ts.santri_id, t.nama AS tagihan_nama
  INTO ts_record
  FROM tagihan_santri ts
  JOIN tagihan t ON t.id = ts.tagihan_id
  WHERE ts.id = NEW.tagihan_santri_id;

  -- Get santri name
  IF ts_record IS NOT NULL AND ts_record.santri_id IS NOT NULL THEN
    SELECT p.name INTO santri_name
    FROM profiles p
    WHERE p.id = ts_record.santri_id;
  END IF;

  notification_title := 'Pembayaran Baru Menunggu Verifikasi';
  notification_message := COALESCE(santri_name, 'Santri') || ' telah mengupload bukti pembayaran untuk ' || COALESCE(ts_record.tagihan_nama, 'tagihan');

  -- Notify all admins
  FOR admin_record IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    PERFORM create_notification(
      admin_record.user_id,
      notification_title,
      notification_message
    );
  END LOOP;

  -- Push notification to admins
  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'pembayaran_pending',
      'record', jsonb_build_object(
        'santri_name', COALESCE(santri_name, 'Santri'),
        'tagihan_nama', COALESCE(ts_record.tagihan_nama, 'Tagihan'),
        'pembayaran_id', NEW.id
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_pembayaran_pending
  AFTER INSERT ON public.pembayaran
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pembayaran_pending();

-- 4. check_tagihan_jatuh_tempo: called by pg_cron daily
CREATE OR REPLACE FUNCTION public.check_tagihan_jatuh_tempo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ts_record RECORD;
  santri_name text;
  parent_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Find tagihan due in 3 days with unpaid tagihan_santri
  FOR ts_record IN
    SELECT ts.id, ts.santri_id, t.nama AS tagihan_nama, t.jatuh_tempo
    FROM tagihan_santri ts
    JOIN tagihan t ON t.id = ts.tagihan_id
    WHERE t.jatuh_tempo = CURRENT_DATE + INTERVAL '3 days'
      AND ts.status IN ('belum_bayar', 'ditolak')
      AND ts.santri_id IS NOT NULL
  LOOP
    SELECT p.name INTO santri_name
    FROM profiles p
    WHERE p.id = ts_record.santri_id;

    notification_title := 'Pengingat Tagihan';
    notification_message := 'Tagihan ' || COALESCE(ts_record.tagihan_nama, '') || ' akan jatuh tempo dalam 3 hari. Segera lakukan pembayaran.';

    -- Notify santri
    PERFORM create_notification(
      ts_record.santri_id,
      notification_title,
      notification_message
    );

    -- Notify parents
    FOR parent_record IN
      SELECT parent_id FROM parent_children WHERE child_id = ts_record.santri_id
    LOOP
      PERFORM create_notification(
        parent_record.parent_id,
        notification_title,
        COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message
      );
    END LOOP;

    -- Push notification
    PERFORM net.http_post(
      url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
      body := jsonb_build_object(
        'type', 'tagihan_reminder',
        'record', jsonb_build_object(
          'santri_id', ts_record.santri_id,
          'santri_name', COALESCE(santri_name, 'Santri'),
          'tagihan_nama', COALESCE(ts_record.tagihan_nama, 'Tagihan'),
          'jatuh_tempo', ts_record.jatuh_tempo
        )
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 5000
    );
  END LOOP;
END;
$function$;
