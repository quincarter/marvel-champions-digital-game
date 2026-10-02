import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, inst, patchInstance, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/**
 * A Magneto game past setup (the Acolytes modular set is another module, so it is left out; Core hero by default): the
 * Boarding Party side scheme is in play and Orbital Decay is set aside (the main scheme's own Setup).
 */
export function magnetoGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("magneto", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: [],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

/** Every instance of `code` in the active encounter deck or its discard pile. */
export const inEncounterPiles = (state: GameState, code: string): InstanceId[] => {
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  return [...pile.deck, ...pile.discard].filter((id) => state.instances[id]!.cardId === cardId(code));
};

/** The magnet counters on the main scheme. */
export const magnetCounters = (state: GameState): number =>
  inst(state, state.mainScheme.instanceId).counters.magnet ?? 0;

/** The main scheme holds exactly `n` magnet counters (state surgery). */
export const withMagnetCounters = (state: GameState, n: number): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { counters: { magnet: n } });

/** Puts the facedown encounter cards a Setup or reveal dealt back into the encounter discard pile, so a villain phase reveals only what a test stacks. */
export function withoutDealtCards(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const dealt = state.players.flatMap((p) => p.dealtEncounter);
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: pile.deck, discard: [...pile.discard, ...dealt] } },
  };
}

/** Puts the first card of `player`'s hand or deck printed as `code` into their play area, ready and under their control (state surgery: no cost). */
export function intoPlayArea(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const id = [...owner.hand, ...owner.deck].find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`${player} has no ${code} in hand or deck`);
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
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, exhausted: false, controllerId: player },
      },
    },
  };
}

/** Puts these cards on top of the encounter discard pile, the first code topmost (state surgery, from the deck or the pile). */
export function withDiscardOnTop(state: GameState, ...codes: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const id = [...pile.deck, ...pile.discard].find(
      (i) => state.instances[i]!.cardId === cardId(code) && !ids.includes(i),
    );
    if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
    ids.push(id);
  }
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: {
        deck: pile.deck.filter((i) => !ids.includes(i)),
        discard: [...ids, ...pile.discard.filter((i) => !ids.includes(i))],
      },
    },
  };
}
