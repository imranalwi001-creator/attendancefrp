-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON public.activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_role ON public.activity_logs(user_role);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view activity logs
DO $$
BEGIN
  CREATE POLICY "Admins can view activity_logs"
  ON public.activity_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- All authenticated users can insert their own logs
DO $$
BEGIN
  CREATE POLICY "Authenticated users can insert activity_logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admins can insert any logs
DO $$
BEGIN
  CREATE POLICY "Admins can insert any activity_logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Only admins can delete logs (for cleanup purposes)
DO $$
BEGIN
  CREATE POLICY "Admins can delete activity_logs"
  ON public.activity_logs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
