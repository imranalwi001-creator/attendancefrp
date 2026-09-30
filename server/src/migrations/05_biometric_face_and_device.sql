-- ==============================================================================
-- 05_biometric_face_and_device.sql
-- Migration: Add Facial Biometric Vectors & Device Binding (1 Employee = 1 Phone)
-- ==============================================================================

ALTER TABLE hrm_profiles 
  ADD COLUMN IF NOT EXISTS face_embedding FLOAT8[],
  ADD COLUMN IF NOT EXISTS face_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS face_enrolled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS device_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_device_bound BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_bound_at TIMESTAMP WITH TIME ZONE;

-- Index for instant lookup of bound devices
CREATE INDEX IF NOT EXISTS idx_hrm_profiles_device_id ON hrm_profiles(device_id);
