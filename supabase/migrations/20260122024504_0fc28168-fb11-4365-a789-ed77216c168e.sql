-- Add is_manual_graded column to ujian_jawaban to track manual vs AI grading
ALTER TABLE public.ujian_jawaban 
ADD COLUMN IF NOT EXISTS is_manual_graded boolean DEFAULT false;