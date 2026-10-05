-- Migration 046 : productions numériques des élèves
-- Description : une application de séquence (ex. « Terre en mouvement », SVT 4e) fait remplir
--   une fiche d'activité directement à l'écran, puis l'envoie ici avec le code à 6 chiffres de
--   l'élève. Le prof relit, corrige (ou fait corriger par Claude), valide, puis pousse la note
--   dans le carnet (written_assessments / assessment_grades).
--
--   Décisions :
--   - Les questions et le barème vivent dans le CODE de l'application. Chaque envoi emporte un
--     instantané de cette définition ; l'activité se crée toute seule chez le prof concerné au
--     premier envoi reçu. Rien à configurer, et un collègue qui utilise la même application
--     avec son propre compte voit l'activité apparaître chez lui.
--   - Une ligne par élève et par activité. Un binôme qui remplit ensemble sur un poste donne
--     N lignes au même contenu, reliées par group_key : la note reste individuelle, la
--     correction peut être copiée d'un membre à l'autre côté web.
--   - L'envoi ne touche que les élèves connectés à ce moment-là (jamais « le reste du binôme »
--     d'un envoi précédent) ; chaque envoi explicite est archivé dans student_work_versions.
--   - Une production validée est verrouillée : un nouvel envoi est refusé.
-- Conventions : SECURITY DEFINER + validation du code à 6 chiffres (cf. migrations 031, 040).

-- ============================================================
-- 1. Activités (une par prof et par clé d'application)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key                   text NOT NULL,
  title                 text NOT NULL,
  level                 text,
  sequence              text,
  bareme_total          numeric NOT NULL DEFAULT 10,
  definition            jsonb NOT NULL DEFAULT '{}'::jsonb,
  definition_version    integer NOT NULL DEFAULT 1,
  expected_answers      text,
  accepting_submissions boolean NOT NULL DEFAULT true,
  is_deleted            boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

COMMENT ON TABLE public.activities IS
  'Activité numérique dont les élèves envoient une fiche remplie. Créée automatiquement au premier envoi reçu (instantané de la définition envoyé par l''application).';
COMMENT ON COLUMN public.activities.key IS 'Clé stable définie dans l''application, ex. 4e-s2-a1.';
COMMENT ON COLUMN public.activities.definition IS 'Questions, points, critères de correction (instantané envoyé par l''application). Sert à afficher la copie et à corriger.';
COMMENT ON COLUMN public.activities.expected_answers IS 'Corrigé attendu, saisi par le prof dans gestion-classe. Jamais renvoyé aux élèves.';
COMMENT ON COLUMN public.activities.accepting_submissions IS 'FALSE : les envois sont refusés (activité fermée).';

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_user" ON public.activities;
CREATE POLICY "activities_user" ON public.activities
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_activities_updated_at ON public.activities;
CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Productions (une par élève et par activité)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_works (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id               uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id                uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id                  uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  group_key                 text,
  group_pseudos             text[] NOT NULL DEFAULT '{}',
  content                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                    text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'submitted', 'corrected', 'validated')),
  version                   integer NOT NULL DEFAULT 0,
  first_submitted_at        timestamptz,
  submitted_at              timestamptz,
  modified_after_correction boolean NOT NULL DEFAULT false,
  correction                jsonb,
  advice                    text,
  skills                    jsonb,
  total_points              numeric,
  corrected_by              text CHECK (corrected_by IN ('claude', 'prof')),
  corrected_at              timestamptz,
  validated_at              timestamptz,
  is_deleted                boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

COMMENT ON TABLE public.student_works IS
  'Fiche d''activité remplie par un élève dans une application et envoyée avec son code. Brouillon → envoyée → corrigée → validée.';
