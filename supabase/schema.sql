create table if not exists public.api_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists api_cache_expires_at_idx on public.api_cache (expires_at);

create table if not exists public.prediction_runs (
  id bigint generated always as identity primary key,
  fpl_manager_id bigint not null,
  target_gameweek integer,
  model_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.api_cache enable row level security;
alter table public.prediction_runs enable row level security;
revoke all on public.api_cache, public.prediction_runs from anon, authenticated;
grant all on public.api_cache, public.prediction_runs to service_role;
grant usage, select on all sequences in schema public to service_role;
