-- Step 1: Clean up existing duplicates by keeping only the latest submission
DELETE FROM pengumpulan_tugas 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY santri_id, tugas_id ORDER BY created_at DESC) as rn
    FROM pengumpulan_tugas
  ) sub
  WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent duplicate submissions
ALTER TABLE pengumpulan_tugas 
ADD CONSTRAINT pengumpulan_tugas_santri_tugas_unique 
UNIQUE (santri_id, tugas_id);