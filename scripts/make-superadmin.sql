DO $$
DECLARE
    v_user_id UUID;
    v_workspace_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@pesantren.app' LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User admin@pesantren.app not found.';
    END IF;

    -- Get or create workspace 'mandiri'
    SELECT id INTO v_workspace_id FROM public.workspaces WHERE type = 'mandiri' LIMIT 1;
    
    IF v_workspace_id IS NULL THEN
        INSERT INTO public.workspaces (name, type, education_level, owner_id)
        VALUES ('SaaS Global Control Center', 'mandiri', 'pesantren', v_user_id)
        RETURNING id INTO v_workspace_id;
    END IF;

    -- Update profiles
    UPDATE public.profiles 
    SET workspace_id = v_workspace_id,
        workspace_role = 'admin'
    WHERE id = v_user_id;

    -- Update user_roles
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
    
    RAISE NOTICE 'Success! User is now a global superadmin in workspace %', v_workspace_id;
END $$;
