-- Table pour stocker les statistiques agregees par classe et annee scolaire
-- A executer dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS yearly_class_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  school_year TEXT NOT NULL, -- ex: "2024-2025"

  -- Stats agregees
  total_students INTEGER DEFAULT 0,
  total_participations INTEGER DEFAULT 0,
  total_bavardages INTEGER DEFAULT 0,
  total_absences INTEGER DEFAULT 0,
  total_sorties INTEGER DEFAULT 0,
  average_grade DECIMAL(4,2) DEFAULT 0,
  ratio INTEGER DEFAULT 0, -- pourcentage participation/(participation+bavardage)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, class_name, school_year)
);

-- RLS
ALTER TABLE yearly_class_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own yearly summaries"
  ON yearly_class_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own yearly summaries"
  ON yearly_class_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own yearly summaries"
  ON yearly_class_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- Index pour les requetes frequentes
CREATE INDEX idx_yearly_summaries_user_year ON yearly_class_summaries(user_id, school_year);
