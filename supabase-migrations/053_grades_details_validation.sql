-- Migration 053 : retour détaillé aux élèves, notes validées seulement (lot 3 de PLAN_copies_evaluation.md)
-- Description : le Correcteur (PC) envoie des notes en BROUILLON, avec leur détail dans
--   assessment_grades.details (points et commentaire par question, niveaux par compétence,
--   forces, faiblesses, commentaire général). Décision de Thomas (01/11/2026) : l'élève ne voit
--   une note — et son détail — qu'une fois validée par le prof ET l'éval publiée.
--   Jusqu'ici get_student_grades ignorait is_validated : un brouillon poussé sur une éval déjà
--   publiée était visible tout de suite.
--
--   1. Rattrapage : les notes existantes (saisies au carnet, import Pronote, productions)
--      passent validées d'office — les élèves continuent de voir exactement ce qu'ils voyaient.
--   2. Trigger : toute note écrite par le prof connecté SANS détail de correcteur est validée
--      d'office. La saisie manuelle n'a pas besoin d'un second geste, et cela vaut quelle que
--      soit la version du client (le site en ligne avant déploiement, l'app mobile…).
--      Les brouillons du Correcteur arrivent par la clé de service, avec un détail : le trigger
--      ne les touche pas, même quand le prof change ensuite le barème (recalcul des /20).
--   3. get_student_grades : renvoie `details`, et ne rend note, commentaire et détail que si la
--      note est validée. Une note en attente apparaît « en attente » côté élève.
--      Signature inchangée (p_code, p_student_id DEFAULT NULL) : cf. piège des surcharges
--      ambiguës du 10/10/2026 — corps repris de pg_get_functiondef avant modification.

-- ============================================================
-- 1. Rattrapage
-- ============================================================
UPDATE public.assessment_grades
   SET is_validated = true,
       validated_at = COALESCE(validated_at, updated_at, created_at)
 WHERE is_validated = false;

-- ============================================================
-- 2. Saisie du prof = validée
-- ============================================================
CREATE OR REPLACE FUNCTION public.assessment_grades_validate_manual()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated'
     AND NEW.details IS NULL
     AND NOT NEW.is_validated THEN
    NEW.is_validated := true;
    NEW.validated_at := COALESCE(NEW.validated_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.assessment_grades_validate_manual() IS
  'Une note saisie par le prof (sans détail de correcteur) est validée d''office ; les brouillons du Correcteur (clé de service, avec détail) attendent la validation.';

DROP TRIGGER IF EXISTS trg_assessment_grades_validate_manual ON public.assessment_grades;
CREATE TRIGGER trg_assessment_grades_validate_manual
  BEFORE INSERT OR UPDATE ON public.assessment_grades
  FOR EACH ROW EXECUTE FUNCTION public.assessment_grades_validate_manual();

COMMENT ON COLUMN public.assessment_grades.details IS
  'Détail de correction (format v1, Correcteur) : questions[{label,bareme,points,commentaire,competences}], competences[{nom,niveau}], forces, faiblesses, commentaire. Visible de l''élève seulement si la note est validée et l''éval publiée.';

-- ============================================================
-- 3. Espace élève
-- ============================================================
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
      CASE WHEN g.is_validated THEN g.comment END   AS comment,
      CASE WHEN g.is_validated THEN g.details END   AS details,
      COALESCE(g.status, 'noted') AS status,
      (COALESCE(a.subject_path, se.subject_path) IS NOT NULL)       AS has_subject,
      (COALESCE(a.correction_path, se.correction_path) IS NOT NULL) AS has_correction,
      -- Activité numérique : la copie corrigée de l'élève est consultable (migration 047).
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
$function$;
