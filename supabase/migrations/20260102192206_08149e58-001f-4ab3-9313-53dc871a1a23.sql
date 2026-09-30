-- Add new columns to kalender_events table
ALTER TABLE public.kalender_events
ADD COLUMN IF NOT EXISTS pic_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS document_url text,
ADD COLUMN IF NOT EXISTS document_name text;

-- Add constraint for status values
DO $$
BEGIN
  ALTER TABLE public.kalender_events
  ADD CONSTRAINT kalender_events_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'postponed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create storage bucket for kalender documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kalender-documents', 'kalender-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for kalender documents - Allow authenticated users to view
DO $$
BEGIN
  CREATE POLICY "Authenticated can view kalender documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kalender-documents');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to upload kalender documents
DO $$
BEGIN
  CREATE POLICY "Admins can upload kalender documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kalender-documents' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to update kalender documents
DO $$
BEGIN
  CREATE POLICY "Admins can update kalender documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'kalender-documents' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to delete kalender documents
DO $$
BEGIN
  CREATE POLICY "Admins can delete kalender documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'kalender-documents' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
