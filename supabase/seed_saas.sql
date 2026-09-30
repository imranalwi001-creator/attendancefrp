-- Seed sample tenants and invoices
DO $$
DECLARE
    v_owner_id UUID;
    v_ws1_id UUID := gen_random_uuid();
    v_ws2_id UUID := gen_random_uuid();
    v_ws3_id UUID := gen_random_uuid();
    v_ws4_id UUID := gen_random_uuid();
BEGIN
    SELECT id INTO v_owner_id FROM auth.users WHERE email = 'admin@pesantren.app' LIMIT 1;
    IF v_owner_id IS NULL THEN
        SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
    END IF;

    -- Update existing workspaces with sensible defaults
    UPDATE public.workspaces 
    SET status = 'active',
        subdomain = 'global-admin',
        subscription_plan = 'enterprise',
        max_students = 1000,
        max_teachers = 100
    WHERE type = 'mandiri';

    -- Insert Pesantren Al-Hidayah
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE name = 'Pesantren Modern Al-Hidayah') THEN
        INSERT INTO public.workspaces (id, name, type, education_level, owner_id, status, subdomain, subscription_plan, max_students, max_teachers, contact_email, contact_phone, address, created_at)
        VALUES (v_ws1_id, 'Pesantren Modern Al-Hidayah', 'sekolah', 'pesantren', v_owner_id, 'active', 'alhidayah', 'enterprise', 450, 45, 'admin@alhidayah.sch.id', '081234567890', 'Jl. Pesantren No. 12, Bogor', now() - interval '60 days');

        INSERT INTO public.saas_invoices (workspace_id, invoice_number, plan_name, amount, status, billing_cycle, payment_method, paid_at, due_date)
        VALUES (v_ws1_id, 'INV-2026-001', 'Enterprise Pesantren', 1500000, 'paid', 'monthly', 'Transfer Bank BCA', now() - interval '15 days', now() + interval '15 days');
    END IF;

    -- Insert SDIT Insan Cendekia
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE name = 'SDIT Insan Cendekia') THEN
        INSERT INTO public.workspaces (id, name, type, education_level, owner_id, status, subdomain, subscription_plan, max_students, max_teachers, contact_email, contact_phone, address, created_at)
        VALUES (v_ws2_id, 'SDIT Insan Cendekia', 'sekolah', 'sd', v_owner_id, 'active', 'sdit-cendekia', 'pro', 320, 25, 'kontak@insancendekia.sch.id', '081987654321', 'Jl. Pendidikan No. 45, Bandung', now() - interval '45 days');

        INSERT INTO public.saas_invoices (workspace_id, invoice_number, plan_name, amount, status, billing_cycle, payment_method, paid_at, due_date)
        VALUES (v_ws2_id, 'INV-2026-002', 'Pro School', 750000, 'paid', 'monthly', 'Virtual Account Mandiri', now() - interval '10 days', now() + interval '20 days');
    END IF;

    -- Insert SMP Plus Bina Bangsa
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE name = 'SMP Plus Bina Bangsa') THEN
        INSERT INTO public.workspaces (id, name, type, education_level, owner_id, status, subdomain, subscription_plan, max_students, max_teachers, contact_email, contact_phone, address, created_at)
        VALUES (v_ws3_id, 'SMP Plus Bina Bangsa', 'sekolah', 'smp', v_owner_id, 'trial', 'smpplus-binabangsa', 'trial', 150, 15, 'info@binabangsa.sch.id', '081345678901', 'Jl. Merdeka No. 88, Surabaya', now() - interval '5 days');

        INSERT INTO public.saas_invoices (workspace_id, invoice_number, plan_name, amount, status, billing_cycle, payment_method, paid_at, due_date)
        VALUES (v_ws3_id, 'INV-2026-003', 'Starter School', 450000, 'pending', 'monthly', 'Menunggu Pembayaran', NULL, now() + interval '25 days');
    END IF;

    -- Insert SMA Teladan Mandiri
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE name = 'SMA Teladan Mandiri') THEN
        INSERT INTO public.workspaces (id, name, type, education_level, owner_id, status, subdomain, subscription_plan, max_students, max_teachers, contact_email, contact_phone, address, created_at)
        VALUES (v_ws4_id, 'SMA Teladan Mandiri', 'sekolah', 'sma', v_owner_id, 'suspended', 'smateladan', 'starter', 200, 20, 'admin@smateladan.sch.id', '081299887766', 'Jl. Pemuda No. 10, Jakarta', now() - interval '90 days');

        INSERT INTO public.saas_invoices (workspace_id, invoice_number, plan_name, amount, status, billing_cycle, payment_method, paid_at, due_date)
        VALUES (v_ws4_id, 'INV-2026-004', 'Starter School', 450000, 'overdue', 'monthly', 'Tagihan Jatuh Tempo', NULL, now() - interval '5 days');
    END IF;

    -- Seed default SaaS settings if empty
    INSERT INTO public.app_settings (setting_key, setting_value)
    VALUES 
        ('saas_platform_name', 'LMS Digiss'),
        ('saas_tagline', 'Platform Terpadu Manajemen Sekolah & Pesantren Modern'),
        ('saas_support_email', 'support@digiss.app'),
        ('saas_support_phone', '0812-3456-7890'),
        ('saas_trial_days', '30'),
        ('saas_allow_registration', 'true'),
        ('saas_mpwa_endpoint', 'https://api.mpwa.id/v1/send-message'),
        ('saas_mpwa_api_key', 'mpwa_sec_live_9a87bf23c'),
        ('saas_mpwa_sender', '6281234567890'),
        ('saas_midtrans_client_key', 'SB-Mid-client-sample-key'),
        ('saas_midtrans_server_key', 'SB-Mid-server-sample-key'),
        ('saas_midtrans_is_production', 'false')
    ON CONFLICT (setting_key) DO NOTHING;

    -- Seed sample activity logs if empty
    IF NOT EXISTS (SELECT 1 FROM public.activity_logs LIMIT 1) THEN
        INSERT INTO public.activity_logs (user_id, user_name, user_role, action, category, description, created_at)
        VALUES 
            (v_owner_id, 'Superadmin', 'admin', 'REGISTER_TENANT', 'TENANT', 'Mendaftarkan tenant baru: Pesantren Modern Al-Hidayah', now() - interval '2 hours'),
            (v_owner_id, 'Superadmin', 'admin', 'UPDATE_SETTINGS', 'SYSTEM', 'Memperbarui konfigurasi gateway WhatsApp MPWA', now() - interval '5 hours'),
            (v_owner_id, 'Superadmin', 'admin', 'APPROVE_PAYMENT', 'BILLING', 'Verifikasi pembayaran invoice INV-2026-002 untuk SDIT Insan Cendekia', now() - interval '1 day'),
            (v_owner_id, 'Superadmin', 'admin', 'SYSTEM_BACKUP', 'SYSTEM', 'Pemeriksaan rutin dan sinkronisasi database server berhasil', now() - interval '2 days');
    END IF;
END $$;
