-- Add tujuan_pembelajaran_ids column to materi table
ALTER TABLE public.materi 
ADD COLUMN IF NOT EXISTS tujuan_pembelajaran_ids integer[] DEFAULT '{}'::integer[];
