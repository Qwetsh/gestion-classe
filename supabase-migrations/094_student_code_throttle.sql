-- 094 — Frein sur les essais de codes élèves
--
-- Le code élève (6 chiffres) est le seul secret de l'espace élève, et rien ne limitait les essais :
-- un script pouvait parcourir le million de codes en quelques heures et lire notes et copies.
--
-- Ce que fait cette migration :
--   * chaque code inconnu essayé est noté, par adresse (jamais le code lui-même : son empreinte) ;
--   * au-delà de 30 codes inconnus différents en 10 minutes, ou de 100 en 24 heures, l'adresse
--     n'obtient plus aucune réponse utile, même avec un code valide, jusqu'à ce que la fenêtre passe ;
--   * la première fois qu'une adresse est suspendue, une ligne part dans error_logs (panneau Dev).
--
-- Seuils : un collège entier sort par une seule adresse. Six classes qui se trompent une fois sur
-- dix font une vingtaine de codes inconnus par jour ; on reste loin de 100.
--
-- Deux choses à savoir avant de toucher à ces fonctions :
--   * L'adresse vient de l'en-tête cf-connecting-ip, que le client ne peut pas falsifier (essayé le
--     26/11/2026 : la passerelle refuse la requête). Le premier élément de x-forwarded-for, lui, est
--     écrit par le client : ne jamais s'y fier.
--   * Une fonction STABLE appelée par l'API tourne en lecture seule : l'échec ne pourrait pas être
--     noté. Toutes les portes d'entrée sont donc VOLATILE, et un appel en lecture seule (GET) est
--     refusé d'office. Toute nouvelle fonction élève doit être VOLATILE et passer par
--     resolve_student_code, _student_work_resolve ou _student_code_gate.
--
-- Rejouable.

