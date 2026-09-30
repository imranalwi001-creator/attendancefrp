-- Add AI grading toggle to ujian table
ALTER TABLE public.ujian 
ADD COLUMN IF NOT EXISTS ai_grading_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
DO $$
BEGIN
  COMMENT ON COLUMN public.ujian.ai_grading_enabled IS 'Enable/disable AI auto-grading for essay questions in this exam';
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;
