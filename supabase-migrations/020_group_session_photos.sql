-- Photos attachées aux séances de groupe (TP)
-- Permet à l'enseignant de préparer des photos de référence consultables sur mobile

CREATE TABLE IF NOT EXISTS group_session_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT DEFAULT '',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_gsp_session ON group_session_photos(session_id);

-- RLS
ALTER TABLE group_session_photos ENABLE ROW LEVEL SECURITY;

-- L'enseignant peut tout faire sur les photos de ses propres TP
CREATE POLICY "gsp_select" ON group_session_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM group_sessions gs WHERE gs.id = session_id AND gs.user_id = auth.uid()
  ));

CREATE POLICY "gsp_insert" ON group_session_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_sessions gs WHERE gs.id = session_id AND gs.user_id = auth.uid()
  ));

CREATE POLICY "gsp_delete" ON group_session_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM group_sessions gs WHERE gs.id = session_id AND gs.user_id = auth.uid()
  ));

-- Storage: réutilise le bucket student-photos existant
-- Les photos TP seront stockées sous {user_id}/tp/{session_id}/{photo_id}.jpg
-- Les policies storage existantes couvrent déjà {user_id}/**
