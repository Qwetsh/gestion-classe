-- Migration 061 : historique des corrections (hub Évaluations, phase 2)
-- Description : PLAN_hub_evaluations.md, phase 2. Chaque fois qu'une note change de contenu
--   (note, note brute, statut, commentaire ou détail de correction), l'ancienne version est
--   archivée dans assessment_grade_revisions. La ligne de assessment_grades reste la version
--   actuelle ; la table ne contient que les versions remplacées, jamais modifiées ensuite.
--
--   - Qui écrit : un trigger AFTER UPDATE, quel que soit l'auteur de la mise à jour (carnet,
--     visionneuse, push_grades.py du Correcteur, Edge Function corriger-copie). Fonction
--     SECURITY DEFINER : aucun compte ne peut écrire dans l'historique directement.
--   - Auteur de la version archivée (`source`), déduit du détail : details.source = 'api' →
--     'ia' (bouton « Corriger avec Claude ») ; un autre détail → 'correcteur' (Correcteur PC) ;
--     pas de détail → 'prof' (saisie au carnet).
--   - Une simple validation (is_validated seul) ou un changement de version du sujet ne crée
--     pas de version : le contenu de la correction n'a pas changé.
--   - Lecture : le prof propriétaire seulement (RLS). Rien n'est exposé aux élèves.
--   Additive : aucune ligne existante n'est modifiée ; l'historique commence à l'application.
--
-- Retour arrière :
--   DROP TRIGGER IF EXISTS trg_assessment_grades_archive ON public.assessment_grades;
--   DROP FUNCTION IF EXISTS public.assessment_grades_archive();
--   DROP TABLE IF EXISTS public.assessment_grade_revisions;

CREATE TABLE IF NOT EXISTS public.assessment_grade_revisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id      uuid NOT NULL REFERENCES public.assessment_grades(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  student_id    uuid NOT NULL,
  source        text NOT NULL CHECK (source IN ('prof', 'ia', 'correcteur')),
  grade         numeric,
  grade_raw     numeric,
  status        text,
  comment       text,
  details       jsonb,
  was_validated boolean NOT NULL DEFAULT false,
  -- Date de la version archivée (son dernier enregistrement), et date de son remplacement.
  version_at    timestamptz,
  replaced_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agr_grade ON public.assessment_grade_revisions (grade_id, replaced_at DESC);

COMMENT ON TABLE public.assessment_grade_revisions IS
  'Versions remplacées d''une note (assessment_grades), archivées par trigger. Lecture : le prof.';

ALTER TABLE public.assessment_grade_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own grade revisions" ON public.assessment_grade_revisions;
CREATE POLICY "Users view own grade revisions" ON public.assessment_grade_revisions
  FOR SELECT USING (auth.uid() = user_id);
-- Pas de policy INSERT / UPDATE / DELETE : seul le trigger écrit, et rien ne se réécrit.

CREATE OR REPLACE FUNCTION public.assessment_grades_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assessment_grade_revisions
    (grade_id, user_id, assessment_id, student_id, source, grade, grade_raw, status, comment,
     details, was_validated, version_at)
  VALUES
    (OLD.id, OLD.user_id, OLD.assessment_id, OLD.student_id,
     CASE
       WHEN OLD.details ->> 'source' = 'api' THEN 'ia'
       WHEN OLD.details IS NOT NULL THEN 'correcteur'
       ELSE 'prof'
     END,
     OLD.grade, OLD.grade_raw, OLD.status, OLD.comment, OLD.details,
     coalesce(OLD.is_validated, false), coalesce(OLD.updated_at, OLD.created_at));
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.assessment_grades_archive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assessment_grades_archive ON public.assessment_grades;
CREATE TRIGGER trg_assessment_grades_archive
  AFTER UPDATE ON public.assessment_grades
  FOR EACH ROW
  WHEN (
    OLD.grade IS DISTINCT FROM NEW.grade
    OR OLD.grade_raw IS DISTINCT FROM NEW.grade_raw
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.comment IS DISTINCT FROM NEW.comment
    OR OLD.details IS DISTINCT FROM NEW.details
  )
  EXECUTE FUNCTION public.assessment_grades_archive();
