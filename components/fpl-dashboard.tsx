'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, BrainCircuit,
  CalendarDays, ChartNoAxesCombined, Check, ChevronRight, ClipboardList, Clock3, Flame,
  Home, Info, LoaderCircle, Radio, RefreshCw, Search, Sparkles, Trophy,
  Users, WandSparkles, Zap,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FixturePill,
  PlayerVisual,
  PlayerVisualPreferencesProvider,
  TeamIdentity,
  usePlayerVisualPreference,
} from '@/components/team-visuals';
import { SquadDraftManager } from '@/components/squad-drafts';
import type { ChipStatus, DashboardData, FplFixture, PlayerView, SquadPlayer, TransferRecommendation } from '@/lib/fpl-types';

type ViewId = 'home' | 'squad' | 'drafts' | 'transfers' | 'players' | 'predictions' | 'fixtures' | 'live' | 'rank';

const NAVIGATION: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'squad', label: 'Squad', icon: Users },
  { id: 'drafts', label: 'Drafts', icon: ClipboardList },
  { id: 'transfers', label: 'Transfer Lab', icon: ArrowLeftRight },
  { id: 'players', label: 'Players', icon: Search },
  { id: 'predictions', label: 'Predictions', icon: ChartNoAxesCombined },
  { id: 'fixtures', label: 'Fixtures', icon: CalendarDays },
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'rank', label: 'Rank', icon: Trophy },
];

const displayNumber = (value: number | null | undefined) => typeof value === 'number' ? value.toLocaleString() : 'Unavailable';
const money = (value: number | null | undefined) => typeof value === 'number' ? `£${value.toFixed(1)}m` : 'Unavailable';

