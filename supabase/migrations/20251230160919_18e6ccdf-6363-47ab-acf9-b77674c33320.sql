-- Add new columns to staff table for basic information
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS jenis_kelamin text,
ADD COLUMN IF NOT EXISTS tempat_lahir text,
ADD COLUMN IF NOT EXISTS tanggal_lahir date,
ADD COLUMN IF NOT EXISTS nik text,
ADD COLUMN IF NOT EXISTS alamat text;

-- Add comment for documentation
COMMENT ON COLUMN public.staff.jenis_kelamin IS 'Gender: Laki-laki or Perempuan';
COMMENT ON COLUMN public.staff.tempat_lahir IS 'Place of birth';
COMMENT ON COLUMN public.staff.tanggal_lahir IS 'Date of birth';
COMMENT ON COLUMN public.staff.nik IS 'Nomor Induk Kependudukan (16 digits)';
COMMENT ON COLUMN public.staff.alamat IS 'Address';