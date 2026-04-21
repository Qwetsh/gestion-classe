-- Fix get_student_academy RPC: restore class_id and test_completed fields
-- that were lost during the house rename migration (016)

CREATE OR REPLACE FUNCTION get_student_academy(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_enabled BOOLEAN;
  v_test_completed BOOLEAN;
  v_house TEXT;
  v_house_points JSONB;
BEGIN
  SELECT s.id, s.class_id INTO v_student_id, v_class_id
  FROM students s WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    -- Fallback: try access_code column
    SELECT s.id, s.class_id INTO v_student_id, v_class_id
    FROM students s WHERE s.access_code = p_code;
  END IF;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  SELECT ac.enabled INTO v_enabled
  FROM academy_config ac WHERE ac.class_id = v_class_id;

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
