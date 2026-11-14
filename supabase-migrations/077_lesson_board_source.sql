-- Lot C3 de PLAN_mes_cours.md : de quel original vient une copie placée sur un cours.
--
-- Un cours de la bibliothèque (ligne de `boards` sans lien) est copié sur chaque créneau où il
-- sert : la copie est une autre ligne de `boards`, reliée au créneau par `lesson_boards`. Rien ne
-- disait jusqu'ici d'où venait cette copie. Avec `source_board_id` :
--   - la page « Mes cours » montre, sur chaque original, les classes où il est placé ;
--   - une activité se retrouve dans toutes les classes qui l'ont faite (lot C4) ;
--   - la préparation de la semaine par Claude ne place pas deux fois la même activité sur le même
--     créneau (étape 4 de PLAN_preparation_semaine.md, qui prévoyait cette colonne).
--
-- NULL = provenance inconnue (tableau créé directement sur le créneau).
--
-- PAS DE CLÉ ÉTRANGÈRE, et c'est voulu. Une contrainte source_board_id → boards serait une seconde
-- relation entre lesson_boards et boards : toutes les lectures « lesson_boards → boards(...) » de
-- l'application deviennent alors ambiguës pour PostgREST (erreur PGRST201) et échouent — les
-- documents disparaissent du calendrier et de l'écran de classe. C'est arrivé en production le
-- 14/11/2026, pendant quelques minutes, avec la première version de cette migration.
-- Conséquence acceptée : la colonne peut désigner un original supprimé ; l'application l'ignore
-- (une pastille ne s'affiche que sur un original présent).
--
-- Additif : sans cette migration, l'application place les copies comme avant, sans pastille.

ALTER TABLE public.lesson_boards
  ADD COLUMN IF NOT EXISTS source_board_id UUID;

-- Base où la première version a été appliquée : retirer la contrainte fautive
ALTER TABLE public.lesson_boards
  DROP CONSTRAINT IF EXISTS lesson_boards_source_board_id_fkey;

COMMENT ON COLUMN public.lesson_boards.source_board_id IS
  'Original de la bibliothèque dont ce tableau de cours est la copie ; NULL = inconnu. Sans clé étrangère (une seconde relation vers boards rendrait ambiguës les lectures lesson_boards → boards) : peut désigner un original supprimé.';

CREATE INDEX IF NOT EXISTS idx_lesson_boards_source
  ON public.lesson_boards (source_board_id)
  WHERE source_board_id IS NOT NULL;
