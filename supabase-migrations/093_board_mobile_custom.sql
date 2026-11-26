-- ============================================================
-- Migration 093 : Version mobile « sur mesure » d'un document imprimé
-- ============================================================
-- Facultative, une par ORIGINAL de la bibliothèque : une page HTML complète, pensée pour le
-- téléphone (mise en page soignée, animations, schémas interactifs, révélations…), écrite par une
-- session Claude (skill version-mobile) et déposée par le jeton d'import (Edge Function
-- depot-cours, action "mobile"). Le QR code imprimé (board_mobile_links, migration 090) y mène :
-- /d/<jeton du QR> l'affiche quand elle existe, la version automatique sinon. Les feuilles déjà
-- imprimées en profitent sans réimpression. Le lien de partage (092) n'est pas concerné : il garde
-- ses vues Téléphone / Pages A4 automatiques.
--
-- Choix :
--  - La page est rangée en TEXTE dans la table, pas en fichier dans le bucket board-assets : elle
--    vit et meurt avec sa ligne (suppression en cascade avec le cours, aucun fichier orphelin),
--    l'Edge Function version-mobile la lit dans la même requête que ses métadonnées, sans
--    politique de stockage à écrire, et le dépôt est atomique (page + état du document d'un coup).
--    5 Mo au plus : PostgreSQL la compresse (TOAST) et ne la lit que si on la demande.
--  - board_id : toujours l'original (une copie posée pour une classe est ramenée à son original
--    par depot-cours, comme pour le QR code). Jamais une correction ni une évaluation : refusé au
--    dépôt (rules.ts, mobileEligible), et version-mobile relit le titre à chaque appel.
--  - doc_fingerprint : empreinte du document (texte et mise en page, sans écrans ni liens) au
--    moment du dépôt, ou du dernier « Garder » dans l'éditeur. L'éditeur la compare à celle du
--    document à l'instant : différente = « plus ancienne que le document ». Une empreinte plutôt
--    que boards.updated_at ou doc.rev : ceux-ci changent aussi quand on dépose des écrans ou qu'on
--    renomme le cours, ce qui ne touche pas la page du téléphone. doc_rev et board_updated_at sont
--    gardés pour information.
--  - Écriture de la page : seulement par l'Edge Function (clé de service), qui vérifie qu'elle est
--    autonome (rien chargé du réseau : version-mobile/custom.ts, customPageProblem). Le professeur
--    connecté lit les métadonnées (jamais la page elle-même, inutile dans l'éditeur), met à jour
--    l'état de référence (« Garder ») et supprime la ligne (« Revenir à l'automatique »). Rien
--    pour un visiteur sans compte : le téléphone passe par version-mobile.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.board_mobile_custom (
  board_id         UUID PRIMARY KEY REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  html             TEXT NOT NULL CHECK (octet_length(html) <= 5242880),
  bytes            INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),
  doc_fingerprint  TEXT NOT NULL CHECK (char_length(doc_fingerprint) <= 64),
  doc_rev          TEXT,
  board_updated_at TIMESTAMPTZ,
  deposited_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.board_mobile_custom IS 'Version mobile sur mesure d''un document (page HTML autonome déposée par Claude) ; une par original, servie par le QR code imprimé.';
COMMENT ON COLUMN public.board_mobile_custom.board_id IS 'Original de la bibliothèque (jamais une copie posée pour une classe)';
COMMENT ON COLUMN public.board_mobile_custom.html IS 'Page HTML complète et autonome (rien du réseau), 5 Mo au plus ; écrite par l''Edge Function depot-cours seulement';
COMMENT ON COLUMN public.board_mobile_custom.doc_fingerprint IS 'Empreinte du document au dépôt ou au dernier « Garder » (version-mobile/custom.ts, docFingerprint)';
COMMENT ON COLUMN public.board_mobile_custom.checked_at IS 'Dernier « Garder » dans l''éditeur (ou dépôt)';

CREATE INDEX IF NOT EXISTS idx_board_mobile_custom_user ON public.board_mobile_custom (user_id);

ALTER TABLE public.board_mobile_custom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_mobile_custom_select" ON public.board_mobile_custom;
CREATE POLICY "board_mobile_custom_select" ON public.board_mobile_custom
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_mobile_custom_update" ON public.board_mobile_custom;
CREATE POLICY "board_mobile_custom_update" ON public.board_mobile_custom
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "board_mobile_custom_delete" ON public.board_mobile_custom;
CREATE POLICY "board_mobile_custom_delete" ON public.board_mobile_custom
  FOR DELETE USING (auth.uid() = user_id);

-- Pas de politique INSERT : la page n'entre que par l'Edge Function (clé de service).
-- Droits par colonne : le navigateur ne lit pas la page et ne réécrit que l'état de référence.
REVOKE ALL ON public.board_mobile_custom FROM anon;
REVOKE ALL ON public.board_mobile_custom FROM authenticated;
GRANT SELECT (board_id, user_id, bytes, doc_fingerprint, doc_rev, board_updated_at, deposited_at, checked_at)
  ON public.board_mobile_custom TO authenticated;
GRANT UPDATE (doc_fingerprint, doc_rev, checked_at) ON public.board_mobile_custom TO authenticated;
GRANT DELETE ON public.board_mobile_custom TO authenticated;
