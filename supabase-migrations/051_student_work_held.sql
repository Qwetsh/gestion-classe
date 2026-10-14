-- Migration 051 : fiches reçues pendant que les envois sont fermés
-- Description : jusqu'ici, student_work_save refusait tout ('closed') quand l'activité était fermée,
--   brouillons compris : rien n'arrivait côté serveur et le prof n'en savait rien (15/10/2026 : toute une
--   séance perdue). Désormais la fiche est MISE DE CÔTÉ dans student_work_held (une ligne par activité et
--   par groupe de codes, la plus récente gagne), l'élève est prévenu qu'elle est gardée, et gestion-classe
--   affiche une alerte avec « Rouvrir et récupérer » (student_work_accept_held).
--   Une fiche mise de côté ne touche jamais student_works tant que le prof ne l'a pas acceptée : fermer
--   reste un vrai verrou pour les copies déjà corrigées.

-- ============================================================
-- 1. File d'attente
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_work_held (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id  uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  codes_key    text NOT NULL,                 -- codes triés, joints par '+'
  codes        text[] NOT NULL,
  pseudos      text[] NOT NULL DEFAULT '{}',
  class_name   text,
  activity     jsonb NOT NULL,                -- instantané envoyé par l'application (clé, définition…)
  content      jsonb NOT NULL,
  submit       boolean NOT NULL DEFAULT false, -- au moins un envoi explicite (ou de fin d'heure) tenté
  attempts     integer NOT NULL DEFAULT 1,
  first_at     timestamptz NOT NULL DEFAULT now(),
  last_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, codes_key)
);

COMMENT ON TABLE public.student_work_held IS
  'Fiches reçues alors que l''activité était fermée : gardées ici, jamais perdues, en attente d''acceptation par le prof (student_work_accept_held).';

CREATE INDEX IF NOT EXISTS idx_student_work_held_user ON public.student_work_held (user_id, last_at DESC);

