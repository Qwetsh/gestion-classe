-- Tableau blanc : objets de page (modèle v2). Une page porte une liste ordonnée d'objets
-- typés (zones de texte, puis formes, images, tableaux…) au-dessus de son encre.
-- Voir src/lib/boardObjects.ts pour le modèle.

ALTER TABLE board_pages ADD COLUMN IF NOT EXISTS objects JSONB NOT NULL DEFAULT '[]'::jsonb;
