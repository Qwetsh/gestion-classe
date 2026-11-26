-- ============================================================
-- Migration 091 : Appréciations de bulletin (une par élève, année scolaire et trimestre)
-- ============================================================
-- Les appréciations du bulletin sont saisies dans Pronote, qui n'offre aucune API professeur.
-- L'application en garde la copie : on les relit (fiche élève, conseil de classe, réunion
-- parents), on les retouche, on les recopie dans Pronote d'un clic.
--
-- Choix :
--  - Clé (student_id, school_year, trimester) : une appréciation par élève et par trimestre.
--    Le propriétaire est porté par user_id (chaque fiche élève appartient à un enseignant).
--  - class_id et class_name recopiés à l'écriture : la liste par classe reste possible, et
--    l'appréciation reste lisible si l'élève change de classe ou si la classe disparaît.
--  - 300 caractères au plus : la limite du champ « Appréciation » de Pronote.
--  - copied_at : posé par le bouton « Copier » (recopiée dans Pronote), NULL = à recopier.
--  - source : claude (rédigée et saisie par Claude), manual (application), import.
--  - Aucune clé étrangère vers une table lue par embed (piège PGRST201, cf. 077).
--  - Propriétaire seulement : rien côté élève, rien sur l'écran projeté.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bulletin_appreciations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  class_name  TEXT,
  school_year VARCHAR(9) NOT NULL,
  trimester   INTEGER NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 300),
  copied_at   TIMESTAMPTZ,
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('claude', 'manual', 'import')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, school_year, trimester)
);

COMMENT ON TABLE public.bulletin_appreciations IS 'Appréciation de bulletin d''un élève pour un trimestre (copie gardée dans l''app ; recopiée à la main dans Pronote).';
COMMENT ON COLUMN public.bulletin_appreciations.content IS 'Texte de l''appréciation, tel qu''il se colle dans Pronote (300 caractères au plus)';
COMMENT ON COLUMN public.bulletin_appreciations.class_name IS 'Nom de la classe au moment de l''écriture (lisible si l''élève change de classe)';
COMMENT ON COLUMN public.bulletin_appreciations.copied_at IS 'Copiée (bouton Copier) : considérée comme recopiée dans Pronote ; NULL = à recopier';
COMMENT ON COLUMN public.bulletin_appreciations.source IS 'claude (rédigée par Claude), manual (application), import';

CREATE INDEX IF NOT EXISTS idx_bulletin_appreciations_class
  ON public.bulletin_appreciations (class_id, school_year, trimester);
CREATE INDEX IF NOT EXISTS idx_bulletin_appreciations_user
  ON public.bulletin_appreciations (user_id, school_year, trimester);

ALTER TABLE public.bulletin_appreciations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulletin_appreciations_own_rows" ON public.bulletin_appreciations;
CREATE POLICY "bulletin_appreciations_own_rows" ON public.bulletin_appreciations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at tenu à jour à chaque modification
CREATE OR REPLACE FUNCTION public.touch_bulletin_appreciation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_bulletin_appreciation ON public.bulletin_appreciations;
CREATE TRIGGER trg_touch_bulletin_appreciation
  BEFORE UPDATE ON public.bulletin_appreciations
  FOR EACH ROW EXECUTE FUNCTION public.touch_bulletin_appreciation();
