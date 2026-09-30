
CREATE TABLE IF NOT EXISTS public.ramadhan_mood (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one mood per santri per day
DO $$
BEGIN
  ALTER TABLE public.ramadhan_mood ADD CONSTRAINT ramadhan_mood_santri_date_unique UNIQUE (santri_id, date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE public.ramadhan_mood ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Santri can view own mood" ON public.ramadhan_mood FOR SELECT USING (auth.uid() = santri_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri can insert own mood" ON public.ramadhan_mood FOR INSERT WITH CHECK (auth.uid() = santri_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents can view child mood" ON public.ramadhan_mood FOR SELECT USING (
    EXISTS (SELECT 1 FROM parent_children WHERE parent_id = auth.uid() AND child_id = santri_id)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
