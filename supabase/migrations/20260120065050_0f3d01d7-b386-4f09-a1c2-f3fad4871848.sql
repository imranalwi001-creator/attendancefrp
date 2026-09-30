-- Add waktu_mulai column to track when exam actually started
ALTER TABLE public.ujian ADD COLUMN IF NOT EXISTS waktu_mulai timestamptz;

-- Update the auto_end_expired_exams function to use waktu_mulai instead of tanggal_pelaksanaan
CREATE OR REPLACE FUNCTION public.auto_end_expired_exams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update exams that are 'berlangsung' and have exceeded their duration
  -- Use waktu_mulai (actual start time) instead of tanggal_pelaksanaan (scheduled time)
  UPDATE public.ujian
  SET 
    status = 'selesai',
    updated_at = now()
  WHERE 
    status = 'berlangsung'
    AND durasi_menit IS NOT NULL
    AND durasi_menit > 0
    AND waktu_mulai IS NOT NULL
    -- Check if current time is past (actual_start_time + duration)
    AND (waktu_mulai + (durasi_menit || ' minutes')::interval) < now();
END;
$$;