-- Create table for Cambridge documents
CREATE TABLE IF NOT EXISTS public.cambridge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  kelas_id UUID NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  semester TEXT NOT NULL DEFAULT 'ganjil',
  document_url TEXT,
  document_name TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(santri_id, kelas_id, academic_year_id, semester)
);

-- Enable RLS
ALTER TABLE public.cambridge_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  CREATE POLICY "Admins can manage cambridge_documents"
  ON public.cambridge_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can view cambridge_documents"
  ON public.cambridge_documents FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'guru'::app_role) OR
    has_role(auth.uid(), 'walikelas'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can insert cambridge_documents"
  ON public.cambridge_documents FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'guru'::app_role) OR
    has_role(auth.uid(), 'walikelas'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can update cambridge_documents"
  ON public.cambridge_documents FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'guru'::app_role) OR
    has_role(auth.uid(), 'walikelas'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri can view own cambridge_documents"
  ON public.cambridge_documents FOR SELECT
  USING (auth.uid() = santri_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents can view children cambridge_documents"
  ON public.cambridge_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = auth.uid() AND pc.child_id = cambridge_documents.santri_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create storage bucket for Cambridge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('cambridge-documents', 'cambridge-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  CREATE POLICY "Staff can upload cambridge documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cambridge-documents' AND
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'guru'::app_role) OR
      has_role(auth.uid(), 'walikelas'::app_role)
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can update cambridge documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cambridge-documents' AND
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'guru'::app_role) OR
      has_role(auth.uid(), 'walikelas'::app_role)
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can delete cambridge documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cambridge-documents' AND
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'guru'::app_role) OR
      has_role(auth.uid(), 'walikelas'::app_role)
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated can view cambridge documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cambridge-documents');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_cambridge_documents_updated_at
  BEFORE UPDATE ON public.cambridge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
