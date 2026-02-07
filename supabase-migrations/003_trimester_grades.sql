-- Migration: Trimester grades system
-- Description: Add tables for trimester-based participation grading (Aurélie's method)

-- 1. Global trimester settings per user
CREATE TABLE IF NOT EXISTS trimester_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_trimester INTEGER NOT NULL DEFAULT 1 CHECK (current_trimester BETWEEN 1 AND 3),
  school_year VARCHAR(9) NOT NULL DEFAULT '2024-2025', -- Format: "2024-2025"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Per-class trimester configuration
CREATE TABLE IF NOT EXISTS class_trimester_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  target_participations INTEGER NOT NULL DEFAULT 15,
  total_sessions_expected INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(class_id)
);

-- 3. Archived trimester grades (for history)
CREATE TABLE IF NOT EXISTS trimester_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trimester INTEGER NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  school_year VARCHAR(9) NOT NULL,
  participations INTEGER NOT NULL DEFAULT 0,
  absences INTEGER NOT NULL DEFAULT 0,
  target_participations INTEGER NOT NULL,
  adjusted_target DECIMAL(10,2) NOT NULL,
  grade DECIMAL(4,2) NOT NULL CHECK (grade BETWEEN 0 AND 20),
  bonus DECIMAL(10,2) NOT NULL DEFAULT 0,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, trimester, school_year)
);

-- 4. Trimester start dates tracking (to filter events by trimester)
CREATE TABLE IF NOT EXISTS trimester_boundaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trimester INTEGER NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  school_year VARCHAR(9) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, trimester, school_year)
);

-- Enable RLS
ALTER TABLE trimester_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_trimester_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE trimester_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trimester_boundaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trimester_settings
CREATE POLICY "Users can view own trimester settings"
  ON trimester_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trimester settings"
  ON trimester_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trimester settings"
  ON trimester_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for class_trimester_config
CREATE POLICY "Users can view own class config"
  ON class_trimester_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes WHERE classes.id = class_trimester_config.class_id AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own class config"
  ON class_trimester_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes WHERE classes.id = class_trimester_config.class_id AND classes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own class config"
  ON class_trimester_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes WHERE classes.id = class_trimester_config.class_id AND classes.user_id = auth.uid()
    )
  );

-- RLS Policies for trimester_grades
CREATE POLICY "Users can view own trimester grades"
  ON trimester_grades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trimester grades"
  ON trimester_grades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for trimester_boundaries
CREATE POLICY "Users can view own trimester boundaries"
  ON trimester_boundaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trimester boundaries"
  ON trimester_boundaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trimester boundaries"
  ON trimester_boundaries FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trimester_grades_student ON trimester_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_trimester_grades_class ON trimester_grades(class_id);
CREATE INDEX IF NOT EXISTS idx_trimester_grades_lookup ON trimester_grades(student_id, trimester, school_year);
CREATE INDEX IF NOT EXISTS idx_trimester_boundaries_lookup ON trimester_boundaries(user_id, school_year);
