-- 088 — TP en groupes, lot 3 : onglet TP de l'espace élève, en lecture (PLAN_tp_groupes.md).
--
-- L'élève se connecte par son code à 6 chiffres (resolve_student_code). Il voit les TP en
-- groupes dont il est membre d'un groupe, lancés (active) ou terminés (completed), absent
-- compris (règle de Thomas : l'absent voit tout ce que son groupe a fait). Jamais la correction
-- ni la note ici : elles arrivent dans Évals quand le prof publie. Le commentaire du prof au
-- groupe n'est montré qu'une fois l'éval publiée.
--
-- Les photos (bucket privé student-photos) sont servies par la fonction Edge tp-eleve, qui
-- vérifie le code avec get_student_tp puis signe les chemins : ces fonctions ne rendent jamais
-- de chemin de fichier.
--
-- Cours montrés à l'élève (fiche, protocole, documents de l'activité du TP) : comme pour le
-- classeur (085-086), le serveur n'ouvre jamais un cours d'après son titre. Le navigateur du
-- professeur écrit les identifiants dans tp_templates.student_boards (Mes TP, Mes cours), le
-- serveur ne fait que les suivre ; un titre devenu « (correction) » referme le cours.

ALTER TABLE public.tp_templates
  ADD COLUMN IF NOT EXISTS student_boards jsonb;

COMMENT ON COLUMN public.tp_templates.student_boards IS
  'Cours de l''activité ouverts aux membres des groupes du TP : {"fiche": uuid, "protocole": uuid, "documents": uuid} (null = aucun). Écrit par le navigateur du professeur.';

