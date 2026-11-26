-- Correction automatique par l'API Claude : seuls les comptes listés ici peuvent la lancer.
-- La fonction corriger-copie paie avec la clé ANTHROPIC_API_KEY du propriétaire de l'app :
-- un compte inscrit librement ne doit pas pouvoir la consommer.
--
-- RLS activée sans aucune politique : invisible et non modifiable depuis l'app ;
-- seule la fonction (clé service) la lit. Ajouter un compte à la main dans le SQL editor :
--   insert into ai_correction_allowed_users (user_id) values ('<uuid du compte>');
-- Le compte du propriétaire est inséré à l'application de la migration, pas dans ce fichier
-- (dépôt public).

CREATE TABLE IF NOT EXISTS ai_correction_allowed_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_correction_allowed_users ENABLE ROW LEVEL SECURITY;
