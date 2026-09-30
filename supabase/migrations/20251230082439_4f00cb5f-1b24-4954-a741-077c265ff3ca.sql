-- Drop the push notification triggers (keeping frontend-based approach)
DROP TRIGGER IF EXISTS on_staff_izin_push_notification ON pengajuan_izin_staff;
DROP TRIGGER IF EXISTS on_santri_izin_push_notification ON pengajuan_izin_santri;

-- Drop the function
DROP FUNCTION IF EXISTS public.send_push_notification_to_admins();