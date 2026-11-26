-- 093 — Carnet : type « Activité notée » et évaluations qui ne comptent que si elles font
-- monter la moyenne.
--
-- Deux ajouts au formulaire d'une évaluation :
--   1. un type de plus, 'activite' (« Activité notée ») ;
--   2. une option « seulement si elle fait monter la moyenne de l'élève » : la note est retenue
--      pour l'élève qu'elle avantage, ignorée pour les autres (la « note facultative » de
--      Pronote). Le calcul vit dans lib/gradeStats.ts (studentAverage), nulle part en base.
--
-- Rétro-compatible : la colonne vaut false par défaut, aucune moyenne existante ne bouge.
-- get_student_grades est réécrite à partir de sa version EN LIGNE (identique à celle de 064,
-- relue par pg_get_functiondef le 26/11/2026), avec une seule colonne de plus : l'espace élève
-- calcule ses moyennes comme le carnet et doit donc connaître le drapeau.
--
-- À appliquer AVANT de déployer le web (la page Analyse lit la nouvelle colonne).
--
-- Retour arrière :
--   UPDATE public.written_assessments SET kind = 'ecrit' WHERE kind = 'activite';
--   remettre la contrainte de kind de 063, rejouer get_student_grades de 064, puis
--   ALTER TABLE public.written_assessments DROP COLUMN only_if_raises_average;

-- ------------------------------------------------------------------
-- 1. Type 'activite'
-- ------------------------------------------------------------------
ALTER TABLE public.written_assessments DROP CONSTRAINT IF EXISTS written_assessments_kind_check;
ALTER TABLE public.written_assessments ADD CONSTRAINT written_assessments_kind_check
  CHECK (kind = ANY (ARRAY['ecrit', 'activite', 'tp', 'oral', 'dm', 'projet', 'groupe']));

-- ------------------------------------------------------------------
-- 2. « Seulement si elle fait monter la moyenne »
-- ------------------------------------------------------------------
ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS only_if_raises_average boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.written_assessments.only_if_raises_average IS
  'Compte dans la moyenne seulement pour l''élève dont elle fait monter la moyenne. Sans effet si counts_in_average est faux.';

-- ------------------------------------------------------------------
-- 3. Espace élève : le drapeau accompagne chaque évaluation
-- ------------------------------------------------------------------
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
      -- Ne compte que si elle fait monter la moyenne de l'élève (093).
      a.only_if_raises_average,
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
