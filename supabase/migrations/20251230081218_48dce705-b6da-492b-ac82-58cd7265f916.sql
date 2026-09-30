-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification to all admins when new izin is created
CREATE OR REPLACE FUNCTION public.send_push_notification_to_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  user_name TEXT;
  jenis_label TEXT;
  request_id BIGINT;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the Supabase URL and service role key from environment
  edge_function_url := 'http://127.0.0.1:54321/functions/v1/send-push-notification';
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If service role key is not set, skip push notification (will still work with in-app notification from existing trigger)
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE LOG 'Service role key not configured, skipping push notification';
    RETURN NEW;
  END IF;

  -- Map jenis_izin to label
  jenis_label := CASE NEW.jenis_izin
    WHEN 'sakit' THEN 'Sakit'
    WHEN 'izin' THEN 'Izin'
    WHEN 'cuti' THEN 'Cuti'
    WHEN 'dinas_luar' THEN 'Dinas Luar'
    WHEN 'lainnya' THEN 'Lainnya'
    ELSE 'Izin'
  END;

  -- Get user name based on table type
  IF TG_TABLE_NAME = 'pengajuan_izin_staff' THEN
    SELECT p.name INTO user_name
    FROM profiles p
    WHERE p.id = NEW.staff_id;
  ELSE
    SELECT p.name INTO user_name
    FROM profiles p
    WHERE p.id = NEW.santri_id;
  END IF;

  user_name := COALESCE(user_name, 'Pengguna');

  -- Send push notification to each admin
  FOR admin_record IN 
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    -- Use pg_net to call the edge function
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'user_id', admin_record.user_id::text,
        'title', 'Pengajuan Izin Baru',
        'message', user_name || ' mengajukan izin ' || jenis_label,
        'url', '/admin/pengajuan-izin',
        'tag', 'izin-new-' || NEW.id::text
      )
    ) INTO request_id;
    
    RAISE LOG 'Push notification sent to admin %, request_id: %', admin_record.user_id, request_id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for staff izin
DROP TRIGGER IF EXISTS on_staff_izin_push_notification ON pengajuan_izin_staff;
CREATE TRIGGER on_staff_izin_push_notification
  AFTER INSERT ON pengajuan_izin_staff
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_to_admins();

-- Create trigger for santri izin  
DROP TRIGGER IF EXISTS on_santri_izin_push_notification ON pengajuan_izin_santri;
CREATE TRIGGER on_santri_izin_push_notification
  AFTER INSERT ON pengajuan_izin_santri
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_to_admins();