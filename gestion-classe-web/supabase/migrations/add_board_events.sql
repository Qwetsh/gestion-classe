-- Banque d'événements du tableau blanc : éléments préconfigurés (objets + actions d'interaction)
-- enregistrés par l'enseignant depuis un tableau (« Enregistrer dans mes événements… »), rangés
-- dans le compte pour le retrouver sur tous ses appareils (TBI, PC, maison). Le navigateur garde
-- une copie locale ; le compte est la référence. Lisible par son propriétaire seulement.
-- Appliquée en prod le 20/09/2026.

CREATE TABLE IF NOT EXISTS user_board_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  -- { objects: BoardObject[] } : positions relatives au coin haut-gauche du fragment
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_board_events_user_idx ON user_board_events (user_id, created_at DESC);

ALTER TABLE user_board_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_board_events' AND policyname = 'Users can view own board events') THEN
    CREATE POLICY "Users can view own board events" ON user_board_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_board_events' AND policyname = 'Users can insert own board events') THEN
    CREATE POLICY "Users can insert own board events" ON user_board_events FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_board_events' AND policyname = 'Users can update own board events') THEN
    CREATE POLICY "Users can update own board events" ON user_board_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_board_events' AND policyname = 'Users can delete own board events') THEN
    CREATE POLICY "Users can delete own board events" ON user_board_events FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;
