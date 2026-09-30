-- Update notify_konseling_record to also notify parents
CREATE OR REPLACE FUNCTION public.notify_konseling_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  santri_name text;
  notification_title text;
  notification_message text;
  parent_record RECORD;
BEGIN
  -- Get santri name
  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = NEW.santri_id;

  -- Set notification based on type
  IF NEW.tipe = 'pelanggaran' THEN
    notification_title := 'Catatan Pelanggaran Baru';
    notification_message := 'Catatan pelanggaran baru telah ditambahkan: ' || NEW.kategori;
  ELSE
    notification_title := 'Catatan Prestasi Baru';
    notification_message := 'Catatan prestasi baru telah ditambahkan: ' || NEW.kategori;
  END IF;

  -- Create in-app notification for santri
  PERFORM create_notification(
    NEW.santri_id,
    notification_title,
    notification_message
  );

  -- Create in-app notification for parents
  FOR parent_record IN 
    SELECT parent_id FROM parent_children WHERE child_id = NEW.santri_id
  LOOP
    PERFORM create_notification(
      parent_record.parent_id,
      notification_title,
      COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message
    );
  END LOOP;

  -- Call edge function for push notification (non-blocking via pg_net)
  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'konseling_record',
      'record', jsonb_build_object(
        'santri_id', NEW.santri_id,
        'tipe', NEW.tipe,
        'kategori', NEW.kategori,
        'santri_name', COALESCE(santri_name, 'Santri')
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

-- Update notify_setoran_hafalan to also notify parents
CREATE OR REPLACE FUNCTION public.notify_setoran_hafalan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  santri_name text;
  notification_title text;
  notification_message text;
  kategori_label text;
  parent_record RECORD;
BEGIN
  -- Get santri name
  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = NEW.santri_id;

  -- Set kategori label
  CASE NEW.kategori
    WHEN 'ziyadah' THEN kategori_label := 'Ziyadah';
    WHEN 'murojaah' THEN kategori_label := 'Murojaah';
    WHEN 'tahsin' THEN kategori_label := 'Tahsin';
    ELSE kategori_label := NEW.kategori;
  END CASE;

  notification_title := 'Data Hafalan Baru';
  notification_message := 'Data ' || kategori_label || ' telah ditambahkan: ' || NEW.judul;

  -- Create in-app notification for santri
  PERFORM create_notification(
    NEW.santri_id,
    notification_title,
    notification_message
  );

  -- Create in-app notification for parents
  FOR parent_record IN 
    SELECT parent_id FROM parent_children WHERE child_id = NEW.santri_id
  LOOP
    PERFORM create_notification(
      parent_record.parent_id,
      notification_title,
      COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message
    );
  END LOOP;

  -- Call edge function for push notification
  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'setoran_hafalan',
      'record', jsonb_build_object(
        'santri_id', NEW.santri_id,
        'kategori', NEW.kategori,
        'judul', NEW.judul,
        'santri_name', COALESCE(santri_name, 'Santri')
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

-- Create notify_tahfidz_tahsin function for tahfidz_tahsin table
CREATE OR REPLACE FUNCTION public.notify_tahfidz_tahsin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  santri_name text;
  notification_title text;
  notification_message text;
  tipe_label text;
  parent_record RECORD;
BEGIN
  -- Get santri name
  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = NEW.santri_id;

  -- Set tipe label
  CASE NEW.tipe
    WHEN 'ziyadah' THEN tipe_label := 'Ziyadah';
    WHEN 'murojaah' THEN tipe_label := 'Murojaah';
    WHEN 'tahsin' THEN tipe_label := 'Tahsin';
    ELSE tipe_label := NEW.tipe;
  END CASE;

  notification_title := 'Data ' || tipe_label || ' Baru';
  notification_message := 'Data ' || tipe_label || ' telah ditambahkan';
  
  IF NEW.surah IS NOT NULL THEN
    notification_message := notification_message || ': ' || NEW.surah;
  ELSIF NEW.materi_tahsin IS NOT NULL THEN
    notification_message := notification_message || ': ' || NEW.materi_tahsin;
  END IF;

  -- Create in-app notification for santri
  PERFORM create_notification(
    NEW.santri_id,
    notification_title,
    notification_message
  );

  -- Create in-app notification for parents
  FOR parent_record IN 
    SELECT parent_id FROM parent_children WHERE child_id = NEW.santri_id
  LOOP
    PERFORM create_notification(
      parent_record.parent_id,
      notification_title,
      COALESCE(santri_name, 'Anak Anda') || ': ' || notification_message
    );
  END LOOP;

  -- Call edge function for push notification
  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'tahfidz_tahsin',
      'record', jsonb_build_object(
        'santri_id', NEW.santri_id,
        'tipe', NEW.tipe,
        'surah', NEW.surah,
        'materi_tahsin', NEW.materi_tahsin,
        'santri_name', COALESCE(santri_name, 'Santri')
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

-- Create trigger for tahfidz_tahsin if not exists
DROP TRIGGER IF EXISTS trigger_notify_tahfidz_tahsin ON tahfidz_tahsin;
CREATE TRIGGER trigger_notify_tahfidz_tahsin
  AFTER INSERT ON tahfidz_tahsin
  FOR EACH ROW
  EXECUTE FUNCTION notify_tahfidz_tahsin();