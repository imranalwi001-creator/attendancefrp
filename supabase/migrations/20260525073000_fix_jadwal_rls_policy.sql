-- Perluas hak kelola jadwal untuk peran akademik yang memang memakai modul jadwal.
-- Sebelumnya hanya admin yang bisa insert/update/delete, sehingga simpan jadwal
-- gagal untuk role lain yang sah di UI.

DROP POLICY IF EXISTS "Admins can insert jadwal" ON public.jadwal;
DROP POLICY IF EXISTS "Admins can update jadwal" ON public.jadwal;
DROP POLICY IF EXISTS "Admins can delete jadwal" ON public.jadwal;

CREATE POLICY "Academic staff can insert jadwal"
ON public.jadwal FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'guru'::public.app_role) OR
  public.has_role(auth.uid(), 'walikelas'::public.app_role) OR
  public.has_role(auth.uid(), 'Pembina'::public.app_role) OR
  public.has_role(auth.uid(), 'guru_ekskul'::public.app_role)
);

CREATE POLICY "Academic staff can update jadwal"
ON public.jadwal FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'guru'::public.app_role) OR
  public.has_role(auth.uid(), 'walikelas'::public.app_role) OR
  public.has_role(auth.uid(), 'Pembina'::public.app_role) OR
  public.has_role(auth.uid(), 'guru_ekskul'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'guru'::public.app_role) OR
  public.has_role(auth.uid(), 'walikelas'::public.app_role) OR
  public.has_role(auth.uid(), 'Pembina'::public.app_role) OR
  public.has_role(auth.uid(), 'guru_ekskul'::public.app_role)
);

CREATE POLICY "Academic staff can delete jadwal"
ON public.jadwal FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR
  public.has_role(auth.uid(), 'guru'::public.app_role) OR
  public.has_role(auth.uid(), 'walikelas'::public.app_role) OR
  public.has_role(auth.uid(), 'Pembina'::public.app_role) OR
  public.has_role(auth.uid(), 'guru_ekskul'::public.app_role)
);
