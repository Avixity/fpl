'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { FplTeam, PlayerFixture, PlayerView } from '@/lib/fpl-types';

type TeamSummary = Pick<FplTeam, 'name' | 'short_name' | 'code'>;
export type PlayerVisualPreference = 'photo' | 'shirt';

const DEFAULT_PLAYER_VISUAL_MODE: PlayerVisualPreference = 'shirt';
const PLAYER_VISUAL_STORAGE_KEY = 'fplnet_player_visual_settings_v2';

type PlayerVisualPreferences = Record<string, PlayerVisualPreference>;
type PlayerVisualSettings = {
  defaultMode: PlayerVisualPreference;
  overrides: PlayerVisualPreferences;
};

type PlayerVisualContextValue = {
  defaultMode: PlayerVisualPreference;
  preferences: PlayerVisualPreferences;
  setDefaultMode: (mode: PlayerVisualPreference) => void;
  setPreference: (playerCode: number, preference: PlayerVisualPreference) => void;
  clearPreference: (playerCode: number) => void;
};

const PlayerVisualContext = createContext<PlayerVisualContextValue>({
  defaultMode: DEFAULT_PLAYER_VISUAL_MODE,
  preferences: {},
  setDefaultMode: () => undefined,
  setPreference: () => undefined,
  clearPreference: () => undefined,
});

function teamTile(shortName: string) {
  return `/team_titles/${encodeURIComponent(shortName)}.png`;
}

function teamShirt(player: PlayerView) {
  if (!player.teamCode) return null;
  const goalkeeper = player.position === 'GK' ? '_1' : '';
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}${goalkeeper}-110.webp`;
}

function isPlayerVisualPreference(value: unknown): value is PlayerVisualPreference {
  return value === 'photo' || value === 'shirt';
}

function validPreferences(value: unknown): PlayerVisualPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, PlayerVisualPreference] =>
        Number.isSafeInteger(Number(entry[0])) && Number(entry[0]) > 0 && isPlayerVisualPreference(entry[1]),
    ),
  );
}

function parseSettings(raw: string | null): PlayerVisualSettings | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    if (!isPlayerVisualPreference(candidate.defaultMode)) return null;
    return {
      defaultMode: candidate.defaultMode,
      overrides: validPreferences(candidate.overrides),
    };
  } catch {
    return null;
  }
}

export function PlayerVisualPreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlayerVisualSettings>({
    defaultMode: DEFAULT_PLAYER_VISUAL_MODE,
    overrides: {},
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = parseSettings(window.localStorage.getItem(PLAYER_VISUAL_STORAGE_KEY));
      setSettings(stored ?? { defaultMode: DEFAULT_PLAYER_VISUAL_MODE, overrides: {} });
      window.localStorage.removeItem('fplnet_player_visual_preferences_v1');
    } catch {
      setSettings({ defaultMode: DEFAULT_PLAYER_VISUAL_MODE, overrides: {} });
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(PLAYER_VISUAL_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // A blocked local store should not stop squad images from rendering.
    }
  }, [loaded, settings]);

  const setDefaultMode = useCallback((defaultMode: PlayerVisualPreference) => {
    setSettings({ defaultMode, overrides: {} });
  }, []);

  const setPreference = useCallback((playerCode: number, preference: PlayerVisualPreference) => {
    setSettings((current) => ({
      ...current,
      overrides: { ...current.overrides, [String(playerCode)]: preference },
    }));
  }, []);

  const clearPreference = useCallback((playerCode: number) => {
    setSettings((current) => {
      const key = String(playerCode);
      if (!(key in current.overrides)) return current;
      const overrides = { ...current.overrides };
      delete overrides[key];
      return { ...current, overrides };
    });
  }, []);

  const value = useMemo(() => ({
    defaultMode: settings.defaultMode,
    preferences: settings.overrides,
    setDefaultMode,
    setPreference,
    clearPreference,
  }), [settings, setDefaultMode, setPreference, clearPreference]);
  return <PlayerVisualContext.Provider value={value}>{children}</PlayerVisualContext.Provider>;
}

export function usePlayerVisualMode() {
  const { defaultMode, preferences, setDefaultMode } = useContext(PlayerVisualContext);
  return { mode: defaultMode, setMode: setDefaultMode, overrides: preferences };
}

export function usePlayerVisualPreference(playerCode: number | null | undefined) {
  const { defaultMode, preferences, setPreference, clearPreference } = useContext(PlayerVisualContext);
  const key = playerCode === null || playerCode === undefined ? null : String(playerCode);
  const override = key ? preferences[key] : undefined;
  const preference = override ?? defaultMode;
  const updatePreference = useCallback((next: PlayerVisualPreference) => {
    if (playerCode !== null && playerCode !== undefined) setPreference(playerCode, next);
  }, [playerCode, setPreference]);
  const removePreference = useCallback(() => {
    if (playerCode !== null && playerCode !== undefined) clearPreference(playerCode);
  }, [clearPreference, playerCode]);
  return { preference, override, setPreference: updatePreference, clearPreference: removePreference };
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
