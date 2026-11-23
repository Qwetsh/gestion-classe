-- 089 — TP en groupes, lot 4 : dépôt de photos par les élèves (PLAN_tp_groupes.md).
--
-- Règles de Thomas (canevas « élève et bureau », B3) : le dépôt s'ouvre au lancement du TP et se
-- ferme tout seul à la fin de l'heure ; le prof peut le fermer plus tôt, ou le rouvrir (il se
-- referme alors tout seul au bout de 30 min). L'élève peut retirer ses propres photos tant que le
-- dépôt est ouvert ; le prof peut tout supprimer.
--
-- Fin de l'heure : la séance terminée au téléphone (sessions.ended_at, ou le TP passé à
-- « completed »), et au plus tard 2 h après le début de la séance (téléphone oublié).
--
--   deposit_closed = true            → fermé (le prof l'a fermé)
--   deposit_until  non nul           → ouvert jusqu'à cette heure (le prof l'a rouvert)
--   sinon                            → règle automatique ci-dessus
--
-- Les photos des élèves passent par la fonction Edge tp-eleve (clé de service) : elle demande à
-- student_tp_deposit_target si l'élève peut déposer, et pour quel groupe.

ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS deposit_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_until timestamptz;

-- État du dépôt d'un TP : {open, closes_at, mode ('auto' | 'closed' | 'reopened')}.
-- Droits de l'appelant : le prof ne lit que ses TP (RLS) ; les fonctions élève (SECURITY
-- DEFINER) l'appellent avec les leurs.
CREATE OR REPLACE FUNCTION public.tp_deposit_state(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gs     public.group_sessions%ROWTYPE;
  v_start  timestamptz;
  v_ended  timestamptz;
  v_until  timestamptz;
BEGIN
  SELECT * INTO v_gs FROM group_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('open', false, 'closes_at', NULL, 'mode', 'closed');
  END IF;
  IF v_gs.deposit_closed THEN
    RETURN jsonb_build_object('open', false, 'closes_at', NULL, 'mode', 'closed');
  END IF;
  IF v_gs.deposit_until IS NOT NULL THEN
    RETURN jsonb_build_object('open', now() < v_gs.deposit_until, 'closes_at', v_gs.deposit_until, 'mode', 'reopened');
  END IF;

  SELECT started_at, ended_at INTO v_start, v_ended FROM sessions WHERE id = v_gs.linked_session_id;
  v_start := coalesce(v_start, v_gs.created_at);
  v_until := v_start + interval '2 hours';
  RETURN jsonb_build_object(
    'open', v_gs.status = 'active' AND v_ended IS NULL AND now() < v_until,
    'closes_at', coalesce(v_ended, v_gs.completed_at, v_until),
    'mode', 'auto');
END;
$function$;

REVOKE ALL ON FUNCTION public.tp_deposit_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tp_deposit_state(uuid) TO authenticated, service_role;

-- Ce qu'il faut à la fonction Edge pour un dépôt : l'élève, son groupe, le prof (dossier du
-- stockage) et l'état du dépôt. Rien si le code ne désigne pas un membre d'un groupe de ce TP.
CREATE OR REPLACE FUNCTION public.student_tp_deposit_target(p_code text, p_session_id uuid, p_student_id uuid DEFAULT NULL)
 RETURNS TABLE (student_id uuid, group_id uuid, owner_id uuid, open boolean, my_photos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.student_id, sg.id, gs.user_id,
         coalesce((public.tp_deposit_state(gs.id) ->> 'open')::boolean, false),
         (SELECT count(*)::int FROM group_session_photos p WHERE p.session_id = gs.id AND p.student_id = m.student_id)
  FROM session_group_members m
  JOIN session_groups sg ON sg.id = m.group_id
  JOIN group_sessions gs ON gs.id = sg.session_id AND gs.status IN ('active', 'completed')
  WHERE sg.session_id = p_session_id
    AND m.student_id = resolve_student_code(p_code, p_student_id)
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.student_tp_deposit_target(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.student_tp_deposit_target(text, uuid, uuid) TO service_role;

-- get_student_tps : + deposit_open (088 sinon inchangée).
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
                 WHERE wa.group_session_id = gs.id AND NOT wa.is_deleted AND wa.published_to_students) AS corrected,
        coalesce((public.tp_deposit_state(gs.id) ->> 'open')::boolean, false) AS deposit_open,
        (public.tp_deposit_state(gs.id) ->> 'closes_at')::timestamptz AS deposit_closes_at
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

-- get_student_tp : + deposit, + photos.mine (088 sinon inchangée).
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
    'deposit', public.tp_deposit_state(v_gs.id),
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
                  'mine', p.author = 'student' AND p.student_id = v_student,
                  'author', CASE WHEN p.author = 'student' THEN coalesce(split_part(st.pseudo, ' ', 1), 'Élève') ELSE 'Prof' END
                ) ORDER BY p.created_at), '[]'::json)
               FROM group_session_photos p
               LEFT JOIN students st ON st.id = p.student_id
               WHERE p.session_id = v_gs.id AND (p.group_id = v_group.id OR p.group_id IS NULL))
  );
END;
$function$;
