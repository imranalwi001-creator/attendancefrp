ALTER TABLE public.peminjaman_buku
ADD COLUMN IF NOT EXISTS bukti_pengembalian_url TEXT,
ADD COLUMN IF NOT EXISTS dikembalikan_oleh_santri BOOLEAN DEFAULT false;