function deadlineLabel(deadline?: string | null) {
  if (!deadline) return 'Deadline unavailable';
  const time = new Date(deadline).getTime() - Date.now();
  if (time <= 0) return new Date(deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const days = Math.floor(time / 86_400_000);
  const hours = Math.floor((time % 86_400_000) / 3_600_000);
  return days > 0 ? `${days}d ${hours}h to deadline` : `${hours}h to deadline`;
}

function movement(current: number | null, previous: number | null) {
  return current === null || previous === null ? null : previous - current;
}

function timeGreeting(firstName: string) {
  const hour = new Date().getHours();
  const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `Good ${period} ${firstName}`;
}

function PageHeading({ kicker, title, aside }: { kicker: string; title: string; aside?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{kicker}</p><h1>{title}</h1></div>{aside ? <div>{aside}</div> : null}</div>;
}

function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return <div className="stat-cell"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function FixtureDots({ player, limit = 3 }: { player: PlayerView; limit?: number }) {
  return <div className="fixture-dots">{player.fixtures.slice(0, limit).map((fixture) => <FixturePill fixture={fixture} key={fixture.id} />)}{player.fixtures.length === 0 ? <span className="muted">No fixture</span> : null}</div>;
}

function pendingLiveFixture(player: SquadPlayer) {
  const fixture = player.fixtures[0];
  if (!fixture || player.liveMinutes === null || player.livePoints === null || player.liveMinutes > 0 || player.livePoints !== 0) return null;
  return fixture;
}

function liveSquadValue(player: SquadPlayer, applyMultiplier = true) {
  if (player.livePoints === null || player.liveMinutes === null) return '—';
  return `${player.livePoints * (applyMultiplier ? player.multiplier : 1)} pts`;
}

function PlayerStatus({ player }: { player: PlayerView }) {
  if (player.status === 'a' && !player.news) return null;
  return <span className="availability">{player.chance === null ? player.status.toUpperCase() : `${player.chance}%`}</span>;
}

function PlayerDrawer({ player, onClose, allowImageChoice = false }: { player: PlayerView | null; onClose: () => void; allowImageChoice?: boolean }) {
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const { preference, setPreference } = usePlayerVisualPreference(player?.playerCode);
  useEffect(() => {
    if (!player) return;
    setLoading(true);
    fetch(`/api/fpl/player?id=${player.id}`)
      .then((response) => response.json() as Promise<{ history?: Array<Record<string, unknown>> }>)
      .then((payload) => setHistory(Array.isArray(payload.history) ? payload.history.slice(-6).reverse() : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [player]);
  return <Sheet open={Boolean(player)} onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="player-sheet sm:max-w-lg">{player ? <><SheetHeader className="sheet-head"><PlayerVisual player={player} size="lg" /><SheetTitle className="text-4xl">{player.name}</SheetTitle><SheetDescription>{player.fullName} · {player.team} · {player.position}</SheetDescription></SheetHeader><div className="sheet-body">{allowImageChoice ? <section className="player-image-choice"><div><span>Squad image</span><strong>Choose this player&apos;s visual</strong><small>Missing photos automatically use the current {player.team} shirt. Select the shirt when an official photo still shows a previous club.</small></div><fieldset aria-label="Player image preference" className="image-choice-toggle"><button aria-pressed={preference === 'photo'} className={preference === 'photo' ? 'active' : ''} onClick={() => setPreference('photo')} type="button">Player photo</button><button aria-pressed={preference === 'shirt'} className={preference === 'shirt' ? 'active' : ''} onClick={() => setPreference('shirt')} type="button">Current shirt</button></fieldset></section> : null}<div className="sheet-price"><span>Current price</span><strong>{money(player.price)}</strong></div><div className="mini-stat-grid"><Stat label="Season points" value={displayNumber(player.points)} /><Stat label="Ownership" value={`${player.ownership.toFixed(1)}%`} /><Stat label="Next xPts" value={player.projection.next.toFixed(1)} /><Stat label="Expected mins" value={player.projection.expectedMinutes} /></div><section className="sheet-section"><h3>Upcoming fixtures</h3><FixtureDots player={player} limit={5} /></section><section className="sheet-section"><h3>Season output</h3><dl className="detail-list"><div><dt>Goals</dt><dd>{player.goals}</dd></div><div><dt>Assists</dt><dd>{player.assists}</dd></div><div><dt>Expected goals</dt><dd>{player.expectedGoals.toFixed(2)}</dd></div><div><dt>Expected assists</dt><dd>{player.expectedAssists.toFixed(2)}</dd></div><div><dt>Clean sheets</dt><dd>{player.cleanSheets}</dd></div><div><dt>Bonus</dt><dd>{player.bonus}</dd></div></dl></section><section className="sheet-section"><h3>Recent gameweeks</h3>{loading ? <LoaderCircle className="animate-spin text-primary" /> : history.length ? <div className="history-list">{history.map((item, index) => <div key={`${typeof item.fixture === 'number' ? item.fixture : 'fixture'}-${index}`}><span>GW {typeof item.round === 'number' ? item.round : '—'} · {item.was_home === true ? 'Home' : 'Away'}</span><strong>{typeof item.total_points === 'number' ? item.total_points : '—'} pts</strong></div>)}</div> : <p className="muted">History unavailable.</p>}</section>{player.news ? <p className="news-note"><Info /> {player.news}</p> : null}</div></> : null}</SheetContent></Sheet>;
}

function chipText(chip: ChipStatus) {
  if (chip.status === 'used') return `Used in GW${chip.usedEvent}`;
  if (chip.status === 'available') return 'Available now';
  if (chip.status === 'upcoming') return `Opens in GW${chip.startEvent}`;
  return 'Window ended unused';
}

function ChipsPanel({ chips }: { chips: ChipStatus[] }) {
  return <section className="panel chips-panel"><div className="panel-head"><div><p className="eyebrow">Official manager history</p><h2>Chip status</h2></div><span className="model-version">Every chip window</span></div><div className="chip-grid">{chips.map((chip) => <article className={`chip-card chip-${chip.status}`} key={chip.id}><div><Zap /><span>{chip.label}</span></div><strong>{chipText(chip)}</strong><small>GW{chip.startEvent}–GW{chip.stopEvent}</small></article>)}</div></section>;
}

function HomeView({ data, selectPlayer, go }: { data: DashboardData; selectPlayer: (player: PlayerView) => void; go: (id: ViewId) => void }) {
  const topCaptain = data.captainRankings[0];
  const recommendation = data.recommendations[0];
  const previous = data.history.at(-2)?.overall_rank ?? null;
  const rankMove = movement(data.manager.summary_overall_rank, previous);
  const flagged = data.squad.filter((player) => player.status !== 'a' || player.news).length;
  const nextFixtures = data.fixtures.filter((fixture) => fixture.event === data.nextEvent?.id).sort((a, b) => (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? ''));
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  return <><PageHeading kicker={`${data.nextEvent?.name ?? 'Next gameweek'} · ${deadlineLabel(data.nextEvent?.deadline_time)}`} title={timeGreeting(data.manager.player_first_name)} aside={<span className="data-stamp">Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>} /><section className="scoreboard"><Stat label={`${data.currentEvent?.name ?? 'Current GW'} points`} value={displayNumber(data.manager.summary_event_points)} detail={`GW rank ${displayNumber(data.manager.summary_event_rank)}`} /><Stat label="Overall rank" value={displayNumber(data.manager.summary_overall_rank)} detail={rankMove === null ? 'Movement unavailable' : <span className={rankMove >= 0 ? 'positive' : 'negative'}>{rankMove >= 0 ? '↑' : '↓'} {Math.abs(rankMove).toLocaleString()}</span>} /><Stat label="Team value" value={money(data.manager.last_deadline_value / 10)} detail={`${money(data.manager.last_deadline_bank / 10)} in bank`} /><Stat label="Published squad" value={`GW${data.publishedGameweek}`} detail={`${flagged} availability flag${flagged === 1 ? '' : 's'}`} /></section><div className="dashboard-grid"><section className="panel decision-panel"><div className="panel-head"><div><p className="eyebrow">Best model move</p><h2>Transfer signal</h2></div><Button variant="ghost" size="sm" onClick={() => go('transfers')}>Open lab <ArrowRight /></Button></div>{recommendation ? <div className="transfer-feature"><button onClick={() => selectPlayer(recommendation.out)} type="button"><PlayerVisual player={recommendation.out} size="lg" /><small>Sell</small><strong>{recommendation.out.name}</strong><em>{recommendation.out.projection.next3.toFixed(1)} xPts / 3</em></button><div className="transfer-arrow"><ArrowRight /><span>+{recommendation.projectedGain3.toFixed(1)}</span></div><button onClick={() => selectPlayer(recommendation.incoming)} type="button"><PlayerVisual player={recommendation.incoming} size="lg" /><small>Buy</small><strong>{recommendation.incoming.name}</strong><em>{recommendation.incoming.projection.next3.toFixed(1)} xPts / 3</em></button></div> : <p className="empty-copy">No valid positive transfer was found within the estimated public-data budget.</p>}<p className="model-footnote">Uses current price as estimated selling price. Confirm your exact sale value in FPL.</p></section><section className="panel captain-panel"><div className="panel-head"><div><p className="eyebrow">Next deadline</p><h2>Captain model</h2></div><Button variant="ghost" size="icon-sm" onClick={() => go('predictions')}><ChevronRight /></Button></div>{topCaptain ? <button className="captain-feature" onClick={() => selectPlayer(topCaptain)} type="button"><span className="captain-badge">C</span><PlayerVisual player={topCaptain} size="sm" /><div><strong>{topCaptain.name}</strong><span>{topCaptain.team} · {topCaptain.projection.expectedMinutes} expected mins</span></div><em>{topCaptain.projection.next.toFixed(1)}<small>xPts</small></em></button> : <p className="empty-copy">Captain projection unavailable.</p>}<div className="ranked-mini-list">{data.captainRankings.slice(1, 4).map((player, index) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><span>0{index + 2}</span><strong>{player.name}</strong><em>{player.projection.next.toFixed(1)}</em></button>)}</div></section><section className="panel fixture-panel"><div className="panel-head"><div><p className="eyebrow">Schedule</p><h2>{data.nextEvent?.name ?? 'Next fixtures'}</h2></div><Button variant="ghost" size="sm" onClick={() => go('fixtures')}>Full fixture hub <ArrowRight /></Button></div><div className="fixture-list">{nextFixtures.length ? nextFixtures.map((fixture) => { const home = teams.get(fixture.team_h); const away = teams.get(fixture.team_a); return home && away ? <div key={fixture.id}><TeamIdentity compact size="sm" team={home} /><strong>vs</strong><TeamIdentity compact size="sm" team={away} /><small>{fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBC'}</small></div> : null; }) : <p className="empty-copy">Fixtures unavailable.</p>}</div></section></div><ChipsPanel chips={data.chipStatuses} /></>;
}

function SquadTile({ player, mode, selectPlayer }: { player: SquadPlayer; mode: 'xpts' | 'live' | 'price'; selectPlayer: (player: PlayerView) => void }) {
  const pendingFixture = pendingLiveFixture(player);
  const value = mode === 'live'
    ? pendingFixture
      ? <FixturePill fixture={pendingFixture} />
      : liveSquadValue(player)
    : mode === 'price'
      ? `£${player.price.toFixed(1)}`
      : player.projection.next.toFixed(1);
  return <button className="squad-tile" onClick={() => selectPlayer(player)} type="button">{player.captain || player.viceCaptain ? <span aria-label={player.captain ? 'Captain' : 'Vice captain'} className={`squad-role ${player.captain ? 'squad-role-captain' : 'squad-role-vice'}`}>{player.captain ? 'C' : 'VC'}</span> : null}<PlayerVisual player={player} size="pitch" /><span className="tile-name">{player.name}</span><span className="tile-team" title={player.team}>{player.team}</span><span className={`tile-value ${mode === 'live' && pendingFixture ? 'tile-value-fixture' : ''}`}>{value}</span><PlayerStatus player={player} /></button>;
}

function SquadView({ data, selectPlayer }: { data: DashboardData; selectPlayer: (player: PlayerView) => void }) {
  const [mode, setMode] = useState<'xpts' | 'live' | 'price'>('live');
  const starters = data.squad.filter((player) => player.squadPosition <= 11);
  const bench = data.squad.filter((player) => player.squadPosition > 11).sort((a, b) => a.squadPosition - b.squadPosition);
  const rows = [1, 2, 3, 4].map((positionId) => starters.filter((player) => player.positionId === positionId));
  return <><PageHeading kicker={`Published ${data.currentEvent?.name ?? `GW${data.publishedGameweek}`} squad · ${data.manager.name}`} title="Squad" aside={<div className="segmented">{([['live', 'Live'], ['price', 'Price'], ['xpts', 'Next xPts']] as const).map(([id, label]) => <button className={mode === id ? 'active' : ''} key={id} onClick={() => setMode(id)} type="button">{label}</button>)}</div>} /><div className="squad-layout"><section className="pitch" aria-label="Published squad formation"><div className="pitch-circle" /><div className="pitch-box top" /><div className="pitch-box bottom" />{rows.map((row, rowIndex) => <div className="pitch-row" key={rowIndex}>{row.map((player) => <SquadTile key={player.id} mode={mode} player={player} selectPlayer={selectPlayer} />)}</div>)}</section><aside className="bench-panel"><div className="panel-head"><div><p className="eyebrow">Order matters</p><h2>Bench</h2></div></div>{bench.map((player, index) => { const pendingFixture = pendingLiveFixture(player); return <button className="bench-row" key={player.id} onClick={() => selectPlayer(player)} type="button"><span>0{index + 1}</span><PlayerVisual player={player} size="sm" /><div><strong>{player.name}</strong><small>{player.position} · {player.team}</small></div><em>{mode === 'price' ? money(player.price) : mode === 'live' ? pendingFixture ? <FixturePill fixture={pendingFixture} /> : liveSquadValue(player, false) : `${player.projection.next.toFixed(1)} xPts`}</em></button>; })}<div className="bench-note"><Info /> This is the last published squad. Saved transfer drafts do not change it.</div></aside></div></>;
}

function RecommendationRow({ item, choose }: { item: TransferRecommendation; choose: (item: TransferRecommendation) => void }) {
  return <button className="recommendation-row" onClick={() => choose(item)} type="button"><div><PlayerVisual player={item.out} size="sm" /><p><small>OUT · {item.out.teamShort}</small><strong>{item.out.name}</strong></p></div><span className="gain-arrow"><ArrowRight /> +{item.projectedGain3.toFixed(1)}</span><div><PlayerVisual player={item.incoming} size="sm" /><p><small>IN · {item.incoming.teamShort}</small><strong>{item.incoming.name}</strong></p></div><em>{item.incoming.projection.next5.toFixed(1)}<small>5GW xPts</small></em></button>;
}

function TransferView({ data }: { data: DashboardData }) {
  const draftKey = `fpl_transfer_draft_${data.manager.id}`;
  const [outId, setOutId] = useState<number | null>(null);
  const [inId, setInId] = useState<number | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [saved, setSaved] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const outgoing = data.squad.find((player) => player.id === outId) ?? null;
  const incoming = data.players.find((player) => player.id === inId) ?? null;
  const squadIds = useMemo(() => new Set(data.squad.map((player) => player.id)), [data.squad]);
  const candidates = useMemo(() => data.players.filter((player) => outgoing && player.positionId === outgoing.positionId && !squadIds.has(player.id)).sort((a, b) => b.projection.next3 - a.projection.next3), [data.players, outgoing, squadIds]);
  useEffect(() => { const raw = window.localStorage.getItem(draftKey); if (!raw) return; try { const draft = JSON.parse(raw) as { outId: number; inId: number; sellPrice: string }; setOutId(draft.outId); setInId(draft.inId); setSellPrice(draft.sellPrice); setSaved(true); } catch {} }, [draftKey]);
  useEffect(() => { if (outgoing && !sellPrice) setSellPrice(outgoing.price.toFixed(1)); }, [outgoing, sellPrice]);
  const bank = data.manager.last_deadline_bank / 10;
  const estimatedSell = Number(sellPrice || outgoing?.price || 0);
  const remaining = outgoing && incoming ? bank + estimatedSell - incoming.price : null;
  const samePosition = Boolean(outgoing && incoming && outgoing.positionId === incoming.positionId);
  const targetClubCount = incoming ? data.squad.filter((player) => player.teamId === incoming.teamId && player.id !== outgoing?.id).length + 1 : 0;
  const clubValid = targetClubCount <= 3;
  const budgetValid = remaining === null || remaining >= -0.001;
  const gain3 = outgoing && incoming ? incoming.projection.next3 - outgoing.projection.next3 : null;
  const planValid = Boolean(outgoing && incoming && samePosition && clubValid && budgetValid);
  function choose(item: TransferRecommendation) { setOutId(item.out.id); setInId(item.incoming.id); setSellPrice(item.out.price.toFixed(1)); setSaved(false); setExplanation(''); }
  function savePlan() { if (!planValid || !outgoing || !incoming) return; window.localStorage.setItem(draftKey, JSON.stringify({ outId: outgoing.id, inId: incoming.id, sellPrice })); setSaved(true); }
  async function explain() { if (!planValid || !outgoing || !incoming) return; setExplaining(true); setExplanation(''); try { const response = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'transfer', result: { outgoing: { name: outgoing.name, price: outgoing.price, next3: outgoing.projection.next3, next5: outgoing.projection.next5, expectedMinutes: outgoing.projection.expectedMinutes }, incoming: { name: incoming.name, price: incoming.price, next3: incoming.projection.next3, next5: incoming.projection.next5, expectedMinutes: incoming.projection.expectedMinutes }, projectedGain3: gain3, remainingBudget: remaining } }) }); const payload = await response.json() as { explanation?: string; error?: string }; setExplanation(response.ok ? payload.explanation ?? 'Explanation unavailable.' : payload.error ?? 'Explanation unavailable.'); } catch { setExplanation('Explanation service is temporarily unavailable.'); } finally { setExplaining(false); } }
  return <><PageHeading kicker={`${money(bank)} available at last deadline`} title="Transfer Lab" aside={<span className="data-stamp">Drafts stay on this device</span>} /><div className="transfer-layout"><section className="panel transfer-builder"><div className="panel-head"><div><p className="eyebrow">Draft 01</p><h2>Plan a move</h2></div>{saved ? <span className="saved-state"><Check /> Saved</span> : null}</div><div className="transfer-pickers"><div><label htmlFor="player-out">Player out</label><Select value={outId} onValueChange={(value) => { setOutId(value as number); setInId(null); setSellPrice(''); setSaved(false); }}><SelectTrigger className="lab-select" id="player-out"><SelectValue placeholder="Choose squad player" /></SelectTrigger><SelectContent>{data.squad.map((player) => <SelectItem key={player.id} value={player.id}>{player.name} · {player.teamShort} · {player.position} · {money(player.price)}</SelectItem>)}</SelectContent></Select></div><ArrowRight className="picker-arrow" /><div><label htmlFor="player-in">Player in</label><Select disabled={!outgoing} value={inId} onValueChange={(value) => { setInId(value as number); setSaved(false); }}><SelectTrigger className="lab-select" id="player-in"><SelectValue placeholder={outgoing ? 'Choose replacement' : 'Select player out first'} /></SelectTrigger><SelectContent>{candidates.map((player) => <SelectItem key={player.id} value={player.id}>{player.name} · {player.teamShort} · {money(player.price)} · {player.projection.next3.toFixed(1)} xPts</SelectItem>)}</SelectContent></Select></div></div>{outgoing ? <div className="selected-transfer-visual"><div><PlayerVisual player={outgoing} size="md" /><span>{outgoing.name}</span><FixtureDots player={outgoing} limit={1} /></div><ArrowRight /><div>{incoming ? <PlayerVisual player={incoming} size="md" /> : <span className="player-visual player-visual-md">?</span>}<span>{incoming?.name ?? 'Choose replacement'}</span>{incoming ? <FixtureDots player={incoming} limit={1} /> : null}</div></div> : null}{outgoing ? <div className="sell-price-row"><label htmlFor="sell-price">Estimated sale price</label><div><span>£</span><Input id="sell-price" inputMode="decimal" onChange={(event) => { setSellPrice(event.target.value); setSaved(false); }} value={sellPrice} /><span>m</span></div><small>Public FPL data does not expose your exact selling price. Adjust it here.</small></div> : null}<div className="constraint-grid"><span className={budgetValid ? 'valid' : 'invalid'}>{budgetValid ? <Check /> : <Info />} Budget {remaining === null ? 'pending' : `${remaining >= 0 ? money(remaining) : `${money(Math.abs(remaining))} short`}`}</span><span className={samePosition || !incoming ? 'valid' : 'invalid'}>{samePosition || !incoming ? <Check /> : <Info />} Formation</span><span className={clubValid ? 'valid' : 'invalid'}>{clubValid ? <Check /> : <Info />} Max 3 per club</span></div>{outgoing && incoming ? <div className="plan-result"><div><span>Projected 3GW gain</span><strong className={gain3 !== null && gain3 >= 0 ? 'positive' : 'negative'}>{gain3 !== null && gain3 >= 0 ? '+' : ''}{gain3?.toFixed(1)} xPts</strong></div><div><span>Projected 5GW gain</span><strong>{(incoming.projection.next5 - outgoing.projection.next5).toFixed(1)} xPts</strong></div><div><span>Remaining budget</span><strong>{money(remaining)}</strong></div></div> : <p className="empty-copy builder-empty">Choose two players to run budget, formation and club checks.</p>}<div className="builder-actions"><Button disabled={!planValid} onClick={savePlan}>{saved ? 'Draft saved' : 'Save local draft'}</Button><Button disabled={!planValid || explaining} onClick={explain} variant="outline">{explaining ? <LoaderCircle className="animate-spin" /> : <BrainCircuit />} Explain result</Button></div>{explanation ? <div className="explanation"><Sparkles /> <p>{explanation}</p></div> : null}</section><section className="panel recommendation-panel"><div className="panel-head"><div><p className="eyebrow">Squad-aware</p><h2>Model shortlist</h2></div><span className="model-version">v1.0</span></div><div className="recommendation-list">{data.recommendations.length ? data.recommendations.slice(0, 8).map((item) => <RecommendationRow choose={choose} item={item} key={`${item.out.id}-${item.incoming.id}`} />) : <p className="empty-copy">No valid positive transfers found.</p>}</div></section></div></>;
}

function PlayersView({ data, selectPlayer }: { data: DashboardData; selectPlayer: (player: PlayerView) => void }) {
  const [query, setQuery] = useState(''); const [position, setPosition] = useState('ALL'); const [team, setTeam] = useState('ALL'); const [compare, setCompare] = useState<PlayerView[]>([]);
  const teams = [...new Map(data.players.map((player) => [player.teamShort, player.team])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const filtered = data.players.filter((player) => !query || `${player.name} ${player.fullName} ${player.team}`.toLowerCase().includes(query.toLowerCase())).filter((player) => position === 'ALL' || player.position === position).filter((player) => team === 'ALL' || player.teamShort === team).sort((a, b) => b.projection.next - a.projection.next).slice(0, 120);
  function toggleCompare(player: PlayerView) { setCompare((current) => current.some((item) => item.id === player.id) ? current.filter((item) => item.id !== player.id) : current.length < 2 ? [...current, player] : [current[1], player]); }
  return <><PageHeading kicker={`${data.players.length.toLocaleString()} selectable players`} title="Players" /><section className="player-tools"><div className="search-field"><Search /><Input aria-label="Search players" onChange={(event) => setQuery(event.target.value)} placeholder="Search player or club" value={query} /></div><Select value={position} onValueChange={(value) => setPosition(String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((item) => <SelectItem key={item} value={item}>{item === 'ALL' ? 'All positions' : item}</SelectItem>)}</SelectContent></Select><Select value={team} onValueChange={(value) => setTeam(String(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All clubs</SelectItem>{teams.map(([short, name]) => <SelectItem key={short} value={short}>{name}</SelectItem>)}</SelectContent></Select></section>{compare.length === 2 ? <section className="compare-strip">{compare.map((player) => <div key={player.id}><PlayerVisual player={player} size="sm" /><span>{player.name}</span><strong>{player.projection.next3.toFixed(1)} <small>3GW xPts</small></strong><em>{money(player.price)} · {player.form.toFixed(1)} form</em></div>)}<div className="compare-verdict"><small>3GW edge</small><strong>{compare[0].projection.next3 >= compare[1].projection.next3 ? compare[0].name : compare[1].name}</strong><span>{Math.abs(compare[0].projection.next3 - compare[1].projection.next3).toFixed(1)} xPts</span></div></section> : null}<section className="panel table-panel"><Table><TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Price</TableHead><TableHead>Form</TableHead><TableHead>Own.</TableHead><TableHead>Next fixture</TableHead><TableHead className="text-right">xPts</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{filtered.map((player) => <TableRow key={player.id}><TableCell><button className="table-player" onClick={() => selectPlayer(player)} type="button"><PlayerVisual player={player} size="sm" /><span><strong>{player.name}</strong><small>{player.position} · {player.team}</small></span><PlayerStatus player={player} /></button></TableCell><TableCell>{money(player.price)}</TableCell><TableCell>{player.form.toFixed(1)}</TableCell><TableCell>{player.ownership.toFixed(1)}%</TableCell><TableCell><FixtureDots player={player} limit={1} /></TableCell><TableCell className="text-right text-lg">{player.projection.next.toFixed(1)}</TableCell><TableCell><Button className={compare.some((item) => item.id === player.id) ? 'compare-active' : ''} onClick={() => toggleCompare(player)} size="sm" variant="ghost">Compare</Button></TableCell></TableRow>)}</TableBody></Table>{filtered.length === 0 ? <p className="empty-copy table-empty">No players match these filters.</p> : null}</section></>;
}

function PredictionsView({ data, selectPlayer }: { data: DashboardData; selectPlayer: (player: PlayerView) => void }) {
  const rising = data.priceWatch.filter((player) => (player.priceLikelihood ?? 0) > 0).slice(0, 6); const falling = data.priceWatch.filter((player) => (player.priceLikelihood ?? 0) < 0).slice(0, 6);
  return <><PageHeading kicker={`Target ${data.nextEvent?.name ?? 'next gameweek'}`} title="Predictions" aside={<span className="model-version">Model v1.0 · deterministic</span>} /><div className="prediction-grid"><section className="panel captain-ranking"><div className="panel-head"><div><p className="eyebrow">Your XI</p><h2>Captain ranking</h2></div><span className="confidence-key">xPts</span></div>{data.captainRankings.slice(0, 10).map((player, index) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><span className="ranking-no">{String(index + 1).padStart(2, '0')}</span><PlayerVisual player={player} size="sm" /><div><strong>{player.name}</strong><small>{player.projection.expectedMinutes} mins · {player.projection.confidence} confidence</small></div><FixtureDots player={player} limit={1} /><em>{player.projection.next.toFixed(1)}</em></button>)}</section><section className="panel multi-gw"><div className="panel-head"><div><p className="eyebrow">Planning horizon</p><h2>Five-gameweek projection</h2></div></div>{[...data.players].sort((a, b) => b.projection.next5 - a.projection.next5).slice(0, 12).map((player, index, rows) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{player.name}</strong><small>{player.position} · {player.teamShort} · {money(player.price)}</small></div><div className="projection-bar"><i style={{ width: `${Math.max(6, (player.projection.next5 / (rows[0]?.projection.next5 || 1)) * 100)}%` }} /></div><em>{player.projection.next5.toFixed(1)}</em></button>)}</section><section className="panel price-panel"><div className="panel-head"><div><p className="eyebrow">Official FPL signal</p><h2>Price pressure</h2></div></div><div className="price-columns"><div><h3><ArrowUpRight /> Rising</h3>{rising.length ? rising.map((player) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><PlayerVisual player={player} size="sm" /><span><strong>{player.name}</strong><small>{player.teamShort} · {money(player.price)}</small></span><em>+{player.priceLikelihood}</em></button>) : <p className="muted">No rising signals.</p>}</div><div><h3><ArrowDownRight /> Falling</h3>{falling.length ? falling.map((player) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><PlayerVisual player={player} size="sm" /><span><strong>{player.name}</strong><small>{player.teamShort} · {money(player.price)}</small></span><em>{player.priceLikelihood}</em></button>) : <p className="muted">No falling signals.</p>}</div></div><p className="model-footnote">Likelihood is supplied by FPL&apos;s public price projection feed. It is a signal, not a guaranteed change.</p></section><section className="panel model-panel"><div className="panel-head"><div><p className="eyebrow">Transparent inputs</p><h2>How xPts is built</h2></div><BrainCircuit /></div><ol><li><span>01</span><p><strong>Expected minutes</strong>Season minutes, starts and current availability.</p></li><li><span>02</span><p><strong>Player rate</strong>Season points, recent form and expected goals/assists.</p></li><li><span>03</span><p><strong>Fixture adjustment</strong>Official opponent difficulty for every scheduled match.</p></li><li><span>04</span><p><strong>Multi-GW sum</strong>Individual fixture estimates summed across the horizon.</p></li></ol></section></div></>;
}

function fixturesForTeam(fixtures: FplFixture[], teamId: number, eventId: number) { return fixtures.filter((fixture) => fixture.event === eventId && (fixture.team_h === teamId || fixture.team_a === teamId)); }
function pointsInEvent(player: PlayerView, eventId: number) { return player.fixtures.filter((fixture) => fixture.event === eventId).reduce((sum, fixture) => sum + fixture.projectedPoints, 0); }
function bestEvent<T extends { score: number }>(items: T[]) { return items.reduce<T | null>((best, item) => !best || item.score > best.score ? item : best, null); }

function FixturesView({ data }: { data: DashboardData }) {
  const idsWithFixtures = new Set(data.fixtures.flatMap((fixture) => fixture.event === null ? [] : [fixture.event]));
  const allEvents = data.events.filter((event) => idsWithFixtures.has(event.id));
  const startId = data.nextEvent?.id ?? data.currentEvent?.id ?? data.publishedGameweek;
  const planningEvents = allEvents.filter((event) => event.id >= startId).slice(0, 5);
  const [selectedEvent, setSelectedEvent] = useState(startId);
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  const selectedFixtures = data.fixtures.filter((fixture) => fixture.event === selectedEvent).sort((a, b) => (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? ''));
  const squadIds = new Set(data.squad.map((player) => player.id));
  const scores = planningEvents.map((event) => {
    const bench = data.squad.filter((player) => player.squadPosition > 11).reduce((sum, player) => sum + pointsInEvent(player, event.id), 0);
    const captain = data.squad.filter((player) => player.squadPosition <= 11).reduce((best, player) => Math.max(best, pointsInEvent(player, event.id)), 0);
    const attack = data.players.reduce((sum, player) => { if (!player.minutes) return sum; const fixture = player.fixtures.find((item) => item.event === event.id); if (!fixture) return sum; const per90 = ((player.expectedGoals + player.expectedAssists) / player.minutes) * 90; return sum + per90 * (player.projection.expectedMinutes / 90) * (1 + (3 - fixture.difficulty) * 0.1); }, 0);
    const gaps = data.squad.map((player) => { const current = pointsInEvent(player, event.id); const replacement = data.players.filter((candidate) => !squadIds.has(candidate.id) && candidate.positionId === player.positionId).reduce((best, candidate) => Math.max(best, pointsInEvent(candidate, event.id)), 0); return Math.max(0, replacement - current); }).sort((a, b) => b - a).slice(0, 5);
    const wildcard = gaps.reduce((sum, gap) => sum + gap, 0);
    const hard = data.squad.reduce((count, player) => count + player.fixtures.filter((fixture) => fixture.event === event.id && fixture.difficulty >= 4).length, 0);
    const blanks = data.squad.filter((player) => !player.fixtures.some((fixture) => fixture.event === event.id)).length;
    return { event, bench, captain, attack, wildcard, freeHit: blanks * 5 + hard };
  });
  const insights = [
    { label: 'Goal-heavy signal', result: bestEvent(scores.map((x) => ({ event: x.event, score: x.attack }))), icon: Flame, detail: 'Highest adjusted xG + xA index' },
    { label: 'Bench Boost watch', result: bestEvent(scores.map((x) => ({ event: x.event, score: x.bench }))), icon: Users, detail: 'Highest current-bench projection' },
    { label: 'Triple Captain watch', result: bestEvent(scores.map((x) => ({ event: x.event, score: x.captain }))), icon: Zap, detail: 'Highest current-XI captain projection' },
    { label: 'Wildcard watch', result: bestEvent(scores.map((x) => ({ event: x.event, score: x.wildcard }))), icon: WandSparkles, detail: 'Largest projected replacement gaps' },
    { label: 'Free Hit watch', result: bestEvent(scores.map((x) => ({ event: x.event, score: x.freeHit }))), icon: Sparkles, detail: 'Most blanks and hard fixtures' },
  ];
  return <><PageHeading kicker={`${allEvents.length} gameweeks in the official schedule`} title="Fixtures" aside={<span className="model-version">Next 5 GW planning window</span>} /><section className="fixture-insights">{insights.map((item) => { const Icon = item.icon; return <article key={item.label}><Icon /><span>{item.label}</span><strong>{item.result ? item.result.event.name : 'Unavailable'}</strong><small>{item.detail}</small></article>; })}</section><section className="panel matrix-panel"><div className="panel-head"><div><p className="eyebrow">Difficulty 1–5</p><h2>Fixture matrix</h2></div><span className="matrix-key"><i className="fdr-1" /> Easier <i className="fdr-5" /> Harder</span></div><div className="matrix-scroll"><div className="fixture-matrix" style={{ gridTemplateColumns: `190px repeat(${Math.max(1, planningEvents.length)}, minmax(120px, 1fr))` }}><div className="matrix-corner">Club</div>{planningEvents.map((event) => <div className="matrix-head" key={event.id}>{event.name}</div>)}{data.teams.map((team) => <div className="matrix-row" key={team.id} style={{ display: 'contents' }}><div className="matrix-team"><TeamIdentity team={team} /></div>{planningEvents.map((event) => { const fixtures = fixturesForTeam(data.fixtures, team.id, event.id); return <div className="matrix-cell" key={`${team.id}-${event.id}`}>{fixtures.length ? fixtures.map((fixture) => { const home = fixture.team_h === team.id; const opponent = teams.get(home ? fixture.team_a : fixture.team_h); const difficulty = home ? fixture.team_h_difficulty : fixture.team_a_difficulty; return opponent ? <span className={`matrix-opponent fdr-${difficulty}`} key={fixture.id}><TeamIdentity compact size="sm" team={opponent} /><b>{home ? 'H' : 'A'}</b></span> : null; }) : <span className="matrix-blank">Blank</span>}</div>; })}</div>)}</div></div></section><section className="panel all-fixtures-panel"><div className="panel-head"><div><p className="eyebrow">Full season schedule</p><h2>{data.events.find((event) => event.id === selectedEvent)?.name ?? `GW${selectedEvent}`}</h2></div></div><div className="gw-picker">{allEvents.map((event) => <button className={selectedEvent === event.id ? 'active' : ''} key={event.id} onClick={() => setSelectedEvent(event.id)} type="button">{event.id}</button>)}</div><div className="full-fixture-list">{selectedFixtures.map((fixture) => { const home = teams.get(fixture.team_h); const away = teams.get(fixture.team_a); return home && away ? <article key={fixture.id}><TeamIdentity team={home} /><div><strong>{fixture.started ? `${fixture.team_h_score ?? 0} — ${fixture.team_a_score ?? 0}` : 'vs'}</strong><small>{fixture.finished ? 'FT' : fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBC'}</small></div><TeamIdentity team={away} /></article> : null; })}</div></section><p className="provisional-note"><Info /> Chip watches are deterministic estimates from your current published squad, expected minutes, player output and official fixtures. They are decision support, not guarantees.</p></>;
}

function LiveView({ data, selectPlayer }: { data: DashboardData; selectPlayer: (player: PlayerView) => void }) {
  const starters = data.squad.filter((player) => player.squadPosition <= 11).sort((a, b) => (b.livePoints ?? -1) - (a.livePoints ?? -1)); const matches = data.fixtures.filter((fixture) => fixture.event === data.currentEvent?.id); const teams = new Map(data.teams.map((team) => [team.id, team]));
  return <><PageHeading kicker={`${data.currentEvent?.name ?? 'Current gameweek'} · provisional scoring`} title="Live" aside={<span className="live-chip"><i /> Live data</span>} /><section className="live-score"><div><span>Calculated squad total</span><strong>{displayNumber(data.liveTotal)}</strong><small>Includes published multipliers</small></div><div><span>Official GW points</span><strong>{displayNumber(data.manager.summary_event_points)}</strong><small>FPL manager summary</small></div></section><div className="live-layout"><section className="panel"><div className="panel-head"><div><p className="eyebrow">Your XI</p><h2>Player returns</h2></div></div><div className="live-player-list">{starters.map((player) => <button key={player.id} onClick={() => selectPlayer(player)} type="button"><PlayerVisual player={player} size="sm" /><div><strong>{player.name}{player.captain || player.viceCaptain ? <span aria-label={player.captain ? 'Captain' : 'Vice captain'} className="inline-role">{player.captain ? 'C' : 'VC'}</span> : null}</strong><small>{player.team} · {player.liveMinutes === null ? 'Minutes unavailable' : `${player.liveMinutes} mins`}</small></div><em>{player.livePoints === null ? '—' : player.livePoints * player.multiplier}</em></button>)}</div></section><section className="panel"><div className="panel-head"><div><p className="eyebrow">This gameweek</p><h2>Matches</h2></div></div><div className="match-list">{matches.map((fixture) => { const home = teams.get(fixture.team_h); const away = teams.get(fixture.team_a); return home && away ? <div key={fixture.id}><TeamIdentity compact team={home} /><strong>{fixture.started ? `${fixture.team_h_score ?? 0} — ${fixture.team_a_score ?? 0}` : 'vs'}</strong><TeamIdentity compact team={away} /><small>{fixture.finished ? 'FT' : fixture.started ? 'Live' : fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBC'}</small></div> : null; })}</div></section></div><p className="provisional-note"><Info /> Live points, bonus and rank can change until FPL finishes checking the gameweek.</p></>;
}

function RankView({ data }: { data: DashboardData }) {
  const chartData = data.history.map((row) => ({ gw: `GW${row.event}`, rank: row.overall_rank, points: row.points }));
  return <><PageHeading kicker={`${displayNumber(data.manager.summary_overall_points)} total points`} title="Rank" /><section className="rank-hero"><div><span>Overall rank</span><strong>{displayNumber(data.manager.summary_overall_rank)}</strong></div><div><span>Gameweek rank</span><strong>{displayNumber(data.manager.summary_event_rank)}</strong></div><div><span>Region</span><strong>{data.manager.player_region_name || 'Unavailable'}</strong></div></section><div className="rank-layout"><section className="panel chart-panel"><div className="panel-head"><div><p className="eyebrow">Lower is better</p><h2>Season rank movement</h2></div></div>{chartData.some((item) => item.rank) ? <div className="rank-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}><CartesianGrid stroke="rgba(204,208,207,.08)" vertical={false} /><XAxis dataKey="gw" stroke="#aab8c2" tickLine={false} axisLine={false} fontSize={12} /><YAxis reversed stroke="#aab8c2" tickLine={false} axisLine={false} width={70} tickFormatter={(value) => Number(value).toLocaleString(undefined, { notation: 'compact' })} fontSize={12} /><ChartTooltip contentStyle={{ background: '#11212D', border: '1px solid rgba(204,208,207,.15)', borderRadius: 10 }} formatter={(value) => [Number(value).toLocaleString(), 'Rank']} /><Line type="monotone" dataKey="rank" stroke="#52d9ff" strokeWidth={3} dot={{ r: 4, fill: '#00e6a7', stroke: '#06141B', strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer></div> : <p className="empty-copy">Rank history unavailable.</p>}</section><section className="panel league-panel"><div className="panel-head"><div><p className="eyebrow">Classic leagues</p><h2>Mini-leagues</h2></div></div>{data.leagues.length ? data.leagues.map((league) => { const move = movement(league.rank, league.previousRank); return <div className="league-row" key={league.id}><div><strong>{league.name}</strong><small>{league.totalManagers ? `${league.totalManagers.toLocaleString()} managers` : 'League size unavailable'}</small></div><em>{displayNumber(league.rank)}</em><span className={move !== null && move >= 0 ? 'positive' : 'negative'}>{move === null ? '—' : `${move >= 0 ? '↑' : '↓'} ${Math.abs(move)}`}</span></div>; }) : <p className="empty-copy">No classic leagues found.</p>}</section></div><section className="panel history-table"><div className="panel-head"><div><p className="eyebrow">Gameweek log</p><h2>Performance history</h2></div></div><Table><TableHeader><TableRow><TableHead>GW</TableHead><TableHead>Points</TableHead><TableHead>GW rank</TableHead><TableHead>Overall rank</TableHead><TableHead>Transfers</TableHead><TableHead>Cost</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody>{[...data.history].reverse().map((row) => <TableRow key={row.event}><TableCell>GW{row.event}</TableCell><TableCell>{row.points}</TableCell><TableCell>{displayNumber(row.rank)}</TableCell><TableCell>{displayNumber(row.overall_rank)}</TableCell><TableCell>{row.event_transfers}</TableCell><TableCell>{row.event_transfers_cost ? `−${row.event_transfers_cost}` : '0'}</TableCell><TableCell>{money(row.value / 10)}</TableCell></TableRow>)}</TableBody></Table></section></>;
}

export function FplDashboard({ data, onSwitchManager, onRefresh, refreshing }: { data: DashboardData; onSwitchManager: () => void; onRefresh: () => void; refreshing: boolean }) {
  const [active, setActive] = useState<ViewId>('home');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const ActiveIcon = NAVIGATION.find((item) => item.id === active)?.icon ?? Home;

  useEffect(() => {
    const nav = mobileNavRef.current;
    const activeButton = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !activeButton) return;
    const left = activeButton.offsetLeft - (nav.clientWidth - activeButton.clientWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  return <PlayerVisualPreferencesProvider><main className="app-shell" data-view={active}><aside className="desktop-nav"><div aria-label="FPLnet" className="brand-reserved compact"><strong>FPL</strong><span>net</span></div><nav>{NAVIGATION.map((item) => { const Icon = item.icon; return <button aria-current={active === item.id ? 'page' : undefined} className={active === item.id ? 'active' : ''} key={item.id} onClick={() => setActive(item.id)} type="button"><Icon /><span>{item.label}</span></button>; })}</nav><div className="nav-manager"><span>{data.manager.player_first_name.charAt(0)}{data.manager.player_last_name.charAt(0)}</span><div><strong>{data.manager.name}</strong><button onClick={onSwitchManager} type="button">Switch manager</button></div></div></aside><div className="app-body"><header className="app-topbar"><div className="mobile-title"><ActiveIcon /><span>{NAVIGATION.find((item) => item.id === active)?.label}</span></div><div className="team-identity"><span>{data.manager.name}</span><small>{data.manager.player_first_name} {data.manager.player_last_name}</small></div><div className="topbar-actions"><span><Clock3 /> {deadlineLabel(data.nextEvent?.deadline_time)}</span><Button aria-label="Switch manager" className="mobile-switch" onClick={onSwitchManager} size="icon-sm" variant="ghost"><ArrowLeftRight /></Button><Button aria-label="Refresh data" disabled={refreshing} onClick={onRefresh} size="icon-sm" variant="ghost"><RefreshCw className={refreshing ? 'animate-spin' : ''} /></Button></div></header><div className="app-content">{active === 'home' ? <HomeView data={data} go={setActive} selectPlayer={setSelectedPlayer} /> : null}{active === 'squad' ? <SquadView data={data} selectPlayer={setSelectedPlayer} /> : null}{active === 'drafts' ? <SquadDraftManager data={data} onOpenPlayer={setSelectedPlayer} /> : null}{active === 'transfers' ? <TransferView data={data} /> : null}{active === 'players' ? <PlayersView data={data} selectPlayer={setSelectedPlayer} /> : null}{active === 'predictions' ? <PredictionsView data={data} selectPlayer={setSelectedPlayer} /> : null}{active === 'fixtures' ? <FixturesView data={data} /> : null}{active === 'live' ? <LiveView data={data} selectPlayer={setSelectedPlayer} /> : null}{active === 'rank' ? <RankView data={data} /> : null}</div></div><nav className="mobile-nav" ref={mobileNavRef}>{NAVIGATION.map((item) => { const Icon = item.icon; return <button aria-current={active === item.id ? 'page' : undefined} className={active === item.id ? 'active' : ''} key={item.id} onClick={() => setActive(item.id)} type="button"><Icon /><span>{item.label === 'Transfer Lab' ? 'Lab' : item.label}</span></button>; })}</nav><PlayerDrawer allowImageChoice={active === 'squad'} onClose={() => setSelectedPlayer(null)} player={selectedPlayer} /></main></PlayerVisualPreferencesProvider>;
}
