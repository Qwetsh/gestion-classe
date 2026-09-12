-- ============================================================
-- Migration 036 : Choix du bonus par l'enseignant (RPC)
-- ============================================================
-- Jusqu'ici, seul l'élève pouvait choisir son bonus, via l'espace élève
-- (select_student_bonus, par code). Or l'onglet Tampons y est désactivé par
-- défaut : dans une classe sans cet onglet, un élève à 10/10 ne pouvait jamais
-- choisir, et le mobile refusait tout nouveau tampon (« Carte déjà complète »).
--
-- Même logique que select_student_bonus, mais authentifié enseignant
-- (SECURITY INVOKER, la RLS s'applique) : carte complète sans bonus la plus
-- récente → terminée, sélection enregistrée, carte suivante créée.
-- ============================================================

CREATE OR REPLACE FUNCTION select_bonus_for_student(p_student_id UUID, p_bonus_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_card_id UUID;
  v_card_number INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Non authentifié');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students WHERE id = p_student_id AND user_id = v_user_id AND is_deleted = false
  ) THEN
    RETURN json_build_object('error', 'Élève introuvable');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM bonuses WHERE id = p_bonus_id AND user_id = v_user_id AND is_active = true
  ) THEN
    RETURN json_build_object('error', 'Bonus invalide');
  END IF;

  -- Une opération à la fois par élève (même verrou que award_stamp)
  PERFORM pg_advisory_xact_lock(hashtext(p_student_id::text));

  SELECT sc.id, sc.card_number INTO v_card_id, v_card_number
  FROM stamp_cards sc
  WHERE sc.student_id = p_student_id
    AND NOT EXISTS (SELECT 1 FROM bonus_selections bs WHERE bs.card_id = sc.id)
    AND (SELECT COUNT(*) FROM stamps st WHERE st.card_id = sc.id) >= 10
  ORDER BY sc.card_number DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN json_build_object('error', 'Aucune carte complète en attente de bonus');
  END IF;

  UPDATE stamp_cards SET status = 'completed', completed_at = NOW()
  WHERE id = v_card_id;

  INSERT INTO bonus_selections (student_id, user_id, card_id, bonus_id, selected_at)
  VALUES (p_student_id, v_user_id, v_card_id, p_bonus_id, NOW());

  INSERT INTO stamp_cards (student_id, user_id, card_number, status)
  VALUES (p_student_id, v_user_id, v_card_number + 1, 'active')
  ON CONFLICT (student_id, card_number) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'completed_card_number', v_card_number,
    'new_card_number', v_card_number + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION select_bonus_for_student(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION select_bonus_for_student(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION select_bonus_for_student(UUID, UUID) IS
  'Enseignant : enregistre le bonus choisi pour la carte complète d''un élève et ouvre la carte suivante.';
