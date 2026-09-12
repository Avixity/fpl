create table if not exists public.api_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists api_cache_expires_at_idx on public.api_cache (expires_at);

create table if not exists public.seasons (
  id text primary key,
  name text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  season_id text not null references public.seasons(id) on delete cascade,
  fpl_team_id integer not null,
  name text not null,
  short_name text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, fpl_team_id)
);

create table if not exists public.players (
  season_id text not null references public.seasons(id) on delete cascade,
  fpl_player_id integer not null,
  team_id integer,
  position_id integer not null,
  web_name text not null,
  full_name text not null,
  now_cost integer,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, fpl_player_id)
);

create table if not exists public.gameweeks (
  season_id text not null references public.seasons(id) on delete cascade,
  fpl_gameweek_id integer not null,
  name text not null,
  deadline_time timestamptz,
  finished boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, fpl_gameweek_id)
);

create table if not exists public.fixtures (
  season_id text not null references public.seasons(id) on delete cascade,
  fpl_fixture_id integer not null,
  gameweek_id integer,
  home_team_id integer not null,
  away_team_id integer not null,
  kickoff_time timestamptz,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, fpl_fixture_id)
);

create table if not exists public.player_snapshots (
  id bigint generated always as identity primary key,
  season_id text not null,
  fpl_player_id integer not null,
  recorded_at timestamptz not null default now(),
  price integer,
  ownership numeric,
  transfers_in_event integer,
  transfers_out_event integer,
  payload jsonb not null default '{}'::jsonb
);
create index if not exists player_snapshots_lookup_idx
  on public.player_snapshots (season_id, fpl_player_id, recorded_at desc);

create table if not exists public.managers (
  season_id text not null,
  fpl_manager_id bigint not null,
  team_name text,
  manager_name text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, fpl_manager_id)
);

create table if not exists public.manager_gameweeks (
  season_id text not null,
  fpl_manager_id bigint not null,
  gameweek_id integer not null,
  points integer,
  overall_rank bigint,
  gameweek_rank bigint,
  team_value integer,
  bank integer,
  transfer_cost integer,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, fpl_manager_id, gameweek_id)
);

create table if not exists public.manager_picks (
  season_id text not null,
  fpl_manager_id bigint not null,
  gameweek_id integer not null,
  fpl_player_id integer not null,
  squad_position integer not null,
  multiplier integer not null default 1,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  primary key (season_id, fpl_manager_id, gameweek_id, fpl_player_id)
);

create table if not exists public.manager_transfers (
  id bigint generated always as identity primary key,
  season_id text not null,
  fpl_manager_id bigint not null,
  gameweek_id integer,
  player_in_id integer not null,
  player_out_id integer not null,
  player_in_cost integer,
  player_out_cost integer,
  transfer_time timestamptz,
  unique (season_id, fpl_manager_id, player_in_id, player_out_id, transfer_time)
);

create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  model_version text not null,
  target_gameweek integer,
  input_cutoff timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id bigint generated always as identity primary key,
  model_run_id uuid references public.model_runs(id) on delete cascade,
  season_id text,
  fpl_player_id integer not null,
  target_gameweek integer not null,
  expected_minutes numeric,
  expected_points numeric,
  confidence text,
  components jsonb not null default '{}'::jsonb,
  unique (model_run_id, fpl_player_id, target_gameweek)
);

create table if not exists public.prediction_runs (
  id bigint generated always as identity primary key,
  fpl_manager_id bigint not null,
  target_gameweek integer,
  model_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.api_cache enable row level security;
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.gameweeks enable row level security;
alter table public.fixtures enable row level security;
alter table public.player_snapshots enable row level security;
alter table public.managers enable row level security;
alter table public.manager_gameweeks enable row level security;
alter table public.manager_picks enable row level security;
alter table public.manager_transfers enable row level security;
alter table public.model_runs enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_runs enable row level security;

revoke all on public.api_cache, public.seasons, public.teams, public.players,
  public.gameweeks, public.fixtures, public.player_snapshots, public.managers,
  public.manager_gameweeks, public.manager_picks, public.manager_transfers,
  public.model_runs, public.predictions, public.prediction_runs
  from anon, authenticated;

grant all on public.api_cache, public.seasons, public.teams, public.players,
  public.gameweeks, public.fixtures, public.player_snapshots, public.managers,
  public.manager_gameweeks, public.manager_picks, public.manager_transfers,
  public.model_runs, public.predictions, public.prediction_runs
  to service_role;
grant usage, select on all sequences in schema public to service_role;
