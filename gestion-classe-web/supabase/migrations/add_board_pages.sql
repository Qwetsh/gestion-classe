-- Mode « en classe » : pages du tableau blanc rattachées à une séance.
-- Une ligne par page ; les traits sont stockés en JSON (coordonnées logiques, largeur = 1000).

CREATE TABLE IF NOT EXISTS board_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  background TEXT NOT NULL DEFAULT 'blank',
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_board_pages_session_id ON board_pages(session_id);

ALTER TABLE board_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'board_pages' AND policyname = 'Users can view own board pages') THEN
    CREATE POLICY "Users can view own board pages" ON board_pages FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'board_pages' AND policyname = 'Users can insert own board pages') THEN
    CREATE POLICY "Users can insert own board pages" ON board_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'board_pages' AND policyname = 'Users can update own board pages') THEN
    CREATE POLICY "Users can update own board pages" ON board_pages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'board_pages' AND policyname = 'Users can delete own board pages') THEN
    CREATE POLICY "Users can delete own board pages" ON board_pages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;