COMMENT ON COLUMN public.student_works.class_id IS 'Classe de l''élève au moment de l''envoi (students.class_id devient NULL au passage d''année).';
COMMENT ON COLUMN public.student_works.group_key IS 'Même valeur pour les élèves d''un binôme qui ont rempli ensemble. NULL si seul.';
COMMENT ON COLUMN public.student_works.content IS 'Réponses de l''élève, structure définie par activities.definition.';
COMMENT ON COLUMN public.student_works.version IS 'Nombre d''envois explicites (les sauvegardes de brouillon ne comptent pas).';
COMMENT ON COLUMN public.student_works.modified_after_correction IS 'TRUE si l''élève a renvoyé après une correction : la correction porte sur une version antérieure.';
COMMENT ON COLUMN public.student_works.correction IS 'Correction par question : points, critères cochés, remarque. Posée par Claude ou le prof.';
COMMENT ON COLUMN public.student_works.skills IS 'Niveaux de compétences (1 à 4) par compétence de la fiche.';
COMMENT ON COLUMN public.student_works.total_points IS 'Total sur activities.bareme_total, recalculé à partir de correction.';

CREATE INDEX IF NOT EXISTS idx_student_works_activity ON public.student_works(activity_id, class_id);
CREATE INDEX IF NOT EXISTS idx_student_works_student ON public.student_works(student_id);

ALTER TABLE public.student_works ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_works_user" ON public.student_works;
CREATE POLICY "student_works_user" ON public.student_works
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_student_works_updated_at ON public.student_works;
CREATE TRIGGER trg_student_works_updated_at
  BEFORE UPDATE ON public.student_works
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. Historique des envois
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_work_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id      uuid NOT NULL REFERENCES public.student_works(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  content      jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_work_versions IS 'Copie de chaque envoi explicite : rien n''est perdu si un élève renvoie une fiche vidée.';
CREATE INDEX IF NOT EXISTS idx_student_work_versions_work ON public.student_work_versions(work_id, version DESC);

ALTER TABLE public.student_work_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_work_versions_read" ON public.student_work_versions;
CREATE POLICY "student_work_versions_read" ON public.student_work_versions
  FOR SELECT USING (work_id IN (SELECT id FROM public.student_works WHERE user_id = auth.uid()));

-- ============================================================
-- 4. Lien activité → évaluation du carnet (une par classe)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_assessments (
  activity_id   uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  class_id      uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, class_id)
);

COMMENT ON TABLE public.activity_assessments IS 'Évaluation du carnet créée pour une activité et une classe : évite de la créer deux fois.';

ALTER TABLE public.activity_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_assessments_user" ON public.activity_assessments;
CREATE POLICY "activity_assessments_user" ON public.activity_assessments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. Helper interne : résout une liste de codes en élèves du même prof
--    Renvoie une erreur textuelle, ou NULL si tout va bien.
-- ============================================================
CREATE OR REPLACE FUNCTION public._student_work_resolve(p_codes text[])
RETURNS TABLE (err text, student_id uuid, user_id uuid, class_id uuid, pseudo text, class_name text, has_pap boolean, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes text[];
  v_n int;
  v_found int;
  v_teachers int;
BEGIN
  v_codes := ARRAY(SELECT DISTINCT c FROM unnest(p_codes) AS c);
  v_n := COALESCE(array_length(v_codes, 1), 0);
  IF v_n < 1 OR v_n > 3 THEN
    RETURN QUERY SELECT 'bad_count'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::text;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_codes) AS c WHERE c IS NULL OR c !~ '^\d{6}$') THEN
    RETURN QUERY SELECT 'invalid_code'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::text;
    RETURN;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT s.user_id) INTO v_found, v_teachers
  FROM students s
  WHERE s.student_code = ANY (v_codes) AND s.is_deleted = false;

  IF v_found <> v_n THEN
    RETURN QUERY SELECT 'invalid_code'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::text;
    RETURN;
  END IF;
  IF v_teachers <> 1 THEN
    RETURN QUERY SELECT 'different_teacher'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT NULL::text, s.id, s.user_id, s.class_id, s.pseudo, c.name, COALESCE(s.has_pap, false), s.student_code::text
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.student_code = ANY (v_codes) AND s.is_deleted = false
    ORDER BY s.pseudo;
