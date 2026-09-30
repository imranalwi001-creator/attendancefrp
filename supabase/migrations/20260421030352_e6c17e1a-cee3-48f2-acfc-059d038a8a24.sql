
-- Trigger: auto-sync `tersedia` saat total_eksemplar diubah admin
CREATE OR REPLACE FUNCTION public.sync_buku_tersedia_on_total_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  active_loans int;
BEGIN
  IF NEW.total_eksemplar IS DISTINCT FROM OLD.total_eksemplar THEN
    SELECT COUNT(*) INTO active_loans
    FROM public.peminjaman_buku
    WHERE buku_id = NEW.id AND status IN ('dipinjam','terlambat');

    NEW.tersedia := GREATEST(NEW.total_eksemplar - active_loans, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_buku_tersedia_on_total_change ON public.buku;
CREATE TRIGGER trg_sync_buku_tersedia_on_total_change
BEFORE UPDATE ON public.buku
FOR EACH ROW
EXECUTE FUNCTION public.sync_buku_tersedia_on_total_change();

-- Backfill data existing: sinkronkan tersedia berdasarkan peminjaman aktif
UPDATE public.buku b
SET tersedia = GREATEST(
  b.total_eksemplar - COALESCE((
    SELECT COUNT(*) FROM public.peminjaman_buku pb
    WHERE pb.buku_id = b.id AND pb.status IN ('dipinjam','terlambat')
  ), 0),
  0
),
updated_at = now()
WHERE b.status != 'arsip';
