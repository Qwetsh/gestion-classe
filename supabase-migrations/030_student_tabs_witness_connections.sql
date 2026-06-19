-- ============================================================
-- Migration 030 : Visibilité des onglets élève (par classe),
--                 élève témoin, et journal de connexions
-- ============================================================
-- 3 ajouts schéma, branchés ensuite par la migration 031 (RPC) :
--   1. students.is_witness        → élève témoin "admin" (hors classements/métriques)
--   2. class_student_tabs          → quels onglets l'élève voit (Tampons / Annales), par classe
--   3. student_connections         → journal horodaté des connexions élève (métriques d'implication)
--
-- Rappel décisions :
--   - Notes : toujours visible (jamais stocké ici).
--   - Maison : reste piloté par academy_config.enabled (déjà par classe).
--   - Tampons / Annales : OFF par défaut, opt-in par classe.
-- ============================================================

-- 1. Élève témoin -------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_witness boolean NOT NULL DEFAULT false;

-- 2. Visibilité des onglets par classe ---------------------------------------
CREATE TABLE IF NOT EXISTS class_student_tabs (
  class_id     uuid PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_stamps  boolean NOT NULL DEFAULT false,
  show_annales boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE class_student_tabs ENABLE ROW LEVEL SECURITY;

-- Le prof gère les lignes de ses propres classes (même pattern qu'academy_config).
-- L'élève accède en lecture via la RPC SECURITY DEFINER (bypass RLS), pas besoin de policy anon.
CREATE POLICY "class_student_tabs_user" ON class_student_tabs
  FOR ALL USING (user_id = auth.uid());

-- 3. Journal des connexions élève --------------------------------------------
CREATE TABLE IF NOT EXISTS student_connections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_connections_student
  ON student_connections (student_id, connected_at DESC);

ALTER TABLE student_connections ENABLE ROW LEVEL SECURITY;

-- Insertion : faite par get_student_dashboard (SECURITY DEFINER, bypass RLS) → aucune policy d'insert.
-- Lecture : le prof voit les connexions de ses propres élèves.
CREATE POLICY "student_connections_read" ON student_connections
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
