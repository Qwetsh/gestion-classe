-- Tableaux nommés hors séance (« mon cours sur la photosynthèse »), ouvrables depuis l'accueil.
-- Une page appartient soit à une séance (session_id), soit à un tableau (board_id).

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can view own boards') THEN
    CREATE POLICY "Users can view own boards" ON boards FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can insert own boards') THEN
    CREATE POLICY "Users can insert own boards" ON boards FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can update own boards') THEN
    CREATE POLICY "Users can update own boards" ON boards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boards' AND policyname = 'Users can delete own boards') THEN
    CREATE POLICY "Users can delete own boards" ON boards FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Les pages : rattachées à une séance OU à un tableau
ALTER TABLE board_pages ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE board_pages ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_board_pages_board_id ON board_pages(board_id);
-- Index unique ordinaire (pas partiel) : PostgREST s'en sert pour l'upsert ; les NULL ne se heurtent pas
CREATE UNIQUE INDEX IF NOT EXISTS board_pages_board_page ON board_pages(board_id, page_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'board_pages_one_owner') THEN
    ALTER TABLE board_pages ADD CONSTRAINT board_pages_one_owner CHECK ((session_id IS NOT NULL) <> (board_id IS NOT NULL));
  END IF;
END
$$;
