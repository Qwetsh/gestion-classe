-- Fix submit_academy_test: use student_code instead of access_code
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
  FROM students s WHERE s.student_code = p_code;
  IF v_student_id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM academy_config ac
    WHERE ac.class_id = v_class_id AND ac.enabled = true
  ) THEN
    RETURN jsonb_build_object('error', 'module_not_enabled');
  END IF;

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
