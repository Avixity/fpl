export type FplEvent = {
  id: number;
  name: string;
  deadline_time: string;
  finished: boolean;
  data_checked: boolean;
  is_current: boolean;
  is_next: boolean;
  average_entry_score: number;
  highest_score: number | null;
};

export type FplTeam = {
  id: number;
  code: number;
  name: string;
  short_name: string;
  strength: number;
};

export type PriceProjection = {
  offset: number;
  projected_percent: string;
  likelihood: number;
};

export type FplPlayer = {
  id: number;
  code: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  team_code: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  event_points: number;
  form: string;
  points_per_game: string;
  selected_by_percent: string;
  minutes: number;
  starts: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  bonus: number;
  bps: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  transfers_in_event: number;
  transfers_out_event: number;
  price_change_percent: string | null;
  price_change_hourly_rate: number | null;
  price_change_projections: PriceProjection[] | null;
  price_change_calibrating: boolean;
  status: string;
  news: string;
  chance_of_playing_next_round: number | null;
  ep_next: string | null;
  removed: boolean;
};

export type FplFixture = {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  started: boolean;
  finished: boolean;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
};

export type Bootstrap = {
  events: FplEvent[];
  teams: FplTeam[];
  elements: FplPlayer[];
  total_players: number;
};

export type FplPick = {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  element_type: number;
};

export type EntryHistory = {
  event: number;
  points: number;
  total_points: number;
  rank: number | null;
  overall_rank: number | null;
  overall_rank_percentage?: number | null;
  percentile_rank?: number | null;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

export type ManagerProfile = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  player_region_name: string | null;
  current_event: number;
  started_event: number;
  summary_overall_points: number | null;
  summary_overall_rank: number | null;
  summary_event_points: number | null;
  summary_event_rank: number | null;
  last_deadline_bank: number;
  last_deadline_value: number;
  last_deadline_total_transfers: number;
  leagues: {
    classic: Array<{ id: number; name: string; entry_rank: number | null; entry_last_rank: number | null }>;
    h2h: Array<{ id: number; name: string; entry_rank: number | null; entry_last_rank: number | null }>;
  };
};

export type LiveElement = {
  id: number;
  stats: Record<string, number | boolean | string> & { total_points: number; minutes: number };
  explain: unknown[];
};

export type PlayerFixture = {
  id: number;
  event: number;
  opponentId: number;
  opponent: string;
  home: boolean;
  difficulty: number;
  kickoff: string | null;
};

export type PlayerProjection = {
  next: number;
  next3: number;
  next5: number;
  expectedMinutes: number;
  fixtureDifficulty: number | null;
  confidence: 'high' | 'medium' | 'low';
};

export type PlayerView = {
  id: number;
  name: string;
  fullName: string;
  teamId: number;
  team: string;
  teamShort: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  positionId: number;
  price: number;
  points: number;
  eventPoints: number;
  form: number;
  ownership: number;
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  bonus: number;
  expectedGoals: number;
  expectedAssists: number;
  status: string;
  news: string;
  chance: number | null;
  netTransfers: number;
  priceChangePercent: number | null;
  priceLikelihood: number | null;
  priceCalibrating: boolean;
  fixtures: PlayerFixture[];
  projection: PlayerProjection;
};

export type SquadPlayer = PlayerView & {
  squadPosition: number;
  multiplier: number;
  captain: boolean;
  viceCaptain: boolean;
  livePoints: number | null;
  liveMinutes: number | null;
};

export type TransferRecommendation = {
  out: PlayerView;
  incoming: PlayerView;
  projectedGain3: number;
  projectedGain5: number;
  estimatedCost: number;
  budgetValid: boolean;
  clubValid: boolean;
  formationValid: boolean;
  score: number;
};

export type LeagueView = {
  id: number;
  name: string;
  rank: number | null;
  previousRank: number | null;
  totalManagers: number | null;
};

export type DashboardData = {
  generatedAt: string;
  source: 'FPL public API';
  manager: ManagerProfile;
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
  publishedGameweek: number;
  entryHistory: EntryHistory | null;
  history: EntryHistory[];
  chips: Array<{ name: string; event: number; time: string }>;
  transfers: Array<Record<string, unknown>>;
  squad: SquadPlayer[];
  players: PlayerView[];
  fixtures: FplFixture[];
  liveTotal: number | null;
  captainRankings: SquadPlayer[];
  recommendations: TransferRecommendation[];
  priceWatch: PlayerView[];
  leagues: LeagueView[];
};
