-- Add selected_dates column to learning_blocks table
-- This stores individual selected dates as an array, allowing flexible date selection
ALTER TABLE public.learning_blocks 
ADD COLUMN IF NOT EXISTS selected_dates text[] DEFAULT NULL;

-- Add comment to explain the column
DO $$
BEGIN
  COMMENT ON COLUMN public.learning_blocks.selected_dates IS 'Array of individual selected dates in YYYY-MM-DD format. When populated, these are the actual selected dates. start_date and end_date represent the min/max of this array.';
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;
