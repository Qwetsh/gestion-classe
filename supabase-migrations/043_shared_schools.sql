-- ============================================================
-- Migration 043 : Collèges partagés — un élève, un code, plusieurs profs
-- ============================================================
-- Voir PLAN_college_partage.md.
--
-- Principe : chaque prof garde SA ligne `students` (RLS, requêtes, mobile inchangés).
-- Les lignes d'un même élève chez plusieurs profs pointent vers une `student_identities`
-- qui porte le code de connexion. `students.student_code` reste une copie dénormalisée
-- (non unique) du code de l'identité, pour ne pas casser l'affichage côté prof.
--
-- Le pseudo est commun : le modifier chez un prof le modifie chez tous.
--
-- Espace élève : un code peut désormais mener à plusieurs lignes (une par prof).
-- Les RPC élève prennent un `p_student_id` optionnel ; sans lui et s'il y a plusieurs
-- profs, `get_student_dashboard` renvoie la liste des choix.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Identités élève (porteuses du code)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code varchar(6) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS identity_id uuid REFERENCES student_identities(id);

-- Backfill : une identité par élève existant, avec son code actuel (déjà unique).
INSERT INTO student_identities (student_code, created_at)
SELECT s.student_code, s.created_at
FROM students s
WHERE s.identity_id IS NULL AND s.student_code IS NOT NULL
ON CONFLICT (student_code) DO NOTHING;

UPDATE students s
SET identity_id = i.id
FROM student_identities i
WHERE s.identity_id IS NULL AND i.student_code = s.student_code;

ALTER TABLE students ALTER COLUMN identity_id SET NOT NULL;

-- Le code n'est plus unique par ligne (plusieurs profs, même code) : il l'est par identité.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_student_code_key;
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_identity_id ON students(identity_id);
-- Un prof ne peut pas avoir deux fois le même élève.
CREATE UNIQUE INDEX IF NOT EXISTS students_one_per_teacher ON students(user_id, identity_id);

ALTER TABLE student_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers read identities of their students" ON student_identities;
CREATE POLICY "Teachers read identities of their students" ON student_identities FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s WHERE s.identity_id = student_identities.id AND s.user_id = auth.uid()));

-- ------------------------------------------------------------
-- 2. Triggers sur students
-- ------------------------------------------------------------

-- BEFORE INSERT : crée l'identité (nouvel élève) ou copie son code (élève importé).
-- Rattacher une identité existante n'est permis qu'à import_school_students
-- (drapeau de transaction), sinon n'importe quel prof pourrait s'approprier un code.
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code varchar(6);
  v_identity_id uuid;
BEGIN
  IF NEW.identity_id IS NOT NULL THEN
    IF current_setting('app.identity_import', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'identity_id ne peut être fourni que par import_school_students';
    END IF;
    SELECT student_code INTO v_code FROM student_identities WHERE id = NEW.identity_id;
    IF v_code IS NULL THEN
      RAISE EXCEPTION 'identité élève introuvable';
    END IF;
    NEW.student_code := v_code;
    RETURN NEW;
  END IF;

  -- Code proposé par le client : gardé seulement s'il est libre.
  v_code := NEW.student_code;
  IF v_code IS NULL OR v_code !~ '^\d{6}$'
     OR EXISTS (SELECT 1 FROM student_identities WHERE student_code = v_code) THEN
    LOOP
      v_code := LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM student_identities WHERE student_code = v_code);
    END LOOP;
  END IF;

  INSERT INTO student_identities (student_code) VALUES (v_code) RETURNING id INTO v_identity_id;
  NEW.identity_id := v_identity_id;
  NEW.student_code := v_code;
  RETURN NEW;
END;
$$;
-- (trg_generate_student_code existe déjà et pointe sur cette fonction)

-- BEFORE UPDATE : code et identité non modifiables par le client.
CREATE OR REPLACE FUNCTION lock_student_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.identity_id := OLD.identity_id;
  NEW.student_code := OLD.student_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_student_identity ON students;
CREATE TRIGGER trg_lock_student_identity
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION lock_student_identity();

-- AFTER UPDATE OF pseudo : pseudo commun à tous les profs de l'élève.
-- La propagation re-déclenche le trigger sur les autres lignes, mais le filtre
-- IS DISTINCT FROM arrête la récursion immédiatement.
CREATE OR REPLACE FUNCTION propagate_student_pseudo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students
  SET pseudo = NEW.pseudo, updated_at = now()
  WHERE identity_id = NEW.identity_id
    AND id <> NEW.id
    AND pseudo IS DISTINCT FROM NEW.pseudo;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_student_pseudo ON students;
