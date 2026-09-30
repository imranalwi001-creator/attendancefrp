-- Add UNIQUE constraint on user_id to ensure each user only has one role record
ALTER TABLE public.user_roles ADD CONSTRAINT unique_user_role UNIQUE (user_id);