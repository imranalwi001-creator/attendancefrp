-- Add ujian_id column to subject_forum_posts table
ALTER TABLE subject_forum_posts 
ADD COLUMN IF NOT EXISTS ujian_id UUID REFERENCES ujian(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_subject_forum_posts_ujian_id ON subject_forum_posts(ujian_id) WHERE ujian_id IS NOT NULL;
