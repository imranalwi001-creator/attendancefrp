CREATE OR REPLACE FUNCTION public.protect_jadwal_block_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Cegah block_id di-NULL-kan setelah pernah diset
  IF OLD.block_id IS NOT NULL AND NEW.block_id IS NULL THEN
    NEW.block_id := OLD.block_id;
    RETURN NEW;
  END IF;

  -- Jika block_id berubah ke value lain, hanya izinkan bila ini aksi "pindah blok"
  -- yang eksplisit: yaitu UPDATE yang HANYA mengubah block_id (tidak ada kolom
  -- jadwal lain yang ikut berubah). Update biasa (edit jadwal) yang tidak sengaja
  -- mengirim block_id berbeda akan dikembalikan ke nilai lama.
  IF OLD.block_id IS NOT NULL
     AND NEW.block_id IS NOT NULL
     AND OLD.block_id <> NEW.block_id THEN
    IF NEW.hari        IS DISTINCT FROM OLD.hari        OR
       NEW.jam_mulai   IS DISTINCT FROM OLD.jam_mulai   OR
       NEW.jam_selesai IS DISTINCT FROM OLD.jam_selesai OR
       NEW.kelas_id    IS DISTINCT FROM OLD.kelas_id    OR
       NEW.mapel_id    IS DISTINCT FROM OLD.mapel_id    OR
       NEW.pengampu_id IS DISTINCT FROM OLD.pengampu_id OR
       NEW.semester    IS DISTINCT FROM OLD.semester    OR
       NEW.tipe        IS DISTINCT FROM OLD.tipe        OR
       NEW.kategori    IS DISTINCT FROM OLD.kategori    OR
       NEW.label       IS DISTINCT FROM OLD.label       OR
       NEW.ruangan     IS DISTINCT FROM OLD.ruangan     OR
       NEW.status      IS DISTINCT FROM OLD.status THEN
      -- Bukan aksi pindah blok eksplisit; rollback block_id ke nilai lama
      NEW.block_id := OLD.block_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;