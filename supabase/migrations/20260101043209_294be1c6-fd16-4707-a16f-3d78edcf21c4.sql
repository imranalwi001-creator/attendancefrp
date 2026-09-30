-- Insert attendance data for today with the requested distribution
-- 50% Hadir (4 staff), 20% Izin (1 staff), 20% Sakit (1 staff), 10% Tidak Hadir (1 staff)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.staff LIMIT 1) THEN

-- Hadir - Administrator (with clock in/out)
INSERT INTO kehadiran_staff (staff_id, tanggal, jam_masuk, jam_pulang, status, status_lokasi_masuk, status_lokasi_pulang)
VALUES ('d0cd3638-2f5f-4d7d-a9c6-3a912c02865b', CURRENT_DATE, '07:15:00', '16:05:00', 'hadir', 'dalam_radius', 'dalam_radius')
ON CONFLICT DO NOTHING;

-- Hadir - Akmal
INSERT INTO kehadiran_staff (staff_id, tanggal, jam_masuk, jam_pulang, status, status_lokasi_masuk, status_lokasi_pulang)
VALUES ('fe59f9c7-4a41-4ccd-9fca-aaee22e80741', CURRENT_DATE, '07:25:00', '16:10:00', 'hadir', 'dalam_radius', 'dalam_radius')
ON CONFLICT DO NOTHING;

-- Hadir - Budi Pekerti
INSERT INTO kehadiran_staff (staff_id, tanggal, jam_masuk, jam_pulang, status, status_lokasi_masuk, status_lokasi_pulang)
VALUES ('c98bc832-a704-4ca4-b698-51dfcd4abed2', CURRENT_DATE, '07:30:00', '16:00:00', 'hadir', 'dalam_radius', 'dalam_radius')
ON CONFLICT DO NOTHING;

-- Hadir - Fatimah
INSERT INTO kehadiran_staff (staff_id, tanggal, jam_masuk, jam_pulang, status, status_lokasi_masuk, status_lokasi_pulang)
VALUES ('6ad3a4a0-3a1c-4fec-90e0-17df3f06fec5', CURRENT_DATE, '07:20:00', '16:15:00', 'hadir', 'dalam_radius', 'dalam_radius')
ON CONFLICT DO NOTHING;

-- Izin - Muh Arkano
INSERT INTO kehadiran_staff (staff_id, tanggal, status)
VALUES ('e45af9ba-002c-4cac-b350-5ab9262313d9', CURRENT_DATE, 'izin')
ON CONFLICT DO NOTHING;

-- Sakit - Sitti Rahma
INSERT INTO kehadiran_staff (staff_id, tanggal, status)
VALUES ('83351583-d623-446b-9f19-612b27f9abfa', CURRENT_DATE, 'sakit')
ON CONFLICT DO NOTHING;

-- Tidak Hadir - Ursula (no record or empty status means absent)
INSERT INTO kehadiran_staff (staff_id, tanggal, status)
VALUES ('4d7bd722-d24b-428f-81ea-b40c25ec659f', CURRENT_DATE, 'tidak_hadir')
ON CONFLICT DO NOTHING;

  END IF;
END $$;
