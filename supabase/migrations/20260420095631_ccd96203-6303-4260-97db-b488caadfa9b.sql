CREATE POLICY "Santri create own peminjaman"
ON public.peminjaman_buku
FOR INSERT
TO authenticated
WITH CHECK (santri_id = auth.uid());