CREATE TRIGGER trg_propagate_student_pseudo
  AFTER UPDATE OF pseudo ON students
  FOR EACH ROW
  WHEN (OLD.pseudo IS DISTINCT FROM NEW.pseudo)
  EXECUTE FUNCTION propagate_student_pseudo();

-- AFTER DELETE : purge de l'identité quand plus aucun prof n'a l'élève.
CREATE OR REPLACE FUNCTION purge_orphan_student_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM student_identities i
  WHERE i.id = OLD.identity_id
    AND NOT EXISTS (SELECT 1 FROM students s WHERE s.identity_id = OLD.identity_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_orphan_student_identity ON students;
CREATE TRIGGER trg_purge_orphan_student_identity
  AFTER DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION purge_orphan_student_identity();

-- ------------------------------------------------------------
-- 3. Collèges, membres, classes du collège
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  city text,
  uai varchar(8) UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_members (
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  subject text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, user_id)
);
-- MVP : un prof = un collège.
CREATE UNIQUE INDEX IF NOT EXISTS school_members_one_school ON school_members(user_id);

CREATE TABLE IF NOT EXISTS school_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year varchar(9) NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  name_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, school_year, name_key)
);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_class_id uuid
  REFERENCES school_classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_classes_school_class_id ON classes(school_class_id);

-- « 5e1 », « 5E1 », « 5ème 1 », « 5eme1 » → même clé « 5e1 ».
CREATE OR REPLACE FUNCTION school_class_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p_name, ''),
        'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç',
        'AAAEEEEIIOOUUUCaaaeeeeiioouuuc')),
      '[^a-z0-9]', '', 'g'),
    '^([0-9])eme', '\1e');
$$;

CREATE OR REPLACE FUNCTION set_school_class_name_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := trim(NEW.name);
  NEW.name_key := school_class_name_key(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_class_name_key ON school_classes;
CREATE TRIGGER trg_school_class_name_key
  BEFORE INSERT OR UPDATE OF name ON school_classes
  FOR EACH ROW EXECUTE FUNCTION set_school_class_name_key();

-- Une classe ne peut être rattachée qu'à une classe du collège de son prof
-- (sinon un inconnu pourrait glisser ses élèves dans la liste d'un autre collège).
CREATE OR REPLACE FUNCTION check_class_school_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM school_classes sc
    JOIN school_members m ON m.school_id = sc.school_id AND m.user_id = NEW.user_id
    WHERE sc.id = NEW.school_class_id
  ) THEN
    RAISE EXCEPTION 'classe du collège invalide pour ce professeur';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_class_school_link ON classes;
CREATE TRIGGER trg_check_class_school_link
  BEFORE INSERT OR UPDATE OF school_class_id ON classes
  FOR EACH ROW EXECUTE FUNCTION check_class_school_link();

-- RLS : lecture par les membres, aucune écriture directe (tout passe par les RPC).
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM school_members WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "Members read their school" ON schools;
CREATE POLICY "Members read their school" ON schools FOR SELECT
  USING (id = my_school_id());

DROP POLICY IF EXISTS "Members read their colleagues" ON school_members;
CREATE POLICY "Members read their colleagues" ON school_members FOR SELECT
  USING (school_id = my_school_id());

DROP POLICY IF EXISTS "Members read their school classes" ON school_classes;
CREATE POLICY "Members read their school classes" ON school_classes FOR SELECT
  USING (school_id = my_school_id());

-- ------------------------------------------------------------
-- 4. RPC côté prof
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_school_year()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM now()) >= 8 THEN
      EXTRACT(YEAR FROM now())::int || '-' || (EXTRACT(YEAR FROM now())::int + 1)
    ELSE
      (EXTRACT(YEAR FROM now())::int - 1) || '-' || EXTRACT(YEAR FROM now())::int
  END;
$$;

