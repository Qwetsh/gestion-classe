-- Migration: Room free tables (editeur libre de tables)
-- Description: Modele "tables libres" : la salle devient une liste de tables positionnables
--              (x,y), redimensionnables (cols x rows sieges), rotatives (0|90), fusionnables.
--              layout_type='free' -> salle en mode libre. Grille (grid_rows/cols/disabled_cells/table_groups)
--              conservee pour retrocompat des salles existantes.
-- Mobile : pull sync = colonnes explicites -> colonne ignoree (safe).

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS tables JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.rooms.tables IS 'Tables libres: [{ id, x, y, cols, rows, rotation }] (unites). layout_type=free.';
