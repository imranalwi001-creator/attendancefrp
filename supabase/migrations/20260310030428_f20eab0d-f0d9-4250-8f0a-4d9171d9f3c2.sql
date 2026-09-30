
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
  SELECT t.nama_tagihan, t.jatuh_tempo INTO tagihan_record
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
  notification_message := 'Tagihan baru telah ditambahkan: ' || COALESCE(tagihan_record.nama_tagihan, 'Tagihan');

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
          'tagihan_nama', COALESCE(tagihan_record.nama_tagihan, 'Tagihan'),
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

-- Also fix notify_pembayaran_ditolak which references t.nama
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
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status != 'ditolak' THEN
    RETURN NEW;
  END IF;

  SELECT ts.santri_id, t.nama_tagihan AS tagihan_nama
  INTO ts_record
  FROM tagihan_santri ts
  JOIN tagihan t ON t.id = ts.tagihan_id
  WHERE ts.id = NEW.tagihan_santri_id;

  IF ts_record IS NULL OR ts_record.santri_id IS NULL THEN
    RETURN NEW;
  END IF;

  tagihan_nama := COALESCE(ts_record.tagihan_nama, 'Tagihan');

  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = ts_record.santri_id;

  notification_title := 'Pembayaran Ditolak';
  notification_message := 'Pembayaran untuk ' || tagihan_nama || ' telah ditolak. Silakan upload ulang bukti pembayaran.';

  PERFORM create_notification(ts_record.santri_id, notification_title, notification_message);

  FOR parent_record IN
    SELECT parent_id FROM parent_children WHERE child_id = ts_record.santri_id
  LOOP
    PERFORM create_notification(parent_record.parent_id, notification_title, COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message);
  END LOOP;

  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object('type', 'pembayaran_ditolak', 'record', jsonb_build_object('santri_id', ts_record.santri_id, 'santri_name', COALESCE(santri_name, 'Santri'), 'tagihan_nama', tagihan_nama)),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

-- Also fix notify_pembayaran_pending which references t.nama
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
  SELECT ts.santri_id, t.nama_tagihan AS tagihan_nama
  INTO ts_record
  FROM tagihan_santri ts
  JOIN tagihan t ON t.id = ts.tagihan_id
  WHERE ts.id = NEW.tagihan_santri_id;

  IF ts_record IS NOT NULL AND ts_record.santri_id IS NOT NULL THEN
    SELECT p.name INTO santri_name
    FROM profiles p
    WHERE p.id = ts_record.santri_id;
  END IF;

  notification_title := 'Pembayaran Baru Menunggu Verifikasi';
  notification_message := COALESCE(santri_name, 'Santri') || ' telah mengupload bukti pembayaran untuk ' || COALESCE(ts_record.tagihan_nama, 'tagihan');

  FOR admin_record IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    PERFORM create_notification(admin_record.user_id, notification_title, notification_message);
  END LOOP;

  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object('type', 'pembayaran_pending', 'record', jsonb_build_object('santri_name', COALESCE(santri_name, 'Santri'), 'tagihan_nama', COALESCE(ts_record.tagihan_nama, 'Tagihan'), 'pembayaran_id', NEW.id)),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

-- Also fix check_tagihan_jatuh_tempo which references t.nama
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
  FOR ts_record IN
    SELECT ts.id, ts.santri_id, t.nama_tagihan AS tagihan_nama, t.jatuh_tempo
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

    PERFORM create_notification(ts_record.santri_id, notification_title, notification_message);

    FOR parent_record IN
      SELECT parent_id FROM parent_children WHERE child_id = ts_record.santri_id
    LOOP
      PERFORM create_notification(parent_record.parent_id, notification_title, COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message);
    END LOOP;

    PERFORM net.http_post(
      url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
      body := jsonb_build_object('type', 'tagihan_reminder', 'record', jsonb_build_object('santri_id', ts_record.santri_id, 'santri_name', COALESCE(santri_name, 'Santri'), 'tagihan_nama', COALESCE(ts_record.tagihan_nama, 'Tagihan'), 'jatuh_tempo', ts_record.jatuh_tempo)),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 5000
    );
  END LOOP;
END;
$function$;
