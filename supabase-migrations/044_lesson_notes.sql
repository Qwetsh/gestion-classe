-- ============================================================
-- Migration 044 : Notes sur un cours à venir (emploi du temps de l'accueil)
-- ============================================================
-- Depuis l'accueil, un clic sur un cours qui n'a pas encore eu lieu permet d'écrire
-- une note (« rendre les copies », « interro 10 min », « faire passer Léa à l'oral »)
-- qui réapparaît au moment du cours : sur l'accueil (cours en cours) et sur le
-- téléphone (démarrage / écran de séance).
--
-- Choix :
--  - Une note n'est PAS une séance. La table sessions n'est pas touchée : rien n'est
--    créé tant que l'enseignant ne démarre pas la séance sur le téléphone ou en mode
--    classe. Un compte qui n'écrit jamais de note ne voit aucune différence.
--  - Un cours n'a pas d'identifiant stable commun aux sources (id pawnote en direct,
--    UUID de timetable_entries pour un .ics). La clé métier d'une note est donc
--    (user_id, starts_at, label) : heure de début exacte + libellé Pronote du cours,
--    identiques quelle que soit la source. Une note par cours (upsert).
--  - class_id / group_id sont recopiés à l'écriture (résolus par timetable_label_links)
--    pour que le mobile retrouve la note par classe + fenêtre horaire, sans connaître
--    l'emploi du temps. SET NULL si la classe disparaît : la note reste lisible sur l'accueil.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  label      TEXT NOT NULL,
  class_id   UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id   UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, starts_at, label)
);

COMMENT ON TABLE public.lesson_notes IS 'Note écrite depuis l''accueil sur un cours de l''emploi du temps, affichée au moment du cours. Indépendante des séances.';
COMMENT ON COLUMN public.lesson_notes.label IS 'Libellé Pronote du cours (« 4D », « 3°EP1 ») : avec starts_at, identifie le cours quelle que soit la source';
COMMENT ON COLUMN public.lesson_notes.class_id IS 'Classe résolue à l''écriture (timetable_label_links) ; sert au mobile pour retrouver la note';
COMMENT ON COLUMN public.lesson_notes.done IS 'Marquée « vue » (depuis le téléphone ou l''accueil) : n''est plus mise en avant';

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_start ON public.lesson_notes (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_class_start ON public.lesson_notes (class_id, starts_at);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_notes_own_rows" ON public.lesson_notes;
CREATE POLICY "lesson_notes_own_rows" ON public.lesson_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
