
-- Master activities table
CREATE TABLE IF NOT EXISTS public.ramadhan_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('fardhu', 'sunnah', 'akhlak')),
  target_daily int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ramadhan_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can read activities"
    ON public.ramadhan_activities FOR SELECT
    TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Daily logs table
CREATE TABLE IF NOT EXISTS public.ramadhan_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id uuid NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.ramadhan_activities(id) ON DELETE CASCADE,
  date date NOT NULL,
  hijri_day int,
  is_completed boolean NOT NULL DEFAULT true,
  timestamp timestamptz DEFAULT now(),
  UNIQUE (santri_id, activity_id, date)
);

ALTER TABLE public.ramadhan_daily_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function for parent access
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id uuid, _child_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_children
    WHERE parent_id = _parent_id AND child_id = _child_id
  );
$$;

-- RLS: Santri can manage own logs
DO $$
BEGIN
  CREATE POLICY "Santri can read own logs"
    ON public.ramadhan_daily_logs FOR SELECT
    TO authenticated USING (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri can insert own logs"
    ON public.ramadhan_daily_logs FOR INSERT
    TO authenticated WITH CHECK (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri can delete own logs"
    ON public.ramadhan_daily_logs FOR DELETE
    TO authenticated USING (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS: Parents can view children's logs
DO $$
BEGIN
  CREATE POLICY "Parents can read children logs"
    ON public.ramadhan_daily_logs FOR SELECT
    TO authenticated USING (public.is_parent_of(auth.uid(), santri_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS: Admin can read all
DO $$
BEGIN
  CREATE POLICY "Admin can read all logs"
    ON public.ramadhan_daily_logs FOR SELECT
    TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed master data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ramadhan_activities'
      AND a.attname = 'target_daily'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    ALTER TABLE public.ramadhan_activities
    ALTER COLUMN target_daily SET DEFAULT 1;

    UPDATE public.ramadhan_activities
    SET target_daily = 1
    WHERE target_daily IS NULL;
  END IF;
END $$;

INSERT INTO public.ramadhan_activities (title, category, target_daily)
SELECT v.title, v.category, 1
FROM (
  VALUES
    ('Shalat Subuh', 'fardhu'),
    ('Shalat Dhuhur', 'fardhu'),
    ('Shalat Ashar', 'fardhu'),
    ('Shalat Maghrib', 'fardhu'),
    ('Shalat Isya', 'fardhu'),
    ('Puasa', 'fardhu'),
    ('Shalat Rawatib (12 Rakaat)', 'sunnah'),
    ('Tahajjud', 'sunnah'),
    ('Dhuha', 'sunnah'),
    ('Tarawih', 'sunnah'),
    ('Witir', 'sunnah'),
    ('Tilawah Al-Quran', 'sunnah'),
    ('Dzikir & Shalawat', 'sunnah'),
    ('Mendengar Kajian', 'sunnah'),
    ('Sedekah', 'akhlak'),
    ('Membantu Teman/Ortu', 'akhlak'),
    ('Tidak Ghibah/Berkata Kasar', 'akhlak'),
    ('Mengajak Kebaikan', 'akhlak'),
    ('Menghindari Sesuatu yang Tidak Baik', 'akhlak')
) AS v(title, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ramadhan_activities a WHERE a.title = v.title
);
