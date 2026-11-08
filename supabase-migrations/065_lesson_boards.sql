-- ============================================================
-- Migration 065 : Tableau préparé pour un cours de l'emploi du temps
-- ============================================================
-- Depuis l'accueil, un clic sur un cours à venir permet de « créer un tableau pour ce
-- cours ». Le tableau se prépare à l'avance, se duplique vers les autres classes du même
-- niveau (même base, puis chaque copie vit sa vie), et le jour J « Lancer la séance »
-- ouvre l'écran /classe : quand le téléphone démarre la séance, les pages du tableau
-- préparé sont copiées dans le tableau de la séance (mécanisme existant session_boards).
--
-- Choix :
--  - Le tableau lui-même est une ligne ordinaire de `boards` (pages dans board_pages
--    par board_id) : l'éditeur, l'export, les onglets marchent sans rien changer.
--  - Comme pour lesson_notes (044), un cours n'a pas d'identifiant stable commun aux
--    sources : la clé métier est (user_id, starts_at, label). Un tableau par cours.
--  - class_id / group_id recopiés à l'écriture : l'écran /classe retrouve le tableau du
--    cours à partir de la séance démarrée sur le téléphone (classe + heure).
--  - Supprimer le tableau supprime le lien (CASCADE) ; la classe qui disparaît laisse le
--    lien lisible (SET NULL).
--  - Les tableaux reliés à un cours ne s'affichent pas dans « Mes tableaux » (bibliothèque) :
--    ils seraient des dizaines par mois. On les retrouve sur l'emploi du temps.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_boards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  label      TEXT NOT NULL,
  class_id   UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id   UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  board_id   UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, starts_at, label)
);

COMMENT ON TABLE public.lesson_boards IS 'Tableau préparé pour un cours de l''emploi du temps (accueil), copié dans le tableau de la séance au lancement.';
COMMENT ON COLUMN public.lesson_boards.label IS 'Libellé Pronote du cours (« 4D ») : avec starts_at, identifie le cours quelle que soit la source';
COMMENT ON COLUMN public.lesson_boards.class_id IS 'Classe résolue à l''écriture : sert à l''écran /classe pour retrouver le tableau de la séance démarrée';

CREATE INDEX IF NOT EXISTS idx_lesson_boards_user_start ON public.lesson_boards (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_lesson_boards_class_start ON public.lesson_boards (class_id, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_boards_board ON public.lesson_boards (board_id);

ALTER TABLE public.lesson_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_boards_own_rows" ON public.lesson_boards;
CREATE POLICY "lesson_boards_own_rows" ON public.lesson_boards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
