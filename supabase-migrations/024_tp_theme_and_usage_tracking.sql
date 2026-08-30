-- Add theme to tp_templates
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS theme TEXT;

-- Add template_id to group_sessions for tracking which template was used
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES tp_templates(id) ON DELETE SET NULL;

-- Create index for efficient usage lookups
CREATE INDEX IF NOT EXISTS idx_group_sessions_template_id ON group_sessions(template_id);
