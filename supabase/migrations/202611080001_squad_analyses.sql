-- AI squad analysis results. Only the Edge Function (service role) writes scores.
create table if not exists public.squad_analyses (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null unique references public.user_squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  dimensions jsonb not null default '{}'::jsonb,
  summary text not null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  recommendations text[] not null default '{}',
  model text not null,
  source_updated_at timestamptz not null,
  analyzed_at timestamptz not null default now()
);

create index if not exists squad_analyses_score_idx
  on public.squad_analyses (score desc, analyzed_at desc);

alter table public.squad_analyses enable row level security;

drop policy if exists "Anyone can view squad analyses" on public.squad_analyses;
create policy "Anyone can view squad analyses"
  on public.squad_analyses for select
  to anon, authenticated
  using (true);

grant select on public.squad_analyses to anon, authenticated;
