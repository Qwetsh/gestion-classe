-- Étape 1 de PLAN_preparation_semaine.md : jetons d'import personnels.
--
-- Claude prépare les cours sur l'ordinateur du professeur et doit les déposer dans l'application :
-- images, documents de cours, écrans. Il le fait par l'Edge Function `depot-cours`, avec un jeton
-- que le professeur crée dans Réglages et peut révoquer.
--
--   - Jeton aléatoire (32 octets), montré une seule fois ; seul son SHA-256 est rangé ici.
--   - Il ne donne aucun accès en lecture. La fonction n'écrit que dans l'espace de son
--     propriétaire : dossier <user_id>/import/ du stockage board-assets, lignes boards et
--     board_pages à son nom.
--   - Valable un an, révocable à tout moment. `last_used_at` montre s'il sert encore.
--   - Seule l'Edge Function lit et écrit (service_role) ; le professeur peut lire ses jetons.
--
-- Additif : sans cette migration, la section « Jeton d'import » des Réglages le signale.

CREATE TABLE IF NOT EXISTS public.import_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text NOT NULL UNIQUE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

COMMENT ON TABLE public.import_tokens IS
  'Jetons d''import personnels (Edge Function depot-cours) : dépôt d''images, de cours et d''écrans ; SHA-256 seul.';

CREATE INDEX IF NOT EXISTS idx_import_tokens_user_id ON public.import_tokens(user_id);

ALTER TABLE public.import_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own import_tokens" ON public.import_tokens;
CREATE POLICY "Users view own import_tokens" ON public.import_tokens
  FOR SELECT USING (auth.uid() = user_id);
