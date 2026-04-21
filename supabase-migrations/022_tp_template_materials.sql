-- Liste du matériel nécessaire pour chaque modèle de TP
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS materials TEXT[] DEFAULT '{}';
