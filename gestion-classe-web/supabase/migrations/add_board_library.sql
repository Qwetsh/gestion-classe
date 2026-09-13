-- Bibliothèque de tableaux : rangement des tableaux préparés par niveau et chapitre,
-- et lien entre une séance et le tableau préparé dont elle est partie.
--
-- Un même tableau préparé (« Fractions », 6e) sert à plusieurs séances (6e A lundi, 6e B mardi) :
-- ses pages sont COPIÉES dans board_pages(session_id) au moment où on l'ouvre en classe, l'original
-- reste intact, et session_boards garde la trace de l'origine (une séance part d'au plus un tableau).
--
-- Appliquée en prod le 13/09/2026.

ALTER TABLE boards ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS chapter TEXT;

CREATE TABLE IF NOT EXISTS session_boards (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_boards_board_id ON session_boards(board_id);
CREATE INDEX IF NOT EXISTS idx_session_boards_user_id ON session_boards(user_id);

ALTER TABLE session_boards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_boards' AND policyname = 'Users can view own session_boards') THEN
    CREATE POLICY "Users can view own session_boards" ON session_boards FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_boards' AND policyname = 'Users can insert own session_boards') THEN
    CREATE POLICY "Users can insert own session_boards" ON session_boards FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_boards' AND policyname = 'Users can update own session_boards') THEN
    CREATE POLICY "Users can update own session_boards" ON session_boards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_boards' AND policyname = 'Users can delete own session_boards') THEN
    CREATE POLICY "Users can delete own session_boards" ON session_boards FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;
