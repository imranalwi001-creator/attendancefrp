-- Trigger function for konseling records (pelanggaran/prestasi)
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

  -- Create notification for santri
  PERFORM create_notification(
    NEW.santri_id,
    notification_title,
    notification_message
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_konseling_record ON public.konseling_records;

-- Create trigger for konseling_records
CREATE TRIGGER trigger_notify_konseling_record
  AFTER INSERT ON public.konseling_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_konseling_record();

-- Trigger function for setoran hafalan
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

  -- Create notification for santri
  PERFORM create_notification(
    NEW.santri_id,
    notification_title,
    notification_message
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_notify_setoran_hafalan ON public.setoran_hafalan;

-- Create trigger for setoran_hafalan
CREATE TRIGGER trigger_notify_setoran_hafalan
  AFTER INSERT ON public.setoran_hafalan
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_setoran_hafalan();