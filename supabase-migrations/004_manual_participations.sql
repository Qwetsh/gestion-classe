-- Migration: Manual participations
-- Description: Add table for manual participations (not linked to sessions)

CREATE TABLE IF NOT EXISTS manual_participations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trimester INTEGER NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  school_year VARCHAR(9) NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE manual_participations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own manual participations"
  ON manual_participations FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manual_participations_student ON manual_participations(student_id);
CREATE INDEX IF NOT EXISTS idx_manual_participations_lookup ON manual_participations(student_id, trimester, school_year);
