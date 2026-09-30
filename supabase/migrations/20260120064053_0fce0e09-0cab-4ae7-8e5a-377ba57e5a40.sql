-- Create a function to auto-end exams when duration expires
-- This can be called from client-side when needed
CREATE OR REPLACE FUNCTION public.auto_end_expired_exams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update exams that are 'berlangsung' and have exceeded their duration
  UPDATE public.ujian
  SET 
    status = 'selesai',
    updated_at = now()
  WHERE 
    status = 'berlangsung'
    AND durasi_menit IS NOT NULL
    AND durasi_menit > 0
    AND tanggal_pelaksanaan IS NOT NULL
    -- Check if current time is past (start_time + duration)
    AND (tanggal_pelaksanaan + (durasi_menit || ' minutes')::interval) < now();
END;
$$;