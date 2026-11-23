-- ============================================================
-- Migration 085 : Classeur ouvert aux classes, activité par activité
-- ============================================================
-- PLAN_classeur_eleves.md, lot 1. Le classeur virtuel (/classeur) est assemblé dans le navigateur du
-- professeur à partir de sa bibliothèque. Cette table dit ce qu'une classe a le droit d'y voir.
-- Rien n'est encore lu côté élève : ce lot ne fait que régler.
--
-- Choix :
--  - Fermé par défaut : pas de ligne, ou visible = false, la classe ne voit rien.
--  - Une ligne par (classe, élément) : une activité, ancrée sur sa fiche (ses documents et son
--    protocole la suivent), ou une page seule (page de garde, fiche de mémorisation, fiche méthode,
--    mode d'emploi). correction_visible ouvre en plus la copie modèle et le bilan.
--  - released : écrit par le navigateur du professeur au moment où il active. C'est la liste exacte
--    de ce qui sort (identifiants des cours, texte du bilan). Le serveur ne lira jamais un titre :
--    un cours créé plus tard et nommé « … (correction) » ne s'ouvre pas tout seul.
--  - Les politiques prouvent que la classe ET le cours d'ancrage sont au professeur qui écrit
--    (la base sert plusieurs professeurs). Les autres identifiants cités dans released devront être
--    revérifiés à la lecture (même propriétaire que la classe), au lot 2.
--  - Clé primaire id + contrainte d'unicité, et non clé composée (class_id, anchor_board_id) : une
--    clé composée de deux clés étrangères ferait de la table une jonction classes ↔ boards aux yeux
--    de PostgREST (piège PGRST201, cf. 077).
--  - Suppression en cascade : une classe ou un cours supprimé referme ce qui le concernait.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.class_binder_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id           UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  anchor_board_id    UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  visible            BOOLEAN NOT NULL DEFAULT false,
  correction_visible BOOLEAN NOT NULL DEFAULT false,
  released           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_binder_items_unique UNIQUE (class_id, anchor_board_id),
  -- Pas de correction ouverte sur une activité fermée
  CONSTRAINT class_binder_items_correction CHECK (visible OR NOT correction_visible)
);

COMMENT ON TABLE public.class_binder_items IS 'Ce qu''une classe voit du classeur virtuel : une ligne par activité ou page seule ouverte (fermé par défaut).';
COMMENT ON COLUMN public.class_binder_items.anchor_board_id IS 'Cours d''ancrage : la fiche de l''activité, ou la page seule (garde, mémorisation, méthode, mode d''emploi)';
COMMENT ON COLUMN public.class_binder_items.correction_visible IS 'La copie modèle et le bilan de l''activité sont ouverts aussi';
COMMENT ON COLUMN public.class_binder_items.released IS 'Écrit à l''activation par le navigateur du professeur : rôle, cours ouverts, copie modèle, texte du bilan. Seule source de ce qui sort.';

CREATE INDEX IF NOT EXISTS idx_class_binder_items_user ON public.class_binder_items (user_id);
CREATE INDEX IF NOT EXISTS idx_class_binder_items_board ON public.class_binder_items (anchor_board_id);

ALTER TABLE public.class_binder_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_binder_items_select" ON public.class_binder_items;
CREATE POLICY "class_binder_items_select" ON public.class_binder_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "class_binder_items_insert" ON public.class_binder_items;
CREATE POLICY "class_binder_items_insert" ON public.class_binder_items
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.boards b WHERE b.id = anchor_board_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "class_binder_items_update" ON public.class_binder_items;
CREATE POLICY "class_binder_items_update" ON public.class_binder_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.boards b WHERE b.id = anchor_board_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "class_binder_items_delete" ON public.class_binder_items;
CREATE POLICY "class_binder_items_delete" ON public.class_binder_items
  FOR DELETE USING (auth.uid() = user_id);

-- Rien pour un visiteur sans compte : l'élève passera par une fonction côté serveur (lot 2)
REVOKE ALL ON public.class_binder_items FROM anon;
