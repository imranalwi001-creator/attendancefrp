-- Create enum for jenis izin
DO $$
BEGIN
  CREATE TYPE public.jenis_izin AS ENUM ('sakit', 'izin', 'cuti', 'dinas_luar', 'lainnya');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for status izin
DO $$
BEGIN
  CREATE TYPE public.status_izin AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create table for staff leave requests
CREATE TABLE IF NOT EXISTS public.pengajuan_izin_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  jenis_izin jenis_izin NOT NULL,
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  keterangan TEXT,
  lampiran_url TEXT,
  status status_izin NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for santri leave requests
CREATE TABLE IF NOT EXISTS public.pengajuan_izin_santri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id UUID NOT NULL REFERENCES public.santri(id) ON DELETE CASCADE,
  jenis_izin jenis_izin NOT NULL,
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  keterangan TEXT,
  lampiran_url TEXT,
  status status_izin NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pengajuan_izin_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengajuan_izin_santri ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pengajuan_izin_staff
DO $$
BEGIN
  CREATE POLICY "Admins can manage pengajuan_izin_staff"
  ON public.pengajuan_izin_staff
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can view own izin"
  ON public.pengajuan_izin_staff
  FOR SELECT
  USING (auth.uid() = staff_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for pengajuan_izin_santri
DO $$
BEGIN
  CREATE POLICY "Admins can manage pengajuan_izin_santri"
  ON public.pengajuan_izin_santri
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Santri can view own izin"
  ON public.pengajuan_izin_santri
  FOR SELECT
  USING (auth.uid() = santri_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Parents can view children izin"
  ON public.pengajuan_izin_santri
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM parent_children pc
    WHERE pc.parent_id = auth.uid() AND pc.child_id = pengajuan_izin_santri.santri_id
  ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create triggers for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_pengajuan_izin_staff_updated_at
    BEFORE UPDATE ON public.pengajuan_izin_staff
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_pengajuan_izin_santri_updated_at
    BEFORE UPDATE ON public.pengajuan_izin_santri
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
