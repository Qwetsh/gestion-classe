-- 042 — Préférences par compte (clé -> JSON)
--
-- Table générique : la disposition de la page d'accueil (clé « home_layout ») s'y range,
-- et les préférences du tableau blanc pourront la réutiliser sans nouvelle migration.
-- Tant qu'elle n'est pas appliquée, l'application retombe silencieusement sur le
-- cache localStorage (cf. src/lib/userPreferences.ts).

create table if not exists public.user_preferences (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_own_rows" on public.user_preferences;
create policy "user_preferences_own_rows"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
