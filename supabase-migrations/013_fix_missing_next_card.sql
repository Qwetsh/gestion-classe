-- ============================================
-- Fix: auto-create next card when all cards are completed with bonus
-- This handles the case where mobile completes a card + selects bonus
-- but never calls the RPC (which is the only thing that creates the next card).
-- ============================================

-- Step 1: One-time data fix — create missing active cards for students
-- who have completed cards with bonuses but no active card.
-- Uses MAX of ALL card_numbers (not just completed) to avoid conflicts.
INSERT INTO stamp_cards (student_id, user_id, card_number, status)
SELECT
  sub.student_id,
  sub.user_id,
  sub.max_card_number + 1,
  'active'
FROM (
  SELECT sc.student_id, sc.user_id, MAX(sc.card_number) AS max_card_number
  FROM stamp_cards sc
  WHERE NOT EXISTS (
    SELECT 1 FROM stamp_cards sc2
    WHERE sc2.student_id = sc.student_id AND sc2.status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM stamp_cards sc3
    INNER JOIN bonus_selections bs ON bs.card_id = sc3.id
    WHERE sc3.student_id = sc.student_id AND sc3.status = 'completed'
  )
  GROUP BY sc.student_id, sc.user_id
) sub
ON CONFLICT (student_id, card_number) DO NOTHING;

-- Step 2: Update get_student_stamps RPC to auto-create next card on the fly
CREATE OR REPLACE FUNCTION get_student_stamps(p_code VARCHAR(6))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_result JSON;
  v_has_active BOOLEAN;
  v_max_card_number INTEGER;
BEGIN
  SELECT id, user_id INTO v_student_id, v_user_id
  FROM students
  WHERE student_code = p_code AND is_deleted = false;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;

  -- Check if student has an active card (or completed-without-bonus)
  SELECT EXISTS(
    SELECT 1 FROM stamp_cards sc
    WHERE sc.student_id = v_student_id
      AND (
        sc.status = 'active'
        OR (sc.status = 'completed' AND NOT EXISTS (
          SELECT 1 FROM bonus_selections bs WHERE bs.card_id = sc.id
        ))
      )
  ) INTO v_has_active;

  -- If no active card, auto-create next card from highest card_number (any status)
  IF NOT v_has_active THEN
    SELECT MAX(sc.card_number) INTO v_max_card_number
    FROM stamp_cards sc
    WHERE sc.student_id = v_student_id;

    IF v_max_card_number IS NOT NULL THEN
      INSERT INTO stamp_cards (student_id, user_id, card_number, status)
      VALUES (v_student_id, v_user_id, v_max_card_number + 1, 'active')
      ON CONFLICT (student_id, card_number) DO NOTHING;
    END IF;
  END IF;

  -- Now build the result
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
          'bonus_label', COALESCE(b.label, 'Bonus supprimé'),
          'bonus_used', bs.used_at IS NOT NULL,
          'selected_at', bs.selected_at,
          'used_at', bs.used_at
        ) ORDER BY sc.card_number DESC
      )
      FROM stamp_cards sc
      INNER JOIN bonus_selections bs ON bs.card_id = sc.id
      LEFT JOIN bonuses b ON b.id = bs.bonus_id
      WHERE sc.student_id = v_student_id
        AND sc.status = 'completed'
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
