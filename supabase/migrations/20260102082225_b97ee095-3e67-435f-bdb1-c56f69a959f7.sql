
-- Migrate existing tujuan_tercapai_ids data from sesi_pembelajaran to tujuan_pembelajaran_status
-- This handles data that was created before the tracking feature was implemented

-- Insert status for TP that were marked as tercapai in existing sessions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tujuan_pembelajaran_status'
      AND c.contype IN ('u', 'p')
      AND pg_get_constraintdef(c.oid) ILIKE '%(mapel_id, tp_index, semester, academic_year_id)%'
  ) THEN
    INSERT INTO tujuan_pembelajaran_status (mapel_id, tp_index, status, achieved_in_sesi_id, achieved_at, semester, academic_year_id)
    SELECT 
      j.mapel_id,
      (tp_id::text)::integer as tp_index,
      'tercapai' as status,
      sp.id as achieved_in_sesi_id,
      sp.updated_at as achieved_at,
      j.semester,
      (SELECT id FROM academic_years WHERE is_active = true LIMIT 1) as academic_year_id
    FROM sesi_pembelajaran sp
    JOIN jadwal j ON j.id = sp.jadwal_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN sp.metadata->>'tujuan_tercapai_ids' IS NOT NULL 
        THEN sp.metadata->'tujuan_tercapai_ids'
        ELSE '[]'::jsonb
      END
    ) as tp_id
    WHERE sp.status = 'selesai'
      AND sp.metadata->>'tujuan_tercapai_ids' IS NOT NULL
    ON CONFLICT (mapel_id, tp_index, semester, academic_year_id) 
    DO UPDATE SET 
      status = 'tercapai',
      achieved_in_sesi_id = EXCLUDED.achieved_in_sesi_id,
      achieved_at = EXCLUDED.achieved_at,
      updated_at = now()
    WHERE tujuan_pembelajaran_status.status != 'tercapai';
  END IF;
END $$;
