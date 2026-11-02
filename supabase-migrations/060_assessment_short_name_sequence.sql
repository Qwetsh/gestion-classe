-- Migration 060 : titre court et séquence d'une évaluation (hub Évaluations, phase 1)
-- Description : PLAN_hub_evaluations.md, phase 1. Deux colonnes facultatives sur
--   written_assessments, lues par le carnet :
--   - short_name : titre court affiché dans l'en-tête de colonne (« Éval 1 », « TP resp. ») ;
--     vide = on affiche `name`.
--   - sequence   : séquence du programme (« Séquence 1 »), pour filtrer le carnet.
--   Purement additive : aucune ligne existante n'est modifiée, aucune contrainte posée. Les
--   écrans lisent `*` : avant la migration ces champs sont simplement absents ; après un retour
--   arrière (ci-dessous) aussi.
--
--   Le reste du modèle du plan (lien séance de groupe, publication des corrections, historique
--   des corrections) vient avec les phases qui s'en servent.
--
-- Retour arrière :
--   ALTER TABLE public.written_assessments DROP COLUMN IF EXISTS short_name;
--   ALTER TABLE public.written_assessments DROP COLUMN IF EXISTS sequence;

ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS sequence text;

COMMENT ON COLUMN public.written_assessments.short_name IS
  'Titre court pour l''en-tête de colonne du carnet ; NULL = name.';
COMMENT ON COLUMN public.written_assessments.sequence IS
  'Séquence du programme (« Séquence 1 »), pour filtrer le carnet ; NULL = aucune.';
