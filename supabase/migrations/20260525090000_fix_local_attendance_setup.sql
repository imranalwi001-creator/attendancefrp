-- Keep local attendance usable after a fresh Supabase reset.
-- Browser geolocation returns decimal coordinates, so attendance/location
-- columns must not be integers.
ALTER TABLE public.kehadiran_staff
  ALTER COLUMN latitude_masuk TYPE double precision USING latitude_masuk::double precision,
  ALTER COLUMN longitude_masuk TYPE double precision USING longitude_masuk::double precision,
  ALTER COLUMN latitude_pulang TYPE double precision USING latitude_pulang::double precision,
  ALTER COLUMN longitude_pulang TYPE double precision USING longitude_pulang::double precision;

ALTER TABLE public.lokasi_absen
  ALTER COLUMN latitude TYPE double precision USING latitude::double precision,
  ALTER COLUMN longitude TYPE double precision USING longitude::double precision;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO public.lokasi_absen (nama, alamat, latitude, longitude, radius)
SELECT 'Lokasi Lokal', 'Konfigurasi default untuk Supabase lokal', 0, 0, 25000000
WHERE NOT EXISTS (SELECT 1 FROM public.lokasi_absen);

INSERT INTO public.staff (id, position, employee_id, join_date)
SELECT p.id, COALESCE(ur.role::text, 'staff'), 'LOCAL-' || LEFT(p.id::text, 8), CURRENT_DATE::text
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id = p.id)
  AND (
    ur.role IN ('admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul')
    OR p.email = 'admin@pesantren.app'
  );
