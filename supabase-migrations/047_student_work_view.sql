-- ============================================================
-- 047 — Espace élève : consulter sa copie corrigée d'une activité numérique
-- ============================================================
-- L'élève voit, depuis l'onglet « Évals », sa fiche réponse avec la correction (critères acquis,
-- remarques, compétences, conseils) pour les évaluations issues d'une activité numérique
-- (lien activity_assessments). Trois verrous, tous côté serveur, les mêmes que pour les notes :
-- onglet Évals ouvert pour la classe (ou élève témoin), évaluation publiée, copie corrigée ou validée.
-- Le corrigé attendu de l'enseignant (activities.expected_answers) n'est JAMAIS renvoyé.
--
-- NOTE : en production, toutes les RPC élève ont la signature (p_code, …, p_student_id uuid DEFAULT NULL)
-- et passent par resolve_student_code(p_code, p_student_id) — un même code peut désigner plusieurs fiches
-- élève (continuité d'une année sur l'autre), p_student_id lève l'ambiguïté. Cette fonction et ces
-- signatures ont été appliquées directement en base (pas de fichier dans supabase-migrations/) :
-- on garde ici la même signature pour ne pas créer de surcharge ambiguë pour PostgREST.
-- Appliquée en production le 10/10/2026 (en trois temps : student_work_view, student_work_view_fix_overload,
-- student_work_view_resolve_code).

-- 1. get_student_grades : signale les évaluations dont la copie corrigée est consultable (has_work)
DROP FUNCTION IF EXISTS public.get_student_grades(text);

CREATE OR REPLACE FUNCTION public.get_student_grades(p_code text, p_student_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- L'eleve temoin voit toujours l'onglet : c'est son role de controler l'affichage.
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
      g.grade,
      g.grade_raw,
      g.comment,
      COALESCE(g.status, 'noted') AS status,
      -- Le document peut etre porte par l'evaluation ou par sa serie.
      (COALESCE(a.subject_path, se.subject_path) IS NOT NULL)       AS has_subject,
      (COALESCE(a.correction_path, se.correction_path) IS NOT NULL) AS has_correction,
      -- Activité numérique : la copie corrigée de l'élève est consultable.
      EXISTS (
        SELECT 1
        FROM activity_assessments aa
        JOIN student_works w
          ON w.activity_id = aa.activity_id
         AND w.student_id = v_student_id
         AND w.is_deleted = false
         AND w.correction IS NOT NULL
         AND w.status IN ('corrected', 'validated')
        WHERE aa.assessment_id = a.id
      ) AS has_work
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
$$;
REVOKE ALL ON FUNCTION public.get_student_grades(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_student_grades(text, uuid) TO anon, authenticated;

-- 2. La copie corrigée d'un élève pour une évaluation issue d'une activité numérique
DROP FUNCTION IF EXISTS public.get_student_work_correction(text, uuid);

CREATE OR REPLACE FUNCTION public.get_student_work_correction(p_code text, p_assessment_id uuid, p_student_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Évaluation publiée de la classe de l'élève, reliée à une activité numérique.
  SELECT act.id, act.title, act.sequence, act.level, act.bareme_total, act.definition, act.definition_version
  INTO v_activity
  FROM written_assessments a
  JOIN activity_assessments aa ON aa.assessment_id = a.id
  JOIN activities act ON act.id = aa.activity_id AND act.is_deleted = false
  WHERE a.id = p_assessment_id
    AND a.class_id = v_class_id
    AND a.is_deleted = false
    AND a.published_to_students = true;
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
$$;

REVOKE ALL ON FUNCTION public.get_student_work_correction(text, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_student_work_correction(text, uuid, uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.get_student_work_correction(text, uuid, uuid) IS
  'Copie corrigée d''un élève (code à 6 chiffres) pour une évaluation du carnet issue d''une activité numérique : réponses, critères, remarques, compétences, conseils. Mêmes verrous que get_student_grades ; le corrigé attendu de l''enseignant n''est jamais renvoyé.';
