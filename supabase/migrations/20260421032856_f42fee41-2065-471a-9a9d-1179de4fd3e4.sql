CREATE POLICY "Santri update own peminjaman return"
ON public.peminjaman_buku
FOR UPDATE
TO authenticated
USING (santri_id = auth.uid())
WITH CHECK (santri_id = auth.uid() AND status = 'dikembalikan' AND dikembalikan_oleh_santri = true);