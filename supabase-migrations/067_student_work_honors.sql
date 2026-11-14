-- Migration 067 : « Médecin de la semaine » de l'hôpital virtuel
-- (appliquée sur Class'it le 09/11/2026 sous le nom 065_student_work_honors, avant de voir que 065 et 066 étaient
--  déjà appliqués en production : 065_lesson_boards, 066_makeup_reminders)
-- Description : dans la salle d'attente de l'hôpital virtuel, un diplôme affiche le ou les groupes qui ont eu la
--   meilleure note au dernier patient noté, pour la classe de l'élève connecté. Choix de Thomas (09/11/2026) :
--   - seules les fiches VALIDÉES comptent (pas une correction de Claude pas encore relue) ;
--   - « patient précédent » = le premier, dans la liste de clés envoyée par l'application (du plus récent au plus
--     ancien), pour lequel la classe a au moins une fiche validée ;
--   - tous les ex-aequo sont nommés (3 groupes au plus, le reste compté dans `others`) ;
--   - la note n'est pas renvoyée, seulement les pseudos.
--   Un groupe = les élèves d'un même binôme ou trio (group_key) qui ont chacun la meilleure note : la note restant
--   individuelle, un membre noté plus bas n'est pas nommé.

CREATE OR REPLACE FUNCTION public.student_work_honors(p_codes text[], p_activity_keys text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_err text;
  v_user_id uuid;
  v_class_id uuid;
  v_key text;
  v_activity_id uuid;
  v_best numeric;
  v_groups json;
  v_count int;
BEGIN
  SELECT r.err INTO v_err FROM public._student_work_resolve(p_codes) r LIMIT 1;
  IF v_err IS NOT NULL THEN
    RETURN json_build_object('error', v_err);
  END IF;

  SELECT r.user_id, r.class_id INTO v_user_id, v_class_id
  FROM public._student_work_resolve(p_codes) r
  WHERE r.class_id IS NOT NULL
  LIMIT 1;
  IF v_class_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  FOREACH v_key IN ARRAY COALESCE(p_activity_keys[1:20], '{}') LOOP
    SELECT a.id INTO v_activity_id FROM activities a WHERE a.user_id = v_user_id AND a.key = v_key;
    CONTINUE WHEN v_activity_id IS NULL;

    SELECT MAX(w.total_points) INTO v_best
    FROM student_works w
    WHERE w.activity_id = v_activity_id AND w.class_id = v_class_id
      AND w.status = 'validated' AND NOT w.is_deleted AND w.total_points IS NOT NULL;
    CONTINUE WHEN v_best IS NULL;

    WITH laureats AS (
      SELECT COALESCE(w.group_key, w.id::text) AS groupe, s.pseudo, w.first_submitted_at
      FROM student_works w
      JOIN students s ON s.id = w.student_id AND NOT s.is_deleted
      WHERE w.activity_id = v_activity_id AND w.class_id = v_class_id
        AND w.status = 'validated' AND NOT w.is_deleted AND w.total_points = v_best
    ), groupes AS (
      SELECT groupe, array_agg(pseudo ORDER BY pseudo) AS pseudos, MIN(first_submitted_at) AS premier
      FROM laureats GROUP BY groupe
    )
    SELECT (SELECT json_agg(g.pseudos ORDER BY g.premier NULLS LAST, g.groupe)
            FROM (SELECT * FROM groupes ORDER BY premier NULLS LAST, groupe LIMIT 3) g),
           (SELECT COUNT(*) FROM groupes)
    INTO v_groups, v_count;

    RETURN json_build_object('found', true, 'activity_key', v_key, 'groups', v_groups, 'others', GREATEST(v_count - 3, 0));
  END LOOP;

  RETURN json_build_object('found', false);
END;
$$;

REVOKE ALL ON FUNCTION public.student_work_honors(text[], text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.student_work_honors(text[], text[]) TO anon, authenticated;
COMMENT ON FUNCTION public.student_work_honors(text[], text[]) IS
  'Hôpital virtuel, « Médecin de la semaine » : pseudos des groupes à la meilleure note validée de la classe de l''élève, au premier patient noté de la liste. Pas de note renvoyée.';
