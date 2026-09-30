-- Fix column type drift: initial schema created materi.tujuan_pembelajaran_ids as integer,
-- later migration attempted to add integer[] with IF NOT EXISTS (no-op when column already exists).
-- This migration converts it to integer[] safely.

do $$
begin
  -- Only run if column exists
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'materi'
      and column_name = 'tujuan_pembelajaran_ids'
  ) then
    -- If it's already an array, nothing to do
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'materi'
        and column_name = 'tujuan_pembelajaran_ids'
        and data_type = 'ARRAY'
    ) then
      null;
    else
      alter table public.materi
        alter column tujuan_pembelajaran_ids
        type integer[]
        using (
          case
            when tujuan_pembelajaran_ids is null then '{}'::integer[]
            else array[tujuan_pembelajaran_ids]
          end
        );

      alter table public.materi
        alter column tujuan_pembelajaran_ids
        set default '{}'::integer[];
    end if;
  end if;
end $$;

