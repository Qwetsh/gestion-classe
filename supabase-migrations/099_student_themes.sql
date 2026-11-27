-- 099 — Thèmes de l'espace élève : ceux qui s'ouvrent, ceux qui se gagnent
--
-- Jusqu'ici le thème de l'espace élève était un simple réglage gardé sur l'appareil. Avec vingt
-- thèmes, trois familles :
--   * libres (free)   : disponibles pour tous, dès le départ ;
--   * de cours (class): ouverts par le professeur, classe par classe, quand la séquence commence ;
--   * à gagner (card) : un thème au choix de l'élève par carte à tampons remplie (10 tampons).
-- Le professeur peut aussi ouvrir un thème « à gagner » à toute une classe (classes sans tampons).
-- Aucun thème ne dépend d'une note ni d'un classement.
--
-- Ce que fait cette migration :
--   * class_student_themes   : les thèmes ouverts à une classe (écrit par le professeur) ;
--   * student_theme_unlocks  : les thèmes gagnés par un élève (écrit par les fonctions seulement) ;
--   * student_theme_choices  : le thème choisi par l'élève, qui le suit d'un appareil à l'autre ;
--   * trois fonctions ouvertes aux élèves (code à 6 chiffres) : lire son état, choisir un thème,
--     débloquer un thème gagné.
--
-- La liste des thèmes et leur famille vit dans _student_theme_kind : ajouter un thème, c'est
-- rejouer cette fonction dans une nouvelle migration (et l'ajouter dans lib/studentThemes.ts).
-- Le nombre de tampons qui vaut un thème est dans _student_theme_state (v_per_theme).
--
-- Rejouable.

-- ---------------------------------------------------------------------------
-- 1. Les familles de thèmes
-- ---------------------------------------------------------------------------
create or replace function public._student_theme_kind(p_theme text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when p_theme in ('carnet', 'cosmos', 'jungle', 'arcade', 'stade', 'crepuscule') then 'free'
    when p_theme in ('fossiles', 'volcan', 'orage', 'microscope', 'adn', 'seisme') then 'class'
    when p_theme in ('ville', 'savane', 'abysses', 'banquise', 'ruche', 'parquet', 'sommets', 'skate') then 'card'
  end;
$function$;

revoke all on function public._student_theme_kind(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Thèmes ouverts à une classe
-- ---------------------------------------------------------------------------
create table if not exists public.class_student_themes (
  class_id  uuid not null references public.classes(id) on delete cascade,
  theme_id  text not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  opened_at timestamptz not null default now(),
  primary key (class_id, theme_id)
);

alter table public.class_student_themes enable row level security;

-- Le professeur gère les lignes de ses propres classes ; un compte anonyme n'écrit rien.
-- L'élève ne lit pas cette table : il passe par get_student_themes.
drop policy if exists class_student_themes_select on public.class_student_themes;
create policy class_student_themes_select on public.class_student_themes
  for select using (user_id = (select auth.uid()));

drop policy if exists class_student_themes_insert on public.class_student_themes;
create policy class_student_themes_insert on public.class_student_themes
  for insert with check (
    user_id = (select auth.uid())
    and (select public.is_real_account())
    and exists (select 1 from public.classes c where c.id = class_id and c.user_id = (select auth.uid()))
  );

drop policy if exists class_student_themes_delete on public.class_student_themes;
create policy class_student_themes_delete on public.class_student_themes
  for delete using (user_id = (select auth.uid()) and (select public.is_real_account()));

-- ---------------------------------------------------------------------------
-- 3. Thèmes gagnés et thème choisi, par élève
-- ---------------------------------------------------------------------------
create table if not exists public.student_theme_unlocks (
  student_id  uuid not null references public.students(id) on delete cascade,
  theme_id    text not null,
  unlocked_at timestamptz not null default now(),
  primary key (student_id, theme_id)
);

create table if not exists public.student_theme_choices (
  student_id uuid primary key references public.students(id) on delete cascade,
  theme_id   text not null,
  updated_at timestamptz not null default now()
);

alter table public.student_theme_unlocks enable row level security;
alter table public.student_theme_choices enable row level security;

-- Écriture : par les fonctions ci-dessous seulement (aucune règle d'écriture).
-- Lecture : le professeur voit ce qui concerne ses propres élèves.
drop policy if exists student_theme_unlocks_read on public.student_theme_unlocks;
create policy student_theme_unlocks_read on public.student_theme_unlocks
  for select using (student_id in (select s.id from public.students s where s.user_id = (select auth.uid())));

drop policy if exists student_theme_choices_read on public.student_theme_choices;
create policy student_theme_choices_read on public.student_theme_choices
  for select using (student_id in (select s.id from public.students s where s.user_id = (select auth.uid())));

revoke insert, update, delete on public.student_theme_unlocks from anon, authenticated;
revoke insert, update, delete on public.student_theme_choices from anon, authenticated;
revoke all on public.class_student_themes from anon;

-- ---------------------------------------------------------------------------
-- 4. L'état d'un élève (fonction interne)
-- ---------------------------------------------------------------------------
-- free    : les thèmes libres
-- opened  : les thèmes ouverts à sa classe
-- earned  : les thèmes qu'il a gagnés
-- credits : le nombre de thèmes qu'il peut encore choisir (tampons reçus / 10, moins ceux déjà pris)
-- chosen  : son thème, s'il y a encore droit ; sinon null
-- Un élève témoin a tout.
create or replace function public._student_theme_state(p_student_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_per_theme constant int := 10;
  v_all constant text[] := array['carnet', 'cosmos', 'jungle', 'arcade', 'stade', 'crepuscule',
    'fossiles', 'volcan', 'orage', 'microscope', 'adn', 'seisme',
    'ville', 'savane', 'abysses', 'banquise', 'ruche', 'parquet', 'sommets', 'skate'];
  v_class uuid;
  v_witness boolean;
  v_free text[];
  v_opened text[];
  v_earned text[];
  v_stamps int;
  v_left int;
  v_chosen text;
begin
  select s.class_id, coalesce(s.is_witness, false) into v_class, v_witness
    from students s where s.id = p_student_id;

  select coalesce(array_agg(t order by ord), '{}') into v_free
    from unnest(v_all) with ordinality as a(t, ord) where _student_theme_kind(t) = 'free';

  if v_witness then
    select coalesce(array_agg(t order by ord), '{}') into v_opened
      from unnest(v_all) with ordinality as a(t, ord) where _student_theme_kind(t) <> 'free';
    v_earned := '{}';
    v_left := 0;
  else
    select coalesce(array_agg(c.theme_id order by c.opened_at), '{}') into v_opened
      from class_student_themes c
     where c.class_id = v_class and _student_theme_kind(c.theme_id) in ('class', 'card');

    select coalesce(array_agg(u.theme_id order by u.unlocked_at), '{}') into v_earned
      from student_theme_unlocks u
     where u.student_id = p_student_id and _student_theme_kind(u.theme_id) = 'card';

    select count(*) into v_stamps from stamps st where st.student_id = p_student_id;

    -- Ce qu'il reste à choisir : jamais plus que les thèmes « à gagner » encore fermés pour lui.
    select least(
        greatest(0, v_stamps / v_per_theme - cardinality(v_earned)),
        (select count(*) from unnest(v_all) as t
          where _student_theme_kind(t) = 'card' and not (t = any (v_opened)) and not (t = any (v_earned)))
      )::int into v_left;
  end if;

  select c.theme_id into v_chosen from student_theme_choices c where c.student_id = p_student_id;
  if v_chosen is not null
     and not (v_chosen = any (v_free) or v_chosen = any (v_opened) or v_chosen = any (v_earned)) then
    v_chosen := null;
  end if;

  return jsonb_build_object(
    'free', to_jsonb(v_free),
    'opened', to_jsonb(v_opened),
    'earned', to_jsonb(v_earned),
    'credits', v_left,
    'chosen', v_chosen
  );
end;
$function$;

revoke all on function public._student_theme_state(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fonctions ouvertes aux élèves
-- ---------------------------------------------------------------------------
-- Toutes VOLATILE et passant par resolve_student_code : le frein sur les essais de codes
-- (migration 094) s'applique.

create or replace function public.get_student_themes(p_code text, p_student_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_student uuid;
begin
  v_student := resolve_student_code(p_code, p_student_id);
  if v_student is null then return jsonb_build_object('error', 'not_found'); end if;
  return _student_theme_state(v_student);
end;
$function$;

-- Choisir un thème auquel on a droit. Le choix suit l'élève d'un appareil à l'autre.
create or replace function public.set_student_theme(p_code text, p_theme text, p_student_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_student uuid;
  v_state jsonb;
begin
  v_student := resolve_student_code(p_code, p_student_id);
  if v_student is null then return jsonb_build_object('error', 'not_found'); end if;
  if _student_theme_kind(p_theme) is null then return jsonb_build_object('error', 'unknown_theme'); end if;

  v_state := _student_theme_state(v_student);
  if not (v_state -> 'free' ? p_theme or v_state -> 'opened' ? p_theme or v_state -> 'earned' ? p_theme) then
    return v_state || jsonb_build_object('error', 'locked');
  end if;

  insert into student_theme_choices (student_id, theme_id, updated_at)
  values (v_student, p_theme, now())
  on conflict (student_id) do update set theme_id = excluded.theme_id, updated_at = excluded.updated_at;

  return _student_theme_state(v_student);
end;
$function$;

-- Débloquer un thème « à gagner » avec un thème restant à choisir, et le prendre aussitôt.
create or replace function public.unlock_student_theme(p_code text, p_theme text, p_student_id uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_student uuid;
  v_state jsonb;
begin
  v_student := resolve_student_code(p_code, p_student_id);
  if v_student is null then return jsonb_build_object('error', 'not_found'); end if;
  if coalesce(_student_theme_kind(p_theme), '') <> 'card' then
    return jsonb_build_object('error', 'not_earnable');
  end if;

  -- Deux appuis en même temps ne dépensent pas deux fois le même thème à choisir.
  perform pg_advisory_xact_lock(hashtextextended('student_theme:' || v_student::text, 0));

  v_state := _student_theme_state(v_student);
  if not (v_state -> 'opened' ? p_theme or v_state -> 'earned' ? p_theme) then
    if (v_state ->> 'credits')::int < 1 then
      return v_state || jsonb_build_object('error', 'no_credit');
    end if;
    insert into student_theme_unlocks (student_id, theme_id) values (v_student, p_theme)
    on conflict do nothing;
  end if;

  insert into student_theme_choices (student_id, theme_id, updated_at)
  values (v_student, p_theme, now())
  on conflict (student_id) do update set theme_id = excluded.theme_id, updated_at = excluded.updated_at;

  return _student_theme_state(v_student);
end;
$function$;

revoke all on function public.get_student_themes(text, uuid) from public;
revoke all on function public.set_student_theme(text, text, uuid) from public;
revoke all on function public.unlock_student_theme(text, text, uuid) from public;
grant execute on function public.get_student_themes(text, uuid) to anon, authenticated, service_role;
grant execute on function public.set_student_theme(text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.unlock_student_theme(text, text, uuid) to anon, authenticated, service_role;
