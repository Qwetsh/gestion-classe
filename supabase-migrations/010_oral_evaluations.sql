-- Migration: Add oral evaluations table for tracking student oral grades per trimester
-- This allows teachers to randomly select students who haven't been evaluated yet
-- and record their oral participation grade (1-5 scale)

CREATE TABLE IF NOT EXISTS oral_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trimester INTEGER NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  school_year VARCHAR(9) NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 5),
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id, trimester, school_year)
);

-- Enable Row Level Security
ALTER TABLE oral_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own oral evaluations
CREATE POLICY "Users can manage own oral evaluations"
  ON oral_evaluations FOR ALL
  USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX idx_oral_evaluations_class ON oral_evaluations(class_id);
CREATE INDEX idx_oral_evaluations_lookup ON oral_evaluations(class_id, trimester, school_year);
CREATE INDEX idx_oral_evaluations_student ON oral_evaluations(student_id, trimester, school_year);
