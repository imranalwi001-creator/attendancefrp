-- Tabel untuk menyimpan kehadiran staff (absen masuk/pulang)
CREATE TABLE IF NOT EXISTS public.kehadiran_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jam_masuk TIME NULL,
  jam_pulang TIME NULL,
  latitude_masuk DECIMAL(10, 8) NULL,
  longitude_masuk DECIMAL(11, 8) NULL,
  status_lokasi_masuk TEXT NULL,
  latitude_pulang DECIMAL(10, 8) NULL,
  longitude_pulang DECIMAL(11, 8) NULL,
  status_lokasi_pulang TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint: 1 record per staff per day
  CONSTRAINT unique_staff_attendance_per_day UNIQUE (staff_id, tanggal),
  
  -- Foreign key ke staff
  CONSTRAINT kehadiran_staff_staff_id_fkey FOREIGN KEY (staff_id) 
    REFERENCES public.staff(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.kehadiran_staff ENABLE ROW LEVEL SECURITY;

-- Staff can view their own attendance
DO $$
BEGIN
  CREATE POLICY "Staff can view own attendance"
  ON public.kehadiran_staff
  FOR SELECT
  USING (auth.uid() = staff_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Staff can insert their own attendance
DO $$
BEGIN
  CREATE POLICY "Staff can insert own attendance"
  ON public.kehadiran_staff
  FOR INSERT
  WITH CHECK (auth.uid() = staff_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Staff can update their own attendance (for pulang)
DO $$
BEGIN
  CREATE POLICY "Staff can update own attendance"
  ON public.kehadiran_staff
  FOR UPDATE
  USING (auth.uid() = staff_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admin can view all attendance
DO $$
BEGIN
  CREATE POLICY "Admin can view all attendance"
  ON public.kehadiran_staff
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admin can manage all attendance
DO $$
BEGIN
  CREATE POLICY "Admin can insert all attendance"
  ON public.kehadiran_staff
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin can update all attendance"
  ON public.kehadiran_staff
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admin can delete attendance"
  ON public.kehadiran_staff
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_kehadiran_staff_updated_at
  BEFORE UPDATE ON public.kehadiran_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_kehadiran_staff_tanggal ON public.kehadiran_staff(tanggal);
CREATE INDEX IF NOT EXISTS idx_kehadiran_staff_staff_id ON public.kehadiran_staff(staff_id);
