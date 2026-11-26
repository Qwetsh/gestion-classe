-- 096 — Comptes réels, et adhésion à un établissement soumise à l'accord de son administrateur
--
-- Deux constats de l'audit du 26/11/2026 :
--   * les connexions anonymes sont activées pour tout le projet (d'autres applications s'en
--     servent) : une règle écrite « pour les comptes connectés » vaut donc pour n'importe qui ;
--   * join_school inscrivait n'importe quel compte dans n'importe quel établissement, sans accord.
--     Une fois membre, on lit les élèves de l'établissement avec leurs aménagements.
--
-- Ce que fait cette migration :
--   * is_real_account() : vrai pour un compte connecté qui n'est pas anonyme. À utiliser dans toute
--     règle ou fonction qui doit être réservée aux enseignants ;
--   * une adhésion commence « en attente » (school_members.status = 'pending') : tant qu'un
--     administrateur de l'établissement ne l'a pas acceptée (approve_school_member), le demandeur
--     ne voit rien : my_school_id() l'ignore, et toutes les fonctions et règles passent par elle ;
--   * créer, chercher ou rejoindre un établissement est refusé aux comptes anonymes.
--
-- Au moment de cette migration il n'y a aucun établissement et aucun membre, et l'écran
-- « établissements » n'est pas dans l'application : rien ne change pour personne. L'écran, le jour
-- où il arrive, doit afficher l'état « en attente » (get_my_school().my_status) et proposer à
-- l'administrateur d'accepter ou de refuser (approve_school_member, remove_school_member).

create or replace function public.is_real_account()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

comment on function public.is_real_account() is
  'Vrai pour un compte connecté non anonyme. Les connexions anonymes sont activées sur ce projet : « authenticated » ne suffit pas à désigner un enseignant.';

revoke all on function public.is_real_account() from public;
grant execute on function public.is_real_account() to anon, authenticated, service_role;

alter table public.school_members
  add column if not exists status text not null default 'active'
  check (status in ('pending', 'active'));

comment on column public.school_members.status is
  'pending = demande en attente de l''accord d''un administrateur ; active = membre. Seul un membre actif voit quoi que ce soit.';

-- Toutes les règles et fonctions de l'établissement passent par ici : un membre en attente n'a
-- pas d'établissement.
create or replace function public.my_school_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select school_id from school_members where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.check_class_school_link()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.school_class_id is not null and not exists (
    select 1
    from school_classes sc
    join school_members m on m.school_id = sc.school_id and m.user_id = new.user_id and m.status = 'active'
    where sc.id = new.school_class_id
  ) then
    raise exception 'classe du collège invalide pour ce professeur';
  end if;
  return new;
end;
$$;

create or replace function public.search_schools(p_query text default ''::text)
returns table(id uuid, name text, city text, uai character varying, member_count bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select s.id, s.name, s.city, s.uai,
         (select count(*) from school_members m where m.school_id = s.id and m.status = 'active')
  from schools s
  where public.is_real_account()
    and (
      coalesce(trim(p_query), '') = ''
      or school_class_name_key(s.name || ' ' || coalesce(s.city, '') || ' ' || coalesce(s.uai, ''))
         like '%' || school_class_name_key(p_query) || '%'
    )
  order by s.name
  limit 50;
$$;

create or replace function public.create_school(p_name text, p_city text, p_uai text, p_display_name text, p_subject text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_uai text := nullif(upper(trim(coalesce(p_uai, ''))), '');
begin
  if not public.is_real_account() then raise exception 'not_authenticated'; end if;
  if exists (select 1 from school_members where user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  if v_uai is not null and exists (select 1 from schools where uai = v_uai) then
    raise exception 'uai_taken';
  end if;

  insert into schools (name, city, uai, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_city, '')), ''), v_uai, auth.uid())
  returning id into v_id;

  insert into school_members (school_id, user_id, display_name, subject, role, status)
  values (v_id, auth.uid(), left(trim(p_display_name), 80),
          nullif(left(trim(coalesce(p_subject, '')), 80), ''), 'admin', 'active');

  return v_id;
end;
$$;

-- Une demande, pas une adhésion : elle reste « en attente » jusqu'à l'accord d'un administrateur.
create or replace function public.join_school(p_school_id uuid, p_display_name text, p_subject text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_real_account() then raise exception 'not_authenticated'; end if;
  if exists (select 1 from school_members where user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  if not exists (select 1 from schools where id = p_school_id) then
    raise exception 'school_not_found';
  end if;

  insert into school_members (school_id, user_id, display_name, subject, role, status)
  values (p_school_id, auth.uid(), left(trim(p_display_name), 80),
          nullif(left(trim(coalesce(p_subject, '')), 80), ''), 'member', 'pending');
end;
$$;

create or replace function public.approve_school_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_school uuid;
begin
  if not public.is_real_account() then raise exception 'not_authenticated'; end if;

  select school_id into v_school
  from school_members
  where user_id = auth.uid() and role = 'admin' and status = 'active';
  if v_school is null then raise exception 'forbidden'; end if;

  update school_members set status = 'active'
  where school_id = v_school and user_id = p_user_id and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;
end;
$$;

revoke all on function public.approve_school_member(uuid) from public, anon;
grant execute on function public.approve_school_member(uuid) to authenticated, service_role;

-- Sert aussi à refuser une demande (administrateur) ou à la retirer (demandeur).
create or replace function public.remove_school_member(p_user_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_school uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select school_id into v_school from school_members where user_id = v_target;
  if v_school is null then return; end if;

  if v_target <> auth.uid() and not exists (
    select 1 from school_members
    where school_id = v_school and user_id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'forbidden';
  end if;

  update classes set school_class_id = null
  where user_id = v_target and school_class_id is not null;

  delete from school_members where school_id = v_school and user_id = v_target;

  -- Un établissement sans membre actif disparaît : une demande en attente n'en hérite jamais.
  if not exists (select 1 from school_members where school_id = v_school and status = 'active') then
    delete from schools where id = v_school;
  elsif not exists (
    select 1 from school_members where school_id = v_school and role = 'admin' and status = 'active'
  ) then
    update school_members set role = 'admin'
    where school_id = v_school
      and user_id = (
        select user_id from school_members
        where school_id = v_school and status = 'active'
        order by joined_at limit 1
      );
  end if;
end;
$$;

-- Un demandeur en attente voit le nom de l'établissement et l'état de sa demande, rien d'autre.
create or replace function public.get_my_school()
returns json
language sql
stable security definer
set search_path to 'public'
as $$
  select json_build_object(
    'id', s.id,
    'name', s.name,
    'city', s.city,
    'uai', s.uai,
    'my_role', me.role,
    'my_status', me.status,
    'my_display_name', me.display_name,
    'my_subject', me.subject,
    'members', case when me.status = 'active' then (
      select json_agg(json_build_object(
        'user_id', m.user_id,
        'display_name', m.display_name,
        'subject', m.subject,
        'role', m.role,
        'status', m.status,
        'joined_at', m.joined_at,
        'is_me', m.user_id = auth.uid()
      ) order by m.joined_at)
      from school_members m where m.school_id = s.id
    ) else '[]'::json end
  )
  from school_members me
  join schools s on s.id = me.school_id
  where me.user_id = auth.uid();
$$;