-- Liste publique (pour les profs connectés) : aucune donnée élève, aucun email.
CREATE OR REPLACE FUNCTION search_schools(p_query text DEFAULT '')
RETURNS TABLE (id uuid, name text, city text, uai varchar, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.city, s.uai, (SELECT count(*) FROM school_members m WHERE m.school_id = s.id)
  FROM schools s
  WHERE auth.uid() IS NOT NULL
    AND (
      coalesce(trim(p_query), '') = ''
      OR school_class_name_key(s.name || ' ' || coalesce(s.city, '') || ' ' || coalesce(s.uai, ''))
         LIKE '%' || school_class_name_key(p_query) || '%'
    )
  ORDER BY s.name
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION get_my_school()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'city', s.city,
    'uai', s.uai,
    'my_role', me.role,
    'my_display_name', me.display_name,
    'my_subject', me.subject,
    'members', (
      SELECT json_agg(json_build_object(
        'user_id', m.user_id,
        'display_name', m.display_name,
        'subject', m.subject,
        'role', m.role,
        'joined_at', m.joined_at,
        'is_me', m.user_id = auth.uid()
      ) ORDER BY m.joined_at)
      FROM school_members m WHERE m.school_id = s.id
    )
  )
  FROM school_members me
  JOIN schools s ON s.id = me.school_id
  WHERE me.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION create_school(
  p_name text, p_city text, p_uai text, p_display_name text, p_subject text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uai text := nullif(upper(trim(coalesce(p_uai, ''))), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  IF v_uai IS NOT NULL AND EXISTS (SELECT 1 FROM schools WHERE uai = v_uai) THEN
    RAISE EXCEPTION 'uai_taken';
  END IF;

  INSERT INTO schools (name, city, uai, created_by)
  VALUES (trim(p_name), nullif(trim(coalesce(p_city, '')), ''), v_uai, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO school_members (school_id, user_id, display_name, subject, role)
  VALUES (v_id, auth.uid(), trim(p_display_name), nullif(trim(coalesce(p_subject, '')), ''), 'admin');

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION join_school(p_school_id uuid, p_display_name text, p_subject text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'school_not_found';
  END IF;

  INSERT INTO school_members (school_id, user_id, display_name, subject)
  VALUES (p_school_id, auth.uid(), trim(p_display_name), nullif(trim(coalesce(p_subject, '')), ''));
END;
$$;

CREATE OR REPLACE FUNCTION update_my_school_profile(p_display_name text, p_subject text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE school_members
  SET display_name = trim(p_display_name), subject = nullif(trim(coalesce(p_subject, '')), '')
  WHERE user_id = auth.uid();
$$;

-- Retire un membre (soi-même ou, pour l'admin, un autre) : ses classes sont détachées
-- du collège. Ses élèves déjà importés restent chez lui (les codes ne sont pas révoqués).
CREATE OR REPLACE FUNCTION remove_school_member(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_school uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT school_id INTO v_school FROM school_members WHERE user_id = v_target;
  IF v_school IS NULL THEN RETURN; END IF;

  IF v_target <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM school_members WHERE school_id = v_school AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE classes SET school_class_id = NULL
  WHERE user_id = v_target AND school_class_id IS NOT NULL;

  DELETE FROM school_members WHERE school_id = v_school AND user_id = v_target;

  IF NOT EXISTS (SELECT 1 FROM school_members WHERE school_id = v_school) THEN
    DELETE FROM schools WHERE id = v_school;
  ELSIF NOT EXISTS (SELECT 1 FROM school_members WHERE school_id = v_school AND role = 'admin') THEN
    UPDATE school_members SET role = 'admin'
    WHERE school_id = v_school
      AND user_id = (SELECT user_id FROM school_members WHERE school_id = v_school ORDER BY joined_at LIMIT 1);
  END IF;
END;
$$;

-- Classes du collège pour une année, avec nb d'élèves et profs qui l'ont.
CREATE OR REPLACE FUNCTION list_school_classes(p_school_year text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, school_year varchar, student_count bigint, teachers text[], mine boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sc.id,
    sc.name,
    sc.school_year,
    (SELECT count(DISTINCT s.identity_id)
       FROM classes c
       JOIN students s ON s.class_id = c.id AND NOT s.is_deleted AND NOT s.is_witness
      WHERE c.school_class_id = sc.id AND NOT coalesce(c.is_deleted, false)),
    (SELECT array_agg(DISTINCT m.display_name)
       FROM classes c
       JOIN school_members m ON m.user_id = c.user_id AND m.school_id = sc.school_id
      WHERE c.school_class_id = sc.id AND NOT coalesce(c.is_deleted, false)),
    EXISTS (SELECT 1 FROM classes c
             WHERE c.school_class_id = sc.id AND c.user_id = auth.uid() AND NOT coalesce(c.is_deleted, false))
  FROM school_classes sc
  WHERE sc.school_id = my_school_id()
    AND sc.school_year = coalesce(p_school_year, current_school_year())
  ORDER BY sc.name_key;
$$;

-- Rattache une de mes classes à une classe du collège (existante, ou créée par son nom).
-- Les deux paramètres NULL = détacher.
CREATE OR REPLACE FUNCTION link_class_to_school_class(
  p_class_id uuid,
  p_school_class_id uuid DEFAULT NULL,
  p_new_name text DEFAULT NULL,
  p_school_year text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid := my_school_id();
  v_sc uuid := p_school_class_id;
BEGIN
  IF v_school IS NULL THEN RAISE EXCEPTION 'not_member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  IF v_sc IS NULL AND coalesce(trim(p_new_name), '') <> '' THEN
    -- ON CONFLICT : deux profs qui créent « 5e1 » en même temps obtiennent la même classe.
    INSERT INTO school_classes (school_id, school_year, name, name_key)
    VALUES (v_school, coalesce(p_school_year, current_school_year()), p_new_name, school_class_name_key(p_new_name))
    ON CONFLICT (school_id, school_year, name_key) DO UPDATE SET name = school_classes.name
    RETURNING id INTO v_sc;
  ELSIF v_sc IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM school_classes WHERE id = v_sc AND school_id = v_school
  ) THEN
    RAISE EXCEPTION 'school_class_not_found';
  END IF;

  UPDATE classes SET school_class_id = v_sc, updated_at = now() WHERE id = p_class_id;
  RETURN v_sc;
END;
$$;

-- Élèves d'une classe du collège (union des profs qui l'ont rattachée).
-- Pas de code élève ici : on ne l'obtient qu'en important l'élève.
CREATE OR REPLACE FUNCTION list_school_class_students(p_school_class_id uuid)
RETURNS TABLE (
  identity_id uuid, pseudo text, gender varchar,
  has_pap boolean, has_ppre boolean, has_pai boolean,
  already_mine boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (s.identity_id)
    s.identity_id, s.pseudo, s.gender, s.has_pap, s.has_ppre, s.has_pai,
    EXISTS (SELECT 1 FROM students mine
             WHERE mine.identity_id = s.identity_id AND mine.user_id = auth.uid() AND NOT mine.is_deleted)
  FROM school_classes sc
  JOIN classes c ON c.school_class_id = sc.id AND NOT coalesce(c.is_deleted, false)
  JOIN students s ON s.class_id = c.id AND NOT s.is_deleted AND NOT s.is_witness
  WHERE sc.id = p_school_class_id
    AND sc.school_id = my_school_id()
  ORDER BY s.identity_id, s.created_at;
$$;

-- Importe des élèves du collège dans une de mes classes : crée MES lignes students,
-- rattachées aux mêmes identités (même code). Pseudo, genre et PAP/PPRE/PAI copiés.
CREATE OR REPLACE FUNCTION import_school_students(p_target_class_id uuid, p_identity_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid := my_school_id();
  v_imported int;
  v_requested int := coalesce(array_length(p_identity_ids, 1), 0);
BEGIN
  IF v_school IS NULL THEN RAISE EXCEPTION 'not_member'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM classes WHERE id = p_target_class_id AND user_id = auth.uid() AND NOT coalesce(is_deleted, false)
  ) THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  PERFORM set_config('app.identity_import', 'on', true);

  WITH allowed AS (
    -- Identités visibles dans une classe de MON collège, hors élèves déjà chez moi.
    SELECT DISTINCT ON (s.identity_id)
      s.identity_id, s.pseudo, s.gender, s.has_pap, s.has_ppre, s.has_pai
    FROM students s
    JOIN classes c ON c.id = s.class_id AND NOT coalesce(c.is_deleted, false)
    JOIN school_classes sc ON sc.id = c.school_class_id AND sc.school_id = v_school
    WHERE s.identity_id = ANY (p_identity_ids)
      AND NOT s.is_deleted
      AND NOT s.is_witness
    ORDER BY s.identity_id, s.created_at
  ),
  ins AS (
    INSERT INTO students (user_id, class_id, pseudo, gender, has_pap, has_ppre, has_pai, identity_id)
    SELECT auth.uid(), p_target_class_id, a.pseudo, a.gender, a.has_pap, a.has_ppre, a.has_pai, a.identity_id
    FROM allowed a
    ON CONFLICT (user_id, identity_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_imported FROM ins;

  PERFORM set_config('app.identity_import', 'off', true);

  RETURN json_build_object('imported', v_imported, 'skipped', v_requested - v_imported);
END;
$$;

-- Les RPC prof ne servent à rien sans compte : on les retire à anon.
REVOKE EXECUTE ON FUNCTION search_schools(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION get_my_school() FROM anon, public;
REVOKE EXECUTE ON FUNCTION create_school(text, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION join_school(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION update_my_school_profile(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION remove_school_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION list_school_classes(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION link_class_to_school_class(uuid, uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION list_school_class_students(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION import_school_students(uuid, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION search_schools(text), get_my_school(),
  create_school(text, text, text, text, text), join_school(uuid, text, text),
  update_my_school_profile(text, text), remove_school_member(uuid),
  list_school_classes(text), link_class_to_school_class(uuid, uuid, text, text),
  list_school_class_students(uuid), import_school_students(uuid, uuid[])
  TO authenticated;

-- ------------------------------------------------------------
-- 5. Espace élève : un code, plusieurs profs
-- ------------------------------------------------------------

-- Les « espaces » d'un code : une entrée par prof qui a l'élève.
CREATE OR REPLACE FUNCTION get_student_spaces(p_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(json_agg(json_build_object(
    'student_id', s.id,
    'teacher', coalesce(m.display_name, 'Professeur'),
    'subject', m.subject,
    'class_name', c.name
  ) ORDER BY m.subject NULLS LAST, s.created_at), '[]'::json)
  FROM students s
  JOIN classes c ON c.id = s.class_id AND NOT coalesce(c.is_deleted, false)
  LEFT JOIN school_members m ON m.user_id = s.user_id
  WHERE p_code ~ '^\d{6}$'
    AND s.student_code = p_code
    AND NOT s.is_deleted;
$$;

-- Résout (code, student_id?) → ligne students. NULL si code invalide, si l'id ne
-- correspond pas au code (on ne fait jamais confiance à l'id seul), ou si le code
-- mène à plusieurs profs sans que l'élève ait choisi.
CREATE OR REPLACE FUNCTION resolve_student_code(p_code text, p_student_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN RETURN NULL; END IF;

  SELECT array_agg(s.id ORDER BY s.created_at) INTO v_ids
  FROM students s
  JOIN classes c ON c.id = s.class_id AND NOT coalesce(c.is_deleted, false)
  WHERE s.student_code = p_code AND NOT s.is_deleted;

  IF v_ids IS NULL THEN RETURN NULL; END IF;
  IF p_student_id IS NOT NULL THEN
    RETURN CASE WHEN p_student_id = ANY (v_ids) THEN p_student_id END;
  END IF;
  IF array_length(v_ids, 1) = 1 THEN RETURN v_ids[1]; END IF;
  RETURN NULL;
END;
$$;

-- get_student_dashboard ---------------------------------------
DROP FUNCTION IF EXISTS get_student_dashboard(text);
CREATE FUNCTION get_student_dashboard(p_code text, p_student_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_pseudo text;
  v_class_id uuid;
  v_user_id uuid;
  v_class_name text;
  v_trimester int;
  v_school_year text;
  v_trim_start timestamptz;
  v_is_witness boolean;
  v_show_stamps boolean;
  v_show_annales boolean;
  v_spaces json;
  v_result json;
BEGIN
  IF p_code IS NULL OR LENGTH(p_code) != 6 OR p_code !~ '^\d{6}$' THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  v_student_id := resolve_student_code(p_code, p_student_id);

  IF v_student_id IS NULL THEN
    -- Plusieurs profs et pas encore de choix : on renvoie la liste.
    IF p_student_id IS NULL THEN
      v_spaces := get_student_spaces(p_code);
      IF json_array_length(v_spaces) > 1 THEN
        RETURN json_build_object('error', 'choose_space', 'spaces', v_spaces);
      END IF;
    END IF;
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  SELECT s.pseudo, s.class_id, s.user_id, c.name, s.is_witness
  INTO v_pseudo, v_class_id, v_user_id, v_class_name, v_is_witness
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.id = v_student_id;

  SELECT cst.show_stamps, cst.show_annales
  INTO v_show_stamps, v_show_annales
  FROM class_student_tabs cst
  WHERE cst.class_id = v_class_id;

  v_show_stamps := COALESCE(v_show_stamps, false);
  v_show_annales := COALESCE(v_show_annales, false);

  IF v_is_witness THEN
    v_show_stamps := true;
    v_show_annales := true;
  END IF;

  IF NOT v_is_witness THEN
    IF NOT EXISTS (
      SELECT 1 FROM student_connections
      WHERE student_id = v_student_id
        AND connected_at > NOW() - INTERVAL '30 minutes'
    ) THEN
      INSERT INTO student_connections (student_id) VALUES (v_student_id);
    END IF;
  END IF;

  SELECT current_trimester, school_year
  INTO v_trimester, v_school_year
  FROM trimester_settings
  WHERE user_id = v_user_id;

  IF v_trimester IS NULL THEN
    v_trimester := 1;
    v_school_year := CASE
      WHEN EXTRACT(MONTH FROM NOW()) >= 9 THEN
        EXTRACT(YEAR FROM NOW())::text || '-' || (EXTRACT(YEAR FROM NOW()) + 1)::text
      ELSE
        (EXTRACT(YEAR FROM NOW()) - 1)::text || '-' || EXTRACT(YEAR FROM NOW())::text
    END;
  END IF;

  SELECT started_at INTO v_trim_start
  FROM trimester_boundaries
  WHERE user_id = v_user_id
    AND trimester = v_trimester
    AND school_year = v_school_year;

  WITH student_events AS (
    SELECT
      e.student_id,
      COUNT(*) FILTER (WHERE e.type = 'participation') as participations,
      COUNT(*) FILTER (WHERE e.type = 'bavardage') as bavardages,
      COUNT(*) FILTER (WHERE e.type = 'absence') as absences
    FROM events e
    JOIN students st ON st.id = e.student_id
    WHERE st.user_id = v_user_id
      AND (v_trim_start IS NULL OR e.timestamp >= v_trim_start)
    GROUP BY e.student_id
  ),
  student_manual AS (
    SELECT student_id, COALESCE(SUM(count), 0)::int as manual_count
    FROM manual_participations
    WHERE student_id IN (SELECT id FROM students WHERE user_id = v_user_id)
      AND trimester = v_trimester
      AND school_year = v_school_year
    GROUP BY student_id
  ),
  all_students AS (
    SELECT
      s.id,
      s.class_id,
      s.is_witness,
      COALESCE(se.participations, 0)::int as participations,
      COALESCE(se.bavardages, 0)::int as bavardages,
      COALESCE(se.absences, 0)::int as absences,
      COALESCE(sm.manual_count, 0)::int as manual_participations,
      COALESCE(cfg.target_participations, 15)::int as target,
      COALESCE(cfg.total_sessions_expected, 60)::int as sessions_expected,
      COALESCE(cfg.bavardage_penalty, false) as bav_penalty,
      cfg.base_grade
    FROM students s
    LEFT JOIN student_events se ON se.student_id = s.id
    LEFT JOIN student_manual sm ON sm.student_id = s.id
    LEFT JOIN class_trimester_config cfg ON cfg.class_id = s.class_id
    WHERE s.user_id = v_user_id
  ),
  graded_students AS (
    SELECT
      id,
      class_id,
      is_witness,
      participations,
      bavardages,
      absences,
      manual_participations,
      target,
      CASE
        WHEN base_grade IS NOT NULL AND base_grade > 0 THEN
          LEAST(20, GREATEST(0,
            base_grade + (participations + manual_participations) -
            CASE WHEN bav_penalty THEN bavardages ELSE 0 END
          ))
        ELSE
          LEAST(20, GREATEST(0,
            (GREATEST(0, (participations + manual_participations) - CASE WHEN bav_penalty THEN bavardages ELSE 0 END)::numeric /
            GREATEST(1, target - (absences * (target::numeric / sessions_expected)))
            ) * 20
          ))
      END as grade,
      CASE
        WHEN base_grade IS NOT NULL AND base_grade > 0 THEN
          GREATEST(0,
            base_grade + (participations + manual_participations) -
            CASE WHEN bav_penalty THEN bavardages ELSE 0 END
          )
        ELSE
          GREATEST(0,
            (GREATEST(0, (participations + manual_participations) - CASE WHEN bav_penalty THEN bavardages ELSE 0 END)::numeric /
            GREATEST(1, target - (absences * (target::numeric / sessions_expected)))
            ) * 20
          )
      END as raw_score
    FROM all_students
  ),
  class_ranked AS (
    SELECT
      id,
      grade,
      RANK() OVER (ORDER BY raw_score DESC, (participations + manual_participations)::numeric / GREATEST(1, bavardages) DESC) as rank,
      COUNT(*) OVER () as total
    FROM graded_students
    WHERE class_id = v_class_id
      AND NOT is_witness
  ),
  overall_ranked AS (
    SELECT
      id,
      grade,
      RANK() OVER (ORDER BY raw_score DESC, (participations + manual_participations)::numeric / GREATEST(1, bavardages) DESC) as rank,
      COUNT(*) OVER () as total
    FROM graded_students
    WHERE NOT is_witness
  ),
  class_averages AS (
    SELECT
      gs.class_id,
      c.name as class_name,
      ROUND(AVG(gs.grade), 1) as avg_grade,
      COUNT(*) as student_count
    FROM graded_students gs
    JOIN classes c ON c.id = gs.class_id
    WHERE NOT gs.is_witness
    GROUP BY gs.class_id, c.name
  ),
  classes_ranked AS (
    SELECT
      class_id,
      class_name,
      avg_grade,
      student_count,
      RANK() OVER (ORDER BY avg_grade DESC) as rank,
      COUNT(*) OVER () as total
    FROM class_averages
  )
  SELECT json_build_object(
    'student_id', v_student_id,
    'pseudo', v_pseudo,
    'class_name', v_class_name,
    'trimester', v_trimester,
    'school_year', v_school_year,
    'is_witness', v_is_witness,
    'tabs', json_build_object('stamps', v_show_stamps, 'annales', v_show_annales),
    'grade', ROUND(COALESCE((SELECT grade FROM graded_students WHERE id = v_student_id), 0), 1),
    'participations', COALESCE((SELECT participations + manual_participations FROM graded_students WHERE id = v_student_id), 0),
    'bavardages', COALESCE((SELECT bavardages FROM graded_students WHERE id = v_student_id), 0),
    'absences', COALESCE((SELECT absences FROM graded_students WHERE id = v_student_id), 0),
    'target', COALESCE((SELECT target FROM graded_students WHERE id = v_student_id), 15),
    'class_rank', COALESCE((SELECT rank FROM class_ranked WHERE id = v_student_id), 0),
    'class_total', COALESCE((SELECT total FROM class_ranked LIMIT 1), 0),
    'overall_rank', COALESCE((SELECT rank FROM overall_ranked WHERE id = v_student_id), 0),
    'overall_total', COALESCE((SELECT total FROM overall_ranked LIMIT 1), 0),
    'top10_class', COALESCE(
      (SELECT json_agg(json_build_object('rank', rank, 'grade', ROUND(grade, 1)))
       FROM (SELECT rank, grade FROM class_ranked ORDER BY rank LIMIT 10) t),
      '[]'::json
    ),
    'top10_overall', COALESCE(
      (SELECT json_agg(json_build_object('rank', rank, 'grade', ROUND(grade, 1)))
       FROM (SELECT rank, grade FROM overall_ranked ORDER BY rank LIMIT 10) t),
      '[]'::json
    ),
    'my_class_rank_among_classes', COALESCE((SELECT rank FROM classes_ranked WHERE class_id = v_class_id), 0),
    'total_classes', COALESCE((SELECT total FROM classes_ranked LIMIT 1), 0),
    'my_class_avg', COALESCE((SELECT avg_grade FROM classes_ranked WHERE class_id = v_class_id), 0),
    'all_classes_ranking', COALESCE(
      (SELECT json_agg(json_build_object('rank', rank, 'class_name', class_name, 'avg_grade', avg_grade, 'student_count', student_count))
       FROM (SELECT rank, class_name, avg_grade, student_count FROM classes_ranked ORDER BY rank) t),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- get_student_stamps ------------------------------------------
DROP FUNCTION IF EXISTS get_student_stamps(varchar);
CREATE FUNCTION get_student_stamps(p_code varchar, p_student_id uuid DEFAULT NULL)
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

  -- Check if student has an active card (or completed-without-bonus)
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

  -- If no active card, auto-create next card from highest card_number (any status)
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

-- select_student_bonus ----------------------------------------
DROP FUNCTION IF EXISTS select_student_bonus(varchar, uuid);
CREATE FUNCTION select_student_bonus(p_code varchar, p_bonus_id uuid, p_student_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  v_card_id UUID;
  v_card_number INTEGER;
  v_stamp_count INTEGER;
  v_existing_selection UUID;
BEGIN
  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'Code invalide');
  END IF;
  SELECT user_id INTO v_user_id FROM students WHERE id = v_student_id;

  SELECT sc.id, sc.card_number INTO v_card_id, v_card_number
  FROM stamp_cards sc
  WHERE sc.student_id = v_student_id AND sc.status = 'active'
  LIMIT 1;

  IF v_card_id IS NULL THEN
    RETURN json_build_object('error', 'Aucune carte active');
  END IF;

  SELECT COUNT(*) INTO v_stamp_count FROM stamps WHERE card_id = v_card_id;
  IF v_stamp_count < 10 THEN
    RETURN json_build_object('error', 'Carte non complète');
  END IF;

  SELECT id INTO v_existing_selection FROM bonus_selections WHERE card_id = v_card_id;
  IF v_existing_selection IS NOT NULL THEN
    RETURN json_build_object('error', 'Bonus déjà sélectionné pour cette carte');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bonuses WHERE id = p_bonus_id AND user_id = v_user_id AND is_active = true) THEN
    RETURN json_build_object('error', 'Bonus invalide');
  END IF;

  UPDATE stamp_cards SET status = 'completed', completed_at = NOW(), synced_at = NULL
  WHERE id = v_card_id;

  INSERT INTO bonus_selections (student_id, user_id, card_id, bonus_id, selected_at)
  VALUES (v_student_id, v_user_id, v_card_id, p_bonus_id, NOW());

  INSERT INTO stamp_cards (student_id, user_id, card_number, status)
  VALUES (v_student_id, v_user_id, v_card_number + 1, 'active');

  RETURN json_build_object(
    'success', true,
    'new_card_number', v_card_number + 1
  );
END;
$$;

-- get_student_academy -----------------------------------------
-- (corrige au passage la référence à une colonne inexistante `access_code`)
DROP FUNCTION IF EXISTS get_student_academy(text);
CREATE FUNCTION get_student_academy(p_code text, p_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_is_witness BOOLEAN;
  v_enabled BOOLEAN;
  v_test_completed BOOLEAN;
  v_house TEXT;
  v_house_points JSONB;
BEGIN
  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  SELECT s.class_id, s.is_witness INTO v_class_id, v_is_witness
  FROM students s WHERE s.id = v_student_id;

  SELECT ac.enabled INTO v_enabled
  FROM academy_config ac WHERE ac.class_id = v_class_id;

  IF v_is_witness THEN
    v_enabled := true;
  END IF;

  IF v_enabled IS NULL OR v_enabled = false THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM academy_responses WHERE student_id = v_student_id LIMIT 1
  ) INTO v_test_completed;

  SELECT aa.house INTO v_house
  FROM academy_assignments aa
  WHERE aa.student_id = v_student_id AND aa.class_id = v_class_id;

  SELECT jsonb_object_agg(h, COALESCE(pts, 0)) INTO v_house_points
  FROM (VALUES ('gryffondor'), ('serpentard'), ('serdaigle'), ('poufsouffle')) AS houses(h)
  LEFT JOIN (
    SELECT ahb.house, SUM(ahb.points) AS pts
    FROM academy_house_bonuses ahb
    WHERE ahb.class_id = v_class_id AND ahb.visible = true
    GROUP BY ahb.house
  ) b ON b.house = houses.h;

  RETURN jsonb_build_object(
    'enabled', true,
    'student_id', v_student_id,
    'class_id', v_class_id,
    'test_completed', v_test_completed,
    'house', v_house,
    'house_points', COALESCE(v_house_points, '{}'::jsonb)
  );
END;
$$;

-- submit_academy_test -----------------------------------------
DROP FUNCTION IF EXISTS submit_academy_test(text, jsonb, jsonb);
CREATE FUNCTION submit_academy_test(p_code text, p_responses jsonb, p_preferences jsonb, p_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_resp JSONB;
  v_pref JSONB;
BEGIN
  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  SELECT s.class_id INTO v_class_id FROM students s WHERE s.id = v_student_id;

  IF NOT EXISTS (
    SELECT 1 FROM academy_config ac
    WHERE ac.class_id = v_class_id AND ac.enabled = true
  ) THEN
    RETURN jsonb_build_object('error', 'module_not_enabled');
  END IF;

  IF EXISTS(SELECT 1 FROM academy_responses WHERE student_id = v_student_id) THEN
    RETURN jsonb_build_object('error', 'already_submitted');
  END IF;

  FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responses) LOOP
    INSERT INTO academy_responses (student_id, question_id, answer_id)
    VALUES (v_student_id, (v_resp->>'question_id')::UUID, (v_resp->>'answer_id')::UUID);
  END LOOP;

  FOR v_pref IN SELECT * FROM jsonb_array_elements(p_preferences) LOOP
    INSERT INTO academy_preferences (student_id, house, rank)
    VALUES (v_student_id, v_pref->>'house', (v_pref->>'rank')::INTEGER);
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- get_student_grades ------------------------------------------
DROP FUNCTION IF EXISTS get_student_grades(text);
CREATE FUNCTION get_student_grades(p_code text, p_student_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_class_id uuid;
  v_pseudo text;
  v_is_witness boolean;
  v_show_grades boolean;
  v_rows json;
BEGIN
  IF p_code IS NULL OR LENGTH(p_code) != 6 OR p_code !~ '^\d{6}$' THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  v_student_id := resolve_student_code(p_code, p_student_id);
  IF v_student_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');
  END IF;

  SELECT s.class_id, s.pseudo, COALESCE(s.is_witness, false)
  INTO v_class_id, v_pseudo, v_is_witness
  FROM students s
  WHERE s.id = v_student_id;

  SELECT cst.show_grades INTO v_show_grades
  FROM class_student_tabs cst
  WHERE cst.class_id = v_class_id;

  v_show_grades := COALESCE(v_show_grades, false) OR v_is_witness;

  IF NOT v_show_grades THEN
    RETURN json_build_object('enabled', false, 'assessments', '[]'::json);
  END IF;

  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.period, r.date NULLS LAST, r.name), '[]'::json)
  INTO v_rows
  FROM (
    SELECT
      a.id,
      a.name,
      a.subject,
      a.date,
      a.period,
      a.kind,
      a.coefficient,
      a.bareme_total,
      a.counts_in_average,
      g.grade,
      g.grade_raw,
      g.comment,
      COALESCE(g.status, 'noted') AS status,
      (COALESCE(a.subject_path, se.subject_path) IS NOT NULL)       AS has_subject,
      (COALESCE(a.correction_path, se.correction_path) IS NOT NULL) AS has_correction
    FROM written_assessments a
    LEFT JOIN assessment_series se ON se.id = a.series_id
    LEFT JOIN assessment_grades g
      ON g.assessment_id = a.id AND g.student_id = v_student_id
    WHERE a.class_id = v_class_id
      AND a.is_deleted = false
      AND a.published_to_students = true
  ) r;

  RETURN json_build_object(
    'enabled', true,
    'pseudo', v_pseudo,
    'assessments', v_rows
  );
END;
$$;
