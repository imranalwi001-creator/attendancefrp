
ALTER TABLE public.sesi_pembelajaran
  ADD COLUMN IF NOT EXISTS mapel_id uuid REFERENCES public.mapel(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kelas_id uuid REFERENCES public.kelas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hari text,
  ADD COLUMN IF NOT EXISTS jam_mulai text,
  ADD COLUMN IF NOT EXISTS jam_selesai text,
  ADD COLUMN IF NOT EXISTS jadwal_pengampu_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

UPDATE public.sesi_pembelajaran s
SET mapel_id = COALESCE(s.mapel_id, j.mapel_id),
    kelas_id = COALESCE(s.kelas_id, j.kelas_id),
    hari = COALESCE(s.hari, j.hari),
    jam_mulai = COALESCE(s.jam_mulai, j.jam_mulai),
    jam_selesai = COALESCE(s.jam_selesai, j.jam_selesai),
    jadwal_pengampu_id = COALESCE(s.jadwal_pengampu_id, j.pengampu_id)
FROM public.jadwal j
WHERE s.jadwal_id = j.id;

CREATE INDEX IF NOT EXISTS idx_sesi_pembelajaran_mapel_id ON public.sesi_pembelajaran(mapel_id);
CREATE INDEX IF NOT EXISTS idx_sesi_pembelajaran_kelas_id ON public.sesi_pembelajaran(kelas_id);

CREATE OR REPLACE FUNCTION public.snapshot_sesi_from_jadwal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.jadwal_id IS NOT NULL THEN
    SELECT j.mapel_id, j.kelas_id, j.hari, j.jam_mulai, j.jam_selesai, j.pengampu_id
      INTO NEW.mapel_id, NEW.kelas_id, NEW.hari, NEW.jam_mulai, NEW.jam_selesai, NEW.jadwal_pengampu_id
    FROM public.jadwal j
    WHERE j.id = NEW.jadwal_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_sesi_from_jadwal ON public.sesi_pembelajaran;
CREATE TRIGGER trg_snapshot_sesi_from_jadwal
BEFORE INSERT ON public.sesi_pembelajaran
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_sesi_from_jadwal();
