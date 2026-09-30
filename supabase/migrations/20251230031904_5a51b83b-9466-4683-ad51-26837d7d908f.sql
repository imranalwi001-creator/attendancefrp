-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
DO $$
BEGIN
  CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Users can update their own notifications (mark as read)
DO $$
BEGIN
  CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Function to create notification (security definer to bypass RLS for triggers)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _title TEXT,
  _message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message)
  VALUES (_user_id, _title, _message)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function for pengajuan_izin_santri
CREATE OR REPLACE FUNCTION public.notify_pengajuan_izin_santri()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      IF NEW.status = 'disetujui' THEN
        PERFORM create_notification(
          NEW.santri_id,
          'Pengajuan Izin Disetujui',
          'Pengajuan izin Anda telah disetujui'
        );
      ELSIF NEW.status = 'ditolak' THEN
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
$$;

-- Trigger for pengajuan_izin_santri
DO $$
BEGIN
  CREATE TRIGGER on_pengajuan_izin_santri_change
  AFTER INSERT OR UPDATE ON public.pengajuan_izin_santri
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pengajuan_izin_santri();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger function for pengajuan_izin_staff
CREATE OR REPLACE FUNCTION public.notify_pengajuan_izin_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      IF NEW.status = 'disetujui' THEN
        PERFORM create_notification(
          NEW.staff_id,
          'Pengajuan Izin Disetujui',
          'Pengajuan izin Anda telah disetujui'
        );
      ELSIF NEW.status = 'ditolak' THEN
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
$$;

-- Trigger for pengajuan_izin_staff
DO $$
BEGIN
  CREATE TRIGGER on_pengajuan_izin_staff_change
  AFTER INSERT OR UPDATE ON public.pengajuan_izin_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pengajuan_izin_staff();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
