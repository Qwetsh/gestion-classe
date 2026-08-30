-- Migration: Room layouts (dispositions U / ilots de 4)
-- Description: Ajoute la disposition + le regroupement en tables/ilots aux salles.
--              Retrocompatible : grid_rows/grid_cols/disabled_cells conserves ; table_groups vide = comportement actuel.
--              Le placement reste cellulaire (positions inchangees) -> menu radial non impacte.
-- Mobile : le pull sync selectionne des colonnes explicites -> ces nouvelles colonnes sont ignorees (safe).

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS layout_type TEXT DEFAULT 'rows';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS table_groups JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.rooms.layout_type IS 'Disposition: rows | u | islands | custom';
COMMENT ON COLUMN public.rooms.table_groups IS 'Tables/ilots: [{ id, label?, cells: ["r,c", ...] }] (purement visuel, placement reste cellulaire)';