ALTER TABLE public.student_work_held ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_work_held_user" ON public.student_work_held;
CREATE POLICY "student_work_held_user" ON public.student_work_held
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "student_work_held_delete" ON public.student_work_held;
CREATE POLICY "student_work_held_delete" ON public.student_work_held
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 2. student_work_save : activité fermée => mise de côté au lieu d'un refus sec
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_work_save(p_codes text[], p_activity jsonb, p_content jsonb, p_submit boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_err text;
  v_user_id uuid;
  v_key text;
  v_activity_id uuid;
  v_accepting boolean;
  v_def_version int;
  v_incoming_version int;
  v_group_key text;
  v_pseudos text[];
  v_now timestamptz := now();
  r record;
  w record;
  v_results json[] := '{}';
  v_status text;
  v_version int;
  v_locked boolean;
  v_modified boolean;
BEGIN
  SELECT x.err INTO v_err FROM public._student_work_resolve(p_codes) x LIMIT 1;
  IF v_err IS NOT NULL THEN
    RETURN json_build_object('error', v_err);
  END IF;

  v_key := p_activity->>'key';
  IF v_key IS NULL OR v_key !~ '^[a-z0-9-]{3,40}$' THEN
    RETURN json_build_object('error', 'invalid_activity');
  END IF;
  IF p_content IS NULL OR length(p_content::text) > 200000 THEN
    RETURN json_build_object('error', 'content_too_large');
  END IF;

  SELECT x.user_id INTO v_user_id FROM public._student_work_resolve(p_codes) x LIMIT 1;
  SELECT array_agg(x.pseudo ORDER BY x.pseudo) INTO v_pseudos FROM public._student_work_resolve(p_codes) x;
  v_group_key := CASE WHEN array_length(v_pseudos, 1) > 1
    THEN md5((SELECT string_agg(c, '+' ORDER BY c) FROM unnest(p_codes) AS c))
    ELSE NULL END;
  v_incoming_version := COALESCE((p_activity->>'definition_version')::int, 1);

  INSERT INTO activities (user_id, key, title, level, sequence, bareme_total, definition, definition_version)
  VALUES (
    v_user_id, v_key,
    COALESCE(p_activity->>'title', v_key),
    p_activity->>'level',
    p_activity->>'sequence',
    COALESCE((p_activity->>'bareme_total')::numeric, 10),
    COALESCE(p_activity->'definition', '{}'::jsonb),
    v_incoming_version
  )
  ON CONFLICT (user_id, key) DO NOTHING;

  SELECT a.id, a.accepting_submissions, a.definition_version INTO v_activity_id, v_accepting, v_def_version
  FROM activities a WHERE a.user_id = v_user_id AND a.key = v_key;

  IF NOT v_accepting THEN
    -- Envois fermés : la fiche est gardée de côté (la plus récente par groupe de codes) et le prof est prévenu.
    INSERT INTO student_work_held (user_id, activity_id, codes_key, codes, pseudos, class_name, activity, content, submit)
    VALUES (
      v_user_id, v_activity_id,
      (SELECT string_agg(DISTINCT c, '+' ORDER BY c) FROM unnest(p_codes) AS c),
      ARRAY(SELECT DISTINCT c FROM unnest(p_codes) AS c ORDER BY c),
      v_pseudos,
      (SELECT x.class_name FROM public._student_work_resolve(p_codes) x LIMIT 1),
      p_activity, p_content, p_submit
    )
    ON CONFLICT (activity_id, codes_key) DO UPDATE SET
      activity = EXCLUDED.activity,
      content  = EXCLUDED.content,
      pseudos  = EXCLUDED.pseudos,
      class_name = EXCLUDED.class_name,
      submit   = student_work_held.submit OR EXCLUDED.submit,
      attempts = student_work_held.attempts + 1,
      last_at  = v_now;
    RETURN json_build_object('error', 'closed', 'held', true);
  END IF;
  -- La définition suit la version de l'application ; une activité créée sans questions (ancien client, test) la reçoit aussi.
  IF p_activity ? 'definition' AND (
       v_incoming_version > v_def_version
       OR NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = v_activity_id AND jsonb_typeof(a.definition->'questions') = 'array' AND jsonb_array_length(a.definition->'questions') > 0)
     ) THEN
    UPDATE activities SET
      definition = p_activity->'definition',
      definition_version = v_incoming_version,
      title = COALESCE(p_activity->>'title', title),
      bareme_total = COALESCE((p_activity->>'bareme_total')::numeric, bareme_total)
    WHERE id = v_activity_id;
  END IF;

  FOR r IN SELECT * FROM public._student_work_resolve(p_codes) LOOP
    SELECT * INTO w FROM student_works
    WHERE activity_id = v_activity_id AND student_id = r.student_id;

    v_locked := false;
    IF NOT FOUND THEN
      v_status := CASE WHEN p_submit THEN 'submitted' ELSE 'draft' END;
      v_version := CASE WHEN p_submit THEN 1 ELSE 0 END;
      INSERT INTO student_works (user_id, activity_id, student_id, class_id, group_key, group_pseudos, content, status, version,
                                 first_submitted_at, submitted_at)
      VALUES (v_user_id, v_activity_id, r.student_id, r.class_id, v_group_key, v_pseudos, p_content, v_status, v_version,
              CASE WHEN p_submit THEN v_now END, CASE WHEN p_submit THEN v_now END)
      RETURNING id INTO w;
      IF p_submit THEN
        INSERT INTO student_work_versions (work_id, version, content, submitted_at) VALUES (w.id, 1, p_content, v_now);
      END IF;
    ELSIF w.status = 'validated' THEN
      v_locked := true;
      v_status := w.status;
      v_version := w.version;
    ELSE
      v_modified := (w.status = 'corrected') AND (w.content IS DISTINCT FROM p_content);
      IF p_submit THEN
        v_status := 'submitted';
        v_version := w.version + 1;
      ELSE
        v_status := CASE WHEN w.status = 'draft' THEN 'draft' ELSE w.status END;
        v_version := w.version;
      END IF;
      UPDATE student_works SET
        content = p_content,
        class_id = COALESCE(r.class_id, class_id),
        group_key = v_group_key,
        group_pseudos = v_pseudos,
        status = v_status,
        version = v_version,
        first_submitted_at = CASE WHEN p_submit THEN COALESCE(first_submitted_at, v_now) ELSE first_submitted_at END,
        submitted_at = CASE WHEN p_submit THEN v_now ELSE submitted_at END,
        modified_after_correction = modified_after_correction OR COALESCE(v_modified, false) OR (p_submit AND w.status = 'corrected')
      WHERE id = w.id;
      IF p_submit THEN
        INSERT INTO student_work_versions (work_id, version, content, submitted_at) VALUES (w.id, v_version, p_content, v_now);
      END IF;
    END IF;

    v_results := v_results || json_build_object('code', r.code, 'pseudo', r.pseudo, 'status', v_status, 'version', v_version, 'locked', v_locked);
  END LOOP;

  RETURN json_build_object('saved_at', v_now, 'submitted', p_submit, 'results', to_json(v_results));
END;
$function$;

-- ============================================================
-- 3. Le prof accepte : rouvre l'activité et enregistre chaque fiche mise de côté comme un envoi normal
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_work_accept_held(p_activity_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  h record;
  v_res json;
  v_ok int := 0;
  v_ko int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = p_activity_id AND a.user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  UPDATE activities SET accepting_submissions = true WHERE id = p_activity_id;
  FOR h IN SELECT * FROM student_work_held WHERE activity_id = p_activity_id ORDER BY last_at LOOP
    v_res := public.student_work_save(h.codes, h.activity, h.content, h.submit);
    IF v_res->>'error' IS NULL THEN
      v_ok := v_ok + 1;
      DELETE FROM student_work_held WHERE id = h.id;
    ELSE
      v_ko := v_ko + 1;   -- code supprimé entre-temps… : la fiche reste en attente
    END IF;
  END LOOP;
  RETURN json_build_object('accepted', v_ok, 'failed', v_ko);
END;
$function$;

REVOKE ALL ON FUNCTION public.student_work_accept_held(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_work_accept_held(uuid) TO authenticated;
