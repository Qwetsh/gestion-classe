-- Migration: Add gender field to students table
-- Default 'M' (garcon), can be 'F' (fille)

ALTER TABLE students
ADD COLUMN IF NOT EXISTS gender VARCHAR(1) DEFAULT 'M' CHECK (gender IN ('M', 'F'));

-- Update existing students to have default gender
UPDATE students SET gender = 'M' WHERE gender IS NULL;
