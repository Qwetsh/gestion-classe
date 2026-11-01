-- Migration 052 : scan des copies depuis la séance (lot 1 de PLAN_copies_evaluation.md)
-- Description : le téléphone scanne la copie de chaque élève depuis la séance. Il faut pouvoir
--   retrouver l'éval de la séance, et noter par élève ce que le correcteur doit savoir avant de
--   lire la copie : quelle version du sujet il a eue, et si le prof a déjà annoté la copie.
--   `is_adapted` (migration 041) sert tel quel pour la version adaptée.
--   Tout est facultatif et additif : rien ne change pour les évals existantes.

-- ============================================================
-- 1. Lien éval → séance
-- ============================================================
-- Pas de clé étrangère, volontairement : une éval créée hors ligne en séance arrive souvent sur
-- le serveur avant la séance elle-même (synchro mobile différée), et l'insertion serait refusée.
-- Une séance supprimée laisse donc un identifiant orphelin, que l'app traite comme « pas de séance ».
ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS session_id uuid;

COMMENT ON COLUMN public.written_assessments.session_id IS
  'Séance pendant laquelle l''éval a été passée / scannée (facultatif, sans FK : la séance peut être synchronisée après l''éval).';

CREATE INDEX IF NOT EXISTS idx_wa_session_id
  ON public.written_assessments(session_id) WHERE session_id IS NOT NULL;

-- ============================================================
-- 2. Informations de copie, élève par élève
-- ============================================================
ALTER TABLE public.assessment_grades
  ADD COLUMN IF NOT EXISTS subject_version text,
  ADD COLUMN IF NOT EXISTS copy_annotated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assessment_grades.subject_version IS
  'Version du sujet passée par l''élève (ex. « v5 »), saisie au scan. Le correcteur choisit le barème correspondant.';
COMMENT ON COLUMN public.assessment_grades.copy_annotated IS
  'TRUE : la copie scannée porte déjà des annotations du prof (à distinguer de l''écriture de l''élève).';
