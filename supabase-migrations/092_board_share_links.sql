-- ============================================================
-- Migration 092 : Lien de partage en lecture seule d'un document (cahier de texte, Pronote, ENT)
-- ============================================================
-- Le professeur copie un lien vers un document de l'éditeur de cours et le colle où il veut
-- (cahier de texte Pronote surtout). L'élève l'ouvre sans compte, le lit sur téléphone ou en
-- feuilles A4, et l'imprime ou l'enregistre en PDF. Même page publique que le QR code imprimé
-- (/d/<jeton>, migration 090), même Edge Function (version-mobile).
--
-- Différences avec le lien du QR code (board_mobile_links) :
--  - Créé seulement quand le professeur le demande (bouton « Partager en lecture seule »), jamais
--    à l'impression.
--  - Peut être coupé (DELETE) puis recréé avec un autre jeton : rien n'est imprimé avec lui. Le QR
--    code des feuilles déjà distribuées garde son propre jeton et n'est pas touché.
--  - Peut ouvrir une CORRECTION (décision de Thomas, 26/11/2026 : « Oui, par lien seulement ») :
--    la correction d'une activité se donne par le cahier de texte après la séance. Jamais une
--    évaluation (sujet, documents ou corrigé), une copie modèle ni un devoir noté : l'Edge
--    Function relit le titre à chaque appel (supabase/functions/version-mobile/rules.ts,
--    shareEligible).
--  - board_id : l'original de la bibliothèque, comme pour le QR code (une copie posée pour une
--    classe renvoie à son original : lesson_boards.source_board_id, migration 077).
--  - token : 20 caractères base64url (120 bits), comme le QR code ; les deux tables ne partagent
--    pas de jeton (tirage au hasard, la fonction cherche dans les deux).
--  - Aucune lecture pour un visiteur sans compte : le téléphone passe par l'Edge Function, qui
--    vérifie le jeton avec la clé de service.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.board_share_links (
  board_id   UUID PRIMARY KEY REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.board_share_links IS 'Lien de partage en lecture seule d''un document (cahier de texte) ; un par original, coupable et recréable.';
COMMENT ON COLUMN public.board_share_links.board_id IS 'Original de la bibliothèque (jamais une copie posée pour une classe)';
COMMENT ON COLUMN public.board_share_links.token IS 'Jeton de l''adresse /d/<jeton> ; long, aléatoire ; couper le lien = supprimer la ligne';

CREATE INDEX IF NOT EXISTS idx_board_share_links_user ON public.board_share_links (user_id);

ALTER TABLE public.board_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_share_links_select" ON public.board_share_links;
CREATE POLICY "board_share_links_select" ON public.board_share_links
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_share_links_insert" ON public.board_share_links;
CREATE POLICY "board_share_links_insert" ON public.board_share_links
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "board_share_links_delete" ON public.board_share_links;
CREATE POLICY "board_share_links_delete" ON public.board_share_links
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.board_share_links FROM anon;
