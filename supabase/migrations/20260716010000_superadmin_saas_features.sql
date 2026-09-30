-- Migration: 20260716010000_superadmin_saas_features.sql
-- Description: Menambahkan fitur SaaS Superadmin (Tenants, Invoices, Quotas, dan RLS)

-- 1. Tambah kolom pendukung SaaS di tabel workspaces
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subdomain TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS max_teachers INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Buat tabel saas_invoices untuk billing tenant
CREATE TABLE IF NOT EXISTS public.saas_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    plan_name TEXT NOT NULL DEFAULT 'Starter School',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'paid', -- 'paid', 'pending', 'overdue', 'cancelled'
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'annually'
    payment_method TEXT DEFAULT 'Transfer Bank Manual',
    due_date TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;

-- 3. Fungsi pembantu is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles p
        JOIN public.workspaces w ON p.workspace_id = w.id
        WHERE p.id = p_user_id 
          AND w.type = 'mandiri' 
          AND p.workspace_role = 'admin'
    ) OR EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = p_user_id 
          AND u.email IN ('admin@pesantren.app', 'admin@digiss.app', 'superadmin@digiss.app')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Policies untuk workspaces (Superadmin bisa akses semua tenant)
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Superadmin full access to workspaces" ON public.workspaces;
CREATE POLICY "Superadmin full access to workspaces"
ON public.workspaces FOR ALL
TO authenticated
USING (
    public.is_superadmin(auth.uid()) OR 
    (id IN (SELECT profiles.workspace_id FROM profiles WHERE profiles.id = auth.uid())) OR 
    (owner_id = auth.uid())
)
WITH CHECK (
    public.is_superadmin(auth.uid()) OR (owner_id = auth.uid())
);

-- 5. RLS Policies untuk saas_invoices
DROP POLICY IF EXISTS "Superadmin full access to saas_invoices" ON public.saas_invoices;
CREATE POLICY "Superadmin full access to saas_invoices"
ON public.saas_invoices FOR ALL
TO authenticated
USING (
    public.is_superadmin(auth.uid()) OR
    (workspace_id IN (SELECT profiles.workspace_id FROM profiles WHERE profiles.id = auth.uid()))
)
WITH CHECK (
    public.is_superadmin(auth.uid())
);

-- 6. RLS Policies untuk app_settings (Izinkan Superadmin baca & tulis)
DROP POLICY IF EXISTS "Superadmin manage app_settings" ON public.app_settings;
CREATE POLICY "Superadmin manage app_settings"
ON public.app_settings FOR ALL
TO authenticated
USING (
    public.is_superadmin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
    public.is_superadmin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
);
