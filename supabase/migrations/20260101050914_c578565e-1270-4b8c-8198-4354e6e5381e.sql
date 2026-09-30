-- Add unique constraint for raport upsert
ALTER TABLE public.raport 
ADD CONSTRAINT raport_santri_kelas_tahun_semester_unique 
UNIQUE (santri_id, kelas_id, tahun_ajaran, semester);