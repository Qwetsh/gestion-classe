-- ============================================
-- Fix: revert prematurely completed cards back to 'active'
-- Cards that were marked 'completed' by mobile without a bonus selection
-- should stay 'active' until the student picks a bonus via RPC.
-- ============================================

UPDATE stamp_cards
SET status = 'active', completed_at = NULL, synced_at = NULL
WHERE status = 'completed'
  AND id NOT IN (SELECT card_id FROM bonus_selections);

-- ============================================
-- Update get_student_stamps RPC: belt-and-suspenders
-- If no active card, also look for a completed card without bonus
-- (handles edge case where mobile still pushes 'completed' before RPC fix deploys)
-- ============================================

CREATE OR REPLACE FUNCTION get_student_stamps(p_code VARCHAR(6))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_result JSON;
BEGIN
  SELECT id, user_id INTO v_student_id, v_user_id
  FROM students
  WHERE student_code = p_code AND is_deleted = false;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;

  SELECT json_build_object(
    'student_id', v_student_id,
    'active_card', (
      SELECT json_build_object(
        'id', sc.id,
        'card_number', sc.card_number,
        'status', sc.status,
        'created_at', sc.created_at,
        'stamps', COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', s.id,
              'slot_number', s.slot_number,
              'category_label', cat.label,
              'category_icon', cat.icon,
              'category_color', cat.color,
              'awarded_at', s.awarded_at
            ) ORDER BY s.slot_number
          )
          FROM stamps s
          LEFT JOIN stamp_categories cat ON cat.id = s.category_id
          WHERE s.card_id = sc.id
        ), '[]'::json),
        'stamp_count', (SELECT COUNT(*) FROM stamps WHERE card_id = sc.id)
      )
      FROM stamp_cards sc
      WHERE sc.student_id = v_student_id
        AND (
          sc.status = 'active'
          OR (sc.status = 'completed' AND NOT EXISTS (
            SELECT 1 FROM bonus_selections bs WHERE bs.card_id = sc.id
          ))
        )
      ORDER BY sc.status ASC  -- 'active' sorts before 'completed'
      LIMIT 1
    ),
    'completed_cards', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', sc.id,
          'card_number', sc.card_number,
          'completed_at', sc.completed_at,
          'bonus_label', b.label,
          'bonus_used', bs.used_at IS NOT NULL,
          'selected_at', bs.selected_at,
          'used_at', bs.used_at
        ) ORDER BY sc.card_number DESC
      )
      FROM stamp_cards sc
      LEFT JOIN bonus_selections bs ON bs.card_id = sc.id
      LEFT JOIN bonuses b ON b.id = bs.bonus_id
      WHERE sc.student_id = v_student_id
        AND sc.status = 'completed'
        AND EXISTS (SELECT 1 FROM bonus_selections bs2 WHERE bs2.card_id = sc.id)
    ), '[]'::json),
    'categories', COALESCE((
      SELECT json_agg(
        json_build_object(
          'label', cat.label,
          'icon', cat.icon,
          'color', cat.color
        ) ORDER BY cat.display_order
      )
      FROM stamp_categories cat
      WHERE cat.user_id = v_user_id AND cat.is_active = true
    ), '[]'::json),
    'available_bonuses', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', b.id,
          'label', b.label
        ) ORDER BY b.display_order
      )
      FROM bonuses b
      WHERE b.user_id = v_user_id AND b.is_active = true
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================
-- Update select_student_bonus RPC:
-- Accept both 'active' and 'completed' cards (without existing bonus)
-- ============================================

CREATE OR REPLACE FUNCTION select_student_bonus(p_code VARCHAR(6), p_bonus_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_card_id UUID;
  v_card_number INTEGER;
  v_stamp_count INTEGER;
  v_existing_selection UUID;
BEGIN
  SELECT id, user_id INTO v_student_id, v_user_id
  FROM students
  WHERE student_code = p_code AND is_deleted = false;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;

  -- Find card with 10 stamps and no bonus yet (active OR completed-without-bonus)
  SELECT sc.id, sc.card_number INTO v_card_id, v_card_number
  FROM stamp_cards sc
  WHERE sc.student_id = v_student_id
    AND NOT EXISTS (SELECT 1 FROM bonus_selections bs WHERE bs.card_id = sc.id)
    AND (SELECT COUNT(*) FROM stamps st WHERE st.card_id = sc.id) >= 10
  ORDER BY sc.card_number DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN json_build_object('error', 'Aucune carte complète en attente de bonus');
  END IF;

  -- Verify bonus is valid and active
  IF NOT EXISTS (SELECT 1 FROM bonuses WHERE id = p_bonus_id AND user_id = v_user_id AND is_active = true) THEN
    RETURN json_build_object('error', 'Bonus invalide');
  END IF;

  -- Mark card as completed + record bonus + create next card
  UPDATE stamp_cards SET status = 'completed', completed_at = NOW(), synced_at = NULL
  WHERE id = v_card_id;

  INSERT INTO bonus_selections (student_id, user_id, card_id, bonus_id, selected_at)
  VALUES (v_student_id, v_user_id, v_card_id, p_bonus_id, NOW());

  INSERT INTO stamp_cards (student_id, user_id, card_number, status)
  VALUES (v_student_id, v_user_id, v_card_number + 1, 'active');

  RETURN json_build_object(
    'success', true,
    'new_card_number', v_card_number + 1
  );
END;
$$;
