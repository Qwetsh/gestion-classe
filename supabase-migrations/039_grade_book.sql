-- Migration 039 : Carnet de notes
-- Description : socle du carnet (cf. PLAN_carnet_de_notes.md, lot 1).
--   - assessment_series : une meme eval declinee sur plusieurs classes d'un niveau.
--     Porte le sujet et le corrige, qui sont communs par nature (le chemin Storage des
--     docs contient l'assessmentId : un chemin partage entre lignes creerait des orphelins).
--   - written_assessments : periode, annee scolaire, coefficient, type, groupe, serie.
--   - assessment_grades.status : POURQUOI il n'y a pas de note (absent != zero).
--     Ne pas confondre avec is_validated, qui reste le cycle de vie du pipeline de scan.
--   - Backfill : sans lui, les evals creees avant cette migration sortiraient du carnet
--     des qu'il filtre par periode.
-- Conventions : gen_random_uuid(), user_id denormalise + RLS auth.uid() = user_id, idempotent.

-- ============================================================
-- 1. Series d'evaluations (meme eval sur plusieurs classes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_series (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  level           TEXT,                       -- "6e".."3e", ou NULL (selection manuelle)
  school_year     VARCHAR(9) NOT NULL,
  subject_path    TEXT,                       -- user_id/series/{seriesId}/subject.{ext}
  correction_path TEXT,                       -- user_id/series/{seriesId}/correction.{ext}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.assessment_series IS
  'Serie : une meme evaluation declinee sur plusieurs classes. Porte le sujet et le corrige communs.';
COMMENT ON COLUMN public.assessment_series.subject_path IS
  'Sujet commun a la serie (bucket assessment-docs). Une eval sans chemin propre lit celui-ci.';

-- ============================================================
-- 2. Evaluations : periode, coefficient, type, serie, groupe
-- ============================================================
ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS series_id         UUID REFERENCES public.assessment_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period            SMALLINT,
  ADD COLUMN IF NOT EXISTS school_year       VARCHAR(9),
  ADD COLUMN IF NOT EXISTS coefficient       NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kind              TEXT NOT NULL DEFAULT 'ecrit',
  ADD COLUMN IF NOT EXISTS group_id          UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counts_in_average BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.written_assessments.coefficient IS 'Poids dans la moyenne de periode.';
COMMENT ON COLUMN public.written_assessments.counts_in_average IS
  'FALSE : eval informative (evaluation diagnostique, blanc...), exclue de la moyenne.';
COMMENT ON COLUMN public.written_assessments.group_id IS
  'Demi-classe concernee (cf. PLAN_groupes_classe.md). NULL = classe entiere.';

-- Contraintes de domaine (ajoutees separement : ADD COLUMN IF NOT EXISTS ne prend pas de CHECK idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'written_assessments_period_check') THEN
    ALTER TABLE public.written_assessments
      ADD CONSTRAINT written_assessments_period_check CHECK (period IS NULL OR period BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'written_assessments_kind_check') THEN
    ALTER TABLE public.written_assessments
      ADD CONSTRAINT written_assessments_kind_check
      CHECK (kind IN ('ecrit', 'tp', 'oral', 'dm', 'projet'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'written_assessments_coefficient_check') THEN
    ALTER TABLE public.written_assessments
      ADD CONSTRAINT written_assessments_coefficient_check CHECK (coefficient >= 0);
  END IF;
END $$;

-- ============================================================
-- 3. Notes : motif d'absence de note
--    'noted' + grade IS NULL = pas encore corrigee (pas de 6e valeur).
-- ============================================================
ALTER TABLE public.assessment_grades
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'noted';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessment_grades_status_check') THEN
    ALTER TABLE public.assessment_grades
      ADD CONSTRAINT assessment_grades_status_check
      CHECK (status IN ('noted', 'absent', 'dispense', 'non_rendu', 'non_rendu_zero'));
  END IF;
END $$;

COMMENT ON COLUMN public.assessment_grades.status IS
  'Pourquoi il n''y a pas de note. noted (grade eventuellement NULL = pas encore corrigee) | '
  'absent | dispense | non_rendu (exclu de la moyenne) | non_rendu_zero (compte comme 0). '
  'Distinct de is_validated, qui est le cycle de vie du pipeline de correction de copies.';

-- ============================================================
-- 4. Index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_as_user_id     ON public.assessment_series(user_id);
CREATE INDEX IF NOT EXISTS idx_as_year_level  ON public.assessment_series(user_id, school_year, level);
CREATE INDEX IF NOT EXISTS idx_wa_series      ON public.written_assessments(series_id);
CREATE INDEX IF NOT EXISTS idx_wa_period      ON public.written_assessments(user_id, school_year, period);
CREATE INDEX IF NOT EXISTS idx_wa_class_year  ON public.written_assessments(class_id, school_year, period);

-- ============================================================
-- 5. RLS sur assessment_series (pattern 025/026)
-- ============================================================
ALTER TABLE public.assessment_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_series" ON public.assessment_series;
DROP POLICY IF EXISTS "Users insert own assessment_series" ON public.assessment_series;
DROP POLICY IF EXISTS "Users update own assessment_series" ON public.assessment_series;
DROP POLICY IF EXISTS "Users delete own assessment_series" ON public.assessment_series;

CREATE POLICY "Users view own assessment_series" ON public.assessment_series
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assessment_series" ON public.assessment_series
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own assessment_series" ON public.assessment_series
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own assessment_series" ON public.assessment_series
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 6. Trigger updated_at
--    Une note qui fait foi doit dire quand elle a ete modifiee. La colonne existait
--    sur assessment_grades mais n'etait alimentee par rien.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_grades_updated_at ON public.assessment_grades;
CREATE TRIGGER trg_assessment_grades_updated_at
  BEFORE UPDATE ON public.assessment_grades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_written_assessments_updated_at ON public.written_assessments;
CREATE TRIGGER trg_written_assessments_updated_at
  BEFORE UPDATE ON public.written_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_series_updated_at ON public.assessment_series;
CREATE TRIGGER trg_assessment_series_updated_at
  BEFORE UPDATE ON public.assessment_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. BACKFILL
--    Sans ca, toute eval creee avant cette migration a period/school_year NULL
--    et disparait du carnet des qu'il filtre par periode.
--    On derive de la DATE de l'eval, pas de trimester_settings : celui-ci donne la
--    periode COURANTE, ce qui serait faux pour une eval d'une annee anterieure.
--    (trimester_settings reste la source des valeurs par defaut a la CREATION.)
--    Bornes retenues : aout-decembre = T1, janvier-mars = T2, avril-juillet = T3.
--    Approximation assumee, corrigeable a la main depuis le panneau d'une eval.
-- ============================================================
WITH ref AS (
  SELECT id,
         EXTRACT(YEAR  FROM COALESCE(date, created_at::date))::int  AS y,
         EXTRACT(MONTH FROM COALESCE(date, created_at::date))::int  AS m
  FROM public.written_assessments
  WHERE school_year IS NULL OR period IS NULL
)
UPDATE public.written_assessments wa
SET school_year = COALESCE(
      wa.school_year,
      CASE WHEN ref.m >= 8 THEN ref.y || '-' || (ref.y + 1)
           ELSE (ref.y - 1) || '-' || ref.y END
    ),
    period = COALESCE(
      wa.period,
      CASE WHEN ref.m BETWEEN 8 AND 12 THEN 1
           WHEN ref.m BETWEEN 1 AND 3  THEN 2
           ELSE 3 END
    )
FROM ref
WHERE ref.id = wa.id;

-- Les notes existantes n'ont pas de statut : celles qui portent une note sont 'noted'
-- (valeur par defaut de la colonne, donc rien a faire). Aucune ne peut etre 'absent'
-- retroactivement : l'information n'existait pas.
