-- Fix the notify_pengajuan_izin_staff function to use correct enum values
CREATE OR REPLACE FUNCTION public.notify_pengajuan_izin_staff()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  staff_name TEXT;
  admin_id UUID;
BEGIN
  -- Get staff name
  SELECT p.name INTO staff_name
  FROM profiles p
  WHERE p.id = NEW.staff_id;

  IF TG_OP = 'INSERT' THEN
    -- Notify all admins when leave request is created
    FOR admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      PERFORM create_notification(
        admin_id,
        'Pengajuan Izin Staff Baru',
        'Pengajuan izin dari ' || COALESCE(staff_name, 'Staff') || ' menunggu konfirmasi'
      );
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'approved' THEN
        PERFORM create_notification(
          NEW.staff_id,
          'Pengajuan Izin Disetujui',
          'Pengajuan izin Anda telah disetujui'
        );
      ELSIF NEW.status = 'rejected' THEN
        PERFORM create_notification(
          NEW.staff_id,
          'Pengajuan Izin Ditolak',
          'Pengajuan izin Anda telah ditolak'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix the notify_pengajuan_izin_santri function to use correct enum values
CREATE OR REPLACE FUNCTION public.notify_pengajuan_izin_santri()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  santri_name TEXT;
  admin_id UUID;
BEGIN
  -- Get santri name
  SELECT p.name INTO santri_name
  FROM profiles p
  WHERE p.id = NEW.santri_id;

  IF TG_OP = 'INSERT' THEN
    -- Notify all admins when leave request is created
    FOR admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      PERFORM create_notification(
        admin_id,
        'Pengajuan Izin Santri Baru',
        'Pengajuan izin dari ' || COALESCE(santri_name, 'Santri') || ' menunggu konfirmasi'
      );
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'approved' THEN
        PERFORM create_notification(
          NEW.santri_id,
          'Pengajuan Izin Disetujui',
          'Pengajuan izin Anda telah disetujui'
        );
      ELSIF NEW.status = 'rejected' THEN
        PERFORM create_notification(
          NEW.santri_id,
          'Pengajuan Izin Ditolak',
          'Pengajuan izin Anda telah ditolak'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;