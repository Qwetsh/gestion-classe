-- ============================================================
-- Migration 090 : Version couleur au format téléphone d'un document imprimé (QR code)
-- ============================================================
-- Chaque document imprimé depuis l'éditeur de cours (fiche, documents, protocole…) porte, en haut à
-- droite de sa première page, un QR code vers sa version couleur au format téléphone
-- (page publique /d/<jeton>). Le QR code imprimé ne change jamais : la page montre le document tel
-- qu'il est au moment où on le scanne.
--
-- Choix :
--  - Une ligne par document, créée par le navigateur du professeur à la première impression.
--  - token : jeton long et aléatoire (20 caractères base64url = 120 bits, impossible à deviner),
--    porté par l'adresse du QR code. Il est court pour que le QR code reste lisible à 1,2 cm de
--    côté. Jamais modifié (pas de politique UPDATE) : le papier déjà imprimé doit rester valable.
--    Supprimer la ligne coupe le lien ; la prochaine impression en crée un autre.
--  - board_id : toujours l'ORIGINAL de la bibliothèque. Une copie posée pour une classe
--    (lesson_boards.source_board_id, migration 077) renvoie au lien de son original.
--  - Jamais de correction ni d'évaluation : le navigateur ne crée pas de lien pour elles, et
--    l'Edge Function version-mobile relit le titre du cours à chaque appel (un cours renommé
--    « … (correction) » après coup n'est plus servi, même si son jeton existe).
--  - Aucune lecture pour un visiteur sans compte : le téléphone passe par l'Edge Function
--    version-mobile, qui vérifie le jeton avec la clé de service.
--  - La politique d'écriture prouve que le cours est au professeur qui écrit.
--  - Suppression en cascade : un cours supprimé coupe son lien.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.board_mobile_links (
  board_id   UUID PRIMARY KEY REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.board_mobile_links IS 'Lien de la version téléphone d''un document imprimé (QR code de la première page) ; un par original de la bibliothèque.';
COMMENT ON COLUMN public.board_mobile_links.board_id IS 'Original de la bibliothèque (jamais une copie posée pour une classe)';
COMMENT ON COLUMN public.board_mobile_links.token IS 'Jeton de l''adresse /d/<jeton> ; long, aléatoire, jamais modifié (il est imprimé)';

CREATE INDEX IF NOT EXISTS idx_board_mobile_links_user ON public.board_mobile_links (user_id);

ALTER TABLE public.board_mobile_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_mobile_links_select" ON public.board_mobile_links;
CREATE POLICY "board_mobile_links_select" ON public.board_mobile_links
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_mobile_links_insert" ON public.board_mobile_links;
CREATE POLICY "board_mobile_links_insert" ON public.board_mobile_links
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "board_mobile_links_delete" ON public.board_mobile_links;
CREATE POLICY "board_mobile_links_delete" ON public.board_mobile_links
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.board_mobile_links FROM anon;
