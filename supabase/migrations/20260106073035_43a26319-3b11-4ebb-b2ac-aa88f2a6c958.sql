-- Menambahkan kolom kategori ke tabel jadwal
ALTER TABLE jadwal 
ADD COLUMN IF NOT EXISTS kategori text NOT NULL DEFAULT 'akademik';

-- Menambahkan constraint untuk memastikan nilai valid
DO $$
BEGIN
  ALTER TABLE jadwal 
  ADD CONSTRAINT jadwal_kategori_check 
  CHECK (kategori IN ('akademik', 'asrama'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Menambahkan index untuk performa query berdasarkan kategori
CREATE INDEX IF NOT EXISTS idx_jadwal_kategori ON jadwal(kategori);
