-- Create a trigger function to auto-update tagihan status when pembayaran is inserted
CREATE OR REPLACE FUNCTION public.update_tagihan_on_pembayaran()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.tagihan
  SET status = 'menunggu_verifikasi', updated_at = now()
  WHERE id = NEW.tagihan_id;
  RETURN NEW;
END;
$$;

-- Create trigger on pembayaran table
CREATE TRIGGER trg_update_tagihan_on_pembayaran
  AFTER INSERT ON public.pembayaran
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tagihan_on_pembayaran();