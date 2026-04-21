-- Liste du matériel nécessaire pour chaque TP
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS materials TEXT[] DEFAULT '{}';
