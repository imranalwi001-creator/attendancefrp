-- Create enum type for post types
DO $$
BEGIN
  CREATE TYPE public.forum_post_type AS ENUM ('announcement', 'qna', 'resource');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create subject_forum_posts table
CREATE TABLE IF NOT EXISTS public.subject_forum_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.mapel(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  post_type forum_post_type NOT NULL DEFAULT 'qna',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_solved BOOLEAN NOT NULL DEFAULT false,
  resource_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subject_forum_comments table
CREATE TABLE IF NOT EXISTS public.subject_forum_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.subject_forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subject_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_forum_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_forum_posts
DO $$
BEGIN
  CREATE POLICY "Authenticated can view forum posts"
  ON public.subject_forum_posts
  FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Staff can insert forum posts"
  ON public.subject_forum_posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'guru'::app_role) OR
      has_role(auth.uid(), 'walikelas'::app_role) OR
      has_role(auth.uid(), 'Pembina'::app_role) OR
      has_role(auth.uid(), 'santri'::app_role)
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own posts"
  ON public.subject_forum_posts
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'guru'::app_role) OR
    has_role(auth.uid(), 'walikelas'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own posts or staff can delete"
  ON public.subject_forum_posts
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'guru'::app_role) OR
    has_role(auth.uid(), 'walikelas'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS Policies for subject_forum_comments
DO $$
BEGIN
  CREATE POLICY "Authenticated can view forum comments"
  ON public.subject_forum_comments
  FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated can insert forum comments"
  ON public.subject_forum_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'guru'::app_role) OR
      has_role(auth.uid(), 'walikelas'::app_role) OR
      has_role(auth.uid(), 'Pembina'::app_role) OR
      has_role(auth.uid(), 'santri'::app_role)
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own comments"
  ON public.subject_forum_comments
  FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own comments or staff can delete"
  ON public.subject_forum_comments
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'guru'::app_role) OR
    has_role(auth.uid(), 'walikelas'::app_role)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_forum_posts_subject_id ON public.subject_forum_posts(subject_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON public.subject_forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON public.subject_forum_comments(post_id);

-- Create trigger for updating updated_at
DO $$
BEGIN
  CREATE TRIGGER update_forum_posts_updated_at
  BEFORE UPDATE ON public.subject_forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_forum_comments_updated_at
  BEFORE UPDATE ON public.subject_forum_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
