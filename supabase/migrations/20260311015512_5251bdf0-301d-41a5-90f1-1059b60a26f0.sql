
-- 1. liburan_config
CREATE TABLE IF NOT EXISTS public.liburan_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.liburan_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Anyone authenticated can read liburan_config" ON public.liburan_config FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can manage liburan_config" ON public.liburan_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: ensure single active
CREATE OR REPLACE FUNCTION public.ensure_single_active_liburan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.liburan_config SET is_active = false, updated_at = now() WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER ensure_single_active_liburan_trigger
    BEFORE INSERT OR UPDATE ON public.liburan_config
    FOR EACH ROW EXECUTE FUNCTION public.ensure_single_active_liburan();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. liburan_activities
CREATE TABLE IF NOT EXISTS public.liburan_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'fardhu',
  target_daily integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.liburan_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Anyone authenticated can read liburan_activities" ON public.liburan_activities FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can manage liburan_activities" ON public.liburan_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Seed data
INSERT INTO public.liburan_activities (title, category, target_daily)
SELECT v.title, v.category, v.target_daily
FROM (
  VALUES
    ('Shalat Subuh', 'fardhu', 1),
    ('Shalat Dhuhur', 'fardhu', 1),
    ('Shalat Ashar', 'fardhu', 1),
    ('Shalat Maghrib', 'fardhu', 1),
    ('Shalat Isya', 'fardhu', 1),
    ('Shalat Dhuha', 'sunnah', 1),
    ('Dzikir Pagi', 'sunnah', 1),
    ('Dzikir Petang', 'sunnah', 1),
    ('Mengaji', 'belajar', 1),
    ('Belajar', 'belajar', 1),
    ('Membantu Orang Tua', 'belajar', 1)
) AS v(title, category, target_daily)
WHERE NOT EXISTS (
  SELECT 1 FROM public.liburan_activities a WHERE a.title = v.title
);

-- 3. liburan_daily_logs
CREATE TABLE IF NOT EXISTS public.liburan_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id uuid NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.liburan_activities(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_number integer,
  is_completed boolean NOT NULL DEFAULT false,
  excuse_reason text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.liburan_daily_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Santri can manage own liburan logs" ON public.liburan_daily_logs FOR ALL TO authenticated
    USING (santri_id = auth.uid()) WITH CHECK (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Guru can read liburan logs" ON public.liburan_daily_logs FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'walikelas') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'Pembina'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents can read children liburan logs" ON public.liburan_daily_logs FOR SELECT TO authenticated
    USING (public.is_parent_of(auth.uid(), santri_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. liburan_mood
CREATE TABLE IF NOT EXISTS public.liburan_mood (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id uuid NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  date date NOT NULL,
  mood text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(santri_id, date)
);

ALTER TABLE public.liburan_mood ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Santri can manage own liburan mood" ON public.liburan_mood FOR ALL TO authenticated
    USING (santri_id = auth.uid()) WITH CHECK (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Guru can read liburan mood" ON public.liburan_mood FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'walikelas') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'Pembina'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents can read children liburan mood" ON public.liburan_mood FOR SELECT TO authenticated
    USING (public.is_parent_of(auth.uid(), santri_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
