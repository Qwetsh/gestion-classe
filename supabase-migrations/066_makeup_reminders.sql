-- ============================================================
-- Migration 066 : Rappel des évals à faire rattraper aux absents
-- ============================================================
-- Quand une éval écrite a des élèves marqués absents, l'app rappelle sur la séance suivante
-- de la classe : « Faire reprendre l'éval <nom> à : <élèves> ».
--
-- Choix (validés par Thomas le 08/11/2026) :
--  - Rien n'est stocké par séance : le rappel est CALCULÉ à l'affichage à partir de cette vue.
--    Pas de déclencheur, pas de doublon possible, et la note manuelle du cours (lesson_notes,
--    une par cours) reste libre. Si le rattrapage n'a pas lieu, le rappel glisse tout seul
--    à la séance suivante (l'accueil web place chaque élève sur le prochain cours de sa classe
--    ou de son demi-groupe ; le téléphone l'affiche à chaque séance de la classe).
--  - Un élève est « à faire rattraper » tant que sa ligne est en statut « absent » ET qu'il n'a
--    ni note ni copie scannée. Scanner sa copie le repasse en « noté » (téléphone), saisir une
--    note ou le passer en dispensé / non rendu dans le carnet le sort aussi de la liste.
--  - Seulement les évals écrites (kind = 'ecrit') datées de moins de 4 semaines : les plus
--    anciennes sont réglées ou abandonnées.
--  - « Ne plus rappeler » se décide par éval (makeup_reminder_dismissed_at), depuis l'accueil
--    web ou le téléphone. Remettre NULL rallume le rappel.
-- ============================================================

ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS makeup_reminder_dismissed_at timestamptz;

COMMENT ON COLUMN public.written_assessments.makeup_reminder_dismissed_at IS
  'Rappel « faire rattraper aux absents » coupé à la main à cette date (NULL = rappel actif). Cf. vue pending_makeups.';

-- Une ligne par élève absent à faire rattraper. security_invoker : la RLS des tables lues
-- (written_assessments, assessment_grades, students…) s'applique à l'utilisateur qui lit la vue.
CREATE OR REPLACE VIEW public.pending_makeups
WITH (security_invoker = true) AS
SELECT
  wa.user_id,
  wa.id                                   AS assessment_id,
  wa.name                                 AS assessment_name,
  COALESCE(wa.date, wa.created_at::date)  AS assessment_date,
  wa.class_id,
  wa.group_id,
  g.student_id,
  s.pseudo,
  COALESCE(
    ARRAY(SELECT m.group_id FROM public.class_group_members m WHERE m.student_id = g.student_id),
    '{}'::uuid[]
  )                                       AS student_group_ids
FROM public.assessment_grades g
JOIN public.written_assessments wa ON wa.id = g.assessment_id
JOIN public.students s ON s.id = g.student_id
WHERE g.status = 'absent'
  AND g.grade IS NULL
  AND wa.kind = 'ecrit'
  AND NOT COALESCE(wa.is_deleted, false)
  AND NOT COALESCE(s.is_deleted, false)
  AND wa.makeup_reminder_dismissed_at IS NULL
  AND COALESCE(wa.date, wa.created_at::date) >= CURRENT_DATE - 28
  AND NOT EXISTS (
    SELECT 1 FROM public.assessment_copy_pages p
    WHERE p.assessment_id = wa.id AND p.student_id = g.student_id
  );

COMMENT ON VIEW public.pending_makeups IS
  'Élèves absents à une éval écrite récente (< 4 semaines), sans note ni copie : rappel « faire rattraper » sur la séance suivante de la classe.';

GRANT SELECT ON public.pending_makeups TO authenticated;
