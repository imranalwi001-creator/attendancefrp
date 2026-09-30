-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update trigger function for konseling records to call edge function
CREATE OR REPLACE FUNCTION public.notify_konseling_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  santri_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
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

  -- Call edge function for push notification
  PERFORM extensions.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := json_build_object(
      'type', 'konseling_record',
      'record', json_build_object(
        'santri_id', NEW.santri_id,
        'tipe', NEW.tipe,
        'kategori', NEW.kategori
      )
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json'
    )::jsonb
  );

  RETURN NEW;
END;
$$;

-- Update trigger function for setoran hafalan to call edge function
CREATE OR REPLACE FUNCTION public.notify_setoran_hafalan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  santri_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  kategori_label TEXT;
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

  -- Set notification message
  notification_title := 'Data Hafalan Baru';
  notification_message := 'Data ' || kategori_label || ' telah ditambahkan: ' || NEW.judul;

  -- Create in-app notification for santri
  PERFORM create_notification(
    NEW.santri_id,
    notification_title,
    notification_message
  );

  -- Call edge function for push notification
  PERFORM extensions.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := json_build_object(
      'type', 'setoran_hafalan',
      'record', json_build_object(
        'santri_id', NEW.santri_id,
        'kategori', NEW.kategori,
        'judul', NEW.judul
      )
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json'
    )::jsonb
  );

  RETURN NEW;
END;
$$;