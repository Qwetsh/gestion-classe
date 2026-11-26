-- 097 — Ensembles partagés : écriture réservée aux comptes réels, journaux liés à l'identité réelle
--
-- Trois ensembles de Gestion Classe étaient modifiables et effaçables par tout compte
-- « authenticated », donc par un compte anonyme créé en une requête : les questions et réponses
-- de l'Académie, les annales ajoutées depuis l'app, et leurs fichiers (dossier brevets/custom).
-- Deux fonctions de journal acceptaient n'importe quel identifiant, sans connexion.
--
-- Ce que fait cette migration :
--   * Académie : écriture réservée aux comptes réels (is_real_account, migration 096). Les
--     questions restent communes à tous les enseignants : il n'y a pas de propriétaire ;
--   * annales : chaque sujet porte son auteur (created_by). Tout compte réel peut en ajouter ;
--     seul l'auteur modifie ou supprime le sien. Les sujets existants reçoivent pour auteur le
--     compte qui a déposé leur fichier ;
--   * fichiers brevets/custom : dépôt réservé aux comptes réels, modification et suppression
--     réservées à celui qui a déposé le fichier ;
--   * track_user_activity et log_device_connection : n'écrivent plus que pour le compte
--     réellement connecté (les identifiants passés en paramètre sont ignorés), et ne sont plus
--     appelables sans connexion ;
--   * dossier public entity-images (autre application, dépôt sans connexion) : plafond de 10 Mo
--     par fichier, images seulement. Le quota de stockage est commun à tout le projet.
--
-- La lecture ne change nulle part : élèves et visiteurs lisent les questions et les annales
-- comme avant.

-- ── Académie ────────────────────────────────────────────────────────────────────────────────
alter policy academy_questions_insert on public.academy_questions
  with check ((select public.is_real_account()));
alter policy academy_questions_update on public.academy_questions
  using ((select public.is_real_account())) with check ((select public.is_real_account()));
alter policy academy_questions_delete on public.academy_questions
  using ((select public.is_real_account()));

alter policy academy_answers_insert on public.academy_answers
  with check ((select public.is_real_account()));
alter policy academy_answers_update on public.academy_answers
  using ((select public.is_real_account())) with check ((select public.is_real_account()));
alter policy academy_answers_delete on public.academy_answers
  using ((select public.is_real_account()));

-- ── Annales ajoutées depuis l'app ───────────────────────────────────────────────────────────
alter table public.custom_annales
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

comment on column public.custom_annales.created_by is
  'Compte qui a ajouté le sujet : lui seul le modifie ou le supprime. Vide = sujet ancien sans auteur connu, modifiable par tout compte réel.';

update public.custom_annales a
set created_by = u.id
from storage.objects o
join auth.users u on u.id::text = o.owner_id
where a.created_by is null
  and o.bucket_id = 'brevets'
  and o.name = a.file_path;

alter policy custom_annales_insert_auth on public.custom_annales
  with check ((select public.is_real_account()) and created_by = (select auth.uid()));
alter policy custom_annales_update_auth on public.custom_annales
  using ((select public.is_real_account()) and (created_by = (select auth.uid()) or created_by is null))
  with check ((select public.is_real_account()) and (created_by = (select auth.uid()) or created_by is null));
alter policy custom_annales_delete_auth on public.custom_annales
  using ((select public.is_real_account()) and (created_by = (select auth.uid()) or created_by is null));

alter policy brevets_custom_upload_auth on storage.objects
  with check (
    bucket_id = 'brevets'
    and (storage.foldername(name))[1] = 'custom'
    and (select public.is_real_account())
  );
alter policy brevets_custom_update_auth on storage.objects
  using (
    bucket_id = 'brevets'
    and (storage.foldername(name))[1] = 'custom'
    and owner_id = (select auth.uid())::text
  );
alter policy brevets_custom_delete_auth on storage.objects
  using (
    bucket_id = 'brevets'
    and (storage.foldername(name))[1] = 'custom'
    and owner_id = (select auth.uid())::text
  );

-- ── Journaux ────────────────────────────────────────────────────────────────────────────────
-- Les paramètres p_user_id et p_user_email sont gardés pour ne pas casser les appels existants
-- (web et mobile), mais ne sont plus lus : l'identité vient du jeton de connexion.
create or replace function public.track_user_activity(p_user_id uuid, p_user_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_real_account() then return; end if;
  insert into user_activity (user_id, user_email, last_seen_at, login_count)
  values (auth.uid(), auth.jwt() ->> 'email', now(), 1)
  on conflict (user_id)
  do update set last_seen_at = now(),
                login_count = user_activity.login_count + 1,
                user_email = excluded.user_email;
end;
$$;

create or replace function public.track_user_activity(p_user_id uuid, p_user_email text, p_device_info text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_real_account() then return; end if;
  insert into user_activity (user_id, user_email, last_seen_at, login_count, device_info)
  values (auth.uid(), auth.jwt() ->> 'email', now(), 1, left(p_device_info, 500))
  on conflict (user_id)
  do update set last_seen_at = now(),
                login_count = user_activity.login_count + 1,
                user_email = excluded.user_email,
                device_info = coalesce(excluded.device_info, user_activity.device_info);
end;
$$;

create or replace function public.log_device_connection(p_user_id uuid, p_user_email text, p_device_info text, p_platform text default 'web'::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_real_account() then return; end if;
  insert into device_connections (user_id, user_email, device_info, platform)
  values (auth.uid(), auth.jwt() ->> 'email', left(p_device_info, 500), left(p_platform, 40));
end;
$$;

revoke all on function public.track_user_activity(uuid, text) from public, anon;
revoke all on function public.track_user_activity(uuid, text, text) from public, anon;
revoke all on function public.log_device_connection(uuid, text, text, text) from public, anon;
grant execute on function public.track_user_activity(uuid, text) to authenticated, service_role;
grant execute on function public.track_user_activity(uuid, text, text) to authenticated, service_role;
grant execute on function public.log_device_connection(uuid, text, text, text) to authenticated, service_role;

-- ── Dossier public entity-images ────────────────────────────────────────────────────────────
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/*']
where id = 'entity-images';
