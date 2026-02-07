-- Migration: Add bavardage penalty setting
-- Description: Add column to track if bavardages should reduce participation count

ALTER TABLE class_trimester_config
ADD COLUMN IF NOT EXISTS bavardage_penalty BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN class_trimester_config.bavardage_penalty IS 'If true, each bavardage counts as -1 participation in grade calculation';
