DO $$
DECLARE
  selected_dates_type text;
BEGIN
  IF to_regclass('public.learning_blocks') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.data_type
  INTO selected_dates_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'learning_blocks'
    AND c.column_name = 'selected_dates';

  IF selected_dates_type IS NULL THEN
    RETURN;
  END IF;

  IF selected_dates_type = 'text' THEN
    BEGIN
      ALTER TABLE public.learning_blocks
      ALTER COLUMN selected_dates TYPE text[]
      USING (
        CASE
          WHEN selected_dates IS NULL OR btrim(selected_dates) = '' THEN NULL
          WHEN btrim(selected_dates) ~ '^\{.*\}$' THEN selected_dates::text[]
          ELSE string_to_array(replace(selected_dates, ' ', ''), ',')
        END
      );
    EXCEPTION
      WHEN others THEN NULL;
    END;
  END IF;

  IF selected_dates_type = 'ARRAY' OR selected_dates_type = 'text' THEN
    UPDATE public.learning_blocks
    SET selected_dates = (
      SELECT array_agg(DISTINCT d ORDER BY d)
      FROM unnest(
        COALESCE(selected_dates, ARRAY[]::text[]) || ARRAY['2026-04-29', '2026-04-30', '2026-05-04']::text[]
      ) AS d
    ),
    updated_at = now()
    WHERE id = '0d7329da-29b3-4cc3-807e-4d6a8b9d256d';
  END IF;
END $$;
