-- Étape 2 de PLAN_preparation_semaine.md (second lot) : ce que le tableau blanc gardait seulement
-- sur l'ordinateur passe en base.
--
-- 1. board_pages.meta : réglages d'une page que l'application ne rangeait nulle part côté serveur.
--    { "color": "#rrggbb", "curtain": true, "height": 812 }, chaque clé absente quand elle vaut
--    sa valeur par défaut (fond blanc, pas de rideau, format 16:9). Sans cette colonne, une page
--    préparée sur un ordinateur perd sa couleur, son rideau et son allongement sur un autre.
--
-- 2. session_board_state : état des révélations d'une séance (rideaux levés, tickets grattés,
--    trous découverts, objets montrés ou déplacés par un bouton). Il restait dans le navigateur
--    de la classe : rouvert ailleurs, le tableau de la séance revenait tout couvert.
--    Une ligne par séance, supprimée avec elle. Table à part : `sessions` est partagée avec
--    l'application mobile et ne reçoit pas de colonne.
--
-- Additif : sans cette migration, l'application continue comme avant (état gardé sur l'appareil).

ALTER TABLE board_pages ADD COLUMN IF NOT EXISTS meta JSONB;

COMMENT ON COLUMN board_pages.meta IS
  'Réglages de la page hors contenu : { color, curtain, height } ; clé absente = valeur par défaut.';

CREATE TABLE IF NOT EXISTS session_board_state (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reveal JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_board_state IS
  'État de séance du tableau blanc qui ne fait pas partie des pages : révélations (RevealState).';

ALTER TABLE session_board_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own session_board_state" ON session_board_state;
CREATE POLICY "Users can view own session_board_state" ON session_board_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own session_board_state" ON session_board_state;
CREATE POLICY "Users can insert own session_board_state" ON session_board_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own session_board_state" ON session_board_state;
CREATE POLICY "Users can update own session_board_state" ON session_board_state
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own session_board_state" ON session_board_state;
CREATE POLICY "Users can delete own session_board_state" ON session_board_state
  FOR DELETE USING (auth.uid() = user_id);
