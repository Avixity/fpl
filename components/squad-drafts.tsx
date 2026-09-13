'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CopyPlus, Save, Trash2, Users, X } from 'lucide-react';
import { PlayerVisual } from '@/components/team-visuals';
import { Button } from '@/components/ui/button';
import type { DashboardData, PlayerView, SquadPlayer } from '@/lib/fpl-types';

const STORAGE_VERSION = 1;

type DraftSlot = {
  playerId: number;
  position: number;
};

export type SquadDraft = {
  id: string;
  name: string;
  eventId: number | null;
  slots: DraftSlot[];
  captainId: number | null;
  viceCaptainId: number | null;
  createdAt: string;
  updatedAt: string;
};

type StoredDrafts = {
  version: typeof STORAGE_VERSION;
  managerId: number;
  activeDraftId: string | null;
  drafts: SquadDraft[];
};

export type DraftValidation = {
  valid: boolean;
  errors: string[];
  starterCount: number;
  formation: {
    GK: number;
    DEF: number;
    MID: number;
    FWD: number;
  };
};

export type SquadDraftManagerProps = {
  data: Pick<DashboardData, 'manager' | 'nextEvent' | 'publishedGameweek' | 'squad'>;
  className?: string;
  onOpenPlayer?: (player: PlayerView) => void;
  onDraftChange?: (draft: SquadDraft | null, validation: DraftValidation | null) => void;
};

function storageKey(managerId: number) {
  return `fpl_squad_drafts_v1:${managerId}`;
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultDraftName(eventId: number | null, number: number) {
  return `${eventId ? `GW${eventId}` : 'Squad'} draft ${number}`;
}

function createDraft(
  squad: SquadPlayer[],
  eventId: number | null,
  number: number,
  source?: SquadDraft,
): SquadDraft {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: defaultDraftName(eventId, number),
    eventId,
    slots: source
      ? source.slots.map((slot) => ({ ...slot }))
      : squad.map((player) => ({ playerId: player.id, position: player.squadPosition })),
    captainId: source?.captainId ?? squad.find((player) => player.captain)?.id ?? null,
    viceCaptainId: source?.viceCaptainId ?? squad.find((player) => player.viceCaptain)?.id ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredDraft(value: unknown): value is SquadDraft {
  if (!isObject(value) || !Array.isArray(value.slots)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.eventId === 'number' || value.eventId === null) &&
    (typeof value.captainId === 'number' || value.captainId === null) &&
    (typeof value.viceCaptainId === 'number' || value.viceCaptainId === null) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    value.slots.every(
      (slot) => isObject(slot) && typeof slot.playerId === 'number' && typeof slot.position === 'number',
    )
  );
}

function parseStoredDrafts(raw: string | null, managerId: number): StoredDrafts | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isObject(parsed) ||
      parsed.version !== STORAGE_VERSION ||
      parsed.managerId !== managerId ||
      !Array.isArray(parsed.drafts) ||
      !parsed.drafts.every(isStoredDraft) ||
      !(typeof parsed.activeDraftId === 'string' || parsed.activeDraftId === null)
    ) {
      return null;
    }
    return parsed as StoredDrafts;
  } catch {
    return null;
  }
}

function reconcileDraft(draft: SquadDraft, squad: SquadPlayer[]): SquadDraft {
  const currentIds = new Set(squad.map((player) => player.id));
  const acceptedIds = new Set<number>();
  const acceptedPositions = new Set<number>();
  const slots: DraftSlot[] = [];

  for (const slot of draft.slots) {
    if (
      currentIds.has(slot.playerId) &&
      slot.position >= 1 &&
      slot.position <= 15 &&
      !acceptedIds.has(slot.playerId) &&
      !acceptedPositions.has(slot.position)
    ) {
      slots.push({ ...slot });
      acceptedIds.add(slot.playerId);
      acceptedPositions.add(slot.position);
    }
  }

  for (const player of squad) {
    if (acceptedIds.has(player.id)) continue;
    const preferred = player.squadPosition;
    const openPosition = !acceptedPositions.has(preferred)
      ? preferred
      : Array.from({ length: 15 }, (_, index) => index + 1).find(
          (position) => !acceptedPositions.has(position),
        );
    if (!openPosition) continue;
    slots.push({ playerId: player.id, position: openPosition });
    acceptedIds.add(player.id);
    acceptedPositions.add(openPosition);
  }

  const captainId = draft.captainId !== null && currentIds.has(draft.captainId) ? draft.captainId : null;
  const viceCaptainId =
    draft.viceCaptainId !== null && currentIds.has(draft.viceCaptainId) ? draft.viceCaptainId : null;

  return { ...draft, slots, captainId, viceCaptainId };
}

