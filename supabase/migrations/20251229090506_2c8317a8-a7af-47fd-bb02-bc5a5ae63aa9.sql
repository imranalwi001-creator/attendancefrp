-- Add status column to kehadiran_staff for tracking izin/sakit/alpha
ALTER TABLE public.kehadiran_staff 
ADD COLUMN IF NOT EXISTS status text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.kehadiran_staff.status IS 'Status kehadiran: hadir, izin, sakit, alpha, dinas_luar';