-- Migration: Système de récompenses par carte à tampons
-- Description: Tables pour le système de tampons/récompenses élèves
-- (catégories de tampons, bonus, cartes, tampons individuels, choix de bonus)

-- ============================================
-- 1. Catégories de tampons (raisons d'attribution)
-- ============================================

CREATE TABLE IF NOT EXISTS stamp_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

ALTER TABLE stamp_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamp_categories"
  ON stamp_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stamp_categories"
  ON stamp_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stamp_categories"
  ON stamp_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stamp_categories"
  ON stamp_categories FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_stamp_categories_user_id ON stamp_categories(user_id);
CREATE INDEX idx_stamp_categories_active ON stamp_categories(user_id, is_active);

COMMENT ON TABLE stamp_categories IS 'Catégories de tampons configurables par enseignant (raisons pour lesquelles un élève gagne un tampon)';

-- ============================================
-- 2. Bonus (récompenses quand carte complète)
-- ============================================

CREATE TABLE IF NOT EXISTS bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonuses"
  ON bonuses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bonuses"
  ON bonuses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bonuses"
  ON bonuses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bonuses"
  ON bonuses FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_bonuses_user_id ON bonuses(user_id);
CREATE INDEX idx_bonuses_active ON bonuses(user_id, is_active);

COMMENT ON TABLE bonuses IS 'Bonus/récompenses disponibles quand un élève complète sa carte de 10 tampons';

-- ============================================
-- 3. Cartes à tampons (une carte = 10 emplacements)
-- ============================================

CREATE TABLE IF NOT EXISTS stamp_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(student_id, card_number)
);

ALTER TABLE stamp_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamp_cards"
  ON stamp_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stamp_cards"
  ON stamp_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stamp_cards"
  ON stamp_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stamp_cards"
  ON stamp_cards FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_stamp_cards_student_id ON stamp_cards(student_id);
CREATE INDEX idx_stamp_cards_user_id ON stamp_cards(user_id);
CREATE INDEX idx_stamp_cards_active ON stamp_cards(student_id, status);

COMMENT ON TABLE stamp_cards IS 'Cartes à tampons des élèves. Chaque carte a 10 emplacements. Quand complète, l''élève choisit un bonus.';

-- ============================================
-- 4. Tampons individuels (sur une carte)
-- ============================================

CREATE TABLE IF NOT EXISTS stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES stamp_cards(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES stamp_categories(id) ON DELETE SET NULL,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 10),
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  UNIQUE(card_id, slot_number)
);

ALTER TABLE stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stamps"
  ON stamps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stamps"
  ON stamps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stamps"
  ON stamps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stamps"
  ON stamps FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_stamps_card_id ON stamps(card_id);
CREATE INDEX idx_stamps_student_id ON stamps(student_id);
CREATE INDEX idx_stamps_category_id ON stamps(category_id);

COMMENT ON TABLE stamps IS 'Tampons individuels attribués sur une carte. Chaque tampon occupe un emplacement (1-10) et a une catégorie.';

-- ============================================
-- 5. Sélection de bonus (choix de l'élève)
-- ============================================

CREATE TABLE IF NOT EXISTS bonus_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES stamp_cards(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bonus_id UUID REFERENCES bonuses(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

ALTER TABLE bonus_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonus_selections"
  ON bonus_selections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bonus_selections"
  ON bonus_selections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bonus_selections"
  ON bonus_selections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bonus_selections"
  ON bonus_selections FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_bonus_selections_card_id ON bonus_selections(card_id);
CREATE INDEX idx_bonus_selections_student_id ON bonus_selections(student_id);
CREATE INDEX idx_bonus_selections_pending ON bonus_selections(user_id) WHERE used_at IS NULL;

COMMENT ON TABLE bonus_selections IS 'Choix de bonus par l''élève quand sa carte est complète. used_at NULL = en attente de validation par l''enseignant.';

-- ============================================
-- 6. RPC pour l'accès élève (SECURITY DEFINER)
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
  -- Trouver l'élève par son code
  SELECT id, user_id INTO v_student_id, v_user_id
  FROM students
  WHERE student_code = p_code AND is_deleted = false;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;

  -- Construire le résultat complet
  SELECT json_build_object(
    'student_id', v_student_id,
    -- Carte active
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
      WHERE sc.student_id = v_student_id AND sc.status = 'active'
      LIMIT 1
    ),
    -- Historique des cartes complétées
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
      WHERE sc.student_id = v_student_id AND sc.status = 'completed'
    ), '[]'::json),
    -- Catégories disponibles (pour la section "Comment gagner")
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
    -- Bonus disponibles (pour la sélection quand carte complète)
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

-- RPC pour que l'élève sélectionne son bonus
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
  -- Trouver l'élève
  SELECT id, user_id INTO v_student_id, v_user_id
  FROM students
  WHERE student_code = p_code AND is_deleted = false;

  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;

  -- Trouver la carte active complète
  SELECT sc.id, sc.card_number INTO v_card_id, v_card_number
  FROM stamp_cards sc
  WHERE sc.student_id = v_student_id AND sc.status = 'active'
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN json_build_object('error', 'Aucune carte active');
  END IF;

  -- Vérifier que la carte a bien 10 tampons
  SELECT COUNT(*) INTO v_stamp_count FROM stamps WHERE card_id = v_card_id;
  IF v_stamp_count < 10 THEN
    RETURN json_build_object('error', 'Carte non complète');
  END IF;

  -- Vérifier qu'aucun bonus n'a déjà été sélectionné
  SELECT id INTO v_existing_selection FROM bonus_selections WHERE card_id = v_card_id;
  IF v_existing_selection IS NOT NULL THEN
    RETURN json_build_object('error', 'Bonus déjà sélectionné pour cette carte');
  END IF;

  -- Vérifier que le bonus existe et est actif
  IF NOT EXISTS (SELECT 1 FROM bonuses WHERE id = p_bonus_id AND user_id = v_user_id AND is_active = true) THEN
    RETURN json_build_object('error', 'Bonus invalide');
  END IF;

  -- Marquer la carte comme complétée
  UPDATE stamp_cards SET status = 'completed', completed_at = NOW(), synced_at = NULL
  WHERE id = v_card_id;

  -- Enregistrer la sélection de bonus
  INSERT INTO bonus_selections (student_id, user_id, card_id, bonus_id, selected_at)
  VALUES (v_student_id, v_user_id, v_card_id, p_bonus_id, NOW());

  -- Créer automatiquement la nouvelle carte
  INSERT INTO stamp_cards (student_id, user_id, card_number, status)
  VALUES (v_student_id, v_user_id, v_card_number + 1, 'active');

  RETURN json_build_object(
    'success', true,
    'new_card_number', v_card_number + 1
  );
END;
$$;
