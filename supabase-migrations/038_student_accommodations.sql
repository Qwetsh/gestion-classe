-- ============================================================
-- Migration 038 : Dispositifs d'accompagnement (PAP / PPRE / PAI)
-- ============================================================
-- Trois drapeaux booléens sur students : l'enseignant indique seulement
-- SI l'élève bénéficie d'un dispositif, jamais son contenu (RGPD : aucune
-- donnée de santé ni de suivi n'est stockée).
--
--   PAP  = Plan d'Accompagnement Personnalisé (troubles des apprentissages)
--   PPRE = Programme Personnalisé de Réussite Éducative
--   PAI  = Projet d'Accueil Individualisé (santé)
--
-- Mobile : le pull sync lit des colonnes explicites -> un ancien APK ignore
-- simplement ces colonnes (safe). Les nouveaux APK les affichent sur le plan
-- de classe pendant la séance.
-- ============================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS has_pap  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ppre BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_pai  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.students.has_pap  IS 'Élève bénéficiant d''un PAP (indicateur seul, aucun détail)';
COMMENT ON COLUMN public.students.has_ppre IS 'Élève bénéficiant d''un PPRE (indicateur seul, aucun détail)';
COMMENT ON COLUMN public.students.has_pai  IS 'Élève bénéficiant d''un PAI (indicateur seul, aucun détail)';
