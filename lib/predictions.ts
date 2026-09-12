import type {
  FplFixture,
  FplPlayer,
  FplTeam,
  PlayerFixture,
  PlayerProjection,
  PlayerView,
  SquadPlayer,
  TransferRecommendation,
} from './fpl-types';

const POSITION_NAMES = ['GK', 'DEF', 'MID', 'FWD'] as const;

export function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function availability(player: FplPlayer): number {
  if (player.chance_of_playing_next_round !== null) {
    return clamp(player.chance_of_playing_next_round / 100, 0, 1);
  }
  if (player.status === 'a') return 1;
  if (player.status === 'd') return 0.75;
  if (['i', 's', 'u', 'n'].includes(player.status)) return 0.05;
  return 0.6;
}

export function expectedMinutes(player: FplPlayer, completedGameweeks: number): number {
  const gameweeks = Math.max(1, completedGameweeks);
  const averageMinutes = clamp(player.minutes / gameweeks, 0, 90);
  const startRateMinutes = clamp(player.starts / gameweeks, 0, 1) * 90;
  const blended = averageMinutes * 0.65 + startRateMinutes * 0.35;
  return round(clamp(blended * availability(player), 0, 90), 0);
}

function fixtureForTeam(fixture: FplFixture, teamId: number, teams: Map<number, FplTeam>): PlayerFixture {
  const home = fixture.team_h === teamId;
  const opponentId = home ? fixture.team_a : fixture.team_h;
  return {
    id: fixture.id,
    event: fixture.event ?? 0,
    opponentId,
    opponent: teams.get(opponentId)?.short_name ?? '—',
    home,
    difficulty: home ? fixture.team_h_difficulty : fixture.team_a_difficulty,
    kickoff: fixture.kickoff_time,
  };
}

function projectedPoints(player: FplPlayer, minutes: number, difficulty: number): number {
  if (minutes <= 0) return 0;
  const seasonPer90 = player.minutes > 0 ? (player.total_points / player.minutes) * 90 : 0;
  const formRate = numeric(player.form);
  const xgPer90 = player.minutes > 0 ? (numeric(player.expected_goals) / player.minutes) * 90 : 0;
  const xaPer90 = player.minutes > 0 ? (numeric(player.expected_assists) / player.minutes) * 90 : 0;
  const goalPoints = player.element_type === 4 ? 4 : player.element_type === 3 ? 5 : 6;
  const underlyingAttack = xgPer90 * goalPoints + xaPer90 * 3;
  const baseRate = seasonPer90 * 0.55 + formRate * 0.3 + underlyingAttack * 0.15;
  const fixtureFactor = 1 + (3 - difficulty) * 0.1;
  return round(Math.max(0, baseRate * (minutes / 90) * fixtureFactor));
}

export function playerView(
  player: FplPlayer,
  fixtures: FplFixture[],
  teams: Map<number, FplTeam>,
  completedGameweeks: number,
): PlayerView {
  const team = teams.get(player.team);
  const future = fixtures
    .filter((fixture) => fixture.event && !fixture.finished && (fixture.team_h === player.team || fixture.team_a === player.team))
    .sort((a, b) => (a.event ?? 99) - (b.event ?? 99) || a.id - b.id)
    .slice(0, 5)
    .map((fixture) => fixtureForTeam(fixture, player.team, teams));
  const minutes = expectedMinutes(player, completedGameweeks);
  const points = future.map((fixture) => projectedPoints(player, minutes, fixture.difficulty));
  const next = points[0] ?? 0;
  const projection: PlayerProjection = {
    next,
    next3: round(points.slice(0, 3).reduce((sum, item) => sum + item, 0)),
    next5: round(points.reduce((sum, item) => sum + item, 0)),
    expectedMinutes: minutes,
    fixtureDifficulty: future[0]?.difficulty ?? null,
    confidence: minutes >= 75 && availability(player) >= 0.95 ? 'high' : minutes >= 50 && availability(player) >= 0.6 ? 'medium' : 'low',
  };

  return {
    id: player.id,
    name: player.web_name,
    fullName: `${player.first_name} ${player.second_name}`.trim(),
    teamId: player.team,
    team: team?.name ?? 'Unavailable',
    teamShort: team?.short_name ?? '—',
    position: POSITION_NAMES[player.element_type - 1] ?? 'FWD',
    positionId: player.element_type,
    price: round(player.now_cost / 10),
    points: player.total_points,
    eventPoints: player.event_points,
    form: numeric(player.form),
    ownership: numeric(player.selected_by_percent),
    minutes: player.minutes,
    starts: player.starts,
    goals: player.goals_scored,
    assists: player.assists,
    cleanSheets: player.clean_sheets,
    bonus: player.bonus,
    expectedGoals: numeric(player.expected_goals),
    expectedAssists: numeric(player.expected_assists),
    status: player.status,
    news: player.news,
    chance: player.chance_of_playing_next_round,
    netTransfers: player.transfers_in_event - player.transfers_out_event,
    priceChangePercent: player.price_change_percent === null ? null : numeric(player.price_change_percent),
    priceLikelihood: player.price_change_projections?.[0]?.likelihood ?? null,
    priceCalibrating: player.price_change_calibrating,
    fixtures: future,
    projection,
  };
}

export function transferRecommendations(squad: SquadPlayer[], players: PlayerView[], bank: number): TransferRecommendation[] {
  const squadIds = new Set(squad.map((player) => player.id));
  const clubCounts = new Map<number, number>();
  for (const player of squad) clubCounts.set(player.teamId, (clubCounts.get(player.teamId) ?? 0) + 1);

  const results: TransferRecommendation[] = [];
  for (const outgoing of squad) {
    for (const incoming of players) {
      if (squadIds.has(incoming.id) || incoming.positionId !== outgoing.positionId || incoming.status === 'u') continue;
      const estimatedCost = round(incoming.price - outgoing.price);
      const budgetValid = incoming.price <= outgoing.price + bank + 0.001;
      const newClubCount = (clubCounts.get(incoming.teamId) ?? 0) + (incoming.teamId === outgoing.teamId ? 0 : 1);
      const clubValid = newClubCount <= 3;
      const gain3 = round(incoming.projection.next3 - outgoing.projection.next3);
      const gain5 = round(incoming.projection.next5 - outgoing.projection.next5);
      const score = round(gain3 * 0.65 + gain5 * 0.35 - Math.max(0, estimatedCost) * 0.15);
      if (budgetValid && clubValid && score > 0) {
        results.push({
          out: outgoing,
          incoming,
          projectedGain3: gain3,
          projectedGain5: gain5,
          estimatedCost,
          budgetValid,
          clubValid,
          formationValid: true,
          score,
        });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 16);
}
