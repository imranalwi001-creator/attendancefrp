-- Create enum types for the SaaS structure
CREATE TYPE workspace_type AS ENUM ('mandiri', 'sekolah');
CREATE TYPE education_level AS ENUM ('paud', 'sd', 'smp', 'sma', 'smk', 'pesantren');

-- Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type workspace_type NOT NULL DEFAULT 'sekolah',
    education_level education_level NOT NULL DEFAULT 'pesantren',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add workspace_id to profiles
ALTER TABLE public.profiles
ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
ADD COLUMN workspace_role TEXT; -- 'owner', 'admin', 'teacher', 'student', 'parent'

-- Add workspace_id to key tables
ALTER TABLE public.kelas ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.mapel ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.sesi_pembelajaran ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Enable RLS on workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace Policies
CREATE POLICY "Users can view workspaces they belong to" 
ON public.workspaces FOR SELECT 
USING (
    id IN (
        SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
    ) OR owner_id = auth.uid()
);

CREATE POLICY "Workspace owners can update their workspace" 
ON public.workspaces FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create workspaces" 
ON public.workspaces FOR INSERT 
WITH CHECK (auth.uid() = owner_id);
