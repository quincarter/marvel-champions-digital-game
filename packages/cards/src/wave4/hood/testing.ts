import {
  applyCommand,
  cardOf,
  printedResources,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, P1, patchInstance, playerOf } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { startWave4Game, WAVE4_DEPS } from "../testing.js";
import { hoodScenario } from "./support.js";

/** Shared test helpers for every `hood/*.test.ts` file (re-derived from `hood.test.ts`'s own local helpers so each
 * modular set's test file can import them without depending on that file directly). */

export const game = (
  seed = 1,
  extraPlayers: readonly { readonly starterDeckId: string }[] = [],
  setAsideModularSetIds?: readonly string[],
) =>
  startWave4Game(
    hoodScenario("the-hood", { seed, extraPlayers, ...(setAsideModularSetIds ? { setAsideModularSetIds } : {}) }),
  );

export const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
export const deckId = (state: GameState): string => Object.keys(state.encounterDecks)[0]!;
export const dealt = (state: GameState, player: PlayerId = P1): readonly InstanceId[] =>
  playerOf(state, player).dealtEncounter;

/** Forces the villain onto a specific stage (0 = The Hood I, 1 = II, 2 = III). */
export function onStage(state: GameState, stageIndex: number): GameState {
  return { ...state, villains: state.villains.map((v) => ({ ...v, stageIndex })) };
}

/** Puts `player` into hero form. */
export function heroified(state: GameState, player: PlayerId = P1): GameState {
  return withForm(state, { heroForm: 0 }, player);
}

/**
 * Stacks the encounter deck's very top with `codes` (`codes[0]` ends up on top). A copy is taken from the deck first,
 * then from the discard pile or a player's facedown dealt cards (setup's own Foul Play can discard or deal any card
 * before a test starts, depending on the seed).
 */
export function stackTop(state: GameState, ...codes: readonly string[]): GameState {
  const id = deckId(state);
  const pile = state.encounterDecks[id]!;
  const dealtPiles = state.players.flatMap((p) => p.dealtEncounter);
  const used = new Set<InstanceId>();
  const picked = codes.map((code) => {
    const wanted = cardId(code);
    const found = [...pile.deck, ...pile.discard, ...dealtPiles].find(
      (i) => state.instances[i]?.cardId === wanted && !used.has(i),
    );
    if (!found) throw new Error(`no ${code} left in the encounter deck, its discard pile or a dealt pile`);
    used.add(found);
    return found;
  });
  const rest = pile.deck.filter((i) => !used.has(i));
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, dealtEncounter: p.dealtEncounter.filter((i) => !used.has(i)) })),
    instances: Object.fromEntries(
      Object.entries(state.instances).map(([key, inst]) =>
        used.has(key as InstanceId) ? [key, { ...inst, faceup: false }] : [key, inst],
      ),
    ) as GameState["instances"],
    encounterDecks: {
      ...state.encounterDecks,
      [id]: { deck: [...picked, ...rest], discard: pile.discard.filter((i) => !used.has(i)) },
    },
  };
}

/** Returns every player's facedown dealt encounter cards to the bottom of the encounter deck (a clean villain phase). */
export function withoutDealtCards(state: GameState): GameState {
  const id = deckId(state);
  const pile = state.encounterDecks[id]!;
  const dealtIds = state.players.flatMap((p) => p.dealtEncounter);
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...state.encounterDecks, [id]: { ...pile, deck: [...pile.deck, ...dealtIds] } },
  };
}

/** Places `code` engaged with `player`, faceup, in `player`'s own `playArea` — a minion's real zone once revealed. */
export function minionEngagedWith(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = deckId(state);
  const pile = state.encounterDecks[deck]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deck]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player },
      },
    },
  };
}

/** Places `code` in the shared villain area (the villain itself, side schemes, attachments before they attach). */
export function encounterCardInVillainArea(
  state: GameState,
  code: string,
  threat = 0,
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = deckId(state);
  const pile = state.encounterDecks[deck]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deck]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, threat, faceup: true } },
    },
  };
}

/** Attaches `code` (pulled fresh out of the encounter deck) to `hostId`, faceup and uncontrolled. */
export function attachedTo(
  state: GameState,
  code: string,
  hostId: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const staged = encounterCardInVillainArea(state, code);
  return {
    id: staged.id,
    state: {
      ...staged.state,
      villainArea: staged.state.villainArea.filter((id) => id !== staged.id),
      instances: {
        ...staged.state.instances,
        [staged.id]: { ...staged.state.instances[staged.id]!, attachedTo: hostId, controllerId: null },
        [hostId]: {
          ...staged.state.instances[hostId]!,
          attachments: [...staged.state.instances[hostId]!.attachments, staged.id],
        },
      },
    },
  };
}

/**
 * Folds one of the game's own set-aside modular sets straight into the encounter deck (test-only surgery standing
 * in for `shuffleInSetAsideModularSet`'s own random pick, so a modular set's own cards are reachable without
 * depending on which set the seed happens to choose). The set's cards go on top, in whatever order they were set
 * aside in — deterministic enough for a test that then uses `stackTop`/`minionEngagedWith` to pick a specific one.
 */
