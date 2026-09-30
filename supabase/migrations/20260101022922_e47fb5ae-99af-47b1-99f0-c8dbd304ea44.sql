-- Allow orangtua to read their children's basic profile info (name/avatar/status)
-- This fixes "Nama tidak diketahui" on Profil Orang Tua when fetching profiles by child_id.

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Parents can view children profiles'
  ) THEN
    CREATE POLICY "Parents can view children profiles"
    ON public.profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.parent_children pc
        WHERE pc.parent_id = auth.uid()
          AND pc.child_id = profiles.id
      )
    );
  END IF;
END $$;
