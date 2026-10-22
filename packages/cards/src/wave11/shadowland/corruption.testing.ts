import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { P1, P2, firstLegal, inst, patchInstance, settle, type Picker } from "../../testing/harness.js";
import { WAVE11_DEPS } from "../index.js";
import { SPIDER_MAN, type Seats } from "../../wave9/testing.js";

/** Scenario helpers for the Heart of Shadow, Creeping Corruption, Ninja Swarm and Dark Protege tests. */
export const DEPS = WAVE11_DEPS;
export const KRAHLLAK = "65057";
export const CREEPING_CORRUPTION = "65072a";
const PLAYERS = [P1, P2];

/**
 * Core's Rhino game (or, with `villain: KRAHLLAK`, Krahllak's A side as the villain) past setup, against Core starter
 * decks, with `encounter` cards on top of the encounter deck (top first) and one Creeping Corruption (72A, Setup) in
 * each seat's play area. The Shadowland sets are gated for the playable scenario list but their cards are in the pool,
 * so the game is built by hand, as the other Shadowland tests do.
 */
export function shadowGame(
  opts: {
    readonly seats?: Seats;
    readonly villain?: string;
    readonly encounter?: readonly string[];
    readonly seed?: number;
    /** Default true: a Creeping Corruption for every seat. */
    readonly corruption?: boolean;
  } = {},
): GameState {
  const seats = opts.seats ?? [SPIDER_MAN];
  const config = coreScenario("rhino", {
    players: seats,
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  });
  const corruption = opts.corruption === false ? [] : seats.map(() => CREEPING_CORRUPTION);
  const created = createGame(
    {
      ...config,
      ...(opts.villain
        ? {
            villainCardId: cardId(opts.villain),
            villainSide: "A" as const,
            villainStartStageIndex: 0,
            villainLastStageIndex: 0,
          }
        : {}),
      encounterDeck: [...(opts.encounter ?? []), ...config.encounterDeck.map(String), ...corruption].map(cardId),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return redistribute(settled);
}

/** Setup puts every Setup upgrade into the first seat's play area; each other seat's copy is moved to that seat. */
function redistribute(state: GameState): GameState {
  let current = state;
  const copies = idsOf(current, CREEPING_CORRUPTION);
  copies.forEach((id, index) => {
    const player = PLAYERS[index];
    if (!player || index === 0 || current.players.length <= index) return;
    current = {
      ...current,
      players: current.players.map((p) => ({
        ...p,
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea.filter((x) => x !== id),
      })),
    };
    current = patchInstance(current, id, { controllerId: player, ownerId: player });
  });
  return current;
}

export const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => (s.instances[i]!.cardId as string) === code);
export const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

/** The Creeping Corruption `player` controls (either face), loose in their play area or attached to their identity. */
export const ccOf = (s: GameState, player: PlayerId = P1): InstanceId =>
  idsOf(s, CREEPING_CORRUPTION).find((id) => inst(s, id).controllerId === player && !s.encounterSetAside.includes(id))!;
export const corruption = (s: GameState, player: PlayerId = P1): number =>
  inst(s, ccOf(s, player)).counters["corruption"] ?? 0;
export const withCorruption = (s: GameState, n: number, player: PlayerId = P1): GameState =>
  patchInstance(s, ccOf(s, player), { counters: { ...inst(s, ccOf(s, player)).counters, corruption: n } });

/** Picks the option whose label matches the first pattern that any offered option matches; otherwise `firstLegal`. */
export const byLabel =
  (...patterns: readonly RegExp[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice) {
      for (const pattern of patterns) {
        const hit = choice.options.find((o) => pattern.test(o.label));
        if (hit) return [hit.optionId];
      }
    }
    return firstLegal(s);
  };

/** The labels of the options offered by the pending choice. */
export const offered = (s: GameState): string[] => s.pendingChoice?.options.map((o) => o.label) ?? [];

/** Core treachery with no boost icon and no boost ability, and Core Rhino attachments that touch no player: fillers. */
export const ADVANCE = "01186";
export const ASSAULT = "01187";
export const FILLER_A = "01098";
export const FILLER_B = "01100";

/** Picks the option whose id contains the first of these fragments that an offered option has, else `firstLegal`. */
export const byId =
  (...fragments: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice) {
      for (const fragment of fragments) {
        const hit = choice.options.find((o) => o.optionId.includes(fragment));
        if (hit) return [hit.optionId];
      }
    }
    return firstLegal(s);
  };

/** `pick`, noting each prompt (its kind, player and offered option ids) before it is answered. */
export function recording(pick: Picker, log: { kind: string; player: string; ids: string[] }[]): Picker {
  return (s) => {
    const c = s.pendingChoice!;
    log.push({ kind: c.prompt.kind, player: c.playerId, ids: c.options.map((o) => o.optionId) });
    return pick(s);
  };
}

/** Moves the first copy of each of these encounter cards from the encounter deck to its discard pile. */
export function toEncounterDiscard(state: GameState, ...codes: readonly string[]): GameState {
  const key = activeEncounterDeckId(state);
  const piles = state.encounterDecks[key]!;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const id = piles.deck.find((i) => codeOf(state, i) === code && !ids.includes(i));
    if (!id) throw new Error(`no ${code} in the encounter deck`);
    ids.push(id);
  }
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [key]: { deck: piles.deck.filter((i) => !ids.includes(i)), discard: [...piles.discard, ...ids] },
    },
  };
}

/** The codes of the encounter deck (top first) and of its discard pile. */
export const deckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
export const discardCodes = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));

/** An encounter card from the encounter deck (or its discard) attached to `host`, faceup: test surgery for an attachment already in play. */
export function attachEncounterCard(
  state: GameState,
  code: string,
  host: InstanceId,
): { state: GameState; id: InstanceId } {
  const key = activeEncounterDeckId(state);
  const piles = state.encounterDecks[key]!;
  const id = [...piles.deck, ...piles.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const moved: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [key]: { deck: piles.deck.filter((i) => i !== id), discard: piles.discard.filter((i) => i !== id) },
    },
  };
  const attached = patchInstance(moved, id, { attachedTo: host, faceup: true });
  return { id, state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }) };
}
