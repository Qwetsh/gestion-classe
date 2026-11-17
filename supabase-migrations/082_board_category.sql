-- Migration 082 : rayon d'un cours dans « Mes cours » (fiches méthode)
--
-- La page « Mes cours » a un onglet « Fiches méthode », à côté de la bibliothèque des activités :
-- les fiches méthode (« FM1 — Lire une consigne »…) sont des cours rédigés comme les autres
-- (éditeur, aperçu, placement sur un cours), mais rangés à part, pour ne pas encombrer les
-- séquences d'activités.
--
-- Valeurs : NULL = bibliothèque des activités (tous les cours existants) ; 'methode' = fiche
-- méthode. Une liste fermée, élargie au besoin par une prochaine migration.
-- Le mobile lit des colonnes nommées de boards : non touché. Aucune clé étrangère ajoutée.

ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boards_category_check') THEN
    ALTER TABLE public.boards
      ADD CONSTRAINT boards_category_check CHECK (category IS NULL OR category IN ('methode'));
  END IF;
END $$;

COMMENT ON COLUMN public.boards.category IS 'Rayon de « Mes cours » : NULL = bibliothèque des activités, ''methode'' = onglet « Fiches méthode ».';
