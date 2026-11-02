-- 064 — Hub Évaluations, phase 4 : publier les notes sans les corrections.
--
-- Jusqu'ici, publier une éval montrait tout d'un bloc à l'élève : sa note, son détail, le
-- commentaire, le corrigé et, pour une activité numérique, sa copie corrigée. On ajoute un
-- seul drapeau, « corrections retenues » : la note reste visible, le reste attend.
--
-- Rétro-compatible : la colonne vaut false par défaut, donc une éval déjà publiée continue de
-- tout montrer. Les fonctions élève sont réécrites à partir de leur version EN LIGNE (qui
-- résout le code élève par resolve_student_code, cf. PR #3 « collèges partagés »), en ne
-- changeant que ce qui touche aux corrections. L'Edge Function student-doc refuse aussi le
-- corrigé tant que le drapeau est levé (à redéployer APRÈS cette migration).

ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS corrections_withheld boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.written_assessments.corrections_withheld IS
  'Publiée sans les corrections : l''élève voit sa note, pas le détail, le commentaire, le corrigé ni sa copie corrigée.';

CREATE OR REPLACE FUNCTION public.get_student_grades(p_code text, p_student_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
  v_class_id uuid;
  v_pseudo text;
  v_is_witness boolean;
  v_show_grades boolean;
  v_rows json;
BEGIN
  IF p_code IS NULL OR LENGTH(p_code) != 6 OR p_code !~ '^\d{6}$' THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  SELECT s.class_id, s.pseudo, COALESCE(s.is_witness, false)
  INTO v_class_id, v_pseudo, v_is_witness
  FROM students s
  WHERE s.id = v_student_id;

  SELECT cst.show_grades INTO v_show_grades
  FROM class_student_tabs cst
  WHERE cst.class_id = v_class_id;

  v_show_grades := COALESCE(v_show_grades, false) OR v_is_witness;

  IF NOT v_show_grades THEN
    RETURN json_build_object('enabled', false, 'assessments', '[]'::json);
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.period, r.date NULLS LAST, r.name), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      a.id,
      a.name,
      a.subject,
      a.date,
      a.period,
      a.kind,
      a.coefficient,
      a.bareme_total,
      a.counts_in_average,
      -- Brouillon du correcteur : rien de la note tant que le prof ne l'a pas validée (053).
      CASE WHEN g.is_validated THEN g.grade END     AS grade,
      CASE WHEN g.is_validated THEN g.grade_raw END AS grade_raw,
      -- Corrections retenues (064) : la note seule, sans commentaire ni détail.
      CASE WHEN g.is_validated AND NOT a.corrections_withheld THEN g.comment END AS comment,
      CASE WHEN g.is_validated AND NOT a.corrections_withheld THEN g.details END AS details,
      COALESCE(g.status, 'noted') AS status,
      (COALESCE(a.subject_path, se.subject_path) IS NOT NULL) AS has_subject,
      (NOT a.corrections_withheld AND COALESCE(a.correction_path, se.correction_path) IS NOT NULL) AS has_correction,
      -- Activité numérique : la copie corrigée de l'élève est consultable (migration 047).
      (NOT a.corrections_withheld AND EXISTS (
        SELECT 1
        FROM activity_assessments aa
        JOIN student_works w
          ON w.activity_id = aa.activity_id
         AND w.student_id = v_student_id
         AND w.is_deleted = false
         AND w.correction IS NOT NULL
         AND w.status IN ('corrected', 'validated')
        WHERE aa.assessment_id = a.id
      )) AS has_work,
      a.corrections_withheld
    FROM written_assessments a
    LEFT JOIN assessment_series se ON se.id = a.series_id
    LEFT JOIN assessment_grades g
      ON g.assessment_id = a.id AND g.student_id = v_student_id
    WHERE a.class_id = v_class_id
      AND a.is_deleted = false
      AND a.published_to_students = true
  ) r;

  RETURN json_build_object(
    'enabled', true,
    'pseudo', v_pseudo,
    'assessments', v_rows
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_work_correction(p_code text, p_assessment_id uuid, p_student_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
  v_class_id uuid;
  v_is_witness boolean;
  v_show_grades boolean;
  v_activity record;
  v_work record;
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' OR p_assessment_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  SELECT s.class_id, COALESCE(s.is_witness, false) INTO v_class_id, v_is_witness
  FROM students s WHERE s.id = v_student_id;

  SELECT cst.show_grades INTO v_show_grades FROM class_student_tabs cst WHERE cst.class_id = v_class_id;
  IF NOT (COALESCE(v_show_grades, false) OR v_is_witness) THEN
    RETURN json_build_object('error', 'disabled');
  END IF;

  -- Évaluation publiée de la classe de l'élève, reliée à une activité numérique,
  -- et dont les corrections ne sont pas retenues (064).
  SELECT act.id, act.title, act.sequence, act.level, act.bareme_total, act.definition, act.definition_version
  INTO v_activity
  FROM written_assessments a
  JOIN activity_assessments aa ON aa.assessment_id = a.id
  JOIN activities act ON act.id = aa.activity_id AND act.is_deleted = false
  WHERE a.id = p_assessment_id
    AND a.class_id = v_class_id
    AND a.is_deleted = false
    AND a.published_to_students = true
    AND NOT a.corrections_withheld;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT w.content, w.correction, w.advice, w.skills, w.total_points, w.status, w.version,
         w.submitted_at, w.corrected_at, w.group_pseudos
  INTO v_work
  FROM student_works w
  WHERE w.activity_id = v_activity.id
    AND w.student_id = v_student_id
    AND w.is_deleted = false
    AND w.correction IS NOT NULL
    AND w.status IN ('corrected', 'validated');
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object(
    'found', true,
    'activity', json_build_object(
      'title', v_activity.title,
      'sequence', v_activity.sequence,
      'level', v_activity.level,
      'bareme_total', v_activity.bareme_total,
      'definition', v_activity.definition,
      'definition_version', v_activity.definition_version
    ),
    'work', json_build_object(
      'content', v_work.content,
      'correction', v_work.correction,
      'advice', v_work.advice,
      'skills', v_work.skills,
      'total_points', v_work.total_points,
      'status', v_work.status,
      'version', v_work.version,
      'submitted_at', v_work.submitted_at,
      'corrected_at', v_work.corrected_at,
      'group_pseudos', to_json(v_work.group_pseudos)
    )
  );
END;
$function$;