export function foldModularSetIntoDeck(state: GameState, setId: string): GameState {
  const entry = state.setAsideModularSets?.find((s) => s.encounterSetId === setId);
  // Already shuffled in by the scenario's own Setup ability (seeded RNG picked this exact set): nothing to do —
  // its cards are already reachable in the encounter deck.
  if (!entry) return state;
  const deck = deckId(state);
  const pile = state.encounterDecks[deck]!;
  return {
    ...state,
    setAsideModularSets: state.setAsideModularSets!.filter((s) => s.encounterSetId !== setId),
    encounterSetAside: state.encounterSetAside.filter((id) => !entry.instanceIds.includes(id)),
    encounterDecks: { ...state.encounterDecks, [deck]: { ...pile, deck: [...entry.instanceIds, ...pile.deck] } },
  };
}

/** `n` hand cards that can pay `type` (their own printed type, or wild). */
export function paymentFor(
  state: GameState,
  playerId: PlayerId,
  type: "physical" | "mental" | "energy",
  n: number,
  excluding: readonly InstanceId[] = [],
): readonly { readonly fromHand: InstanceId }[] {
  const player = playerOf(state, playerId);
  const usable = player.hand.filter((id) => {
    if (excluding.includes(id)) return false;
    const c = cardOf(state, id);
    if (!c) return false;
    const pool = printedResources(c);
    return pool[type] > 0 || pool.wild > 0;
  });
  if (usable.length < n) throw new Error(`not enough ${type}-payable cards for ${playerId}`);
  return usable.slice(0, n).map((fromHand) => ({ fromHand }));
}

/**
 * A Hood game ready for an exact villain-phase test: the given modular sets set aside and then folded into the
 * encounter deck (`fold`), no facedown dealt cards, an empty main scheme (so no villain phase completes it), and P1 in
 * hero form unless `alterEgo`.
 */
export function cleanGame(
  opts: {
    readonly seed?: number;
    readonly fold?: readonly string[];
    readonly setAside?: readonly string[];
    readonly alterEgo?: boolean;
    readonly extraPlayers?: readonly { readonly starterDeckId: string }[];
  } = {},
): GameState {
  const fold = opts.fold ?? [];
  const setAside = opts.setAside ?? [
    ...fold,
    ...HOOD_SETS.filter((set) => !fold.includes(set)).slice(0, Math.max(0, 7 - fold.length)),
  ];
  let state = game(opts.seed ?? 1, opts.extraPlayers ?? [], setAside);
  for (const set of fold) state = foldModularSetIntoDeck(state, set);
  state = withoutDealtCards(state);
  state = patchInstance(state, state.mainScheme.instanceId, { threat: 0 });
  return opts.alterEgo ? state : heroified(state, P1);
}
const HOOD_SETS = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "state_of_emergency",
  "streets_of_mayhem",
  "wrecking_crew_modular",
];

/**
 * Stacks exactly `codes` on the encounter deck and ends P1's turn, answering each defender prompt in turn from
 * `defenders` (an instance id, or "decline"; declined once the list runs out) and everything else with `pick`. Returns
 * the villain phase's events.
 */
export function villainPhaseWith(
  state: GameState,
  codes: readonly string[],
  opts: { readonly defenders?: readonly string[]; readonly pick?: (s: GameState) => readonly string[] } = {},
): { readonly state: GameState; readonly events: readonly GameEvent[]; readonly staged: GameState } {
  const staged = codes.length > 0 ? stackTop(state, ...codes) : state;
  let asked = 0;
  const pick = (s: GameState): readonly string[] => {
    if (s.pendingChoice?.prompt.kind === "declareDefender") return [opts.defenders?.[asked++] ?? "decline"];
    return (opts.pick ?? firstLegal)(s);
  };
  const events: GameEvent[] = [];
  let current = staged;
  const first = applyCommand(current, { type: "endTurn", playerId: P1 }, WAVE4_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  current = first.state;
  events.push(...first.events);
  while (current.pendingChoice && !current.outcome) {
    const choice = current.pendingChoice;
    const next = applyCommand(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(current) },
      WAVE4_DEPS,
    );
    if (!next.ok) throw new Error(next.error.message);
    current = next.state;
    events.push(...next.events);
  }
  return { state: current, events, staged };
}

/** The events a card itself caused (`sourceInstanceId`). */
export const eventsFrom = (events: readonly GameEvent[], source: InstanceId): readonly GameEvent[] =>
  events.filter((e) => "sourceInstanceId" in e && e.sourceInstanceId === source);
/** The card codes revealed, in order. */
export const revealedCodes = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.cardId as string] : []));
/** `[target, amount]` for each `damageDealt` event. */
export const damageDealt = (events: readonly GameEvent[]): readonly (readonly [InstanceId, number])[] =>
  events.flatMap((e) => (e.type === "damageDealt" ? [[e.targetInstanceId, e.amount] as const] : []));

/** Puts a copy of `code` from `player`'s hand or deck into play under their control (test-only surgery). */
export function playerCardInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = playerOf(state, player);
  const id = [...seat.hand, ...seat.deck].find((i) => state.instances[i]!.cardId === code);
  if (!id) throw new Error(`no ${code} in ${player}'s hand or deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: player } },
    },
  };
}

/** Sets `player`'s hand to exactly these cards (from their hand or deck); every other hand card goes to the deck. */
export function withHand(state: GameState, codes: readonly string[], player: PlayerId = P1): GameState {
  const seat = playerOf(state, player);
  const pool = [...seat.hand, ...seat.deck];
  const used = new Set<InstanceId>();
  for (const code of codes) {
    const id = pool.find((i) => state.instances[i]!.cardId === code && !used.has(i));
    if (!id) throw new Error(`no ${code} for ${player}`);
    used.add(id);
  }
  const hand = [...used];
  const deck = pool.filter((i) => !used.has(i));
  return { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck } : p)) };
}

export { patchInstance };
