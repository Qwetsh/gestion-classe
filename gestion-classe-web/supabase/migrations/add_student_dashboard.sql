-- ============================================================
-- Migration: Student Dashboard (accès élève par code 6 chiffres)
-- ============================================================

-- 1. Ajouter la colonne student_code sur students
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_code varchar(6) UNIQUE;

-- 2. Générer des codes pour les élèves existants
UPDATE students
SET student_code = LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0')
WHERE student_code IS NULL;

-- S'assurer de l'unicité (re-générer en cas de collision)
DO $$
DECLARE
  v_conflict RECORD;
BEGIN
  LOOP
    SELECT student_code, COUNT(*) as cnt INTO v_conflict
    FROM students
    GROUP BY student_code
    HAVING COUNT(*) > 1
    LIMIT 1;

    EXIT WHEN NOT FOUND;

    UPDATE students
    SET student_code = LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0')
    WHERE id IN (
      SELECT id FROM students WHERE student_code = v_conflict.student_code
      OFFSET 1
    );
  END LOOP;
END $$;

-- 3. Trigger pour auto-générer un code à l'insertion
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_code varchar(6);
BEGIN
  IF NEW.student_code IS NULL THEN
    LOOP
      v_code := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE student_code = v_code);
    END LOOP;
    NEW.student_code := v_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_student_code ON students;
CREATE TRIGGER trg_generate_student_code
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION generate_student_code();

-- 4. Fonction RPC pour le dashboard élève (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION get_student_dashboard(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_pseudo text;
  v_class_id uuid;
  v_user_id uuid;
  v_class_name text;
  v_trimester int;
  v_school_year text;
  v_trim_start timestamptz;
  v_result json;
BEGIN
  -- Validate code format
  IF p_code IS NULL OR LENGTH(p_code) != 6 OR p_code !~ '^\d{6}$' THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  -- Find student by code
  SELECT s.id, s.pseudo, s.class_id, s.user_id, c.name
  INTO v_student_id, v_pseudo, v_class_id, v_user_id, v_class_name
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  -- Get trimester settings
  SELECT current_trimester, school_year
  INTO v_trimester, v_school_year
  FROM trimester_settings
  WHERE user_id = v_user_id;

  IF v_trimester IS NULL THEN
    v_trimester := 1;
    v_school_year := CASE
      WHEN EXTRACT(MONTH FROM NOW()) >= 9 THEN
        EXTRACT(YEAR FROM NOW())::text || '-' || (EXTRACT(YEAR FROM NOW()) + 1)::text
      ELSE
        (EXTRACT(YEAR FROM NOW()) - 1)::text || '-' || EXTRACT(YEAR FROM NOW())::text
    END;
  END IF;

  -- Get trimester start date
  SELECT started_at INTO v_trim_start
  FROM trimester_boundaries
  WHERE user_id = v_user_id
    AND trimester = v_trimester
    AND school_year = v_school_year;

  -- Build everything with CTEs
  WITH student_events AS (
    SELECT
      e.student_id,
      COUNT(*) FILTER (WHERE e.type = 'participation') as participations,
      COUNT(*) FILTER (WHERE e.type = 'bavardage') as bavardages,
      COUNT(*) FILTER (WHERE e.type = 'absence') as absences
    FROM events e
    JOIN students st ON st.id = e.student_id
    WHERE st.user_id = v_user_id
      AND (v_trim_start IS NULL OR e.timestamp >= v_trim_start::text)
    GROUP BY e.student_id
  ),
  student_manual AS (
    SELECT student_id, COALESCE(SUM(count), 0)::int as manual_count
    FROM manual_participations
    WHERE student_id IN (SELECT id FROM students WHERE user_id = v_user_id)
      AND trimester = v_trimester
      AND school_year = v_school_year
    GROUP BY student_id
  ),
  all_students AS (
    SELECT
      s.id,
      s.class_id,
      COALESCE(se.participations, 0)::int as participations,
      COALESCE(se.bavardages, 0)::int as bavardages,
      COALESCE(se.absences, 0)::int as absences,
      COALESCE(sm.manual_count, 0)::int as manual_participations,
      COALESCE(cfg.target_participations, 15)::int as target,
      COALESCE(cfg.total_sessions_expected, 60)::int as sessions_expected,
      COALESCE(cfg.bavardage_penalty, false) as bav_penalty,
      cfg.base_grade
    FROM students s
    LEFT JOIN student_events se ON se.student_id = s.id
    LEFT JOIN student_manual sm ON sm.student_id = s.id
    LEFT JOIN class_trimester_config cfg ON cfg.class_id = s.class_id
    WHERE s.user_id = v_user_id
  ),
  graded_students AS (
    SELECT
      id,
      class_id,
      participations,
      bavardages,
      absences,
      manual_participations,
      target,
      CASE
        WHEN base_grade IS NOT NULL AND base_grade > 0 THEN
          LEAST(20, GREATEST(0,
            base_grade + (participations + manual_participations) -
            CASE WHEN bav_penalty THEN bavardages ELSE 0 END
          ))
        ELSE
          LEAST(20, GREATEST(0,
            (GREATEST(0, (participations + manual_participations) - CASE WHEN bav_penalty THEN bavardages ELSE 0 END)::numeric /
            GREATEST(1, target - (absences * (target::numeric / sessions_expected)))
            ) * 20
          ))
      END as grade
    FROM all_students
  ),
  class_ranked AS (
    SELECT
      id,
      grade,
      RANK() OVER (ORDER BY grade DESC) as rank,
      COUNT(*) OVER () as total
    FROM graded_students
    WHERE class_id = v_class_id
  ),
  overall_ranked AS (
    SELECT
      id,
      grade,
      RANK() OVER (ORDER BY grade DESC) as rank,
      COUNT(*) OVER () as total
    FROM graded_students
  )
  SELECT json_build_object(
    'pseudo', v_pseudo,
    'class_name', v_class_name,
    'trimester', v_trimester,
    'school_year', v_school_year,
    'grade', ROUND(COALESCE((SELECT grade FROM graded_students WHERE id = v_student_id), 0), 1),
    'participations', COALESCE((SELECT participations + manual_participations FROM graded_students WHERE id = v_student_id), 0),
    'bavardages', COALESCE((SELECT bavardages FROM graded_students WHERE id = v_student_id), 0),
    'absences', COALESCE((SELECT absences FROM graded_students WHERE id = v_student_id), 0),
    'target', COALESCE((SELECT target FROM graded_students WHERE id = v_student_id), 15),
    'class_rank', COALESCE((SELECT rank FROM class_ranked WHERE id = v_student_id), 0),
    'class_total', COALESCE((SELECT total FROM class_ranked LIMIT 1), 0),
    'overall_rank', COALESCE((SELECT rank FROM overall_ranked WHERE id = v_student_id), 0),
    'overall_total', COALESCE((SELECT total FROM overall_ranked LIMIT 1), 0),
    'top10_class', COALESCE(
      (SELECT json_agg(json_build_object('rank', rank, 'grade', ROUND(grade, 1)))
       FROM (SELECT rank, grade FROM class_ranked ORDER BY rank LIMIT 10) t),
      '[]'::json
    ),
    'top10_overall', COALESCE(
      (SELECT json_agg(json_build_object('rank', rank, 'grade', ROUND(grade, 1)))
       FROM (SELECT rank, grade FROM overall_ranked ORDER BY rank LIMIT 10) t),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 5. Permettre l'appel anonyme de la fonction RPC
GRANT EXECUTE ON FUNCTION get_student_dashboard(text) TO anon;
