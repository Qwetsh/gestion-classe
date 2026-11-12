-- Migration 066 : rappel « faire rattraper aux absents »
-- (appliquée sur Class'it le 08/11/2026 ; le fichier n'avait pas été ajouté au dépôt : texte repris tel quel de
--  l'historique des migrations de la base, supabase_migrations.schema_migrations, le 12/11/2026)
-- Description : une éval écrite récente (moins de 4 semaines) dont un élève était absent, sans note ni copie, donne un
--   rappel « faire rattraper » sur la séance suivante de la classe (vue pending_makeups). Le professeur peut couper le
--   rappel d'une éval à la main (written_assessments.makeup_reminder_dismissed_at).

ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS makeup_reminder_dismissed_at timestamptz;

COMMENT ON COLUMN public.written_assessments.makeup_reminder_dismissed_at IS
  'Rappel « faire rattraper aux absents » coupé à la main à cette date (NULL = rappel actif). Cf. vue pending_makeups.';

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
