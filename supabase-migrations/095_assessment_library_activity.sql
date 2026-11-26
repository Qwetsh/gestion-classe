-- Migration 095 : une évaluation du carnet reliée à une activité de « Mes cours »
-- Description : dans la fenêtre « Nouvelle évaluation » / « Modifier l'évaluation », Thomas choisit
--   une séquence puis une activité de la bibliothèque (boards rangés niveau › séquence, fiche,
--   documents et correction rattachés par le titre, lib/courseLibrary.ts). L'évaluation garde les
--   identifiants des trois cours, pas leurs titres : renommer un cours ne casse pas le lien.
--
--   - library_board_id            : la fiche (le sujet) ;
--   - library_documents_board_id  : ses documents, s'il y en a ;
--   - library_correction_board_id : sa correction.
--   Un cours supprimé vide le lien (ON DELETE SET NULL) ; l'évaluation et ses notes ne bougent pas.
--
--   Le bouton « Corriger » (Edge Function corriger-copie) s'en sert quand le Correcteur n'a pas
--   envoyé de kit : il prépare alors un kit depuis la fiche et sa correction et le range dans
--   assessment_correction_kits avec kit.source = 'bibliotheque' (colonne générée `source`
--   ci-dessous). Un kit envoyé par push_grades.py --kit reste prioritaire et le remplace.
--
--   Aucune RPC élève ne lit ces colonnes ; et les cours restent privés (RLS de boards).
--   Purement additive.
--
-- Retour arrière :
--   ALTER TABLE public.assessment_correction_kits DROP COLUMN IF EXISTS source;
--   ALTER TABLE public.written_assessments
--     DROP COLUMN IF EXISTS library_board_id,
--     DROP COLUMN IF EXISTS library_documents_board_id,
--     DROP COLUMN IF EXISTS library_correction_board_id;

ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS library_board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS library_documents_board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS library_correction_board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.written_assessments.library_board_id IS
  'Fiche (sujet) de l''activité de Mes cours choisie pour cette évaluation ; NULL = aucune.';
COMMENT ON COLUMN public.written_assessments.library_documents_board_id IS
  'Documents de l''activité choisie (titre « … (documents) ») ; NULL = aucun.';
COMMENT ON COLUMN public.written_assessments.library_correction_board_id IS
  'Correction de l''activité choisie (titre « … (correction) ») : lue par le bouton « Corriger » sans kit du Correcteur.';

-- Les clés étrangères sans index ralentissent la suppression d'un cours.
CREATE INDEX IF NOT EXISTS idx_wa_library_board ON public.written_assessments(library_board_id) WHERE library_board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_library_documents ON public.written_assessments(library_documents_board_id) WHERE library_documents_board_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_library_correction ON public.written_assessments(library_correction_board_id) WHERE library_correction_board_id IS NOT NULL;

-- Origine d'un kit : 'correcteur' (push_grades.py --kit) ou 'bibliotheque' (préparé par
-- corriger-copie depuis la correction de l'activité). Générée : push_grades.py n'a rien à envoyer.
ALTER TABLE public.assessment_correction_kits
  ADD COLUMN IF NOT EXISTS source text
  GENERATED ALWAYS AS (coalesce(nullif(kit ->> 'source', ''), 'correcteur')) STORED NOT NULL;

COMMENT ON COLUMN public.assessment_correction_kits.source IS
  'correcteur = envoyé par push_grades.py --kit ; bibliotheque = préparé depuis la correction de l''activité de Mes cours.';
