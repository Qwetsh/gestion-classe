-- ============================================================
-- Migration 033 : Continuité des élèves d'une année sur l'autre
-- ============================================================
-- Objectif : permettre de garder les élèves (et leur historique) au passage
-- d'année, au lieu de les supprimer. Mécanisme : supprimer une classe ne
-- supprime plus l'élève (CASCADE) — elle le DÉTACHE (class_id → NULL). À la
-- rentrée, l'import rerattache par pseudo. Les notes des années passées
-- survivent à la suppression des classes.
--
-- Décisions : notes + tampons conservés ; activité quotidienne et maisons
-- remises à zéro (géré côté app, pas ici).
-- ============================================================

-- 1. students.class_id : nullable + ON DELETE SET NULL
ALTER TABLE students ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE students DROP CONSTRAINT students_class_id_fkey;
ALTER TABLE students ADD CONSTRAINT students_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- 2. trimester_grades.class_id : nullable + ON DELETE SET NULL
--    → l'historique de notes survit à la suppression des classes.
--    (student_id reste en CASCADE : supprimer un élève sortant efface bien ses notes.)
ALTER TABLE trimester_grades ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE trimester_grades DROP CONSTRAINT trimester_grades_class_id_fkey;
ALTER TABLE trimester_grades ADD CONSTRAINT trimester_grades_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- 3. Snapshot du nom de classe dans l'historique (class_id devient NULL après détachement)
ALTER TABLE trimester_grades ADD COLUMN IF NOT EXISTS class_name text;

-- Backfill pour l'historique existant (tant que class_id est encore valide)
UPDATE trimester_grades tg
SET class_name = c.name
FROM classes c
WHERE tg.class_id = c.id AND tg.class_name IS NULL;
