-- Rename internal house IDs to official HP names
-- salamandre → gryffondor, vouivre → serpentard, zephyr → serdaigle, taisson → poufsouffle

-- 1. Rename weight columns in academy_answers
ALTER TABLE academy_answers RENAME COLUMN salamandre_weight TO gryffondor_weight;
ALTER TABLE academy_answers RENAME COLUMN vouivre_weight TO serpentard_weight;
ALTER TABLE academy_answers RENAME COLUMN zephyr_weight TO serdaigle_weight;
ALTER TABLE academy_answers RENAME COLUMN taisson_weight TO poufsouffle_weight;

-- 2. Update house values in academy_preferences
ALTER TABLE academy_preferences DROP CONSTRAINT IF EXISTS academy_preferences_house_check;
UPDATE academy_preferences SET house = CASE house
  WHEN 'salamandre' THEN 'gryffondor'
  WHEN 'vouivre' THEN 'serpentard'
  WHEN 'zephyr' THEN 'serdaigle'
  WHEN 'taisson' THEN 'poufsouffle'
  ELSE house END;
ALTER TABLE academy_preferences ADD CONSTRAINT academy_preferences_house_check
  CHECK (house IN ('gryffondor', 'serpentard', 'serdaigle', 'poufsouffle'));

-- 3. Update house values in academy_assignments
ALTER TABLE academy_assignments DROP CONSTRAINT IF EXISTS academy_assignments_house_check;
UPDATE academy_assignments SET house = CASE house
  WHEN 'salamandre' THEN 'gryffondor'
  WHEN 'vouivre' THEN 'serpentard'
  WHEN 'zephyr' THEN 'serdaigle'
  WHEN 'taisson' THEN 'poufsouffle'
  ELSE house END;
ALTER TABLE academy_assignments ADD CONSTRAINT academy_assignments_house_check
  CHECK (house IN ('gryffondor', 'serpentard', 'serdaigle', 'poufsouffle'));

-- 4. Update house values in academy_house_bonuses
ALTER TABLE academy_house_bonuses DROP CONSTRAINT IF EXISTS academy_house_bonuses_house_check;
UPDATE academy_house_bonuses SET house = CASE house
  WHEN 'salamandre' THEN 'gryffondor'
  WHEN 'vouivre' THEN 'serpentard'
  WHEN 'zephyr' THEN 'serdaigle'
  WHEN 'taisson' THEN 'poufsouffle'
  ELSE house END;
ALTER TABLE academy_house_bonuses ADD CONSTRAINT academy_house_bonuses_house_check
  CHECK (house IN ('gryffondor', 'serpentard', 'serdaigle', 'poufsouffle'));

-- 5. Recreate RPC get_student_academy with new house names
CREATE OR REPLACE FUNCTION get_student_academy(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_enabled BOOLEAN;
  v_has_test BOOLEAN;
  v_assignment RECORD;
  v_house_points JSONB;
BEGIN
  SELECT s.id, s.class_id INTO v_student_id, v_class_id
  FROM students s WHERE s.access_code = p_code;
  IF v_student_id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  SELECT ac.enabled INTO v_enabled
  FROM academy_config ac WHERE ac.class_id = v_class_id;
  IF NOT COALESCE(v_enabled, false) THEN RETURN jsonb_build_object('enabled', false); END IF;

  SELECT EXISTS(SELECT 1 FROM academy_responses WHERE student_id = v_student_id) INTO v_has_test;

  SELECT * INTO v_assignment FROM academy_assignments WHERE student_id = v_student_id AND class_id = v_class_id;

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
    'has_test', v_has_test,
    'house', v_assignment.house,
    'assigned', v_assignment IS NOT NULL,
    'house_points', COALESCE(v_house_points, '{}'::jsonb)
  );
END;
$$;

-- 6. Recreate RPC submit_academy_test with new house names
CREATE OR REPLACE FUNCTION submit_academy_test(p_code TEXT, p_responses JSONB, p_preferences JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_resp JSONB;
  v_pref JSONB;
BEGIN
  SELECT s.id, s.class_id INTO v_student_id, v_class_id
  FROM students s WHERE s.access_code = p_code;
  IF v_student_id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF EXISTS(SELECT 1 FROM academy_responses WHERE student_id = v_student_id) THEN
    RETURN jsonb_build_object('error', 'already_submitted');
  END IF;

  FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responses) LOOP
    INSERT INTO academy_responses (student_id, question_id, answer_id)
    VALUES (v_student_id, (v_resp->>'question_id')::UUID, (v_resp->>'answer_id')::UUID);
  END LOOP;

  FOR v_pref IN SELECT * FROM jsonb_array_elements(p_preferences) LOOP
    INSERT INTO academy_preferences (student_id, house, rank)
    VALUES (v_student_id, v_pref->>'house', (v_pref->>'rank')::INTEGER);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;
