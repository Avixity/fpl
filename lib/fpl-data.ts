import type {
  Bootstrap,
  ChipStatus,
  DashboardData,
  EntryHistory,
  FplFixture,
  FplPick,
  LeagueView,
  LiveElement,
  ManagerProfile,
  SquadPlayer,
} from './fpl-types';
import { playerView, transferRecommendations } from './predictions';
import { readCache, recordPredictionRun, writeCache } from './supabase-cache';

const FPL_API = 'https://fantasy.premierleague.com/api';

const CHIP_LABELS: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
};

function buildChipStatuses(
  definitions: Bootstrap['chips'],
  usedChips: Array<{ name: string; event: number; time: string }>,
  currentGameweek: number,
): ChipStatus[] {
  return definitions.map((chip) => {
    const used = usedChips.find(
      (item) => item.name === chip.name && item.event >= chip.start_event && item.event <= chip.stop_event,
    );
    const status: ChipStatus['status'] = used
      ? 'used'
      : currentGameweek < chip.start_event
        ? 'upcoming'
        : currentGameweek > chip.stop_event
          ? 'expired'
          : 'available';
    return {
      id: chip.id,
      name: chip.name,
      label: CHIP_LABELS[chip.name] ?? chip.name,
      startEvent: chip.start_event,
      stopEvent: chip.stop_event,
      usedEvent: used?.event ?? null,
      status,
    };
  });
}

async function fplFetch<T>(path: string, ttlSeconds: number): Promise<T> {
  const cacheKey = path.replace(/^\//, '').replace(/\/$/, '').replaceAll('/', ':') || 'root';
  const cached = await readCache<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${FPL_API}${path}`, {
    headers: { 'User-Agent': 'fpl-server/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(`FPL request failed with ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as T;
  void writeCache(cacheKey, payload, ttlSeconds);
  return payload;
}

async function leagueSummary(league: ManagerProfile['leagues']['classic'][number], managerId: number): Promise<LeagueView> {
  try {
    const data = await fplFetch<{
      league: { id: number; name: string };
      standings: { total: number; results: Array<{ entry: number; rank: number; last_rank: number }> };
    }>(`/leagues-classic/${league.id}/standings/?page_standings=1`, 300);
    const managerRow = data.standings.results.find((row) => row.entry === managerId);
    return {
      id: league.id,
      name: data.league.name,
      rank: managerRow?.rank ?? league.entry_rank,
      previousRank: managerRow?.last_rank ?? league.entry_last_rank,
      totalManagers: data.standings.total ?? null,
    };
  } catch {
    return {
      id: league.id,
      name: league.name,
      rank: league.entry_rank,
      previousRank: league.entry_last_rank,
      totalManagers: null,
    };
  }
}

export async function getDashboard(managerId: number): Promise<DashboardData> {
  const [bootstrap, fixtures, manager] = await Promise.all([
    fplFetch<Bootstrap>('/bootstrap-static/', 900),
    fplFetch<FplFixture[]>('/fixtures/', 300),
    fplFetch<ManagerProfile>(`/entry/${managerId}/`, 120),
  ]);

  const currentEvent = bootstrap.events.find((event) => event.is_current) ?? null;
  const nextEvent = bootstrap.events.find((event) => event.is_next) ?? null;
  const publishedGameweek = manager.current_event || currentEvent?.id || 1;
  const [picksData, historyData, transfers, liveData] = await Promise.all([
    fplFetch<{ picks: FplPick[]; entry_history: EntryHistory; active_chip: string | null }>(
      `/entry/${managerId}/event/${publishedGameweek}/picks/`,
      120,
    ),
    fplFetch<{ current: EntryHistory[]; chips: Array<{ name: string; event: number; time: string }> }>(
      `/entry/${managerId}/history/`,
      300,
    ),
    fplFetch<Array<Record<string, unknown>>>(`/entry/${managerId}/transfers/`, 300),
    currentEvent
      ? fplFetch<{ elements: LiveElement[] }>(`/event/${currentEvent.id}/live/`, 45)
      : Promise.resolve({ elements: [] }),
  ]);

  const teams = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const completedGameweeks = Math.max(1, bootstrap.events.filter((event) => event.finished).length || publishedGameweek);
  const players = bootstrap.elements
    .filter((player) => !player.removed)
    .map((player) => playerView(player, fixtures, teams, completedGameweeks));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const liveById = new Map(liveData.elements.map((element) => [element.id, element]));
  const squad = picksData.picks
    .map((pick): SquadPlayer | null => {
      const player = playersById.get(pick.element);
      if (!player) return null;
      const live = liveById.get(player.id);
      return {
        ...player,
        squadPosition: pick.position,
        multiplier: pick.multiplier,
        captain: pick.is_captain,
        viceCaptain: pick.is_vice_captain,
        livePoints: live ? Number(live.stats.total_points) : null,
        liveMinutes: live ? Number(live.stats.minutes) : null,
      };
    })
    .filter((player): player is SquadPlayer => Boolean(player));

  const liveTotal = squad.some((player) => player.livePoints !== null)
    ? squad.reduce((total, player) => total + (player.livePoints ?? 0) * player.multiplier, 0)
    : null;
  const recommendations = transferRecommendations(squad, players, manager.last_deadline_bank / 10);
  const captainRankings = [...squad]
    .filter((player) => player.squadPosition <= 11)
    .sort((a, b) => b.projection.next - a.projection.next);
  const priceWatch = [...players]
    .filter((player) => player.priceLikelihood !== null && !player.priceCalibrating)
    .sort((a, b) => Math.abs(b.priceLikelihood ?? 0) - Math.abs(a.priceLikelihood ?? 0))
    .slice(0, 20);
  const leagueEntries = manager.leagues?.classic ?? [];
  const leagues = await Promise.all(leagueEntries.slice(0, 6).map((league) => leagueSummary(league, managerId)));

  const dashboard: DashboardData = {
    generatedAt: new Date().toISOString(),
    source: 'FPL public API',
    manager,
    currentEvent,
    nextEvent,
    publishedGameweek,
    entryHistory: picksData.entry_history ?? null,
    history: historyData.current ?? [],
    chips: historyData.chips ?? [],
    chipStatuses: buildChipStatuses(bootstrap.chips ?? [], historyData.chips ?? [], publishedGameweek),
    events: bootstrap.events,
    teams: bootstrap.teams,
    transfers,
    squad,
    players,
    fixtures,
    liveTotal,
    captainRankings,
    recommendations,
    priceWatch,
    leagues,
  };

  void recordPredictionRun(managerId, nextEvent?.id ?? null, {
    captainRankings: captainRankings.slice(0, 5).map((player) => ({ id: player.id, xPts: player.projection.next })),
    recommendations: recommendations.slice(0, 5).map((item) => ({
      out: item.out.id,
      incoming: item.incoming.id,
      gain3: item.projectedGain3,
      gain5: item.projectedGain5,
    })),
  });

  return dashboard;
}

export async function getPlayerSummary(playerId: number) {
  return fplFetch<{
    fixtures: Array<Record<string, unknown>>;
    history: Array<Record<string, unknown>>;
    history_past: Array<Record<string, unknown>>;
  }>(`/element-summary/${playerId}/`, 900);
}
