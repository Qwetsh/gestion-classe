-- ============================================================
-- Migration 084 : Cahier de texte (une entrée par cours de l'emploi du temps)
-- ============================================================
-- PLAN_cahier_de_texte.md. Chaque séance a son entrée de cahier de texte (texte brut, thème et
-- séance en tête, « TRAVAIL EFFECTUÉ EN CLASSE », « COMPÉTENCES TRAVAILLÉES »). L'enseignant la
-- recopie lui-même dans Pronote : l'application en garde la copie, rattachée au cours, et la rend
-- facile à copier. Aucun export vers Pronote.
--
-- Choix :
--  - Même clé que lesson_notes (044) et lesson_boards (065) : un cours n'a pas d'identifiant
--    stable commun aux sources (Pronote en direct, .ics, saisie manuelle), donc
--    (user_id, starts_at, label) — début à la minute + libellé Pronote. Une entrée par cours.
--  - lesson_notes n'est pas réutilisée : une note est un rappel écrit AVANT le cours, l'entrée
--    est un compte rendu écrit après (ou préparé par Claude avec la séance).
--  - class_id / group_id recopiés à l'écriture (liste par classe) ; SET NULL si la classe
--    disparaît : l'entrée reste lisible.
--  - copied_at : posé par le bouton « Copier » (« recopiée dans Pronote »), annulable.
--  - source : qui l'a écrite (claude = jeton d'import, manual = l'application, import = reprise
--    des fichiers OneDrive).
--  - Aucune autre clé étrangère vers une table lue par embed (piège PGRST201, cf. 077).
--  - Propriétaire seulement : rien côté élève, rien sur l'écran projeté.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_journal (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  label      TEXT NOT NULL,
  class_id   UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id   UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  content    TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  copied_at  TIMESTAMPTZ,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('claude', 'manual', 'import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, starts_at, label)
);

COMMENT ON TABLE public.lesson_journal IS 'Entrée de cahier de texte d''un cours de l''emploi du temps (copie gardée dans l''app ; recopiée à la main dans Pronote).';
COMMENT ON COLUMN public.lesson_journal.label IS 'Libellé Pronote du cours (« 4D ») : avec starts_at, identifie le cours quelle que soit la source';
COMMENT ON COLUMN public.lesson_journal.content IS 'Texte brut de l''entrée, tel qu''il se colle dans Pronote';
COMMENT ON COLUMN public.lesson_journal.copied_at IS 'Copiée (bouton Copier) : considérée comme recopiée dans Pronote ; NULL = à recopier';
COMMENT ON COLUMN public.lesson_journal.source IS 'claude (jeton d''import), manual (application), import (reprise des fichiers OneDrive)';

CREATE INDEX IF NOT EXISTS idx_lesson_journal_user_start ON public.lesson_journal (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_lesson_journal_class_start ON public.lesson_journal (class_id, starts_at);

ALTER TABLE public.lesson_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_journal_own_rows" ON public.lesson_journal;
CREATE POLICY "lesson_journal_own_rows" ON public.lesson_journal
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
