-- Create a function to sync master_mapel changes to mapel table
CREATE OR REPLACE FUNCTION sync_master_mapel_to_mapel()
RETURNS TRIGGER AS $$
BEGIN
  -- When master_mapel is updated, update all matching mapel records by name
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.mapel
    SET 
      nama = NEW.nama,
      kategori = NEW.kategori,
      deskripsi = COALESCE(NEW.deskripsi, mapel.deskripsi),
      updated_at = now()
    WHERE nama = OLD.nama;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run after master_mapel update
DROP TRIGGER IF EXISTS trigger_sync_master_mapel ON public.master_mapel;
CREATE TRIGGER trigger_sync_master_mapel
  AFTER UPDATE ON public.master_mapel
  FOR EACH ROW
  EXECUTE FUNCTION sync_master_mapel_to_mapel();