-- Create table for storing psikologi summary reports
CREATE TABLE IF NOT EXISTS public.santri_psikologi_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  semester TEXT NOT NULL DEFAULT 'ganjil',
  summary TEXT NOT NULL,
  language_style TEXT NOT NULL DEFAULT 'formal',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(santri_id, academic_year_id, semester)
);

-- Enable RLS
ALTER TABLE public.santri_psikologi_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  CREATE POLICY "Admins can manage all psikologi reports"
  ON public.santri_psikologi_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Walikelas can manage reports for their class"
  ON public.santri_psikologi_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.santri s
      JOIN public.kelas k ON s.kelas_id = k.id
      JOIN public.staff st ON k.walikelas_id = st.id
      WHERE s.id = santri_id AND st.id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents can view their children reports"
  ON public.santri_psikologi_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_children
      WHERE parent_id = auth.uid() AND child_id = santri_id
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri can view their own reports"
  ON public.santri_psikologi_reports
  FOR SELECT
  USING (santri_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_santri_psikologi_reports_updated_at
  BEFORE UPDATE ON public.santri_psikologi_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_santri_psikologi_reports_santri_id ON public.santri_psikologi_reports(santri_id);
CREATE INDEX IF NOT EXISTS idx_santri_psikologi_reports_academic_year ON public.santri_psikologi_reports(academic_year_id, semester);
