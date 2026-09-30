-- Add metadata column to sesi_pembelajaran table for storing capaian belajar data
ALTER TABLE public.sesi_pembelajaran
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
