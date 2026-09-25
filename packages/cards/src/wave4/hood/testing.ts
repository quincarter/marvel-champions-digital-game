import { cardOf, printedResources, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { cardId } from "@mc/content";
import { P1, patchInstance, playerOf } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { startWave4Game } from "../testing.js";
import { hoodScenario } from "./support.js";

/** Shared test helpers for every `hood/*.test.ts` file (re-derived from `hood.test.ts`'s own local helpers so each
 * modular set's test file can import them without depending on that file directly). */

export const game = (seed = 1, extraPlayers: readonly { readonly starterDeckId: string }[] = []) =>
  startWave4Game(hoodScenario("the-hood", { seed, extraPlayers }));

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

/** Stacks the encounter deck's very top with `codes` (`codes[0]` ends up on top). */
export function stackTop(state: GameState, ...codes: readonly string[]): GameState {
  const id = deckId(state);
  const pile = state.encounterDecks[id]!;
  const used = new Set<InstanceId>();
  const picked = codes.map((code) => {
    const wanted = cardId(code);
    const found = pile.deck.find((i) => state.instances[i]?.cardId === wanted && !used.has(i));
    if (!found) throw new Error(`no ${code} left in the encounter deck`);
    used.add(found);
    return found;
  });
  const rest = pile.deck.filter((i) => !used.has(i));
  return { ...state, encounterDecks: { ...state.encounterDecks, [id]: { ...pile, deck: [...picked, ...rest] } } };
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

export { patchInstance };
