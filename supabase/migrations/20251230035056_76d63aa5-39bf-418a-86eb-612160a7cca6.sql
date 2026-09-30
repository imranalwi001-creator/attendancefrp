-- Create push_subscriptions table for storing push notification tokens
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
DO $$
BEGIN
  CREATE POLICY "Users can view own subscriptions" 
  ON public.push_subscriptions FOR SELECT 
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own subscriptions" 
  ON public.push_subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own subscriptions" 
  ON public.push_subscriptions FOR UPDATE 
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own subscriptions" 
  ON public.push_subscriptions FOR DELETE 
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
