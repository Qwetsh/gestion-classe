-- ============================================================
-- Migration 045 : Contraintes de placement pour la génération automatique du plan de classe
-- ============================================================
-- Une contrainte est une propriété durable d'un élève dans sa classe (« Léa devant »,
-- « Noah pas à côté de Tom »), indépendante de la salle : elle sert à chaque génération,
-- pour n'importe quel plan (classe entière ou groupe).
--
-- Types (colonne kind) :
--   individuels : front, back, not_back, edge, center, alone, fixed
--   de couple    : next_to, not_next_to, far_from  (other_student_id obligatoire)
-- params JSONB : { "minDistance": 3 } pour far_from.
--
-- class_room_plans et class_group_plans ne changent pas : le générateur produit des
-- positions au même format, que l'enseignant enregistre comme un plan fait à la main.
-- Le mobile ignore cette table (le pull lit des colonnes explicites).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.seating_constraints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN (
                     'front', 'back', 'not_back', 'edge', 'center', 'alone', 'fixed',
                     'next_to', 'not_next_to', 'far_from')),
  other_student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  params           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (kind IN ('next_to', 'not_next_to', 'far_from') AND other_student_id IS NOT NULL AND other_student_id <> student_id)
    OR (kind NOT IN ('next_to', 'not_next_to', 'far_from') AND other_student_id IS NULL)
  )
);

COMMENT ON TABLE public.seating_constraints IS 'Contraintes de placement d''un élève (devant, à côté de…) utilisées par la génération automatique du plan de classe.';
COMMENT ON COLUMN public.seating_constraints.params IS 'Paramètres optionnels, ex. {"minDistance": 3} pour far_from';

CREATE INDEX IF NOT EXISTS idx_seating_constraints_class ON public.seating_constraints (class_id);

ALTER TABLE public.seating_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seating_constraints_own_rows" ON public.seating_constraints;
CREATE POLICY "seating_constraints_own_rows" ON public.seating_constraints
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
