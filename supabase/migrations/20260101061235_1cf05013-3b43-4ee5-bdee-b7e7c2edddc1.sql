-- Create function to notify when new tugas is created
CREATE OR REPLACE FUNCTION public.notify_new_tugas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mapel_record RECORD;
  santri_record RECORD;
  parent_record RECORD;
  notification_title text;
  notification_message text;
BEGIN
  -- Only trigger for active tugas
  IF NEW.status != 'aktif' THEN
    RETURN NEW;
  END IF;

  -- Get mapel info (name and kelas_id)
  SELECT m.nama, m.kelas_id, k.nama as kelas_nama, p.name as pengampu_nama
  INTO mapel_record
  FROM mapel m
  JOIN kelas k ON k.id = m.kelas_id
  LEFT JOIN staff s ON s.id = m.pengampu_id
  LEFT JOIN profiles p ON p.id = s.id
  WHERE m.id = NEW.mapel_id;

  IF mapel_record IS NULL THEN
    RETURN NEW;
  END IF;

  notification_title := 'Tugas Baru: ' || NEW.judul;
  notification_message := 'Tugas baru dari mapel ' || mapel_record.nama || ' telah ditambahkan';

  -- Create in-app notification for all santri in the class
  FOR santri_record IN 
    SELECT s.id, p.name as santri_name
    FROM santri s
    JOIN profiles p ON p.id = s.id
    WHERE s.kelas_id = mapel_record.kelas_id
      AND p.status = 'aktif'
  LOOP
    -- Create notification for santri
    PERFORM create_notification(
      santri_record.id,
      notification_title,
      notification_message
    );

    -- Create notification for parents
    FOR parent_record IN 
      SELECT parent_id FROM parent_children WHERE child_id = santri_record.id
    LOOP
      PERFORM create_notification(
        parent_record.parent_id,
        notification_title,
        COALESCE(santri_record.santri_name, 'Anak Anda') || ': ' || notification_message
      );
    END LOOP;
  END LOOP;

  -- Call edge function for push notification
  PERFORM net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'new_tugas',
      'record', jsonb_build_object(
        'tugas_id', NEW.id,
        'judul', NEW.judul,
        'mapel_nama', mapel_record.nama,
        'kelas_id', mapel_record.kelas_id,
        'kelas_nama', mapel_record.kelas_nama,
        'deadline', NEW.tanggal_deadline
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
$$;

-- Create trigger for new tugas
DROP TRIGGER IF EXISTS on_new_tugas ON public.tugas;
CREATE TRIGGER on_new_tugas
  AFTER INSERT ON public.tugas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_tugas();