create table if not exists public.student_code_failures (
  id bigint generated always as identity primary key,
  ip text not null,
  code_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_code_failures_ip_idx
  on public.student_code_failures (ip, created_at desc);

-- Aucune politique : la table n'est lue et écrite que par les fonctions ci-dessous.
alter table public.student_code_failures enable row level security;
revoke all on public.student_code_failures from anon, authenticated;

-- Clé de comptage : l'adresse IPv4, ou le préfixe /64 en IPv6 (un abonné dispose de tout le /64).
create or replace function public._student_code_ip_key(p_raw text)
 returns text
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare
  v inet;
begin
  if p_raw is null or btrim(p_raw) = '' then return null; end if;
  begin
    v := btrim(p_raw)::inet;
  exception when others then
    return null;
  end;
  if family(v) = 6 then
    return host(network(set_masklen(v, 64))) || '/64';
  end if;
  return host(v);
end;
$function$;

-- Adresse de l'appelant quand il passe par l'API. NULL = pas de frein :
-- SQL direct, tâche planifiée, ou fonction serveur (qui transmet l'adresse elle-même).
create or replace function public._student_code_client_ip()
 returns text
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_headers json;
  v_xff text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if v_headers is null then return null; end if;
  if coalesce(auth.role(), '') = 'service_role' then return null; end if;

  v_xff := v_headers ->> 'x-forwarded-for';
  return coalesce(
    _student_code_ip_key(v_headers ->> 'cf-connecting-ip'),
    -- Dernier élément : celui qu'ajoute la passerelle. Le premier est écrit par le client.
    _student_code_ip_key(split_part(v_xff, ',', greatest(1, cardinality(string_to_array(coalesce(v_xff, ''), ','))))),
    -- Adresse illisible : tout le monde dans le même panier plutôt que personne freiné.
    'inconnue'
  );
end;
$function$;

-- La porte. Renvoie true si l'appel doit être traité comme un code invalide.
-- p_ip : adresse transmise par une fonction serveur (qui appelle la base avec la clé de service).
create or replace function public._student_code_gate(p_codes text[], p_ip text default null)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_key text;
  v_code text;
  v_hash text;
begin
  v_key := coalesce(_student_code_ip_key(p_ip), _student_code_client_ip());
  if v_key is null then return false; end if;

  -- Lecture seule : l'échec ne pourrait pas être noté, donc pas de réponse du tout.
  if current_setting('transaction_read_only', true) = 'on' then return true; end if;

  if (select count(distinct f.code_hash) from student_code_failures f
       where f.ip = v_key and f.created_at > now() - interval '10 minutes') >= 30
     or (select count(distinct f.code_hash) from student_code_failures f
          where f.ip = v_key and f.created_at > now() - interval '24 hours') >= 100
  then
    insert into error_logs (error_message, error_stack, page_url)
    select 'Codes élèves : trop d''essais depuis une même adresse, accès suspendu', v_key, 'student_code_gate'
    where not exists (
      select 1 from error_logs e
       where e.page_url = 'student_code_gate' and e.error_stack = v_key
         and e.created_at > now() - interval '24 hours'
    );
    return true;
  end if;

  for v_code in select distinct c from unnest(p_codes) as c where c ~ '^\d{6}$' loop
    if not exists (select 1 from students s where s.student_code = v_code and not s.is_deleted) then
      v_hash := md5(v_code);
      -- Un même code inconnu redemandé (page rechargée, interrogation périodique) ne compte qu'une fois.
      insert into student_code_failures (ip, code_hash)
      select v_key, v_hash
      where not exists (
        select 1 from student_code_failures f
         where f.ip = v_key and f.code_hash = v_hash and f.created_at > now() - interval '10 minutes'
      );
    end if;
  end loop;

  return false;
end;
$function$;

revoke execute on function public._student_code_ip_key(text) from public, anon, authenticated;
revoke execute on function public._student_code_client_ip() from public, anon, authenticated;
revoke execute on function public._student_code_gate(text[], text) from public, anon, authenticated;
grant execute on function public._student_code_gate(text[], text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Les six fonctions qui lisent students.student_code passent par la porte.
-- Corps repris tels quels de la production (pg_get_functiondef, 26/11/2026), une ligne ajoutée.
-- ---------------------------------------------------------------------------------------------

create or replace function public.resolve_student_code(p_code text, p_student_id uuid default null::uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN RETURN NULL; END IF;
  IF _student_code_gate(ARRAY[p_code]) THEN RETURN NULL; END IF;

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
$function$;

create or replace function public.get_student_spaces(p_code text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN RETURN '[]'::json; END IF;
  IF _student_code_gate(ARRAY[p_code]) THEN RETURN '[]'::json; END IF;

  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'student_id', s.id,
      'teacher', coalesce(m.display_name, 'Professeur'),
      'subject', m.subject,
      'class_name', c.name
    ) ORDER BY m.subject NULLS LAST, s.created_at), '[]'::json)
    FROM students s
    JOIN classes c ON c.id = s.class_id AND NOT coalesce(c.is_deleted, false)
    LEFT JOIN school_members m ON m.user_id = s.user_id
    WHERE s.student_code = p_code
      AND NOT s.is_deleted
  );
END;
$function$;

create or replace function public._student_work_resolve(p_codes text[])
 returns table(err text, student_id uuid, user_id uuid, class_id uuid, pseudo text, class_name text, has_pap boolean, code text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  IF _student_code_gate(v_codes) THEN
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
$function$;

create or replace function public.student_work_get(p_code text, p_activity_key text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  IF _student_code_gate(ARRAY[p_code]) THEN
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
$function$;

create or replace function public.student_live_messages(p_codes text[], p_activity_key text, p_since timestamp with time zone default null::timestamp with time zone)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  IF _student_code_gate(p_codes) THEN
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
$function$;

create or replace function public.student_live_points(p_codes text[], p_activity_key text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  IF _student_code_gate(p_codes) THEN
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
$function$;

-- Portes d'entrée encore STABLE : en lecture seule, la porte les refuserait toutes.
alter function public.get_student_tp(text, uuid, uuid) volatile;
alter function public.get_student_tps(text, uuid) volatile;

-- Ménage : sept jours suffisent pour comprendre un incident.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-student-code-failures',
      '40 3 * * *',
      $cron$delete from public.student_code_failures where created_at < now() - interval '7 days'$cron$
    );
  end if;
end;
$do$;

notify pgrst, 'reload schema';
