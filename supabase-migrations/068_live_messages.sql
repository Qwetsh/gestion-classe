-- ============================================================
-- 068 — Messages du prof aux élèves pendant une activité numérique
--
-- Depuis la page « En direct » (gestion-classe-web), le prof envoie un court message à un groupe, à une classe
-- ou à tous les élèves d'une activité. L'application (Hôpital virtuel) le lit toutes les 15 s avec les codes
-- élève connectés, et l'affiche signé par un personnage du jeu (« Docteur Morel », « Le chef de service »…).
-- Un message vit 20 minutes : passé ce délai, il ne s'affiche plus chez un élève qui se connecte.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.live_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- portée : une activité (null = toutes), une classe (null = toutes), des élèves (null = tous ceux de la portée)
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  student_ids uuid[],
  texte       text NOT NULL CHECK (char_length(texte) BETWEEN 1 AND 300),
  style       text NOT NULL DEFAULT 'alerte' CHECK (style IN ('alerte', 'info', 'bravo')),
  signe       text NOT NULL DEFAULT 'Docteur Morel' CHECK (char_length(signe) BETWEEN 1 AND 40),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '20 minutes'
);
COMMENT ON TABLE public.live_messages IS
  'Messages courts du prof aux élèves pendant une activité numérique, affichés dans l''application signés par un personnage du jeu.';
CREATE INDEX IF NOT EXISTS idx_live_messages_user_created ON public.live_messages(user_id, created_at DESC);

ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_messages_own" ON public.live_messages;
CREATE POLICY "live_messages_own" ON public.live_messages
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- RPC élève : les messages récents pour ces codes (1 à 3), dans cette activité
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_live_messages(p_codes text[], p_activity_key text, p_since timestamptz DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_students uuid[];
  v_classes uuid[];
  v_activity_id uuid;
  v_out json;
BEGIN
  IF p_codes IS NULL OR array_length(p_codes, 1) IS NULL OR array_length(p_codes, 1) > 3 THEN
    RETURN '[]'::json;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_codes) c WHERE c IS NULL OR c !~ '^\d{6}$') THEN
    RETURN '[]'::json;
  END IF;

  SELECT min(s.user_id::text)::uuid, array_agg(s.id), array_agg(DISTINCT s.class_id) FILTER (WHERE s.class_id IS NOT NULL)
  INTO v_user_id, v_students, v_classes
  FROM students s WHERE s.student_code = ANY (p_codes) AND s.is_deleted = false;
  IF v_user_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  SELECT a.id INTO v_activity_id FROM activities a
  WHERE a.user_id = v_user_id AND a.key = p_activity_key AND a.is_deleted = false;

  SELECT coalesce(json_agg(json_build_object('id', m.id, 'texte', m.texte, 'style', m.style, 'signe', m.signe, 'created_at', m.created_at)
                           ORDER BY m.created_at), '[]'::json)
  INTO v_out
  FROM (
    SELECT * FROM live_messages m
    WHERE m.user_id = v_user_id
      AND m.expires_at > now()
      AND m.created_at > coalesce(p_since, now() - interval '20 minutes')
      AND (m.activity_id IS NULL OR m.activity_id = v_activity_id)
      AND (m.class_id IS NULL OR m.class_id = ANY (coalesce(v_classes, '{}')))
      AND (m.student_ids IS NULL OR m.student_ids && v_students)
    ORDER BY m.created_at DESC
    LIMIT 10
  ) m;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.student_live_messages(text[], text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.student_live_messages(text[], text, timestamptz) TO anon, authenticated;
COMMENT ON FUNCTION public.student_live_messages(text[], text, timestamptz) IS
  'Messages du prof (live_messages) adressés à ces codes élève pour cette activité, envoyés depuis p_since et encore valables.';
