-- Add materi_id column to subject_forum_posts for attaching materi to forum posts
ALTER TABLE public.subject_forum_posts 
ADD COLUMN IF NOT EXISTS materi_id UUID REFERENCES public.materi(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_subject_forum_posts_materi_id ON public.subject_forum_posts(materi_id);

-- Add comment
DO $$
BEGIN
  COMMENT ON COLUMN public.subject_forum_posts.materi_id IS 'Reference to attached materi for announcement posts';
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;
