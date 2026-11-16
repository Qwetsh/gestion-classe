-- Migration 080 : thème du programme d'un sujet d'annale ajouté à la main
--
-- L'onglet Annales range les sujets de SVT par thème du programme du cycle 4. Les sujets du
-- catalogue (brevets.ts) sont classés dans le code (lib/annalesLibrary.ts) ; un sujet ajouté depuis
-- l'app porte ici le thème choisi à l'ajout. NULL = déduit du titre, sinon « À classer ».
--
-- Valeurs : 'planete' | 'vivant' | 'corps'. Colonne ajoutée, rien d'autre ne change :
-- l'espace élève lit la table avec select('*') et ignore la colonne.

ALTER TABLE public.custom_annales
  ADD COLUMN IF NOT EXISTS programme TEXT
  CHECK (programme IS NULL OR programme IN ('planete', 'vivant', 'corps'));

-- Les trois sujets SVT 2026 déjà ajoutés
UPDATE public.custom_annales SET programme = 'planete' WHERE programme IS NULL AND code IN ('26GENSCAA1', '26GENSCMEAG1');
UPDATE public.custom_annales SET programme = 'vivant'  WHERE programme IS NULL AND code = '26GENSCAN1';
