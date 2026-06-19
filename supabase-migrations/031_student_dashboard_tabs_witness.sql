-- ============================================================
-- Migration 031 : RPC élève — onglets pilotés, témoin, log connexions
-- ============================================================
-- Dépend de la migration 030 (is_witness, class_student_tabs, student_connections).
--
-- get_student_dashboard :
--   - renvoie tabs { stamps, annales } (config classe, défaut false ; forcé true si témoin)
--   - renvoie is_witness
--   - exclut le témoin des 3 CTE de classement (class_ranked, overall_ranked, class_averages)
--     tout en le gardant dans graded_students (sa propre note reste affichée)
--   - logge la connexion dans student_connections (dédup 30 min, jamais pour un témoin)
--
-- get_student_academy :
--   - enabled = true si l'élève est témoin (pour qu'il voie l'onglet Maison)
-- ============================================================

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
  v_is_witness boolean;
  v_show_stamps boolean;
  v_show_annales boolean;
  v_result json;
BEGIN
  -- Validate code format
  IF p_code IS NULL OR LENGTH(p_code) != 6 OR p_code !~ '^\d{6}$' THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  -- Find student by code
  SELECT s.id, s.pseudo, s.class_id, s.user_id, c.name, s.is_witness
  INTO v_student_id, v_pseudo, v_class_id, v_user_id, v_class_name, v_is_witness
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  -- Résoudre la visibilité des onglets (par classe ; défaut OFF).
  SELECT cst.show_stamps, cst.show_annales
  INTO v_show_stamps, v_show_annales
  FROM class_student_tabs cst
  WHERE cst.class_id = v_class_id;

  v_show_stamps := COALESCE(v_show_stamps, false);
  v_show_annales := COALESCE(v_show_annales, false);

  -- Le témoin voit tout (preview "en conditions réelles").
  IF v_is_witness THEN
    v_show_stamps := true;
    v_show_annales := true;
  END IF;

  -- Journal de connexion (dédup 30 min). Jamais pour un témoin (hors métrique).
  IF NOT v_is_witness THEN
    IF NOT EXISTS (
      SELECT 1 FROM student_connections
      WHERE student_id = v_student_id
        AND connected_at > NOW() - INTERVAL '30 minutes'
    ) THEN
      INSERT INTO student_connections (student_id) VALUES (v_student_id);
    END IF;
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
      AND (v_trim_start IS NULL OR e.timestamp >= v_trim_start)
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
      s.is_witness,
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
      is_witness,
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
      END as grade,
      -- Raw score without cap for ranking: allows sorting beyond 20/20
      CASE
        WHEN base_grade IS NOT NULL AND base_grade > 0 THEN
          GREATEST(0,
            base_grade + (participations + manual_participations) -
            CASE WHEN bav_penalty THEN bavardages ELSE 0 END
          )
        ELSE
          GREATEST(0,
            (GREATEST(0, (participations + manual_participations) - CASE WHEN bav_penalty THEN bavardages ELSE 0 END)::numeric /
            GREATEST(1, target - (absences * (target::numeric / sessions_expected)))
            ) * 20
          )
      END as raw_score
    FROM all_students
  ),
  class_ranked AS (
    SELECT
      id,
      grade,
      RANK() OVER (ORDER BY raw_score DESC, (participations + manual_participations)::numeric / GREATEST(1, bavardages) DESC) as rank,
      COUNT(*) OVER () as total
    FROM graded_students
    WHERE class_id = v_class_id
      AND NOT is_witness
  ),
  overall_ranked AS (
    SELECT
      id,
      grade,
      RANK() OVER (ORDER BY raw_score DESC, (participations + manual_participations)::numeric / GREATEST(1, bavardages) DESC) as rank,
      COUNT(*) OVER () as total
    FROM graded_students
    WHERE NOT is_witness
  ),
  class_averages AS (
    SELECT
      gs.class_id,
      c.name as class_name,
      ROUND(AVG(gs.grade), 1) as avg_grade,
      COUNT(*) as student_count
    FROM graded_students gs
    JOIN classes c ON c.id = gs.class_id
    WHERE NOT gs.is_witness
    GROUP BY gs.class_id, c.name
  ),
  classes_ranked AS (
    SELECT
      class_id,
      class_name,
      avg_grade,
      student_count,
      RANK() OVER (ORDER BY avg_grade DESC) as rank,
      COUNT(*) OVER () as total
    FROM class_averages
  )
  SELECT json_build_object(
    'pseudo', v_pseudo,
    'class_name', v_class_name,
    'trimester', v_trimester,
    'school_year', v_school_year,
    'is_witness', v_is_witness,
    'tabs', json_build_object('stamps', v_show_stamps, 'annales', v_show_annales),
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
    ),
    'my_class_rank_among_classes', COALESCE((SELECT rank FROM classes_ranked WHERE class_id = v_class_id), 0),
    'total_classes', COALESCE((SELECT total FROM classes_ranked LIMIT 1), 0),
    'my_class_avg', COALESCE((SELECT avg_grade FROM classes_ranked WHERE class_id = v_class_id), 0),
    'all_classes_ranking', COALESCE(
      (SELECT json_agg(json_build_object('rank', rank, 'class_name', class_name, 'avg_grade', avg_grade, 'student_count', student_count))
       FROM (SELECT rank, class_name, avg_grade, student_count FROM classes_ranked ORDER BY rank) t),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_student_dashboard(text) TO anon;


-- ============================================================
-- get_student_academy : enabled = true si témoin
-- ============================================================
CREATE OR REPLACE FUNCTION get_student_academy(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_is_witness BOOLEAN;
  v_enabled BOOLEAN;
  v_test_completed BOOLEAN;
  v_house TEXT;
  v_house_points JSONB;
BEGIN
  SELECT s.id, s.class_id, s.is_witness INTO v_student_id, v_class_id, v_is_witness
  FROM students s WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    -- Fallback: try access_code column
    SELECT s.id, s.class_id, s.is_witness INTO v_student_id, v_class_id, v_is_witness
    FROM students s WHERE s.access_code = p_code;
  END IF;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  SELECT ac.enabled INTO v_enabled
  FROM academy_config ac WHERE ac.class_id = v_class_id;

  -- Le témoin voit toujours l'onglet Maison (preview).
  IF v_is_witness THEN
    v_enabled := true;
  END IF;

  IF v_enabled IS NULL OR v_enabled = false THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM academy_responses WHERE student_id = v_student_id LIMIT 1
  ) INTO v_test_completed;

  SELECT aa.house INTO v_house
  FROM academy_assignments aa
  WHERE aa.student_id = v_student_id AND aa.class_id = v_class_id;

  SELECT jsonb_object_agg(h, COALESCE(pts, 0)) INTO v_house_points
  FROM (VALUES ('gryffondor'), ('serpentard'), ('serdaigle'), ('poufsouffle')) AS houses(h)
  LEFT JOIN (
    SELECT ahb.house, SUM(ahb.points) AS pts
    FROM academy_house_bonuses ahb
    WHERE ahb.class_id = v_class_id AND ahb.visible = true
    GROUP BY ahb.house
  ) b ON b.house = houses.h;

  RETURN jsonb_build_object(
    'enabled', true,
    'student_id', v_student_id,
    'class_id', v_class_id,
    'test_completed', v_test_completed,
    'house', v_house,
    'house_points', COALESCE(v_house_points, '{}'::jsonb)
  );
END;
$$;