-- Couleur d'un groupe : son rang d'îlot (087). Les TP d'avant la 087 ont tous 0 : le numéro du
-- nom (« G3 » → 2) donne alors des couleurs différentes, comme au téléphone.
CREATE OR REPLACE FUNCTION public.tp_group_order(p_order integer, p_name text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(p_order, 0) = 0 AND p_name ~ '^\s*G\s*\d+\s*$'
      THEN greatest(0, substring(p_name FROM '\d+')::int - 1)
    ELSE coalesce(p_order, 0)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_tps(p_code text, p_student_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student uuid;
BEGIN
  v_student := resolve_student_code(p_code, p_student_id);
  IF v_student IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  RETURN json_build_object('tps', coalesce((
    SELECT json_agg(t ORDER BY t.started_at DESC)
    FROM (
      SELECT
        gs.id                                   AS session_id,
        coalesce(tt.name, gs.name)              AS name,
        tt.activity                             AS activity,
        tt.level                                AS level,
        gs.status                               AS status,
        coalesce(se.started_at, gs.created_at)  AS started_at,
        se.ended_at                             AS ended_at,
        sg.name                                 AS group_name,
        public.tp_group_order(sg.display_order, sg.name) AS group_order,
        (SELECT coalesce(json_agg(st.pseudo ORDER BY st.pseudo), '[]'::json)
           FROM session_group_members m2 JOIN students st ON st.id = m2.student_id
          WHERE m2.group_id = sg.id AND m2.student_id <> v_student) AS mates,
        (SELECT count(*) FROM group_session_photos p
          WHERE p.session_id = gs.id AND (p.group_id = sg.id OR p.group_id IS NULL)) AS photo_count,
        EXISTS (SELECT 1 FROM written_assessments wa
                 WHERE wa.group_session_id = gs.id AND NOT wa.is_deleted AND wa.published_to_students) AS corrected
      FROM session_group_members m
      JOIN session_groups sg ON sg.id = m.group_id
      JOIN group_sessions gs ON gs.id = sg.session_id
      LEFT JOIN tp_templates tt ON tt.id = gs.template_id
      LEFT JOIN sessions se ON se.id = gs.linked_session_id
      WHERE m.student_id = v_student
        AND gs.status IN ('active', 'completed')
    ) t
  ), '[]'::json));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_tp(p_code text, p_session_id uuid, p_student_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student   uuid;
  v_group     public.session_groups%ROWTYPE;
  v_gs        public.group_sessions%ROWTYPE;
  v_published boolean;
  v_absent    boolean;
BEGIN
  v_student := resolve_student_code(p_code, p_student_id);
  IF v_student IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  SELECT sg.* INTO v_group
  FROM session_group_members m
  JOIN session_groups sg ON sg.id = m.group_id
  WHERE m.student_id = v_student AND sg.session_id = p_session_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_gs FROM group_sessions WHERE id = p_session_id AND status IN ('active', 'completed');
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  v_published := EXISTS (SELECT 1 FROM written_assessments wa
                          WHERE wa.group_session_id = v_gs.id AND NOT wa.is_deleted AND wa.published_to_students);
  v_absent := v_gs.linked_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM events e WHERE e.session_id = v_gs.linked_session_id AND e.student_id = v_student AND e.type = 'absence');

  RETURN json_build_object(
    'session_id', v_gs.id,
    'status', v_gs.status,
    'name', coalesce((SELECT name FROM tp_templates WHERE id = v_gs.template_id), v_gs.name),
    'started_at', coalesce((SELECT started_at FROM sessions WHERE id = v_gs.linked_session_id), v_gs.created_at),
    'corrected', v_published,
    'absent', v_absent,
    'group', json_build_object(
      'id', v_group.id,
      'name', v_group.name,
      'order', public.tp_group_order(v_group.display_order, v_group.name),
      'comment', CASE WHEN v_published THEN v_group.comment END,
      'members', (SELECT coalesce(json_agg(json_build_object('pseudo', st.pseudo, 'me', st.id = v_student) ORDER BY st.pseudo), '[]'::json)
                    FROM session_group_members m2 JOIN students st ON st.id = m2.student_id
                   WHERE m2.group_id = v_group.id)
    ),
    'template', (SELECT json_build_object(
                    'name', tt.name, 'level', tt.level, 'chapter', tt.chapter, 'activity', tt.activity,
                    'problem', tt.problem, 'materials', coalesce(tt.materials, '{}'), 'protocol', coalesce(tt.protocol, '{}'),
                    'safety', coalesce(tt.safety, '{}'))
                  FROM tp_templates tt WHERE tt.id = v_gs.template_id),
    'docs', (SELECT coalesce(json_agg(json_build_object('kind', d.kind, 'board_id', b.id, 'title', b.title, 'updated_at', b.updated_at)
                                      ORDER BY array_position(ARRAY['fiche', 'protocole', 'documents'], d.kind)), '[]'::json)
             FROM tp_templates tt
             CROSS JOIN LATERAL jsonb_each_text(coalesce(tt.student_boards, '{}'::jsonb)) AS d(kind, board_text)
             JOIN boards b ON b.id::text = d.board_text AND b.user_id = v_gs.user_id
             WHERE tt.id = v_gs.template_id
               AND d.kind IN ('fiche', 'protocole', 'documents')
               AND b.title !~* '\((correction|corrig|copie)')
    ,
    'photos', (SELECT coalesce(json_agg(json_build_object(
                  'id', p.id,
                  'created_at', p.created_at,
                  'caption', nullif(p.caption, ''),
                  'whole_class', p.group_id IS NULL,
                  'author', CASE WHEN p.author = 'student' THEN coalesce(split_part(st.pseudo, ' ', 1), 'Élève') ELSE 'Prof' END
                ) ORDER BY p.created_at), '[]'::json)
               FROM group_session_photos p
               LEFT JOIN students st ON st.id = p.student_id
               WHERE p.session_id = v_gs.id AND (p.group_id = v_group.id OR p.group_id IS NULL))
  );
END;
$function$;

-- Chemins des photos visibles par l'élève : réservé à la fonction Edge (service_role), qui
-- les signe après avoir vérifié le code avec get_student_tp.
CREATE OR REPLACE FUNCTION public.student_tp_photo_paths(p_code text, p_session_id uuid, p_student_id uuid DEFAULT NULL)
 RETURNS TABLE (id uuid, file_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.id, p.file_path
  FROM group_session_photos p
  JOIN session_groups sg ON sg.session_id = p.session_id
  JOIN session_group_members m ON m.group_id = sg.id
  JOIN group_sessions gs ON gs.id = p.session_id AND gs.status IN ('active', 'completed')
  WHERE p.session_id = p_session_id
    AND m.student_id = resolve_student_code(p_code, p_student_id)
    AND (p.group_id = sg.id OR p.group_id IS NULL);
$function$;

REVOKE ALL ON FUNCTION public.get_student_tps(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_tp(text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_tp_photo_paths(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_tps(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_tp(text, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_tp_photo_paths(text, uuid, uuid) TO service_role;
