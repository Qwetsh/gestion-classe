-- Migration: room_disabled_cells
-- Description: Ajoute un champ pour stocker les cellules desactivees (allees) dans les salles

-- Ajouter la colonne disabled_cells a la table rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS disabled_cells JSONB DEFAULT '[]'::jsonb;

-- Comment
COMMENT ON COLUMN rooms.disabled_cells IS 'Liste JSONB des cellules desactivees au format ["row,col", ...]';