export function validateSquadDraft(draft: SquadDraft, squad: SquadPlayer[]): DraftValidation {
  const players = new Map(squad.map((player) => [player.id, player]));
  const starters = draft.slots
    .filter((slot) => slot.position <= 11)
    .map((slot) => players.get(slot.playerId))
    .filter((player): player is SquadPlayer => Boolean(player));
  const starterIds = new Set(starters.map((player) => player.id));
  const formation = {
    GK: starters.filter((player) => player.position === 'GK').length,
    DEF: starters.filter((player) => player.position === 'DEF').length,
    MID: starters.filter((player) => player.position === 'MID').length,
    FWD: starters.filter((player) => player.position === 'FWD').length,
  };
  const errors: string[] = [];

  if (starters.length !== 11) errors.push(`Starting XI has ${starters.length} players instead of 11.`);
  if (formation.GK !== 1) errors.push('Starting XI must contain exactly 1 goalkeeper.');
  if (formation.DEF < 3 || formation.DEF > 5) errors.push('Starting XI must contain 3 to 5 defenders.');
  if (formation.MID < 2 || formation.MID > 5) errors.push('Starting XI must contain 2 to 5 midfielders.');
  if (formation.FWD < 1 || formation.FWD > 3) errors.push('Starting XI must contain 1 to 3 forwards.');
  if (draft.captainId === null || !starterIds.has(draft.captainId)) {
    errors.push('Choose a captain from the starting XI.');
  }
  if (draft.viceCaptainId === null || !starterIds.has(draft.viceCaptainId)) {
    errors.push('Choose a vice captain from the starting XI.');
  }
  if (draft.captainId !== null && draft.captainId === draft.viceCaptainId) {
    errors.push('Captain and vice captain must be different players.');
  }

  return { valid: errors.length === 0, errors, starterCount: starters.length, formation };
}

function formationLabel(validation: DraftValidation) {
  return `${validation.formation.DEF}-${validation.formation.MID}-${validation.formation.FWD}`;
}

