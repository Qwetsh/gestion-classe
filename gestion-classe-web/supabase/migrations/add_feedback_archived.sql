-- Add archived column to feedbacks table
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
