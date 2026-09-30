-- Create table for substitute teacher assignments
CREATE TABLE IF NOT EXISTS public.guru_pengganti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jadwal_id UUID NOT NULL REFERENCES public.jadwal(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  guru_asli_id UUID NOT NULL REFERENCES public.staff(id),
  guru_pengganti_id UUID NOT NULL REFERENCES public.staff(id),
  alasan TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jadwal_id, tanggal)
);

-- Add constraint for status values using trigger instead of CHECK
CREATE OR REPLACE FUNCTION public.validate_guru_pengganti_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Invalid status value. Must be one of: pending, accepted, rejected, completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  CREATE TRIGGER validate_guru_pengganti_status_trigger
    BEFORE INSERT OR UPDATE ON public.guru_pengganti
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_guru_pengganti_status();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_guru_pengganti_jadwal_id ON public.guru_pengganti(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_guru_pengganti_tanggal ON public.guru_pengganti(tanggal);
CREATE INDEX IF NOT EXISTS idx_guru_pengganti_guru_asli_id ON public.guru_pengganti(guru_asli_id);
CREATE INDEX IF NOT EXISTS idx_guru_pengganti_guru_pengganti_id ON public.guru_pengganti(guru_pengganti_id);

-- Create trigger for automatic timestamp updates
DO $$
BEGIN
  CREATE TRIGGER update_guru_pengganti_updated_at
    BEFORE UPDATE ON public.guru_pengganti
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enable Row Level Security
ALTER TABLE public.guru_pengganti ENABLE ROW LEVEL SECURITY;

-- RLS Policies with correct role values
-- Policy for viewing: guru asli, guru pengganti, or admin can view
DO $$
BEGIN
  CREATE POLICY "Users can view their substitute assignments"
    ON public.guru_pengganti
    FOR SELECT
    USING (
      guru_asli_id = auth.uid()
      OR guru_pengganti_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Policy for inserting: only guru asli or admin can create substitute assignment
DO $$
BEGIN
  CREATE POLICY "Original teacher can assign substitute"
    ON public.guru_pengganti
    FOR INSERT
    WITH CHECK (
      guru_asli_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Policy for updating: guru asli, guru pengganti, or admin can update
DO $$
BEGIN
  CREATE POLICY "Involved parties can update substitute assignment"
    ON public.guru_pengganti
    FOR UPDATE
    USING (
      guru_asli_id = auth.uid()
      OR guru_pengganti_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Policy for deleting: only guru asli or admin can delete
DO $$
BEGIN
  CREATE POLICY "Original teacher or admin can delete substitute assignment"
    ON public.guru_pengganti
    FOR DELETE
    USING (
      guru_asli_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
