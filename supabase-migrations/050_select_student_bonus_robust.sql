-- ============================================================
-- 050 — Espace élève : choix du bonus robuste (audit n°2 du 10/10/2026, B4)
-- ============================================================
-- Avant : la carte était prise par `status = 'active' LIMIT 1` sans ORDER BY (indéterminé dès qu'un
-- élève a deux cartes actives, ex. carte n+1 déjà poussée par le mobile), et la carte suivante était
-- insérée sans ON CONFLICT (plantage si elle existe déjà). Même logique que select_bonus_for_student
-- (migration 036) : verrou par élève, carte complète sans bonus la plus récente, création idempotente.
-- Signature inchangée (p_code, p_bonus_id, p_student_id DEFAULT NULL) + resolve_student_code, comme en prod.

CREATE OR REPLACE FUNCTION public.select_student_bonus(p_code character varying, p_bonus_id uuid, p_student_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_card_id UUID;
  v_card_number INTEGER;
BEGIN
  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;
  SELECT user_id INTO v_user_id FROM students WHERE id = v_student_id;

  IF NOT EXISTS (SELECT 1 FROM bonuses WHERE id = p_bonus_id AND user_id = v_user_id AND is_active = true) THEN
    RETURN json_build_object('error', 'Bonus invalide');
  END IF;

  -- Un seul choix à la fois par élève (l'enseignant peut valider depuis le web au même moment).
  PERFORM pg_advisory_xact_lock(hashtext(v_student_id::text));

  -- La carte complète la plus récente qui n'a pas encore de bonus (active ou déjà passée en completed).
  SELECT sc.id, sc.card_number INTO v_card_id, v_card_number
  FROM stamp_cards sc
  WHERE sc.student_id = v_student_id
    AND NOT EXISTS (SELECT 1 FROM bonus_selections bs WHERE bs.card_id = sc.id)
    AND (SELECT COUNT(*) FROM stamps st WHERE st.card_id = sc.id) >= 10
  ORDER BY sc.card_number DESC
  LIMIT 1;

  IF v_card_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM stamp_cards sc WHERE sc.student_id = v_student_id AND sc.status = 'active') THEN
      RETURN json_build_object('error', 'Carte non complète');
    END IF;
    RETURN json_build_object('error', 'Aucune carte active');
  END IF;

  UPDATE stamp_cards SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), synced_at = NULL
  WHERE id = v_card_id;

  INSERT INTO bonus_selections (student_id, user_id, card_id, bonus_id, selected_at)
  VALUES (v_student_id, v_user_id, v_card_id, p_bonus_id, NOW());

  -- Carte suivante : idempotent, le mobile ou le web peuvent l'avoir déjà créée.
  INSERT INTO stamp_cards (student_id, user_id, card_number, status)
  VALUES (v_student_id, v_user_id, v_card_number + 1, 'active')
  ON CONFLICT (student_id, card_number) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'completed_card_number', v_card_number,
    'new_card_number', v_card_number + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.select_student_bonus(character varying, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.select_student_bonus(character varying, uuid, uuid) TO anon, authenticated;
