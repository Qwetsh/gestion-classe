-- Add color column to tp_templates for visual categorization
ALTER TABLE tp_templates
ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'green';
