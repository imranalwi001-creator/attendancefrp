-- Protect attendance & teaching history from cascading deletions
-- Make sesi_pembelajaran retain history when its jadwal is deleted
ALTER TABLE public.sesi_pembelajaran
  DROP CONSTRAINT sesi_pembelajaran_jadwal_id_fkey,
  ADD CONSTRAINT sesi_pembelajaran_jadwal_id_fkey
    FOREIGN KEY (jadwal_id) REFERENCES public.jadwal(id) ON DELETE SET NULL;

-- Make kehadiran_santri retain history when its sesi is deleted
ALTER TABLE public.kehadiran_santri
  DROP CONSTRAINT kehadiran_santri_sesi_id_fkey,
  ADD CONSTRAINT kehadiran_santri_sesi_id_fkey
    FOREIGN KEY (sesi_id) REFERENCES public.sesi_pembelajaran(id) ON DELETE SET NULL;

-- Make guru_pengganti retain record when its jadwal is deleted
ALTER TABLE public.guru_pengganti
  DROP CONSTRAINT guru_pengganti_jadwal_id_fkey,
  ADD CONSTRAINT guru_pengganti_jadwal_id_fkey
    FOREIGN KEY (jadwal_id) REFERENCES public.jadwal(id) ON DELETE SET NULL;

-- Allow NULLs (since we now SET NULL on delete)
ALTER TABLE public.sesi_pembelajaran ALTER COLUMN jadwal_id DROP NOT NULL;
ALTER TABLE public.kehadiran_santri ALTER COLUMN sesi_id DROP NOT NULL;
ALTER TABLE public.guru_pengganti ALTER COLUMN jadwal_id DROP NOT NULL;