'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { FplTeam, PlayerFixture, PlayerView } from '@/lib/fpl-types';

type TeamSummary = Pick<FplTeam, 'name' | 'short_name' | 'code'>;
export type PlayerVisualPreference = 'photo' | 'shirt';

const PLAYER_VISUAL_STORAGE_KEY = 'fplnet_player_visual_preferences_v1';

type PlayerVisualPreferences = Record<string, PlayerVisualPreference>;

type PlayerVisualContextValue = {
  preferences: PlayerVisualPreferences;
  setPreference: (playerCode: number, preference: PlayerVisualPreference) => void;
};

const PlayerVisualContext = createContext<PlayerVisualContextValue>({
  preferences: {},
  setPreference: () => undefined,
});

function teamTile(shortName: string) {
  return `/team_titles/${encodeURIComponent(shortName)}.png`;
}

function teamShirt(player: PlayerView) {
  if (!player.teamCode) return null;
  const goalkeeper = player.position === 'GK' ? '_1' : '';
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}${goalkeeper}-110.webp`;
}

function parsePreferences(raw: string | null): PlayerVisualPreferences {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, PlayerVisualPreference] => entry[1] === 'photo' || entry[1] === 'shirt'),
    );
  } catch {
    return {};
  }
}

export function PlayerVisualPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PlayerVisualPreferences>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setPreferences(parsePreferences(window.localStorage.getItem(PLAYER_VISUAL_STORAGE_KEY)));
    } catch {
      setPreferences({});
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(PLAYER_VISUAL_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // A blocked local store should not stop squad images from rendering.
    }
  }, [loaded, preferences]);

  const setPreference = useCallback((playerCode: number, preference: PlayerVisualPreference) => {
    setPreferences((current) => ({ ...current, [String(playerCode)]: preference }));
  }, []);

  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);
  return <PlayerVisualContext.Provider value={value}>{children}</PlayerVisualContext.Provider>;
}

export function usePlayerVisualPreference(playerCode: number | null | undefined) {
  const { preferences, setPreference } = useContext(PlayerVisualContext);
  const preference = playerCode ? preferences[String(playerCode)] ?? 'photo' : 'photo';
  const updatePreference = useCallback((next: PlayerVisualPreference) => {
    if (playerCode) setPreference(playerCode, next);
  }, [playerCode, setPreference]);
  return { preference, setPreference: updatePreference };
}

export function TeamBadge({ team, size = 'md' }: { team: TeamSummary; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team.short_name]);

  return (
    <span className={`team-badge team-badge-${size}`} aria-hidden="true">
      {failed ? (
        <span>{team.short_name}</span>
      ) : (
        <Image alt="" fill onError={() => setFailed(true)} sizes="38px" src={teamTile(team.short_name)} unoptimized />
      )}
    </span>
  );
}

export function TeamIdentity({
  team,
  compact = false,
  size = 'md',
}: {
  team: TeamSummary;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={`club-identity club-identity-${size} ${compact ? 'club-identity-compact' : ''}`}>
      <TeamBadge size={size} team={team} />
      <span>{compact ? team.short_name : team.name}</span>
    </span>
  );
}

export function PlayerVisual({ player, size = 'md' }: { player: PlayerView; size?: 'sm' | 'md' | 'lg' | 'pitch' }) {
  const photo = `https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.playerCode}.png`;
  const shirt = teamShirt(player);
  const tile = teamTile(player.teamShort);
  const { preference } = usePlayerVisualPreference(player.playerCode);
  const preferredSource = preference === 'shirt' ? shirt ?? tile : photo;
  const [source, setSource] = useState(preferredSource);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSource(preferredSource);
    setFailed(false);
  }, [preferredSource]);

  function handleError() {
    if (source === photo && shirt) {
      setSource(shirt);
      return;
    }
    if (source !== tile) {
      setSource(tile);
      return;
    }
    setFailed(true);
  }

  return (
    <span className={`player-visual player-visual-${size} ${source === shirt ? 'player-visual-shirt' : ''} ${source === tile ? 'player-visual-fallback' : ''}`}>
      {failed ? (
        <span>{player.teamShort}</span>
      ) : (
        <Image alt={`${player.name}, ${player.team}`} fill onError={handleError} sizes="76px" src={source} unoptimized />
      )}
    </span>
  );
}

export function FixturePill({ fixture }: { fixture: PlayerFixture }) {
  const team: TeamSummary = {
    code: fixture.opponentCode ?? 0,
    name: fixture.opponentName,
    short_name: fixture.opponent,
  };
  return (
    <span className={`fixture-pill fdr-${fixture.difficulty}`} title={`${fixture.opponentName} ${fixture.home ? 'at home' : 'away'}`}>
      <TeamBadge size="sm" team={team} />
      <strong>{fixture.opponent}</strong>
      <small>{fixture.home ? 'H' : 'A'}</small>
    </span>
  );
}
