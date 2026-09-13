'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { FplTeam, PlayerFixture, PlayerView } from '@/lib/fpl-types';

type TeamSummary = Pick<FplTeam, 'name' | 'short_name' | 'code'>;

function teamTile(shortName: string) {
  return `/team_titles/${encodeURIComponent(shortName)}.png`;
}

export function TeamBadge({ team, size = 'md' }: { team: TeamSummary; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team.short_name]);

  return (
    <span className={`team-badge team-badge-${size}`} aria-hidden="true">
      {failed ? (
        <span>{team.short_name}</span>
      ) : (
        <Image alt="" fill onError={() => setFailed(true)} sizes="38px" src={teamTile(team.short_name)} />
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
    <span className={`club-identity ${compact ? 'club-identity-compact' : ''}`}>
      <TeamBadge size={size} team={team} />
      <span>{compact ? team.short_name : team.name}</span>
    </span>
  );
}

export function PlayerVisual({ player, size = 'md' }: { player: PlayerView; size?: 'sm' | 'md' | 'lg' | 'pitch' }) {
  const official = `https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.playerCode}.png`;
  const fallback = teamTile(player.teamShort);
  const [source, setSource] = useState(official);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSource(official);
    setFailed(false);
  }, [official]);

  function handleError() {
    if (source !== fallback) {
      setSource(fallback);
      return;
    }
    setFailed(true);
  }

  return (
    <span className={`player-visual player-visual-${size}`}>
      {failed ? (
        <span>{player.teamShort}</span>
      ) : (
        <Image alt={`${player.name}, ${player.team}`} fill onError={handleError} sizes="76px" src={source} />
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
