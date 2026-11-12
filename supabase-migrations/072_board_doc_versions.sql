-- ============================================================
-- Migration 072 : Historique des versions des cours rédigés + modèles
-- ============================================================
-- AUDIT_editeur_texte.md, lot T6 (« le filet de sécurité »).
--
--  - board_doc_versions : instantanés du document d'un cours (boards.doc). L'éditeur en prend
--    un à l'ouverture, toutes les 10 minutes de travail, avant une restauration, et à la
--    demande. Il fait lui-même le ménage : les 30 derniers + un par jour sur 30 jours, les
--    versions nommées à la main sont gardées.
--    Les dessins des encarts (board_pages) ne sont pas versionnés.
--  - boards.is_template : le cours est un modèle (« Nouveau à partir d'un modèle ») ; il
--    n'apparaît plus dans « Mes tableaux » mais dans la liste des modèles.
--
-- Droits : calqués sur ceux de `boards` (propriétaire seulement), avec en plus la vérification
-- que le cours visé appartient bien à l'utilisateur.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.board_doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc JSONB NOT NULL,
  -- auto : ouverture ou toutes les 10 minutes ; manual : « Enregistrer une version » ;
  -- restore : état remplacé par une restauration ; import : avant un import (lot T10) ;
  -- conflict : version écrasée par un autre onglet ou un autre appareil
  kind TEXT NOT NULL DEFAULT 'auto' CHECK (kind IN ('auto', 'manual', 'restore', 'import', 'conflict')),
  label TEXT,
  -- Nombre de mots, pour la liste (évite de relire chaque document)
  words INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_doc_versions_board_idx
  ON public.board_doc_versions (board_id, created_at DESC);

ALTER TABLE public.board_doc_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own board doc versions" ON public.board_doc_versions;
CREATE POLICY "Users can view own board doc versions" ON public.board_doc_versions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own board doc versions" ON public.board_doc_versions;
CREATE POLICY "Users can insert own board doc versions" ON public.board_doc_versions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own board doc versions" ON public.board_doc_versions;
CREATE POLICY "Users can update own board doc versions" ON public.board_doc_versions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own board doc versions" ON public.board_doc_versions;
CREATE POLICY "Users can delete own board doc versions" ON public.board_doc_versions
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.board_doc_versions IS 'Historique des versions des cours rédigés (boards.doc) : instantanés automatiques, manuels, avant restauration ou import.';

ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.boards.is_template IS 'Cours rédigé enregistré comme modèle : absent de « Mes tableaux », proposé à la création d''un cours.';
