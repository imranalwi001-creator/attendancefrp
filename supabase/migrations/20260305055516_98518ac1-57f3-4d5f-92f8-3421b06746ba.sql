
-- Rename columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'jenis'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'nama_tagihan'
  ) THEN
    ALTER TABLE public.tagihan RENAME COLUMN jenis TO nama_tagihan;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'periode'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'semester'
  ) THEN
    ALTER TABLE public.tagihan RENAME COLUMN periode TO semester;
  END IF;
END $$;

-- Add is_split flag
ALTER TABLE public.tagihan ADD COLUMN IF NOT EXISTS is_split boolean NOT NULL DEFAULT false;

-- Create line items table
CREATE TABLE IF NOT EXISTS public.tagihan_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tagihan_id uuid REFERENCES public.tagihan(id) ON DELETE CASCADE NOT NULL,
  nama text NOT NULL,
  jumlah numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tagihan_line_items ENABLE ROW LEVEL SECURITY;

-- RLS: admins can do everything
DO $$
BEGIN
  CREATE POLICY "Admins full access on tagihan_line_items"
    ON public.tagihan_line_items
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS: parents can read line items for their children's tagihan
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'santri_id'
  ) THEN
    CREATE POLICY "Parents can view their children tagihan line items"
      ON public.tagihan_line_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tagihan t
          JOIN public.parent_children pc ON pc.child_id = t.santri_id
          WHERE t.id = tagihan_line_items.tagihan_id
            AND pc.parent_id = auth.uid()
        )
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS: santri can view their own tagihan line items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tagihan'
      AND column_name = 'santri_id'
  ) THEN
    CREATE POLICY "Santri can view own tagihan line items"
      ON public.tagihan_line_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tagihan t
          WHERE t.id = tagihan_line_items.tagihan_id
            AND t.santri_id = auth.uid()
        )
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
