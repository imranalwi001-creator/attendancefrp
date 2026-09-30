DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'mapel_kategori'
      AND e.enumlabel = 'muatan_lokal'
  ) THEN
    UPDATE mapel SET kategori = 'wajib' WHERE kategori::text = 'muatan_lokal';
    UPDATE master_mapel SET kategori = 'wajib' WHERE kategori::text = 'muatan_lokal';

    ALTER TABLE mapel ALTER COLUMN kategori DROP DEFAULT;
    ALTER TABLE master_mapel ALTER COLUMN kategori DROP DEFAULT;

    ALTER TABLE mapel ALTER COLUMN kategori TYPE text USING kategori::text;
    ALTER TABLE master_mapel ALTER COLUMN kategori TYPE text USING kategori::text;

    CREATE TYPE mapel_kategori__new AS ENUM ('wajib', 'pilihan', 'ekstrakurikuler', 'asrama');

    ALTER TABLE mapel ALTER COLUMN kategori TYPE mapel_kategori__new USING kategori::mapel_kategori__new;
    ALTER TABLE master_mapel ALTER COLUMN kategori TYPE mapel_kategori__new USING kategori::mapel_kategori__new;

    DROP TYPE mapel_kategori;
    ALTER TYPE mapel_kategori__new RENAME TO mapel_kategori;

    ALTER TABLE mapel ALTER COLUMN kategori SET DEFAULT 'wajib'::mapel_kategori;
  END IF;
END $$;
