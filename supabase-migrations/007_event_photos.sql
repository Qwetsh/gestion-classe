-- Migration: Event Photos (Remarques)
-- Description: Add photo_path column to events table for remarques with photos

-- Add photo_path column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN events.photo_path IS 'Path to photo in Supabase Storage (student-photos bucket) for remarque events';
