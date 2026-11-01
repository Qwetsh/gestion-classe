-- Migration 059 : un kit de correction par version du sujet
-- Description : une même éval peut avoir plusieurs versions du sujet (ex. v4 pour un élève en
--   rattrapage, v5 pour la classe). Le bouton « Corriger » doit prendre le barème de la version
--   de l'élève (assessment_grades.subject_version) : un kit par (éval, version).
--
--   - version_key : version du kit (`kit.version`), en minuscules et sans espaces autour ;
--     '' = kit sans version (« version unique »). Colonne générée : push_grades.py --kit n'a
--     qu'à envoyer le kit, la clé suit son contenu.
--   - La clé primaire passe de (assessment_id) à (assessment_id, version_key). Le kit existant
--     (sans version) garde la clé ''.

ALTER TABLE public.assessment_correction_kits
  ADD COLUMN IF NOT EXISTS version_key text
  GENERATED ALWAYS AS (lower(btrim(coalesce(kit ->> 'version', '')))) STORED NOT NULL;

COMMENT ON COLUMN public.assessment_correction_kits.version_key IS
  'Version du sujet du kit (kit.version, en minuscules) ; vide = kit sans version.';

ALTER TABLE public.assessment_correction_kits DROP CONSTRAINT IF EXISTS assessment_correction_kits_pkey;
ALTER TABLE public.assessment_correction_kits ADD PRIMARY KEY (assessment_id, version_key);
