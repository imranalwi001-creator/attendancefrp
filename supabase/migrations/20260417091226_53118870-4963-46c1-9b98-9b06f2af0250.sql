-- Proteksi: Mencegah block_id pada jadwal hilang (di-NULL-kan) setelah pernah diset.
-- Ini melindungi data jadwal di sistem blok agar tidak "lepas" dari blok asalnya secara tidak sengaja.
CREATE OR REPLACE FUNCTION public.protect_jadwal_block_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Jika sebelumnya jadwal sudah punya block_id, jangan biarkan di-NULL-kan
  IF OLD.block_id IS NOT NULL AND NEW.block_id IS NULL THEN
    NEW.block_id := OLD.block_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_jadwal_block_id ON public.jadwal;
CREATE TRIGGER trg_protect_jadwal_block_id
BEFORE UPDATE ON public.jadwal
FOR EACH ROW
EXECUTE FUNCTION public.protect_jadwal_block_id();