-- Migration: class_room_plans
-- Description: Table pour stocker les placements d'élèves par classe+salle

CREATE TABLE IF NOT EXISTS class_room_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  positions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, room_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_class_room_plans_class_id ON class_room_plans(class_id);
CREATE INDEX IF NOT EXISTS idx_class_room_plans_room_id ON class_room_plans(room_id);
CREATE INDEX IF NOT EXISTS idx_class_room_plans_user_id ON class_room_plans(user_id);

-- RLS (Row Level Security)
ALTER TABLE class_room_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own plans
CREATE POLICY "Users can view own class_room_plans"
  ON class_room_plans FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own plans
CREATE POLICY "Users can insert own class_room_plans"
  ON class_room_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own plans
CREATE POLICY "Users can update own class_room_plans"
  ON class_room_plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own plans
CREATE POLICY "Users can delete own class_room_plans"
  ON class_room_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE class_room_plans IS 'Stocke les placements d''élèves pour chaque combinaison classe+salle';
COMMENT ON COLUMN class_room_plans.positions IS 'JSONB mapping student_id -> {row: number, col: number}';
