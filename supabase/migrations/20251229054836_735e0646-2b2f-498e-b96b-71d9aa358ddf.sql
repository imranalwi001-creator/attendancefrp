-- Add foto columns to kehadiran_staff for staff attendance photos
ALTER TABLE public.kehadiran_staff
ADD COLUMN IF NOT EXISTS foto_masuk_url TEXT,
ADD COLUMN IF NOT EXISTS foto_pulang_url TEXT;
