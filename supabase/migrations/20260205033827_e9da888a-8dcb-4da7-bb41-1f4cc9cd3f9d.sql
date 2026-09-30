-- Add psychology document columns to santri table
ALTER TABLE public.santri 
ADD COLUMN IF NOT EXISTS stifin_url TEXT,
ADD COLUMN IF NOT EXISTS asesmen_awal_url JSONB;