-- ============================================================
-- 069 — Points en plus ou en moins pendant une activité numérique
--
-- Un message de la page « En direct » peut porter des points (−5 à +5) : un malus (« bavardage ») ou un bonus.
-- Le message s'affiche comme les autres (20 minutes) ; les points, eux, restent : l'application les montre dans le
-- carnet de l'élève, et la correction (scripts/productions.py du Correcteur) les ajoute à la note de chaque élève
-- visé, entre 0 et le barème, en les listant dans la correction.
-- ============================================================

ALTER TABLE public.live_messages
  ADD COLUMN IF NOT EXISTS points numeric(3,1) CHECK (points IS NULL OR (points BETWEEN -5 AND 5 AND points <> 0));
COMMENT ON COLUMN public.live_messages.points IS
  'Points ajoutés (> 0) ou retirés (< 0) à la note de chaque élève visé pour cette activité ; null pour un simple message.';

-- les messages récents : avec leurs points, pour que l'application les affiche
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

  SELECT coalesce(json_agg(json_build_object('id', m.id, 'texte', m.texte, 'style', m.style, 'signe', m.signe, 'points', m.points,
                                             'created_at', m.created_at) ORDER BY m.created_at), '[]'::json)
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

-- tous les points de ces élèves pour cette activité (sans limite de durée), pour le carnet
CREATE OR REPLACE FUNCTION public.student_live_points(p_codes text[], p_activity_key text)
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
  IF v_activity_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  SELECT coalesce(json_agg(json_build_object('id', m.id, 'points', m.points, 'texte', m.texte, 'signe', m.signe, 'created_at', m.created_at)
                           ORDER BY m.created_at), '[]'::json)
  INTO v_out
  FROM live_messages m
  WHERE m.user_id = v_user_id
    AND m.points IS NOT NULL
    AND m.activity_id = v_activity_id
    AND (m.class_id IS NULL OR m.class_id = ANY (coalesce(v_classes, '{}')))
    AND (m.student_ids IS NULL OR m.student_ids && v_students);
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.student_live_points(text[], text) FROM public;
GRANT EXECUTE ON FUNCTION public.student_live_points(text[], text) TO anon, authenticated;
COMMENT ON FUNCTION public.student_live_points(text[], text) IS
  'Points en plus ou en moins (live_messages.points) donnés à ces codes élève pour cette activité, pour le carnet.';
