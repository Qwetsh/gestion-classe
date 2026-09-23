-- Migration 041 — Évaluation adaptée, élève par élève
--
-- Un même devoir peut être aménagé pour un élève (PAP, PPRE, arrivée en cours d'année,
-- consigne allégée) sans l'être pour les autres : l'information est donc portée par la
-- NOTE (assessment_grades), pas par l'évaluation.
--
-- Volontairement un simple booléen : on note QUE le devoir était adapté, jamais en quoi.
-- Le détail de l'aménagement relève du dossier de l'élève, pas du carnet de notes (RGPD,
-- même règle que les 3 booléens has_pap/has_ppre/has_pai de la migration 038).
--
-- Une note adaptée compte dans la moyenne comme les autres : l'aménagement sert à rendre
-- l'évaluation accessible, pas à la sortir du calcul. Le marqueur est une information de
-- lecture pour l'enseignant (et pour le conseil de classe), pas un filtre.

ALTER TABLE public.assessment_grades
  ADD COLUMN IF NOT EXISTS is_adapted BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.assessment_grades.is_adapted IS
  'TRUE : l''évaluation ou l''activité était adaptée pour cet élève. Ne change rien au calcul de la moyenne.';