END;
$$;

REVOKE ALL ON FUNCTION public._student_work_resolve(text[]) FROM public;

-- ============================================================
-- 6. RPC : connexion (1 à 3 codes, même prof)
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_work_login(p_codes text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_err text;
  v_students json;
BEGIN
  SELECT r.err INTO v_err FROM public._student_work_resolve(p_codes) r LIMIT 1;
  IF v_err IS NOT NULL THEN
    RETURN json_build_object('error', v_err);
  END IF;

  SELECT json_agg(json_build_object('code', r.code, 'pseudo', r.pseudo, 'class_name', r.class_name, 'has_pap', r.has_pap))
  INTO v_students
  FROM public._student_work_resolve(p_codes) r;

  RETURN json_build_object('students', v_students);
END;
$$;

REVOKE ALL ON FUNCTION public.student_work_login(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.student_work_login(text[]) TO anon, authenticated;
COMMENT ON FUNCTION public.student_work_login(text[]) IS
  'Connexion d''un élève ou d''un binôme (1 à 3 codes à 6 chiffres, tous du même prof). Renvoie pseudo et classe, rien d''autre.';

-- ============================================================
-- 7. RPC : reprendre une production (autre poste, autre jour)
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_work_get(p_code text, p_activity_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_user_id uuid;
  v_activity_id uuid;
  v_accepting boolean;
  v_row record;
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;
  SELECT s.id, s.user_id INTO v_student_id, v_user_id
  FROM students s WHERE s.student_code = p_code AND s.is_deleted = false;
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  SELECT a.id, a.accepting_submissions INTO v_activity_id, v_accepting
  FROM activities a WHERE a.user_id = v_user_id AND a.key = p_activity_key AND a.is_deleted = false;
  IF v_activity_id IS NULL THEN
    RETURN json_build_object('found', false, 'accepting', true);
  END IF;

  SELECT w.content, w.status, w.version, w.submitted_at, w.group_pseudos
  INTO v_row
  FROM student_works w WHERE w.activity_id = v_activity_id AND w.student_id = v_student_id AND w.is_deleted = false;

  IF NOT FOUND THEN
    RETURN json_build_object('found', false, 'accepting', v_accepting);
  END IF;
  RETURN json_build_object(
    'found', true, 'accepting', v_accepting,
    'content', v_row.content, 'status', v_row.status, 'version', v_row.version,
    'submitted_at', v_row.submitted_at, 'group_pseudos', to_json(v_row.group_pseudos)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_work_get(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.student_work_get(text, text) TO anon, authenticated;
COMMENT ON FUNCTION public.student_work_get(text, text) IS
  'Dernier état de la production d''un élève pour une activité, pour reprendre sur un autre poste. Ne renvoie jamais la correction.';

-- ============================================================
-- 8. RPC : sauvegarder (brouillon) ou envoyer une production
--    p_activity : { key, title, level, sequence, bareme_total, definition, definition_version }
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_work_save(p_codes text[], p_activity jsonb, p_content jsonb, p_submit boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- L'activité se crée chez ce prof au premier envoi ; la définition suit la version de l'application.
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
    RETURN json_build_object('error', 'closed');
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
$$;

REVOKE ALL ON FUNCTION public.student_work_save(text[], jsonb, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.student_work_save(text[], jsonb, jsonb, boolean) TO anon, authenticated;
COMMENT ON FUNCTION public.student_work_save(text[], jsonb, jsonb, boolean) IS
  'Sauvegarde (p_submit = false) ou envoi (p_submit = true) d''une fiche pour 1 à 3 codes élève. Crée l''activité chez le prof si besoin. Refuse si l''activité est fermée ou la production déjà validée.';
