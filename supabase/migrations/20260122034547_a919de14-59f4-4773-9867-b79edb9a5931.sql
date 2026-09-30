-- Create bank_soal table for reusable questions
CREATE TABLE IF NOT EXISTS public.bank_soal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mata_pelajaran TEXT NOT NULL,
  kelas TEXT NOT NULL,
  materi TEXT,
  jenis_soal TEXT NOT NULL CHECK (jenis_soal IN ('pilihan_ganda', 'true_false', 'essai')),
  pertanyaan TEXT NOT NULL,
  gambar_pertanyaan TEXT,
  opsi_a TEXT,
  gambar_opsi_a TEXT,
  opsi_b TEXT,
  gambar_opsi_b TEXT,
  opsi_c TEXT,
  gambar_opsi_c TEXT,
  opsi_d TEXT,
  gambar_opsi_d TEXT,
  opsi_e TEXT,
  gambar_opsi_e TEXT,
  kunci_jawaban TEXT NOT NULL,
  bobot INTEGER NOT NULL DEFAULT 1,
  pembahasan TEXT,
  gambar_pembahasan TEXT,
  level_kognitif TEXT CHECK (level_kognitif IN ('LOTS', 'MOTS', 'HOTS')),
  cp_ringkasan TEXT,
  tp_list TEXT[],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_soal ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_soal
DO $$
BEGIN
  CREATE POLICY "Admin and staff can view all bank_soal"
    ON public.bank_soal
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'guru', 'walikelas', 'staff')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin and staff can create bank_soal"
    ON public.bank_soal
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'guru', 'walikelas', 'staff')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin and staff can update bank_soal"
    ON public.bank_soal
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'guru', 'walikelas', 'staff')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin can delete bank_soal"
    ON public.bank_soal
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_bank_soal_updated_at
    BEFORE UPDATE ON public.bank_soal
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
