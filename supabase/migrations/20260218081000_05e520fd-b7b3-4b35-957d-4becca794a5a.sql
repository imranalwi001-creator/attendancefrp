
-- Table to store Ramadhan configuration
CREATE TABLE IF NOT EXISTS public.ramadhan_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun_hijriah TEXT NOT NULL,
  tanggal_mulai DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ramadhan_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read active config
DO $$
BEGIN
  CREATE POLICY "Anyone can read ramadhan config"
  ON public.ramadhan_config FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Only admins can manage
DO $$
BEGIN
  CREATE POLICY "Admins can insert ramadhan config"
  ON public.ramadhan_config FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can update ramadhan config"
  ON public.ramadhan_config FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete ramadhan config"
  ON public.ramadhan_config FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure only one active config at a time
CREATE OR REPLACE FUNCTION public.ensure_single_active_ramadhan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.ramadhan_config
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_active_ramadhan_trigger
BEFORE INSERT OR UPDATE ON public.ramadhan_config
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_active_ramadhan();

-- Auto update updated_at
DO $$
BEGIN
  CREATE TRIGGER update_ramadhan_config_updated_at
  BEFORE UPDATE ON public.ramadhan_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
