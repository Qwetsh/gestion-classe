-- Photos de référence attachées aux modèles de TP
-- Permet à l'enseignant de préparer des photos consultables sur mobile pendant le TP

CREATE TABLE IF NOT EXISTS tp_template_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES tp_templates(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT DEFAULT '',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_ttp_template ON tp_template_photos(template_id);

-- RLS
ALTER TABLE tp_template_photos ENABLE ROW LEVEL SECURITY;

-- L'enseignant peut tout faire sur les photos de ses propres TP
CREATE POLICY "ttp_select" ON tp_template_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tp_templates t WHERE t.id = template_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "ttp_insert" ON tp_template_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tp_templates t WHERE t.id = template_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "ttp_update" ON tp_template_photos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM tp_templates t WHERE t.id = template_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "ttp_delete" ON tp_template_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tp_templates t WHERE t.id = template_id AND t.user_id = auth.uid()
  ));
