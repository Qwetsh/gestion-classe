-- Clés et réglages d'intégrations de l'enseignant (YouTube, Unsplash, base Notion, Google Drive),
-- rangés dans le compte pour suivre l'utilisateur d'un appareil à l'autre (TBI, PC, maison).
-- Ce sont des clés « navigateur » (restreintes par site côté Google) : lisibles par leur propriétaire seulement.
-- Appliquée en prod le 10/09/2026.

CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_keys' AND policyname = 'Users can view own api keys') THEN
    CREATE POLICY "Users can view own api keys" ON user_api_keys FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_keys' AND policyname = 'Users can insert own api keys') THEN
    CREATE POLICY "Users can insert own api keys" ON user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_keys' AND policyname = 'Users can update own api keys') THEN
    CREATE POLICY "Users can update own api keys" ON user_api_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_keys' AND policyname = 'Users can delete own api keys') THEN
    CREATE POLICY "Users can delete own api keys" ON user_api_keys FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;
