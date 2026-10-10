-- ============================================================
-- 048 — Récompenses : icônes de bibliothèque et icônes importées pour les catégories de tampons
-- ============================================================
-- `stamp_categories.icon` reste l'emoji (texte), toujours renseigné : c'est ce qu'affichent les anciens
-- clients (APK mobile déjà installé). `icon_ref` est l'icône « riche », optionnelle :
--   - `lucide:<Nom>`  : icône de la bibliothèque Lucide (même nom sur le web et sur mobile) ;
--   - `https://…`     : image importée par l'enseignant (bucket public `reward-icons`).
-- Les clients à jour affichent icon_ref si présent, sinon l'emoji.

ALTER TABLE public.stamp_categories ADD COLUMN IF NOT EXISTS icon_ref text;
COMMENT ON COLUMN public.stamp_categories.icon_ref IS
  'Icône riche optionnelle : « lucide:<Nom> » (bibliothèque Lucide) ou URL https d''une image importée. L''emoji `icon` reste le repli.';

-- Bucket public des icônes importées : petites images, rangées par enseignant (<user_id>/<uuid>.<ext>).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reward-icons', 'reward-icons', true, 524288, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "reward_icons_public_read" ON storage.objects;
CREATE POLICY "reward_icons_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'reward-icons');

DROP POLICY IF EXISTS "reward_icons_owner_insert" ON storage.objects;
CREATE POLICY "reward_icons_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reward-icons' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reward_icons_owner_update" ON storage.objects;
CREATE POLICY "reward_icons_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'reward-icons' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reward_icons_owner_delete" ON storage.objects;
CREATE POLICY "reward_icons_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reward-icons' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RPC élève : expose icon_ref sur les tampons et la légende des catégories.
-- Signature inchangée (p_code, p_student_id) + resolve_student_code, comme en production.
CREATE OR REPLACE FUNCTION public.get_student_stamps(p_code character varying, p_student_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_result JSON;
  v_has_active BOOLEAN;
  v_max_card_number INTEGER;
BEGIN
  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;
  SELECT user_id INTO v_user_id FROM students WHERE id = v_student_id;

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
              'category_icon_ref', cat.icon_ref,
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
      ORDER BY sc.status ASC
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
          'icon_ref', cat.icon_ref,
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
