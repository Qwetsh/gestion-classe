-- Migration 040 : les eleves voient leurs notes
-- Description : ouvre le carnet de notes a l'espace eleve, sous double condition.
--   1. Le prof active l'onglet "Notes" pour la classe (class_student_tabs.show_grades).
--   2. Le prof publie l'evaluation (written_assessments.published_to_students).
--
--   Deux verrous plutot qu'un : le reglage de classe ouvre le principe, la publication
--   par evaluation decide du moment. Sans le second, une note deviendrait visible a la
--   seconde ou elle est tapee, en pleine correction.
--
--   La moyenne de classe n'est PAS exposee a l'eleve : elle obligerait a redire en SQL
--   la regle "absent != zero" qui vit dans lib/gradeStats.ts, et rien ne garantirait que
--   les deux restent d'accord. L'eleve voit ses notes, pas celles des autres.
-- Conventions : SECURITY DEFINER + validation du code a 6 chiffres (cf. migration 031).

-- ============================================================
-- 1. Reglage par classe : l'onglet Notes de l'espace eleve
-- ============================================================
ALTER TABLE public.class_student_tabs
  ADD COLUMN IF NOT EXISTS show_grades BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.class_student_tabs.show_grades IS
  'Onglet "Mes notes" de l''espace eleve. FALSE par defaut : ouvrir les notes aux eleves est une decision explicite.';

-- ============================================================
-- 2. Publication d'une evaluation
-- ============================================================
ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS published_to_students BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.written_assessments.published_to_students IS
  'TRUE : les eleves de la classe voient leur note, le sujet et le corrige. FALSE par defaut, le temps de corriger.';

CREATE INDEX IF NOT EXISTS idx_wa_published
  ON public.written_assessments(class_id, published_to_students)
  WHERE published_to_students;

-- ============================================================
-- 3. RPC : les notes d'un eleve
--    Renvoie les lignes brutes ; les moyennes sont calculees cote client par
--    lib/gradeStats.ts, pour que la regle des statuts n'existe qu'a un seul endroit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_grades(p_code text)
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

  SELECT s.id, s.class_id, s.pseudo, COALESCE(s.is_witness, false)
  INTO v_student_id, v_class_id, v_pseudo, v_is_witness
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

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
      (COALESCE(a.correction_path, se.correction_path) IS NOT NULL) AS has_correction
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

REVOKE ALL ON FUNCTION public.get_student_grades(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_student_grades(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_student_grades(text) IS
  'Notes d''un eleve identifie par son code a 6 chiffres. N''expose que ses propres notes, et seulement des evaluations publiees d''une classe dont l''onglet Notes est actif.';
