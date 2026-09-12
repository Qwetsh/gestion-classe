-- ============================================================
-- Migration 034 : Attribution d'un tampon en une transaction (RPC)
-- ============================================================
-- Objectif : que le web (et le mobile quand il est en ligne) n'aient plus à
-- choisir eux-mêmes la carte active et l'emplacement en plusieurs requêtes.
-- Avant : slot = nombre de tampons + 1 (échec « duplicate key » dès qu'un
-- tampon avait été retiré au milieu), et deux attributions simultanées
-- pouvaient créer deux cartes actives pour le même élève.
--
-- Règles : carte active la plus récente (créée si absente), premier emplacement
-- libre, une attribution à la fois par élève (verrou transactionnel).
-- SECURITY INVOKER : la RLS s'applique (le prof n'écrit que chez lui).
-- ============================================================

CREATE OR REPLACE FUNCTION award_stamp(p_student_id UUID, p_category_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_card_id UUID;
  v_card_number INTEGER;
  v_slot INTEGER;
  v_count INTEGER;
  v_stamp_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Non authentifié');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id AND user_id = v_user_id AND is_deleted = false
  ) THEN
    RETURN json_build_object('error', 'Élève introuvable');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stamp_categories
    WHERE id = p_category_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('error', 'Catégorie introuvable');
  END IF;

  -- Une attribution à la fois par élève (libéré à la fin de la transaction)
  PERFORM pg_advisory_xact_lock(hashtext(p_student_id::text));

  -- Carte active la plus récente
  SELECT id, card_number INTO v_card_id, v_card_number
  FROM stamp_cards
  WHERE student_id = p_student_id AND status = 'active'
  ORDER BY card_number DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    SELECT COALESCE(MAX(card_number), 0) + 1 INTO v_card_number
    FROM stamp_cards WHERE student_id = p_student_id;

    INSERT INTO stamp_cards (student_id, user_id, card_number, status)
    VALUES (p_student_id, v_user_id, v_card_number, 'active')
    RETURNING id INTO v_card_id;
  END IF;

  -- Premier emplacement libre (comble les trous laissés par un retrait)
  SELECT MIN(s) INTO v_slot
  FROM generate_series(1, 10) AS s
  WHERE NOT EXISTS (
    SELECT 1 FROM stamps WHERE card_id = v_card_id AND slot_number = s
  );

  IF v_slot IS NULL THEN
    RETURN json_build_object('error', 'Carte déjà complète — l''élève doit d''abord choisir son bonus');
  END IF;

  INSERT INTO stamps (card_id, student_id, user_id, category_id, slot_number)
  VALUES (v_card_id, p_student_id, v_user_id, p_category_id, v_slot)
  RETURNING id INTO v_stamp_id;

  SELECT COUNT(*) INTO v_count FROM stamps WHERE card_id = v_card_id;

  RETURN json_build_object(
    'success', true,
    'stamp_id', v_stamp_id,
    'card_id', v_card_id,
    'card_number', v_card_number,
    'slot_number', v_slot,
    'stamp_count', v_count,
    'card_complete', v_count >= 10
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION award_stamp(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION award_stamp(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION award_stamp(UUID, UUID) IS
  'Attribue un tampon à un élève : carte active la plus récente (créée si besoin), premier emplacement libre, sous verrou par élève.';