export function SquadDraftManager({
  data,
  className = '',
  onOpenPlayer,
  onDraftChange,
}: SquadDraftManagerProps) {
  const managerId = data.manager.id;
  const eventId = data.nextEvent?.id ?? null;
  const [drafts, setDrafts] = useState<SquadDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const squadSignature = useMemo(
    () =>
      [...data.squad]
        .sort((a, b) => a.id - b.id)
        .map((player) => `${player.id}:${player.squadPosition}`)
        .join(','),
    [data.squad],
  );

  useEffect(() => {
    const key = storageKey(managerId);
    const load = (raw: string | null) => {
      const stored = parseStoredDrafts(raw, managerId);
      const nextDrafts = stored?.drafts.map((draft) => reconcileDraft(draft, data.squad)) ?? [];
      if (nextDrafts.length === 0) {
        const firstDraft = createDraft(data.squad, eventId, 1);
        setDrafts([firstDraft]);
        setActiveDraftId(firstDraft.id);
      } else {
        setDrafts(nextDrafts);
        setActiveDraftId(
          nextDrafts.some((draft) => draft.id === stored?.activeDraftId)
            ? (stored?.activeDraftId ?? nextDrafts[0].id)
            : nextDrafts[0].id,
        );
      }
      setSelectedPlayerId(null);
      setLoaded(true);
    };

    setLoaded(false);
    load(window.localStorage.getItem(key));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) load(event.newValue);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [managerId, eventId, squadSignature, data.squad]);

  useEffect(() => {
    if (!loaded) return;
    const payload: StoredDrafts = {
      version: STORAGE_VERSION,
      managerId,
      activeDraftId,
      drafts,
    };
    window.localStorage.setItem(storageKey(managerId), JSON.stringify(payload));
  }, [activeDraftId, drafts, loaded, managerId]);

  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? null;
  const validation = useMemo(
    () => (activeDraft ? validateSquadDraft(activeDraft, data.squad) : null),
    [activeDraft, data.squad],
  );
  const playersById = useMemo(() => new Map(data.squad.map((player) => [player.id, player])), [data.squad]);
  const orderedSlots = useMemo(
    () => [...(activeDraft?.slots ?? [])].sort((a, b) => a.position - b.position),
    [activeDraft],
  );
  const starters = orderedSlots.filter((slot) => slot.position <= 11);
  const bench = orderedSlots.filter((slot) => slot.position > 11);

  useEffect(() => {
    onDraftChange?.(activeDraft, validation);
  }, [activeDraft, onDraftChange, validation]);

  function updateActiveDraft(update: (draft: SquadDraft) => SquadDraft) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraftId ? { ...update(draft), updatedAt: new Date().toISOString() } : draft,
      ),
    );
  }

  function createNewDraft() {
    const draft = createDraft(data.squad, eventId, drafts.length + 1, activeDraft ?? undefined);
    setDrafts((current) => [...current, draft]);
    setActiveDraftId(draft.id);
    setSelectedPlayerId(null);
  }

  function deleteActiveDraft() {
    if (!activeDraft) return;
    const remaining = drafts.filter((draft) => draft.id !== activeDraft.id);
    setDrafts(remaining);
    setActiveDraftId(remaining[0]?.id ?? null);
    setSelectedPlayerId(null);
  }

  function choosePlayer(playerId: number) {
    if (!activeDraft) return;
    if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId);
      return;
    }
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }
    updateActiveDraft((draft) => {
      const first = draft.slots.find((slot) => slot.playerId === selectedPlayerId);
      const second = draft.slots.find((slot) => slot.playerId === playerId);
      if (!first || !second) return draft;
      return {
        ...draft,
        slots: draft.slots.map((slot) => {
          if (slot.playerId === first.playerId) return { ...slot, position: second.position };
          if (slot.playerId === second.playerId) return { ...slot, position: first.position };
          return slot;
        }),
      };
    });
    setSelectedPlayerId(null);
  }

  function chooseCaptain(playerId: number) {
    updateActiveDraft((draft) => ({
      ...draft,
      captainId: playerId,
      viceCaptainId: draft.viceCaptainId === playerId ? draft.captainId : draft.viceCaptainId,
    }));
  }

  function chooseViceCaptain(playerId: number) {
    updateActiveDraft((draft) => ({
      ...draft,
      captainId: draft.captainId === playerId ? draft.viceCaptainId : draft.captainId,
      viceCaptainId: playerId,
    }));
  }

  function renderPlayer(slot: DraftSlot, area: 'starter' | 'bench') {
    const player = playersById.get(slot.playerId);
    if (!player || !activeDraft) return null;
    const selected = player.id === selectedPlayerId;
    const isCaptain = player.id === activeDraft.captainId;
    const isViceCaptain = player.id === activeDraft.viceCaptainId;
    const isStarter = area === 'starter';

    return (
      <article
        className={`draft-player draft-player-${area}${selected ? ' is-selected' : ''}`}
        data-position={player.position}
        key={player.id}
      >
        <button
          aria-label={selected ? `Cancel ${player.name} selection` : `Select ${player.name} to swap`}
          aria-pressed={selected}
          className="draft-player-swap"
          onClick={() => choosePlayer(player.id)}
          type="button"
        >
          <PlayerVisual player={player} size={isStarter ? 'pitch' : 'sm'} />
          <span className="draft-player-copy">
            <strong>{player.name}</strong>
            <small>{player.team} · {player.position}</small>
          </span>
          <span className="draft-player-xpts">{player.projection.next.toFixed(1)} xPts</span>
        </button>
        <div className="draft-player-actions" aria-label={`${player.name} roles`}>
          <button
            aria-label={`Make ${player.name} captain`}
            aria-pressed={isCaptain}
            className={isCaptain ? 'is-active' : ''}
            disabled={!isStarter}
            onClick={() => chooseCaptain(player.id)}
            type="button"
          >
            C
          </button>
          <button
            aria-label={`Make ${player.name} vice captain`}
            aria-pressed={isViceCaptain}
            className={isViceCaptain ? 'is-active' : ''}
            disabled={!isStarter}
            onClick={() => chooseViceCaptain(player.id)}
            type="button"
          >
            VC
          </button>
          {onOpenPlayer ? (
            <button aria-label={`Open ${player.name} details`} onClick={() => onOpenPlayer(player)} type="button">
              Details
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <section className={`squad-drafts ${className}`.trim()}>
      <header className="squad-drafts-header">
        <div>
          <p className="eyebrow">Saved on this device</p>
          <h2>Next GW drafts</h2>
          <p>Edit the starting XI, bench order and captaincy. Nothing here changes your FPL team.</p>
        </div>
        <Button onClick={createNewDraft} size="sm" type="button">
          <CopyPlus /> New draft
        </Button>
      </header>

      {!loaded ? <p className="squad-drafts-empty">Loading saved drafts…</p> : null}

      {loaded && activeDraft ? (
        <>
          <div className="squad-drafts-toolbar">
            <label>
              <span>Draft</span>
              <select
                onChange={(event) => {
                  setActiveDraftId(event.target.value);
                  setSelectedPlayerId(null);
                }}
                value={activeDraft.id}
              >
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>{draft.name}</option>
                ))}
              </select>
            </label>
            <label className="squad-drafts-name">
              <span>Name</span>
              <input
                maxLength={60}
                onChange={(event) => {
                  const name = event.target.value;
                  updateActiveDraft((draft) => ({ ...draft, name }));
                }}
                value={activeDraft.name}
              />
            </label>
            <Button aria-label="Delete active draft" onClick={deleteActiveDraft} size="icon-sm" type="button" variant="ghost">
              <Trash2 />
            </Button>
          </div>

          <div className="squad-drafts-status" data-valid={validation?.valid ?? false}>
            <span>{validation?.valid ? <Check /> : <X />}</span>
            <div>
              <strong>{validation?.valid ? 'Ready to use' : 'Draft needs attention'}</strong>
              <small>
                {validation
                  ? `${validation.starterCount} starters · ${formationLabel(validation)} formation`
                  : 'Validation unavailable'}
              </small>
            </div>
            <Save aria-label="Saved locally" />
          </div>

          <p className="squad-drafts-instruction">
            {selectedPlayerId === null
              ? 'Select two players to swap their positions.'
              : `Now select the player to swap with ${playersById.get(selectedPlayerId)?.name ?? 'your selection'}.`}
          </p>

          <div className="squad-drafts-layout">
            <div className="squad-drafts-pitch" aria-label="Draft starting eleven">
              {(['GK', 'DEF', 'MID', 'FWD'] as const).map((position) => {
                const row = starters.filter((slot) => playersById.get(slot.playerId)?.position === position);
                return <div className="squad-drafts-row" data-position={position} key={position}>{row.map((slot) => renderPlayer(slot, 'starter'))}</div>;
              })}
            </div>
            <aside className="squad-drafts-bench">
              <div className="squad-drafts-bench-title">
                <Users />
                <div><strong>Bench</strong><small>First substitute at the top</small></div>
              </div>
              {bench.map((slot) => renderPlayer(slot, 'bench'))}
            </aside>
          </div>

          {validation && !validation.valid ? (
            <ul className="squad-drafts-errors">
              {validation.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
        </>
      ) : null}

      {loaded && !activeDraft ? (
        <div className="squad-drafts-empty">
          <p>No saved drafts for this manager.</p>
          <Button onClick={createNewDraft} size="sm" type="button"><CopyPlus /> Create draft</Button>
        </div>
      ) : null}
    </section>
  );
}
