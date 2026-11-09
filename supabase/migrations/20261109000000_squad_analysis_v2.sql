-- DILLMON squad analysis v2
-- Safe additive migration. Existing squads, posts, profiles and analysis rows are retained.

create table if not exists public.squad_analyses (
  squad_id uuid primary key references public.user_squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer,
  dimensions jsonb not null default '{}'::jsonb,
  summary text not null default '',
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  model text,
  source_updated_at timestamptz,
  analyzed_at timestamptz not null default now(),
  analysis_version integer not null default 1,
  player_facts jsonb not null default '[]'::jsonb,
  data_sources jsonb not null default '[]'::jsonb,
  data_coverage jsonb not null default '{}'::jsonb
);

alter table public.squad_analyses
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists score integer,
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
  add column if not exists summary text not null default '',
  add column if not exists strengths jsonb not null default '[]'::jsonb,
  add column if not exists weaknesses jsonb not null default '[]'::jsonb,
  add column if not exists recommendations jsonb not null default '[]'::jsonb,
  add column if not exists model text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists analyzed_at timestamptz not null default now(),
  add column if not exists analysis_version integer not null default 1,
  add column if not exists player_facts jsonb not null default '[]'::jsonb,
  add column if not exists data_sources jsonb not null default '[]'::jsonb,
  add column if not exists data_coverage jsonb not null default '{}'::jsonb;

create unique index if not exists squad_analyses_squad_id_uidx
  on public.squad_analyses (squad_id);

create index if not exists squad_analyses_user_id_idx
  on public.squad_analyses (user_id);

alter table public.squad_analyses enable row level security;
alter table public.user_squads enable row level security;

-- Every saved squad is intentionally visible in the public Squad Ratings gallery.
-- Writes remain limited to the squad owner; analysis writes are server-only via service role.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_squads'
      and policyname = 'user_squads_public_read'
  ) then
    create policy user_squads_public_read
      on public.user_squads for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_squads'
      and policyname = 'user_squads_owner_insert'
  ) then
    create policy user_squads_owner_insert
      on public.user_squads for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_squads'
      and policyname = 'user_squads_owner_update'
  ) then
    create policy user_squads_owner_update
      on public.user_squads for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_squads'
      and policyname = 'user_squads_owner_delete'
  ) then
    create policy user_squads_owner_delete
      on public.user_squads for delete to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'squad_analyses'
      and policyname = 'squad_analyses_public_read'
  ) then
    create policy squad_analyses_public_read
      on public.squad_analyses for select
      using (true);
  end if;
end;
$$;
