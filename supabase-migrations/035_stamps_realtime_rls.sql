-- ============================================================
-- Migration 035 : Tampons — Realtime, RLS renforcée, search_path des RPC
-- ============================================================
-- 1. Realtime sur stamps / stamp_cards / bonus_selections pour que l'onglet
--    Récompenses du web voie un tampon donné depuis le téléphone sans recharger.
--    REPLICA IDENTITY FULL : sans cela, un DELETE n'expose que la clé primaire
--    et le filtre `user_id=eq.…` de la souscription ne le voit pas.
-- 2. RLS : les policies INSERT/UPDATE ne vérifiaient que user_id = auth.uid(),
--    pas que l'élève visé appartient bien au même enseignant ; et les UPDATE
--    n'avaient pas de WITH CHECK (user_id modifiable).
-- 3. search_path fixé sur les RPC SECURITY DEFINER des migrations 011-013
--    (recommandation Supabase).
-- ============================================================

-- 1. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE stamps, stamp_cards, bonus_selections;
ALTER TABLE stamps REPLICA IDENTITY FULL;
ALTER TABLE stamp_cards REPLICA IDENTITY FULL;
ALTER TABLE bonus_selections REPLICA IDENTITY FULL;

-- 2. RLS : l'élève doit appartenir à l'enseignant (stamps, stamp_cards, bonus_selections)
DROP POLICY IF EXISTS "Users can insert own stamps" ON stamps;
CREATE POLICY "Users can insert own stamps" ON stamps FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can update own stamps" ON stamps;
CREATE POLICY "Users can update own stamps" ON stamps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own stamp_cards" ON stamp_cards;
CREATE POLICY "Users can insert own stamp_cards" ON stamp_cards FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can update own stamp_cards" ON stamp_cards;
CREATE POLICY "Users can update own stamp_cards" ON stamp_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own bonus_selections" ON bonus_selections;
CREATE POLICY "Users can insert own bonus_selections" ON bonus_selections FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can update own bonus_selections" ON bonus_selections;
CREATE POLICY "Users can update own bonus_selections" ON bonus_selections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

-- Catégories et bonus : WITH CHECK sur l'UPDATE
DROP POLICY IF EXISTS "Users can update own stamp_categories" ON stamp_categories;
CREATE POLICY "Users can update own stamp_categories" ON stamp_categories FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own bonuses" ON bonuses;
CREATE POLICY "Users can update own bonuses" ON bonuses FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. search_path des RPC élève (SECURITY DEFINER)
ALTER FUNCTION get_student_stamps(character varying) SET search_path = public;
ALTER FUNCTION select_student_bonus(character varying, uuid) SET search_path = public;
